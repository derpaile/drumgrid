import { mkdir, readFile, writeFile } from "node:fs/promises";

const FACTOR = { Viertel: 1, Achtel: 2, "16tel": 4, Triolen: 3, Sextolen: 6 };
const HIT_STATES = ["ghost", "normal", "accent"];
const DRUM_VOICES = ["kick", "snare", "closedHat", "openHat", "ride", "crash", "rim", "highTom", "lowTom"];
const PATTERN_CATEGORIES = new Set([
  "Rock & Pop", "Punk & Metal", "Funk & Soul", "Hip-Hop", "Dance & Electronic",
  "Reggae", "Latin & World", "Blues & Shuffle", "Genreübergreifend",
]);
const BREAK_IDS = new Set([
  "drum-amen", "drum-apache", "drum-big-beat", "drum-express-yourself", "drum-funky-drummer",
  "drum-hot-pants", "drum-impeach", "drum-its-a-new-day", "drum-roachclip",
  "drum-synthetic-substitution", "drum-think-break",
]);
const TECHNIQUE_IDS = new Set([
  "drum-single-stroke", "drum-double-stroke", "drum-paradiddle", "drum-bonham-triplets",
  "drum-kick-doubles", "drum-tempo-pyramid",
]);
const BASIC_IDS = new Set([
  "drum-basic-rock", "drum-driving-rock", "drum-half-time", "drum-pop-sixteenths", "drum-pop-pocket-offbeats",
]);

const seq = (start, end, step = 1) => Array.from(
  { length: Math.max(0, Math.ceil((end - start) / step)) },
  (_, index) => start + index * step,
);
const shifted = (indices, offset) => indices.map((index) => index + offset);
const repeated = (indices, bars, stepsPerBar) => Array.from(
  { length: bars },
  (_, bar) => shifted(indices, bar * stepsPerBar),
).flat();

const sources = {
  amen: { label: "International Audio Laboratories Erlangen — Amen Break", url: "https://www.audiolabs-erlangen.de/resources/MIR/2016-IEEE-TASLP-DrumSeparation/AmenBreak" },
  breaks: { label: "MusicRadar — influential drum breaks", url: "https://www.musicradar.com/news/best-drum-breaks-of-all-time" },
  famous: { label: "Drumeo — recognizable drum beats", url: "https://www.drumeo.com/beat/the-20-most-recognizable-drum-beats-of-all-time/" },
  funky: { label: "Roland — Behind the Beat: Funky Drummer", url: "https://articles.roland.com/behind-the-beat-funky-drummer-by-james-brown/" },
  rosanna: { label: "MusicRadar — Rosanna Shuffle", url: "https://www.musicradar.com/artists/porcaro-makes-the-whole-process-look-effortless-and-easy-we-can-bet-that-this-didnt-happen-by-accident-or-overnight-exploring-the-genius-of-jeff-porcaros-rosanna-shuffle" },
  reggae: { label: "MusicRadar — One Drop", url: "https://www.musicradar.com/how-to/how-to-program-a-typical-one-drop-reggae-beat-and-add-fills" },
  dbeat: { label: "D-beat notation and history", url: "https://en.wikipedia.org/wiki/D-beat" },
  fourFloor: { label: "Four on the floor", url: "https://en.wikipedia.org/wiki/Four_on_the_floor_(music)" },
  boDiddley: { label: "Drums Database — Bo Diddley Beat", url: "https://www.drumsdatabase.com/bodiddley.htm" },
  microtiming: { label: "ZGMTH — Microtiming in Early Funk", url: "https://www.gmth.de/zeitschrift/artikel/1224.aspx" },
  nativeBreaks: { label: "Native Instruments — drum-break recreations and MIDI", url: "https://blog.native-instruments.com/best-drum-breaks/" },
  synthetic: { label: "Goodhertz — Synthetic Substitution", url: "https://goodhertz.com/funklet/synthetic-substitution/" },
  mardi: { label: "Hudson Music — The Breakbeat Bible sampler", url: "https://hudsonmusic.com/wp-content/uploads/2015/03/Breakbeat-Bible-Sampler.pdf" },
  bigBeat: { label: "Drumscore — The Big Beat", url: "https://drumscore.com/sheet-music/browse-by-artist/score/7719-billy-squier-the-big-beat-drum-sheet-music-tab" },
  hotPants: { label: "University of Hull — Rebecoming Analogue", url: "https://hull-repository.worktribe.com/output/4218015" },
};

function exercise(id, name, category, bpm, instruction, tracks, options = {}) {
  const patternType = TECHNIQUE_IDS.has(id) ? "Technik" : BREAK_IDS.has(id) ? "Break" : "Groove";
  const learningGoals = options.learningGoals || [
    difficultyGoal(options.difficulty || "Mittel"),
    patternType === "Technik" ? "Technik" : BASIC_IDS.has(id) ? "Grundlagen" : ["drum-five-four", "drum-seven-eight"].includes(id) ? "Ungerade Takte" : category === "Blues & Shuffle" ? "Pocket" : "Timing",
  ].filter((value, index, values) => values.indexOf(value) === index);
  return {
    id, name, category, patternType, bpmMin: bpm[0], bpmMax: bpm[1],
    meter: options.meter || "4/4", subdivision: options.subdivision || "16tel",
    bars: options.bars || 1, grouping: options.grouping,
    difficulty: options.difficulty || "Mittel", instruction, tracks,
    attribution: options.attribution || (options.source ? "Quellenbasierte Übungsrekonstruktion" : "Genreübung"),
    learningGoals,
    whyInteresting: options.whyInteresting || instruction,
    playback: options.playback, source: options.source, originalFeel: options.originalFeel, drumOnly: true,
  };
}

