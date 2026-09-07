import { artistGroove as groove, ARTIST_GROOVE_SOURCES as shared } from "./artist-groove-expansion.mjs";

const seq = (start, end, step = 1) => Array.from({ length: Math.ceil((end - start) / step) }, (_, index) => start + index * step);
const shifted = (indices, offset) => indices.map((index) => index + offset);
const repeated = (indices, bars, steps = 16) => Array.from({ length: bars }, (_, bar) => shifted(indices, bar * steps)).flat();
const eighths = seq(0, 16, 2);

const sources = {
  limp: { label: "DrumsTheWord — Limp-Bizkit-Lektionen und Noten", url: "https://www.drumstheword.com/free-drum-lessons/" },
  myGeneration: { label: "DrumsTheWord — My Generation Drum Beat", url: "https://www.drumstheword.com/pdf/LimpBizkit_MyGeneration_Beat.pdf" },
  porcupine: { label: "Drumeo — Gavin Harrison und Progressive Drumming", url: "https://www.drumeo.com/beat/a-drummers-guide-to-prog/" },
  muzak: { label: "DrumsTheWord — Gavin-Harrison-Lektionen", url: "https://www.drumstheword.com/sound-muzak-free-drum-beat-video-lesson-gavin-harrison-porcupine-tree-how-play-song-drums/" },
  wilson: { label: "MusicRadar — Craig Blundell über Steven Wilson", url: "https://www.musicradar.com/news/drums/craig-blundell-on-drumming-for-steven-wilson-technology-counting-and-more-635827" },
  permanating: { label: "DrumSetSheetMusic — Permanating Transkriptionsnachweis", url: "https://drumsetsheetmusic.com/products/permanating-steven-wilson-full-drum-transcription-drum-sheet-music-jaslow-drum-sheets" },
  ...shared,
};

