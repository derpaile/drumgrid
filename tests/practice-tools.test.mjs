import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import vm from "node:vm";

async function compile(file, dependencies = {}) {
  const code = ts.transpileModule(await readFile(new URL(`../app/${file}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  new Function("module", "exports", "require", code)(compiledModule, compiledModule.exports, name => {
    if (!dependencies[name]) throw new Error(`Unprovided dependency: ${name}`);
    return dependencies[name];
  });
  return compiledModule.exports;
}
const core = await compile("metronome-core");
const { countStep, loopBounds, nextLoopStep, setTrackHit, copyBar, shiftLane, groupPatterns, variantDifference } = await compile("practice-tools", { "./metronome-core": core });
const { measureLatency } = await compile("audio-calibration");
const { createLiveStore } = await compile("live-store");

test("counts straight, triplet, sextuplet and compound subdivisions musically", () => {
  const labels = (n, meter, division) => Array.from({ length: n }, (_, i) => countStep(i, meter, division).label);
  assert.deepEqual(labels(8, { beats: 4, denominator: 4 }, "16tel"), ["1", "e", "&", "a", "2", "e", "&", "a"]);
  assert.deepEqual(labels(6, { beats: 4, denominator: 4 }, "Triolen"), ["1", "tri", "ole", "2", "tri", "ole"]);
  assert.deepEqual(labels(6, { beats: 4, denominator: 4 }, "Sextolen"), ["1", "ta", "la", "&", "ta", "la"]);
  assert.deepEqual(labels(6, { beats: 6, denominator: 8 }, "Achtel"), ["1", "2", "3", "4", "5", "6"]);
});
test("Amen bars 3–4 loop without ever playing bars 1–2", () => {
  const bounds = loopBounds({ start: 3, end: 4 }, 16, 64);
  const heard = []; let step = bounds.start;
  for (let i = 0; i < 96; i++) { heard.push(step); step = nextLoopStep(step, bounds); }
  assert.deepEqual(heard.slice(0, 32), Array.from({ length: 32 }, (_, i) => i + 32));
  assert.equal(heard[32], 32); assert.equal(heard[95], 63);
  assert.deepEqual(loopBounds({ start: 7, end: 8 }, 16, 32), { start: 16, end: 32 });
});
test("bar copy and lane shift preserve originals and exclusive hats", () => {
  const tracks = { kick: ["accent", "mute", "normal", "mute"], openHat: ["normal", "mute", "mute", "mute"], closedHat: ["mute", "normal", "mute", "mute"] };
  assert.deepEqual(copyBar(tracks, 2, 1, 2).kick, ["accent", "mute", "accent", "mute"]);
  const moved = shiftLane(tracks, "openHat", 1);
  assert.equal(moved.openHat[1], "normal"); assert.equal(moved.closedHat[1], "mute");
  const edited = setTrackHit(tracks, 4, "closedHat", 0, "ghost");
  assert.equal(edited.openHat[0], "mute"); assert.equal(tracks.openHat[0], "normal");
});
test("Radiohead variants group into 86 songs without losing search matches", async () => {
  const { patterns } = JSON.parse(await readFile(new URL("../public/data/patterns-v1.json", import.meta.url), "utf8"));
  const grouped = groupPatterns(patterns);
  assert.equal(grouped.length, 375);
  assert.equal(grouped.filter(g => g.name.startsWith("Radiohead — ")).length, 86);
  assert.equal(grouped.reduce((n, g) => n + g.variants.length, 0), 491);
  const song = grouped.find(g => g.name === "Radiohead — 15 Step");
  assert.equal(song.variants.length, 3);
  assert.ok(variantDifference(song.variants[0], song.variants[1]).includes("snare"));
  assert.equal(groupPatterns([song.variants[1]])[0].variants[0].id, song.variants[1].id);
});
const scheduled = [1000, 1730, 2640, 3430, 4460, 5290, 6260, 7030];
test("latency calibration rejects noise and chooses first stable arrival over louder echoes", () => {
  const detections = scheduled.flatMap((time, i) => [{ timeMs: time + 100 + (i % 3 - 1), confidence: 3 }, { timeMs: time + 160 + (i % 2), confidence: 8 }]);
  detections.push({ timeMs: 1190, confidence: 5 }, { timeMs: 5555, confidence: 2 });
  const result = measureLatency(scheduled, detections);
  assert.ok(result); assert.ok(Math.abs(result.latencyMs - 100) <= 1); assert.equal(result.accepted, 8); assert.ok(result.spreadMs <= 1);
});
test("latency calibration refuses incomplete and unstable measurements", () => {
  assert.equal(measureLatency(scheduled, scheduled.slice(0, 4).map(t => ({ timeMs: t + 80 }))), null);
  assert.equal(measureLatency(scheduled, scheduled.map((t, i) => ({ timeMs: t + 30 + i * 35 }))), null);
  assert.equal(measureLatency(scheduled, scheduled.map(t => ({ timeMs: t + 80, confidence: .5 }))), null);
});
test("live display updates notify only subscribers and unsubscribe cleanly", () => {
  const store = createLiveStore(-1); let calls = 0;
  const off = store.subscribe(() => calls++);
  for (let i = 0; i < 5000; i++) store.set(i % 64);
  assert.equal(calls, 5000); off(); store.set(-1); assert.equal(calls, 5000);
});
test("worklet emits bounded-rate input levels and timestamps the initial attack", async () => {
  const messages = []; let Processor;
  const context = vm.createContext({ sampleRate: 48000, currentFrame: 0,
    AudioWorkletProcessor: class { port = { postMessage: m => messages.push(m) }; },
    registerProcessor: (_name, constructor) => { Processor = constructor; },
  });
  vm.runInContext(await readFile(new URL("../public/audio-onset-processor.js", import.meta.url), "utf8"), context);
  const detector = new Processor({ processorOptions: { config: { warmupMs: 0 } } });
  for (let block = 0; block < 50; block++) {
    context.currentFrame = block * 128;
    const data = new Float32Array(128);
    if (block === 20) for (let i = 10; i < 50; i++) data[i] = .8 * Math.exp(-(i - 10) / 10);
    detector.process([[data]]);
  }
  const onsets = messages.filter(m => m.type === "onset");
  assert.equal(onsets.length, 1);
  assert.ok(Math.abs(onsets[0].contextTime * 48000 - 2570) < 10);
  assert.ok(onsets[0].peakTime >= onsets[0].contextTime);
  assert.ok(messages.filter(m => m.type === "level").length >= 2);
});
