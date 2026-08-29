import { DRUM_VOICES, type DrumHitState, type DrumTracks, type DrumVoice, type StepState } from "./metronome-core";

export const DEFAULT_MATCH_WINDOW_MS = 120;
export const DEFAULT_ON_TIME_WINDOW_MS = 25;

export type TimingClassification = "early" | "on-time" | "late";
export type ActiveDrumHitState = Exclude<DrumHitState, "mute">;

/** One audible target onset. Simultaneous drum voices share a target. */
export type ExpectedAudioHit = {
  id: string;
  timeMs: number;
  stepIndex: number;
  sequenceStepIndex: number;
  cycleIndex: number;
  voices: readonly DrumVoice[];
  states: Partial<Record<DrumVoice, ActiveDrumHitState>>;
};

export type DetectedTransient = {
  id?: string;
  timeMs: number;
  strength?: number;
};

export type MatchedAudioHit = {
  expected: ExpectedAudioHit;
  transient: DetectedTransient;
  correctedTimeMs: number;
  offsetMs: number;
  classification: TimingClassification;
};

export type MissedAudioHit = { expected: ExpectedAudioHit };
export type ExtraAudioHit = {
  transient: DetectedTransient;
  correctedTimeMs: number;
};

export type AudioFeedbackMetrics = {
  /** Signed median: negative is early, positive is late. */
  medianMs: number;
  meanAbsoluteMs: number;
  /** Median absolute deviation from median. */
  spreadMs: number;
  /** Percentage in the inclusive range 0..100. */
  hitRate: number;
  expectedHits: number;
  matchedHits: number;
  missedHits: number;
};

export type AudioFeedbackAnalysis = {
  matched: MatchedAudioHit[];
  missed: MissedAudioHit[];
  extra: ExtraAudioHit[];
  pending: ExpectedAudioHit[];
  overall: AudioFeedbackMetrics;
  byVoice: Partial<Record<DrumVoice, AudioFeedbackMetrics>>;
};

export type CreateExpectedAudioHitsOptions = {
  drumTracks?: DrumTracks | null;
  steps?: readonly StepState[];
  startTimeMs: number;
  stepDurationMs: number;
  /** Number of pattern repetitions. */
  cycles?: number;
  /** Overrides the pattern length inferred from tracks and steps. */
  stepCount?: number;
  /** Optional micro-timing offsets, repeated for every cycle. */
  stepOffsetsMs?: readonly number[];
  includeGhosts?: boolean;
  idPrefix?: string;
};

export type AnalyzeAudioFeedbackOptions = {
  matchWindowMs?: number;
  onTimeWindowMs?: number;
  /** Positive values remove known capture/output delay from transient times. */
  latencyCompensationMs?: number;
  /** When set, later unmatched targets stay pending instead of becoming missed. */
  evaluationTimeMs?: number;
};

export type AudioFeedbackSessionOptions = Omit<AnalyzeAudioFeedbackOptions, "evaluationTimeMs">;

export type AudioFeedbackSessionConfig = {
  matchWindowMs: number;
  onTimeWindowMs: number;
  latencyCompensationMs: number;
};

export type AudioFeedbackSession = {
  readonly config: Readonly<AudioFeedbackSessionConfig>;
  readonly matched: MatchedAudioHit[];
  readonly missed: MissedAudioHit[];
  readonly extra: ExtraAudioHit[];
  /** Sorted by target time. */
  readonly pending: ExpectedAudioHit[];
};

export type AudioFeedbackMetricSnapshot = Pick<AudioFeedbackAnalysis, "overall" | "byVoice">;

export type AddDetectedTransientResult =
  | { kind: "matched"; match: MatchedAudioHit }
  | { kind: "extra"; extra: ExtraAudioHit };

type AudioFeedbackSessionInternal = {
  expectedIds: Set<string>;
  transientIds: Set<string>;
  latestCorrectedTimeMs: number;
};

const sessionInternals = new WeakMap<AudioFeedbackSession, AudioFeedbackSessionInternal>();

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

