import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../app/audio-feedback.ts", import.meta.url), "utf8");
const standaloneSource = source.replace(
  /^import .*? from "\.\/metronome-core";$/m,
  'const DRUM_VOICES = ["kick", "snare", "closedHat", "openHat", "ride", "crash", "rim", "highTom", "lowTom"];',
);
const compiled = ts.transpileModule(standaloneSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const feedbackModule = { exports: {} };
new Function("module", "exports", compiled)(feedbackModule, feedbackModule.exports);

const {
  addDetectedTransient,
  addExpectedAudioHit,
  analyzeAudioFeedback,
  createAudioFeedbackSession,
  createExpectedAudioHits,
  snapshotAudioFeedback,
} = feedbackModule.exports;

const expected = (id, timeMs, stepIndex = 0, voices = ["kick"]) => ({
  id, timeMs, stepIndex, sequenceStepIndex: stepIndex, cycleIndex: 0, voices,
  states: Object.fromEntries(voices.map((voice) => [voice, "normal"])),
});

test("groups simultaneous drum voices into one audio target", () => {
  const hits = createExpectedAudioHits({
    drumTracks: { kick: ["normal", "mute"], snare: ["accent", "mute"], closedHat: ["normal", "normal"] },
    startTimeMs: 1000,
    stepDurationMs: 250,
  });
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0].voices, ["kick", "snare", "closedHat"]);
});

test("subtracts measured round-trip latency before timing classification", () => {
  const result = analyzeAudioFeedback([expected("one", 1500)], [{ timeMs: 1630 }], { latencyCompensationMs: 100 });
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].offsetMs, 30);
  assert.equal(result.matched[0].classification, "late");
});

test("incremental matching uses each target once and keeps extras", () => {
  const session = createAudioFeedbackSession({ latencyCompensationMs: 100 });
  addExpectedAudioHit(session, expected("one", 1000));
  assert.equal(addDetectedTransient(session, { id: "hit", timeMs: 1108 }).kind, "matched");
  assert.equal(addDetectedTransient(session, { id: "extra", timeMs: 1120 }).kind, "extra");
  const result = snapshotAudioFeedback(session);
  assert.equal(result.matched[0].offsetMs, 8);
  assert.equal(result.extra.length, 1);
});

test("reports robust session timing and missed hits", () => {
  const result = analyzeAudioFeedback(
    [expected("one", 1000), expected("two", 2000, 1), expected("three", 3000, 2)],
    [{ timeMs: 1010 }, { timeMs: 1980 }, { timeMs: 4000 }],
  );
  assert.equal(result.overall.medianMs, -5);
  assert.equal(result.overall.meanAbsoluteMs, 15);
  assert.equal(result.overall.spreadMs, 15);
  assert.ok(Math.abs(result.overall.hitRate - 66.6667) < .001);
  assert.equal(result.missed.length, 1);
  assert.equal(result.extra.length, 1);
});
