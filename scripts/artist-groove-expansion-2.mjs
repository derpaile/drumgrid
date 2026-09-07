import { artistGroove as groove, ARTIST_GROOVE_SOURCES as shared } from "./artist-groove-expansion.mjs";

const seq = (start, end, step = 1) => Array.from({ length: Math.ceil((end - start) / step) }, (_, index) => start + index * step);
const shifted = (indices, offset) => indices.map((index) => index + offset);
const repeated = (indices, bars, steps = 16) => Array.from({ length: bars }, (_, bar) => shifted(indices, bar * steps)).flat();
const eighths = seq(0, 16, 2);
const quarters = seq(0, 16, 4);

const sources = {
  ...shared,
  hipHop: { label: "Drumeo — Exploring Hip-Hop Grooves", url: "https://www.drumeo.com/beat/hip-hop-drum-beats/" },
  bjork: { label: "Sound On Sound — Björks elektronische Drum-Arrangements", url: "https://www.soundonsound.com/people/biophilia" },
  underworld: { label: "Sound On Sound — Underworlds Live-Sequencing", url: "https://www.soundonsound.com/people/underworld-making-everything-everything" },
  prodigy: { label: "Sound On Sound — The Prodigy und Beat-Programming", url: "https://www.soundonsound.com/people/the-prodigy" },
  freeLessons: { label: "DrumsTheWord — kostenlose Song- und Groove-Lektionen", url: "https://www.drumstheword.com/free-drum-lessons/" },
  legendary: { label: "Drumeo — 14 Legendary Drum Beats", url: "https://www.drumeo.com/beat/learn-14-legendary-drum-beats/" },
};

