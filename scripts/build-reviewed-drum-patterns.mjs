import { mkdir, readFile, writeFile } from "node:fs/promises";
import { REVIEWED_SONG_APP_IDS } from "./reviewed-song-catalog.mjs";

const root = new URL("../", import.meta.url);
const [grooveFile, breakFile, appFile] = await Promise.all([
  readFile(new URL("research/drum-patterns/original/drumgrooves_deepseek.json", root), "utf8"),
  readFile(new URL("research/drum-patterns/original/breakbeats_deepseek.json", root), "utf8"),
  readFile(new URL("public/data/patterns-v1.json", root), "utf8"),
]);

const grooves = JSON.parse(grooveFile).grooves;
const breaks = JSON.parse(breakFile).grooves;
const appPatterns = new Map(JSON.parse(appFile).patterns.map((pattern) => [pattern.id, pattern]));
const states = ["ghost", "normal", "accent"];
const voices = ["kick", "snare", "closedHat", "openHat", "ride", "crash", "rim", "highTom", "lowTom"];
const factors = { Viertel: 1, Achtel: 2, "16tel": 4, Triolen: 3, Sextolen: 6 };

const excluded = new Map([
  ["amen-break-inspired", "Duplikat: die viertaktige Fassung amen-break ist präziser."],
  ["funky-drummer-inspired", "Duplikat: funky-drummer nutzt das feinere 16tel-Raster."],
  ["purdie-shuffle-original", "Duplikat: half-time-shuffle-purdie bleibt als kanonische Übung."],
  ["when-the-levee-breaks-break", "Duplikat: when-the-levee-breaks bleibt als kanonische Übung."],
]);

const mapped = {
  ...REVIEWED_SONG_APP_IDS,
  "basic-rock": "drum-basic-rock",
  "four-on-the-floor": "drum-four-floor",
  "reggae-one-drop": "drum-one-drop",
  "samba-basic": "drum-samba",
  "bossa-nova": "drum-bossa",
  "bo-diddley-beat": "drum-bo-diddley",
  "seven-eight-rock": "drum-seven-eight",
  "trap-hihat-rolls": "drum-trap",
  "boom-bap": "drum-boom-bap",
};

const source = {
  amen: { label: "International Audio Laboratories Erlangen — Reverse Engineering the Amen Break", url: "https://www.audiolabs-erlangen.de/resources/MIR/2016-IEEE-TASLP-DrumSeparation/AmenBreak" },
  breaks: { label: "MusicRadar — 10 influential drum breaks", url: "https://www.musicradar.com/news/best-drum-breaks-of-all-time" },
  bonham: { label: "Drumeo — John Bonham drum lessons", url: "https://www.drumeo.com/beat/5-john-bonham-drum-licks/" },
  famous: { label: "Drumeo — 14 legendary drum beats", url: "https://www.drumeo.com/beat/learn-14-legendary-drum-beats/" },
  funky: { label: "Roland — Behind the Beat: Funky Drummer", url: "https://articles.roland.com/behind-the-beat-funky-drummer-by-james-brown/" },
  microtiming: { label: "ZGMTH — Microtiming in Early Funk", url: "https://www.gmth.de/zeitschrift/artikel/1224.aspx" },
  academicBreaks: { label: "University of Hull — Rebecoming Analogue", url: "https://hull-repository.worktribe.com/output/4218015" },
  nativeBreaks: { label: "Native Instruments — drum-break recreations and MIDI", url: "https://blog.native-instruments.com/best-drum-breaks/" },
  synthetic: { label: "Goodhertz — Synthetic Substitution", url: "https://goodhertz.com/funklet/synthetic-substitution/" },
  mardi: { label: "Hudson Music — The Breakbeat Bible sampler", url: "https://hudsonmusic.com/wp-content/uploads/2015/03/Breakbeat-Bible-Sampler.pdf" },
  famousPdf: { label: "DrumsTheWord — Famous Drum Beats eBook", url: "https://www.drumstheword.com/digital-media/Downloads/FamousDrumBeats_eBook.pdf" },
  sevenDays: { label: "DRUM! — Vinnie Colaiuta on Seven Days", url: "https://drummagazine.com/lesson-vinnie-colaiuta-on-stings-seven-days/" },
  takeFive: { label: "DRUM! — Joe Morello’s Take Five drum part", url: "https://drummagazine.com/joe-morellos-take-five-drum-part/" },
  bolero: { label: "Rhythm Notes — Afro-Cuban rhythms for drum set", url: "https://rhythmnotes.net/afro-cuban-rhythms-for-drum-set/" },
  bigBeat: { label: "Drumscore — The Big Beat", url: "https://drumscore.com/sheet-music/browse-by-artist/score/7719-billy-squier-the-big-beat-drum-sheet-music-tab" },
};

