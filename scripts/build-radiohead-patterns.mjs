import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeMidiDrums, parseMidi } from "./analyze-midi-drums.mjs";

const input = resolve(process.argv[2] || "/tmp/radiohead-midi");
const output = new URL("../research/drum-patterns/generated/radiohead-grooves-v1.json", import.meta.url);
const source = {
  label: "RPPMF — Radiohead MIDI-Diskografie (133 Sequenzen)",
  url: "https://rppmf.com/radiohead.htm",
};
const albums = new Map([
  [1993, "Pablo Honey"], [1995, "The Bends"], [1997, "OK Computer"], [2000, "Kid A"],
  [2001, "Amnesiac"], [2003, "Hail to the Thief"], [2007, "In Rainbows"],
  [2011, "The King of Limbs"], [2016, "A Moon Shaped Pool"],
]);
const titleOverrides = new Map(Object.entries({
  "2+2=5": "2 + 2 = 5",
  "15_step": "15 Step",
  "(nice_dream)": "(Nice Dream)",
  "a_punchup_at_a_wedding": "A Punchup at a Wedding",
  "a_wolf_at_the_door": "A Wolf at the Door",
  "bullet_proof...i_wish_i_was": "Bullet Proof… I Wish I Was",
  "everything_in_its_right_place": "Everything in Its Right Place",
  "exit_music_(for_a_film)": "Exit Music (For a Film)",
  "how_to_disappear_completely": "How to Disappear Completely",
  "i_might_be_wrong": "I Might Be Wrong",
  "jigsaw_falling_into_place": "Jigsaw Falling into Place",
  "life_in_a_glass_house": "Life in a Glasshouse",
  "motion_picture_soundtrack": "Motion Picture Soundtrack",
  "my_iron_lung": "My Iron Lung",
  "no_surprises": "No Surprises",
  "packt_like_sardines_in_a_crushd_tin_box": "Packt Like Sardines in a Crushd Tin Box",
  "sit_down_stand_up": "Sit Down. Stand Up",
  "street_spirit_(fade_out)": "Street Spirit (Fade Out)",
  "the_national_anthem": "The National Anthem",
  "weird_fishes-arpegi": "Weird Fishes / Arpeggi",
  "where_i_end_and_you_begin": "Where I End and You Begin",
  "you_and_whose_army": "You and Whose Army?",
}));
const tempoOverrides = new Map(Object.entries({
  electioneering: 117,
  karma_police: 75,
  morning_bell: 71,
  we_suck_young_blood: 79,
  a_wolf_at_the_door: 69,
}));
const variantLimits = new Map(Object.entries({
  creep: 3, airbag: 3, paranoid_android: 4, exit_music_: 3, just: 3, my_iron_lung: 3,
  pyramid_song: 3, idioteque: 3, morning_bell: 3, "2+2=5": 4, sail_to_the_moon: 3,
  there_there: 3, "15_step": 3, reckoner: 3, videotape: 3, bloom: 3, decks_dark: 3,
  ful_stop: 3, identikit: 3,
}));

function slugFromFile(file) {
  const match = /^\d{2}-radiohead[_-](\d{4})-(.+)\.mid$/i.exec(file);
  if (!match || !albums.has(Number(match[1])) || /\(live\)/i.test(match[2])) return null;
  return { year: Number(match[1]), slug: match[2].replace(/-\[(?:k|intro)\]$/i, "") };
}

function displayTitle(slug) {
  if (titleOverrides.has(slug)) return titleOverrides.get(slug);
  const small = new Set(["a", "and", "at", "for", "in", "is", "of", "the", "to"]);
  return slug.replaceAll("_", " ").replace(/\b[\p{L}]+\b/gu, (word, offset) => {
    if (offset && small.has(word.toLowerCase())) return word.toLowerCase();
    return word.length === 1 ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
  });
}

function appId(slug, variant) {
  const base = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `drum-radiohead-${base}-${String.fromCharCode(97 + variant)}`;
}

function normalizedMeter(meter) {
  if (meter === "8/8") return "4/4";
  if (meter === "10/8") return "5/4";
  return meter;
}