function difficultyGoal(difficulty) {
  return difficulty === "Leicht" ? "Grundlagen" : difficulty === "Fortgeschritten" ? "Koordination" : "Pocket";
}

const eighths16 = seq(0, 16, 2);
const quarters16 = seq(0, 16, 4);
const sixteenths = seq(0, 16);
const shuffle12 = [0, 2, 3, 5, 6, 8, 9, 11];

const exercises = [
  exercise("drum-basic-rock", "Rock-Backbeat", "Rock & Pop", [45, 160], "Spiele Kick auf eins und drei, Snare auf zwei und vier und führe die Hi-Hat in Achteln.", {
    kick: { accent: [0, 4] }, snare: { accent: [2, 6] }, closedHat: { normal: seq(0, 8), accent: [0, 2, 4, 6] },
  }, { subdivision: "Achtel", difficulty: "Leicht", playback: { bpm: 92, kit: "Studio" } }),
  exercise("drum-driving-rock", "Driving Rock", "Rock & Pop", [70, 190], "Halte die Achtelhand konstant und setze die zusätzliche Kick vor Schlag drei sauber.", {
    kick: { accent: [0, 6, 8] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: quarters16 },
  }, { difficulty: "Leicht", playback: { bpm: 118, kit: "Studio" } }),
  exercise("drum-half-time", "Half-Time Backbeat", "Rock & Pop", [50, 130], "Lass die Snare schwer auf drei landen; Kick und Hi-Hat halten den großen Raum zusammen.", {
    kick: { accent: [0, 6, 10] }, snare: { accent: [8] }, closedHat: { normal: eighths16, accent: quarters16 },
  }, { difficulty: "Leicht", playback: { bpm: 82, kit: "Trocken" } }),
  exercise("drum-pop-sixteenths", "Pop-Sechzehntel", "Rock & Pop", [55, 125], "Spiele durchgehende Sechzehntel auf der Hi-Hat und halte Backbeat und Kick entspannt.", {
    kick: { accent: [0, 7, 8, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: sixteenths, accent: quarters16 },
  }, { playback: { bpm: 96, kit: "Studio" } }),
  exercise("drum-punk", "Punk Double-Time", "Punk & Metal", [130, 240], "Führe schnelle Achtel auf der Hi-Hat, Snare auf den Offbeats und die Kick ohne Verkrampfung.", {
    kick: { accent: [0, 3, 8, 11] }, snare: { accent: [2, 6, 10, 14] }, closedHat: { accent: eighths16 },
  }, { playback: { bpm: 180, kit: "Trocken" } }),
  exercise("drum-four-floor", "Four on the Floor", "Dance & Electronic", [90, 150], "Setze die Kick auf alle vier Viertel, die Snare auf zwei und vier und öffne die Hat auf den Offbeats.", {
    kick: { accent: quarters16 }, snare: { accent: [4, 12] }, closedHat: { normal: quarters16 }, openHat: { accent: [2, 6, 10, 14] },
  }, { playback: { bpm: 124, kit: "Elektronisch" }, source: sources.fourFloor }),
  exercise("drum-disco", "Disco Open-Hat", "Dance & Electronic", [95, 140], "Halte vier Kicks stabil; die offene Hi-Hat hebt jedes Und an.", {
    kick: { accent: quarters16 }, snare: { accent: [4, 12] }, closedHat: { normal: quarters16 }, openHat: { accent: [2, 6, 10, 14] }, crash: { accent: [0] },
  }, { playback: { bpm: 118, kit: "Studio" }, source: sources.fourFloor }),
  exercise("drum-house", "House mit synkopierter Clap", "Dance & Electronic", [110, 145], "Halte die Kick in Vierteln und ergänze die leisen Clap-Vorzieher erst, wenn die offenen Hats stabil liegen.", {
    kick: { accent: quarters16 }, snare: { accent: [4, 12], ghost: [3, 11] }, closedHat: { normal: [0, 4, 8, 12] }, openHat: { accent: [2, 6, 10, 14] }, rim: { normal: [7, 15] },
  }, { playback: { bpm: 126, kit: "Elektronisch" }, source: sources.fourFloor, learningGoals: ["Pocket", "Koordination"] }),
  exercise("drum-boom-bap", "Boom-Bap Pocket", "Hip-Hop", [70, 105], "Lege Kick und Snare leicht hinter den Puls und lasse die Ghostnote vor vier klein.", {
    kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12], ghost: [11] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 88, swing: 57, kit: "Trocken" } }),
  exercise("drum-trap", "Trap Half-Time", "Hip-Hop", [55, 85], "Halte die Snare auf drei schwer und spiele die Hat-Rolls kontrolliert gegen die Kick.", {
    kick: { accent: [0, 7, 10, 14] }, snare: { accent: [8] }, closedHat: { normal: sixteenths, accent: [0, 6, 8, 14] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 72, kit: "Elektronisch" } }),

  exercise("drum-amen", "Amen Break — Übungsrekonstruktion", "Dance & Electronic", [80, 180], "Spiele den viertaktigen Coleman-Break: Ride-Achtel tragen die versetzten Kicks, Ghostnotes und späten Snares.", {
    kick: { accent: [0, 2, 10, 11, 16, 18, 26, 27, 32, 34, 42, 50, 51, 58] },
    snare: { accent: [4, 12, 20, 28, 36, 46, 52, 62], ghost: [7, 9, 15, 23, 25, 31, 39, 41, 49, 55, 57] },
    ride: { normal: [...repeated(eighths16, 3, 16), ...shifted([0, 2, 4, 6, 8, 12, 14], 48)], accent: [0, 16, 32, 48] },
    openHat: { accent: [58] }, crash: { accent: [0] },
  }, { bars: 4, difficulty: "Fortgeschritten", playback: { bpm: 137, swing: 52, kit: "Studio" }, source: sources.amen }),
  exercise("drum-funky-drummer", "Funky Drummer — Zweitaktausschnitt", "Funk & Soul", [70, 120], "Spiele die ersten zwei Takte des achttaktigen Solos: einhändige Sechzehntel-Hat, Backbeat, Öffnungen und sehr leise Ghostnotes.", {
    kick: { accent: [0, 2, 10, 13, 16, 18, 26, 29] }, snare: { accent: [4, 12, 20, 28], ghost: [7, 9, 11, 15, 23, 25, 27, 31] },
    closedHat: { normal: seq(0, 32).filter((step) => ![5, 7, 13, 21, 29].includes(step)), accent: [0, 4, 8, 12, 16, 20, 24, 28] }, openHat: { accent: [5, 7, 13, 21, 29] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 101, swing: 50, kit: "Trocken" }, source: sources.funky, originalFeel: {
    label: "MIDI-Rekonstruktion", note: "Timing und Dynamik der zweitaktigen Native-Instruments-MIDI-Rekonstruktion.", sourceBpm: 101,
    timingMs: { kick: { 13: -6, 29: -6 }, snare: { 7: 15, 9: 15, 11: 15, 15: 15, 23: 15, 25: 15, 27: 15, 31: 15 }, closedHat: Object.fromEntries(seq(1, 32, 2).map((step) => [step, 6])), openHat: { 5: 9, 7: 9, 13: 9, 21: 9, 29: 9 } },
    velocityMultipliers: { kick: { 0: .77, 2: 1, 10: .77, 13: .77, 16: .77, 18: .95, 26: .8, 29: .58 }, closedHat: Object.fromEntries(seq(0, 32).map((step) => [step, step % 2 ? ([5, 7, 9, 11, 21, 23, 25, 27].includes(step) ? .44 : .76) : 1])) },
  } }),
  exercise("drum-impeach", "Impeach the President — Takt 1", "Funk & Soul", [70, 110], "Spiele den ersten dokumentierten Break-Takt; der Kick auf 2a liegt im Original deutlich spät.", {
    kick: { accent: [0, 7, 8, 10, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 7, 8, 12, 14] }, openHat: { accent: [10] },
  }, { playback: { bpm: 94, swing: 50, kit: "Trocken" }, source: sources.microtiming, originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen des ersten Break-Takts; beim Tempo proportional skaliert.", sourceBpm: 93.9464, timingMs: { kick: { 7: 52, 8: 12, 14: 4 }, snare: { 4: 16, 12: 19 }, closedHat: { 0: 15, 2: 7, 6: 21, 7: 31, 8: 11, 10: 7, 14: 12 } } } }),
  exercise("drum-think-break", "Think Break — Takt 23", "Funk & Soul", [75, 150], "Spiele den dokumentierten Kern aus Takt 23: Kick nur auf eins, Backbeats und drei Ghostnotes; Tamburin und Vocals sind weggelassen.", {
    kick: { accent: [0] }, snare: { accent: [4, 12], ghost: [7, 9, 10] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12] }, openHat: { accent: [14] },
  }, { playback: { bpm: 114, swing: 50, kit: "Trocken" }, source: sources.microtiming, originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen von Takt 23; beim Tempo proportional skaliert.", sourceBpm: 113.2922, timingMs: { snare: { 4: 15, 9: 15, 12: -2 }, openHat: { 14: -1 } } } }),
  exercise("drum-apache", "Apache — Takt 7", "Funk & Soul", [80, 145], "Spiele Takt 7 der dokumentierten Break-Passage; die Bongo-Schicht bleibt außerhalb des Drumset-Rasters.", {
    kick: { accent: [0, 2, 10] }, snare: { accent: [4, 12], ghost: [9, 15] }, closedHat: { normal: eighths16 },
  }, { playback: { bpm: 119, swing: 50, kit: "Studio" }, source: sources.microtiming, originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen von Takt 7; beim Tempo proportional skaliert.", sourceBpm: 118.7702, timingMs: { kick: { 10: -11 }, snare: { 4: -4, 9: 14, 12: 4, 15: 30 }, closedHat: { 6: 7, 8: 2, 10: -4, 14: 7 } } } }),
  exercise("drum-big-beat", "The Big Beat — Reduktion", "Rock & Pop", [70, 125], "Lass viel Luft zwischen Kick und geflammter Snare; der Break lebt von Raum statt Hi-Hat-Dichte.", {
    kick: { accent: [0, 3, 6, 8] }, snare: { accent: [4, 12], ghost: [13] }, crash: { accent: [0] },
  }, { playback: { bpm: 108, kit: "Studio" }, source: sources.bigBeat }),
  exercise("drum-synthetic-substitution", "Synthetic Substitution — Zweitaktform", "Funk & Soul", [70, 125], "Spiele die dokumentierte zweitaktige Kickfolge gegen vier Backbeats; die Hat-Akzente bilden Purdies Dynamik ab.", {
    kick: { accent: [2, 7, 10, 11, 16, 18, 23, 26, 27], normal: [0, 9, 15, 25], ghost: [31] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { accent: [0, 2, 6, 8, 14, 18, 22, 24, 30], normal: [4, 10, 12, 16, 20, 26, 28] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 93, swing: 50, kit: "Trocken" }, source: sources.synthetic }),
  exercise("drum-roachclip", "Ashley’s Roachclip — Zweitaktform", "Funk & Soul", [65, 115], "Spiele die zweitaktige MIDI-Rekonstruktion; die Sechzehntel werden nicht auf ein Achtelpattern reduziert.", {
    kick: { accent: [0, 3, 6, 9, 10, 13, 16, 19, 22, 25, 26, 29] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] }, closedHat: { normal: seq(0, 32) },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 95, swing: 50, kit: "Trocken" }, source: sources.nativeBreaks, originalFeel: {
    label: "MIDI-Rekonstruktion", note: "Mikro-Timing und Dynamik der Native-Instruments-MIDI-Rekonstruktion.", sourceBpm: 95,
    timingMs: { kick: { 3: -26, 19: -26 }, closedHat: Object.fromEntries(seq(1, 32, 2).map((step) => [step, -16])), snare: { 15: 16 } },
    velocityMultipliers: { closedHat: { 0: .8, 1: .56, 2: .8, 3: 1, 4: .56, 5: .8, 6: 1, 7: .8, 8: .56, 9: .8, 10: .8, 11: 1, 12: .56, 13: .8, 14: 1, 15: .8, 16: 1, 17: .56, 18: .8, 19: .56, 20: 1, 21: .8, 22: .8, 23: .56, 24: 1, 25: .56, 26: .8, 27: 1, 28: .56, 29: .8, 30: 1, 31: .56 } },
  } }),
  exercise("drum-its-a-new-day", "It’s a New Day — Drum Break", "Funk & Soul", [70, 125], "Spiele die zwei wissenschaftlich dokumentierten Break-Takte; besonders die späten Kicks auf 3&, 3a und 4a prägen das Feel.", {
    kick: { accent: [0, 2, 10, 11, 15, 16, 18, 26, 27, 31] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { normal: repeated(eighths16, 2, 16) },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 96, swing: 50, kit: "Trocken" }, source: sources.microtiming, attribution: "Quellenbasierte Rekonstruktion (George Bragg, Skull Snaps)", originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen beider Break-Takte; beim Tempo proportional skaliert.", sourceBpm: 95.88, timingMs: { kick: { 2: -1, 10: 26, 11: 44, 15: 42, 18: 22, 26: 6, 27: 29, 31: 25 }, snare: { 4: -14, 12: 13, 20: 8, 28: 7 }, closedHat: { 0: -7, 2: -6, 4: -19, 6: -22, 8: -5, 10: 10, 12: 1, 14: 11, 16: -7, 18: -2, 20: -6, 22: 7, 24: 4, 28: -2, 30: 3 } } } }),
  exercise("drum-express-yourself", "Express Yourself — Zweitaktform", "Funk & Soul", [70, 120], "Spiele die zweitaktige MIDI-Rekonstruktion von James Gadsons Groove; Mikro-Timing bleibt in der Feel-Variante erhalten.", {
    kick: { accent: [0, 3, 8, 11, 14, 16, 19, 24, 27, 30] }, snare: { accent: [4, 9, 13, 20, 25, 28], ghost: [7, 11, 15, 23, 27] }, closedHat: { normal: seq(0, 30) }, openHat: { accent: [30] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 92, swing: 50, kit: "Trocken" }, source: sources.nativeBreaks, attribution: "MIDI-basierte Rekonstruktion (James Gadson)", originalFeel: { label: "MIDI-Rekonstruktion", note: "Timing und Dynamik der Native-Instruments-MIDI-Rekonstruktion.", sourceBpm: 92, timingMs: { kick: { 3: 14, 11: 14, 19: 14, 27: 14 }, snare: { 7: 14, 9: 14, 11: 14, 13: 14, 15: 14, 23: 14, 25: 14, 27: 14 }, closedHat: Object.fromEntries(seq(1, 30, 2).map((step) => [step, 14])) }, velocityMultipliers: { closedHat: { 0: .88, 1: .62, 2: 1, 3: .62, 4: .88, 5: .5, 6: .88, 7: .5, 8: .88, 9: .5, 10: .88, 11: .5, 12: .88, 13: .5, 14: .88, 15: .5, 16: .88, 17: .62, 18: 1, 19: .62, 20: .88, 21: .5, 22: .88, 23: .5, 24: .88, 25: .5, 26: .88, 27: .5, 28: .88, 29: .5 } } } }),
  exercise("drum-hot-pants", "Hot Pants (Bonus Beats) — Stilreduktion", "Funk & Soul", [75, 120], "Halte das Tamburin-Ersatzraster gerade und übe die belegte Vorverlagerung einzelner Vierer-Backbeats auf 3&; keine Volltranskription.", {
    kick: { accent: [0, 16] }, snare: { accent: [4, 12, 20, 26] }, closedHat: { normal: seq(0, 32) },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 96, swing: 50, kit: "Trocken" }, source: sources.hotPants, attribution: "Stilreduktion (John “Jabo” Starks, Bobby Byrd)" }),
  exercise("drum-mardi-gras", "Take Me to the Mardi Gras — Introreduktion", "Funk & Soul", [70, 125], "Übe die viertaktige Introform bei 104 BPM. Ride ersetzt Cowbell; die Snare-Doppelschläge auf 3e–3& stehen in Takt 1 und 3.", {
    kick: { accent: [0, 7, 10, 16, 23, 26, 32, 39, 42, 48, 55, 58] }, snare: { accent: [4, 12, 20, 28, 36, 44, 52, 60], ghost: [9, 10, 41, 42] }, ride: { normal: seq(0, 64, 4) },
  }, { bars: 4, difficulty: "Fortgeschritten", playback: { bpm: 104, swing: 50, kit: "Studio" }, source: sources.mardi, attribution: "Didaktische Reduktion (Steve Gadd, Bob James)" }),
  exercise("drum-god-made-me-funky", "God Made Me Funky — Linearübung", "Funk & Soul", [70, 125], "Spiele eine Mike-Clark-inspirierte Linearübung. Sie ist ausdrücklich keine Transkription des Originalbreaks.", {
    kick: { accent: [0, 7, 15, 16, 23, 31] }, snare: { accent: [6, 13, 22, 29] }, closedHat: { normal: [1, 3, 5, 8, 10, 12, 14, 17, 19, 21, 24, 26, 28, 30] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 98, swing: 50, kit: "Trocken" }, attribution: "Mike-Clark-inspirierte Stilübung" }),
  exercise("drum-cold-sweat", "Cold Sweat — Zweitaktgroove", "Funk & Soul", [75, 135], "Verbinde beide Takte des frühen Funkgrooves; Ghostnotes bleiben deutlich unter dem Backbeat.", {
    kick: { accent: [0, 8, 10, 18, 24, 26, 30] }, snare: { accent: [4, 14, 20, 28], ghost: [7, 17, 23, 25] },
    closedHat: { normal: [...[0, 2, 4, 6, 8, 12, 14], ...shifted(eighths16, 16)] }, openHat: { accent: [10] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 120, swing: 54, kit: "Trocken" }, source: sources.famous }),
  exercise("drum-rock-steady", "Rock Steady", "Funk & Soul", [65, 125], "Kontrolliere die weiten Hi-Hat-Öffnungen und Purdies leise Snare-Füllstimmen.", {
    kick: { accent: [2, 4, 7, 10, 12] }, snare: { accent: [4, 12], ghost: [1, 5, 7, 9, 13, 15] }, closedHat: { normal: [0, 4, 6, 8, 12, 14] }, openHat: { accent: [2, 10] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 105, swing: 57, kit: "Studio" }, source: sources.famous }),
  exercise("drum-levee", "When the Levee Breaks", "Rock & Pop", [45, 95], "Spiele Bonhams Raumgroove; die Ghost-Kick auf 1e simuliert nur das Bandecho und ist kein zusätzlich gespielter Downbeat.", {
    kick: { accent: [0, 10, 11], ghost: [1] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: quarters16 },
  }, { playback: { bpm: 72, kit: "Studio" }, source: sources.famous }),
  exercise("drum-superstition", "Superstition — Drumgroove", "Funk & Soul", [70, 125], "Halte den federnden Sechzehntelfluss und die Hat-Akzente gegen den geraden Backbeat.", {
    kick: { accent: quarters16 }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 7, 8, 9, 10, 12, 14, 15], accent: quarters16 },
  }, { playback: { bpm: 101, swing: 58, kit: "Trocken" }, source: sources.famous }),
  exercise("drum-cissy-strut", "Cissy Strut — Takte 3–4", "Funk & Soul", [60, 115], "Spiele die zwei dokumentierten Hauptgroove-Takte mit der charakteristischen verzahnten Kick-, Snare- und Hi-Hat-Figur.", {
    kick: { accent: [0, 3, 5, 8, 9, 11, 13, 16, 19, 21, 24, 25, 27, 29] }, snare: { accent: [4, 12, 14, 20, 28, 30] }, closedHat: { normal: [1, 2, 4, 7, 9, 10, 12, 14, 17, 18, 20, 23, 25, 26, 28, 30] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 89, swing: 50, kit: "Trocken" }, source: sources.microtiming, attribution: "Quellenbasierte Rekonstruktion (Zigaboo Modeliste)", originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen der Takte 3–4; beim Tempo proportional skaliert.", sourceBpm: 89.2, timingMs: { kick: { 3: 10, 5: 1, 8: -10, 9: 3, 11: 5, 13: 17, 19: 8, 21: -5, 24: -1, 25: 12, 27: 10, 29: 17 }, snare: { 4: -22, 12: -22, 14: -20, 20: -15, 28: -11, 30: -16 }, closedHat: { 1: 25, 2: -1, 7: 4, 9: -6, 10: -13, 12: -26, 17: 14, 18: 1, 23: 17 } } } }),
  exercise("drum-walk-this-way", "Walk This Way — Groove", "Rock & Pop", [70, 125], "Setze die offene Hat auf eins deutlich und halte Kramers synkopierte Kickfigur trocken.", {
    kick: { accent: [0, 7, 8, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: [2, 4, 6, 8, 10, 12, 14] }, openHat: { accent: [0] },
  }, { playback: { bpm: 108, kit: "Studio" }, source: sources.famous }),
  exercise("drum-teen-spirit", "Smells Like Teen Spirit — Refrain", "Rock & Pop", [75, 130], "Spiele die Refrain-Reduktion mit explosiven offenen Hats und eng zusammenliegenden Kick-Schlägen.", {
    kick: { accent: [0, 3, 8, 10, 11] }, snare: { accent: [4, 7, 12] }, openHat: { accent: quarters16 },
  }, { playback: { bpm: 116, kit: "Studio" }, source: sources.famous }),
  exercise("drum-pop-pocket-offbeats", "Pop-Pocket mit Offbeat-Kick", "Rock & Pop", [65, 135], "Halte die Achtelhand ruhig und platziere die Kick vor drei sowie auf dem Und von drei ohne den Backbeat zu verschieben.", {
    kick: { accent: [0, 6, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { difficulty: "Leicht", playback: { bpm: 96, kit: "Studio" }, learningGoals: ["Grundlagen", "Fußtechnik"], whyInteresting: "Zwei leicht versetzte Kicks machen aus dem Standard-Backbeat eine musikalisch brauchbare Pop-Phrase." }),
  exercise("drum-rock-hat-barks", "Rockgroove mit Hi-Hat-Barks", "Rock & Pop", [65, 135], "Öffne die Hi-Hat kurz auf dem letzten Und und schließe sie exakt mit der Kick auf der nächsten Eins.", {
    kick: { accent: [0, 7, 8, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12] }, openHat: { accent: [14] },
  }, { playback: { bpm: 104, kit: "Studio" }, learningGoals: ["Koordination", "Dynamik"], whyInteresting: "Der kontrollierte Hat-Bark trainiert Timing und Fußkoordination, ohne einen Songnamen vorzutäuschen." }),

  exercise("drum-purdie-shuffle", "Purdie Half-Time Shuffle", "Blues & Shuffle", [60, 145], "Verbinde geshuffelte Hats, Snare-Ghostnotes und den Half-Time-Backbeat ohne Dynamikverlust.", {
    kick: { accent: [0, 5, 11] }, snare: { accent: [6], ghost: [1, 4, 7, 10] }, closedHat: { normal: shuffle12, accent: [0, 3, 6, 9] },
  }, { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], difficulty: "Fortgeschritten", playback: { bpm: 72, kit: "Studio" }, source: sources.rosanna }),
  exercise("drum-fool-rain", "Fool in the Rain Shuffle", "Blues & Shuffle", [55, 105], "Halte Bonhams Half-Time-Snare schwer und lasse die Triolenhand gleichmäßig durchlaufen.", {
    kick: { accent: [0, 2, 5, 11] }, snare: { accent: [6], ghost: [4, 10] }, closedHat: { normal: [0, 3, 5, 6, 8, 9, 11] }, openHat: { accent: [2] },
  }, { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], difficulty: "Fortgeschritten", playback: { bpm: 73, kit: "Studio" }, source: sources.rosanna }),
  exercise("drum-rosanna", "Rosanna Shuffle — Reduktion", "Blues & Shuffle", [55, 100], "Spiele die zweitaktige Porcaro-Reduktion: Shuffle-Hat, Ghostnotes und synkopierte Kick bleiben unabhängig.", {
    kick: { accent: [0, 5, 8, 11, 14, 17, 21, 23] }, snare: { accent: [6, 18], ghost: [1, 4, 7, 10, 13, 16, 19, 22] }, closedHat: { normal: repeated(shuffle12, 2, 12), accent: [0, 3, 6, 9, 12, 15, 18, 21] },
  }, { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 85, kit: "Studio" }, source: sources.rosanna }),
  exercise("drum-texas-shuffle", "Texas Shuffle", "Blues & Shuffle", [65, 175], "Spiele jede erste und dritte Triolennote auf der Hat und setze Backbeat und Kick breit.", {
    kick: { accent: [0, 6] }, snare: { accent: [3, 9] }, closedHat: { normal: shuffle12, accent: [0, 3, 6, 9] },
  }, { subdivision: "Triolen", playback: { bpm: 110, kit: "Studio" } }),

  exercise("drum-one-drop", "Reggae One Drop", "Reggae", [55, 95], "Lass die Eins frei; Kick und Rim treffen gemeinsam auf drei, die Hat bleibt leicht.", {
    kick: { accent: [8] }, rim: { accent: [8] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 76, swing: 54, kit: "Trocken" }, source: sources.reggae }),
  exercise("drum-rockers", "Reggae Rockers", "Reggae", [60, 105], "Setze Kicks auf eins und drei und den Rim-Akzent auf drei; die Hat darf leicht schieben.", {
    kick: { accent: [0, 8] }, rim: { accent: [8] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 82, swing: 54, kit: "Trocken" }, source: sources.reggae }),
  exercise("drum-steppers", "Reggae Steppers", "Reggae", [65, 125], "Treibe den Groove mit vier Kicks, während Rim und Hat den Reggae-Pocket offenlassen.", {
    kick: { accent: quarters16 }, rim: { accent: [8] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 92, swing: 53, kit: "Trocken" }, source: sources.reggae }),
  exercise("drum-bo-diddley", "Bo Diddley Beat", "Funk & Soul", [70, 150], "Orchestriere die 3–2-Clave auf Floor-Tom und Kick und halte den Zweitaktzyklus tanzbar.", {
    kick: { accent: repeated(quarters16, 2, 16) }, lowTom: { accent: [0, 6, 12, 20, 24] }, closedHat: { normal: repeated(eighths16, 2, 16) },
  }, { bars: 2, playback: { bpm: 104, swing: 54, kit: "Studio" }, source: sources.boDiddley }),
  exercise("drum-bossa", "Bossa-Nova Drumset", "Latin & World", [80, 150], "Halte die Kick als leisen Zweierpuls und spiele die Clave weich auf dem Rim.", {
    kick: { normal: [0, 7, 8, 15] }, rim: { accent: [0, 3, 6, 10, 13] }, closedHat: { normal: eighths16 },
  }, { playback: { bpm: 118, kit: "Trocken" } }),
  exercise("drum-samba", "Samba Drumset", "Latin & World", [90, 175], "Koordiniere federnde Kick-Offbeats, Rim-Akzente und durchgehende Sechzehntel-Hat.", {
    kick: { accent: [0, 3, 8, 11] }, rim: { accent: [4, 7, 12, 15] }, closedHat: { normal: sixteenths, accent: quarters16 },
  }, { meter: "2/4", bars: 2, playback: { bpm: 132, swing: 53, kit: "Studio" }, difficulty: "Fortgeschritten" }),

  exercise("drum-five-four", "5/4 Drumgroove 3+2", "Genreübergreifend", [55, 130], "Akzentuiere die Hat-Gruppen 3+2 und halte Kick und Snare über den langen Takt stabil.", {
    kick: { accent: [0, 6, 12] }, snare: { accent: [4, 10, 16] }, closedHat: { normal: seq(0, 20, 2), accent: [0, 12] },
  }, { meter: "5/4", grouping: [3, 2], difficulty: "Fortgeschritten", playback: { bpm: 88, kit: "Studio" } }),
  exercise("drum-seven-eight", "7/8 Drumgroove 2+2+3", "Genreübergreifend", [60, 150], "Führe zwei kurze und eine lange Gruppe auf der Hat; Kick und Snare markieren die Gruppenstarts.", {
    kick: { accent: [0, 4] }, snare: { accent: [2, 8] }, closedHat: { normal: seq(0, 14, 2), accent: [0, 4, 8] },
  }, { meter: "7/8", grouping: [2, 2, 3], difficulty: "Fortgeschritten", playback: { bpm: 110, kit: "Studio" } }),

  exercise("drum-single-stroke", "Single-Stroke Roll", "Genreübergreifend", [50, 200], "Spiele RLRL als gleichmäßige Sechzehntel auf der Snare; jeder Viertelbeginn bleibt entspannt akzentuiert.", {
    snare: { normal: sixteenths, accent: quarters16 },
  }, { difficulty: "Leicht", playback: { bpm: 90, kit: "Trocken" } }),
  exercise("drum-double-stroke", "Double-Stroke Orchestrierung", "Genreübergreifend", [45, 180], "Spiele RRLL als Paare und verteile die Doppelschläge zwischen Snare, High Tom und Floor Tom.", {
    snare: { normal: [0, 1, 4, 5, 8, 9, 12, 13], accent: [0, 4, 8, 12] }, highTom: { normal: [2, 3, 10, 11] }, lowTom: { normal: [6, 7, 14, 15] },
  }, { playback: { bpm: 80, kit: "Trocken" }, learningGoals: ["Technik", "Orchestrierung"] }),
  exercise("drum-paradiddle", "Paradiddle-Orchestrierung", "Genreübergreifend", [45, 160], "Spiele RLRR LRLL; Akzente wandern zwischen Snare und Toms, die Kick markiert die Viertel.", {
    kick: { normal: quarters16 }, snare: { normal: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], accent: [0, 8] }, highTom: { accent: [4, 12] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 78, kit: "Studio" } }),
  exercise("drum-bonham-triplets", "Bonham-Triplets", "Genreübergreifend", [45, 135], "Orchestriere Hand–Fuß–Fuß als gleichmäßige Triolen zwischen Tom und Kick.", {
    highTom: { accent: [0, 3, 6, 9] }, kick: { normal: [1, 2, 4, 5, 7, 8, 10, 11] },
  }, { subdivision: "Triolen", difficulty: "Fortgeschritten", playback: { bpm: 76, kit: "Studio" } }),
  exercise("drum-kick-doubles", "Kick-Doubles", "Genreübergreifend", [45, 150], "Spiele jede Kick-Doppelbewegung kurz und gleich laut, während die Hat den Puls sichert.", {
    kick: { accent: [0, 1, 8, 9] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: quarters16 },
  }, { playback: { bpm: 84, kit: "Studio" } }),
  exercise("drum-blast-beat", "Blast Beat", "Punk & Metal", [90, 220], "Wechsle Kick und Snare in Sechzehnteln und halte die Handbewegung klein.", {
    kick: { accent: seq(0, 16, 2) }, snare: { accent: seq(1, 16, 2) }, closedHat: { normal: eighths16 },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 140, kit: "Trocken" } }),
  exercise("drum-dbeat", "D-Beat", "Punk & Metal", [110, 220], "Halte das klassische Discharge-Kickmuster gegen die versetzte Snare und durchgehende Achtel.", {
    kick: { accent: [0, 3, 5, 8, 11, 13] }, snare: { accent: [2, 6, 10, 14] }, closedHat: { accent: eighths16 },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 165, kit: "Trocken" }, source: sources.dbeat }),
  exercise("drum-tempo-pyramid", "Drumgroove Tempo-Pyramide", "Genreübergreifend", [60, 180], "Halte Rock-Backbeat und Kick sauber, während der Trainer automatisch hoch- und wieder herunterfährt.", {
    kick: { accent: [0, 3, 7, 8, 10, 14] }, snare: { accent: [4, 12], ghost: [11, 15] }, closedHat: { normal: sixteenths, accent: quarters16 },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 60, kit: "Studio", trainer: { mode: "pyramid", step: 5, every: 8, min: 60, max: 180 } } }),
];

function parseMeter(meter) {
  const [beats, denominator] = meter.split("/").map(Number);
  return { beats, denominator };
}

function defaultGrouping(beats, denominator) {
  if (denominator === 8 && beats % 3 === 0) return Array(beats / 3).fill(3);
  return Array(beats).fill(1);
}

function tempoUnitFor(denominator, grouping) {
  if (denominator === 8 && grouping.every((size) => size === 3)) return "dotted-quarter";
  if (denominator === 8) return "eighth";
  return "quarter";
}

function buildTrack(length, specification) {
  const track = Array(length).fill("mute");
  for (const state of HIT_STATES) {
    for (const index of specification[state] || []) {
      if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error(`Invalid drum step ${index} for a ${length}-step pattern`);
      track[index] = state;
    }
  }
  return track;
}

function mergeTracks(drumTracks, length) {
  return Array.from({ length }, (_, index) => {
    const hits = Object.values(drumTracks).map((track) => track[index]);
    return hits.includes("accent") ? "accent" : hits.some((hit) => hit !== "mute") ? "normal" : "mute";
  });
}

function validateOriginalFeel(id, length, feel) {
  if (!feel) return;
  if (!(feel.sourceBpm > 0)) throw new Error(`${id} has invalid originalFeel.sourceBpm`);
  for (const [field, ranges] of [["timingMs", [-250, 250]], ["velocityMultipliers", [.05, 2]]]) {
    for (const [voice, values] of Object.entries(feel[field] || {})) {
      if (!DRUM_VOICES.includes(voice)) throw new Error(`${id} has unknown original-feel voice ${voice}`);
      for (const [rawIndex, value] of Object.entries(values)) {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error(`${id} originalFeel ${voice}[${rawIndex}] outside ${length}-step grid`);
        if (!Number.isFinite(value) || value < ranges[0] || value > ranges[1]) throw new Error(`${id} originalFeel ${field} ${voice}[${rawIndex}] invalid`);
      }
    }
  }
}

const patterns = exercises.map((entry) => {
  if (!PATTERN_CATEGORIES.has(entry.category)) throw new Error(`${entry.id} has unknown category ${entry.category}`);
  const { beats, denominator } = parseMeter(entry.meter);
  const grouping = entry.grouping || defaultGrouping(beats, denominator);
  const length = entry.bars * beats * 4 / denominator * FACTOR[entry.subdivision];
  if (!Number.isInteger(length)) throw new Error(`${entry.id} has a fractional grid`);
  if (grouping.reduce((sum, size) => sum + size, 0) !== beats) throw new Error(`${entry.id} has invalid grouping`);
  validateOriginalFeel(entry.id, length, entry.originalFeel);
  const drumTracks = Object.fromEntries(Object.entries(entry.tracks).map(([voice, specification]) => [voice, buildTrack(length, specification)]));
  return {
    id: entry.id, name: entry.name, category: entry.category, patternType: entry.patternType,
    bpmMin: entry.bpmMin, bpmMax: entry.bpmMax, meter: entry.meter,
    subdivision: entry.subdivision, bars: entry.bars, grouping,
    tempoUnit: tempoUnitFor(denominator, grouping),
    pattern: mergeTracks(drumTracks, length), drumTracks,
    difficulty: entry.difficulty, instruction: entry.instruction, drumOnly: true,
    attribution: entry.attribution, learningGoals: entry.learningGoals, whyInteresting: entry.whyInteresting,
    ...(entry.playback ? { playback: entry.playback } : {}),
    ...(entry.source ? { source: entry.source } : {}),
    ...(entry.originalFeel ? { originalFeel: entry.originalFeel } : {}),
  };
});

const target = new URL("../public/data/patterns-v1.json", import.meta.url);
const output = `${JSON.stringify({ version: 2, updated: "2026-08-23", count: patterns.length, patterns }, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(target, "utf8");
  if (current !== output) throw new Error("patterns-v1.json is out of sync; run npm run patterns:generate");
  console.log(`Verified ${patterns.length} generated drum exercises.`);
} else {
  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(target, output);
  console.log(`Generated ${patterns.length} drum exercises.`);
}