const manual = {
  "amen-break": { attribution: "Didaktische Rekonstruktion (G. C. Coleman, The Winstons)", instruction: "Spiele eine viertaktige 16tel-Rekonstruktion. Ride-Achtel tragen Kicks, Ghostnotes und die verschobenen Snares; Mikro-Timing und Beckenausklang bleiben rasterbedingt angenähert.", learningGoals: ["Breakbeat", "Ghostnotes", "Viertaktform"], whyInteresting: "Die viertaktige Form mit verschobener Snare im dritten Takt prägte zahlreiche Jungle-, Drum-and-Bass- und Breakbeat-Produktionen.", kind: "reduction", source: source.amen },
  "funky-drummer": { name: "Funky Drummer — Zweitaktausschnitt", bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 2, 10, 13, 16, 18, 26, 29] }, snare: { accent: [4, 12, 20, 28], ghost: [7, 9, 11, 15, 23, 25, 27, 31] }, closedHat: { normal: [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 30, 31], accent: [0, 4, 8, 12, 16, 20, 24, 28] }, openHat: { accent: [5, 7, 13, 21, 29] } }, attribution: "Quellenbasierter Zweitaktausschnitt (Clyde Stubblefield, James Brown)", instruction: "Spiele die ersten zwei Takte des achttaktigen Solos: einhändige Sechzehntel-Hat, Backbeat, Öffnungen und sehr leise Ghostnotes.", learningGoals: ["Ghostnotes", "Dynamik", "Pocket"], whyInteresting: "Die zweitaktige Phrase zeigt Stubblefields fein abgestufte Hi-Hat-, Kick- und Snare-Verzahnung ohne sie auf einen Eintakt-Loop zu verkürzen.", playback: { bpm: 101, swing: 50, kit: "Trocken" }, originalFeel: { label: "MIDI-Rekonstruktion", note: "Timing und Dynamik einer notengetreuen zweitaktigen MIDI-Rekonstruktion.", sourceBpm: 101, timingMs: { kick: { 13: -6, 29: -6 }, snare: { 7: 15, 9: 15, 11: 15, 15: 15, 23: 15, 25: 15, 27: 15, 31: 15 }, closedHat: { 1: 6, 3: 6, 5: 6, 7: 6, 9: 6, 11: 6, 13: 6, 15: 6, 17: 6, 19: 6, 21: 6, 23: 6, 25: 6, 27: 6, 29: 6, 31: 6 }, openHat: { 5: 9, 7: 9, 13: 9, 21: 9, 29: 9 } }, velocityMultipliers: { kick: { 0: .77, 2: 1, 10: .77, 13: .77, 16: .77, 18: .95, 26: .8, 29: .58 } } }, kind: "reconstruction", source: source.funky },
  "reggae-one-drop": { attribution: "Reggae-Stilübung", instruction: "Lass Beat 1 frei; Kick und Rim treffen gemeinsam auf Beat 3, während die Hi-Hat leicht durchläuft.", kind: "style" },
  "rosanna-shuffle-inspired": { attribution: "Didaktische Reduktion nach Jeff Porcaro", kind: "reduction" },
  "fool-in-the-rain-inspired": { attribution: "Didaktische Reduktion nach John Bonham", kind: "reduction", source: source.bonham },
  "when-the-levee-breaks": { subdivision: "16tel", tracks: { kick: { accent: [0, 10, 11], ghost: [1] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14], accent: [0, 4, 8, 12] } }, attribution: "Quellenbasierte Reduktion (John Bonham, Led Zeppelin)", instruction: "Spiele den schweren Raumgroove. Die Ghost-Kick auf 1e simuliert das Bandecho; Bonham spielte dort keinen zweiten Downbeat.", learningGoals: ["Raum", "Klang", "Pocket"], whyInteresting: "Der Groove trennt die gespielte Kickfolge von dem durch Aufnahme und Echo wahrgenommenen Doppelschlag.", playback: { bpm: 72, swing: 50, kit: "Studio" }, kind: "reduction", source: source.famousPdf },
  "bo-diddley-beat": { attribution: "Bo-Diddley-Rhythmus als Drumset-Stilübung", kind: "style" },
  "bossa-nova": { instruction: "Halte die Kick als leisen Zweierpuls und spiele die wiederkehrende Bossa-Rim-Zelle weich; sie wird nicht als afro-kubanische Son-Clave ausgegeben.", learningGoals: ["Rim-Zelle", "Unabhängigkeit", "Dynamik"], whyInteresting: "Die wiederkehrende Rim-Zelle und der leise Bassdrum-Puls üben die für Bossa Nova typische zurückgenommene Drumset-Begleitung.", attribution: "Bossa-Nova-Drumset-Stilübung", kind: "style" },
  "half-time-shuffle-purdie": { attribution: "Didaktische Half-Time-Shuffle-Übung nach Bernard Purdie", learningGoals: ["Shuffle", "Ghostnotes", "Dynamik"], whyInteresting: "Die Verzahnung aus geshuffelter Hand, leisen Snare-Füllschlägen und Half-Time-Backbeat ist eine zentrale Funk-/Rock-Koordinationsübung.", kind: "reduction" },
  "think-break": { name: "Think Break — Takt 23", subdivision: "16tel", tracks: { kick: { accent: [0] }, snare: { accent: [4, 12], ghost: [7, 9, 10] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12] }, openHat: { accent: [14] } }, attribution: "Quellenbasierte Rekonstruktion (John “Jabo” Starks, Lyn Collins)", instruction: "Spiele den dokumentierten Kern aus Takt 23: Kick nur auf eins, Backbeats und drei Ghostnotes; Tamburin und Vocals sind weggelassen.", learningGoals: ["Ghostnotes", "Pocket", "Mikro-Timing"], whyInteresting: "Das Original enthält vier leicht variierte Eintakt-Breaks; diese Fassung bildet den ersten vollständig dokumentierten Break-Takt ab.", playback: { bpm: 114, swing: 50, kit: "Trocken" }, originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen von Takt 23; beim Tempo proportional skaliert.", sourceBpm: 113.2922, timingMs: { snare: { 4: 15, 9: 15, 12: -2 }, openHat: { 14: -1 } } }, kind: "reconstruction", source: source.microtiming },
  "apache-break": { name: "Apache — Takt 7", bars: 1, subdivision: "16tel", tracks: { kick: { accent: [0, 2, 10] }, snare: { accent: [4, 12], ghost: [9, 15] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14] } }, attribution: "Quellenbasierte Drumset-Rekonstruktion (Incredible Bongo Band)", instruction: "Spiele Takt 7 der dokumentierten Break-Passage. Die zusätzliche Bongo-Schicht bleibt außerhalb des Drumset-Rasters.", learningGoals: ["Ghostnotes", "Pocket", "Mikro-Timing"], whyInteresting: "Die Rekonstruktion ersetzt die frühere generische B-Boy-Schablone durch einen konkret vermessenen Takt der Aufnahme.", playback: { bpm: 119, swing: 50, kit: "Studio" }, originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen von Takt 7; beim Tempo proportional skaliert.", sourceBpm: 118.7702, timingMs: { kick: { 10: -11 }, snare: { 4: -4, 9: 14, 12: 4, 15: 30 }, closedHat: { 6: 7, 8: 2, 10: -4, 14: 7 } } }, kind: "reconstruction", source: source.microtiming },
  "impeach-the-president": { name: "Impeach the President — Takt 1", subdivision: "16tel", tracks: { kick: { accent: [0, 7, 8, 10, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 7, 8, 12, 14] }, openHat: { accent: [10] } }, attribution: "Quellenbasierte Rekonstruktion (The Honey Drippers)", instruction: "Spiele den ersten dokumentierten Break-Takt; der Kick auf 2a liegt im Original deutlich spät.", learningGoals: ["Synkopen", "Mikro-Timing", "Pocket"], whyInteresting: "Die 52 ms verspätete Kick auf 2a zeigt, wie stark das Original trotz klarer Sechzehntelposition vom starren Raster abweicht.", playback: { bpm: 94, swing: 50, kit: "Trocken" }, originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen des ersten Break-Takts; beim Tempo proportional skaliert.", sourceBpm: 93.9464, timingMs: { kick: { 7: 52, 8: 12, 14: 4 }, snare: { 4: 16, 12: 19 }, closedHat: { 0: 15, 2: 7, 6: 21, 7: 31, 8: 11, 10: 7, 14: 12 } } }, kind: "reconstruction", source: source.microtiming },
  "synthetic-substitution": { name: "Synthetic Substitution — Zweitaktform", bars: 2, subdivision: "16tel", tracks: { kick: { accent: [2, 7, 10, 11, 16, 18, 23, 26, 27], normal: [0, 9, 15, 25], ghost: [31] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { accent: [0, 2, 6, 8, 14, 18, 22, 24, 30], normal: [4, 10, 12, 16, 20, 26, 28] } }, attribution: "Quellenbasierte Zweitakt-Rekonstruktion (Bernard Purdie, Melvin Bliss)", instruction: "Spiele die dokumentierte zweitaktige Kickfolge gegen vier Backbeats; die Hat-Akzente bilden die notierte Dynamik ab.", learningGoals: ["Unabhängigkeit", "Dynamik", "Pocket"], whyInteresting: "Die vollständige Zweitaktform korrigiert die frühere eintaktige Fassung mit einer fälschlichen Snare auf Beat 3.", playback: { bpm: 93, swing: 50, kit: "Trocken" }, kind: "reconstruction", source: source.synthetic },
  "ashleys-roachclip": { name: "Ashley’s Roachclip — Zweitaktform", bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 3, 6, 9, 10, 13, 16, 19, 22, 25, 26, 29] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] }, closedHat: { normal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31] } }, attribution: "MIDI-basierte Rekonstruktion (Kenneth Scoggins, The Soul Searchers)", instruction: "Spiele die zweitaktige Rekonstruktion; die Sechzehntel und Kicks werden nicht auf ein generisches Achtelpattern reduziert.", learningGoals: ["Dynamik", "Pocket", "Mikro-Timing"], whyInteresting: "Die Zweitaktform erhält die Kickvarianten, Ghostnotes und wechselnden Hi-Hat-Lautstärken der Rekonstruktion.", playback: { bpm: 95, swing: 50, kit: "Trocken" }, originalFeel: { label: "MIDI-Rekonstruktion", note: "Mikro-Timing und Dynamik einer notengetreuen MIDI-Rekonstruktion.", sourceBpm: 95, timingMs: { kick: { 3: -26, 19: -26 }, closedHat: { 1: -16, 3: -16, 5: -16, 7: -16, 9: -16, 11: -16, 13: -16, 15: -16, 17: -16, 19: -16, 21: -16, 23: -16, 25: -16, 27: -16, 29: -16, 31: -16 }, snare: { 15: 16 } } }, kind: "reconstruction", source: source.nativeBreaks },
  "the-big-beat": { attribution: "Didaktische Reduktion (Bobby Chouinard, Billy Squier)", instruction: "Lass viel Raum zwischen Kick und geflammter Snare. Die Fassung ist eine Ein-Takt-Reduktion, keine Volltranskription.", learningGoals: ["Raum", "Flam", "Dynamik"], whyInteresting: "Das reduzierte Pattern trainiert die großen Abstände und den schweren Snare-Klang des von Bobby Chouinard gespielten Breaks.", playback: { bpm: 108, swing: 50, kit: "Studio" }, kind: "reduction", source: source.bigBeat },
  "cissy-strut": { name: "Cissy Strut — Takte 3–4", bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 3, 5, 8, 9, 11, 13, 16, 19, 21, 24, 25, 27, 29] }, snare: { accent: [4, 12, 14, 20, 28, 30] }, closedHat: { normal: [1, 2, 4, 7, 9, 10, 12, 14, 17, 18, 20, 23, 25, 26, 28, 30] } }, attribution: "Quellenbasierte Rekonstruktion (Zigaboo Modeliste, The Meters)", instruction: "Spiele die dokumentierten Takte 3–4 mit der charakteristischen verzahnten Kick-, Snare- und Hi-Hat-Figur.", learningGoals: ["Linearität", "New-Orleans-Funk", "Mikro-Timing"], whyInteresting: "Ein prägendes Beispiel für New-Orleans-Funk: Stimmen greifen ineinander, ohne auf eine generische Backbeat-Schablone reduziert zu werden.", playback: { bpm: 89, swing: 50, kit: "Trocken" }, originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen der Takte 3–4; beim Tempo proportional skaliert.", sourceBpm: 89.2, timingMs: { kick: { 3: 10, 5: 1, 8: -10, 9: 3, 11: 5, 13: 17, 19: 8, 21: -5, 24: -1, 25: 12, 27: 10, 29: 17 }, snare: { 4: -22, 12: -22, 14: -20, 20: -15, 28: -11, 30: -16 }, closedHat: { 1: 25, 2: -1, 7: 4, 9: -6, 10: -13, 12: -26, 17: 14, 18: 1, 23: 17 } } }, kind: "reconstruction", source: source.microtiming },
  "basic-shuffle": { subdivision: "Triolen", tracks: { kick: { accent: [0, 6] }, snare: { accent: [3, 9] }, closedHat: { normal: [0, 2, 3, 5, 6, 8, 9, 11], accent: [0, 3, 6, 9] } }, name: "Basic Shuffle", kind: "style" },
  "two-beat-country": { subdivision: "Viertel", tracks: { kick: { accent: [0, 2] }, snare: { accent: [1, 3] }, closedHat: { normal: [0, 1, 2, 3] } }, kind: "style" },
  "basic-swing": { subdivision: "Triolen", tracks: { kick: { ghost: [0, 3, 6, 9] }, ride: { normal: [0, 2, 3, 5, 6, 8, 9, 11], accent: [0, 6] } }, instruction: "Spiele das Jazz-Ride-Pattern auf erster und dritter Triolennote und feather die Kick sehr leise in Vierteln. Die Fuß-Hi-Hat auf 2 und 4 ist mangels eigener Spur nicht notiert.", learningGoals: ["Ride-Swing", "Dynamik", "Pocket"], whyInteresting: "Die Fassung trennt hörbare Drumspuren von der nicht darstellbaren Fuß-Hi-Hat und vermeidet falsche Snare-Platzhalter.", kind: "style" },
  "six-eight-blues-rock": { meter: "6/8", subdivision: "Achtel", grouping: [3, 3], tracks: { kick: { accent: [0] }, snare: { accent: [3] }, closedHat: { normal: [0, 1, 2, 3, 4, 5], accent: [0, 3] } }, kind: "style" },
  "latin-pop-shakira": { name: "Latin Pop 3-3-2", attribution: "Stilübung; keine Songtranskription", tracks: { kick: { accent: [0, 3, 6] }, rim: { normal: [0, 3, 6] }, closedHat: { normal: [0, 1, 2, 3, 4, 5, 6, 7] } }, instruction: "Akzentuiere auf einem Achtelraster die 3-3-2-Gruppierung. Diese Übung ist keine Transkription von „Hips Don't Lie“.", kind: "style" },
  "mambo": { bars: 2, tracks: { kick: { normal: [0, 6, 8, 14] }, rim: { accent: [3, 6, 10, 13] }, ride: { normal: [0, 2, 4, 6, 8, 10, 12, 14] }, highTom: { normal: [4, 12] } }, instruction: "Spiele eine zweitaktige Drumset-Reduktion: Ride als Bell-Puls, Rim und Tom als Timbale-Ersatz, Kick sparsam. Das ersetzt kein vollständiges Mambo-Percussion-Ensemble.", kind: "style" },
  "take-five-inspired": { meter: "5/4", subdivision: "Triolen", grouping: [3, 2], tracks: { kick: { ghost: [0, 9] }, snare: { accent: [9] }, ride: { normal: [0, 2, 3, 5, 6, 8, 9, 11, 12, 14], accent: [0, 9] } }, instruction: "Übe 5/4-Swing in 3+2 mit schwerem Akzent auf Beat 4. Dies ist eine didaktische Reduktion, nicht Joe Morellos vollständige Schlagzeugstimme.", attribution: "Didaktische Reduktion nach Joe Morello", learningGoals: ["5/4", "Swing", "Formgefühl"], whyInteresting: "Die 3+2-Phrase macht den Fünfvierteltakt körperlich erfahrbar, ohne ihn fälschlich als Jazz-Walzer zu bezeichnen.", kind: "reduction", source: source.takeFive },
  "seven-days-inspired": { meter: "5/4", bars: 2, subdivision: "Achtel", grouping: [3, 2], tracks: { kick: { accent: [0, 10] }, rim: { accent: [6, 16] }, closedHat: { normal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], accent: [0, 4, 8, 12, 16] } }, instruction: "Spiele zwei Takte 5/4: Kick auf Beat 1, Sidestick auf Beat 4 und eine durchlaufende Achtel-Hat, deren Akzente im ersten Takt auf 1/3/5 und im zweiten auf 2/4 liegen.", attribution: "Quellenbasierte Kernreduktion nach Vinnie Colaiuta", learningGoals: ["5/4", "Akzentzyklus", "Unabhängigkeit"], whyInteresting: "Der zweitaktige Hi-Hat-Akzentzyklus legt ein 4/4-artiges Kreuzmuster über den 5/4-Takt, ohne das Original als 5/8 auszugeben.", playback: { bpm: 112, swing: 50, kit: "Studio" }, kind: "reduction", source: source.sevenDays },
  "immigrant-song": { subdivision: "16tel", tracks: { kick: { accent: [0, 2, 3, 8, 10, 11] }, snare: { accent: [4, 12], ghost: [7, 15] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14], accent: [0, 8] } }, instruction: "Spiele die notierte Bonham-Kickfigur: Downbeats auf 1/3 und je zwei Sechzehntel vor den Backbeats; die leisen Snares liegen auf 2a und 4a.", attribution: "Quellenbasierte Reduktion nach John Bonham", learningGoals: ["Fußtechnik", "Ghostnotes", "Geschwindigkeit"], whyInteresting: "Die doppelte Kick-Vorbereitung vor beiden Backbeats erzeugt den rollenden Vorwärtsdrang des Grooves.", kind: "reduction", source: source.famousPdf },
  "new-orleans-second-line": { bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 7, 10, 16, 23, 26] }, snare: { accent: [4, 12, 20, 28], ghost: [3, 9, 15, 19, 25, 31] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] } }, instruction: "Spiele eine zweitaktige Drumset-Stilübung mit marschartigen Press-/Ghostnotes und synkopierter Kick. Keine feste Clave wird behauptet.", learningGoals: ["Ghostnotes", "Phrasierung", "Second Line"], whyInteresting: "Die Stilübung verbindet Marschbewegung und Funk-Synkopen, ohne eine nicht vorhandene universelle Clave zu behaupten.", kind: "style" },
  "linear-funk-garibaldi": { subdivision: "16tel", tracks: { kick: { accent: [0, 6, 10] }, snare: { accent: [4, 12], ghost: [9, 15] }, closedHat: { normal: [1, 2, 3, 5, 7, 8, 11, 13, 14] } }, instruction: "Spiele alle notierten Stimmen nacheinander: Kein Kick-, Snare- oder Hi-Hat-Schlag fällt zusammen. Das ist eine Garibaldi-inspirierte Linearübung, keine Tower-of-Power-Transkription.", attribution: "Garibaldi-inspirierte Stilübung", kind: "style" },
  "jazz-waltz": { meter: "3/4", subdivision: "Triolen", grouping: [1, 1, 1], tracks: { kick: { ghost: [0, 3, 6] }, snare: { normal: [3] }, ride: { normal: [0, 2, 3, 5, 6, 8], accent: [0] } }, instruction: "Spiele das Swing-Ride-Pattern durch drei Viertel. Die Fuß-Hi-Hat auf Beat 2 ist im aktuellen Spurmodell nicht separat darstellbar.", kind: "style" },
  "afrobeat": { bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 7, 10, 16, 22, 29] }, snare: { accent: [4, 12, 20, 28], ghost: [3, 9, 19, 25] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], accent: [0, 8, 16, 24] } }, instruction: "Spiele eine zweitaktige Afrobeat-Stilübung mit verzahnter Kick und Snare. Sie ist Tony-Allen-inspiriert, aber keine Transkription eines konkreten Titels.", attribution: "Tony-Allen-inspirierte Stilübung", learningGoals: ["Unabhängigkeit", "Zweitaktform", "Pocket"], whyInteresting: "Die verzahnten Stimmen trainieren mehrschichtige Koordination; eine nicht notierte feste Clave wird nicht behauptet.", kind: "style" },
  "heavy-metal-double-bass": { subdivision: "16tel", tracks: { kick: { normal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], accent: [0, 4, 8, 12] }, snare: { accent: [4, 12] }, crash: { normal: [0, 2, 4, 6, 8, 10, 12, 14] } }, instruction: "Spiele durchgehende Double-Bass-Sechzehntel mit Backbeat auf 2 und 4.", learningGoals: ["Double Bass", "Ausdauer", "Backbeat"], whyInteresting: "Durchgehende Fuß-Sechzehntel gegen Achtelbecken und Backbeat isolieren Ausdauer und Gleichmäßigkeit.", kind: "style" },
  "ska-upbeat": { subdivision: "16tel", tracks: { kick: { accent: [0, 8] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 4, 8, 12] }, openHat: { accent: [2, 6, 10, 14] } }, instruction: "Halte Kick und Snare als Backbeat-Gerüst; markiere die Achtel-Offbeats mit offener Hi-Hat. Gitarren-Skanks werden nicht fälschlich Kick/Snare zugeordnet.", kind: "style" },
  "motown-classic": { subdivision: "16tel", tracks: { kick: { accent: [0, 7, 8, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14], accent: [0, 8] } }, instruction: "Spiele eine Motown-inspirierte Backbeat-Übung mit synkopierter Kick. Sie repräsentiert keinen einzelnen Motown-Titel.", learningGoals: ["Backbeat", "Kick-Synkopen", "Pocket"], whyInteresting: "Das Pattern trainiert einen kompakten Backbeat mit synkopierter Kick, ohne nicht notierte Fuß-Hi-Hat- oder Snare-Verschiebungen zu behaupten.", kind: "style" },
  "fatback": { subdivision: "16tel", tracks: { kick: { accent: [0, 3, 10, 14] }, snare: { accent: [8], ghost: [6, 15] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14] } }, instruction: "Lege die Hauptsnare schwer auf Beat 3 und halte die Kick synkopiert: eine Fatback-Stilübung, kein historisch eindeutiges Einzelpattern.", learningGoals: ["Half-Time", "Kick-Synkopen", "Ghostnotes"], whyInteresting: "Die schwere Snare auf Beat 3 und die Achtel-Hi-Hat erzeugen Raum für die synkopierte Kick; es werden keine Sechzehntel-Hats behauptet.", kind: "style" },
  "five-four-rock-mission": { meter: "5/4", subdivision: "Achtel", grouping: [3, 2], tracks: { kick: { accent: [0, 6] }, snare: { accent: [4, 8] }, closedHat: { normal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], accent: [0, 6] } }, name: "5/4 Rock 3+2", attribution: "5/4-Rock-Stilübung", instruction: "Zähle 5/4 als 3+2 und akzentuiere beide Gruppenstarts.", learningGoals: ["5/4", "Gruppierung", "Rock"], whyInteresting: "Die klaren Gruppenstarts machen 3+2 hör- und fühlbar, ohne das Pattern einem konkreten Filmthema zuzuschreiben.", kind: "style" },
  "cha-cha": { bars: 2, subdivision: "16tel", tracks: { kick: { normal: [0, 7, 8, 15, 16, 23, 24, 31] }, rim: { accent: [0, 6, 12, 20, 24] }, ride: { normal: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] } }, instruction: "Spiele eine zweitaktige Drumset-Reduktion von Cha-Cha: Ride ersetzt Cowbell, Rim markiert eine 3-2-Clave. Ergänzende Percussion ist bewusst nicht enthalten.", learningGoals: ["3-2-Clave", "Cowbell-Ersatz", "Unabhängigkeit"], whyInteresting: "Die Reduktion verteilt Ensemblefunktionen auf Drumset-Stimmen und benennt ihre Grenzen ausdrücklich.", kind: "style" },
  "bolero": { name: "Cuban Bolero — Drumset-Reduktion", bars: 2, subdivision: "16tel", tracks: { kick: { normal: [0, 8, 16, 24] }, rim: { accent: [0, 2, 3, 5, 6, 8, 10, 11, 13, 14, 16, 18, 19, 21, 22, 24, 26, 27, 29, 30] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] } }, instruction: "Spiele eine langsame kubanische Drumset-Reduktion: Hat ersetzt den Maraca-Puls, Rim die Cinquillo-nahe Zelle, Kick den tiefen Puls. Nicht mit Ravels Orchester-Boléro verwechseln.", attribution: "Kubanische Stilübung", learningGoals: ["Cinquillo", "Dynamik", "Unabhängigkeit"], whyInteresting: "Das gerade Sechzehntelraster korrigiert die frühere unbelegte Triolenfassung und macht die Ensemble-Ersatzrollen transparent.", kind: "style", source: source.bolero },
  "tango": { subdivision: "16tel", tracks: { kick: { accent: [0, 6, 8, 12] }, snare: { accent: [4, 14] }, rim: { normal: [2, 10] }, closedHat: { normal: [0, 4, 8, 12] } }, instruction: "Orchestriere eine vereinfachte marcato/síncopa-nahe Tango-Phrase auf dem Drumset. Traditioneller Tango besitzt kein universelles Standard-Drumset-Pattern.", attribution: "Didaktische Tango-Orchestrierung", kind: "style" },
  "gospel-chop": { subdivision: "16tel", tracks: { kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12], ghost: [3, 9, 15] }, highTom: { normal: [5, 13] }, lowTom: { normal: [6, 14] } }, instruction: "Übe eine kurze Gospel-Chop-Phrase aus Ghostnotes, Toms und Kick. „Gospel Chops“ bezeichnet eine Spielsprache, keinen einzelnen kanonischen Beat.", kind: "style" },
  "drum-and-bass-break": { subdivision: "16tel", tracks: { kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12], ghost: [15] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14], accent: [0, 8] } }, instruction: "Spiele einen geraden Two-Step-Drum-and-Bass-Kern bei langsamem Übetempo; beschleunige erst nach sauberer Platzierung.", learningGoals: ["Two-Step", "Präzision", "Geschwindigkeit"], whyInteresting: "Das reduzierte Two-Step-Gerüst eignet sich zum kontrollierten Beschleunigen, ohne einen konkreten Samplebreak vorzutäuschen.", kind: "style" },
  "back-in-black-inspired": { subdivision: "16tel", tracks: { kick: { accent: [0, 8, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14], accent: [0, 8] } }, instruction: "Übe einen Phil-Rudd-artigen, geradlinigen Rockgroove mit sparsamem Kick-Zusatz. Keine vollständige Songtranskription.", attribution: "Didaktische Reduktion nach Phil Rudd", kind: "reduction", source: source.famous },
  "good-times-bad-times-inspired": { name: "Good Times Bad Times — Kicktriplet-Übung", subdivision: "Sextolen", tracks: { kick: { accent: [1, 2, 7, 8, 13, 14, 19, 20] }, snare: { accent: [6, 18] }, ride: { normal: [0, 3, 6, 9, 12, 15, 18, 21] } }, instruction: "Übe Bonhams Bassdrum-Technik als Koordinationsübung: zweite und dritte Sechstelposition jeder Viertelgruppe gegen Achtelpuls und Backbeat. Keine Songtakt-Transkription.", attribution: "Technikübung nach John Bonham", learningGoals: ["Fußtechnik", "Sextolen", "Koordination"], whyInteresting: "Das Sechstelraster bildet die zwei gespielten Partials korrekt ab; die frühere Triolenfassung konnte ihre Lage nicht darstellen.", kind: "reduction", source: source.famousPdf },
  "rock-and-roll-bonham": { name: "Rock and Roll — Hauptgroove (Bonham)", subdivision: "16tel", tracks: { kick: { accent: [0, 8, 10] }, snare: { accent: [4, 12], ghost: [0, 2, 6, 8, 10, 14] }, openHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14] } }, instruction: "Spiele Kick auf 1, 3 und 3&, halb offene Hat-Achtel und leise Snare-Achtel mit Backbeat-Akzenten auf 2 und 4.", attribution: "Quellenbasierte Hauptgroove-Reduktion nach John Bonham", learningGoals: ["Dynamik", "Backbeat", "Koordination"], whyInteresting: "Synchronisierte Hat- und Snare-Achtel erzeugen den aggressiven Hauptgroove; Akzent und leise Füllschläge bleiben getrennt.", kind: "reduction", source: source.famousPdf },
  "twelve-eight-slow-blues": { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], tracks: { kick: { accent: [0, 6] }, snare: { accent: [3, 9] }, closedHat: { normal: [0, 2, 3, 5, 6, 8, 9, 11], accent: [0, 3, 6, 9] } }, instruction: "Spiele den 12/8-Blues mit Backbeat auf den Vierteln 2 und 4 (Rasterpositionen 4 und 10 bei Einszählung).", learningGoals: ["12/8", "Shuffle", "Backbeat"], whyInteresting: "Vier Dreiergruppen verbinden den großen Viertelpuls mit einem durchgehenden Shuffle-Feel.", kind: "style" },
  "its-a-new-day": { name: "It’s a New Day — Drum Break", bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 2, 10, 11, 15, 16, 18, 26, 27, 31] }, snare: { accent: [4, 12, 20, 28] }, closedHat: { normal: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] } }, attribution: "Quellenbasierte Rekonstruktion (George Bragg, Skull Snaps)", instruction: "Spiele die zwei wissenschaftlich dokumentierten Break-Takte; besonders die späten Kicks auf 3&, 3a und 4a prägen das Feel.", learningGoals: ["Mikro-Timing", "Kick-Doubles", "Pocket"], whyInteresting: "Der Break kombiniert gerade Achtelstimmen mit deutlich verspäteten Doppelkicks; genau diese Differenz verschwindet bei starrer Quantisierung.", playback: { bpm: 96, swing: 50, kit: "Trocken" }, originalFeel: { label: "Originalmessung", note: "Gemessene Abweichungen beider Break-Takte; beim Tempo proportional skaliert.", sourceBpm: 95.88, timingMs: { kick: { 2: -1, 10: 26, 11: 44, 15: 42, 18: 22, 26: 6, 27: 29, 31: 25 }, snare: { 4: -14, 12: 13, 20: 8, 28: 7 }, closedHat: { 0: -7, 2: -6, 4: -19, 6: -22, 8: -5, 10: 10, 12: 1, 14: 11, 16: -7, 18: -2, 20: -6, 22: 7, 24: 4, 28: -2, 30: 3 } } }, kind: "reconstruction", source: source.microtiming },
  "express-yourself": { name: "Express Yourself — Zweitaktform", bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 3, 8, 11, 14, 16, 19, 24, 27, 30] }, snare: { accent: [4, 9, 13, 20, 25, 28], ghost: [7, 11, 15, 23, 27] }, closedHat: { normal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29] }, openHat: { accent: [30] } }, attribution: "MIDI-basierte Rekonstruktion (James Gadson, Charles Wright & the Watts 103rd Street Rhythm Band)", instruction: "Spiele die zweitaktige MIDI-Rekonstruktion; Mikro-Timing und wechselnde Hi-Hat-Dynamik bleiben in der Feel-Variante erhalten.", learningGoals: ["Ghostnotes", "Dynamik", "Mikro-Timing"], whyInteresting: "Die vollständige Zweitaktphrase ersetzt die frühere generische Eintakt-Schablone und erhält Gadsons synkopierte Snare-Antworten.", playback: { bpm: 92, swing: 50, kit: "Trocken" }, originalFeel: { label: "MIDI-Rekonstruktion", note: "Timing und Dynamik einer notengetreuen MIDI-Rekonstruktion.", sourceBpm: 92, timingMs: { kick: { 3: 14, 11: 14, 19: 14, 27: 14 }, snare: { 7: 14, 9: 14, 11: 14, 13: 14, 15: 14, 23: 14, 25: 14, 27: 14 }, closedHat: { 1: 14, 3: 14, 5: 14, 7: 14, 9: 14, 11: 14, 13: 14, 15: 14, 17: 14, 19: 14, 21: 14, 23: 14, 25: 14, 27: 14, 29: 14 } } }, kind: "reconstruction", source: source.nativeBreaks },
  "hot-pants": { name: "Hot Pants (Bonus Beats) — Stilreduktion", bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 16] }, snare: { accent: [4, 12, 20, 26] }, closedHat: { normal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31] } }, attribution: "Stilreduktion (John “Jabo” Starks, Bobby Byrd)", instruction: "Halte das Tamburin-Ersatzraster gerade und übe die belegte Vorverlagerung einzelner Vierer-Backbeats auf 3&. Diese Fassung ist keine Volltranskription des mehrminütigen Bonus-Beats-Mixes.", learningGoals: ["Backbeat-Verschiebung", "Dynamik", "Pocket"], whyInteresting: "Der 1988 aus Mehrspurmaterial erzeugte Bonus-Beats-Mix zeigt Starks’ Backbeat-Variationen, ist aber kein isolierter Eintaktbreak.", playback: { bpm: 96, swing: 50, kit: "Trocken" }, kind: "reduction", source: source.academicBreaks },
  "take-me-to-the-mardi-gras": { bars: 4, subdivision: "16tel", tracks: { kick: { accent: [0, 7, 10, 16, 23, 26, 32, 39, 42, 48, 55, 58] }, snare: { accent: [4, 12, 20, 28, 36, 44, 52, 60], ghost: [9, 10, 41, 42] }, ride: { normal: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60] } }, attribution: "Didaktische Reduktion (Steve Gadd, Bob James)", instruction: "Übe die viertaktige Introform bei 104 BPM. Ride ersetzt Cowbell; die notierten Snare-Doppelschläge auf 3e–3& stehen in Takt 1 und 3. Weitere Percussion ist reduziert.", learningGoals: ["Viertaktform", "Snare-Doppelschläge", "Koordination"], whyInteresting: "Die viertaktige Form und die Doppelschläge in Takt 1/3 bleiben erhalten; Ensemble-Percussion wird transparent reduziert.", playback: { bpm: 104, swing: 50, kit: "Studio" }, kind: "reduction", source: source.mardi },
  "god-made-me-funky": { name: "God Made Me Funky — Linearübung", bars: 2, subdivision: "16tel", tracks: { kick: { accent: [0, 7, 15, 16, 23, 31] }, snare: { accent: [6, 13, 22, 29] }, closedHat: { normal: [1, 3, 5, 8, 10, 12, 14, 17, 19, 21, 24, 26, 28, 30] } }, attribution: "Mike-Clark-inspirierte Stilübung; keine Originaltranskription", instruction: "Spiele eine zweitaktige Linear-Funk-Übung: Kein Kick-, Snare- oder Hi-Hat-Schlag fällt zusammen. Die Figur ist nur stilistisch am Titel orientiert.", learningGoals: ["Linearität", "Koordination", "Funk"], whyInteresting: "Die Übung trainiert lineare Unabhängigkeit, behauptet aber mangels belastbarer Takttranskription keine Originalnoten.", kind: "style" },
};