function groupingFor(meter) {
  const [beats] = meter.split("/").map(Number);
  if (meter === "5/4") return [3, 2];
  if (meter === "6/4") return [3, 3];
  if (meter === "7/4") return [4, 3];
  if (meter === "7/8") return [3, 2, 2];
  if (meter === "9/8") return [3, 3, 3];
  if (meter === "12/8") return [3, 3, 3, 3];
  return Array(beats).fill(1);
}

function hitSet(pattern) {
  return new Set(pattern.hits.filter((hit) => hit.voice !== "crash").map((hit) => `${hit.voice}:${hit.step}`));
}

function distance(left, right) {
  if (normalizedMeter(left.meter) !== normalizedMeter(right.meter)) return 1;
  const a = hitSet(left);
  const b = hitSet(right);
  const union = new Set([...a, ...b]);
  const intersection = [...a].filter((hit) => b.has(hit)).length;
  return union.size ? 1 - intersection / union.size : 0;
}

function choosePatterns(analysis, limit) {
  const candidates = analysis.patterns.filter((pattern) => pattern.count >= 2 && pattern.hits.length >= 2 && pattern.meanError <= .25);
  if (!candidates.length) return [];
  const chosen = [candidates[0]];
  for (const meter of new Set(candidates.map((pattern) => normalizedMeter(pattern.meter)))) {
    if (chosen.length >= limit || chosen.some((pattern) => normalizedMeter(pattern.meter) === meter)) continue;
    const candidate = candidates.find((pattern) => normalizedMeter(pattern.meter) === meter);
    if (candidate) chosen.push(candidate);
  }
  for (const candidate of candidates) {
    if (chosen.length >= limit) break;
    if (!chosen.includes(candidate) && chosen.every((pattern) => distance(pattern, candidate) >= .08)) chosen.push(candidate);
  }
  return chosen;
}

function drumTracksFor(pattern, length) {
  const tracks = {};
  for (const hit of pattern.hits) {
    tracks[hit.voice] ||= Array(length).fill("mute");
    tracks[hit.voice][hit.step] = hit.state;
  }
  if (tracks.openHat && tracks.closedHat) {
    for (let step = 0; step < length; step++) {
      if (tracks.openHat[step] !== "mute") tracks.closedHat[step] = "mute";
    }
  }
  return tracks;
}

function mergeTracks(tracks, length) {
  return Array.from({ length }, (_, index) => {
    const states = Object.values(tracks).map((track) => track[index]);
    return states.includes("accent") ? "accent" : states.some((state) => state !== "mute") ? "normal" : "mute";
  });
}

function learningGoals(pattern, meter, album) {
  const goals = ["Radiohead", album];
  if (meter !== "4/4") goals.push("Ungerade Takte");
  if (pattern.hits.some((hit) => hit.state === "ghost")) goals.push("Ghostnotes");
  if (pattern.hits.some((hit) => ["highTom", "lowTom"].includes(hit.voice))) goals.push("Orchestrierung");
  if (pattern.hits.some((hit) => ["openHat", "ride"].includes(hit.voice))) goals.push("Beckenführung");
  return goals.slice(0, 4);
}

function difficultyFor(pattern, meter) {
  const [beats, denominator] = meter.split("/").map(Number);
  if (meter !== "4/4" || pattern.hits.length >= 20 || beats * 4 / denominator > 4) return "Fortgeschritten";
  return pattern.hits.length <= 12 ? "Leicht" : "Mittel";
}

