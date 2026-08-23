import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const FACTOR = { Viertel: 1, Achtel: 2, "16tel": 4, Triolen: 3, Sextolen: 6 };
const HIT_STATES = new Set(["mute", "ghost", "normal", "accent"]);
const SUMMARY_STATES = new Set(["mute", "normal", "accent"]);
const PATTERN_CATEGORIES = new Set([
  "Rock & Pop", "Punk & Metal", "Funk & Soul", "Hip-Hop", "Old School Hip-Hop", "Trip-Hop & Downtempo", "Dance & Electronic",
  "Reggae", "Latin & World", "Blues & Shuffle", "Genreübergreifend",
]);
const PATTERN_TYPES = new Set(["Groove", "Break", "Technik"]);
const DRUM_VOICES = new Set([
  "kick", "snare", "closedHat", "openHat", "ride", "crash", "rim", "highTom", "lowTom",
]);
const REMOVED_NON_DRUM_EXERCISES = new Set([
  "Gitarre: Akkordwechsel",
  "Gitarre: Strumming",
  "Bass: Pocket",
  "Bass: Walking",
  "Klavier: Gleichlauf",
  "Bläser: Atemphrasen",
  "Tonleitern in Vierteln",
  "Tonleitern in Triolen",
  "Alternate Picking Leiter",
  "Strumming-Matrix",
  "Akkordwechsel auf Und",
  "Chromatik-Fingerfolge",
]);

async function readLibrary() {
  return JSON.parse(await readFile(new URL("../public/data/patterns-v1.json", import.meta.url), "utf8"));
}

function indexedPatterns(library) {
  return new Map(library.patterns.map((pattern) => [pattern.id, pattern]));
}

function stateIndices(steps, state) {
  return steps.flatMap((value, index) => value === state ? [index] : []);
}

function audibleIndices(steps) {
  return steps.flatMap((value, index) => value === "mute" ? [] : [index]);
}

