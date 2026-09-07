const seq = (start, end, step = 1) => Array.from({ length: Math.ceil((end - start) / step) }, (_, index) => start + index * step);
const shifted = (indices, offset) => indices.map((index) => index + offset);
const repeated = (indices, bars, steps = 16) => Array.from({ length: bars }, (_, bar) => shifted(indices, bar * steps)).flat();
const eighths = seq(0, 16, 2);
const quarters = seq(0, 16, 4);

const sources = {
  charts: { label: "DrumsTheWord — kostenlose Groove-Lektionen und Noten", url: "https://www.drumstheword.com/famous-drummers-greatest-drum-beats/" },
  hundred: { label: "MusicRadar — 100 bedeutende Drumbeats", url: "https://www.musicradar.com/news/drums/100-greatest-drum-beats-of-all-time-204008" },
  tutorials: { label: "Drumeo — Tutorials und Transkriptionen", url: "https://www.drumeo.com/beat/songs/tutorials-and-transcriptions/" },
  funk: { label: "Drumeo — Soul- und Funk-Drumming", url: "https://www.drumeo.com/beat/the-ultimate-guide-to-soul-and-funk-drumming/" },
  reggae: { label: "MusicRadar — One-Drop-Reggae", url: "https://www.musicradar.com/how-to/how-to-program-a-typical-one-drop-reggae-beat-and-add-fills" },
  breaks: { label: "MusicRadar — einflussreiche Drum-Breaks", url: "https://www.musicradar.com/news/best-drum-breaks-of-all-time" },
  machines: { label: "MusicRadar — prägende TR-808-Tracks", url: "https://www.musicradar.com/music-tech/drum-machines/for-808-day-13-iconic-roland-tr-808-tracks-that-made-a-legend" },
  afroLatin: { label: "Berklee PULSE — Afro-Latin-Grooves", url: "https://pulse.berklee.edu/" },
};

function groove(id, name, category, bpm, tracks, options = {}) {
  const openHatSteps = new Set(Object.values(tracks.openHat || {}).flat());
  const normalizedTracks = tracks.closedHat ? {
    ...tracks,
    closedHat: Object.fromEntries(Object.entries(tracks.closedHat).map(([state, steps]) => [state, steps.filter((step) => !openHatSteps.has(step))])),
  } : tracks;
  return {
    id, name, category, patternType: "Groove", bpmMin: options.bpmMin || Math.max(35, Math.round(bpm * .65)), bpmMax: options.bpmMax || Math.min(260, Math.round(bpm * 1.35)),
    meter: options.meter || "4/4", subdivision: options.subdivision || "16tel", bars: options.bars || 1, grouping: options.grouping,
    difficulty: options.difficulty || "Mittel", tracks: normalizedTracks,
    instruction: options.instruction || `Isoliere den Kernpuls von „${name.split(" — ").at(-1)}“ und spiele ihn zuerst langsam, dann im Referenztempo.`,
    attribution: options.attribution || "Didaktische Groove-Reduktion nach veröffentlichter Unterrichtsquelle",
    learningGoals: options.learningGoals || ["Pocket", "Stilgefühl", "Dynamik"],
    whyInteresting: options.whyInteresting || "Die Reduktion bewahrt die charakteristische Pulsverteilung und Orchestrierung, ohne eine vollständige Songtranskription zu behaupten.",
    playback: { bpm, swing: options.swing || 50, kit: options.kit || "Studio" }, source: options.source || sources.charts,
  };
}