export const ARTIST_GROOVE_EXPANSION_2 = [
  groove("drum-dangelo-chicken-grease", "D’Angelo — Chicken Grease", "R&B & Gospel", 100, {
    kick: { accent: [0, 7, 10, 16, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [3, 11, 19, 27, 31] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] },
  }, { bars: 2, swing: 60, kit: "Trocken", source: sources.hipHop, learningGoals: ["Neo Soul", "Behind the Beat", "Zweitaktform"] }),
  groove("drum-erykah-badu-on-and-on", "Erykah Badu — On & On", "R&B & Gospel", 80, {
    kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12], ghost: [11, 15] }, closedHat: { ghost: seq(0, 16), normal: eighths, accent: [0, 8] },
  }, { swing: 61, kit: "Vintage", source: sources.hipHop, learningGoals: ["Neo Soul", "Microtiming", "Dynamik"] }),
  groove("drum-roots-you-got-me", "The Roots — You Got Me", "Hip-Hop", 83, {
    kick: { accent: [0, 3, 10, 14, 16, 19, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [7, 15, 23, 31] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 16] }, openHat: { normal: [14, 30] },
  }, { bars: 2, swing: 58, kit: "Trocken", source: sources.hipHop, learningGoals: ["Live Hip-Hop", "Ghostnotes", "Pocket"] }),
  groove("drum-anderson-paak-come-down", "Anderson .Paak — Come Down", "Funk & Soul", 99, {
    kick: { accent: [0, 3, 7, 8, 10, 14] }, snare: { accent: [4, 12], ghost: [2, 6, 9, 15] }, closedHat: { normal: seq(0, 16), accent: [0, 6, 8, 12] }, openHat: { normal: [14] },
  }, { swing: 54, source: sources.funk, learningGoals: ["Modern Funk", "Ghostnotes", "Vocal-Pocket"] }),
  groove("drum-amy-winehouse-rehab", "Amy Winehouse — Rehab", "R&B & Gospel", 145, {
    kick: { accent: [0, 6, 10] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths, accent: quarters }, lowTom: { normal: [14] },
  }, { kit: "Vintage", source: sources.freeLessons, learningGoals: ["Retro Soul", "Backbeat", "Konstanz"] }),
  groove("drum-sade-smooth-operator", "Sade — Smooth Operator", "R&B & Gospel", 119, {
    kick: { accent: [0, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [11] }, closedHat: { normal: seq(0, 16), accent: [0, 8] }, openHat: { normal: [6, 14] }, rim: { normal: [3] },
  }, { swing: 53, source: sources.hundred, learningGoals: ["Sophisti-Pop", "Hi-Hat-Dynamik", "Pocket"] }),
  groove("drum-outkast-rosa-parks", "OutKast — Rosa Parks", "Hip-Hop", 104, {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [11] }, closedHat: { normal: eighths, accent: [0, 8] }, rim: { normal: [6, 15] },
  }, { swing: 57, kit: "Vintage", source: sources.hipHop, learningGoals: ["Southern Hip-Hop", "Swing", "Synkopen"] }),
  groove("drum-kendrick-king-kunta", "Kendrick Lamar — King Kunta", "Hip-Hop", 108, {
    kick: { accent: [0, 3, 8, 10, 14] }, snare: { accent: [4, 12], ghost: [6, 11, 15] }, closedHat: { normal: seq(0, 16), accent: quarters }, openHat: { normal: [14] },
  }, { swing: 55, source: sources.hipHop, learningGoals: ["G-Funk", "Ghostnotes", "Pocket"] }),

  groove("drum-bjork-hunter", "Björk — Hunter", "Dance & Electronic", 90, {
    kick: { accent: [0, 7, 10, 16, 22, 27] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] }, rim: { normal: [3, 9, 19, 25] }, closedHat: { ghost: repeated(seq(0, 16), 2), normal: [0, 6, 10, 16, 22, 26] },
  }, { bars: 2, kit: "Elektronisch", source: sources.bjork, learningGoals: ["Electronic Art Pop", "Asymmetrische Textur", "Zweitaktform"] }),
  groove("drum-lcd-dance-clean", "LCD Soundsystem — Dance Yrself Clean", "Dance & Electronic", 98, {
    kick: { accent: quarters }, snare: { accent: [4, 12] }, closedHat: { normal: eighths, accent: quarters }, openHat: { accent: [6, 14] }, crash: { accent: [0] },
  }, { kit: "Elektronisch", source: sources.hundred, learningGoals: ["Dance-Punk", "Four on the Floor", "Dynamik"] }),
  groove("drum-chemical-block-rockin", "The Chemical Brothers — Block Rockin’ Beats", "Dance & Electronic", 109, {
    kick: { accent: [0, 3, 7, 10, 14, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 15, 22, 31] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, ride: { normal: [14, 30] },
  }, { bars: 2, swing: 54, kit: "Vintage", source: sources.breaks, learningGoals: ["Big Beat", "Breakbeat", "Zweitaktform"] }),
  groove("drum-prodigy-firestarter", "The Prodigy — Firestarter", "Dance & Electronic", 138, {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [6, 15] }, closedHat: { normal: seq(0, 16), accent: [0, 8] }, crash: { accent: [0] },
  }, { kit: "Elektronisch", source: sources.prodigy, difficulty: "Fortgeschritten", learningGoals: ["Big Beat", "Breakbeat", "Ausdauer"] }),
  groove("drum-underworld-born-slippy", "Underworld — Born Slippy .NUXX", "Dance & Electronic", 140, {
    kick: { accent: quarters }, snare: { accent: [4, 12] }, closedHat: { normal: quarters }, openHat: { accent: [2, 6, 10, 14] }, rim: { normal: [3, 11] },
  }, { kit: "Elektronisch", source: sources.underworld, learningGoals: ["Techno", "TR-909", "Konstanz"] }),
  groove("drum-aphex-windowlicker", "Aphex Twin — Windowlicker · Kernzelle", "Dance & Electronic", 127, {
    kick: { accent: [0, 3, 7, 10, 16, 19, 22, 27, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 9, 15, 18, 23, 25, 31] }, closedHat: { ghost: repeated(seq(0, 16), 2), normal: [0, 2, 6, 8, 10, 14, 16, 19, 22, 24, 27, 30] }, openHat: { normal: [7, 23] },
  }, { bars: 2, kit: "Elektronisch", source: sources.hundred, difficulty: "Fortgeschritten", learningGoals: ["IDM", "Ghostnotes", "Asymmetrie"] }),
  groove("drum-burial-archangel", "Burial — Archangel", "Dance & Electronic", 134, {
    kick: { accent: [0, 7, 10, 16, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [3, 11, 19, 27] }, closedHat: { ghost: repeated(seq(0, 16), 2), normal: [1, 6, 9, 14, 17, 22, 25, 30] }, rim: { normal: [7, 15, 23, 31] },
  }, { bars: 2, swing: 59, kit: "Elektronisch", source: sources.hundred, learningGoals: ["UK Garage", "Microtiming", "Atmosphäre"] }),
  groove("drum-massive-unfinished-sympathy", "Massive Attack — Unfinished Sympathy", "Trip-Hop & Downtempo", 115, {
    kick: { accent: [0, 3, 8, 10, 16, 19, 24, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, swing: 54, kit: "Vintage", source: sources.breaks, learningGoals: ["Bristol", "Breakbeat", "Zweitaktform"] }),

  groove("drum-weather-report-teen-town", "Weather Report — Teen Town", "Jazz", 126, {
    kick: { accent: [0, 3, 6, 10, 14] }, snare: { accent: [4, 12], ghost: [2, 7, 9, 15] }, ride: { normal: seq(0, 16), accent: quarters }, openHat: { normal: [6, 14] },
  }, { source: sources.hundred, difficulty: "Fortgeschritten", learningGoals: ["Fusion", "Linearität", "Unabhängigkeit"] }),
  groove("drum-mahavishnu-dance-maya", "Mahavishnu Orchestra — Dance of Maya · 10/8-Zelle", "Jazz", 120, {
    kick: { accent: [0, 6, 12, 16] }, snare: { accent: [4, 10, 18], ghost: [9, 15] }, ride: { normal: seq(0, 20, 2), accent: [0, 6, 12, 16] },
  }, { meter: "5/4", grouping: [3, 2], source: sources.hundred, difficulty: "Fortgeschritten", learningGoals: ["10/8-Feeling", "Fusion", "Polymetrik"] }),
  groove("drum-snarky-puppy-lingus", "Snarky Puppy — Lingus", "Jazz", 105, {
    kick: { accent: [0, 3, 7, 10, 14, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [2, 6, 9, 15, 18, 22, 25, 31] }, closedHat: { normal: repeated(seq(0, 16), 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, swing: 53, source: sources.hundred, difficulty: "Fortgeschritten", learningGoals: ["Modern Fusion", "Ghostnotes", "Zweitaktform"] }),
  groove("drum-yussef-black-classical", "Yussef Dayes — Black Classical Music", "Jazz", 112, {
    kick: { accent: [0, 3, 7, 10, 16, 22, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [2, 6, 9, 15, 18, 23, 27, 31] }, ride: { normal: repeated(eighths, 2), accent: [0, 6, 10, 16, 22, 26] }, highTom: { normal: [14, 29] },
  }, { bars: 2, swing: 56, source: sources.hundred, difficulty: "Fortgeschritten", learningGoals: ["Contemporary Jazz", "Broken Beat", "Dynamik"] }),

  groove("drum-bob-marley-stir-it-up", "Bob Marley & The Wailers — Stir It Up", "Reggae", 74, {
    kick: { accent: [8], normal: [14] }, rim: { accent: [8], ghost: [4, 12] }, closedHat: { normal: eighths, accent: [0, 8] }, openHat: { normal: [6, 14] },
  }, { swing: 55, kit: "Trocken", source: sources.freeLessons, learningGoals: ["One Drop", "Reggae", "Hi-Hat-Kontrolle"] }),
  groove("drum-peter-tosh-legalize-it", "Peter Tosh — Legalize It", "Reggae", 74, {
    kick: { accent: [0, 8] }, rim: { accent: [8] }, closedHat: { normal: eighths, accent: [0, 8] }, openHat: { normal: [14] },
  }, { swing: 54, kit: "Trocken", source: sources.reggae, learningGoals: ["Rockers", "Reggae", "Raum"] }),
  groove("drum-sly-robbie-boops", "Sly & Robbie — Boops (Here to Go)", "Reggae", 98, {
    kick: { accent: quarters }, rim: { accent: [8] }, snare: { ghost: [4, 12] }, closedHat: { normal: eighths, accent: [0, 8] }, openHat: { normal: [6, 14] },
  }, { kit: "Elektronisch", source: sources.reggae, learningGoals: ["Steppers", "Digital Reggae", "Layering"] }),
  groove("drum-buena-vista-chan-chan", "Buena Vista Social Club — Chan Chan", "Latin & World", 83, {
    kick: { normal: [0, 7, 8, 15, 16, 23, 24, 31] }, rim: { accent: [0, 3, 6, 10, 13, 16, 22, 25, 28, 30] }, ride: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, lowTom: { normal: [5, 12, 21, 29] },
  }, { bars: 2, swing: 53, kit: "Trocken", source: sources.afroLatin, learningGoals: ["Son Cubano", "Clave", "Leichtigkeit"] }),
  groove("drum-jorge-ben-taj-mahal", "Jorge Ben Jor — Taj Mahal", "Latin & World", 128, {
    kick: { accent: [0, 3, 8, 11] }, snare: { accent: [4, 12], ghost: [7, 15] }, rim: { normal: [2, 6, 10, 14] }, closedHat: { normal: seq(0, 16), accent: quarters },
  }, { meter: "2/4", bars: 2, swing: 53, source: sources.afroLatin, learningGoals: ["Samba Rock", "Synkopen", "Ausdauer"] }),
  groove("drum-fela-zombie", "Fela Kuti — Zombie", "Latin & World", 106, {
    kick: { accent: [0, 7, 10, 16, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [3, 6, 9, 15, 19, 22, 25, 31] }, closedHat: { normal: repeated(seq(0, 16), 2), accent: [0, 6, 10, 16, 22, 26] }, openHat: { normal: [14, 30] },
  }, { bars: 2, swing: 53, source: sources.afroLatin, difficulty: "Fortgeschritten", learningGoals: ["Afrobeat", "Unabhängigkeit", "Zweitaktform"] }),

  groove("drum-qotsa-no-one-knows", "Queens of the Stone Age — No One Knows", "Rock & Pop", 171, {
    kick: { accent: [0, 3, 6, 8, 11, 14] }, snare: { accent: [4, 12], ghost: [7, 15] }, closedHat: { normal: eighths, accent: quarters }, openHat: { normal: [14] }, crash: { accent: [0] },
  }, { source: sources.freeLessons, difficulty: "Fortgeschritten", learningGoals: ["Stoner Rock", "Kick-Synkopen", "Dynamik"] }),
  groove("drum-soundgarden-spoonman", "Soundgarden — Spoonman · 7/4-Puls", "Progressive & Heavy", 105, {
    kick: { accent: [0, 6, 10, 16, 22, 26] }, snare: { accent: [4, 12, 18, 26], ghost: [9, 23] }, closedHat: { normal: seq(0, 28, 2), accent: [0, 12, 20] },
  }, { meter: "7/4", grouping: [3, 2, 2], source: sources.freeLessons, difficulty: "Fortgeschritten", learningGoals: ["7/4", "Grunge", "Gruppierung"] }),
  groove("drum-king-crimson-frame", "King Crimson — Frame by Frame · 13/8-Zelle", "Progressive & Heavy", 95, {
    kick: { accent: [0, 6, 10, 16, 22] }, snare: { accent: [4, 12, 20], ghost: [9, 25] }, ride: { normal: seq(0, 26, 2), accent: [0, 8, 16, 22] },
  }, { meter: "13/8", grouping: [3, 3, 3, 2, 2], source: sources.freeLessons, difficulty: "Fortgeschritten", learningGoals: ["13/8", "Polymetrik", "Progressive Rock"] }),
  groove("drum-meshuggah-bleed", "Meshuggah — Bleed · Herta-Kern", "Progressive & Heavy", 115, {
    kick: { accent: [0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 15] }, snare: { accent: [4, 12] }, closedHat: { accent: eighths }, crash: { accent: [0] },
  }, { source: sources.hundred, difficulty: "Fortgeschritten", learningGoals: ["Herta-Fußtechnik", "Polyrhythmik", "Ausdauer"] }),
  groove("drum-gojira-stranded", "Gojira — Stranded", "Punk & Metal", 112, {
    kick: { accent: [0, 3, 6, 8, 11, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths, accent: quarters }, crash: { accent: [0, 8] }, lowTom: { normal: [7, 15] },
  }, { source: sources.freeLessons, difficulty: "Fortgeschritten", learningGoals: ["Modern Metal", "Staccato", "Präzision"] }),
  groove("drum-system-toxicity", "System of a Down — Toxicity", "Punk & Metal", 112, {
    kick: { accent: [0, 3, 7, 10, 14, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], normal: [15, 31] }, highTom: { normal: [2, 6, 18, 22] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, crash: { accent: [0, 16] },
  }, { bars: 2, source: sources.freeLessons, difficulty: "Fortgeschritten", learningGoals: ["Alternative Metal", "Tom-Orchestrierung", "Zweitaktform"] }),
];