function mergeDrumTracks(drumTracks, length) {
  return Array.from({ length }, (_, index) => {
    const hits = Object.values(drumTracks).map((track) => track[index]);
    return hits.includes("accent") ? "accent" : hits.some((hit) => hit !== "mute") ? "normal" : "mute";
  });
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Klangmaß metronome product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /KLANGMASS/i);
  assert.match(html, />TAP</);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships a drum-only v2 library with 74 complete patterns", async () => {
  const library = await readLibrary();
  assert.equal(library.version, 2);
  assert.equal(library.count, 74);
  assert.equal(library.patterns.length, 74);
  const ids = new Set();
  const names = new Set();
  const musicalSignatures = new Set();
  for (const pattern of library.patterns) {
    for (const field of ["id", "name", "category", "patternType", "bpmMin", "bpmMax", "meter", "subdivision", "pattern", "drumTracks", "difficulty", "instruction", "drumOnly", "attribution", "learningGoals", "whyInteresting"]) {
      assert.ok(pattern[field] !== undefined, `${pattern.id} lacks ${field}`);
    }
    assert.match(pattern.id, /^drum-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(pattern.drumOnly, true, `${pattern.id} is not marked drum-only`);
    assert.ok(PATTERN_CATEGORIES.has(pattern.category), `${pattern.id} uses unknown category ${pattern.category}`);
    assert.ok(PATTERN_TYPES.has(pattern.patternType), `${pattern.id} uses unknown pattern type ${pattern.patternType}`);
    if (pattern.patternType === "Technik") assert.equal(pattern.category, "Genreübergreifend", `${pattern.id} assigns technique to a genre`);
    assert.ok(!REMOVED_NON_DRUM_EXERCISES.has(pattern.name), `${pattern.id} retained a non-drum exercise`);
    assert.ok(!ids.has(pattern.id), `duplicate id ${pattern.id}`);
    assert.ok(pattern.name.trim().length > 0, `${pattern.id} has an empty name`);
    assert.ok(!names.has(pattern.name), `duplicate name ${pattern.name}`);
    ids.add(pattern.id);
    names.add(pattern.name);
    assert.ok(pattern.attribution.trim().length > 0, `${pattern.id} lacks honest attribution`);
    assert.ok(Array.isArray(pattern.learningGoals) && pattern.learningGoals.length > 0, `${pattern.id} lacks learning goals`);
    assert.ok(pattern.whyInteresting.trim().length >= 30, `${pattern.id} lacks a useful rationale`);
    assert.doesNotMatch(pattern.name, /bill(?:ie|y) jean|back in black/i, `${pattern.id} claims a misleading song preset`);

    assert.ok(Number.isFinite(pattern.bpmMin), `${pattern.id} has invalid bpmMin`);
    assert.ok(Number.isFinite(pattern.bpmMax), `${pattern.id} has invalid bpmMax`);
    assert.ok(pattern.bpmMin >= 20 && pattern.bpmMax <= 300 && pattern.bpmMin <= pattern.bpmMax, `${pattern.id} has an invalid BPM range`);
    assert.ok(Array.isArray(pattern.pattern), `${pattern.id} pattern is not an array`);
    assert.ok(pattern.pattern.every((state) => SUMMARY_STATES.has(state)), `${pattern.id} has an invalid summary state`);

    const meterMatch = /^(\d+)\/(4|8|16)$/.exec(pattern.meter);
    assert.ok(meterMatch, `${pattern.id} has an invalid meter`);
    assert.ok(pattern.subdivision in FACTOR, `${pattern.id} has an invalid subdivision`);
    const numerator = Number(meterMatch[1]);
    const denominator = Number(meterMatch[2]);
    const bars = pattern.bars ?? 1;
    assert.ok(Number.isInteger(bars) && bars > 0, `${pattern.id} has invalid bars`);
    const expectedLength = bars * numerator * 4 / denominator * FACTOR[pattern.subdivision];
    assert.ok(Number.isInteger(expectedLength), `${pattern.id} produces a fractional step count`);
    assert.equal(pattern.pattern.length, expectedLength, `${pattern.id} has the wrong pattern length`);

    assert.ok(pattern.drumTracks && typeof pattern.drumTracks === "object" && !Array.isArray(pattern.drumTracks), `${pattern.id} has invalid drum tracks`);
    const trackEntries = Object.entries(pattern.drumTracks);
    assert.ok(trackEntries.length > 0, `${pattern.id} has no drum tracks`);
    for (const [voice, track] of trackEntries) {
      assert.ok(DRUM_VOICES.has(voice), `${pattern.id} uses unknown drum voice ${voice}`);
      assert.ok(Array.isArray(track), `${pattern.id} ${voice} is not an array`);
      assert.equal(track.length, pattern.pattern.length, `${pattern.id} ${voice} has the wrong length`);
      assert.ok(track.every((state) => HIT_STATES.has(state)), `${pattern.id} ${voice} has an invalid hit state`);
      assert.ok(track.some((state) => state !== "mute"), `${pattern.id} ${voice} contains no hit`);
    }
    const closedHat = pattern.drumTracks.closedHat;
    const openHat = pattern.drumTracks.openHat;
    if (closedHat && openHat) {
      for (let index = 0; index < pattern.pattern.length; index += 1) {
        assert.ok(closedHat[index] === "mute" || openHat[index] === "mute", `${pattern.id} has closed and open hi-hat together at step ${index}`);
      }
    }
    assert.deepEqual(pattern.pattern, mergeDrumTracks(pattern.drumTracks, pattern.pattern.length), `${pattern.id} summary does not match its drum tracks`);
    const signature = JSON.stringify([pattern.meter, pattern.subdivision, pattern.bars ?? 1, Object.entries(pattern.drumTracks).sort(([a], [b]) => a.localeCompare(b))]);
    assert.ok(!musicalSignatures.has(signature), `${pattern.id} duplicates another preset exactly`);
    musicalSignatures.add(signature);

    if (pattern.grouping !== undefined) {
      assert.ok(Array.isArray(pattern.grouping) && pattern.grouping.length > 0, `${pattern.id} has invalid grouping`);
      assert.ok(pattern.grouping.every((group) => Number.isInteger(group) && group > 0), `${pattern.id} has invalid grouping values`);
      assert.equal(pattern.grouping.reduce((sum, group) => sum + group, 0), numerator, `${pattern.id} grouping does not fill the meter`);
    }

    if (pattern.playback !== undefined) {
      const { bpm, swing, timerMinutes, trainer } = pattern.playback;
      if (bpm !== undefined) assert.ok(Number.isFinite(bpm) && bpm >= pattern.bpmMin && bpm <= pattern.bpmMax, `${pattern.id} has invalid playback BPM`);
      if (swing !== undefined) assert.ok(Number.isFinite(swing) && swing >= 50 && swing <= 75, `${pattern.id} has invalid swing`);
      if (timerMinutes !== undefined) assert.ok(Number.isInteger(timerMinutes) && timerMinutes > 0, `${pattern.id} has invalid timer`);
      if (trainer !== undefined) {
        assert.ok(["up", "pyramid"].includes(trainer.mode), `${pattern.id} has invalid trainer mode`);
        assert.ok(Number.isFinite(trainer.step) && trainer.step > 0, `${pattern.id} has invalid trainer step`);
        assert.ok(Number.isInteger(trainer.every) && trainer.every > 0, `${pattern.id} has invalid trainer interval`);
        assert.ok(Number.isFinite(trainer.min) && Number.isFinite(trainer.max) && trainer.min <= trainer.max, `${pattern.id} has invalid trainer bounds`);
      }
    }
    if (pattern.originalFeel !== undefined) {
      assert.ok(pattern.originalFeel.label?.trim(), `${pattern.id} has no original-feel label`);
      assert.ok(pattern.originalFeel.note?.trim(), `${pattern.id} has no original-feel note`);
      assert.ok(pattern.originalFeel.sourceBpm > 0, `${pattern.id} has invalid original-feel BPM`);
      for (const [field, range] of [["timingMs", [-250, 250]], ["velocityMultipliers", [.05, 2]]]) {
        for (const [voice, values] of Object.entries(pattern.originalFeel[field] || {})) {
          assert.ok(DRUM_VOICES.has(voice), `${pattern.id} has unknown original-feel voice ${voice}`);
          for (const [rawIndex, value] of Object.entries(values)) {
            const index = Number(rawIndex);
            assert.ok(Number.isInteger(index) && index >= 0 && index < expectedLength, `${pattern.id} ${field} index ${rawIndex} is outside the grid`);
            assert.ok(Number.isFinite(value) && value >= range[0] && value <= range[1], `${pattern.id} ${field} value is invalid`);
          }
        }
      }
    }
  }
});

