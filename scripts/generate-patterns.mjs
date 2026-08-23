import { mkdir, readFile, writeFile } from "node:fs/promises";

const FACTOR = { Viertel: 1, Achtel: 2, "16tel": 4, Triolen: 3, Sextolen: 6 };
const HIT_STATES = ["ghost", "normal", "accent"];

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
};

function exercise(id, name, category, bpm, instruction, tracks, options = {}) {
  const learningGoals = options.learningGoals || [
    difficultyGoal(options.difficulty || "Mittel"),
    category.includes("Rudiment") ? "Technik" : category.includes("Ungerade") ? "Ungerade Takte" : category === "Shuffle" ? "Pocket" : category === "Grundlagen" ? "Grundlagen" : "Timing",
  ].filter((value, index, values) => values.indexOf(value) === index);
  return {
    id, name, category, bpmMin: bpm[0], bpmMax: bpm[1],
    meter: options.meter || "4/4", subdivision: options.subdivision || "16tel",
    bars: options.bars || 1, grouping: options.grouping,
    difficulty: options.difficulty || "Mittel", instruction, tracks,
    attribution: options.attribution || (options.source ? "Quellenbasierte Übungsrekonstruktion" : "Genreübung"),
    learningGoals,
    whyInteresting: options.whyInteresting || instruction,
    playback: options.playback, source: options.source, drumOnly: true,
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
  exercise("drum-basic-rock", "Rock-Backbeat", "Grundlagen", [45, 160], "Spiele Kick auf eins und drei, Snare auf zwei und vier und führe die Hi-Hat in Achteln.", {
    kick: { accent: [0, 4] }, snare: { accent: [2, 6] }, closedHat: { normal: seq(0, 8), accent: [0, 2, 4, 6] },
  }, { subdivision: "Achtel", difficulty: "Leicht", playback: { bpm: 92, kit: "Studio" } }),
  exercise("drum-driving-rock", "Driving Rock", "Grundlagen", [70, 190], "Halte die Achtelhand konstant und setze die zusätzliche Kick vor Schlag drei sauber.", {
    kick: { accent: [0, 6, 8] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: quarters16 },
  }, { difficulty: "Leicht", playback: { bpm: 118, kit: "Studio" } }),
  exercise("drum-half-time", "Half-Time Backbeat", "Grundlagen", [50, 130], "Lass die Snare schwer auf drei landen; Kick und Hi-Hat halten den großen Raum zusammen.", {
    kick: { accent: [0, 6, 10] }, snare: { accent: [8] }, closedHat: { normal: eighths16, accent: quarters16 },
  }, { difficulty: "Leicht", playback: { bpm: 82, kit: "Trocken" } }),
  exercise("drum-pop-sixteenths", "Pop-Sechzehntel", "Grundlagen", [55, 125], "Spiele durchgehende Sechzehntel auf der Hi-Hat und halte Backbeat und Kick entspannt.", {
    kick: { accent: [0, 7, 8, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: sixteenths, accent: quarters16 },
  }, { playback: { bpm: 96, kit: "Studio" } }),
  exercise("drum-punk", "Punk Double-Time", "Rock & Metal", [130, 240], "Führe schnelle Achtel auf der Hi-Hat, Snare auf den Offbeats und die Kick ohne Verkrampfung.", {
    kick: { accent: [0, 3, 8, 11] }, snare: { accent: [2, 6, 10, 14] }, closedHat: { accent: eighths16 },
  }, { playback: { bpm: 180, kit: "Trocken" } }),
  exercise("drum-four-floor", "Four on the Floor", "Dance & Hip-Hop", [90, 150], "Setze die Kick auf alle vier Viertel, die Snare auf zwei und vier und öffne die Hat auf den Offbeats.", {
    kick: { accent: quarters16 }, snare: { accent: [4, 12] }, closedHat: { normal: quarters16 }, openHat: { accent: [2, 6, 10, 14] },
  }, { playback: { bpm: 124, kit: "Elektronisch" }, source: sources.fourFloor }),
  exercise("drum-disco", "Disco Open-Hat", "Dance & Hip-Hop", [95, 140], "Halte vier Kicks stabil; die offene Hi-Hat hebt jedes Und an.", {
    kick: { accent: quarters16 }, snare: { accent: [4, 12] }, closedHat: { normal: quarters16 }, openHat: { accent: [2, 6, 10, 14] }, crash: { accent: [0] },
  }, { playback: { bpm: 118, kit: "Studio" }, source: sources.fourFloor }),
  exercise("drum-house", "House mit synkopierter Clap", "Dance & Hip-Hop", [110, 145], "Halte die Kick in Vierteln und ergänze die leisen Clap-Vorzieher erst, wenn die offenen Hats stabil liegen.", {
    kick: { accent: quarters16 }, snare: { accent: [4, 12], ghost: [3, 11] }, closedHat: { normal: [0, 4, 8, 12] }, openHat: { accent: [2, 6, 10, 14] }, rim: { normal: [7, 15] },
  }, { playback: { bpm: 126, kit: "Elektronisch" }, source: sources.fourFloor, learningGoals: ["Pocket", "Koordination"] }),
  exercise("drum-boom-bap", "Boom-Bap Pocket", "Dance & Hip-Hop", [70, 105], "Lege Kick und Snare leicht hinter den Puls und lasse die Ghostnote vor vier klein.", {
    kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12], ghost: [11] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 88, swing: 57, kit: "Trocken" } }),
  exercise("drum-trap", "Trap Half-Time", "Dance & Hip-Hop", [55, 85], "Halte die Snare auf drei schwer und spiele die Hat-Rolls kontrolliert gegen die Kick.", {
    kick: { accent: [0, 7, 10, 14] }, snare: { accent: [8] }, closedHat: { normal: sixteenths, accent: [0, 6, 8, 14] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 72, kit: "Elektronisch" } }),

  exercise("drum-amen", "Amen Break — Übungsrekonstruktion", "Legendäre Breaks", [80, 180], "Spiele den viertaktigen Coleman-Break: Ride-Achtel tragen die versetzten Kicks, Ghostnotes und späten Snares.", {
    kick: { accent: [0, 2, 10, 11, 16, 18, 26, 27, 32, 34, 42, 50, 51, 58] },
    snare: { accent: [4, 12, 20, 28, 36, 46, 52, 62], ghost: [7, 9, 15, 23, 25, 31, 39, 41, 49, 55, 57] },
    ride: { normal: [...repeated(eighths16, 3, 16), ...shifted([0, 2, 4, 6, 8, 12, 14], 48)], accent: [0, 16, 32, 48] },
    openHat: { accent: [58] }, crash: { accent: [0] },
  }, { bars: 4, difficulty: "Fortgeschritten", playback: { bpm: 137, swing: 52, kit: "Studio" }, source: sources.amen }),
  exercise("drum-funky-drummer", "Funky Drummer", "Legendäre Breaks", [70, 120], "Isoliere zuerst Clydes einhändige Sechzehntel-Hat; ergänze danach Kick, Backbeat und sehr leise Ghostnotes.", {
    kick: { accent: [0, 2, 6, 10, 13] }, snare: { accent: [4, 12], ghost: [7, 9, 11, 15] },
    closedHat: { normal: [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15], accent: [0, 4, 8, 12] }, openHat: { accent: [7, 13] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 101, swing: 55, kit: "Trocken" }, source: sources.funky }),
  exercise("drum-impeach", "Impeach the President", "Legendäre Breaks", [70, 110], "Halte den trockenen Boom-Bap-Kern stabil; die versetzten Kicks geben dem Break seinen Zug.", {
    kick: { accent: [0, 7, 8, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 7, 8, 12, 14] }, openHat: { accent: [10] },
  }, { playback: { bpm: 96, kit: "Trocken" }, source: sources.breaks }),
  exercise("drum-think-break", "Think Break — Reduktion", "Legendäre Breaks", [75, 150], "Übe die Drumset-Basis des Jabo-Starks-Breaks; Vocal- und Percussion-Hits sind bewusst weggelassen.", {
    kick: { accent: [0, 3, 9] }, snare: { accent: [4, 12] }, closedHat: { normal: sixteenths.filter((step) => step !== 8), accent: [0, 4, 12] }, openHat: { accent: [8] },
  }, { playback: { bpm: 113, swing: 53, kit: "Trocken" }, source: sources.breaks }),
  exercise("drum-apache", "Apache Break — Reduktion", "Legendäre Breaks", [80, 145], "Übertrage den bongo-geprägten B-Boy-Break auf Kick, Snare und Hats, ohne die Synkopen zu begradigen.", {
    kick: { accent: [0, 3, 6, 8, 11, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16.filter((step) => step !== 10) }, openHat: { accent: [10] },
  }, { playback: { bpm: 115, kit: "Studio" }, source: sources.breaks }),
  exercise("drum-big-beat", "The Big Beat — Reduktion", "Legendäre Breaks", [70, 125], "Lass viel Luft zwischen Kick und geflammter Snare; der Break lebt von Raum statt Hi-Hat-Dichte.", {
    kick: { accent: [0, 3, 6, 8] }, snare: { accent: [4, 12], ghost: [13] }, crash: { accent: [0] },
  }, { playback: { bpm: 108, kit: "Studio" }, source: sources.breaks }),
  exercise("drum-synthetic-substitution", "Synthetic Substitution", "Legendäre Breaks", [70, 125], "Halte Purdies synkopierte Kickfolge gegen die knappen Snare-Akzente und geraden Hats.", {
    kick: { accent: [0, 2, 7, 9, 10, 11, 15] }, snare: { accent: [4, 8] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 98, swing: 53, kit: "Trocken" }, source: sources.breaks }),
  exercise("drum-roachclip", "Ashley’s Roachclip", "Legendäre Breaks", [65, 115], "Spiele den offenen Hat-Akzent nach drei und halte die Kick-Doppelfigur kompakt.", {
    kick: { accent: [0, 2, 6, 8, 9] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 8, 12, 14] }, openHat: { accent: [10] },
  }, { playback: { bpm: 95, kit: "Trocken" }, source: sources.breaks }),
  exercise("drum-cold-sweat", "Cold Sweat — Zweitaktgroove", "Legendäre Breaks", [75, 135], "Verbinde beide Takte des frühen Funkgrooves; Ghostnotes bleiben deutlich unter dem Backbeat.", {
    kick: { accent: [0, 8, 10, 18, 24, 26, 30] }, snare: { accent: [4, 14, 20, 28], ghost: [7, 17, 23, 25] },
    closedHat: { normal: [...[0, 2, 4, 6, 8, 12, 14], ...shifted(eighths16, 16)] }, openHat: { accent: [10] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 120, swing: 54, kit: "Trocken" }, source: sources.famous }),
  exercise("drum-rock-steady", "Rock Steady", "Legendäre Breaks", [65, 125], "Kontrolliere die weiten Hi-Hat-Öffnungen und Purdies leise Snare-Füllstimmen.", {
    kick: { accent: [2, 4, 7, 10, 12] }, snare: { accent: [4, 12], ghost: [1, 5, 7, 9, 13, 15] }, closedHat: { normal: [0, 4, 6, 8, 12, 14] }, openHat: { accent: [2, 10] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 105, swing: 57, kit: "Studio" }, source: sources.famous }),
  exercise("drum-levee", "When the Levee Breaks", "Legendäre Breaks", [45, 95], "Spiele Bonhams schweren Raumgroove: die Kick-Doppelschläge bleiben kurz, die Snare landet breit auf zwei und vier.", {
    kick: { accent: [0, 7, 10, 11], ghost: [1] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: quarters16 },
  }, { playback: { bpm: 72, kit: "Studio" }, source: sources.famous }),
  exercise("drum-superstition", "Superstition — Drumgroove", "Legendäre Grooves", [70, 125], "Halte den federnden Sechzehntelfluss und die Hat-Akzente gegen den geraden Backbeat.", {
    kick: { accent: quarters16 }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 7, 8, 9, 10, 12, 14, 15], accent: quarters16 },
  }, { playback: { bpm: 101, swing: 58, kit: "Trocken" }, source: sources.famous }),
  exercise("drum-cissy-strut", "Cissy Strut — B-Teil", "Legendäre Grooves", [60, 115], "Lerne den viertaktigen New-Orleans-Funk in kleinen Phrasen und halte die Ghostnotes unter den Kicks.", {
    kick: { accent: [0, 3, 5, 9, 11, 12, 14, 16, 19, 23, 25, 27, 28, 30, 32, 36, 39, 41, 43, 44, 46, 48, 52, 55, 57, 59, 60, 62] },
    snare: { accent: [4, 8, 24, 36, 48, 56], ghost: [10, 11, 18, 21, 22, 25, 34, 37, 38, 41, 50, 53, 57] }, closedHat: { normal: [12, 14, 28, 30, 44, 46, 60, 62] },
  }, { bars: 4, difficulty: "Fortgeschritten", playback: { bpm: 90, swing: 55, kit: "Trocken" }, source: sources.famous }),
  exercise("drum-walk-this-way", "Walk This Way — Groove", "Legendäre Grooves", [70, 125], "Setze die offene Hat auf eins deutlich und halte Kramers synkopierte Kickfigur trocken.", {
    kick: { accent: [0, 7, 8, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: [2, 4, 6, 8, 10, 12, 14] }, openHat: { accent: [0] },
  }, { playback: { bpm: 108, kit: "Studio" }, source: sources.famous }),
  exercise("drum-teen-spirit", "Smells Like Teen Spirit — Refrain", "Legendäre Grooves", [75, 130], "Spiele die Refrain-Reduktion mit explosiven offenen Hats und eng zusammenliegenden Kick-Schlägen.", {
    kick: { accent: [0, 3, 8, 10, 11] }, snare: { accent: [4, 7, 12] }, openHat: { accent: quarters16 },
  }, { playback: { bpm: 116, kit: "Studio" }, source: sources.famous }),
  exercise("drum-pop-pocket-offbeats", "Pop-Pocket mit Offbeat-Kick", "Grundlagen", [65, 135], "Halte die Achtelhand ruhig und platziere die Kick vor drei sowie auf dem Und von drei ohne den Backbeat zu verschieben.", {
    kick: { accent: [0, 6, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { difficulty: "Leicht", playback: { bpm: 96, kit: "Studio" }, learningGoals: ["Grundlagen", "Fußtechnik"], whyInteresting: "Zwei leicht versetzte Kicks machen aus dem Standard-Backbeat eine musikalisch brauchbare Pop-Phrase." }),
  exercise("drum-rock-hat-barks", "Rockgroove mit Hi-Hat-Barks", "Rock & Metal", [65, 135], "Öffne die Hi-Hat kurz auf dem letzten Und und schließe sie exakt mit der Kick auf der nächsten Eins.", {
    kick: { accent: [0, 7, 8, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12] }, openHat: { accent: [14] },
  }, { playback: { bpm: 104, kit: "Studio" }, learningGoals: ["Koordination", "Dynamik"], whyInteresting: "Der kontrollierte Hat-Bark trainiert Timing und Fußkoordination, ohne einen Songnamen vorzutäuschen." }),

  exercise("drum-purdie-shuffle", "Purdie Half-Time Shuffle", "Shuffle", [60, 145], "Verbinde geshuffelte Hats, Snare-Ghostnotes und den Half-Time-Backbeat ohne Dynamikverlust.", {
    kick: { accent: [0, 5, 11] }, snare: { accent: [6], ghost: [1, 4, 7, 10] }, closedHat: { normal: shuffle12, accent: [0, 3, 6, 9] },
  }, { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], difficulty: "Fortgeschritten", playback: { bpm: 72, kit: "Studio" }, source: sources.rosanna }),
  exercise("drum-fool-rain", "Fool in the Rain Shuffle", "Shuffle", [55, 105], "Halte Bonhams Half-Time-Snare schwer und lasse die Triolenhand gleichmäßig durchlaufen.", {
    kick: { accent: [0, 2, 5, 11] }, snare: { accent: [6], ghost: [4, 10] }, closedHat: { normal: [0, 3, 5, 6, 8, 9, 11] }, openHat: { accent: [2] },
  }, { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], difficulty: "Fortgeschritten", playback: { bpm: 73, kit: "Studio" }, source: sources.rosanna }),
  exercise("drum-rosanna", "Rosanna Shuffle — Reduktion", "Shuffle", [55, 100], "Spiele die zweitaktige Porcaro-Reduktion: Shuffle-Hat, Ghostnotes und synkopierte Kick bleiben unabhängig.", {
    kick: { accent: [0, 5, 8, 11, 14, 17, 21, 23] }, snare: { accent: [6, 18], ghost: [1, 4, 7, 10, 13, 16, 19, 22] }, closedHat: { normal: repeated(shuffle12, 2, 12), accent: [0, 3, 6, 9, 12, 15, 18, 21] },
  }, { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 85, kit: "Studio" }, source: sources.rosanna }),
  exercise("drum-texas-shuffle", "Texas Shuffle", "Shuffle", [65, 175], "Spiele jede erste und dritte Triolennote auf der Hat und setze Backbeat und Kick breit.", {
    kick: { accent: [0, 6] }, snare: { accent: [3, 9] }, closedHat: { normal: shuffle12, accent: [0, 3, 6, 9] },
  }, { subdivision: "Triolen", playback: { bpm: 110, kit: "Studio" } }),

  exercise("drum-one-drop", "Reggae One Drop", "Reggae & World", [55, 95], "Lass die Eins frei; Kick und Rim treffen gemeinsam auf drei, die Hat bleibt leicht.", {
    kick: { accent: [8] }, rim: { accent: [8] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 76, swing: 54, kit: "Trocken" }, source: sources.reggae }),
  exercise("drum-rockers", "Reggae Rockers", "Reggae & World", [60, 105], "Setze Kicks auf eins und drei und den Rim-Akzent auf drei; die Hat darf leicht schieben.", {
    kick: { accent: [0, 8] }, rim: { accent: [8] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 82, swing: 54, kit: "Trocken" }, source: sources.reggae }),
  exercise("drum-steppers", "Reggae Steppers", "Reggae & World", [65, 125], "Treibe den Groove mit vier Kicks, während Rim und Hat den Reggae-Pocket offenlassen.", {
    kick: { accent: quarters16 }, rim: { accent: [8] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 92, swing: 53, kit: "Trocken" }, source: sources.reggae }),
  exercise("drum-bo-diddley", "Bo Diddley Beat", "Reggae & World", [70, 150], "Orchestriere die 3–2-Clave auf Floor-Tom und Kick und halte den Zweitaktzyklus tanzbar.", {
    kick: { accent: repeated(quarters16, 2, 16) }, lowTom: { accent: [0, 6, 12, 20, 24] }, closedHat: { normal: repeated(eighths16, 2, 16) },
  }, { bars: 2, playback: { bpm: 104, swing: 54, kit: "Studio" }, source: sources.boDiddley }),
  exercise("drum-bossa", "Bossa-Nova Drumset", "Reggae & World", [80, 150], "Halte die Kick als leisen Zweierpuls und spiele die Clave weich auf dem Rim.", {
    kick: { normal: [0, 7, 8, 15] }, rim: { accent: [0, 3, 6, 10, 13] }, closedHat: { normal: eighths16 },
  }, { playback: { bpm: 118, kit: "Trocken" } }),
  exercise("drum-samba", "Samba Drumset", "Reggae & World", [90, 175], "Koordiniere federnde Kick-Offbeats, Rim-Akzente und durchgehende Sechzehntel-Hat.", {
    kick: { accent: [0, 3, 8, 11] }, rim: { accent: [4, 7, 12, 15] }, closedHat: { normal: sixteenths, accent: quarters16 },
  }, { meter: "2/4", bars: 2, playback: { bpm: 132, swing: 53, kit: "Studio" }, difficulty: "Fortgeschritten" }),

  exercise("drum-five-four", "5/4 Drumgroove 3+2", "Ungerade Grooves", [55, 130], "Akzentuiere die Hat-Gruppen 3+2 und halte Kick und Snare über den langen Takt stabil.", {
    kick: { accent: [0, 6, 12] }, snare: { accent: [4, 10, 16] }, closedHat: { normal: seq(0, 20, 2), accent: [0, 12] },
  }, { meter: "5/4", grouping: [3, 2], difficulty: "Fortgeschritten", playback: { bpm: 88, kit: "Studio" } }),
  exercise("drum-seven-eight", "7/8 Drumgroove 2+2+3", "Ungerade Grooves", [60, 150], "Führe zwei kurze und eine lange Gruppe auf der Hat; Kick und Snare markieren die Gruppenstarts.", {
    kick: { accent: [0, 4] }, snare: { accent: [2, 8] }, closedHat: { normal: seq(0, 14, 2), accent: [0, 4, 8] },
  }, { meter: "7/8", grouping: [2, 2, 3], difficulty: "Fortgeschritten", playback: { bpm: 110, kit: "Studio" } }),

  exercise("drum-single-stroke", "Single-Stroke Roll", "Rudiments & Technik", [50, 200], "Spiele RLRL als gleichmäßige Sechzehntel auf der Snare; jeder Viertelbeginn bleibt entspannt akzentuiert.", {
    snare: { normal: sixteenths, accent: quarters16 },
  }, { difficulty: "Leicht", playback: { bpm: 90, kit: "Trocken" } }),
  exercise("drum-double-stroke", "Double-Stroke Orchestrierung", "Rudiments & Technik", [45, 180], "Spiele RRLL als Paare und verteile die Doppelschläge zwischen Snare, High Tom und Floor Tom.", {
    snare: { normal: [0, 1, 4, 5, 8, 9, 12, 13], accent: [0, 4, 8, 12] }, highTom: { normal: [2, 3, 10, 11] }, lowTom: { normal: [6, 7, 14, 15] },
  }, { playback: { bpm: 80, kit: "Trocken" }, learningGoals: ["Technik", "Orchestrierung"] }),
  exercise("drum-paradiddle", "Paradiddle-Orchestrierung", "Rudiments & Technik", [45, 160], "Spiele RLRR LRLL; Akzente wandern zwischen Snare und Toms, die Kick markiert die Viertel.", {
    kick: { normal: quarters16 }, snare: { normal: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], accent: [0, 8] }, highTom: { accent: [4, 12] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 78, kit: "Studio" } }),
  exercise("drum-bonham-triplets", "Bonham-Triplets", "Rudiments & Technik", [45, 135], "Orchestriere Hand–Fuß–Fuß als gleichmäßige Triolen zwischen Tom und Kick.", {
    highTom: { accent: [0, 3, 6, 9] }, kick: { normal: [1, 2, 4, 5, 7, 8, 10, 11] },
  }, { subdivision: "Triolen", difficulty: "Fortgeschritten", playback: { bpm: 76, kit: "Studio" } }),
  exercise("drum-kick-doubles", "Kick-Doubles", "Rudiments & Technik", [45, 150], "Spiele jede Kick-Doppelbewegung kurz und gleich laut, während die Hat den Puls sichert.", {
    kick: { accent: [0, 1, 8, 9] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: quarters16 },
  }, { playback: { bpm: 84, kit: "Studio" } }),
  exercise("drum-blast-beat", "Blast Beat", "Rock & Metal", [90, 220], "Wechsle Kick und Snare in Sechzehnteln und halte die Handbewegung klein.", {
    kick: { accent: seq(0, 16, 2) }, snare: { accent: seq(1, 16, 2) }, closedHat: { normal: eighths16 },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 140, kit: "Trocken" } }),
  exercise("drum-dbeat", "D-Beat", "Rock & Metal", [110, 220], "Halte das klassische Discharge-Kickmuster gegen die versetzte Snare und durchgehende Achtel.", {
    kick: { accent: [0, 3, 5, 8, 11, 13] }, snare: { accent: [2, 6, 10, 14] }, closedHat: { accent: eighths16 },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 165, kit: "Trocken" }, source: sources.dbeat }),
  exercise("drum-tempo-pyramid", "Drumgroove Tempo-Pyramide", "Rudiments & Technik", [60, 180], "Halte Rock-Backbeat und Kick sauber, während der Trainer automatisch hoch- und wieder herunterfährt.", {
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

const patterns = exercises.map((entry) => {
  const { beats, denominator } = parseMeter(entry.meter);
  const grouping = entry.grouping || defaultGrouping(beats, denominator);
  const length = entry.bars * beats * 4 / denominator * FACTOR[entry.subdivision];
  if (!Number.isInteger(length)) throw new Error(`${entry.id} has a fractional grid`);
  if (grouping.reduce((sum, size) => sum + size, 0) !== beats) throw new Error(`${entry.id} has invalid grouping`);
  const drumTracks = Object.fromEntries(Object.entries(entry.tracks).map(([voice, specification]) => [voice, buildTrack(length, specification)]));
  return {
    id: entry.id, name: entry.name, category: entry.category,
    bpmMin: entry.bpmMin, bpmMax: entry.bpmMax, meter: entry.meter,
    subdivision: entry.subdivision, bars: entry.bars, grouping,
    tempoUnit: tempoUnitFor(denominator, grouping),
    pattern: mergeTracks(drumTracks, length), drumTracks,
    difficulty: entry.difficulty, instruction: entry.instruction, drumOnly: true,
    attribution: entry.attribution, learningGoals: entry.learningGoals, whyInteresting: entry.whyInteresting,
    ...(entry.playback ? { playback: entry.playback } : {}),
    ...(entry.source ? { source: entry.source } : {}),
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