function meterParts(meter) {
  const [beats, denominator] = meter.split("/").map(Number);
  return { beats, denominator };
}

function stepCount(meter, subdivision, bars) {
  const { beats, denominator } = meterParts(meter);
  const count = beats * 4 / denominator * factors[subdivision] * bars;
  if (!Number.isInteger(count)) throw new Error(`Fractional grid: ${meter} ${subdivision} × ${bars}`);
  return count;
}

function defaultGrouping(meter) {
  const { beats, denominator } = meterParts(meter);
  return denominator === 8 && beats % 3 === 0 ? Array(beats / 3).fill(3) : Array(beats).fill(1);
}

function buildTracks(length, specification) {
  return Object.fromEntries(Object.entries(specification).map(([voice, hits]) => {
    if (!voices.includes(voice)) throw new Error(`Unknown voice ${voice}`);
    const track = Array(length).fill("mute");
    for (const state of states) for (const index of hits[state] || []) {
      if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error(`${voice}[${index}] outside ${length}-step grid`);
      track[index] = state;
    }
    return [voice, track];
  }));
}

function mergeTracks(tracks, length) {
  return Array.from({ length }, (_, index) => {
    const hits = Object.values(tracks).map((track) => track[index]);
    return hits.includes("accent") ? "accent" : hits.some((hit) => hit !== "mute") ? "normal" : "mute";
  });
}