test("includes the researched trip-hop and Queensbridge collection", async () => {
  const patterns = indexedPatterns(await readLibrary());
  const expected = new Map([
    ["drum-portishead-glory-box", 60], ["drum-portishead-sour-times", 94],
    ["drum-massive-attack-teardrop", 77], ["drum-massive-attack-angel", 107],
    ["drum-nas-ny-state", 84], ["drum-nas-world-is-yours", 87],
    ["drum-mobb-deep-shook-ones", 94], ["drum-mobb-deep-survival", 95],
    ["drum-kd-high-noon", 101], ["drum-kd-bedroom-rockers", 86],
  ]);
  for (const [id, bpm] of expected) {
    const pattern = patterns.get(id);
    assert.ok(pattern, `missing researched pattern ${id}`);
    assert.equal(pattern.playback?.bpm, bpm, `${id} has the wrong reference tempo`);
    assert.ok(pattern.source?.url, `${id} lacks its research source`);
    assert.match(pattern.attribution, /reduktion|rekonstruktion/i, `${id} overstates its transcription accuracy`);
  }
  assert.equal(patterns.get("drum-portishead-sour-times").bars, 4);
  assert.equal(patterns.get("drum-massive-attack-teardrop").bars, 4);
  assert.ok(patterns.get("drum-massive-attack-teardrop").learningGoals.includes("Double Time"));
  assert.equal(patterns.get("drum-kd-high-noon").bars, 1);
  assert.equal(patterns.get("drum-kd-high-noon").originalFeel?.sourceBpm, 100.9);
});

test("includes the second researched trip-hop and old-school collection", async () => {
  const patterns = indexedPatterns(await readLibrary());
  const expected = new Map([
    ["drum-dj-shadow-building-steam", 82], ["drum-dj-shadow-midnight", 80],
    ["drum-tricky-hell-corner", 60], ["drum-massive-attack-safe-harm", 82],
    ["drum-morcheeba-the-sea", 75], ["drum-sneaker-pimps-six-underground", 84],
    ["drum-run-dmc-sucker-mcs", 109], ["drum-planet-rock", 127],
    ["drum-beastie-paul-revere", 92], ["drum-gang-starr-mass-appeal", 96],
    ["drum-atcq-check-rhime", 96], ["drum-wutang-cream", 90],
  ]);
  for (const [id, bpm] of expected) {
    const pattern = patterns.get(id);
    assert.ok(pattern, `missing second researched pattern ${id}`);
    assert.equal(pattern.playback?.bpm, bpm, `${id} has the wrong reference tempo`);
    assert.ok(pattern.source?.url, `${id} lacks its research source`);
    assert.match(pattern.attribution, /reduktion|rekonstruktion/i, `${id} overstates its transcription accuracy`);
  }
  assert.equal(patterns.get("drum-sneaker-pimps-six-underground").bars, 4);
  assert.equal(patterns.get("drum-run-dmc-sucker-mcs").category, "Old School Hip-Hop");
  assert.equal(patterns.get("drum-planet-rock").playback?.kit, "808");
});