function requireFinite(name: string, value: number): void {
  if (!isFiniteNumber(value)) throw new RangeError(`${name} must be finite.`);
}

function requireNonNegative(name: string, value: number): void {
  requireFinite(name, value);
  if (value < 0) throw new RangeError(`${name} must be non-negative.`);
}

function requirePositiveInteger(name: string, value: number): void {
  requireFinite(name, value);
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer.`);
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function lowerBoundByTime(hits: readonly ExpectedAudioHit[], timeMs: number): number {
  let low = 0;
  let high = hits.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (hits[middle]!.timeMs < timeMs) low = middle + 1;
    else high = middle;
  }
  return low;
}

function requireSession(session: AudioFeedbackSession): AudioFeedbackSessionInternal {
  const internal = sessionInternals.get(session);
  if (!internal) throw new TypeError("Session must be created with createAudioFeedbackSession().");
  return internal;
}

function normalizedSessionConfig(options: AudioFeedbackSessionOptions): AudioFeedbackSessionConfig {
  const matchWindowMs = options.matchWindowMs ?? DEFAULT_MATCH_WINDOW_MS;
  const onTimeWindowMs = options.onTimeWindowMs ?? DEFAULT_ON_TIME_WINDOW_MS;
  const latencyCompensationMs = options.latencyCompensationMs ?? 0;
  requireNonNegative("matchWindowMs", matchWindowMs);
  requireNonNegative("onTimeWindowMs", onTimeWindowMs);
  requireFinite("latencyCompensationMs", latencyCompensationMs);
  if (onTimeWindowMs > matchWindowMs) throw new RangeError("onTimeWindowMs must not exceed matchWindowMs.");
  return { matchWindowMs, onTimeWindowMs, latencyCompensationMs };
}

function activeState(state: DrumHitState | undefined, includeGhosts: boolean): ActiveDrumHitState | null {
  if (!state || state === "mute" || (!includeGhosts && state === "ghost")) return null;
  return state;
}

/** Builds a repeating onset timeline from voice tracks, or from merged steps as a rim fallback. */
export function createExpectedAudioHits(options: CreateExpectedAudioHitsOptions): ExpectedAudioHit[] {
  requireFinite("startTimeMs", options.startTimeMs);
  requireFinite("stepDurationMs", options.stepDurationMs);
  if (options.stepDurationMs <= 0) throw new RangeError("stepDurationMs must be positive.");

  const cycles = options.cycles ?? 1;
  requirePositiveInteger("cycles", cycles);
  if (options.stepCount !== undefined) requirePositiveInteger("stepCount", options.stepCount);

  const trackVoices = DRUM_VOICES.filter((voice) => (options.drumTracks?.[voice]?.length ?? 0) > 0);
  const inferredStepCount = Math.max(
    options.steps?.length ?? 0,
    ...trackVoices.map((voice) => options.drumTracks?.[voice]?.length ?? 0),
  );
  const stepCount = options.stepCount ?? inferredStepCount;
  if (stepCount === 0) return [];

  const includeGhosts = options.includeGhosts ?? true;
  const useTracks = trackVoices.length > 0;
  const prefix = options.idPrefix || "target";
  const hits: ExpectedAudioHit[] = [];

  for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex += 1) {
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      const states: Partial<Record<DrumVoice, ActiveDrumHitState>> = {};
      const voices: DrumVoice[] = [];

      if (useTracks) {
        for (const voice of trackVoices) {
          const state = activeState(options.drumTracks?.[voice]?.[stepIndex], includeGhosts);
          if (!state) continue;
          voices.push(voice);
          states[voice] = state;
        }
      } else {
        const state = activeState(options.steps?.[stepIndex], includeGhosts);
        if (state) {
          voices.push("rim");
          states.rim = state;
        }
      }

      if (!voices.length) continue;
      const sequenceStepIndex = cycleIndex * stepCount + stepIndex;
      const offsetMs = options.stepOffsetsMs?.[stepIndex] ?? 0;
      requireFinite(`stepOffsetsMs[${stepIndex}]`, offsetMs);
      hits.push({
        id: `${prefix}-${cycleIndex}-${stepIndex}`,
        timeMs: options.startTimeMs + sequenceStepIndex * options.stepDurationMs + offsetMs,
        stepIndex,
        sequenceStepIndex,
        cycleIndex,
        voices,
        states,
      });
    }
  }

  return hits.sort((left, right) => left.timeMs - right.timeMs || left.sequenceStepIndex - right.sequenceStepIndex);
}

export function classifyTimingOffset(offsetMs: number, onTimeWindowMs = DEFAULT_ON_TIME_WINDOW_MS): TimingClassification {
  requireFinite("offsetMs", offsetMs);
  requireNonNegative("onTimeWindowMs", onTimeWindowMs);
  if (offsetMs < -onTimeWindowMs) return "early";
  if (offsetMs > onTimeWindowMs) return "late";
  return "on-time";
}

export function calculateAudioFeedbackMetrics(
  matched: readonly MatchedAudioHit[],
  missed: readonly MissedAudioHit[],
): AudioFeedbackMetrics {
  const offsets = matched.map((item) => item.offsetMs);
  const medianMs = median(offsets);
  const expectedHits = matched.length + missed.length;
  return {
    medianMs,
    meanAbsoluteMs: offsets.length
      ? offsets.reduce((total, value) => total + Math.abs(value), 0) / offsets.length
      : 0,
    spreadMs: median(offsets.map((value) => Math.abs(value - medianMs))),
    hitRate: expectedHits ? matched.length / expectedHits * 100 : 0,
    expectedHits,
    matchedHits: matched.length,
    missedHits: missed.length,
  };
}

function calculateMetricsByVoice(
  matched: readonly MatchedAudioHit[],
  missed: readonly MissedAudioHit[],
): Partial<Record<DrumVoice, AudioFeedbackMetrics>> {
  const byVoice: Partial<Record<DrumVoice, AudioFeedbackMetrics>> = {};
  for (const voice of DRUM_VOICES) {
    const voiceMatched = matched.filter((item) => item.expected.voices.includes(voice));
    const voiceMissed = missed.filter((item) => item.expected.voices.includes(voice));
    if (voiceMatched.length || voiceMissed.length) {
      byVoice[voice] = calculateAudioFeedbackMetrics(voiceMatched, voiceMissed);
    }
  }
  return byVoice;
}

/** Creates an incremental live-analysis session without starting audio or timers. */
export function createAudioFeedbackSession(options: AudioFeedbackSessionOptions = {}): AudioFeedbackSession {
  const session: AudioFeedbackSession = {
    config: Object.freeze(normalizedSessionConfig(options)),
    matched: [],
    missed: [],
    extra: [],
    pending: [],
  };
  sessionInternals.set(session, {
    expectedIds: new Set(),
    transientIds: new Set(),
    latestCorrectedTimeMs: Number.NEGATIVE_INFINITY,
  });
  return session;
}

/** Adds one scheduler target. Chronological scheduler inserts append in O(1). */
export function addExpectedAudioHit(session: AudioFeedbackSession, hit: ExpectedAudioHit): ExpectedAudioHit {
  const internal = requireSession(session);
  requireFinite("hit.timeMs", hit.timeMs);
  if (internal.expectedIds.has(hit.id)) throw new RangeError(`Duplicate expected hit id: ${hit.id}`);
  internal.expectedIds.add(hit.id);

  if (hit.timeMs + session.config.matchWindowMs < internal.latestCorrectedTimeMs) {
    session.missed.push({ expected: hit });
    return hit;
  }

  const last = session.pending.at(-1);
  if (!last || last.timeMs <= hit.timeMs) session.pending.push(hit);
  else session.pending.splice(lowerBoundByTime(session.pending, hit.timeMs), 0, hit);
  return hit;
}

/**
 * Moves targets whose matching window has closed to missed. currentTimeMs uses the
 * same raw clock as transient timestamps; configured latency is removed here too.
 */
export function expirePendingHits(session: AudioFeedbackSession, currentTimeMs: number): MissedAudioHit[] {
  const internal = requireSession(session);
  requireFinite("currentTimeMs", currentTimeMs);
  const correctedTimeMs = currentTimeMs - session.config.latencyCompensationMs;
  if (correctedTimeMs < internal.latestCorrectedTimeMs) {
    throw new RangeError("Session timestamps must be monotonic.");
  }
  internal.latestCorrectedTimeMs = correctedTimeMs;

  // Keep the inclusive -matchWindow boundary available for a transient at this exact time.
  const expiredCount = lowerBoundByTime(session.pending, correctedTimeMs - session.config.matchWindowMs);
  if (!expiredCount) return [];
  const expired = session.pending.splice(0, expiredCount).map((expected) => ({ expected }));
  session.missed.push(...expired);
  return expired;
}

/** Matches one live transient to the nearest pending target, without replaying session history. */
export function addDetectedTransient(
  session: AudioFeedbackSession,
  transient: DetectedTransient,
): AddDetectedTransientResult {
  const internal = requireSession(session);
  requireFinite("transient.timeMs", transient.timeMs);
  if (transient.id && internal.transientIds.has(transient.id)) {
    throw new RangeError(`Duplicate transient id: ${transient.id}`);
  }
  if (transient.id) internal.transientIds.add(transient.id);

  const correctedTimeMs = transient.timeMs - session.config.latencyCompensationMs;
  if (correctedTimeMs < internal.latestCorrectedTimeMs) {
    throw new RangeError("Session transient timestamps must be monotonic.");
  }
  expirePendingHits(session, transient.timeMs);

  const insertionIndex = lowerBoundByTime(session.pending, correctedTimeMs);
  const earlierIndex = insertionIndex - 1;
  const laterIndex = insertionIndex < session.pending.length ? insertionIndex : -1;
  const earlierDistance = earlierIndex >= 0
    ? correctedTimeMs - session.pending[earlierIndex]!.timeMs
    : Number.POSITIVE_INFINITY;
  const laterDistance = laterIndex >= 0
    ? session.pending[laterIndex]!.timeMs - correctedTimeMs
    : Number.POSITIVE_INFINITY;
  // An exact tie belongs to the earlier target, matching the batch analyzer.
  const nearestIndex = earlierDistance <= laterDistance ? earlierIndex : laterIndex;
  const nearestDistance = Math.min(earlierDistance, laterDistance);

  if (nearestIndex < 0 || nearestDistance > session.config.matchWindowMs) {
    const extra = { transient, correctedTimeMs };
    session.extra.push(extra);
    return { kind: "extra", extra };
  }

  const expected = session.pending.splice(nearestIndex, 1)[0]!;
  const offsetMs = correctedTimeMs - expected.timeMs;
  const match: MatchedAudioHit = {
    expected,
    transient,
    correctedTimeMs,
    offsetMs,
    classification: classifyTimingOffset(offsetMs, session.config.onTimeWindowMs),
  };
  session.matched.push(match);
  return { kind: "matched", match };
}

export function getAudioFeedbackSessionMetrics(session: AudioFeedbackSession): AudioFeedbackMetricSnapshot {
  requireSession(session);
  return {
    overall: calculateAudioFeedbackMetrics(session.matched, session.missed),
    byVoice: calculateMetricsByVoice(session.matched, session.missed),
  };
}

/** Returns detached arrays suitable for React state, persistence, or a session recap. */
export function snapshotAudioFeedbackSession(session: AudioFeedbackSession): AudioFeedbackAnalysis {
  requireSession(session);
  const matched = [...session.matched].sort((left, right) => left.expected.timeMs - right.expected.timeMs);
  const missed = [...session.missed].sort((left, right) => left.expected.timeMs - right.expected.timeMs);
  return {
    matched,
    missed,
    extra: [...session.extra],
    pending: [...session.pending],
    overall: calculateAudioFeedbackMetrics(matched, missed),
    byVoice: calculateMetricsByVoice(matched, missed),
  };
}

/** Short alias for UI call sites. */
export const snapshotAudioFeedback = snapshotAudioFeedbackSession;

/**
 * Greedily assigns each transient, in time order, to its nearest still-free target.
 * Passing evaluationTimeMs keeps targets whose matching window is still open pending.
 */
export function analyzeAudioFeedback(
  expectedHits: readonly ExpectedAudioHit[],
  transients: readonly DetectedTransient[],
  options: AnalyzeAudioFeedbackOptions = {},
): AudioFeedbackAnalysis {
  const matchWindowMs = options.matchWindowMs ?? DEFAULT_MATCH_WINDOW_MS;
  const onTimeWindowMs = options.onTimeWindowMs ?? DEFAULT_ON_TIME_WINDOW_MS;
  const latencyCompensationMs = options.latencyCompensationMs ?? 0;
  requireNonNegative("matchWindowMs", matchWindowMs);
  requireNonNegative("onTimeWindowMs", onTimeWindowMs);
  requireFinite("latencyCompensationMs", latencyCompensationMs);
  if (onTimeWindowMs > matchWindowMs) throw new RangeError("onTimeWindowMs must not exceed matchWindowMs.");
  if (options.evaluationTimeMs !== undefined) requireFinite("evaluationTimeMs", options.evaluationTimeMs);

  expectedHits.forEach((hit, index) => requireFinite(`expectedHits[${index}].timeMs`, hit.timeMs));
  transients.forEach((transient, index) => requireFinite(`transients[${index}].timeMs`, transient.timeMs));

  const available = new Set(expectedHits.map((_, index) => index));
  const orderedTransients = transients
    .map((transient, index) => ({ transient, index, correctedTimeMs: transient.timeMs - latencyCompensationMs }))
    .sort((left, right) => left.correctedTimeMs - right.correctedTimeMs || left.index - right.index);
  const matched: MatchedAudioHit[] = [];
  const extra: ExtraAudioHit[] = [];

  for (const item of orderedTransients) {
    let nearestIndex: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const expectedIndex of available) {
      const expected = expectedHits[expectedIndex]!;
      const distance = Math.abs(item.correctedTimeMs - expected.timeMs);
      if (distance > matchWindowMs) continue;
      const nearest = nearestIndex === null ? null : expectedHits[nearestIndex]!;
      if (
        distance < nearestDistance
        || (distance === nearestDistance && nearest !== null && expected.timeMs < nearest.timeMs)
        || (distance === nearestDistance && nearest !== null && expected.timeMs === nearest.timeMs && expectedIndex < nearestIndex!)
      ) {
        nearestIndex = expectedIndex;
        nearestDistance = distance;
      }
    }

    if (nearestIndex === null) {
      extra.push({ transient: item.transient, correctedTimeMs: item.correctedTimeMs });
      continue;
    }

    available.delete(nearestIndex);
    const expected = expectedHits[nearestIndex]!;
    const offsetMs = item.correctedTimeMs - expected.timeMs;
    matched.push({
      expected,
      transient: item.transient,
      correctedTimeMs: item.correctedTimeMs,
      offsetMs,
      classification: classifyTimingOffset(offsetMs, onTimeWindowMs),
    });
  }

  const missed: MissedAudioHit[] = [];
  const pending: ExpectedAudioHit[] = [];
  for (const expectedIndex of available) {
    const expected = expectedHits[expectedIndex]!;
    if (
      options.evaluationTimeMs !== undefined
      && options.evaluationTimeMs < expected.timeMs + matchWindowMs
    ) pending.push(expected);
    else missed.push({ expected });
  }

  matched.sort((left, right) => left.expected.timeMs - right.expected.timeMs);
  missed.sort((left, right) => left.expected.timeMs - right.expected.timeMs);
  pending.sort((left, right) => left.timeMs - right.timeMs);

  return {
    matched,
    missed,
    extra,
    pending,
    overall: calculateAudioFeedbackMetrics(matched, missed),
    byVoice: calculateMetricsByVoice(matched, missed),
  };
}