function validateOriginalFeel(id, length, feel) {
  if (!feel) return;
  if (!(feel.sourceBpm > 0)) throw new Error(`${id} has invalid originalFeel.sourceBpm`);
  for (const [field, ranges] of [["timingMs", [-250, 250]], ["velocityMultipliers", [.05, 2]]]) {
    for (const [voice, values] of Object.entries(feel[field] || {})) {
      if (!voices.includes(voice)) throw new Error(`${id} has unknown original-feel voice ${voice}`);
      for (const [rawIndex, value] of Object.entries(values)) {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error(`${id} originalFeel ${voice}[${rawIndex}] outside ${length}-step grid`);
        if (!Number.isFinite(value) || value < ranges[0] || value > ranges[1]) throw new Error(`${id} originalFeel ${field} ${voice}[${rawIndex}] invalid`);
      }
    }
  }
}

function basePattern(raw, patch, drumTracks) {
  const meter = patch.meter || raw.meter;
  const subdivision = patch.subdivision || raw.subdivision;
  const bars = patch.bars || raw.bars || 1;
  const length = stepCount(meter, subdivision, bars);
  const grouping = patch.grouping || (Array.isArray(raw.grouping) ? raw.grouping : defaultGrouping(meter));
  const { beats, denominator } = meterParts(meter);
  if (grouping.reduce((sum, value) => sum + value, 0) !== beats) throw new Error(`${raw.id}: invalid grouping`);
  const tracks = drumTracks || buildTracks(length, patch.tracks);
  for (const [voice, track] of Object.entries(tracks)) if (track.length !== length) throw new Error(`${raw.id}: ${voice} has ${track.length}, expected ${length}`);
  validateOriginalFeel(raw.id, length, patch.originalFeel);
  const bpm = Math.min(raw.bpmMax, Math.max(raw.bpmMin, raw.empfohleneStartBPM || Math.round((raw.bpmMin + raw.bpmMax) / 2)));
  return {
    id: raw.id,
    name: patch.name || raw.name,
    category: raw.category,
    bpmMin: raw.bpmMin,
    bpmMax: raw.bpmMax,
    meter,
    subdivision,
    bars,
    grouping,
    tempoUnit: denominator === 8 && grouping.every((value) => value === 3) ? "dotted-quarter" : denominator === 8 ? "eighth" : "quarter",
    pattern: mergeTracks(tracks, length),
    drumTracks: tracks,
    difficulty: raw.difficulty,
    instruction: (patch.instruction || raw.instruction).replace(/\[reference:\d+\]/g, ""),
    drumOnly: true,
    attribution: patch.attribution || (patch.kind === "reduction" ? `Didaktische Rekonstruktion (${raw.attribution})` : "Stilübung"),
    learningGoals: patch.learningGoals || raw.learningGoals,
    whyInteresting: (patch.whyInteresting || raw.whyInteresting).replace(/\[reference:\d+\]/g, ""),
    playback: { bpm, swing: raw.swing || 50, kit: raw.category.includes("Trap") || raw.category.includes("Drum") ? "Elektronisch" : "Studio", ...(patch.playback || {}) },
    ...(patch.source ? { source: patch.source } : {}),
    ...(patch.originalFeel ? { originalFeel: patch.originalFeel } : {}),
  };
}