export const ARTIST_GROOVE_EXPANSION = [
  groove("drum-beatles-rain", "The Beatles — Rain", "Rock & Pop", 108, {
    kick: { accent: [0, 6, 10, 16, 22, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] }, ride: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, lowTom: { normal: [14, 29] },
  }, { bars: 2, difficulty: "Fortgeschritten", source: sources.charts, learningGoals: ["Ringo-Phrasierung", "Zweitaktform", "Tom-Übergänge"] }),
  groove("drum-talking-heads-and-she-was", "Talking Heads — And She Was", "Rock & Pop", 125, {
    kick: { accent: [0, 3, 8, 10] }, snare: { accent: [4, 12], ghost: [15] }, closedHat: { normal: eighths, accent: quarters }, openHat: { normal: [14] },
  }, { source: sources.charts, learningGoals: ["New Wave", "Synkopen", "Pocket"] }),
  groove("drum-tears-for-fears-rule-world", "Tears for Fears — Everybody Wants to Rule the World", "Rock & Pop", 112, {
    kick: { accent: [0, 6] }, snare: { accent: [3, 9] }, closedHat: { normal: [0, 2, 3, 5, 6, 8, 9, 11], accent: [0, 6] },
  }, { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], source: sources.charts, learningGoals: ["Shuffle", "New Wave", "Konstanz"] }),
  groove("drum-fleetwood-go-your-own-way", "Fleetwood Mac — Go Your Own Way", "Rock & Pop", 135, {
    kick: { accent: [0, 3, 7, 8, 10, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths, accent: quarters }, crash: { accent: [0] },
  }, { source: sources.charts, learningGoals: ["Driving Rock", "Kick-Synkopen", "Ausdauer"] }),
  groove("drum-u2-sunday-bloody-sunday", "U2 — Sunday Bloody Sunday", "Rock & Pop", 101, {
    kick: { accent: repeated(quarters, 2) }, snare: { normal: [2, 6, 10, 14, 18, 22, 26, 30], accent: [4, 12, 20, 28] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 16] },
  }, { bars: 2, source: sources.charts, learningGoals: ["Marschrhythmus", "Snare-Ausdauer", "Zweitaktform"] }),
  groove("drum-foo-fighters-breakout", "Foo Fighters — Breakout", "Rock & Pop", 157, {
    kick: { accent: [0, 3, 6, 8, 11, 14] }, snare: { accent: [4, 12] }, closedHat: { accent: eighths }, openHat: { accent: [14] }, crash: { accent: [0] },
  }, { difficulty: "Fortgeschritten", source: sources.charts, learningGoals: ["Alternative Rock", "Ausdauer", "Kick-Präzision"] }),
  groove("drum-smashing-pumpkins-tonight", "The Smashing Pumpkins — Tonight, Tonight", "Rock & Pop", 148, {
    kick: { accent: [0, 7, 10, 16, 22, 27, 30] }, snare: { accent: [4, 12, 20, 28], normal: [15, 31] }, highTom: { normal: [2, 6, 18, 22] }, lowTom: { accent: [8, 24] }, ride: { normal: repeated(eighths, 2), accent: [0, 16] },
  }, { bars: 2, difficulty: "Fortgeschritten", source: sources.charts, learningGoals: ["Orchestrierung", "Tom-Melodie", "Zweitaktform"] }),
  groove("drum-cure-friday-in-love", "The Cure — Friday I’m in Love", "Rock & Pop", 136, {
    kick: { accent: [0, 6, 8, 10, 14] }, snare: { accent: [4, 12] }, ride: { normal: eighths, accent: quarters }, openHat: { normal: [14] },
  }, { source: sources.charts, learningGoals: ["Jangle Pop", "Ride-Führung", "Leichtigkeit"] }),
  groove("drum-prince-purple-rain", "Prince — Purple Rain", "Rock & Pop", 113, {
    kick: { accent: [0, 10, 16, 22, 26] }, snare: { accent: [4, 12, 20, 28], ghost: [15, 31] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, crash: { accent: [0, 16] },
  }, { bars: 2, source: sources.charts, kit: "80s", learningGoals: ["Balladen-Pocket", "Raum", "Dynamik"] }),
  groove("drum-police-walking-moon", "The Police — Walking on the Moon", "Rock & Pop", 146, {
    kick: { accent: [0, 10] }, snare: { accent: [12], ghost: [4] }, closedHat: { normal: [0, 3, 6, 8, 10, 14] }, openHat: { accent: [7, 15] }, rim: { normal: [4] },
  }, { source: sources.charts, learningGoals: ["Reggae-Rock", "Raum", "Hi-Hat-Kontrolle"] }),

  groove("drum-rush-tom-sawyer", "Rush — Tom Sawyer · 7/8-Wendung", "Progressive & Heavy", 88, {
    kick: { accent: [0, 6, 10] }, snare: { accent: [4, 12], ghost: [9] }, closedHat: { normal: seq(0, 14, 2), accent: [0, 6, 10] },
  }, { meter: "7/8", grouping: [3, 2, 2], difficulty: "Fortgeschritten", source: sources.charts, learningGoals: ["Ungerade Takte", "Progressive Rock", "Gruppierung"] }),
  groove("drum-porcupine-sound-muzak", "Porcupine Tree — The Sound of Muzak", "Progressive & Heavy", 85, {
    kick: { accent: [0, 6, 10, 16, 20, 24] }, snare: { accent: [4, 12, 18, 26], ghost: [9, 23] }, closedHat: { normal: seq(0, 28, 2), accent: [0, 12, 20] }, openHat: { normal: [10, 24] },
  }, { meter: "7/4", grouping: [3, 2, 2], difficulty: "Fortgeschritten", source: sources.tutorials, learningGoals: ["7/4-Pocket", "Ghostnotes", "Hi-Hat-Variation"] }),
  groove("drum-tool-the-pot", "Tool — The Pot · Hauptpuls", "Progressive & Heavy", 107, {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [6, 11] }, closedHat: { normal: eighths, accent: [0, 6, 10] }, openHat: { normal: [14] },
  }, { difficulty: "Fortgeschritten", source: sources.hundred, learningGoals: ["Progressive Metal", "Akzentverschiebung", "Unabhängigkeit"] }),
  groove("drum-motorhead-overkill", "Motörhead — Overkill", "Punk & Metal", 136, {
    kick: { accent: seq(0, 16, 2), normal: seq(1, 16, 2) }, snare: { accent: [4, 12] }, ride: { accent: eighths }, crash: { accent: [0] },
  }, { difficulty: "Fortgeschritten", source: sources.hundred, learningGoals: ["Double Bass", "Ausdauer", "Heavy Metal"] }),
  groove("drum-muse-stockholm", "Muse — Stockholm Syndrome", "Progressive & Heavy", 128, {
    kick: { accent: [0, 1, 3, 6, 8, 9, 11, 14] }, snare: { accent: [4, 12] }, closedHat: { accent: eighths }, crash: { accent: [0, 8] },
  }, { difficulty: "Fortgeschritten", source: sources.tutorials, learningGoals: ["Double-Kick", "Alternative Metal", "Präzision"] }),
  groove("drum-deftones-my-own-summer", "Deftones — My Own Summer", "Punk & Metal", 110, {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [8] }, closedHat: { normal: eighths, accent: [0, 8] }, openHat: { accent: [6, 14] }, crash: { accent: [0] },
  }, { source: sources.charts, learningGoals: ["Half Time", "Nu Metal", "Raum"] }),

  groove("drum-living-colour-love-rears", "Living Colour — Love Rears Its Ugly Head", "Funk & Soul", 102, {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [6, 9, 15] }, closedHat: { normal: seq(0, 16), accent: quarters }, openHat: { normal: [14] },
  }, { difficulty: "Fortgeschritten", source: sources.hundred, learningGoals: ["Funk Rock", "Ghostnotes", "Kick-Bass-Verzahnung"] }),
  groove("drum-rhcp-give-it-away", "Red Hot Chili Peppers — Give It Away", "Funk & Soul", 92, {
    kick: { accent: [0, 3, 7, 10, 14] }, snare: { accent: [4, 12], ghost: [2, 6, 9, 15] }, closedHat: { normal: eighths, accent: [0, 6, 10] }, openHat: { accent: [14] },
  }, { source: sources.hundred, learningGoals: ["Funk Rock", "Ghostnotes", "Pocket"] }),
  groove("drum-james-brown-payback", "James Brown — The Payback", "Funk & Soul", 97, {
    kick: { accent: [0, 3, 7, 10, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 9, 15, 22, 25, 31] }, closedHat: { normal: repeated(seq(0, 16), 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, difficulty: "Fortgeschritten", source: sources.funk, swing: 53, learningGoals: ["Funk", "Ghostnotes", "Zweitaktform"] }),
  groove("drum-meters-look-ka-py-py", "The Meters — Look-Ka Py Py", "Funk & Soul", 93, {
    kick: { accent: [0, 3, 10, 16, 19, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [7, 15, 23, 31] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 6, 16, 22] }, lowTom: { normal: [14, 29] },
  }, { bars: 2, difficulty: "Fortgeschritten", source: sources.funk, swing: 55, learningGoals: ["New Orleans Funk", "Second Line", "Pocket"] }),
  groove("drum-herbie-chameleon", "Herbie Hancock — Chameleon", "Jazz", 111, {
    kick: { accent: [0, 3, 7, 10, 14, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 11, 22, 27] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, difficulty: "Fortgeschritten", source: sources.hundred, swing: 52, learningGoals: ["Jazz-Funk", "Ghostnotes", "Zweitaktform"] }),
  groove("drum-ray-charles-whatd-i-say", "Ray Charles — What’d I Say", "R&B & Gospel", 97, {
    kick: { accent: [0, 6] }, snare: { accent: [3, 9], ghost: [2, 5, 8, 11] }, ride: { normal: [0, 2, 3, 5, 6, 8, 9, 11], accent: [0, 6] }, highTom: { normal: [4, 10] },
  }, { meter: "12/8", subdivision: "Achtel", grouping: [3, 3, 3, 3], difficulty: "Fortgeschritten", source: sources.hundred, learningGoals: ["Soul", "Latin-Färbung", "12/8"] }),
  groove("drum-steely-dan-aja", "Steely Dan — Aja · Fusion-Pocket", "Jazz", 116, {
    kick: { accent: [0, 6, 10, 16, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [3, 7, 11, 15, 19, 23, 27, 31] }, ride: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, difficulty: "Fortgeschritten", source: sources.hundred, learningGoals: ["Fusion", "Ghostnotes", "Dynamik"] }),
  groove("drum-brubeck-unsquare-dance", "Dave Brubeck Quartet — Unsquare Dance", "Jazz", 122, {
    kick: { accent: [0, 6, 10] }, snare: { accent: [4, 12] }, rim: { normal: [2, 8] }, closedHat: { normal: seq(0, 14, 2), accent: [0, 6, 10] },
  }, { meter: "7/8", grouping: [3, 2, 2], difficulty: "Fortgeschritten", source: sources.hundred, learningGoals: ["7/8", "Jazz", "Gruppierung"] }),

  groove("drum-bob-marley-get-up", "Bob Marley & The Wailers — Get Up, Stand Up", "Reggae", 78, {
    kick: { accent: [8] }, rim: { accent: [8] }, closedHat: { normal: eighths, accent: [0, 8] }, openHat: { normal: [6, 14] },
  }, { source: sources.reggae, swing: 54, kit: "Trocken", learningGoals: ["One Drop", "Reggae", "Raum"] }),
  groove("drum-fela-water-no-enemy", "Fela Kuti — Water No Get Enemy", "Latin & World", 105, {
    kick: { accent: [0, 7, 10, 16, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [3, 9, 15, 19, 25, 31] }, closedHat: { normal: repeated(seq(0, 16), 2), accent: [0, 6, 10, 16, 22, 26] }, openHat: { normal: [14, 30] },
  }, { bars: 2, difficulty: "Fortgeschritten", source: sources.afroLatin, swing: 53, learningGoals: ["Afrobeat", "Unabhängigkeit", "Zweitaktform"] }),
  groove("drum-paul-simon-obvious-child", "Paul Simon — The Obvious Child", "Latin & World", 104, {
    kick: { accent: [0, 3, 8, 11] }, snare: { accent: [4, 7, 12, 15], ghost: [2, 6, 10, 14] }, lowTom: { accent: [0, 6, 10] }, closedHat: { normal: seq(0, 16), accent: quarters },
  }, { meter: "2/4", bars: 2, difficulty: "Fortgeschritten", source: sources.afroLatin, learningGoals: ["Samba-Reggae", "Ensemble-Percussion", "Koordination"] }),
  groove("drum-tito-puente-oye-como-va", "Tito Puente — Oye Como Va", "Latin & World", 126, {
    kick: { normal: [0, 7, 8, 15] }, rim: { accent: [0, 3, 6, 10, 13] }, ride: { normal: eighths, accent: [0, 8] }, lowTom: { normal: [5, 12] },
  }, { bars: 1, difficulty: "Fortgeschritten", source: sources.afroLatin, learningGoals: ["Cha-Cha-Chá", "Clave", "Cáscara"] }),

  groove("drum-new-order-blue-monday", "New Order — Blue Monday", "Dance & Electronic", 130, {
    kick: { accent: [0, 3, 6, 8, 11, 14] }, snare: { accent: [4, 12] }, closedHat: { normal: eighths, accent: quarters }, openHat: { accent: [2, 6, 10, 14] },
  }, { source: sources.machines, kit: "808", learningGoals: ["Drum Machine", "New Wave", "Sequencing"] }),
  groove("drum-marvin-sexual-healing", "Marvin Gaye — Sexual Healing", "R&B & Gospel", 94, {
    kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12] }, rim: { normal: [3, 11] }, closedHat: { normal: eighths, accent: [0, 8] }, openHat: { normal: [14] },
  }, { source: sources.machines, kit: "808", swing: 54, learningGoals: ["808-Soul", "Minimalismus", "Pocket"] }),
  groove("drum-phil-collins-in-air", "Phil Collins — In the Air Tonight · CR-78-Puls", "Dance & Electronic", 95, {
    kick: { accent: [0, 10] }, rim: { accent: [4, 12] }, closedHat: { normal: [0, 3, 6, 8, 10, 14] }, highTom: { ghost: [7, 15] },
  }, { source: sources.machines, kit: "Elektronisch", learningGoals: ["Drum Machine", "Minimalismus", "Raum"] }),
  groove("drum-depeche-personal-jesus", "Depeche Mode — Personal Jesus", "Dance & Electronic", 130, {
    kick: { accent: [0, 3, 6, 8, 11, 14] }, snare: { accent: [4, 12] }, lowTom: { normal: [2, 10] }, closedHat: { normal: eighths, accent: quarters }, crash: { accent: [0] },
  }, { source: sources.hundred, kit: "Elektronisch", learningGoals: ["Industrial Pop", "Stomp", "Sequencing"] }),
  groove("drum-daft-punk-around-world", "Daft Punk — Around the World", "Dance & Electronic", 121, {
    kick: { accent: quarters }, snare: { accent: [4, 12] }, closedHat: { normal: quarters }, openHat: { accent: [2, 6, 10, 14] }, rim: { ghost: [3, 11] },
  }, { source: sources.hundred, kit: "Elektronisch", learningGoals: ["French House", "Four on the Floor", "Konstanz"] }),
  groove("drum-kraftwerk-robots", "Kraftwerk — The Robots", "Dance & Electronic", 111, {
    kick: { accent: [0, 8, 10] }, snare: { accent: [4, 12] }, rim: { normal: [2, 6, 14] }, closedHat: { normal: eighths, accent: [0, 8] },
  }, { source: sources.machines, kit: "808", learningGoals: ["Electro", "Maschinenpuls", "Minimalismus"] }),

  groove("drum-johnny-cash-folsom", "Johnny Cash — Folsom Prison Blues", "Country & Americana", 103, {
    kick: { accent: quarters }, snare: { accent: seq(1, 16, 2) }, closedHat: { normal: eighths, accent: quarters },
  }, { source: sources.charts, kit: "Trocken", learningGoals: ["Train Beat", "Country", "Ausdauer"] }),
  groove("drum-stones-honky-tonk", "The Rolling Stones — Honky Tonk Women", "Rock & Pop", 119, {
    kick: { accent: [0, 7, 10] }, snare: { accent: [4, 12], ghost: [15] }, closedHat: { normal: eighths, accent: [0, 8] }, lowTom: { normal: [14] },
  }, { source: sources.hundred, swing: 55, learningGoals: ["Loose Pocket", "Rock ’n’ Roll", "Behind the Beat"] }),
  groove("drum-billy-cobham-stratus", "Billy Cobham — Stratus", "Jazz", 90, {
    kick: { accent: [0, 3, 7, 10, 14, 16, 19, 23, 26, 30] }, snare: { accent: [4, 12, 20, 28], ghost: [6, 11, 15, 22, 27, 31] }, closedHat: { normal: repeated(eighths, 2), accent: [0, 8, 16, 24] }, openHat: { normal: [14, 30] },
  }, { bars: 2, difficulty: "Fortgeschritten", source: sources.breaks, learningGoals: ["Fusion-Funk", "Ghostnotes", "Zweitaktform"] }),
];

export { groove as artistGroove, sources as ARTIST_GROOVE_SOURCES };