test("keeps the signature drum exercises musically consistent", async () => {
  const patterns = indexedPatterns(await readLibrary());
  const get = (id) => {
    const pattern = patterns.get(id);
    assert.ok(pattern, `missing pattern ${id}`);
    return pattern;
  };
  const amen = get("drum-amen");
  assert.equal(amen.meter, "4/4");
  assert.equal(amen.subdivision, "16tel");
  assert.equal(amen.bars, 4);
  assert.equal(amen.pattern.length, 64);
  for (const voice of ["kick", "snare", "ride"]) {
    assert.ok(amen.drumTracks[voice], `Amen Break lacks ${voice}`);
    assert.ok(audibleIndices(amen.drumTracks[voice]).length > 0, `Amen Break has no audible ${voice}`);
  }

  const funkyDrummer = get("drum-funky-drummer");
  assert.ok(stateIndices(funkyDrummer.drumTracks.snare, "ghost").length > 0, "Funky Drummer needs snare ghostnotes");
  assert.equal(funkyDrummer.bars, 2);
  assert.equal(funkyDrummer.playback?.swing, 50);
  assert.ok(funkyDrummer.originalFeel?.timingMs, "Funky Drummer needs its MIDI feel layer");

  const think = get("drum-think-break");
  assert.deepEqual(audibleIndices(think.drumTracks.kick), [0]);
  assert.deepEqual(stateIndices(think.drumTracks.snare, "ghost"), [7, 9, 10]);

  const impeach = get("drum-impeach");
  assert.deepEqual(audibleIndices(impeach.drumTracks.kick), [0, 7, 8, 10, 14]);
  assert.equal(impeach.originalFeel?.timingMs?.kick?.[7], 52);

  const purdie = get("drum-purdie-shuffle");
  assert.equal(purdie.meter, "12/8");
  assert.equal(purdie.subdivision, "Achtel");
  assert.equal(purdie.bars, 1);
  assert.equal(purdie.pattern.length, 12);
  assert.deepEqual(purdie.grouping, [3, 3, 3, 3]);
  assert.deepEqual(audibleIndices(purdie.drumTracks.closedHat), [0, 2, 3, 5, 6, 8, 9, 11]);

  const rosanna = get("drum-rosanna");
  assert.equal(rosanna.meter, "12/8");
  assert.equal(rosanna.subdivision, "Achtel");
  assert.equal(rosanna.bars, 2);
  assert.equal(rosanna.pattern.length, 24);
  assert.deepEqual(rosanna.grouping, [3, 3, 3, 3]);
  assert.deepEqual(audibleIndices(rosanna.drumTracks.closedHat), [0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 20, 21, 23]);

  const oneDrop = get("drum-one-drop");
  assert.deepEqual(audibleIndices(oneDrop.drumTracks.kick), [8]);
  assert.deepEqual(audibleIndices(oneDrop.drumTracks.rim), [8]);

  const tempoPyramid = get("drum-tempo-pyramid");
  assert.equal(tempoPyramid.playback?.trainer?.mode, "pyramid");
  assert.equal(tempoPyramid.playback?.trainer?.min, 60);
  assert.equal(tempoPyramid.playback?.trainer?.max, 180);
});

test("keeps the generated library synchronized with its source", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/generate-patterns.mjs", import.meta.url)), "--check"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join("\n"));
});

test("ties the pause symbol to a running audio engine and recovers page lifecycle changes", async () => {
  const source = await readFile(new URL("../app/metronome-app.tsx", import.meta.url), "utf8");
  assert.match(source, /type PlaybackPhase = "stopped" \| "starting" \| "running" \| "lifecycle-paused" \| "recovering"/);
  assert.match(source, /if \(generationRef\.current !== token \|\| audioRef\.current !== context\) return;\s+if \(context\.state !== "running" \|\| schedulerRef\.current === null\) \{\s+recoverEngine\(\);/);
  assert.match(source, /const isPlaying = phase === "running"/);
  for (const event of ["visibilitychange", "pagehide", "pageshow", "focus"]) assert.match(source, new RegExp(`addEventListener\\("${event}"`));
  assert.match(source, /nextTimeRef\.current < context\.currentTime - \.1/);
  assert.match(source, /scheduledSourcesRef\.current\.forEach/);
  assert.match(source, /withAudioTimeout\(context\.resume\(\), 2500\)/);
  assert.match(source, /checkpointRef\.current = checkpoint/);
  assert.doesNotMatch(source, /setIsPlaying/);
});

test("includes complete PWA assets", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);
  assert.match(serviceWorker, /patterns-v1\.json/);
  assert.match(serviceWorker, /caches\.open/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.match(serviceWorker, /PRECACHE_URLS/);
  assert.match(serviceWorker, /klangmass-/);
  assert.doesNotMatch(serviceWorker, /keys\.filter\(\(key\) => key !==/);
});