const rawById = new Map([...grooves, ...breaks].map((entry) => [entry.id, entry]));
const order = [...grooves, ...breaks].map((entry) => entry.id).filter((id, index, ids) => ids.indexOf(id) === index && !excluded.has(id));
const reviewed = order.map((id) => {
  const raw = rawById.get(id);
  const mappedId = mapped[id];
  if (manual[id]?.tracks) return basePattern(raw, manual[id]);
  if (mappedId) {
    const app = appPatterns.get(mappedId);
    if (!app) throw new Error(`Missing mapped app pattern ${mappedId}`);
    const patch = manual[id] || {};
    const meter = patch.meter || app.meter;
    const subdivision = patch.subdivision || app.subdivision;
    const bars = patch.bars || app.bars || 1;
    const length = stepCount(meter, subdivision, bars);
    if (Object.values(app.drumTracks).some((track) => track.length !== length)) throw new Error(`${id}: mapped track length mismatch`);
    validateOriginalFeel(id, length, patch.originalFeel || app.originalFeel);
    return {
      ...app,
      id,
      name: patch.name || raw.name,
      category: raw.category,
      attribution: patch.attribution || app.attribution,
      learningGoals: patch.learningGoals || raw.learningGoals,
      whyInteresting: (patch.whyInteresting || raw.whyInteresting).replace(/\[reference:\d+\]/g, ""),
      instruction: (patch.instruction || app.instruction).replace(/\[reference:\d+\]/g, ""),
      playback: { ...app.playback, ...(patch.playback || {}) },
      ...(patch.source ? { source: patch.source } : {}),
      ...(patch.originalFeel ? { originalFeel: patch.originalFeel } : {}),
    };
  }
  const patch = manual[id];
  if (!patch) throw new Error(`No reviewed definition for ${id}`);
  return basePattern(raw, patch);
});