export const ARTIST_GROOVE_EXPANSION_3 = [
  groove("drum-limp-my-generation", "Limp Bizkit — My Generation", "Punk & Metal", 104, {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [6, 9, 15] }, closedHat: { normal: seq(0, 16), accent: [0, 8] }, openHat: { normal: [14] },
  }, { source: sources.myGeneration, difficulty: "Fortgeschritten", learningGoals: ["Nu Metal", "Ghostnotes", "Kick-Synkopen"] }),
  groove("drum-limp-break-stuff", "Limp Bizkit — Break Stuff", "Punk & Metal", 108, {
    kick: { accent: [0, 3, 8, 10, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths, accent: [0, 8] }, crash: { accent: [0] }, lowTom: { normal: [7, 15] },
  }, { source: sources.limp, learningGoals: ["Nu Metal", "Half Time", "Staccato"] }),
  groove("drum-limp-nookie", "Limp Bizkit — Nookie", "Punk & Metal", 96, {
    kick: { accent: [0, 3, 7, 10, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 15, 22, 31] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, source: sources.limp, difficulty: "Fortgeschritten", learningGoals: ["Rap Metal", "Zweitaktform", "Ghostnotes"] }),
  groove("drum-limp-rearranged", "Limp Bizkit — Re-Arranged", "Rock & Pop", 100, {
    kick: { accent: [0, 7, 10, 16, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [11, 27] }, ride: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, rim: { normal: [14, 31] },
  }, { bars: 2, swing: 54, source: sources.limp, learningGoals: ["Rap Rock", "Raum", "Zweitaktform"] }),
  groove("drum-limp-take-look-around", "Limp Bizkit — Take a Look Around", "Punk & Metal", 101, {
    kick: { accent: [0, 3, 6, 10, 14] }, snare: { accent: [4, 12], ghost: [7, 11, 15] }, closedHat: { normal: seq(0, 16), accent: [0, 8] }, openHat: { normal: [6, 14] },
  }, { source: sources.limp, difficulty: "Fortgeschritten", learningGoals: ["Nu Metal", "Sechzehntel-Pocket", "Dynamik"] }),
  groove("drum-limp-rollin", "Limp Bizkit — Rollin’", "Punk & Metal", 97, {
    kick: { accent: [0, 3, 7, 8, 10, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths, accent: [0, 8] }, crash: { accent: [0, 8] },
  }, { source: sources.limp, learningGoals: ["Rap Metal", "Stomp", "Kick-Präzision"] }),
  groove("drum-limp-my-way", "Limp Bizkit — My Way", "Punk & Metal", 98, {
    kick: { accent: [0, 3, 7, 10, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 11, 22, 27] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] }, lowTom: { normal: [15, 31] },
  }, { bars: 2, source: { label: "Drumscore — My Way Drum Sheet Music", url: "https://drumscore.com/sheet-music/browse-by-artist/score/6062-limp-bizkit-my-way-drum-sheet-music-tab" }, difficulty: "Fortgeschritten", learningGoals: ["Nu Metal", "Zweitaktform", "Ghostnotes"] }),

  groove("drum-porcupine-bonnie-cat", "Porcupine Tree — Bonnie the Cat", "Progressive & Heavy", 127, {
    kick: { accent: [0, 3, 7, 10, 16, 19, 22, 27, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [2, 6, 9, 15, 18, 23, 25, 31] }, closedHat: { normal: repeated(seq(0, 16), 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, source: sources.muzak, difficulty: "Fortgeschritten", learningGoals: ["Polymetrik", "Ghostnotes", "Gavin Harrison"] }),
  groove("drum-porcupine-fear-blank", "Porcupine Tree — Fear of a Blank Planet", "Progressive & Heavy", 100, {
    kick: { accent: [0, 3, 6, 10, 14] }, snare: { accent: [4, 12], ghost: [7, 11, 15] }, closedHat: { normal: seq(0, 16), accent: [0, 6, 10] }, openHat: { normal: [14] },
  }, { source: sources.muzak, difficulty: "Fortgeschritten", learningGoals: ["Progressive Rock", "Akzentverschiebung", "Ghostnotes"] }),
  groove("drum-porcupine-blackest-eyes", "Porcupine Tree — Blackest Eyes", "Progressive & Heavy", 105, {
    kick: { accent: [0, 1, 3, 6, 8, 11, 14] }, snare: { accent: [4, 12] }, closedHat: { accent: eighths }, crash: { accent: [0, 8] },
  }, { source: sources.porcupine, difficulty: "Fortgeschritten", learningGoals: ["Progressive Metal", "Double-Kick", "Präzision"] }),
  groove("drum-porcupine-trains", "Porcupine Tree — Trains", "Rock & Pop", 110, {
    kick: { accent: [0, 6, 10, 16, 22, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] }, ride: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, highTom: { normal: [14, 29] },
  }, { bars: 2, source: sources.porcupine, learningGoals: ["Progressive Pop", "Zweitaktform", "Orchestrierung"] }),
  groove("drum-porcupine-anesthetize", "Porcupine Tree — Anesthetize · 5/4-Zelle", "Progressive & Heavy", 120, {
    kick: { accent: [0, 6, 12, 16] }, snare: { accent: [4, 10, 18], ghost: [9, 15] }, closedHat: { normal: seq(0, 20, 2), accent: [0, 6, 12, 16] }, openHat: { normal: [14] },
  }, { meter: "5/4", grouping: [3, 2], source: sources.porcupine, difficulty: "Fortgeschritten", learningGoals: ["5/4", "Progressive Rock", "Gruppierung"] }),
  groove("drum-porcupine-harridan", "Porcupine Tree — Harridan · additiver Puls", "Progressive & Heavy", 100, {
    kick: { accent: [0, 6, 10, 16, 22, 26] }, snare: { accent: [4, 12, 18, 26], ghost: [9, 23] }, closedHat: { normal: seq(0, 28, 2), accent: [0, 12, 20] }, openHat: { normal: [10, 24] },
  }, { meter: "7/4", grouping: [3, 2, 2], source: sources.porcupine, difficulty: "Fortgeschritten", learningGoals: ["7/4", "Additive Rhythmen", "Gavin Harrison"] }),
  groove("drum-porcupine-start-beautiful", "Porcupine Tree — The Start of Something Beautiful · 9/8-Groove", "Progressive & Heavy", 92, {
    kick: { accent: [0, 6, 12, 16] }, snare: { accent: [4, 10, 16], ghost: [3, 9, 15] }, closedHat: { normal: seq(0, 18, 2), accent: [0, 6, 12] }, openHat: { normal: [14] },
  }, { meter: "9/8", grouping: [3, 3, 3], source: { label: "Drumeo — The Start of Something Beautiful Drum Transcription", url: "https://drumsetsheetmusic.com/products/the-start-of-something-beautiful-porcupine-tree-full-drum-transcription-drum-sheet-music-drumeo" }, difficulty: "Fortgeschritten", learningGoals: ["9/8", "Gavin Harrison", "Ghostnotes"] }),

  groove("drum-wilson-luminol", "Steven Wilson — Luminol", "Progressive & Heavy", 130, {
    kick: { accent: [0, 3, 7, 10, 14, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [2, 6, 9, 15, 18, 22, 25, 31] }, ride: { normal: repeated(seq(0, 16), 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, source: sources.wilson, difficulty: "Fortgeschritten", learningGoals: ["Fusion Rock", "Ghostnotes", "Zweitaktform"] }),
  groove("drum-wilson-holy-drinker", "Steven Wilson — The Holy Drinker", "Progressive & Heavy", 105, {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [6, 9, 15] }, ride: { normal: seq(0, 16), accent: [0, 6, 10] }, highTom: { normal: [14] },
  }, { source: sources.wilson, difficulty: "Fortgeschritten", learningGoals: ["Jazz Rock", "Ride-Dynamik", "Orchestrierung"] }),
  groove("drum-wilson-home-invasion", "Steven Wilson — Home Invasion · 7/8-Zelle", "Progressive & Heavy", 105, {
    kick: { accent: [0, 4, 8, 12] }, snare: { accent: [2, 6, 10], ghost: [9, 13] }, closedHat: { normal: seq(0, 14, 2), accent: [0, 4, 8] },
  }, { meter: "7/8", grouping: [2, 2, 3], source: sources.wilson, difficulty: "Fortgeschritten", learningGoals: ["7/8", "Craig Blundell", "Gruppierung"] }),
  groove("drum-wilson-regret-nine", "Steven Wilson — Regret #9", "Progressive & Heavy", 106, {
    kick: { accent: [0, 3, 7, 10, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 11, 22, 27] }, ride: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, source: sources.wilson, difficulty: "Fortgeschritten", learningGoals: ["Fusion", "Zweitaktform", "Dynamik"] }),
  groove("drum-wilson-permanating", "Steven Wilson — Permanating", "Rock & Pop", 128, {
    kick: { accent: [0, 3, 8, 10, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths, accent: [0, 8] }, openHat: { normal: [6, 14] }, crash: { accent: [0] },
  }, { source: sources.permanating, learningGoals: ["Progressive Pop", "Offene Hi-Hat", "Konstanz"] }),
  groove("drum-wilson-king-ghost", "Steven Wilson — King Ghost", "Dance & Electronic", 94, {
    kick: { accent: [0, 7, 10, 16, 23, 26] }, snare: { accent: [4, 12, 20, 28], ghost: [11, 27] }, rim: { normal: [3, 9, 19, 25] }, closedHat: { ghost: repeated(seq(0, 16), 2), normal: [0, 6, 10, 16, 22, 26] },
  }, { bars: 2, kit: "Elektronisch", source: sources.wilson, learningGoals: ["Electronic Art Pop", "Minimalismus", "Zweitaktform"] }),
];
