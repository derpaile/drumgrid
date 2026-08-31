import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  REVIEWED_SONG_APP_IDS,
  REVIEWED_SONG_APP_OVERRIDES,
  REVIEWED_SONG_STATUSES,
} from "./reviewed-song-catalog.mjs";

const styleExpansion = JSON.parse(await readFile(new URL("../research/drum-patterns/generated/style-expansion-v1.json", import.meta.url), "utf8"));
const reviewedCatalog = JSON.parse(await readFile(new URL("../research/drum-patterns/generated/reviewed-drum-patterns-v1.json", import.meta.url), "utf8"));

const FACTOR = { Viertel: 1, Achtel: 2, "16tel": 4, Triolen: 3, Sextolen: 6 };
const HIT_STATES = ["ghost", "normal", "accent"];
const DRUM_VOICES = ["kick", "snare", "closedHat", "openHat", "ride", "crash", "rim", "highTom", "lowTom"];
const PATTERN_CATEGORIES = new Set([
  "Rock & Pop", "Progressive & Heavy", "Punk & Metal", "Jazz", "Blues & Shuffle", "Country & Americana", "R&B & Gospel",
  "Funk & Soul", "Hip-Hop", "Old School Hip-Hop", "Trip-Hop & Downtempo", "Dance & Electronic",
  "Jungle & Drum and Bass", "Reggae", "Latin & World", "Genreübergreifend",
]);
const BREAK_IDS = new Set([
  "drum-amen", "drum-apache", "drum-big-beat", "drum-express-yourself", "drum-funky-drummer",
  "drum-hot-pants", "drum-i-got-you", "drum-funky-president", "drum-come-dancing", "drum-impeach", "drum-its-a-new-day", "drum-roachclip",
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
  simonV: { label: "Simon V — Drum & Bass patterns (MIDI)", url: "https://www.simonv.com/tutorials/drum_patterns.php" },
  synthetic: { label: "Goodhertz — Synthetic Substitution", url: "https://goodhertz.com/funklet/synthetic-substitution/" },
  mardi: { label: "Hudson Music — The Breakbeat Bible sampler", url: "https://hudsonmusic.com/wp-content/uploads/2015/03/Breakbeat-Bible-Sampler.pdf" },
  bigBeat: { label: "Drumscore — The Big Beat", url: "https://drumscore.com/sheet-music/browse-by-artist/score/7719-billy-squier-the-big-beat-drum-sheet-music-tab" },
  hotPants: { label: "University of Hull — Rebecoming Analogue", url: "https://hull-repository.worktribe.com/output/4218015" },
  gloryBox: { label: "Bonedo — Glory Box Drum-Workshop", url: "https://www.bonedo.de/artikel/portishead-glory-box-auf-dem-schlagzeug-lernen-mit-noten-audios/" },
  sourTimes: { label: "DrumsTheWord — Sour Times Drum-Transkription", url: "https://www.drumstheword.com/pdf/FamousDrumBeats_eBook.pdf" },
  teardrop: { label: "Sound On Sound — Teardrop-Grundloop und Double-Time-Layer", url: "https://www.soundonsound.com/techniques/how-got-sound-neil-davidge" },
  angel: { label: "Sound On Sound — Neil Davidge über Mezzanine", url: "https://www.soundonsound.com/techniques/how-got-sound-neil-davidge" },
  nyState: { label: "DJ Premier — Entstehung von N.Y. State of Mind", url: "https://djpremierblog.com/2011/02/19/dj-premier-tells-all-the-stories-behind-his-classic-records/" },
  worldYours: { label: "Complex — Pete Rock über The World Is Yours", url: "https://www.complex.com/music/a/daniel-isenberg/interview-pete-rock-classics" },
  shookOnes: { label: "Song Exploder — Havoc über Shook Ones Pt. II", url: "https://songexploder.net/transcripts/mobb-deep-transcript.pdf" },
  infamous: { label: "Complex — The Making of The Infamous", url: "https://www.complex.com/music/a/insanulahmed/the-making-of-mobb-deep-the-infamous" },
  highNoon: { label: "Beatport — High Noon, 101 BPM", url: "https://www.beatport.com/de/track/high-noon/259970" },
  bedroomRockers: { label: "Groove — Kruder & Dorfmeister Zeitgeschichte", url: "https://groove.de/2014/11/10/zeitgeschichten-kruder-und-dorfmeister/2/" },
  shadowBuilding: { label: "Tufts University — DJ Shadows MPC-Breakanalyse", url: "https://dl.tufts.edu/downloads/t722hn50h?filename=bk128p23q.pdf" },
  shadowMidnight: { label: "Sound On Sound — DJ Shadow über Midnight in a Perfect World", url: "https://www.soundonsound.com/techniques/classic-tracks-dj-shadow-midnight-perfect-world" },
  trickyHell: { label: "Sound On Sound — Tricky und Hell Is Round the Corner", url: "https://www.soundonsound.com/techniques/classic-tracks-tricky-black-steel" },
  safeHarm: { label: "The Guardian — Stratus als Safe-From-Harm-Groove", url: "https://www.theguardian.com/music/musicblog/2009/feb/26/sampling-epiphany-massive-attack" },
  morcheebaSea: { label: "MusicRadar — Morcheeba über The Sea", url: "https://www.musicradar.com/news/tech/classic-album-morcheeba-on-big-calm-601271" },
  sixUnderground: { label: "DrumsTheWord — 6 Underground Drum Chart", url: "https://www.drumstheword.com/pdf/SneakerPimps_6Underground.pdf" },
  suckerMcs: { label: "Larry Smith — Sucker M.C.'s und die Oberheim DMX", url: "https://medium.com/@briancoleman/larry-smith-q-a-january-2006-229fd9bd8e91" },
  planetRock: { label: "Sound On Sound — Classic Tracks: Planet Rock", url: "https://www.soundonsound.com/techniques/classic-tracks-afrika-bambaataa-soulsonic-force-planet-rock" },
  paulRevere: { label: "Roland — Paul Revere und der rückwärts aufgenommene 808-Beat", url: "https://articles.roland.com/paul-revere-beastie-boys/" },
  massAppeal: { label: "BeatTips — DJ Premiers Mass-Appeal-Drums", url: "https://beattips.com/check-this-gang-starr-mass-appeal-2/" },
  checkRhime: { label: "Beat Production — Check the Rhime Drum-Groove", url: "https://beatproduction.net/the-beginners-guide-to-making-boom-bap-drum-beats/" },
  cream: { label: "Beat Production — C.R.E.A.M. Drum-Groove", url: "https://beatproduction.net/the-beginners-guide-to-making-boom-bap-drum-beats/" },
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

function styleExercise(id, name, category, bpm, instruction, tracks, options = {}) {
  return exercise(id, name, category, bpm, instruction, tracks, {
    ...options,
    attribution: "Eigenständige Stilübung",
    whyInteresting: options.whyInteresting || `Diese eigenständige Übung isoliert den ${name}-Charakter, ohne einen konkreten Song zu kopieren.`,
  });
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

  exercise("drum-portishead-glory-box", "Portishead — Glory Box", "Trip-Hop & Downtempo", [50, 80], "Spiele die viertaktige Kernreduktion sehr leise: stoische Achtel-Hat, umspielende Kick, wechselnde Snare-Synkopen und ein kurzer Tom-Abschluss in Takt zwei und vier.", {
    kick: { accent: [0, 3, 7, 8, 11, 14, 16, 19, 22, 24, 27, 30, 32, 35, 39, 40, 43, 46, 48, 51, 54, 56, 59, 62] },
    snare: { accent: [4, 12, 20, 28, 36, 44, 52, 60], normal: [22, 27, 54, 59] },
    closedHat: { normal: repeated(eighths16, 4, 16), accent: [0, 16, 32, 48] }, highTom: { normal: [30, 62] }, lowTom: { normal: [31, 63] },
  }, { bars: 4, difficulty: "Fortgeschritten", attribution: "Didaktische Viertakt-Reduktion nach Portishead und Clive Deamer", learningGoals: ["Viertaktform", "Dynamik", "Pocket"], whyInteresting: "Die leise Viertaktform verbindet eine stoische Hip-Hop-Hat mit komplementärer Kick, eigenständigen Snare-Varianten und kurzen Tom-Übergängen.", playback: { bpm: 60, swing: 55, kit: "Vintage" }, source: sources.gloryBox }),
  exercise("drum-portishead-sour-times", "Portishead — Sour Times", "Trip-Hop & Downtempo", [70, 115], "Spiele die dokumentierte Viertaktform ab 0:11: gerade Achtel-Hat, Backbeats, sehr leise Ghostnotes und die offenen Hats in Takt zwei und vier.", {
    kick: { accent: [0, 2, 3, 10, 11, 15, 16, 18, 19, 26, 27, 32, 34, 35, 43, 47, 48, 50, 51, 59] },
    snare: { accent: [4, 12, 20, 28, 36, 44, 52, 60], ghost: [1, 7, 9, 15, 17, 23, 25, 31, 33, 39, 41, 47, 49, 55, 57] },
    closedHat: { normal: repeated(eighths16, 4, 16).filter((step) => ![26, 58].includes(step)), accent: [0, 16, 32, 48] }, openHat: { accent: [26, 58] },
  }, { bars: 4, difficulty: "Fortgeschritten", attribution: "Quellenbasierte Viertakt-Rekonstruktion nach Geoff Barrow und Clive Deamer", learningGoals: ["Ghostnotes", "Viertaktform", "Unabhängigkeit"], whyInteresting: "Die vier Takte variieren Kick, Ghostnotes und offene Hi-Hat innerhalb eines konstanten Backbeats und erzeugen so den charakteristischen schwebenden Sog.", playback: { bpm: 94, swing: 50, kit: "Vintage" }, source: sources.sourTimes }),
  exercise("drum-massive-attack-teardrop", "Massive Attack — Teardrop", "Trip-Hop & Downtempo", [60, 95], "Spiele vier Takte bei 77 BPM: zuerst zweimal den sparsamen Herzschlag-Loop, dann zweimal die später im Song auftauchende Double-Time-Delay-Schicht als leise Sechzehntel-Reduktion.", {
    kick: { ghost: [33, 37, 41, 45, 49, 53, 57, 61], normal: [8, 24, 40, 56], accent: [0, 3, 10, 16, 19, 26, 32, 35, 42, 48, 51, 58] },
    rim: { ghost: [34, 38, 42, 46, 50, 54, 58, 62], normal: [4, 12, 20, 28, 36, 44, 52, 60] },
    closedHat: { ghost: seq(0, 64), normal: [...repeated(quarters16, 2, 16), ...shifted(eighths16, 32), ...shifted(eighths16, 48)], accent: [0, 16, 32, 48] },
  }, { bars: 4, difficulty: "Fortgeschritten", attribution: "Quellenbasierte Viertakt-Übungsreduktion aus Grundloop und dokumentierter Double-Time-Delay-Schicht", learningGoals: ["Minimalismus", "Double Time", "Formaufbau"], whyInteresting: "Der gesampelte Eintakt-Loop bleibt die ruhige Basis; die später zugeschaltete, vom MPC verzögerte Double-Time-Version zeigt, wie Massive Attack Spannung durch Schichtung statt Patternwechsel erzeugt.", playback: { bpm: 77, swing: 52, kit: "Vintage" }, source: sources.teardrop }),
  exercise("drum-massive-attack-angel", "Massive Attack — Angel", "Trip-Hop & Downtempo", [80, 125], "Baue den dunklen Zweitakt-Groove langsam auf: schwerer Backbeat, wenige Kicks, trockene Ghostnotes und ein tiefer Tom-Impuls am Taktende.", {
    kick: { accent: [0, 6, 8, 10, 16, 22, 24, 27, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [11, 19, 27] },
    closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] }, lowTom: { normal: [15, 31] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion nach Massive Attack und Andy Gangadeen", learningGoals: ["Raum", "Dynamik", "Spannungsaufbau"], whyInteresting: "Die Reduktion zeigt, wie ein langsamer, tiefer Live-Groove durch Raum, Ghostnotes und minimale Veränderungen über zwei Takte Spannung aufbaut.", playback: { bpm: 107, swing: 52, kit: "Studio" }, source: sources.angel }),

  exercise("drum-boom-bap", "Boom-Bap Pocket", "Hip-Hop", [70, 105], "Lege Kick und Snare leicht hinter den Puls und lasse die Ghostnote vor vier klein.", {
    kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12], ghost: [11] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 88, swing: 57, kit: "Trocken" } }),
  exercise("drum-trap", "Trap Half-Time", "Hip-Hop", [55, 85], "Halte die Snare auf drei schwer und spiele die Hat-Rolls kontrolliert gegen die Kick.", {
    kick: { accent: [0, 7, 10, 14] }, snare: { accent: [8] }, closedHat: { normal: sixteenths, accent: [0, 6, 8, 14] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 72, kit: "Elektronisch" } }),
  exercise("drum-nas-ny-state", "Nas — N.Y. State of Mind", "Hip-Hop", [70, 105], "Spiele die viertaktige Boom-Bap-Reduktion schwer und leicht geshuffelt; in Takt drei und vier verdichtet die zweite Snare-Farbe den Loop.", {
    kick: { accent: [0, 3, 10, 14, 16, 19, 26, 30, 32, 35, 42, 46, 48, 51, 58, 62] }, snare: { accent: [4, 12, 20, 28, 36, 44, 52, 60] },
    rim: { normal: [36, 44, 52, 60] }, closedHat: { normal: repeated(eighths16, 4, 16), accent: [0, 16, 32, 48] },
  }, { bars: 4, difficulty: "Mittel", attribution: "Didaktische Viertakt-Reduktion nach DJ Premiers Produktion für Nas", learningGoals: ["Boom Bap", "Viertaktform", "Layering"], whyInteresting: "Die schwere, geshuffelte Drum-Basis bleibt zunächst karg und gewinnt in der zweiten Hälfte durch eine zusätzliche Snare-Farbe an Dichte.", playback: { bpm: 84, swing: 58, kit: "Vintage" }, source: sources.nyState }),
  exercise("drum-nas-world-is-yours", "Nas — The World Is Yours", "Hip-Hop", [70, 105], "Halte Pete Rocks federnden Zweitakt-Pocket: trockener Backbeat, synkopierte Kicks, leise Snare-Vorzieher und offene Hat am Taktende.", {
    kick: { accent: [0, 3, 7, 10, 16, 18, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] },
    closedHat: { normal: repeated(eighths16, 2, 16).filter((step) => ![14, 30].includes(step)), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion nach Pete Rocks Produktion für Nas", learningGoals: ["Boom Bap", "Synkopen", "Pocket"], whyInteresting: "Der luftigere Illmatic-Groove kontrastiert trockene Backbeats mit federnden Kick-Synkopen und kleinen Übergängen am Ende jedes Takts.", playback: { bpm: 87, swing: 56, kit: "Vintage" }, source: sources.worldYours }),
  exercise("drum-mobb-deep-shook-ones", "Mobb Deep — Shook Ones Pt. II", "Hip-Hop", [75, 115], "Spiele den bedrohlichen Zweitakt-Pocket trocken: harte Backbeats, wenige synkopierte Kicks und konstant schwere Achtel-Hat.", {
    kick: { accent: [0, 3, 8, 10, 14, 16, 19, 24, 26, 30] }, snare: { accent: [4, 12, 20, 28] }, rim: { ghost: [7, 23] },
    closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion nach Havocs Drumloop für Mobb Deep", learningGoals: ["Boom Bap", "Loop-Pocket", "Raum"], whyInteresting: "Die Wirkung entsteht weniger aus Notendichte als aus einem hart geschnittenen Drumloop, tiefen Kicks und viel Raum für den unheimlichen Sample-Chop.", playback: { bpm: 94, swing: 55, kit: "Vintage" }, source: sources.shookOnes }),
  exercise("drum-mobb-deep-survival", "Mobb Deep — Survival of the Fittest", "Hip-Hop", [75, 115], "Halte die crispere Zweitakt-Variante präzise: Kicks verschieben den Schwerpunkt, Ghostnotes verbinden die Takte und die Hat bleibt unbeirrbar.", {
    kick: { accent: [0, 6, 8, 11, 14, 16, 22, 24, 27, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] },
    closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] }, rim: { normal: [10, 26] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion nach Havoc und Q-Tips Drum-Überarbeitung", learningGoals: ["Boom Bap", "Synkopen", "Layering"], whyInteresting: "Die versetzten Kicks und zusätzliche trockene Percussion verdichten den Loop, ohne seine klare, kompromisslose Backbeat-Achse zu verlieren.", playback: { bpm: 95, swing: 55, kit: "Vintage" }, source: sources.infamous }),
  exercise("drum-kd-high-noon", "Kruder & Dorfmeister — High Noon", "Trip-Hop & Downtempo", [75, 125], "Spiele den gemessenen Eintakt-Loop: Kicks auf eins, 2e, drei und 4e, Backbeats auf zwei und vier, trockene Zwischen-Percussion und leise Sechzehntel-Textur.", {
    kick: { accent: [0, 5, 8, 13] }, snare: { accent: [4, 12] }, rim: { normal: [7, 14] },
    closedHat: { ghost: sixteenths, normal: [1, 6, 9, 10, 14, 15], accent: [3, 11] },
  }, { difficulty: "Mittel", attribution: "Stem-basierte Eintakt-Rekonstruktion nach Kruder & Dorfmeister", learningGoals: ["Downtempo", "Breakbeat", "Mikro-Timing"], whyInteresting: "Der wiederkehrende Eintakt-Loop verschiebt die Kicks auf 2e und 4e gegen klare Backbeats; trockene Zwischen-Percussion und leise Sechzehntel halten ihn in Bewegung.", playback: { bpm: 101, swing: 50, kit: "Vintage" }, source: sources.highNoon, originalFeel: {
    label: "Stem-Messung", note: "Gemessene Abweichungen des wiederkehrenden Drum-Stems; beim Tempo proportional skaliert.", sourceBpm: 100.9,
    timingMs: { kick: { 0: -4, 5: -10, 8: -17, 13: -3 }, snare: { 4: -10, 12: -9 }, rim: { 7: -3, 14: -9 }, closedHat: { 1: -5, 3: -6, 6: 16, 9: -7, 10: -5, 11: -2, 14: -9, 15: -10 } },
  } }),
  exercise("drum-kd-bedroom-rockers", "Kruder & Dorfmeister — Original Bedroom Rockers", "Trip-Hop & Downtempo", [65, 105], "Lass den dubbigen Zweitakt-Loop atmen: tiefe Kick-Synkopen, zurückgenommener Backbeat, offene Hat und einzelne Floor-Tom-Antworten.", {
    kick: { accent: [0, 7, 10, 16, 23, 26], normal: [14, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [11, 27] }, lowTom: { normal: [9, 25] },
    closedHat: { normal: repeated(eighths16, 2, 16).filter((step) => ![14, 30].includes(step)), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Stilreduktion nach Kruder & Dorfmeister", learningGoals: ["Dub", "Downtempo", "Raum"], whyInteresting: "Die sparsame Drum-Architektur zeigt den K&D-Kern aus Hip-Hop-Pocket, Dub-Raum und wenigen, gezielt gesetzten Antworten im zweiten Takt.", playback: { bpm: 86, swing: 54, kit: "Vintage" }, source: sources.bedroomRockers }),

  exercise("drum-dj-shadow-building-steam", "DJ Shadow — Building Steam with a Grain of Salt", "Trip-Hop & Downtempo", [65, 105], "Spiele die unveränderte Zweitakt-Breakbasis bei 82 BPM; halte die Achtel stabil und behandle Ghostnotes und kurze Tom-Antworten wie einzeln geschnittene MPC-Pads.", {
    kick: { accent: [0, 3, 6, 10, 16, 19, 22, 27], normal: [14, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [7, 15, 23, 31] },
    closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] }, highTom: { normal: [13, 29] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "Quellenbasierte Zweitakt-Reduktion von DJ Shadows unveränderter Breakbasis", learningGoals: ["MPC-Phrasierung", "Breakbeat", "Dynamik"], whyInteresting: "Die Quelle beschreibt einen Zweitakt-Break, den Shadow in Achtelfragmente zerlegte und später bis zu Zweiunddreißigsteln neu orchestrierte.", playback: { bpm: 82, swing: 52, kit: "Vintage" }, source: sources.shadowBuilding }),
  exercise("drum-dj-shadow-midnight", "DJ Shadow — Midnight in a Perfect World", "Trip-Hop & Downtempo", [60, 100], "Lass die Zweitaktphrase organisch schweben: kein Takt wiederholt exakt dieselbe Kickfolge, und leise Hat- sowie Snare-Schwänze verbinden die Hauptschläge.", {
    kick: { accent: [0, 6, 10, 16, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [11, 19, 27, 31] },
    closedHat: { ghost: seq(0, 32), normal: [0, 3, 6, 10, 14, 16, 19, 22, 26, 30], accent: [0, 16] }, ride: { normal: [14, 30] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion nach DJ Shadows variierender MPC-Programmierung", learningGoals: ["Dynamik", "MPC-Phrasierung", "Zweitaktform"], whyInteresting: "Shadow beschreibt die Drums als ständig ein- und ausblendende Einzelhits statt starrer Schläge auf jedem Rasterpunkt; die Zweitaktform trainiert genau diesen Fluss.", playback: { bpm: 80, swing: 53, kit: "Vintage" }, source: sources.shadowMidnight }),
  exercise("drum-tricky-hell-corner", "Tricky — Hell Is Round the Corner", "Trip-Hop & Downtempo", [45, 85], "Halte den extrem langsamen Loop schwer und leer: tiefe Kick-Synkopen, stumpfer Backbeat und nur angedeutete Sechzehntel zwischen den Hauptschlägen.", {
    kick: { accent: [0, 7, 10, 14] }, snare: { normal: [4, 12] }, rim: { ghost: [11] }, closedHat: { ghost: sixteenths, normal: [0, 3, 6, 8, 10, 14] },
  }, { difficulty: "Mittel", attribution: "Didaktische Eintakt-Reduktion nach Trickys gesampeltem Bristol-Loop", learningGoals: ["Minimalismus", "Downtempo", "Pocket"], whyInteresting: "Der gemeinsam mit Glory Box aus Ike’s Rap II entwickelte Klangkontext zeigt, wie dieselbe Sample-Idee durch weniger Noten noch bedrohlicher wirken kann.", playback: { bpm: 60, swing: 54, kit: "Vintage" }, source: sources.trickyHell }),
  exercise("drum-massive-attack-safe-harm", "Massive Attack — Safe From Harm", "Trip-Hop & Downtempo", [65, 105], "Spiele den rollenden Zweitakt-Funkloop mit kräftiger Kick, klaren Backbeats und sehr leisen Snare-Antworten; der zweite Takt öffnet die Hat kurz vor seinem Ende.", {
    kick: { accent: [0, 3, 7, 10, 14, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [9, 15, 25, 31] },
    closedHat: { normal: repeated(eighths16, 2, 16).filter((step) => step !== 30), accent: [0, 8, 16, 24] }, openHat: { normal: [30] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "Didaktische Zweitakt-Reduktion des aus Billy Cobhams Stratus gesampelten Grooves", learningGoals: ["Fusion-Funk", "Ghostnotes", "Zweitaktform"], whyInteresting: "Massive Attack isolierte den treibenden Bass-und-Drums-Kern von Stratus; die Übung erhält die rollende Fusion-Bewegung ohne den kompletten Samplemix zu behaupten.", playback: { bpm: 82, swing: 52, kit: "Vintage" }, source: sources.safeHarm }),
  exercise("drum-morcheeba-the-sea", "Morcheeba — The Sea", "Trip-Hop & Downtempo", [55, 95], "Lass den weichen Zweitakt-Loop atmen: tiefe synkopierte Kicks, zurückgenommene Backbeats und eine fast durchgehende, sehr leise Sechzehntel-Textur.", {
    kick: { accent: [0, 7, 10, 16, 23, 26, 30] }, snare: { normal: [4, 12, 20, 28], ghost: [15, 31] },
    closedHat: { ghost: seq(0, 32), normal: repeated(eighths16, 2, 16), accent: [0, 16] }, rim: { normal: [9, 25] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion nach Morcheebas gelooptem Ausgangsbeat", learningGoals: ["Downtempo", "Dynamik", "Loop-Pocket"], whyInteresting: "Paul Godfrey beschreibt The Sea als einen mit den Drums begonnenen Loop; die reduzierte Dynamik verbindet organisches Spiel mit der Wiederholung eines Samplers.", playback: { bpm: 75, swing: 52, kit: "Vintage" }, source: sources.morcheebaSea }),
  exercise("drum-sneaker-pimps-six-underground", "Sneaker Pimps — 6 Underground", "Trip-Hop & Downtempo", [65, 110], "Spiele die viertaktige Verse-Reduktion bei 84 BPM mit durchgehend geshuffelten Sechzehnteln, stabilen Backbeats und kleinen Kickvarianten je Takt.", {
    kick: { accent: [0, 3, 7, 10, 14, 16, 19, 23, 26, 30, 32, 35, 39, 42, 46, 48, 51, 55, 58, 62] },
    snare: { accent: [4, 12, 20, 28, 36, 44, 52, 60], ghost: [15, 31, 47, 63] },
    closedHat: { ghost: repeated(seq(1, 16, 2), 4, 16), normal: repeated(eighths16, 4, 16), accent: [0, 16, 32, 48] },
  }, { bars: 4, difficulty: "Fortgeschritten", attribution: "Quellenbasierte Viertakt-Reduktion der notierten Verse-Figur von Dave Westlake", learningGoals: ["Shuffle", "Viertaktform", "Dynamik"], whyInteresting: "Die vollständige Drum Chart nennt 84 BPM und geshuffelte Sechzehntel durch den ganzen Song; die Viertaktform macht die subtilen Kickvarianten übbar.", playback: { bpm: 84, swing: 58, kit: "Vintage" }, source: sources.sixUnderground }),

  exercise("drum-run-dmc-sucker-mcs", "Run-D.M.C. — Sucker M.C.'s", "Old School Hip-Hop", [80, 140], "Spiele den rohen DMX-Viertaktbeat ohne melodische Ablenkung: harte Kick, trockene Snare und kleine Abweichungen erst am Ende jedes Takts.", {
    kick: { accent: [0, 3, 8, 10, 16, 19, 24, 27, 30, 32, 35, 40, 42, 48, 51, 56, 59, 62] }, snare: { accent: [4, 12, 20, 28, 36, 44, 52, 60] },
    closedHat: { normal: repeated(eighths16, 4, 16), accent: [0, 16, 32, 48] }, rim: { accent: [12, 28, 44, 60] },
  }, { bars: 4, difficulty: "Mittel", attribution: "Quellenbasierte Viertakt-Reduktion von Larry Smiths Oberheim-DMX-Beat", learningGoals: ["Drum Machine", "Viertaktform", "Old School"], whyInteresting: "Larry Smith beschreibt die Aufnahme als radikal schlicht: nur Run-D.M.C. und eine Oberheim DMX; gerade diese Leere macht den Viertaktbeat historisch prägend.", playback: { bpm: 109, swing: 50, kit: "Elektronisch" }, source: sources.suckerMcs }),
  exercise("drum-planet-rock", "Afrika Bambaataa — Planet Rock", "Old School Hip-Hop", [95, 150], "Halte den frühen Electro-Groove maschinell präzise: 808-Kicks, Clap-Backbeats, offene Offbeat-Hats und Rim als Ersatz für die elektronische Zusatzpercussion.", {
    kick: { accent: [0, 3, 8, 11, 16, 19, 24, 27] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { normal: [0, 4, 8, 12, 16, 20, 24, 28] },
    openHat: { accent: [2, 6, 10, 14, 18, 22, 26, 30] }, rim: { normal: [3, 7, 11, 15, 19, 23, 27, 31] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion des Numbers-inspirierten TR-808-Grooves", learningGoals: ["808", "Electro", "Maschinen-Timing"], whyInteresting: "Die Produktion übertrug Kraftwerks Numbers-Idee auf eine TR-808 und machte die elektronische Drum Machine selbst zum Zentrum eines Hip-Hop-Tracks.", playback: { bpm: 127, swing: 50, kit: "808" }, source: sources.planetRock }),
  exercise("drum-beastie-paul-revere", "Beastie Boys — Paul Revere", "Old School Hip-Hop", [70, 120], "Spiele den nackten Zweitakt-808-Groove mit viel Raum; die ungewöhnlichen Kick-Enden erinnern an das auf Band umgedrehte Ausgangspattern.", {
    kick: { accent: [0, 7, 10, 15, 16, 23, 26, 31] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { normal: [2, 6, 10, 14, 18, 22, 26, 30] }, rim: { ghost: [3, 11, 19, 27] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion des rückwärts auf Band aufgenommenen TR-808-Grooves", learningGoals: ["808", "Raum", "Reverse-Gefühl"], whyInteresting: "MCA ließ Mike Ds 808-Pattern auf Band aufnehmen, umdrehen und zurücküberspielen; die Reduktion trainiert dessen minimalen, gleitenden Puls.", playback: { bpm: 92, swing: 50, kit: "808" }, source: sources.paulRevere }),
  exercise("drum-gang-starr-mass-appeal", "Gang Starr — Mass Appeal", "Old School Hip-Hop", [75, 120], "Vermeide die Kick auf dem Loopanfang: starte ihre Bewegung auf den Unds von zwei und drei, während Snare und geshuffelte Hat den Boden halten.", {
    kick: { accent: [6, 10, 15, 22, 26, 31] }, snare: { accent: [4, 12, 20, 28] },
    closedHat: { normal: repeated(eighths16, 2, 16).filter((step) => ![14, 30].includes(step)), accent: [0, 8, 16, 24] }, rim: { ghost: [7, 23] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Quellenbasierte Zweitakt-Reduktion nach DJ Premiers synkopiertem Kickkonzept", learningGoals: ["Boom Bap", "Synkopen", "Loop-Pocket"], whyInteresting: "BeatTips hebt hervor, dass am Loopanfang keine dominante Kick liegt und die Kick zusammen mit der geshuffelten Hat das konstante Tempo steuert.", playback: { bpm: 96, swing: 57, kit: "Vintage" }, source: sources.massAppeal }),
  exercise("drum-atcq-check-rhime", "A Tribe Called Quest — Check the Rhime", "Old School Hip-Hop", [75, 120], "Halte Kick auf eins und drei sowie Snare auf zwei und vier stabil; Rim-Schläge vertreten die verzahnten Conga- und Shaker-Antworten.", {
    kick: { accent: [0, 8, 16, 24], normal: [7, 23] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] },
    rim: { normal: [3, 6, 11, 14, 19, 22, 27, 30] },
  }, { bars: 2, difficulty: "Mittel", attribution: "Didaktische Zweitakt-Reduktion nach Q-Tips jazzigem Percussion-Groove", learningGoals: ["Boom Bap", "Percussion", "Pocket"], whyInteresting: "Der dokumentierte Kern ist bewusst einfach, gewinnt aber durch Congas und Shaker seine Textur; die Rim-Spur macht diese zweite rhythmische Ebene spielbar.", playback: { bpm: 96, swing: 55, kit: "Vintage" }, source: sources.checkRhime }),
  exercise("drum-wutang-cream", "Wu-Tang Clan — C.R.E.A.M.", "Old School Hip-Hop", [65, 110], "Spiele den schweren Zweitakt-Loop sparsam: Kick auf eins und drei, raumvolle Backbeats und ein leises Ride-Achtelbett hinter dem Piano-Sample.", {
    kick: { accent: [0, 8, 16, 24, 30] }, snare: { accent: [4, 12, 20, 28] }, ride: { ghost: repeated(eighths16, 2, 16), normal: [0, 8, 16, 24] }, rim: { ghost: [15, 31] },
  }, { bars: 2, difficulty: "Leicht", attribution: "Didaktische Zweitakt-Reduktion nach RZAs geräumigem C.R.E.A.M.-Groove", learningGoals: ["Boom Bap", "Raum", "Dynamik"], whyInteresting: "Die Quelle beschreibt tiefe Kicks auf eins und drei, Backbeats und leise Ride-Achtel; die Übung zeigt, wie wenig Noten ein monumentaler Loop benötigt.", playback: { bpm: 90, swing: 52, kit: "Vintage" }, source: sources.cream }),

  exercise("drum-i-got-you", "I Got You — Zweitakt-Break", "Funk & Soul", [95, 180], "Spiele den frei verfügbaren Zweitakt-MIDI-Break: klare Backbeats, wechselnde Kick-Antworten und kurze Beckenakzente auf den Achtel-Offbeats.", {
    kick: { accent: [0, 10, 18, 22, 26, 30] }, snare: { accent: [4, 12, 20, 28] },
    closedHat: { normal: [0, 4, 6, 8, 12, 14, 16, 20, 22, 24, 28, 30] }, crash: { accent: [2, 10, 18, 26] },
  }, { bars: 2, difficulty: "Mittel", attribution: "MIDI-basierte Zweitakt-Rekonstruktion", learningGoals: ["Funk", "Zweitaktform", "Beckenakzente"], whyInteresting: "Der geradlinige Backbeat wird im zweiten Takt durch zusätzliche Kicks verdichtet, während die Beckenakzente die Phrase offenhalten.", playback: { bpm: 145, swing: 50, kit: "Trocken" }, source: sources.nativeBreaks, originalFeel: {
    label: "MIDI-Dynamik", note: "Dynamik der kostenlosen Native-Instruments-MIDI-Rekonstruktion.", sourceBpm: 145,
    velocityMultipliers: { closedHat: { 0: 1, 4: 1, 6: .76, 8: 1, 12: 1, 14: .76, 16: 1, 20: 1, 22: .76, 24: 1, 28: 1, 30: .76 } },
  } }),
  exercise("drum-funky-president", "Funky President — Zweitakt-Break", "Funk & Soul", [70, 135], "Halte die Achtel-Hat stabil und platziere die synkopierten Kicks bewusst spät; die leisen Öffnungen am Taktende bleiben klein.", {
    kick: { accent: [0, 3, 7, 10, 16, 19, 23, 26], normal: [9, 25] }, snare: { accent: [4, 12, 20, 28] },
    closedHat: { normal: [0, 2, 6, 8, 12, 14, 18, 22, 24, 28, 30], accent: [10, 16, 26] }, openHat: { ghost: [15, 31] }, rim: { normal: [4, 20] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Zweitakt-Rekonstruktion", learningGoals: ["Mikro-Timing", "Kick-Synkopen", "Dynamik"], whyInteresting: "Mehrere Kicks liegen hörbar hinter dem Raster; genau diese kleinen Verzögerungen geben der wiederholten Zweitaktphrase ihr Gewicht.", playback: { bpm: 105, swing: 50, kit: "Trocken" }, source: sources.nativeBreaks, originalFeel: {
    label: "MIDI-Rekonstruktion", note: "Timing und Dynamik der kostenlosen Native-Instruments-MIDI-Rekonstruktion.", sourceBpm: 105,
    timingMs: { kick: { 3: 43, 7: 39, 9: 33, 19: 43, 23: 39, 25: 33 }, openHat: { 15: 48, 31: 39 } },
    velocityMultipliers: { kick: { 0: .91, 3: .91, 7: .91, 9: .72, 10: .91, 16: 1, 19: .91, 23: .91, 25: .72, 26: .91 }, closedHat: { 0: .82, 2: .82, 6: .82, 8: .82, 10: 1, 12: .82, 14: .82, 16: .91, 18: .82, 22: .82, 24: .82, 26: 1, 28: .82, 30: .82 } },
  } }),
  exercise("drum-come-dancing", "Come Dancing — Zweitakt-Break", "Funk & Soul", [65, 125], "Spiele den rollenden Zweitakt-Break mit Ride-Achteln, kräftigen Kick-Antworten und einer Snare-Linie aus Backbeats und leisen Zwischenstimmen.", {
    kick: { accent: [0, 7, 8, 15, 16, 18, 21, 23, 24, 31] },
    snare: { ghost: [1, 6, 9, 14, 29], normal: [2, 5, 10, 13, 17, 21], accent: [4, 12, 20, 25, 28, 30] },
    ride: { normal: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], ghost: [7] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Zweitakt-Rekonstruktion", learningGoals: ["Ghostnotes", "Mikro-Timing", "Zweitaktform"], whyInteresting: "Die dichte Snare-Linie wechselt Haupt- und Füllstimmen, während späte Kicks den ansonsten stabilen Ride-Puls elastisch machen.", playback: { bpm: 97, swing: 50, kit: "Studio" }, source: sources.nativeBreaks, originalFeel: {
    label: "MIDI-Rekonstruktion", note: "Timing und Dynamik der kostenlosen Native-Instruments-MIDI-Rekonstruktion.", sourceBpm: 97,
    timingMs: { kick: { 7: 52, 8: 26, 15: 52, 16: 26, 21: 52, 23: 52, 24: 26, 31: 52 }, ride: { 7: 26 }, snare: { 1: 45, 2: 14, 4: 14, 5: 45, 6: 14, 9: 45, 10: 14, 12: 14, 13: 45, 14: 14, 17: 45, 20: 14, 21: 45, 25: 45, 28: 14, 29: 45, 30: 14 } },
    velocityMultipliers: { snare: { 1: .46, 2: .75, 4: 1, 5: .6, 6: .47, 9: .4, 10: .75, 12: 1, 13: .6, 14: .46, 17: .6, 20: 1, 21: .6, 25: 1, 28: 1, 29: .46, 30: .85 } },
  } }),

  exercise("drum-simonv-basic", "Simon V — DnB Basic", "Jungle & Drum and Bass", [115, 210], "Halte die Achtelpulse auf Ride und Hat, setze die Snare versetzt zur Kick und behandle das Ride als Ersatz für die Tamburinspur der Vorlage.", {
    kick: { accent: [0, 6, 16, 22] }, snare: { accent: [4, 10, 20, 26], ghost: [13, 29] },
    closedHat: { accent: [2, 6, 10, 12, 14, 18, 22, 26, 28, 30] }, ride: { normal: seq(0, 32, 2) }, crash: { accent: [16] },
  }, { bars: 2, difficulty: "Mittel", attribution: "MIDI-basierte DnB-Grundübung nach Simon V", learningGoals: ["DnB", "Zweitaktform", "Ghostnotes"], whyInteresting: "Der frühe DnB-Grundbeat verzahnt zwei Snarepositionen pro Takt mit wenigen Kicks und einer konstanten Tamburin-Ersatzspur.", playback: { bpm: 175, swing: 50, kit: "Elektronisch" }, source: sources.simonV, originalFeel: { label: "MIDI-Feel", note: "Kleine Snare-Abweichungen aus Simon Vs MIDI-Datei.", sourceBpm: 175, timingMs: { snare: { 13: 9, 29: 9 } } } }),
  exercise("drum-simonv-two-step", "Simon V — 2-Step", "Jungle & Drum and Bass", [120, 220], "Spiele die Viertaktphrase mit leisem Sechzehntel-Ride, stabilen Backbeats und den beiden Beckenvarianten erst nach sicherer Kick-Snare-Koordination.", {
    kick: { accent: [0, 10, 16, 26, 32, 42, 48, 58] }, snare: { accent: [4, 12, 20, 28, 36, 44, 52, 60], ghost: [7, 23, 25, 39, 55, 57] },
    closedHat: { accent: [2, 6, 8, 14, 18, 22, 24, 30, 34, 38, 40, 46, 50, 54, 56, 62] },
    ride: { normal: seq(0, 64, 2), ghost: seq(1, 64, 2) }, crash: { normal: [52], accent: [58] },
  }, { bars: 4, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Viertakt-Rekonstruktion nach Simon V", learningGoals: ["DnB", "Viertaktform", "Dynamik"], whyInteresting: "Die ersten drei Takte etablieren das Zweischritt-Raster; erst der vierte Takt öffnet die Phrase mit zusätzlichen Beckenfarben.", playback: { bpm: 175, swing: 50, kit: "Elektronisch" }, source: sources.simonV, originalFeel: { label: "MIDI-Feel", note: "Leise Sechzehntel und Ghostnotes liegen minimal spät.", sourceBpm: 175, timingMs: { ride: Object.fromEntries(seq(1, 64, 2).map((step) => [step, 9])), snare: { 7: 9, 23: 9, 25: 9, 39: 9, 55: 9, 57: 9 } } } }),
  exercise("drum-simonv-swing", "Simon V — Swing Groove", "Jungle & Drum and Bass", [115, 205], "Lass jeden zweiten Achtelimpuls leicht spät liegen; Kick, Backbeat und Ghostnotes müssen gegen diesen kleinen Versatz stabil bleiben.", {
    kick: { accent: [0, 6, 16, 22] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 14, 30] },
    closedHat: { accent: [0, 2, 6, 8, 16, 18, 22, 24], normal: [4, 10, 12, 14, 20, 26, 28, 30] }, ride: { normal: seq(0, 32, 2) }, crash: { accent: [26] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Zweitakt-Rekonstruktion nach Simon V", learningGoals: ["Swing", "Mikro-Timing", "DnB"], whyInteresting: "Der kleine, regelmäßig wiederkehrende Achtelversatz erzeugt Bewegung, ohne den schnellen Grundpuls in ein grobes Shuffle zu verwandeln.", playback: { bpm: 175, swing: 50, kit: "Elektronisch" }, source: sources.simonV, originalFeel: { label: "MIDI-Swing", note: "Die verzögerten Achtel stammen direkt aus Simon Vs MIDI-Datei.", sourceBpm: 175, timingMs: { kick: { 6: 12, 22: 12 }, snare: { 6: 12, 14: 12, 30: 12 }, closedHat: Object.fromEntries([2, 6, 10, 14, 18, 22, 26, 30].map((step) => [step, 12])), ride: Object.fromEntries([2, 6, 10, 14, 18, 22, 26, 30].map((step) => [step, 12])) } } }),
  exercise("drum-simonv-cosmic-tree", "4hero — Cosmic Tree", "Jungle & Drum and Bass", [120, 220], "Spiele die zweittaktige MIDI-Reduktion: erst der klare Breakkern, dann die lange leise Snare-Kette im zweiten Takt.", {
    kick: { accent: [0, 6, 16, 19, 22] }, snare: { accent: [4, 10, 20, 26], ghost: [13, 15, 17, 19, 23, 25, 27, 29, 31] },
    closedHat: { accent: [0, 4, 6, 10, 12, 16, 30], normal: [14, 18, 22, 24, 28] }, crash: { accent: [20] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Zweitakt-Rekonstruktion nach Simon V", learningGoals: ["Ghostnotes", "Breakbeat", "Dynamik"], whyInteresting: "Der zweite Takt kippt von einem klaren Breakkern in eine lange, dynamisch abgestufte Snare-Kette und trainiert feine Kontrolle.", playback: { bpm: 175, swing: 50, kit: "Elektronisch" }, source: sources.simonV, originalFeel: { label: "MIDI-Feel", note: "Ghostnotes und eine Kick liegen leicht hinter dem Raster.", sourceBpm: 175, timingMs: { kick: { 19: 9 }, snare: { 13: 9, 15: 9, 17: 9, 19: 9, 23: 9, 25: 9, 27: 9, 29: 9, 31: 9 } } } }),
  exercise("drum-simonv-quadrant-six", "Dom & Optical — Quadrant 6", "Jungle & Drum and Bass", [120, 220], "Halte den harten Zweitaktkern trocken; die Beckenstöße im zweiten Takt ersetzen zusätzliche elektronische Klangschichten.", {
    kick: { accent: [0, 6, 12, 16, 22, 28] }, snare: { accent: [4, 10, 20, 26], ghost: [13, 15] },
    closedHat: { accent: [0, 4, 10, 16, 20, 22, 26], normal: [2, 12, 14, 18, 24, 28, 30] }, crash: { accent: [16, 22, 28], normal: [20, 26] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Zweitakt-Rekonstruktion nach Simon V", learningGoals: ["Techstep", "Synkopen", "Zweitaktform"], whyInteresting: "Die Beckenfolge des zweiten Takts verschiebt den Schwerpunkt über einem sehr festen Kick-Snare-Gerüst und erzeugt technische Härte.", playback: { bpm: 175, swing: 50, kit: "Elektronisch" }, source: sources.simonV, originalFeel: { label: "MIDI-Feel", note: "Zwei leise Snare-Schläge liegen minimal spät.", sourceBpm: 175, timingMs: { snare: { 13: 6, 15: 6 } } } }),
  exercise("drum-simonv-leafy-lane", "Kirsty Hawkshaw — Leafy Lane (Matrix Remix)", "Jungle & Drum and Bass", [120, 220], "Verbinde die durchgehenden Hat-Achtel mit den leisen Zwischenimpulsen; die Snare wandert über beide Takte.", {
    kick: { accent: [0, 10, 20, 26] }, snare: { accent: [6, 12, 16, 22, 28], ghost: [23, 25] },
    closedHat: { accent: seq(0, 32, 2), ghost: [3, 5, 9, 11, 15, 19, 21, 25, 27, 31] }, crash: { accent: [0] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Zweitakt-Rekonstruktion nach Simon V", learningGoals: ["DnB", "Unabhängigkeit", "Dynamik"], whyInteresting: "Die Snarepositionen wechseln über die Taktgrenze, während eine zweistufige Hat-Dynamik den schnellen Puls durchgehend zusammenhält.", playback: { bpm: 175, swing: 50, kit: "Elektronisch" }, source: sources.simonV, originalFeel: { label: "MIDI-Feel", note: "Leise Hat- und Snare-Zwischenimpulse liegen leicht spät.", sourceBpm: 175, timingMs: { closedHat: Object.fromEntries([3, 5, 9, 11, 15, 19, 21, 25, 27, 31].map((step) => [step, 9])), snare: { 23: 9, 25: 9 } } } }),
  exercise("drum-simonv-datalife", "Matrix — Datalife", "Jungle & Drum and Bass", [120, 220], "Spiele die achttaktige Form in Abschnitten: drei verwandte Zweitaktgruppen, dann den geraden Hat-Fill im letzten Takt.", {
    kick: { accent: [0, 10, 20, 26, 32, 42, 52, 58, 64, 74, 84, 90, 96, 106, 112, 118, 124, 125], normal: [14, 25, 46, 57, 78, 89, 110] },
    snare: { accent: [6, 12, 16, 22, 28, 38, 44, 48, 54, 60, 70, 76, 80, 86, 92, 102, 108, 116, 122], ghost: [15, 21, 27, 47, 53, 59, 79, 85, 91, 111] },
    ride: { accent: [...seq(0, 30, 2), ...seq(32, 62, 2), ...seq(64, 94, 2), ...seq(96, 112, 2)], normal: [30, 62, 94] },
    closedHat: { normal: [2, 34, 66, 98], ghost: [4, 36, 68, 100], accent: [112, 114, 116, 118, 120, 122, 124, 125, 126, 127] },
    crash: { accent: [30, 48, 54, 60, 94], normal: [52, 58] },
  }, { bars: 8, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Achttakt-Rekonstruktion nach Simon V", learningGoals: ["Achttaktform", "Breakbeat", "Fill"], whyInteresting: "Die lange Form wiederholt keinen bloßen Eintaktloop: Beckenfarben, Ghostnotes und ein abschließender gerader Hat-Fill entwickeln die Phrase.", playback: { bpm: 175, swing: 50, kit: "Elektronisch" }, source: sources.simonV, originalFeel: { label: "MIDI-Feel", note: "Leise Zwischenstimmen und der Schlussfill behalten ihre kleinen MIDI-Abweichungen.", sourceBpm: 175, timingMs: { kick: { 25: 6, 57: 6, 89: 6, 125: 6 }, snare: { 15: 6, 21: 6, 27: 6, 47: 6, 53: 6, 59: 6, 79: 6, 85: 6, 91: 6, 111: 6 }, closedHat: { 125: 6, 127: 6 } } } }),
  exercise("drum-simonv-moving-808s", "Optical — Moving 808s", "Jungle & Drum and Bass", [120, 220], "Halte die wechselnden Ride-Stärken über der sparsamen Kickfolge; der zweite Takt endet mit einer leisen Snare-Antwort.", {
    kick: { accent: [0, 10, 16, 24], normal: [26] }, snare: { accent: [4, 14, 20, 28], ghost: [27] },
    closedHat: { accent: [2, 8, 12, 18, 22, 25], normal: [6, 30] }, ride: { normal: [0, 8, 14, 16, 24, 28], ghost: [2, 6, 12, 18, 22, 30], accent: [4, 10, 20, 26] },
  }, { bars: 2, difficulty: "Fortgeschritten", attribution: "MIDI-basierte Zweitakt-Rekonstruktion nach Simon V", learningGoals: ["Dynamik", "808", "Zweitaktform"], whyInteresting: "Mehrere Ride-Stärken zeichnen eine zweite Rhythmuslinie über den Kicks; die leise Snare-Antwort verbindet beide Ebenen am Schluss.", playback: { bpm: 175, swing: 50, kit: "Elektronisch" }, source: sources.simonV, originalFeel: { label: "MIDI-Feel", note: "Leise Schlussstimmen liegen minimal spät.", sourceBpm: 175, timingMs: { snare: { 27: 6 }, closedHat: { 25: 6 } } } }),

  styleExercise("drum-dusty-eighth-pocket", "Dusty Eighth Pocket", "Hip-Hop", [65, 110], "Halte die Achtel-Hat trocken und lasse die Kickfolge zwischen eins und vier viel Raum.", {
    kick: { accent: [0, 3, 10, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 86, swing: 56, kit: "Vintage" }, learningGoals: ["Boom Bap", "Raum", "Pocket"] }),
  styleExercise("drum-late-backbeat-pocket", "Late Backbeat Pocket", "Hip-Hop", [60, 105], "Spiele wenige Kicks gegen eine schwere Snare und halte die letzte Ghostnote deutlich leiser.", {
    kick: { accent: [0, 6, 11] }, snare: { accent: [4, 12], ghost: [15] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14], accent: [0, 12] },
  }, { playback: { bpm: 82, swing: 58, kit: "Trocken" }, learningGoals: ["Backbeat", "Dynamik", "Pocket"] }),
  styleExercise("drum-sparse-new-york-pocket", "Sparse New-York Pocket", "Hip-Hop", [70, 110], "Lass zwischen den Kicks große Lücken und halte die offenen Achtelpositionen bewusst unbesetzt.", {
    kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 6, 8, 10, 14], accent: [0, 8] },
  }, { playback: { bpm: 91, swing: 55, kit: "Vintage" }, learningGoals: ["Minimalismus", "Boom Bap", "Timing"] }),
  styleExercise("drum-chopped-soul-turn", "Chopped-Soul Turn", "Hip-Hop", [65, 110], "Spiele beide Takte als eine Phrase; der zweite Takt verschiebt Kick und Ghostnote in den Schluss.", {
    kick: { accent: [0, 3, 7, 10, 16, 19, 23, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 27] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] },
  }, { bars: 2, playback: { bpm: 88, swing: 57, kit: "Vintage" }, learningGoals: ["Zweitaktform", "Synkopen", "Pocket"] }),
  styleExercise("drum-vinyl-rim-pocket", "Vinyl Rim Pocket", "Hip-Hop", [60, 105], "Halte Rim und Snare dynamisch getrennt; die trockenen Rim-Antworten dürfen den Backbeat nicht verdoppeln.", {
    kick: { accent: [0, 6, 10, 15] }, snare: { accent: [4, 12] }, rim: { ghost: [3, 7, 11, 14] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { playback: { bpm: 79, swing: 56, kit: "Trocken" }, learningGoals: ["Percussion", "Dynamik", "Boom Bap"] }),
  styleExercise("drum-boom-bap-kick-maze", "Boom-Bap Kick Maze", "Hip-Hop", [65, 115], "Halte den Backbeat konstant, während die Kick mehrere Sechzehntelpositionen umspielt.", {
    kick: { accent: [0, 3, 6, 7, 10, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths16, ghost: [5, 13], accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 94, swing: 55, kit: "Vintage" }, learningGoals: ["Kick-Synkopen", "Koordination", "Boom Bap"] }),
  styleExercise("drum-half-time-headnod", "Half-Time Headnod", "Hip-Hop", [55, 95], "Lass die Snare nur auf drei landen und forme die lange Zweitaktphrase ausschließlich mit Kick und Hat.", {
    kick: { accent: [0, 6, 14, 16, 19, 26, 30] }, snare: { accent: [8, 24] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 16] },
  }, { bars: 2, playback: { bpm: 74, swing: 58, kit: "Trocken" }, learningGoals: ["Half Time", "Zweitaktform", "Raum"] }),
  styleExercise("drum-triplet-headnod", "Triplet Headnod", "Hip-Hop", [55, 105], "Spiele den Hip-Hop-Backbeat auf einem Triolenraster und halte die mittlere Triolennote weich.", {
    kick: { accent: [0, 5, 8] }, snare: { accent: [3, 9], ghost: [7, 11] }, closedHat: { normal: seq(0, 12), accent: [0, 3, 6, 9] },
  }, { subdivision: "Triolen", difficulty: "Fortgeschritten", playback: { bpm: 78, kit: "Trocken" }, learningGoals: ["Triolen", "Pocket", "Koordination"] }),
  styleExercise("drum-swung-sixteenth-pocket", "Swung Sixteenth Pocket", "Hip-Hop", [60, 110], "Halte die ungeraden Hat-Schläge leise und lasse die Kick den Sechzehntelfluss unterbrechen.", {
    kick: { accent: [0, 7, 9, 14] }, snare: { accent: [4, 12], ghost: [11] }, closedHat: { normal: seq(0, 16, 2), ghost: seq(1, 16, 2), accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 89, swing: 60, kit: "Vintage" }, learningGoals: ["Swing", "Dynamik", "Pocket"] }),
  styleExercise("drum-layered-rim-backbeat", "Layered Rim Backbeat", "Hip-Hop", [65, 115], "Setze den Rim nur auf den zweiten Backbeat und halte die zusätzliche Schicht hörbar unter der Snare.", {
    kick: { accent: [0, 3, 8, 11, 14] }, snare: { accent: [4, 12] }, rim: { normal: [12] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14], ghost: [7, 15] },
  }, { playback: { bpm: 93, swing: 54, kit: "Trocken" }, learningGoals: ["Layering", "Dynamik", "Backbeat"] }),
  styleExercise("drum-open-hat-turnaround", "Open-Hat Turnaround", "Hip-Hop", [65, 115], "Öffne die Hat erst am Ende jedes Takts und beantworte sie im zweiten Takt mit einer zusätzlichen Kick.", {
    kick: { accent: [0, 7, 10, 16, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { normal: repeated(eighths16, 2, 16).filter((step) => ![14, 30].includes(step)), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, playback: { bpm: 92, swing: 56, kit: "Vintage" }, learningGoals: ["Zweitaktform", "Offene Hi-Hat", "Pocket"] }),
  styleExercise("drum-double-kick-pickup", "Double-Kick Pickup", "Hip-Hop", [65, 115], "Spiele die beiden kurzen Kick-Doppel als Auftaktbewegung, ohne den Backbeat nach vorne zu ziehen.", {
    kick: { accent: [0, 3, 7, 8, 10, 15, 16, 19, 23, 24, 27, 31] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 16] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 96, swing: 55, kit: "Trocken" }, learningGoals: ["Kick-Doppel", "Zweitaktform", "Koordination"] }),
  styleExercise("drum-three-kick-loop", "Three-Kick Loop", "Hip-Hop", [60, 105], "Halte die drei Kicks je Takt identisch und erzeuge die Variation nur durch Hats und eine Schluss-Ghostnote.", {
    kick: { accent: [0, 6, 11, 16, 22, 27] }, snare: { accent: [4, 12, 20, 28], ghost: [31] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28], accent: [0, 8, 16, 24] }, openHat: { normal: [30] },
  }, { bars: 2, playback: { bpm: 84, swing: 57, kit: "Vintage" }, learningGoals: ["Loop-Pocket", "Dynamik", "Zweitaktform"] }),
  styleExercise("drum-broken-backbeat", "Broken Backbeat", "Hip-Hop", [65, 115], "Verschiebe den letzten Backbeat auf das letzte Sechzehntel und halte die vorausgehende Ghostnote sehr leise.", {
    kick: { accent: [0, 3, 8, 10, 14] }, snare: { accent: [4, 15], ghost: [12] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 91, swing: 54, kit: "Trocken" }, learningGoals: ["Backbeat", "Verschiebung", "Timing"] }),
  styleExercise("drum-808-boom-bap", "808 Boom-Bap", "Old School Hip-Hop", [70, 125], "Kombiniere eine lange 808-Kick mit trockenem Backbeat und sparsamen offenen Hats.", {
    kick: { accent: [0, 3, 8, 11, 15] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 4, 8, 12] }, openHat: { normal: [6, 14] }, rim: { ghost: [2, 10] },
  }, { playback: { bpm: 98, swing: 52, kit: "808" }, learningGoals: ["808", "Old School", "Raum"] }),
  styleExercise("drum-lofi-ghost-grid", "Lo-Fi Ghost Grid", "Hip-Hop", [55, 100], "Lass die leisen Snare-Sechzehntel wie Rauschen unter den beiden Haupt-Backbeats liegen.", {
    kick: { accent: [0, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [1, 3, 6, 9, 11, 15] }, closedHat: { normal: eighths16, accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 76, swing: 59, kit: "Vintage" }, learningGoals: ["Ghostnotes", "Dynamik", "Lo-Fi"] }),
  styleExercise("drum-push-pull-pocket", "Push-Pull Pocket", "Hip-Hop", [60, 110], "Spiele die erste Kickgruppe vorwärts und beantworte sie nach dem Backbeat mit einer rückwärts gerichteten Figur.", {
    kick: { accent: [0, 3, 6, 10, 13] }, snare: { accent: [4, 12], ghost: [8, 15] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14], accent: [0, 12] },
  }, { playback: { bpm: 87, swing: 58, kit: "Trocken" }, learningGoals: ["Phrasierung", "Synkopen", "Pocket"] }),
  styleExercise("drum-stumbling-soul-pocket", "Stumbling Soul Pocket", "Hip-Hop", [55, 105], "Akzentuiere ungleichmäßige Hat-Gruppen und halte Kick und Snare trotzdem als ruhigen Orientierungspunkt.", {
    kick: { accent: [0, 7, 9, 15] }, snare: { accent: [4, 12], ghost: [6, 11, 14] }, closedHat: { normal: [0, 1, 3, 4, 6, 8, 9, 11, 12, 14], accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 80, swing: 61, kit: "Vintage" }, learningGoals: ["Asymmetrie", "Dynamik", "Pocket"] }),
  styleExercise("drum-west-coast-bounce", "West-Coast Bounce", "Old School Hip-Hop", [75, 125], "Halte die Kick federnd, öffne die Hat auf dem letzten Und und setze den Rim als helle Gegenstimme.", {
    kick: { accent: [0, 3, 8, 10, 15] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12], accent: [0, 8] }, openHat: { normal: [14] }, rim: { normal: [7, 11] },
  }, { playback: { bpm: 102, swing: 53, kit: "808" }, learningGoals: ["Bounce", "Offene Hi-Hat", "Old School"] }),
  styleExercise("drum-crate-digger-turn", "Crate-Digger Turn", "Hip-Hop", [60, 105], "Halte den ersten Takt schlicht und verdichte nur den Schluss des zweiten Takts mit Kick, Rim und Ghostnote.", {
    kick: { accent: [0, 7, 10, 16, 23, 26, 29, 31] }, snare: { accent: [4, 12, 20, 28], ghost: [27, 30] }, rim: { normal: [15, 31] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 16] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 83, swing: 58, kit: "Vintage" }, learningGoals: ["Form", "Verdichtung", "Boom Bap"] }),

  styleExercise("drum-dnb-two-step-foundation", "DnB Two-Step Foundation", "Jungle & Drum and Bass", [110, 220], "Halte Snare auf zwei und vier, während die Kicks eins und die Mitte des Takts unterschiedlich gewichten.", {
    kick: { accent: [0, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: seq(0, 16, 2), ghost: seq(1, 16, 2), accent: [0, 8] },
  }, { playback: { bpm: 172, swing: 50, kit: "Elektronisch" }, learningGoals: ["DnB", "Grundlagen", "Dynamik"] }),
  styleExercise("drum-dnb-kick-switch", "DnB Kick Switch", "Jungle & Drum and Bass", [120, 220], "Tausche die zweite Kickposition im zweiten Takt und halte Snare sowie Hat unverändert.", {
    kick: { accent: [0, 10, 16, 22, 30] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] },
  }, { bars: 2, playback: { bpm: 174, swing: 50, kit: "Elektronisch" }, learningGoals: ["Zweitaktform", "Kick-Synkopen", "DnB"] }),
  styleExercise("drum-dnb-ghost-roll", "DnB Ghost Roll", "Jungle & Drum and Bass", [115, 210], "Halte die Ghostnotes als leise Sechzehntelkette zwischen den vier Hauptsnares.", {
    kick: { accent: [0, 10, 16, 26] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 7, 14, 15, 22, 23, 30, 31] }, ride: { normal: repeated(eighths16, 2, 16), accent: [0, 16] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 168, swing: 50, kit: "Studio" }, learningGoals: ["Ghostnotes", "Dynamik", "DnB"] }),
  styleExercise("drum-dnb-half-time-drop", "DnB Half-Time Drop", "Jungle & Drum and Bass", [70, 180], "Lass die Snare schwer auf drei landen und setze schnelle Hat-Impulse als Kontrast zum halben Puls.", {
    kick: { accent: [0, 6, 11, 14] }, snare: { accent: [8], ghost: [7, 15] }, closedHat: { normal: seq(0, 16), accent: [0, 4, 8, 12] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 150, swing: 50, kit: "Elektronisch" }, learningGoals: ["Half Time", "Kontrast", "DnB"] }),
  styleExercise("drum-dnb-liquid-ride", "Liquid Ride Flow", "Jungle & Drum and Bass", [110, 210], "Führe weiche Ride-Achtel durch beide Takte und halte Kick sowie Snare luftig.", {
    kick: { accent: [0, 10, 16, 27] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 23] }, ride: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, playback: { bpm: 170, swing: 51, kit: "Studio" }, learningGoals: ["Liquid", "Ride", "Zweitaktform"] }),
  styleExercise("drum-dnb-techstep-space", "Techstep Space", "Jungle & Drum and Bass", [120, 220], "Lass die Mitte des Takts bewusst leer und beantworte den Backbeat mit einer kurzen Rim-Figur.", {
    kick: { accent: [0, 3, 11] }, snare: { accent: [4, 12] }, rim: { normal: [7, 14] }, closedHat: { normal: [0, 2, 6, 8, 10, 14], accent: [0, 8] },
  }, { playback: { bpm: 176, swing: 50, kit: "Elektronisch" }, learningGoals: ["Techstep", "Raum", "Synkopen"] }),
  styleExercise("drum-jungle-cutup-a", "Jungle Cut-Up A", "Jungle & Drum and Bass", [115, 220], "Spiele die Snare-Antworten wie einzelne geschnittene Break-Pads und halte die Ride-Achtel gerade.", {
    kick: { accent: [0, 2, 10, 11] }, snare: { accent: [4, 12], ghost: [7, 9, 15] }, ride: { normal: eighths16, accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 165, swing: 52, kit: "Studio" }, learningGoals: ["Jungle", "Chopping", "Ghostnotes"] }),
  styleExercise("drum-jungle-cutup-b", "Jungle Cut-Up B", "Jungle & Drum and Bass", [115, 220], "Verschiebe den zweiten Backbeat und fange ihn mit zwei leisen Snare-Schlägen wieder ein.", {
    kick: { accent: [0, 6, 10, 14] }, snare: { accent: [4, 13], ghost: [11, 12, 15] }, ride: { normal: [0, 2, 4, 6, 8, 10, 12, 14], accent: [0, 6] }, openHat: { normal: [15] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 167, swing: 51, kit: "Studio" }, learningGoals: ["Jungle", "Verschiebung", "Koordination"] }),
  styleExercise("drum-dnb-two-bar-turnaround", "DnB Two-Bar Turnaround", "Jungle & Drum and Bass", [120, 220], "Bewahre den ersten Takt als Referenz und spiele die Kick-Snare-Kette nur im Schluss des zweiten Takts.", {
    kick: { accent: [0, 10, 16, 26, 29, 31] }, snare: { accent: [4, 12, 20, 28], ghost: [27, 30] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] }, crash: { accent: [16] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 178, swing: 50, kit: "Elektronisch" }, learningGoals: ["Turnaround", "Zweitaktform", "DnB"] }),
  styleExercise("drum-dnb-sixteenth-drive", "DnB Sixteenth Drive", "Jungle & Drum and Bass", [110, 210], "Spiele die Hat-Sechzehntel in zwei Dynamikstufen und halte die wenigen Kicks deutlich größer.", {
    kick: { accent: [0, 10, 15] }, snare: { accent: [4, 12], ghost: [7, 14] }, closedHat: { normal: seq(0, 16, 2).filter((step) => step !== 6), ghost: seq(1, 16, 2), accent: [0, 4, 8, 12] }, openHat: { normal: [6] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 171, swing: 50, kit: "Elektronisch" }, learningGoals: ["Sechzehntel", "Dynamik", "DnB"] }),

  styleExercise("drum-funk-linear-chain", "Linear Funk Chain", "Funk & Soul", [65, 125], "Spiele Kick, Snare und Hat möglichst selten gleichzeitig; jede Stimme setzt die Kette fort.", {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [6, 11, 15] }, closedHat: { normal: [1, 2, 5, 8, 9, 13], accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 98, swing: 54, kit: "Trocken" }, learningGoals: ["Linear", "Koordination", "Funk"] }),
  styleExercise("drum-funk-ghost-matrix", "Funk Ghost Matrix", "Funk & Soul", [60, 120], "Halte sechs Ghostnotes gleichmäßig leise und trenne sie klar von den beiden Backbeats.", {
    kick: { accent: [0, 6, 9, 14] }, snare: { accent: [4, 12], ghost: [2, 3, 7, 10, 11, 15] }, closedHat: { normal: seq(0, 16), accent: [0, 4, 8, 12] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 92, swing: 53, kit: "Trocken" }, learningGoals: ["Ghostnotes", "Dynamik", "Funk"] }),
  styleExercise("drum-funk-open-hat-pocket", "Funk Open-Hat Pocket", "Funk & Soul", [65, 125], "Öffne die Hat kurz auf 2a und 4a; Kick und Snare bleiben währenddessen trocken.", {
    kick: { accent: [0, 3, 8, 10, 14] }, snare: { accent: [4, 12], ghost: [7, 11] }, closedHat: { normal: seq(0, 16).filter((step) => ![7, 15].includes(step)), accent: [0, 4, 8, 12] }, openHat: { accent: [7, 15] },
  }, { difficulty: "Fortgeschritten", playback: { bpm: 101, swing: 52, kit: "Trocken" }, learningGoals: ["Offene Hi-Hat", "Ghostnotes", "Funk"] }),
  styleExercise("drum-funk-snare-displacement", "Funk Snare Displacement", "Funk & Soul", [60, 115], "Lass den ersten Backbeat stehen und verschiebe den zweiten schrittweise über die Zweitaktphrase.", {
    kick: { accent: [0, 6, 10, 16, 22, 27, 30] }, snare: { accent: [4, 13, 20, 29], ghost: [12, 28] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 94, swing: 53, kit: "Trocken" }, learningGoals: ["Verschiebung", "Zweitaktform", "Funk"] }),
  styleExercise("drum-breakbeat-turnaround", "Breakbeat Turnaround", "Funk & Soul", [70, 140], "Halte den ersten Takt stabil und spiele im zweiten Takt einen kurzen Snare-Tom-Abschluss.", {
    kick: { accent: [0, 3, 10, 16, 19, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [23, 27] }, closedHat: { normal: repeated(eighths16, 2, 16), accent: [0, 8, 16, 24] }, highTom: { normal: [29] }, lowTom: { accent: [31] },
  }, { bars: 2, difficulty: "Fortgeschritten", playback: { bpm: 108, swing: 52, kit: "Studio" }, learningGoals: ["Turnaround", "Toms", "Breakbeat"] }),

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

function expansionExercise(pattern) {
  const { beats, denominator } = parseMeter(pattern.meter);
  const expectedLength = pattern.bars * beats * 4 / denominator * FACTOR[pattern.subdivision];
  if (!Number.isInteger(expectedLength) || pattern.pattern.length !== expectedLength) throw new Error(`${pattern.id} has an invalid source grid`);
  const tracks = Object.fromEntries(Object.entries(pattern.drumTracks).map(([voice, track]) => {
    if (!DRUM_VOICES.includes(voice) || track.length !== expectedLength) throw new Error(`${pattern.id} has an invalid ${voice} source track`);
    const specification = Object.fromEntries(HIT_STATES.map((state) => [state, track.flatMap((value, index) => value === state ? [index] : [])]).filter(([, indices]) => indices.length));
    return [voice, specification];
  }));
  if (JSON.stringify(mergeTracks(pattern.drumTracks, expectedLength)) !== JSON.stringify(pattern.pattern)) throw new Error(`${pattern.id} has a stale summary track`);
  const entry = exercise(pattern.id, pattern.name, pattern.category, [pattern.bpmMin, pattern.bpmMax], pattern.instruction, tracks, {
    meter: pattern.meter, subdivision: pattern.subdivision, bars: pattern.bars, grouping: pattern.grouping,
    difficulty: pattern.difficulty, attribution: pattern.attribution, learningGoals: pattern.learningGoals,
    whyInteresting: pattern.whyInteresting, playback: pattern.playback, source: pattern.source, originalFeel: pattern.originalFeel,
  });
  if (entry.patternType !== pattern.patternType) throw new Error(`${pattern.id} has inconsistent patternType ${pattern.patternType}`);
  return entry;
}

if (!Array.isArray(styleExpansion.patterns) || styleExpansion.count !== styleExpansion.patterns.length) throw new Error("Invalid style-expansion catalog");
if (!Array.isArray(reviewedCatalog.patterns) || reviewedCatalog.count !== reviewedCatalog.patterns.length) throw new Error("Invalid reviewed pattern catalog");

const reviewedSongPatterns = reviewedCatalog.patterns.filter((pattern) => REVIEWED_SONG_STATUSES.has(reviewedCatalog.review?.[pattern.id]?.status));
const existingExerciseIds = new Set(exercises.map((entry) => entry.id));
for (const pattern of reviewedSongPatterns) {
  const appId = REVIEWED_SONG_APP_IDS[pattern.id];
  if (!appId) throw new Error(`Reviewed song ${pattern.id} has no app id`);
  if (existingExerciseIds.has(appId)) continue;
  const overrides = REVIEWED_SONG_APP_OVERRIDES[pattern.id];
  if (!overrides) throw new Error(`Reviewed song ${pattern.id} is missing app metadata`);
  exercises.push(expansionExercise({ ...pattern, ...overrides, id: appId, patternType: "Groove" }));
  existingExerciseIds.add(appId);
}

exercises.push(...styleExpansion.patterns.map(expansionExercise));

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
const output = `${JSON.stringify({ version: 2, updated: "2026-08-30", count: patterns.length, patterns }, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(target, "utf8");
  if (current !== output) throw new Error("patterns-v1.json is out of sync; run npm run patterns:generate");
  console.log(`Verified ${patterns.length} generated drum exercises.`);
} else {
  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(target, output);
  console.log(`Generated ${patterns.length} drum exercises.`);
}