const files = (await readdir(input)).filter((file) => /\.mid$/i.test(file)).sort();
const patterns = [];
const musicalSignatures = new Set();
const albumCoverage = Object.fromEntries([...albums.values()].map((album) => [album, { songs: new Set(), patterns: 0 }]));
for (const file of files) {
  const identity = slugFromFile(file);
  if (!identity) continue;
  let parsed;
  try {
    parsed = parseMidi(await readFile(resolve(input, file)));
  } catch {
    continue;
  }
  const analysis = analyzeMidiDrums(parsed);
  const title = displayTitle(identity.slug);
  const album = albums.get(identity.year);
  const limit = variantLimits.get(identity.slug) || (analysis.meters.length > 1 ? 3 : 2);
  const chosen = choosePatterns(analysis, limit);
  if (!chosen.length) continue;
  const bpm = tempoOverrides.get(identity.slug) || analysis.bpm || 100;
  const fallbackCandidates = analysis.patterns.filter((candidate) => candidate.count >= 2 && candidate.hits.length >= 2 && candidate.meanError <= .25 && !chosen.includes(candidate));
  let variant = 0;
  for (const candidate of [...chosen, ...fallbackCandidates]) {
    if (variant >= limit) break;
    const meter = normalizedMeter(candidate.meter);
    const [beats, denominator] = meter.split("/").map(Number);
    const length = beats * 4 / denominator * 4;
    if (!Number.isInteger(length)) continue;
    const drumTracks = drumTracksFor(candidate, length);
    const musicalSignature = JSON.stringify([meter, "16tel", 1, Object.entries(drumTracks).sort(([a], [b]) => a.localeCompare(b))]);
    if (musicalSignatures.has(musicalSignature)) continue;
    musicalSignatures.add(musicalSignature);
    const label = String.fromCharCode(65 + variant);
    const bars = candidate.bars.slice(0, 8);
    const barLabel = bars.length === 1 ? `${bars[0]}` : `${bars.slice(0, -1).join(", ")} und ${bars.at(-1)}`;
    patterns.push({
      id: appId(identity.slug, variant),
      name: `Radiohead — ${title} · Groove ${label}`,
      collection: "Radiohead",
      album,
      variant: label,
      sourceBars: bars,
      originFile: file,
      category: "Rock & Pop",
      patternType: "Groove",
      bpmMin: Math.max(35, Math.round(bpm * .65)),
      bpmMax: Math.min(260, Math.round(bpm * 1.35)),
      meter,
      subdivision: "16tel",
      bars: 1,
      grouping: groupingFor(meter),
      tempoUnit: denominator === 8 && groupingFor(meter).every((size) => size === 3) ? "dotted-quarter" : denominator === 8 ? "eighth" : "quarter",
      pattern: mergeTracks(drumTracks, length),
      drumTracks,
      difficulty: difficultyFor(candidate, meter),
      instruction: `Spiele Groove ${label} aus der MIDI-Transkription von „${title}“. Er erscheint wiederholt in den MIDI-Takten ${barLabel}; zuerst quantisiert, dann mit der Dynamik der notierten Akzente.`,
      drumOnly: true,
      attribution: "MIDI-basierte Übungsrekonstruktion (Radiohead)",
      learningGoals: learningGoals(candidate, meter, album),
      whyInteresting: `Diese wiederkehrende ${meter}-Variante bewahrt die eigenständige Kick-, Snare- und Beckenverzahnung aus „${title}“, statt sie auf einen Standard-Rockbeat zu reduzieren.`,
      playback: { bpm, swing: 50, kit: identity.year >= 2000 ? "Elektronisch" : "Studio" },
      source,
      transcription: { repetitions: candidate.count, meanQuantizationErrorSteps: Math.round(candidate.meanError * 1000) / 1000 },
    });
    albumCoverage[album].songs.add(title);
    albumCoverage[album].patterns++;
    variant++;
  }
}

const coverage = Object.fromEntries(Object.entries(albumCoverage).map(([album, data]) => [album, { songCount: data.songs.size, patternCount: data.patterns, songs: [...data.songs] }]));
const result = {
  schemaVersion: 1,
  catalogVersion: 1,
  updated: "2026-08-31",
  methodology: "Aus den Drumspuren der RPPMF-MIDI-Diskografie: wiederkehrende Takte, auf ein Sechzehntelraster quantisiert; Varianten nur bei abweichender Instrumentierung, Stimmeinsatzfolge oder Taktart.",
  source,
  albumCoverage: coverage,
  count: patterns.length,
  patterns,
};
await mkdir(new URL("../research/drum-patterns/generated/", import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Generated ${patterns.length} Radiohead grooves from ${Object.values(coverage).reduce((sum, album) => sum + album.songCount, 0)} songs.`);