const review = Object.fromEntries(order.map((id) => {
  const raw = rawById.get(id);
  return [id, {
    status: (manual[id]?.kind || (mapped[id] ? "reviewed-existing" : "style")),
    originalSourceText: raw.source,
    notes: manual[id]?.instruction ? "Musikalische Aussage, Raster und Metadaten gegen die angegebene Quelle geprüft und gegebenenfalls korrigiert." : "Durch die geprüfte App-Definition ersetzt.",
  }];
}));

const result = {
  schemaVersion: 1,
  catalogVersion: 2,
  updated: "2026-08-30",
  count: reviewed.length,
  excludedDuplicates: Object.fromEntries(excluded),
  review,
  patterns: reviewed,
};

const targetDir = new URL("research/drum-patterns/generated/", root);
const target = new URL("reviewed-drum-patterns-v1.json", targetDir);
const output = `${JSON.stringify(result, null, 2)}\n`;
await mkdir(targetDir, { recursive: true });

if (process.argv.includes("--check")) {
  const current = await readFile(target, "utf8");
  if (current !== output) throw new Error("Reviewed drum catalog is out of sync");
  console.log(`Verified ${reviewed.length} reviewed patterns.`);
} else {
  await writeFile(target, output);
  console.log(`Generated ${reviewed.length} reviewed patterns.`);
}
