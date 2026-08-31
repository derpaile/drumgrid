"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cloneDrumTracks, cycleDrumHit, cycleStep, defaultDrumTracks, defaultGrouping, defaultTempoUnit,
  DRUM_LABELS, DRUM_VOICES, FALLBACK_PATTERNS, firstValidSubdivision, hasExactGrid, HIT_LABELS,
  learningGoalsFor, mergeDrumTracks, normalizedDrumTracks, normalizedSteps, parseMeter, stepsPerBar,
  PATTERN_CATEGORIES, PATTERN_TYPE_INFO, PATTERN_TYPES, SUBDIVISIONS,
  type DrumHitState, type DrumKit, type DrumTracks, type DrumVoice, type Meter, type Pattern,
  type OriginalFeel, type PatternType, type PracticeEntry, type StepState, type Subdivision, type TempoUnit, type TrainerMode,
} from "./metronome-core";
import {
  DRUM_KIT_OPTIONS, drumHitLevel, drumKitLabel, drumKitOfflinePaths, drumPlaybackRate, drumSampleFor, normalizeDrumKit, primeDrumKit,
  type DrumSampleCache,
} from "./drum-synthesis";
import { clearLocalData, deleteStore, readStore, writeStore } from "./local-store";
import {
  type AudioFeedbackAnalysis, type AudioFeedbackSession, type ExpectedAudioHit,
  addDetectedTransient, addExpectedAudioHit, createAudioFeedbackSession, expirePendingHits, snapshotAudioFeedback,
} from "./audio-feedback";
import {
  APP_VERSION, createScene, dailyRecommendations, DATA_SCHEMA_VERSION, isVoiceAudible, ladderFor,
  matchesLearningFilters, migrateLegacyPractice, migrateLegacyPresets, nextStepFor, practiceModeLabel,
  SKILLS, skillLabelsFor,
  type LastSessionSnapshot, type LibraryFilters, type PracticeModeConfig, type PracticeResult, type Scene, type TimingResult,
} from "./practice-model";

type PlaybackPhase = "stopped" | "starting" | "running" | "lifecycle-paused" | "recovering";
type SessionCheckpoint = { nextStep: number; bars: number; bpm: number; trainerDirection: 1 | -1 };
type AppSection = "trainer" | "library" | "mine";
type SessionKind = "free" | "timing" | "groove" | "speed";
type PwaStatus = "checking" | "ready" | "offline" | "update" | "error";
type FeelMode = "quantized" | "original";
type OfflineStatus = { appReady: boolean; availableKits: number; totalKits: number; totalAudioBytes: number; buildRevision?: string };
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type MidiInputLike = { onmidimessage: ((event: { data: Uint8Array }) => void) | null };
type MidiAccessLike = { inputs: Map<string, MidiInputLike>; onstatechange: (() => void) | null };
type AudioFeedbackStatus = "idle" | "requesting" | "ready" | "listening" | "denied" | "unsupported" | "error";
type LatencySource = "estimated" | "calibrated" | "manual";
type AudioFeedbackConfig = { latencyMs: number; latencySource: LatencySource; deviceId?: string };
type AudioInputOption = { deviceId: string; label: string };
type OnsetWorkletMessage = { type?: string; contextTime?: number; strength?: number; confidence?: number };
type AudioSessionType = "playback" | "play-and-record";
type AudioSessionNavigator = Navigator & { audioSession?: { type: AudioSessionType | "auto" } };
type LibraryFilterKey = keyof LibraryFilters | "category" | "patternType";
type QuickFilterId = "easy" | "timing" | "pocket" | "break" | "technique" | "continue";
type MobileNavIconName = "practice" | "library" | "mine" | "play" | "stop";

type WakeLockHandle = { release: () => Promise<void> };
type OpenHatHandle = { source: AudioBufferSourceNode; gain: GainNode; level: number; endAt: number };

const VISIBLE_FFT_BINS = 100;
const DEFAULT_VOICE_VOLUMES: Record<DrumVoice, number> = {
  kick: 100, snare: 100, closedHat: 100, openHat: 100, ride: 100,
  crash: 100, rim: 100, highTom: 100, lowTom: 100,
};
const EMPTY_LIBRARY_FILTERS: LibraryFilters = {
  difficulty: "Alle", skillId: "Alle", meter: "Alle", subdivision: "Alle", feel: false,
  length: "Alle", kit: "Alle", tempo: null, unpracticed: false, difficult: false,
};
const STYLE_FAMILIES = [
  { id: "rock-heavy", label: "Rock & Heavy", categories: ["Rock & Pop", "Punk & Metal", "Progressive & Heavy"] },
  { id: "funk-soul", label: "Funk, Soul & R&B", categories: ["Funk & Soul", "R&B & Gospel"] },
  { id: "hiphop-down", label: "Hip-Hop & Downtempo", categories: ["Hip-Hop", "Old School Hip-Hop", "Trip-Hop & Downtempo"] },
  { id: "electronic", label: "Electronic & Breakbeat", categories: ["Dance & Electronic", "Jungle & Drum and Bass"] },
  { id: "jazz-roots", label: "Jazz, Blues & Americana", categories: ["Jazz", "Blues & Shuffle", "Country & Americana"] },
  { id: "global", label: "Latin, Reggae & World", categories: ["Latin & World", "Reggae"] },
  { id: "cross", label: "Querbeet", categories: ["Genreübergreifend"] },
] as const;
const QUICK_FILTERS: Array<{ id: QuickFilterId; label: string; description: string }> = [
  { id: "easy", label: "Einfach starten", description: "Leichte Patterns" },
  { id: "timing", label: "Timing", description: "Puls festigen" },
  { id: "pocket", label: "Pocket", description: "Groove vertiefen" },
  { id: "break", label: "Drum-Break-Klassiker", description: "Bekannte Ausschnitte" },
  { id: "technique", label: "Technik", description: "Bewegungen isolieren" },
  { id: "continue", label: "Weiterüben", description: "Zuletzt schwierig" },
];

const familySelection = (id: string) => `family:${id}`;
const styleFamilyFor = (selection: string) => selection.startsWith("family:")
  ? STYLE_FAMILIES.find((family) => family.id === selection.slice(7))
  : undefined;
const styleSelectionLabel = (selection: string) => selection === "Alle" ? "Alle Stile" : styleFamilyFor(selection)?.label || selection;
const matchesStyleSelection = (pattern: Pattern, selection: string) => selection === "Alle"
  || (styleFamilyFor(selection)?.categories as readonly string[] | undefined)?.includes(pattern.category)
  || pattern.category === selection;
const matchesSearchQuery = (pattern: Pattern, query: string) => !query || `${pattern.name} ${pattern.category} ${pattern.patternType || "Groove"} ${pattern.instruction} ${learningGoalsFor(pattern).join(" ")}`.toLocaleLowerCase("de").includes(query);

function MobileNavIcon({ name }: { name: MobileNavIconName }) {
  const paths: Record<MobileNavIconName, React.ReactNode> = {
    practice: <><path d="M8.5 20h7M9.5 20l1.2-13h2.6l1.2 13M10.4 10h3.2" /><path d="m12 13 3.2-2.2" /></>,
    library: <><path d="M5 6h14M5 12h14M5 18h14" /><path d="M7.5 4.5v3M12 10.5v3M16.5 16.5v3" /></>,
    mine: <><path d="M4.5 7.5h6l1.6 2H19.5v9h-15z" /><path d="M8 14h8M8 17h5" /></>,
    play: <path d="m9 7 8 5-8 5z" fill="currentColor" stroke="none" />,
    stop: <rect x="8" y="8" width="8" height="8" rx=".5" fill="currentColor" stroke="none" />,
  };
  return <svg className="mobile-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter">{paths[name]}</svg>;
}

function setAudioSessionType(type: AudioSessionType) {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (!session) return;
  try { session.type = type; } catch { /* Unsupported or restricted WebKit implementation. */ }
}

function VoiceLaneLabel({
  voice, volume, onVolumeChange, onClear,
}: {
  voice: DrumVoice;
  volume: number;
  onVolumeChange: (voice: DrumVoice, value: number) => void;
  onClear?: () => void;
}) {
  return <span className="drum-lane-label voice-lane-label">
    <span>{DRUM_LABELS[voice]}</span>
    {onClear && <button onClick={onClear} aria-label={`${DRUM_LABELS[voice]} leeren`}>×</button>}
    <input className="voice-volume-input" type="range" min="0" max="100" step="5" value={volume} title={`${volume}%`} onChange={(event) => onVolumeChange(voice, Number(event.target.value))} aria-label={`${DRUM_LABELS[voice]} Lautstärke`} />
  </span>;
}

function FftSpectrum({ analyserRef, active }: { analyserRef: { current: AnalyserNode | null }; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelsRef = useRef(new Float32Array(VISIBLE_FFT_BINS));
  const peaksRef = useRef(new Float32Array(VISIBLE_FFT_BINS));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const graphics = canvas.getContext("2d");
    if (!graphics) return;
    const analyser = analyserRef.current;
    const frequencyData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let frame = 0;

    const draw = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const backingWidth = Math.round(width * pixelRatio);
      const backingHeight = Math.round(height * pixelRatio);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      graphics.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      graphics.clearRect(0, 0, width, height);
      graphics.fillStyle = "#010401";
      graphics.fillRect(0, 0, width, height);

      if (active && analyser && frequencyData) analyser.getByteFrequencyData(frequencyData);
      const levels = levelsRef.current;
      const peaks = peaksRef.current;
      const gap = 1;
      const barWidth = Math.max(1, (width - gap * (VISIBLE_FFT_BINS - 1)) / VISIBLE_FFT_BINS);
      const plotHeight = Math.max(1, height - 8);
      const binHz = analyser ? analyser.context.sampleRate / analyser.fftSize : 1;
      const minHz = 35;
      const maxHz = analyser ? Math.min(18_000, analyser.context.sampleRate / 2) : 18_000;
      const frequencyRange = maxHz / minHz;
      let highestLevel = 0;

      for (let index = 0; index < VISIBLE_FFT_BINS; index += 1) {
        let target = 0;
        if (active && analyser && frequencyData) {
          const lowHz = minHz * Math.pow(frequencyRange, index / VISIBLE_FFT_BINS);
          const highHz = minHz * Math.pow(frequencyRange, (index + 1) / VISIBLE_FFT_BINS);
          const start = Math.min(frequencyData.length - 1, Math.max(0, Math.floor(lowHz / binHz)));
          const end = Math.min(frequencyData.length, Math.max(start + 1, Math.ceil(highHz / binHz)));
          let strongest = 0;
          for (let bin = start; bin < end; bin += 1) strongest = Math.max(strongest, frequencyData[bin]);
          target = Math.pow(strongest / 255, 1.25);
        }

        const previous = levels[index];
        const level = target > previous ? previous + (target - previous) * .82 : previous * .84;
        levels[index] = level;
        peaks[index] = Math.max(level, peaks[index] - .018);
        highestLevel = Math.max(highestLevel, level, peaks[index]);

        const x = index * (barWidth + gap);
        const barHeight = Math.max(2, level * plotHeight);
        for (let y = 0; y < barHeight; y += 4) {
          const position = y / plotHeight;
          graphics.fillStyle = position > .88 ? "#ff665d" : position > .7 ? "#e0c36a" : "#30f22a";
          graphics.globalAlpha = level > .01 ? .92 : .18;
          graphics.fillRect(x, height - 3 - y, barWidth, Math.min(2, barHeight - y));
        }
        if (peaks[index] > .035) {
          graphics.globalAlpha = .85;
          graphics.fillStyle = "#d8f58a";
          graphics.fillRect(x, Math.max(1, height - 4 - peaks[index] * plotHeight), barWidth, 1);
        }
      }
      graphics.globalAlpha = 1;

      if (active || highestLevel > .01) frame = window.requestAnimationFrame(draw);
    };

    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [active, analyserRef]);

  return <canvas ref={canvasRef} className="spectrum" aria-hidden="true" data-visible-bins={VISIBLE_FFT_BINS} />;
}

type TimingVoiceGroup = { label: string; voices: readonly DrumVoice[] };

const TIMING_VOICE_GROUPS: readonly TimingVoiceGroup[] = [
  { label: "KICK", voices: ["kick"] },
  { label: "SNARE / RIM", voices: ["snare", "rim"] },
  { label: "HI-HAT", voices: ["closedHat", "openHat"] },
  { label: "BECKEN", voices: ["ride", "crash"] },
  { label: "TOMS", voices: ["highTom", "lowTom"] },
];
const TIMING_BAR_WIDTH = 148;
const TIMING_LANE_HEIGHT = 26;
const TIMING_HEADER_HEIGHT = 30;
const TIMING_LABEL_WIDTH = 74;

const clampTiming = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const medianTiming = (values: readonly number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

function TimingDiagnostics({
  analysis, barSteps, stepDurationMs, drumTracks, steps,
}: {
  analysis: AudioFeedbackAnalysis | null;
  barSteps: number;
  stepDurationMs: number;
  drumTracks: DrumTracks | null;
  steps: readonly StepState[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visibleBars, setVisibleBars] = useState<8 | 16>(8);
  const safeBarSteps = Math.max(1, barSteps);
  const safeStepDuration = Math.max(1, stepDurationMs);

  const voiceGroups = useMemo(() => {
    const isActive = (voice: DrumVoice) => drumTracks
      ? !!drumTracks[voice]?.some((state) => state !== "mute")
      : voice === "rim" && steps.some((state) => state !== "mute");
    const active = TIMING_VOICE_GROUPS.filter((group) => group.voices.some(isActive));
    return active.length ? active : [TIMING_VOICE_GROUPS[1]!];
  }, [drumTracks, steps]);

  const timeline = useMemo(() => {
    let anchor: ExpectedAudioHit | undefined;
    for (const candidate of [
      analysis?.matched.at(-1)?.expected,
      analysis?.missed.at(-1)?.expected,
      analysis?.pending.at(-1),
    ]) {
      if (candidate && (!anchor || candidate.timeMs > anchor.timeMs)) anchor = candidate;
    }
    const latestBar = anchor ? Math.floor(anchor.sequenceStepIndex / safeBarSteps) : 0;
    const startBar = Math.max(0, latestBar - visibleBars + 1);
    const endBar = startBar + visibleBars - 1;
    const matched: AudioFeedbackAnalysis["matched"] = [];
    const missed: AudioFeedbackAnalysis["missed"] = [];

    for (let index = (analysis?.matched.length || 0) - 1; index >= 0; index -= 1) {
      const item = analysis!.matched[index]!;
      const bar = Math.floor(item.expected.sequenceStepIndex / safeBarSteps);
      if (bar < startBar) break;
      if (bar <= endBar) matched.push(item);
    }
    for (let index = (analysis?.missed.length || 0) - 1; index >= 0; index -= 1) {
      const item = analysis!.missed[index]!;
      const bar = Math.floor(item.expected.sequenceStepIndex / safeBarSteps);
      if (bar < startBar) break;
      if (bar <= endBar) missed.push(item);
    }

    const extras: Array<{ globalStep: number; strength: number }> = [];
    if (anchor) {
      const minimumStep = startBar * safeBarSteps - .5;
      const maximumStep = (endBar + 1) * safeBarSteps + .5;
      for (let index = (analysis?.extra.length || 0) - 1; index >= 0 && extras.length < 256; index -= 1) {
        const item = analysis!.extra[index]!;
        const globalStep = anchor.sequenceStepIndex + (item.correctedTimeMs - anchor.timeMs) / safeStepDuration;
        if (globalStep < minimumStep) break;
        if (globalStep <= maximumStep) extras.push({ globalStep, strength: Math.max(0, item.transient.strength || 0) });
      }
    }

    const barStats = new Map<number, { offsets: number[]; matched: number; missed: number }>();
    for (let bar = startBar; bar <= endBar; bar += 1) barStats.set(bar, { offsets: [], matched: 0, missed: 0 });
    for (const item of matched) {
      const stats = barStats.get(Math.floor(item.expected.sequenceStepIndex / safeBarSteps));
      if (stats) { stats.matched += 1; stats.offsets.push(item.offsetMs); }
    }
    for (const item of missed) {
      const stats = barStats.get(Math.floor(item.expected.sequenceStepIndex / safeBarSteps));
      if (stats) stats.missed += 1;
    }

    const strongest = Math.max(1,
      ...matched.map((item) => Math.max(0, item.transient.strength || 0)),
      ...extras.map((item) => item.strength),
    );
    return { startBar, endBar, latestBar, matched, missed, extras, barStats, strongest };
  }, [analysis, safeBarSteps, safeStepDuration, visibleBars]);

  const plotWidth = visibleBars * TIMING_BAR_WIDTH;
  const plotHeight = TIMING_HEADER_HEIGHT + voiceGroups.length * TIMING_LANE_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = window.requestAnimationFrame(() => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(plotWidth * ratio);
      canvas.height = Math.round(plotHeight * ratio);
      const graphics = canvas.getContext("2d", { alpha: false });
      if (!graphics) return;
      graphics.setTransform(ratio, 0, 0, ratio, 0, 0);
      graphics.fillStyle = "#010401";
      graphics.fillRect(0, 0, plotWidth, plotHeight);
      const stepWidth = TIMING_BAR_WIDTH / safeBarSteps;
      const patternLength = Math.max(1, steps.length);
      const xForGlobalStep = (globalStep: number) => (globalStep - timeline.startBar * safeBarSteps + .5) * stepWidth;
      const classificationColor = (classification: "early" | "on-time" | "late") => classification === "early" ? "#72a8ff" : classification === "late" ? "#ff9c55" : "#30f22a";

      graphics.font = '9px "SFMono-Regular", "Courier New", monospace';
      graphics.textBaseline = "middle";
      for (let barOffset = 0; barOffset < visibleBars; barOffset += 1) {
        const barIndex = timeline.startBar + barOffset;
        const barX = barOffset * TIMING_BAR_WIDTH;
        graphics.fillStyle = barOffset % 2 ? "#020703" : "#030904";
        graphics.fillRect(barX, 0, TIMING_BAR_WIDTH, plotHeight);
        graphics.fillStyle = "#071108";
        graphics.fillRect(barX, 0, TIMING_BAR_WIDTH, TIMING_HEADER_HEIGHT);
        graphics.strokeStyle = "#47714b";
        graphics.lineWidth = 1;
        graphics.beginPath(); graphics.moveTo(barX + .5, 0); graphics.lineTo(barX + .5, plotHeight); graphics.stroke();

        for (let step = 1; step < safeBarSteps; step += 1) {
          const x = barX + step * stepWidth + .5;
          graphics.strokeStyle = step % Math.max(1, safeBarSteps / 4) === 0 ? "rgba(72,110,76,.42)" : "rgba(72,110,76,.18)";
          graphics.beginPath(); graphics.moveTo(x, TIMING_HEADER_HEIGHT); graphics.lineTo(x, plotHeight); graphics.stroke();
        }

        const stats = timeline.barStats.get(barIndex)!;
        const resolved = stats.matched + stats.missed;
        const median = medianTiming(stats.offsets);
        graphics.fillStyle = barIndex === timeline.latestBar ? "#30f22a" : "#86bd89";
        graphics.fillText(`TAKT ${barIndex + 1}`, barX + 6, 10);
        graphics.fillStyle = "#567a59";
        graphics.fillText(resolved ? `${stats.matched}/${resolved} · ${median > 0 ? "+" : ""}${Math.round(median)} ms` : "noch offen", barX + 6, 22);

        for (let row = 0; row <= voiceGroups.length; row += 1) {
          const y = TIMING_HEADER_HEIGHT + row * TIMING_LANE_HEIGHT + .5;
          graphics.strokeStyle = "rgba(57,91,61,.35)";
          graphics.beginPath(); graphics.moveTo(barX, y); graphics.lineTo(barX + TIMING_BAR_WIDTH, y); graphics.stroke();
        }
      }

      for (const extra of timeline.extras) {
        const x = xForGlobalStep(extra.globalStep);
        if (x < 0 || x > plotWidth) continue;
        const level = Math.sqrt(clampTiming(extra.strength / timeline.strongest, 0, 1));
        graphics.save();
        graphics.globalAlpha = .42 + level * .4;
        graphics.strokeStyle = "#e0c36a";
        graphics.lineWidth = 1 + level * 2;
        graphics.setLineDash([3, 3]);
        graphics.beginPath(); graphics.moveTo(x, TIMING_HEADER_HEIGHT + 2); graphics.lineTo(x, plotHeight - 2); graphics.stroke();
        graphics.restore();
      }

      for (const match of timeline.matched) {
        const targetGlobal = match.expected.sequenceStepIndex;
        const actualGlobal = targetGlobal + match.offsetMs / safeStepDuration;
        const targetX = xForGlobalStep(targetGlobal);
        const actualX = xForGlobalStep(actualGlobal);
        if (actualX < 0 || actualX > plotWidth) continue;
        const color = classificationColor(match.classification);
        const level = Math.sqrt(clampTiming((match.transient.strength || 0) / timeline.strongest, 0, 1));

        graphics.save();
        graphics.globalAlpha = .35 + level * .5;
        graphics.strokeStyle = color;
        graphics.lineWidth = 1 + level * 2.4;
        graphics.beginPath(); graphics.moveTo(actualX, TIMING_HEADER_HEIGHT + 2); graphics.lineTo(actualX, plotHeight - 2); graphics.stroke();
        graphics.fillStyle = color;
        graphics.beginPath(); graphics.moveTo(actualX - 4, TIMING_HEADER_HEIGHT + 2); graphics.lineTo(actualX + 4, TIMING_HEADER_HEIGHT + 2); graphics.lineTo(actualX, TIMING_HEADER_HEIGHT + 8); graphics.closePath(); graphics.fill();
        graphics.restore();

        voiceGroups.forEach((group, row) => {
          if (!group.voices.some((voice) => match.expected.voices.includes(voice))) return;
          const y = TIMING_HEADER_HEIGHT + row * TIMING_LANE_HEIGHT + TIMING_LANE_HEIGHT / 2;
          graphics.strokeStyle = color;
          graphics.lineWidth = 1;
          graphics.beginPath(); graphics.moveTo(targetX, y); graphics.lineTo(actualX, y); graphics.stroke();
          graphics.fillStyle = color;
          graphics.beginPath(); graphics.arc(actualX, y, 3, 0, Math.PI * 2); graphics.fill();
        });
      }

      for (let barOffset = 0; barOffset < visibleBars; barOffset += 1) {
        const barIndex = timeline.startBar + barOffset;
        for (let step = 0; step < safeBarSteps; step += 1) {
          const patternIndex = ((barIndex * safeBarSteps + step) % patternLength + patternLength) % patternLength;
          const x = barOffset * TIMING_BAR_WIDTH + (step + .5) * stepWidth;
          voiceGroups.forEach((group, row) => {
            const states = group.voices.map((voice) => drumTracks?.[voice]?.[patternIndex] || (!drumTracks && voice === "rim" ? steps[patternIndex] : "mute"));
            const state: DrumHitState = states.includes("accent") ? "accent" : states.includes("normal") ? "normal" : states.includes("ghost") ? "ghost" : "mute";
            if (state === "mute") return;
            const y = TIMING_HEADER_HEIGHT + row * TIMING_LANE_HEIGHT + TIMING_LANE_HEIGHT / 2;
            if (state === "ghost") {
              graphics.strokeStyle = "#e0c36a"; graphics.lineWidth = 1;
              graphics.strokeRect(x - 2.5, y - 2.5, 5, 5);
            } else {
              const size = state === "accent" ? 8 : 6;
              graphics.fillStyle = state === "accent" ? "#b7ffac" : "#4ca950";
              graphics.fillRect(x - size / 2, y - size / 2, size, size);
            }
          });
        }
      }

      for (const miss of timeline.missed) {
        const x = xForGlobalStep(miss.expected.sequenceStepIndex);
        voiceGroups.forEach((group, row) => {
          if (!group.voices.some((voice) => miss.expected.voices.includes(voice))) return;
          const y = TIMING_HEADER_HEIGHT + row * TIMING_LANE_HEIGHT + TIMING_LANE_HEIGHT / 2;
          graphics.strokeStyle = "#ff665d"; graphics.lineWidth = 2;
          graphics.beginPath(); graphics.moveTo(x - 4, y - 4); graphics.lineTo(x + 4, y + 4); graphics.moveTo(x + 4, y - 4); graphics.lineTo(x - 4, y + 4); graphics.stroke();
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [drumTracks, plotHeight, plotWidth, safeBarSteps, safeStepDuration, steps, timeline, visibleBars, voiceGroups]);

  const metrics = analysis?.overall;
  const measurementCount = (analysis?.matched.length || 0) + (analysis?.missed.length || 0) + (analysis?.extra.length || 0);
  return <section className="timing-film" aria-label="Timing-Timeline mit Drum-Hits und erkannten Transienten">
    <div className="timing-film-head">
      <div><small>TAKT-TIMELINE</small><strong>Drum-Hits + Transienten</strong></div>
      <div className="timing-film-summary">
        <span><b>{metrics?.matchedHits ? `${Math.round(metrics.medianMs)} ms` : "—"}</b>Versatz</span>
        <span><b>{metrics?.expectedHits ? `${Math.round(metrics.hitRate)}%` : "—"}</b>Erkannt</span>
        <div className="timing-window-switch" aria-label="Anzahl sichtbarer Takte">
          {([8, 16] as const).map((count) => <button key={count} className={visibleBars === count ? "active" : ""} aria-pressed={visibleBars === count} onClick={() => setVisibleBars(count)}>{count} Takte</button>)}
        </div>
      </div>
    </div>
    <div className="timing-film-legend" aria-label="Legende"><span><i className="drum" />Drum-Hit</span><span><i className="on-time" />Transiente passend</span><span><i className="early" />früh</span><span><i className="late" />spät</span><span><i className="extra" />zusätzlich</span><span><i className="missed">×</i>verpasst</span></div>
    <div className="timing-film-scroll">
      <div className="timing-film-stage" style={{ width: `${TIMING_LABEL_WIDTH + plotWidth}px`, height: `${plotHeight}px` }}>
        <div className="timing-film-labels" style={{ width: `${TIMING_LABEL_WIDTH}px`, height: `${plotHeight}px`, gridTemplateRows: `${TIMING_HEADER_HEIGHT}px repeat(${voiceGroups.length}, ${TIMING_LANE_HEIGHT}px)` }}>
          <b>TAKT</b>{voiceGroups.map((group) => <span key={group.label}>{group.label}</span>)}
        </div>
        <canvas ref={canvasRef} className="timing-film-canvas" style={{ left: `${TIMING_LABEL_WIDTH}px`, width: `${plotWidth}px`, height: `${plotHeight}px` }} aria-label={`${visibleBars} Takte; ${measurementCount} ausgewertete Transienten`} />
      </div>
    </div>
    <div className="timing-film-foot"><span>Quadrat = Sollschlag · Linie/Punkt = erkannte Transiente</span><span>{measurementCount ? `letzte Takte ${timeline.startBar + 1}–${timeline.endBar + 1}` : "Starten und mit Kopfhörern spielen"}</span></div>
  </section>;
}

const MemoizedTimingDiagnostics = memo(TimingDiagnostics);

const withAudioTimeout = <T,>(promise: Promise<T>, milliseconds = 2500): Promise<T> => new Promise((resolve, reject) => {
  const timer = window.setTimeout(() => reject(new Error("Audio transition timed out")), milliseconds);
  promise.then((value) => {
    window.clearTimeout(timer);
    resolve(value);
  }, (error) => {
    window.clearTimeout(timer);
    reject(error);
  });
});

function estimateAudioRoundTripLatencyMs(context: AudioContext, stream: MediaStream): number {
  const inputSettings = stream.getAudioTracks()[0]?.getSettings() as (MediaTrackSettings & { latency?: number }) | undefined;
  const inputLatency = Number(inputSettings?.latency) || 0;
  const outputLatency = Number((context as AudioContext & { outputLatency?: number }).outputLatency) || 0;
  return Math.max(0, Math.min(600, Math.round((inputLatency + context.baseLatency + outputLatency) * 1000)));
}

export default function MetronomeApp() {
  const [bpm, setBpm] = useState(92);
  const [phase, setPhase] = useState<PlaybackPhase>("stopped");
  const [meter, setMeterState] = useState<Meter>({ beats: 4, denominator: 4 });
  const [subdivision, setSubdivisionState] = useState<Subdivision>("Achtel");
  const [steps, setStepsState] = useState<StepState[]>([...FALLBACK_PATTERNS[0].pattern]);
  const [drumTracks, setDrumTracks] = useState<DrumTracks | null>(() => normalizedDrumTracks(FALLBACK_PATTERNS[0].drumTracks, 8));
  const [grouping, setGrouping] = useState<number[]>([1, 1, 1, 1]);
  const [tempoUnit, setTempoUnit] = useState<TempoUnit>("quarter");
  const [patternId, setPatternId] = useState(FALLBACK_PATTERNS[0].id);
  const [patternName, setPatternName] = useState("Rock-Backbeat");
  const [patternInstruction, setPatternInstruction] = useState(FALLBACK_PATTERNS[0].instruction);
  const [patternAttribution, setPatternAttribution] = useState(FALLBACK_PATTERNS[0].attribution || "Genreübung");
  const [patternGoals, setPatternGoals] = useState<string[]>(learningGoalsFor(FALLBACK_PATTERNS[0]));
  const [originalFeel, setOriginalFeel] = useState<OriginalFeel | null>(FALLBACK_PATTERNS[0].originalFeel || null);
  const [feelMode, setFeelMode] = useState<FeelMode>("quantized");
  const [currentStep, setCurrentStep] = useState(-1);
  const [sessionBars, setSessionBars] = useState(0);
  const [sessionKind, setSessionKind] = useState<SessionKind>("free");
  const [section, setSection] = useState<AppSection>("trainer");
  const [volume, setVolume] = useState(72);
  const [voiceVolumes, setVoiceVolumes] = useState<Record<DrumVoice, number>>(() => ({ ...DEFAULT_VOICE_VOLUMES }));
  const [sound, setSound] = useState<DrumKit>("707");
  const [swing, setSwing] = useState(50);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [repeatBars, setRepeatBars] = useState(0);
  const [sessionExtrasOpen, setSessionExtrasOpen] = useState(false);
  const [timerText, setTimerText] = useState("∞");
  const [trainer, setTrainer] = useState(false);
  const [trainerStep, setTrainerStep] = useState(5);
  const [trainerEvery, setTrainerEvery] = useState(8);
  const [trainerMode, setTrainerMode] = useState<TrainerMode>("up");
  const [trainerMin, setTrainerMin] = useState(20);
  const [trainerMax, setTrainerMax] = useState(300);
  const [library, setLibrary] = useState<Pattern[]>(FALLBACK_PATTERNS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [presets, setPresets] = useState<Pattern[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [recent, setRecent] = useState<Pattern[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeResult[]>([]);
  const [lastSnapshot, setLastSnapshot] = useState<LastSessionSnapshot | null>(null);
  const [recap, setRecap] = useState<PracticeResult | null>(null);
  const [practiceMode, setPracticeMode] = useState<PracticeModeConfig>({ type: "normal" });
  const [currentStage, setCurrentStage] = useState("original");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [patternTypeFilter, setPatternTypeFilter] = useState("Alle");
  const [learningFilters, setLearningFilters] = useState<LibraryFilters>({ ...EMPTY_LIBRARY_FILTERS });
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(18);
  const [editorOpen, setEditorOpen] = useState(false);
  const [presetName, setPresetName] = useState("Mein Pattern");
  const [presetCategory, setPresetCategory] = useState("Eigene Presets");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editorTracks, setEditorTracks] = useState<DrumTracks>({});
  const [editorSteps, setEditorSteps] = useState<StepState[]>([]);
  const [editorHistory, setEditorHistory] = useState<DrumTracks[]>([]);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [libraryStatus, setLibraryStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>("checking");
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>({ appReady: false, availableKits: 1, totalKits: 12, totalAudioBytes: 0 });
  const [offlineDownloadPending, setOfflineDownloadPending] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [storageError, setStorageError] = useState("");
  const [midiStatus, setMidiStatus] = useState<"idle" | "connected" | "unsupported" | "denied">("idle");
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(false);
  const [audioFeedbackStatus, setAudioFeedbackStatus] = useState<AudioFeedbackStatus>("idle");
  const [audioFeedbackConfig, setAudioFeedbackConfig] = useState<AudioFeedbackConfig>({ latencyMs: 0, latencySource: "estimated" });
  const [audioInputOptions, setAudioInputOptions] = useState<AudioInputOption[]>([]);
  const [audioInputDeviceId, setAudioInputDeviceId] = useState("");
  const [audioFeedbackAnalysis, setAudioFeedbackAnalysis] = useState<AudioFeedbackAnalysis | null>(null);
  const [calibratingLatency, setCalibratingLatency] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  const audioRef = useRef<AudioContext | null>(null);
  const stylePickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filterPanelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const stylePickerCloseRef = useRef<HTMLButtonElement | null>(null);
  const filterPanelCloseRef = useRef<HTMLButtonElement | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const visualTimersRef = useRef<Set<number>>(new Set());
  const scheduledSourcesRef = useRef<Set<AudioScheduledSourceNode>>(new Set());
  const masterGainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const drumSampleCacheRef = useRef<DrumSampleCache>(new Map());
  const openHatSourcesRef = useRef<Set<OpenHatHandle>>(new Set());
  const drumHitCounterRef = useRef(0);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const phaseRef = useRef<PlaybackPhase>("stopped");
  const wantsPlaybackRef = useRef(false);
  const generationRef = useRef(0);
  const recoveryPromiseRef = useRef<Promise<void> | null>(null);
  const contextTransitionRef = useRef<Promise<void>>(Promise.resolve());
  const bpmRef = useRef(bpm);
  const tempoRevisionRef = useRef(0);
  const meterRef = useRef(meter);
  const subdivisionRef = useRef(subdivision);
  const stepsRef = useRef(steps);
  const drumTracksRef = useRef<DrumTracks | null>(drumTracks);
  const tempoUnitRef = useRef(tempoUnit);
  const volumeRef = useRef(volume);
  const voiceVolumesRef = useRef(voiceVolumes);
  const soundRef = useRef<DrumKit>(sound);
  const swingRef = useRef(swing);
  const originalFeelRef = useRef<OriginalFeel | null>(originalFeel);
  const feelModeRef = useRef<FeelMode>(feelMode);
  const timerMinutesRef = useRef(timerMinutes);
  const trainerRef = useRef(trainer);
  const trainerStepRef = useRef(trainerStep);
  const trainerEveryRef = useRef(trainerEvery);
  const trainerModeRef = useRef<TrainerMode>(trainerMode);
  const trainerMinRef = useRef(20);
  const trainerMaxRef = useRef(300);
  const trainerDirectionRef = useRef<1 | -1>(1);
  const repeatBarsRef = useRef(repeatBars);
  const nextTimeRef = useRef(0);
  const nextStepRef = useRef(0);
  const barsRef = useRef(0);
  const endAtRef = useRef(0);
  const timerRemainingRef = useRef(0);
  const checkpointRef = useRef<SessionCheckpoint>({ nextStep: 0, bars: 0, bpm, trainerDirection: 1 });
  const stopRef = useRef<(reason?: PracticeResult["completionReason"]) => void>(() => undefined);
  const startRef = useRef<(recover?: boolean) => Promise<void>>(async () => undefined);
  const pauseLifecycleRef = useRef<() => void>(() => undefined);
  const resumeLifecycleRef = useRef<() => void>(() => undefined);
  const tapTimesRef = useRef<number[]>([]);
  const patternNameRef = useRef(patternName);
  const patternIdRef = useRef(patternId);
  const sessionStartedAtRef = useRef(0);
  const sessionStartBpmRef = useRef(bpm);
  const practiceHistoryRef = useRef<PracticeResult[]>([]);
  const practiceModeRef = useRef<PracticeModeConfig>(practiceMode);
  const currentStageRef = useRef(currentStage);
  const currentPatternRef = useRef<Pattern>(FALLBACK_PATTERNS[0]);
  const activeSceneIdRef = useRef("session-initial");
  const activeElapsedMsRef = useRef(0);
  const activeSliceStartedAtRef = useRef(0);
  const drumGridScrollRef = useRef<HTMLDivElement | null>(null);
  const inlineEditorRef = useRef<HTMLElement | null>(null);
  const editorTriggerRef = useRef<HTMLElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const midiAccessRef = useRef<MidiAccessLike | null>(null);
  const audioFeedbackEnabledRef = useRef(false);
  const audioFeedbackConfigRef = useRef<AudioFeedbackConfig>({ latencyMs: 0, latencySource: "estimated" });
  const audioInputDeviceIdRef = useRef("");
  const audioInputStreamRef = useRef<MediaStream | null>(null);
  const audioInputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioOnsetNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioFeedbackSinkRef = useRef<GainNode | null>(null);
  const audioFeedbackSessionRef = useRef<AudioFeedbackSession>(createAudioFeedbackSession());
  const audioFeedbackRenderFrameRef = useRef<number | null>(null);
  const expectedAudioHitCounterRef = useRef(0);
  const updateRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => { meterRef.current = meter; }, [meter]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { drumTracksRef.current = drumTracks; }, [drumTracks]);
  useEffect(() => { tempoUnitRef.current = tempoUnit; }, [tempoUnit]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { swingRef.current = swing; }, [swing]);
  useEffect(() => { originalFeelRef.current = originalFeel; }, [originalFeel]);
  useEffect(() => { feelModeRef.current = feelMode; }, [feelMode]);
  useEffect(() => { timerMinutesRef.current = timerMinutes; }, [timerMinutes]);
  useEffect(() => { trainerRef.current = trainer; }, [trainer]);
  useEffect(() => { trainerStepRef.current = trainerStep; }, [trainerStep]);
  useEffect(() => { trainerEveryRef.current = trainerEvery; }, [trainerEvery]);
  useEffect(() => { trainerModeRef.current = trainerMode; }, [trainerMode]);
  useEffect(() => { trainerMinRef.current = trainerMin; }, [trainerMin]);
  useEffect(() => { trainerMaxRef.current = trainerMax; }, [trainerMax]);
  useEffect(() => { repeatBarsRef.current = repeatBars; }, [repeatBars]);
  useEffect(() => { patternNameRef.current = patternName; }, [patternName]);
  useEffect(() => { patternIdRef.current = patternId; }, [patternId]);
  useEffect(() => { practiceHistoryRef.current = practiceHistory; }, [practiceHistory]);
  useEffect(() => { practiceModeRef.current = practiceMode; }, [practiceMode]);
  useEffect(() => { currentStageRef.current = currentStage; }, [currentStage]);
  useEffect(() => { audioFeedbackConfigRef.current = audioFeedbackConfig; }, [audioFeedbackConfig]);
  useEffect(() => { audioInputDeviceIdRef.current = audioInputDeviceId; }, [audioInputDeviceId]);

  const persistStore = useCallback(async (key: string, value: unknown) => {
    try {
      await writeStore(key, value);
      setStorageError("");
      return true;
    } catch {
      setStorageError("Lokale Änderungen konnten nicht gespeichert werden. Exportiere deine Presets zur Sicherheit.");
      return false;
    }
  }, []);

  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => { setOnline(false); setPwaStatus("offline"); };
    const visibilityHandler = () => document.hidden ? pauseLifecycleRef.current() : resumeLifecycleRef.current();
    const pageHideHandler = () => pauseLifecycleRef.current();
    const pageShowHandler = () => resumeLifecycleRef.current();
    const focusHandler = () => { if (!document.hidden) resumeLifecycleRef.current(); };
    const installHandler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setInstallPrompt(null);
    const serviceWorkerMessage = (event: MessageEvent<{ type?: string } & Partial<OfflineStatus>>) => {
      if (event.data?.type !== "OFFLINE_STATUS") return;
      const next = {
        appReady: Boolean(event.data.appReady),
        availableKits: Number(event.data.availableKits || 1),
        totalKits: Number(event.data.totalKits || 12),
        totalAudioBytes: Number(event.data.totalAudioBytes || 0),
        buildRevision: event.data.buildRevision,
      };
      setOfflineStatus(next);
      setOfflineDownloadPending(false);
      setPwaStatus(navigator.onLine ? next.appReady ? "ready" : "checking" : "offline");
    };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("beforeinstallprompt", installHandler);
    window.addEventListener("appinstalled", installedHandler);
    queueMicrotask(() => { if (!navigator.onLine) offlineHandler(); });
    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("pagehide", pageHideHandler);
    window.addEventListener("pageshow", pageShowHandler);
    window.addEventListener("focus", focusHandler);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", serviceWorkerMessage);
      navigator.serviceWorker.register("/sw.js").then(async (registration) => {
        if (registration.waiting) {
          updateRegistrationRef.current = registration;
          setPwaStatus("update");
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              updateRegistrationRef.current = registration;
              setPwaStatus("update");
            }
          });
        });
        const ready = await navigator.serviceWorker.ready;
        const runtimePaths = [location.href, ...performance.getEntriesByType("resource").map((entry) => entry.name)].flatMap((value) => {
          try {
            const url = new URL(value, location.origin);
            return url.origin === location.origin && !url.pathname.startsWith("/audio/") && !url.pathname.startsWith("/data/") ? [url.pathname + url.search] : [];
          } catch { return []; }
        });
        ready.active?.postMessage({ type: "CACHE_RUNTIME", paths: [...new Set(runtimePaths)] });
        ready.active?.postMessage({ type: "CACHE_KIT", paths: drumKitOfflinePaths(soundRef.current) });
      }).catch(() => setPwaStatus("error"));
    } else queueMicrotask(() => setPwaStatus("error"));
    Promise.all([
      readStore<string[]>("favorites", []),
      readStore<Pattern[]>("presets", []),
      readStore<Pattern[]>("recent", []),
      readStore<PracticeEntry[]>("practiceHistory", []),
      readStore<Scene[]>("scenes", []),
      readStore<PracticeResult[]>("practiceResults", []),
      readStore<LastSessionSnapshot | null>("lastSessionSnapshot", null),
      readStore<number>("dataSchemaVersion", 1),
      readStore<AudioFeedbackConfig>("audioFeedbackConfig", { latencyMs: 0, latencySource: "estimated" }),
    ]).then(([savedFavorites, savedPresets, savedRecent, savedPractice, savedScenes, savedResults, savedSnapshot, savedSchema, savedAudioFeedback]) => {
      setFavorites(Array.isArray(savedFavorites) ? savedFavorites : []);
      setPresets(Array.isArray(savedPresets) ? savedPresets.filter((item) => item?.id?.startsWith("custom-") && item.drumTracks) : []);
      setRecent(Array.isArray(savedRecent) ? savedRecent : []);
      const nextScenes = Array.isArray(savedScenes) && savedScenes.length ? savedScenes : migrateLegacyPresets(Array.isArray(savedPresets) ? savedPresets : []);
      const nextResults = Array.isArray(savedResults) && savedResults.length ? savedResults : migrateLegacyPractice(Array.isArray(savedPractice) ? savedPractice : []);
      setScenes(nextScenes);
      setPracticeHistory(nextResults.slice(0, 100));
      setLastSnapshot(savedSnapshot?.scene ? savedSnapshot : null);
      practiceHistoryRef.current = nextResults.slice(0, 100);
      const nextFeedbackConfig: AudioFeedbackConfig = {
        latencyMs: Math.max(0, Math.min(600, Number(savedAudioFeedback?.latencyMs) || 0)),
        latencySource: ["estimated", "calibrated", "manual"].includes(savedAudioFeedback?.latencySource) ? savedAudioFeedback.latencySource : "estimated",
        ...(savedAudioFeedback?.deviceId ? { deviceId: savedAudioFeedback.deviceId } : {}),
      };
      audioFeedbackConfigRef.current = nextFeedbackConfig;
      audioInputDeviceIdRef.current = nextFeedbackConfig.deviceId || "";
      setAudioFeedbackConfig(nextFeedbackConfig);
      setAudioInputDeviceId(nextFeedbackConfig.deviceId || "");
      if (savedSchema < DATA_SCHEMA_VERSION) {
        void Promise.all([
          persistStore("scenes", nextScenes),
          persistStore("practiceResults", nextResults.slice(0, 100)),
          persistStore("dataSchemaVersion", DATA_SCHEMA_VERSION),
          persistStore("appVersion", APP_VERSION),
        ]);
      }
    });
    fetch("/asset-manifest.json", { cache: "no-store" })
      .then(async (response): Promise<{ catalogPath?: string }> => response.ok ? response.json() : {})
      .then((manifest) => fetch(manifest.catalogPath || "/data/patterns-v1.json", { cache: "no-store" }))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Bibliothek nicht erreichbar")))
      .then((data: { version?: number; patterns?: Pattern[] }) => {
        const drums = Array.isArray(data.patterns)
          ? data.patterns.filter((pattern) => pattern.drumOnly === true && pattern.drumTracks)
          : [];
        if (!drums.length) throw new Error("Bibliothek ist leer");
        const ids = new Set(drums.map((pattern) => pattern.id));
        setLibrary(drums);
        setLibraryStatus("ready");
        setFavorites((current) => {
          const next = current.filter((id) => ids.has(id));
          void persistStore("favorites", next);
          return next;
        });
        setRecent((current) => {
          const next = current.filter((pattern) => pattern.id.startsWith("custom-") || ids.has(pattern.id));
          void persistStore("recent", next);
          return next;
        });
        void persistStore("libraryVersion", data.version || 2);
      })
      .catch(() => setLibraryStatus("fallback"));
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("beforeinstallprompt", installHandler);
      window.removeEventListener("appinstalled", installedHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("pagehide", pageHideHandler);
      window.removeEventListener("pageshow", pageShowHandler);
      window.removeEventListener("focus", focusHandler);
      navigator.serviceWorker?.removeEventListener("message", serviceWorkerMessage);
      midiAccessRef.current?.inputs.forEach((input) => { input.onmidimessage = null; });
      audioInputStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioFeedbackRenderFrameRef.current !== null) window.cancelAnimationFrame(audioFeedbackRenderFrameRef.current);
      stopRef.current();
    };
  }, [persistStore]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const setPlaybackPhase = useCallback((next: PlaybackPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const registerSource = useCallback((source: AudioScheduledSourceNode, cleanup?: () => void) => {
    scheduledSourcesRef.current.add(source);
    source.onended = () => {
      scheduledSourcesRef.current.delete(source);
      cleanup?.();
      try { source.disconnect(); } catch { /* Already disconnected. */ }
    };
  }, []);

  const updateVoiceVolume = useCallback((voice: DrumVoice, value: number) => {
    const next = { ...voiceVolumesRef.current, [voice]: Math.max(0, Math.min(100, value)) };
    voiceVolumesRef.current = next;
    setVoiceVolumes(next);
  }, []);

  const saveAudioFeedbackConfig = useCallback((next: AudioFeedbackConfig) => {
    const normalized: AudioFeedbackConfig = {
      latencyMs: Math.max(0, Math.min(600, Math.round(next.latencyMs))),
      latencySource: next.latencySource,
      ...(next.deviceId ? { deviceId: next.deviceId } : {}),
    };
    audioFeedbackConfigRef.current = normalized;
    setAudioFeedbackConfig(normalized);
    void persistStore("audioFeedbackConfig", normalized);
  }, [persistStore]);

  const refreshAudioFeedback = useCallback(() => {
    if (audioFeedbackRenderFrameRef.current !== null) return;
    audioFeedbackRenderFrameRef.current = window.requestAnimationFrame(() => {
      audioFeedbackRenderFrameRef.current = null;
      setAudioFeedbackAnalysis(snapshotAudioFeedback(audioFeedbackSessionRef.current));
    });
  }, []);

  const disconnectAudioFeedbackGraph = useCallback(() => {
    if (audioOnsetNodeRef.current) audioOnsetNodeRef.current.port.onmessage = null;
    try { audioInputSourceRef.current?.disconnect(); } catch { /* Already disconnected. */ }
    try { audioOnsetNodeRef.current?.disconnect(); } catch { /* Already disconnected. */ }
    try { audioFeedbackSinkRef.current?.disconnect(); } catch { /* Already disconnected. */ }
    audioInputSourceRef.current = null;
    audioOnsetNodeRef.current = null;
    audioFeedbackSinkRef.current = null;
  }, []);

  const clearRuntime = useCallback((closeContext = true) => {
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    visualTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    visualTimersRef.current.clear();
    scheduledSourcesRef.current.forEach((source) => {
      source.onended = null;
      try { source.stop(); } catch { /* The source may already have ended. */ }
      try { source.disconnect(); } catch { /* The source may already be detached. */ }
    });
    scheduledSourcesRef.current.clear();
    openHatSourcesRef.current.clear();
    try { masterGainRef.current?.disconnect(); } catch { /* Already disconnected. */ }
    try { compressorRef.current?.disconnect(); } catch { /* Already disconnected. */ }
    try { analyserRef.current?.disconnect(); } catch { /* Already disconnected. */ }
    disconnectAudioFeedbackGraph();
    masterGainRef.current = null;
    compressorRef.current = null;
    analyserRef.current = null;
    drumHitCounterRef.current = 0;
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
    const context = audioRef.current;
    if (context) context.onstatechange = null;
    if (closeContext && context) {
      audioRef.current = null;
      contextTransitionRef.current = Promise.resolve();
      if (context.state !== "closed") void context.close().catch(() => undefined);
    }
  }, [disconnectAudioFeedbackGraph]);

  const attachAudioFeedback = useCallback(async (context: AudioContext, token: number) => {
    const stream = audioInputStreamRef.current;
    if (!audioFeedbackEnabledRef.current || !stream?.active) return false;
    disconnectAudioFeedbackGraph();
    try {
      await context.audioWorklet.addModule("/audio-onset-processor.js");
      if (generationRef.current !== token || audioRef.current !== context || !audioFeedbackEnabledRef.current) return false;
      const source = context.createMediaStreamSource(stream);
      const onset = new AudioWorkletNode(context, "audio-onset-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions: { config: { refractoryMs: 42, warmupMs: 140 } },
      });
      const silentSink = context.createGain();
      silentSink.gain.value = 0;
      source.connect(onset).connect(silentSink).connect(context.destination);
      onset.port.onmessage = (event: MessageEvent<OnsetWorkletMessage>) => {
        const message = event.data;
        if (message?.type !== "onset" || !Number.isFinite(message.contextTime) || generationRef.current !== token || !audioFeedbackEnabledRef.current) return;
        try {
          addDetectedTransient(audioFeedbackSessionRef.current, {
            id: `onset-${token}-${Math.round(Number(message.contextTime) * context.sampleRate)}`,
            timeMs: Number(message.contextTime) * 1000,
            strength: Number(message.strength) || 0,
          });
          refreshAudioFeedback();
        } catch { /* Ignore stale render-thread messages after a lifecycle transition. */ }
      };
      audioInputSourceRef.current = source;
      audioOnsetNodeRef.current = onset;
      audioFeedbackSinkRef.current = silentSink;
      setAudioFeedbackStatus("listening");
      return true;
    } catch {
      disconnectAudioFeedbackGraph();
      setAudioFeedbackStatus("error");
      return false;
    }
  }, [disconnectAudioFeedbackGraph, refreshAudioFeedback]);

  const activeMilliseconds = useCallback(() => activeElapsedMsRef.current + (activeSliceStartedAtRef.current ? Date.now() - activeSliceStartedAtRef.current : 0), []);

  const currentScene = useCallback((id = activeSceneIdRef.current): Scene => createScene(currentPatternRef.current, {
    id,
    name: patternNameRef.current,
    bpm: bpmRef.current,
    kit: soundRef.current,
    voiceVolumes: voiceVolumesRef.current,
    swing: swingRef.current,
    feelAmount: feelModeRef.current === "original" ? 1 : 0,
    trainer: trainerRef.current ? {
      mode: trainerModeRef.current,
      step: trainerStepRef.current,
      every: trainerEveryRef.current,
      min: trainerMinRef.current,
      max: trainerMaxRef.current,
    } : undefined,
    practiceMode: practiceModeRef.current,
  }), []);

  const saveLastSnapshot = useCallback((activeMs = activeMilliseconds()) => {
    const snapshot: LastSessionSnapshot = {
      scene: currentScene(),
      currentStage: currentStageRef.current,
      activeSeconds: Math.round(activeMs / 1000),
      barsCompleted: barsRef.current,
      savedAt: new Date().toISOString(),
    };
    setLastSnapshot(snapshot);
    void persistStore("lastSessionSnapshot", snapshot);
  }, [activeMilliseconds, currentScene, persistStore]);

  const stopPlayback = useCallback((reason: PracticeResult["completionReason"] = "manual") => {
    if (activeSliceStartedAtRef.current) {
      activeElapsedMsRef.current += Date.now() - activeSliceStartedAtRef.current;
      activeSliceStartedAtRef.current = 0;
    }
    const elapsedSeconds = Math.round(activeElapsedMsRef.current / 1000);
    if (elapsedSeconds >= 5 && barsRef.current > 0) {
      const scene = currentScene();
      let timingResult: TimingResult | undefined;
      if (audioFeedbackEnabledRef.current) {
        const feedbackSession = audioFeedbackSessionRef.current;
        const contextTimeMs = (audioRef.current?.currentTime || 0) * 1000;
        try { expirePendingHits(feedbackSession, contextTimeMs + feedbackSession.config.matchWindowMs); } catch { /* Session may already be finalized. */ }
        const feedback = snapshotAudioFeedback(feedbackSession);
        if (feedback.overall.expectedHits > 0) {
          const observationFor = (voice: DrumVoice | "all", values = feedback.overall) => ({
            voice,
            medianMs: Math.round(values.medianMs * 10) / 10,
            meanAbsoluteMs: Math.round(values.meanAbsoluteMs * 10) / 10,
            spreadMs: Math.round(values.spreadMs * 10) / 10,
            hitRate: Math.round(values.hitRate * 10) / 10,
          });
          timingResult = {
            input: "audio",
            latencyMs: feedbackSession.config.latencyCompensationMs,
            latencySource: audioFeedbackConfigRef.current.latencySource,
            observations: [
              observationFor("all"),
              ...DRUM_VOICES.flatMap((voice) => feedback.byVoice[voice] ? [observationFor(voice, feedback.byVoice[voice])] : []),
            ],
            matchedHits: feedback.matched.length,
            missedHits: feedback.missed.length,
            extraHits: feedback.extra.length,
            samples: feedback.matched.slice(-96).map((item) => ({
              stepIndex: item.expected.stepIndex,
              offsetMs: Math.round(item.offsetMs * 10) / 10,
              classification: item.classification,
              strength: item.transient.strength,
              voices: [...item.expected.voices],
            })),
          };
          setAudioFeedbackAnalysis(feedback);
        }
      }
      const entry: PracticeResult = {
        id: `session-${Date.now()}`,
        sceneId: scene.id,
        sceneName: scene.name,
        patternId: patternIdRef.current || undefined,
        activeSeconds: elapsedSeconds,
        barsCompleted: barsRef.current,
        bpmStart: sessionStartBpmRef.current,
        bpmEnd: bpmRef.current,
        completed: reason === "timer" || reason === "bars",
        completionReason: reason,
        ...(timingResult ? { timingResult } : {}),
        practiceMode: practiceModeRef.current,
        currentStage: currentStageRef.current,
        completedAt: new Date().toISOString(),
      };
      const nextHistory = [entry, ...practiceHistoryRef.current].slice(0, 100);
      practiceHistoryRef.current = nextHistory;
      setPracticeHistory(nextHistory);
      setRecap(entry);
      void persistStore("practiceResults", nextHistory);
    }
    if (sessionStartedAtRef.current) saveLastSnapshot(activeElapsedMsRef.current);
    sessionStartedAtRef.current = 0;
    activeElapsedMsRef.current = 0;
    wantsPlaybackRef.current = false;
    generationRef.current += 1;
    recoveryPromiseRef.current = null;
    clearRuntime(true);
    if (audioFeedbackEnabledRef.current) setAudioFeedbackStatus("ready");
    setPlaybackPhase("stopped");
    setCurrentStep(-1);
    nextStepRef.current = 0;
    barsRef.current = 0;
    endAtRef.current = 0;
    timerRemainingRef.current = timerMinutesRef.current * 60_000;
    setTimerText(timerMinutesRef.current ? `${timerMinutesRef.current}:00` : "∞");
  }, [clearRuntime, currentScene, persistStore, saveLastSnapshot, setPlaybackPhase]);
  useEffect(() => { stopRef.current = stopPlayback; }, [stopPlayback]);

  const scheduleDrumVoice = useCallback((context: AudioContext, when: number, voice: DrumVoice, state: DrumHitState, velocityMultiplier = 1) => {
    if (state === "mute") return;
    const output: AudioNode = masterGainRef.current || context.destination;
    const kit = soundRef.current;
    const hitCounter = drumHitCounterRef.current;
    drumHitCounterRef.current += 1;
    const variant = (hitCounter + DRUM_VOICES.indexOf(voice)) & 1;
    const sampleBuffer = drumSampleFor(drumSampleCacheRef.current, kit, voice, variant);
    if (!sampleBuffer) return;
    const gain = context.createGain();
    const source = context.createBufferSource();
    const level = drumHitLevel(voice, state, velocityMultiplier * voiceVolumesRef.current[voice] / 100, volumeRef.current);
    source.buffer = sampleBuffer;
    source.playbackRate.setValueAtTime(drumPlaybackRate(kit, voice, state, hitCounter), when);
    gain.gain.setValueAtTime(level, when);
    source.connect(gain).connect(output);

    if (voice === "closedHat") {
      for (const openHat of openHatSourcesRef.current) {
        if (openHat.endAt <= when) continue;
        openHat.gain.gain.cancelScheduledValues(when);
        openHat.gain.gain.setValueAtTime(openHat.level, when);
        openHat.gain.gain.exponentialRampToValueAtTime(.0001, when + .028);
        try { openHat.source.stop(when + .035); } catch { /* The open hat may already have ended. */ }
      }
    }

    const endAt = when + source.buffer.duration / source.playbackRate.value + .02;
    let openHatHandle: OpenHatHandle | null = null;
    if (voice === "openHat") {
      openHatHandle = { source, gain, level, endAt };
      openHatSourcesRef.current.add(openHatHandle);
    }
    registerSource(source, () => {
      if (openHatHandle) openHatSourcesRef.current.delete(openHatHandle);
      try { gain.disconnect(); } catch { /* The hit gain may already be detached. */ }
    });
    source.start(when);
    source.stop(endAt);
  }, [registerSource]);

  const changeDrumKit = useCallback(async (kit: DrumKit) => {
    const nextKit = normalizeDrumKit(kit);
    const context = audioRef.current;
    if (context && context.state !== "closed") {
      try {
        await withAudioTimeout(primeDrumKit(context, drumSampleCacheRef.current, nextKit, DRUM_VOICES), 8000);
      } catch {
        showToast("Das Drumkit konnte nicht vorbereitet werden.");
        return;
      }
    }
    soundRef.current = nextKit;
    setSound(nextKit);
    navigator.serviceWorker?.controller?.postMessage({ type: "CACHE_KIT", paths: drumKitOfflinePaths(nextKit) });
  }, [showToast]);

  const pauseForLifecycle = useCallback(() => {
    if (!wantsPlaybackRef.current) return;
    if (phaseRef.current === "lifecycle-paused" && schedulerRef.current === null) return;
    generationRef.current += 1;
    if (activeSliceStartedAtRef.current) {
      activeElapsedMsRef.current += Date.now() - activeSliceStartedAtRef.current;
      activeSliceStartedAtRef.current = 0;
      saveLastSnapshot(activeElapsedMsRef.current);
    }
    if (endAtRef.current) timerRemainingRef.current = Math.max(0, endAtRef.current - Date.now());
    endAtRef.current = 0;
    audioFeedbackSessionRef.current.pending.splice(0);
    const context = audioRef.current;
    clearRuntime(false);
    const checkpoint = checkpointRef.current;
    nextStepRef.current = checkpoint.nextStep;
    barsRef.current = checkpoint.bars;
    bpmRef.current = checkpoint.bpm;
    trainerDirectionRef.current = checkpoint.trainerDirection;
    setBpm(checkpoint.bpm);
    setPlaybackPhase("lifecycle-paused");
    setCurrentStep(-1);
    if (context && context.state !== "closed") {
      contextTransitionRef.current = contextTransitionRef.current
        .catch(() => undefined)
        .then(async () => {
          if (audioRef.current !== context || !wantsPlaybackRef.current || context.state === "closed" || context.state === "suspended") return;
          await withAudioTimeout(context.suspend(), 2000).catch(() => undefined);
        });
    }
  }, [clearRuntime, saveLastSnapshot, setPlaybackPhase]);
  useEffect(() => { pauseLifecycleRef.current = pauseForLifecycle; }, [pauseForLifecycle]);

  const startPlayback = useCallback(async (recover = false) => {
    const recoveringExistingContext = Boolean(recover && audioRef.current && audioRef.current.state !== "closed");
    const token = generationRef.current + 1;
    generationRef.current = token;
    wantsPlaybackRef.current = true;
    clearRuntime(!recover);
    setPlaybackPhase(recover ? "recovering" : "starting");
    if (document.hidden) {
      setPlaybackPhase("lifecycle-paused");
      return;
    }
    if (!recover || !recoveringExistingContext) {
      barsRef.current = 0;
      setSessionBars(0);
      sessionStartedAtRef.current = Date.now();
      activeElapsedMsRef.current = 0;
      activeSliceStartedAtRef.current = 0;
      activeSceneIdRef.current = `session-${Date.now()}`;
      sessionStartBpmRef.current = bpmRef.current;
      nextStepRef.current = 0;
      trainerDirectionRef.current = 1;
      timerRemainingRef.current = timerMinutesRef.current * 60_000;
      setTimerText(timerMinutesRef.current ? `${timerMinutesRef.current}:00` : "∞");
      checkpointRef.current = {
        nextStep: nextStepRef.current,
        bars: barsRef.current,
        bpm: bpmRef.current,
        trainerDirection: trainerDirectionRef.current,
      };
    }

    const fail = (message: string) => {
      if (generationRef.current !== token) return;
      wantsPlaybackRef.current = false;
      generationRef.current += 1;
      clearRuntime(true);
      setPlaybackPhase("stopped");
      setCurrentStep(-1);
      showToast(message);
    };
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return fail("Audio wird von diesem Browser nicht unterstützt.");

    let context: AudioContext;
    try {
      setAudioSessionType(audioFeedbackEnabledRef.current ? "play-and-record" : "playback");
      if (recover) await withAudioTimeout(contextTransitionRef.current, 2500);
      if (generationRef.current !== token || !wantsPlaybackRef.current || document.hidden) {
        if (document.hidden && wantsPlaybackRef.current) setPlaybackPhase("lifecycle-paused");
        return;
      }
      const existing = recover && audioRef.current?.state !== "closed" ? audioRef.current : null;
      context = existing || new AudioContextClass();
      if (!existing) audioRef.current = context;
      if (context.state !== "running") await withAudioTimeout(context.resume(), 2500);
    } catch {
      return fail("Audio konnte nicht gestartet werden. Tippe erneut auf ▶.");
    }
    if (generationRef.current !== token || !wantsPlaybackRef.current || document.hidden || audioRef.current !== context) {
      if (generationRef.current === token && document.hidden && wantsPlaybackRef.current) pauseLifecycleRef.current();
      return;
    }
    if (context.state !== "running") return fail("Audio bleibt pausiert. Tippe zum Fortsetzen auf ▶.");

    if (!recover) {
      expectedAudioHitCounterRef.current = 0;
      if (audioFeedbackEnabledRef.current && audioInputStreamRef.current?.active && audioFeedbackConfigRef.current.latencySource === "estimated") {
        saveAudioFeedbackConfig({
          ...audioFeedbackConfigRef.current,
          latencyMs: estimateAudioRoundTripLatencyMs(context, audioInputStreamRef.current),
        });
      }
      audioFeedbackSessionRef.current = createAudioFeedbackSession({
        latencyCompensationMs: audioFeedbackConfigRef.current.latencyMs,
        matchWindowMs: 120,
        onTimeWindowMs: 25,
      });
      setAudioFeedbackAnalysis(audioFeedbackEnabledRef.current ? snapshotAudioFeedback(audioFeedbackSessionRef.current) : null);
    }

    try {
      await withAudioTimeout(primeDrumKit(context, drumSampleCacheRef.current, soundRef.current, DRUM_VOICES), 8000);
    } catch {
      return fail("Drumklänge konnten nicht vorbereitet werden. Prüfe deine Verbindung und tippe erneut auf ▶.");
    }
    if (generationRef.current !== token || !wantsPlaybackRef.current || document.hidden || audioRef.current !== context) return;

    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const analyser = context.createAnalyser();
    master.gain.value = .9;
    compressor.threshold.value = -15;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = .003;
    compressor.release.value = .18;
    analyser.fftSize = 4096;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -12;
    analyser.smoothingTimeConstant = .68;
    master.connect(compressor).connect(analyser).connect(context.destination);
    masterGainRef.current = master;
    compressorRef.current = compressor;
    analyserRef.current = analyser;
    const feedbackAttached = await attachAudioFeedback(context, token);
    if (generationRef.current !== token || audioRef.current !== context) return;
    nextTimeRef.current = context.currentTime + (feedbackAttached ? .25 : .07);
    endAtRef.current = timerRemainingRef.current ? Date.now() + timerRemainingRef.current : 0;
    let lastContextTime = context.currentTime;
    let stalledTicks = 0;

    const recoverEngine = () => {
      if (generationRef.current !== token || audioRef.current !== context || !wantsPlaybackRef.current) return;
      setPlaybackPhase(document.hidden ? "lifecycle-paused" : "recovering");
      pauseLifecycleRef.current();
      if (!document.hidden && wantsPlaybackRef.current) window.setTimeout(() => resumeLifecycleRef.current(), 0);
    };

    const tick = () => {
      if (generationRef.current !== token || !wantsPlaybackRef.current || audioRef.current !== context) return;
      if (document.hidden) return pauseLifecycleRef.current();
      if (context.state !== "running") return recoverEngine();
      if (context.currentTime <= lastContextTime + .00001) stalledTicks += 1;
      else {
        lastContextTime = context.currentTime;
        stalledTicks = 0;
      }
      if (stalledTicks >= 80) return recoverEngine();
      if (nextTimeRef.current < context.currentTime - .1) nextTimeRef.current = context.currentTime + .035;
      let planned = 0;
      while (nextTimeRef.current < context.currentTime + .12 && planned < 32) {
        if (endAtRef.current && Date.now() + Math.max(0, nextTimeRef.current - context.currentTime) * 1000 >= endAtRef.current) {
          stopRef.current("timer");
          break;
        }
        planned += 1;
        let stopAfterStep = false;
        const currentMeter = meterRef.current;
        const barSteps = stepsPerBar(currentMeter, subdivisionRef.current);
        const cycleSteps = Math.max(barSteps, stepsRef.current.length);
        const stepSeconds = (
          (currentMeter.beats * 4 / currentMeter.denominator)
          / (tempoUnitRef.current === "dotted-quarter" ? 1.5 : tempoUnitRef.current === "eighth" ? .5 : 1)
          * (60 / bpmRef.current)
        ) / barSteps;
        const stepIndex = nextStepRef.current;
        const stepInBar = stepIndex % barSteps;
        if (audioFeedbackEnabledRef.current && audioOnsetNodeRef.current) {
          const feedbackVoices: DrumVoice[] = [];
          const feedbackStates: ExpectedAudioHit["states"] = {};
          if (drumTracksRef.current) {
            for (const voice of DRUM_VOICES) {
              const state = drumTracksRef.current[voice]?.[stepIndex] || "mute";
              if (state === "mute") continue;
              feedbackVoices.push(voice);
              feedbackStates[voice] = state;
            }
          } else {
            const state = stepsRef.current[stepIndex] || "mute";
            if (state !== "mute") {
              feedbackVoices.push("rim");
              feedbackStates.rim = state;
            }
          }
          if (feedbackVoices.length) {
            const sequenceStepIndex = barsRef.current * barSteps + stepInBar;
            const target: ExpectedAudioHit = {
              id: `audio-target-${token}-${expectedAudioHitCounterRef.current++}`,
              timeMs: nextTimeRef.current * 1000,
              stepIndex,
              sequenceStepIndex,
              cycleIndex: Math.floor(sequenceStepIndex / cycleSteps),
              voices: feedbackVoices,
              states: feedbackStates,
            };
            try { addExpectedAudioHit(audioFeedbackSessionRef.current, target); } catch { /* Ignore a stale target after recovery. */ }
          }
        }
        if (drumTracksRef.current) {
          for (const voice of DRUM_VOICES) {
            const state = drumTracksRef.current[voice]?.[stepIndex] || "mute";
            if (!isVoiceAudible(practiceModeRef.current, barsRef.current, voice)) continue;
            const feel = feelModeRef.current === "original" ? originalFeelRef.current : null;
            const timingMs = feel?.timingMs?.[voice]?.[stepIndex] ?? 0;
            const velocityMultiplier = feel?.velocityMultipliers?.[voice]?.[stepIndex] ?? 1;
            const tempoScale = feel?.sourceBpm ? feel.sourceBpm / bpmRef.current : 1;
            const feelTime = Math.max(context.currentTime, nextTimeRef.current + timingMs * tempoScale / 1000);
            scheduleDrumVoice(context, feelTime, voice, state, velocityMultiplier);
          }
        } else {
          if (isVoiceAudible(practiceModeRef.current, barsRef.current, "rim")) scheduleDrumVoice(context, nextTimeRef.current, "rim", stepsRef.current[stepIndex] || "normal");
        }

        const visualDelay = Math.max(0, (nextTimeRef.current - context.currentTime) * 1000);
        nextStepRef.current = (stepIndex + 1) % cycleSteps;
        if (stepInBar + 1 === barSteps) {
            barsRef.current += 1;
            if (trainerRef.current && barsRef.current % trainerEveryRef.current === 0) {
              let nextBpm = bpmRef.current + trainerStepRef.current;
              if (trainerModeRef.current === "pyramid") {
                nextBpm = bpmRef.current + trainerStepRef.current * trainerDirectionRef.current;
                if (nextBpm >= trainerMaxRef.current) {
                  nextBpm = trainerMaxRef.current;
                  trainerDirectionRef.current = -1;
                } else if (nextBpm <= trainerMinRef.current) {
                  nextBpm = trainerMinRef.current;
                  trainerDirectionRef.current = 1;
                }
              } else nextBpm = Math.min(trainerMaxRef.current, nextBpm);
              tempoRevisionRef.current += 1;
              bpmRef.current = nextBpm;
            }
            if (repeatBarsRef.current && barsRef.current >= repeatBarsRef.current) {
              const stopTimer = window.setTimeout(() => {
                visualTimersRef.current.delete(stopTimer);
                if (generationRef.current === token) stopRef.current("bars");
              }, visualDelay + stepSeconds * 1000 + 20);
              visualTimersRef.current.add(stopTimer);
              stopAfterStep = true;
            }
        }

        const checkpoint: SessionCheckpoint = {
          nextStep: nextStepRef.current,
          bars: barsRef.current,
          bpm: bpmRef.current,
          trainerDirection: trainerDirectionRef.current,
        };
        const checkpointTempoRevision = tempoRevisionRef.current;
        const timerId = window.setTimeout(() => {
          visualTimersRef.current.delete(timerId);
          if (generationRef.current !== token || phaseRef.current !== "running") return;
          checkpointRef.current = { ...checkpoint, bpm: bpmRef.current };
          if (checkpointTempoRevision === tempoRevisionRef.current) setBpm(checkpoint.bpm);
          setCurrentStep(stepIndex);
          setSessionBars(checkpoint.bars);
        }, visualDelay);
        visualTimersRef.current.add(timerId);

        let duration = stepSeconds;
        if (subdivisionRef.current === "Achtel" || subdivisionRef.current === "16tel") {
          const pairDuration = stepSeconds * 2;
          const longShare = swingRef.current / 100;
          duration = stepInBar % 2 === 0 ? pairDuration * longShare : pairDuration * (1 - longShare);
        }
        nextTimeRef.current += duration;
        if (stopAfterStep) {
          nextTimeRef.current = Number.POSITIVE_INFINITY;
          break;
        }
      }
      if (audioFeedbackEnabledRef.current && audioOnsetNodeRef.current) {
        try {
          const expired = expirePendingHits(audioFeedbackSessionRef.current, Math.max(0, context.currentTime - .08) * 1000);
          if (expired.length) refreshAudioFeedback();
        } catch { /* A render-thread onset may have advanced the same clock first. */ }
      }
      if (endAtRef.current) {
        timerRemainingRef.current = Math.max(0, endAtRef.current - Date.now());
        const remaining = Math.ceil(timerRemainingRef.current / 1000);
        setTimerText(`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`);
        if (remaining <= 0) stopRef.current("timer");
      }
    };

    schedulerRef.current = window.setInterval(tick, 25);
    tick();
    if (generationRef.current !== token || audioRef.current !== context) return;
    if (context.state !== "running" || schedulerRef.current === null) {
      recoverEngine();
      return;
    }
    setPlaybackPhase("running");
    activeSliceStartedAtRef.current = Date.now();
    context.onstatechange = () => {
      if (generationRef.current !== token || audioRef.current !== context || context.state === "running") return;
      recoverEngine();
    };
    if ("wakeLock" in navigator) {
      void (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<WakeLockHandle> } }).wakeLock.request("screen")
        .then((handle) => {
          if (generationRef.current === token && phaseRef.current === "running") wakeLockRef.current = handle;
          else void handle.release().catch(() => undefined);
        })
        .catch(() => undefined);
    }
  }, [attachAudioFeedback, clearRuntime, refreshAudioFeedback, saveAudioFeedbackConfig, scheduleDrumVoice, setPlaybackPhase, showToast]);
  useEffect(() => { startRef.current = startPlayback; }, [startPlayback]);

  const resumeFromLifecycle = useCallback(() => {
    if (!wantsPlaybackRef.current || document.hidden || phaseRef.current === "running" || phaseRef.current === "starting") return;
    if (recoveryPromiseRef.current) return;
    const promise = startRef.current(true);
    recoveryPromiseRef.current = promise;
    void promise.finally(() => {
      if (recoveryPromiseRef.current !== promise) return;
      recoveryPromiseRef.current = null;
      if (wantsPlaybackRef.current && !document.hidden && phaseRef.current !== "running") window.setTimeout(() => resumeLifecycleRef.current(), 0);
    });
  }, []);
  useEffect(() => { resumeLifecycleRef.current = resumeFromLifecycle; }, [resumeFromLifecycle]);

  const togglePlayback = useCallback(() => {
    if (calibratingLatency) {
      showToast("Latenzmessung läuft noch.");
      return;
    }
    if (phaseRef.current === "running" || phaseRef.current === "starting") stopPlayback();
    else if (wantsPlaybackRef.current) {
      generationRef.current += 1;
      recoveryPromiseRef.current = null;
      clearRuntime(true);
      void startPlayback(true);
    }
    else void startPlayback(false);
  }, [calibratingLatency, clearRuntime, showToast, startPlayback, stopPlayback]);

  const enableAudioFeedback = async (requestedDeviceId = audioInputDeviceIdRef.current) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioFeedbackStatus("unsupported");
      return;
    }
    setAudioFeedbackStatus("requesting");
    setAudioSessionType("play-and-record");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(requestedDeviceId ? { deviceId: { exact: requestedDeviceId } } : {}),
          channelCount: { ideal: 1 },
          echoCancellation: { ideal: false },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: false },
          latency: { ideal: 0 },
        } as MediaTrackConstraints & { latency: { ideal: number } },
      });
      const previousStream = audioInputStreamRef.current;
      disconnectAudioFeedbackGraph();
      audioInputStreamRef.current = stream;
      previousStream?.getTracks().forEach((track) => track.stop());
      audioFeedbackEnabledRef.current = true;
      setAudioFeedbackEnabled(true);

      const actualDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId || requestedDeviceId;
      audioInputDeviceIdRef.current = actualDeviceId;
      setAudioInputDeviceId(actualDeviceId);
      const inputs = (await navigator.mediaDevices.enumerateDevices())
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Mikrofon ${index + 1}` }));
      setAudioInputOptions(inputs);

      let nextConfig: AudioFeedbackConfig = {
        ...audioFeedbackConfigRef.current,
        ...(actualDeviceId ? { deviceId: actualDeviceId } : {}),
      };
      if (requestedDeviceId !== audioFeedbackConfigRef.current.deviceId) nextConfig = { ...nextConfig, latencyMs: 0, latencySource: "estimated" };
      const context = audioRef.current;
      if (context?.state === "running") {
        if (nextConfig.latencySource === "estimated") nextConfig = { ...nextConfig, latencyMs: estimateAudioRoundTripLatencyMs(context, stream) };
        saveAudioFeedbackConfig(nextConfig);
        audioFeedbackSessionRef.current = createAudioFeedbackSession({ latencyCompensationMs: nextConfig.latencyMs, matchWindowMs: 120, onTimeWindowMs: 25 });
        setAudioFeedbackAnalysis(snapshotAudioFeedback(audioFeedbackSessionRef.current));
        await attachAudioFeedback(context, generationRef.current);
      } else {
        saveAudioFeedbackConfig(nextConfig);
        setAudioFeedbackStatus("ready");
      }
    } catch (error) {
      setAudioSessionType(audioInputStreamRef.current?.active ? "play-and-record" : "playback");
      const name = error instanceof DOMException ? error.name : "";
      setAudioFeedbackStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
    }
  };

  const disableAudioFeedback = () => {
    audioFeedbackEnabledRef.current = false;
    setAudioFeedbackEnabled(false);
    disconnectAudioFeedbackGraph();
    audioInputStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioInputStreamRef.current = null;
    setAudioSessionType("playback");
    audioFeedbackSessionRef.current = createAudioFeedbackSession();
    setAudioFeedbackAnalysis(null);
    setAudioFeedbackStatus("idle");
  };

  const setManualAudioLatency = (latencyMs: number) => {
    saveAudioFeedbackConfig({ ...audioFeedbackConfigRef.current, latencyMs, latencySource: "manual" });
  };

  const calibrateAudioLatency = async () => {
    const stream = audioInputStreamRef.current;
    if (!stream?.active || wantsPlaybackRef.current || calibratingLatency) return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    setCalibratingLatency(true);
    setCalibrationProgress(0);
    setAudioFeedbackStatus("requesting");
    setAudioSessionType("play-and-record");
    let context: AudioContext | null = null;
    try {
      context = new AudioContextClass({ latencyHint: "interactive" });
      await context.resume();
      await context.audioWorklet.addModule("/audio-onset-processor.js");
      const microphone = context.createMediaStreamSource(stream);
      const detector = new AudioWorkletNode(context, "audio-onset-processor", { processorOptions: { config: { warmupMs: 180, refractoryMs: 55 } } });
      const silentSink = context.createGain();
      silentSink.gain.value = 0;
      microphone.connect(detector).connect(silentSink).connect(context.destination);
      const detections: Array<{ time: number; strength: number }> = [];
      detector.port.onmessage = (event: MessageEvent<OnsetWorkletMessage>) => {
        if (event.data?.type !== "onset" || !Number.isFinite(event.data.contextTime)) return;
        detections.push({ time: Number(event.data.contextTime), strength: Number(event.data.strength) || 0 });
      };

      const clickCount = 6;
      const intervalSeconds = .8;
      const firstClick = context.currentTime + .65;
      const scheduledTimes: number[] = [];
      const clickBuffer = context.createBuffer(1, Math.round(context.sampleRate * .018), context.sampleRate);
      const clickData = clickBuffer.getChannelData(0);
      for (let index = 0; index < clickData.length; index += 1) {
        const envelope = Math.exp(-index / (context.sampleRate * .0028));
        clickData[index] = (Math.random() * 2 - 1) * envelope * .75;
      }
      for (let index = 0; index < clickCount; index += 1) {
        const when = firstClick + index * intervalSeconds;
        const click = context.createBufferSource();
        const gain = context.createGain();
        click.buffer = clickBuffer;
        gain.gain.value = .65;
        click.connect(gain).connect(context.destination);
        click.start(when);
        scheduledTimes.push(when);
        window.setTimeout(() => setCalibrationProgress(index + 1), Math.max(0, (when - context!.currentTime) * 1000));
      }
      await new Promise((resolve) => window.setTimeout(resolve, (firstClick + (clickCount - 1) * intervalSeconds + .7 - context!.currentTime) * 1000));

      const offsets = scheduledTimes.flatMap((scheduled, index) => {
        const end = index + 1 < scheduledTimes.length ? scheduled + intervalSeconds * .75 : scheduled + .65;
        const candidates = detections.filter((item) => item.time >= scheduled + .008 && item.time <= end);
        if (!candidates.length) return [];
        const strongest = candidates.reduce((best, item) => item.strength > best.strength ? item : best);
        return [(strongest.time - scheduled) * 1000];
      }).filter((value) => value >= 5 && value <= 600).sort((left, right) => left - right);
      if (offsets.length < 3) throw new Error("Zu wenige Kalibrierimpulse erkannt");
      const middle = Math.floor(offsets.length / 2);
      const median = offsets.length % 2 ? offsets[middle] : (offsets[middle - 1] + offsets[middle]) / 2;
      const stable = offsets.filter((value) => Math.abs(value - median) <= 45);
      if (stable.length < 3) throw new Error("Latenz schwankt zu stark");
      const stableMiddle = Math.floor(stable.length / 2);
      const measured = stable.length % 2 ? stable[stableMiddle] : (stable[stableMiddle - 1] + stable[stableMiddle]) / 2;
      saveAudioFeedbackConfig({ ...audioFeedbackConfigRef.current, latencyMs: measured, latencySource: "calibrated" });
      setAudioFeedbackStatus("ready");
      showToast(`Latenz gemessen: ${Math.round(measured)} ms`);
      detector.port.onmessage = null;
      microphone.disconnect();
      detector.disconnect();
      silentSink.disconnect();
    } catch {
      setAudioFeedbackStatus("ready");
      showToast("Kalibrierung fehlgeschlagen. Kopfhörer direkt ans Mikrofon halten oder Latenz manuell einstellen.");
    } finally {
      if (context && context.state !== "closed") await context.close().catch(() => undefined);
      setCalibratingLatency(false);
      setCalibrationProgress(0);
    }
  };

  const updateBpm = useCallback((value: number) => {
    const next = Math.max(20, Math.min(300, Math.round(value)));
    tempoRevisionRef.current += 1;
    bpmRef.current = next;
    checkpointRef.current = { ...checkpointRef.current, bpm: next };
    setBpm(next);
  }, []);

  const registerTap = useCallback((now: number) => {
    const recentTaps = tapTimesRef.current.filter((time) => now - time < 2200);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps.slice(-6);
    if (tapTimesRef.current.length > 1) {
      const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
      updateBpm(60_000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length));
    }
  }, [updateBpm]);

  const tapTempo = (event: React.MouseEvent<HTMLButtonElement>) => registerTap(event.timeStamp);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("button, a, input, select, textarea, [contenteditable='true']")) return;
      if (event.code === "Space") { event.preventDefault(); togglePlayback(); }
      else if (event.key.toLocaleLowerCase("de") === "t") registerTap(performance.now());
      else if (event.key === "+" || event.key === "=") updateBpm(bpmRef.current + 1);
      else if (event.key === "-") updateBpm(bpmRef.current - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [registerTap, togglePlayback, updateBpm]);

  useEffect(() => {
    if (currentStep < 0 || !drumGridScrollRef.current) return;
    const container = drumGridScrollRef.current;
    const cell = container.querySelector<HTMLElement>(`[data-step="${currentStep}"]`);
    if (!cell) return;
    const left = cell.offsetLeft;
    const right = left + cell.offsetWidth;
    if (left < container.scrollLeft + 74 || right > container.scrollLeft + container.clientWidth) {
      container.scrollTo({ left: Math.max(0, left - container.clientWidth * .42), behavior: "smooth" });
    }
  }, [currentStep]);

  const enableMidi = async () => {
    const requestMIDIAccess = (navigator as Navigator & { requestMIDIAccess?: () => Promise<MidiAccessLike> }).requestMIDIAccess;
    if (!requestMIDIAccess) return setMidiStatus("unsupported");
    try {
      const access = await requestMIDIAccess.call(navigator);
      midiAccessRef.current = access;
      const connectInputs = () => access.inputs.forEach((input) => {
        input.onmidimessage = (event) => {
          const [status, , velocity] = event.data;
          if ((status & 0xf0) === 0x90 && velocity > 0) togglePlayback();
        };
      });
      connectInputs();
      access.onstatechange = connectInputs;
      setMidiStatus("connected");
      showToast("MIDI-Pedal verbunden");
    } catch {
      setMidiStatus("denied");
    }
  };

  const changeMeter = (beats: number, denominator = meter.denominator) => {
    if (wantsPlaybackRef.current) stopPlayback();
    const nextMeter: Meter = { beats, denominator };
    const nextSubdivision = firstValidSubdivision(nextMeter, subdivisionRef.current);
    const nextGrouping = defaultGrouping(nextMeter);
    const nextTempoUnit = defaultTempoUnit(nextMeter, nextGrouping);
    meterRef.current = nextMeter;
    subdivisionRef.current = nextSubdivision;
    tempoUnitRef.current = nextTempoUnit;
    setMeterState(nextMeter);
    setSubdivisionState(nextSubdivision);
    setGrouping(nextGrouping);
    setTempoUnit(nextTempoUnit);
    const nextTracks = defaultDrumTracks(nextMeter, nextSubdivision);
    const nextSteps = mergeDrumTracks(nextTracks, stepsPerBar(nextMeter, nextSubdivision));
    stepsRef.current = nextSteps;
    drumTracksRef.current = nextTracks;
    setStepsState(nextSteps);
    setDrumTracks(nextTracks);
    if (editorOpen) {
      setEditorTracks(cloneDrumTracks(nextTracks));
      setEditorSteps([...nextSteps]);
      setEditorHistory([]);
    }
    originalFeelRef.current = null;
    feelModeRef.current = "quantized";
    setOriginalFeel(null);
    setFeelMode("quantized");
    setPatternName("Eigenes Drum-Pattern");
  };

  const changeSubdivision = (nextSubdivision: Subdivision) => {
    if (!hasExactGrid(meterRef.current, nextSubdivision)) return;
    if (wantsPlaybackRef.current) stopPlayback();
    subdivisionRef.current = nextSubdivision;
    setSubdivisionState(nextSubdivision);
    const nextTracks = defaultDrumTracks(meterRef.current, nextSubdivision);
    const nextSteps = mergeDrumTracks(nextTracks, stepsPerBar(meterRef.current, nextSubdivision));
    stepsRef.current = nextSteps;
    drumTracksRef.current = nextTracks;
    setStepsState(nextSteps);
    setDrumTracks(nextTracks);
    if (editorOpen) {
      setEditorTracks(cloneDrumTracks(nextTracks));
      setEditorSteps([...nextSteps]);
      setEditorHistory([]);
    }
    originalFeelRef.current = null;
    feelModeRef.current = "quantized";
    setOriginalFeel(null);
    setFeelMode("quantized");
    setPatternName("Eigenes Drum-Pattern");
  };

  const updateStep = (index: number) => {
    const next = stepsRef.current.map((step, stepIndex) => stepIndex === index ? cycleStep(step) : step);
    stepsRef.current = next;
    setStepsState(next);
    originalFeelRef.current = null;
    feelModeRef.current = "quantized";
    setOriginalFeel(null);
    setFeelMode("quantized");
    setPatternName("Eigenes Pattern");
  };

  const updateDrumHit = (voice: DrumVoice, index: number) => {
    const length = stepsRef.current.length;
    const base = normalizedDrumTracks(drumTracksRef.current || defaultDrumTracks(meterRef.current, subdivisionRef.current), length) || {};
    const next = cloneDrumTracks(base);
    const lane = [...(next[voice] || Array<DrumHitState>(length).fill("mute"))];
    const nextState = cycleDrumHit(lane[index] || "mute");
    lane[index] = nextState;
    next[voice] = lane;
    if (nextState !== "mute" && (voice === "closedHat" || voice === "openHat")) {
      const counterpart: DrumVoice = voice === "closedHat" ? "openHat" : "closedHat";
      if (next[counterpart]) {
        const counterpartLane = [...next[counterpart]!];
        counterpartLane[index] = "mute";
        next[counterpart] = counterpartLane;
      }
    }
    const summary = mergeDrumTracks(next, length);
    drumTracksRef.current = next;
    stepsRef.current = summary;
    setDrumTracks(next);
    setStepsState(summary);
    originalFeelRef.current = null;
    feelModeRef.current = "quantized";
    setOriginalFeel(null);
    setFeelMode("quantized");
    setPatternName("Eigenes Drum-Pattern");
  };

  const applyEditorPattern = (tracks: DrumTracks, length: number) => {
    const liveLength = Math.max(stepsPerBar(meterRef.current, subdivisionRef.current), length);
    const liveTracks = normalizedDrumTracks(tracks, liveLength) || {};
    const summary = mergeDrumTracks(liveTracks, liveLength);
    const cycleSteps = liveLength;
    nextStepRef.current %= cycleSteps;
    checkpointRef.current = { ...checkpointRef.current, nextStep: nextStepRef.current };
    drumTracksRef.current = liveTracks;
    stepsRef.current = summary;
    setEditorTracks(liveTracks);
    setEditorSteps(summary);
    setDrumTracks(liveTracks);
    setStepsState(summary);
    originalFeelRef.current = null;
    feelModeRef.current = "quantized";
    setOriginalFeel(null);
    setFeelMode("quantized");
    patternNameRef.current = "Eigenes Drum-Pattern";
    setPatternName("Eigenes Drum-Pattern");
  };

  const openEditor = (preset?: Pattern, trigger?: HTMLElement) => {
    if (preset) loadPattern(preset);
    const resolvedTrigger = trigger || document.activeElement as HTMLElement | null;
    const needsScroll = !resolvedTrigger?.closest(".beat-strip");
    editorTriggerRef.current = resolvedTrigger;
    const sourceSteps = preset?.pattern || stepsRef.current;
    const sourceLength = Math.max(stepsPerBar(meterRef.current, subdivisionRef.current), sourceSteps.length);
    const sourceTracks = normalizedDrumTracks(preset?.drumTracks || drumTracksRef.current || defaultDrumTracks(meterRef.current, subdivisionRef.current), sourceLength) || {};
    const sourceSummary = mergeDrumTracks(sourceTracks, sourceLength);
    if (sourceSteps.length < sourceLength) applyEditorPattern(sourceTracks, sourceLength);
    else {
      setEditorTracks(cloneDrumTracks(sourceTracks));
      setEditorSteps(sourceSummary);
    }
    setEditorHistory([]);
    setPresetName(preset?.name || patternNameRef.current || "Mein Pattern");
    setPresetCategory(preset?.category || "Eigene Presets");
    setEditingPresetId(preset?.id.startsWith("custom-") ? preset.id : null);
    setEditorOpen(true);
    window.setTimeout(() => {
      if (needsScroll) inlineEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      inlineEditorRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    window.setTimeout(() => editorTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!editorOpen) return;
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [closeEditor, editorOpen]);

  const updateEditorHit = (voice: DrumVoice, index: number) => {
    const length = editorSteps.length;
    setEditorHistory((current) => [...current.slice(-19), cloneDrumTracks(editorTracks)]);
    const next = cloneDrumTracks(editorTracks);
    const lane = [...(next[voice] || Array<DrumHitState>(length).fill("mute"))];
    const nextState = cycleDrumHit(lane[index] || "mute");
    lane[index] = nextState;
    next[voice] = lane;
    if (nextState !== "mute" && (voice === "closedHat" || voice === "openHat")) {
      const counterpart: DrumVoice = voice === "closedHat" ? "openHat" : "closedHat";
      const counterpartLane = [...(next[counterpart] || Array<DrumHitState>(length).fill("mute"))];
      counterpartLane[index] = "mute";
      next[counterpart] = counterpartLane;
    }
    applyEditorPattern(next, length);
  };

  const undoEditor = () => {
    const previous = editorHistory.at(-1);
    if (!previous) return;
    const previousLength = Math.max(...Object.values(previous).map((track) => track?.length || 0), 1);
    applyEditorPattern(previous, previousLength);
    setEditorHistory((current) => current.slice(0, -1));
  };

  const clearEditorLane = (voice: DrumVoice) => {
    setEditorHistory((current) => [...current.slice(-19), cloneDrumTracks(editorTracks)]);
    const next = cloneDrumTracks(editorTracks);
    next[voice] = Array<DrumHitState>(editorSteps.length).fill("mute");
    applyEditorPattern(next, editorSteps.length);
  };

  const resizeEditorBars = (bars: number) => {
    const length = stepsPerBar(meter, subdivision) * bars;
    setEditorHistory((current) => [...current.slice(-19), cloneDrumTracks(editorTracks)]);
    const next = normalizedDrumTracks(editorTracks, length) || {};
    applyEditorPattern(next, length);
  };

  const resetEditorPattern = () => {
    setEditorHistory((current) => [...current.slice(-19), cloneDrumTracks(editorTracks)]);
    const length = stepsPerBar(meter, subdivision);
    applyEditorPattern(defaultDrumTracks(meter, subdivision), length);
  };

  const loadPattern = (pattern: Pattern, autoStart = false, focusTrainer = true) => {
    const wasPlaying = wantsPlaybackRef.current;
    if (wasPlaying) stopPlayback();
    setEditorOpen(false);
    const nextMeter = parseMeter(pattern.meter);
    const nextGrouping = pattern.grouping?.reduce((sum, size) => sum + size, 0) === nextMeter.beats
      ? pattern.grouping
      : defaultGrouping(nextMeter);
    const nextTempoUnit = pattern.tempoUnit || defaultTempoUnit(nextMeter, nextGrouping);
    const nextSteps = normalizedSteps(
      pattern.pattern,
      stepsPerBar(nextMeter, pattern.subdivision) * Math.max(1, pattern.bars || 1),
    );
    const nextTracks = normalizedDrumTracks(pattern.drumTracks, nextSteps.length);
    const playback = pattern.playback || {};
    const nextSwing = playback.swing ?? 50;
    const nextTimerMinutes = playback.timerMinutes ?? 0;
    const nextRepeatBars = playback.repeatBars ?? 0;
    const nextTrainer = playback.trainer;
    currentPatternRef.current = pattern;
    activeSceneIdRef.current = `session-${pattern.id}`;
    meterRef.current = nextMeter;
    subdivisionRef.current = pattern.subdivision;
    stepsRef.current = nextSteps;
    drumTracksRef.current = nextTracks;
    tempoUnitRef.current = nextTempoUnit;
    swingRef.current = nextSwing;
    timerMinutesRef.current = nextTimerMinutes;
    repeatBarsRef.current = nextRepeatBars;
    trainerRef.current = Boolean(nextTrainer);
    trainerModeRef.current = nextTrainer?.mode ?? "up";
    trainerStepRef.current = nextTrainer?.step ?? 5;
    trainerEveryRef.current = nextTrainer?.every ?? 8;
    trainerMinRef.current = nextTrainer?.min ?? 20;
    trainerMaxRef.current = nextTrainer?.max ?? 300;
    trainerDirectionRef.current = 1;
    timerRemainingRef.current = nextTimerMinutes * 60_000;
    setMeterState(nextMeter);
    setSubdivisionState(pattern.subdivision);
    setStepsState(nextSteps);
    setDrumTracks(nextTracks);
    setGrouping(nextGrouping);
    setTempoUnit(nextTempoUnit);
    setSwing(nextSwing);
    setTimerMinutes(nextTimerMinutes);
    setTimerText(nextTimerMinutes ? `${nextTimerMinutes}:00` : "∞");
    setRepeatBars(nextRepeatBars);
    setTrainer(Boolean(nextTrainer));
    setTrainerMode(nextTrainer?.mode ?? "up");
    setTrainerStep(nextTrainer?.step ?? 5);
    setTrainerEvery(nextTrainer?.every ?? 8);
    setTrainerMin(nextTrainer?.min ?? 20);
    setTrainerMax(nextTrainer?.max ?? 300);
    setPatternId(pattern.id);
    setPatternName(pattern.name);
    setPatternInstruction(pattern.instruction);
    setPatternAttribution(pattern.attribution || (pattern.source ? "Quellenbasierte Übungsrekonstruktion" : "Genreübung"));
    setPatternGoals(learningGoalsFor(pattern));
    currentStageRef.current = "original";
    setCurrentStage("original");
    practiceModeRef.current = { type: "normal" };
    setPracticeMode({ type: "normal" });
    originalFeelRef.current = pattern.originalFeel || null;
    feelModeRef.current = "quantized";
    setOriginalFeel(pattern.originalFeel || null);
    setFeelMode("quantized");
    if (playback.bpm !== undefined) updateBpm(playback.bpm);
    else if (bpmRef.current < pattern.bpmMin || bpmRef.current > pattern.bpmMax) updateBpm(Math.round((pattern.bpmMin + pattern.bpmMax) / 2));
    setRecent((current) => {
      const next = [pattern, ...current.filter((item) => item.id !== pattern.id)].slice(0, 8);
      void persistStore("recent", next);
      return next;
    });
    showToast(`${pattern.name} geladen`);
    if (focusTrainer) {
      setSection("trainer");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (autoStart || wasPlaying) void startPlayback(false);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      void persistStore("favorites", next);
      return next;
    });
  };

  const loadScene = (scene: Scene, patternOnly = false, bpmOffset = 0) => {
    const pattern = scene.customPattern || library.find((item) => item.id === scene.patternId) || presets.find((item) => item.id === scene.patternId);
    if (!pattern) return showToast("Das Pattern dieser Scene ist nicht mehr verfügbar.");
    const retainedKit = soundRef.current;
    loadPattern(pattern);
    activeSceneIdRef.current = scene.id;
    if (patternOnly) {
      void changeDrumKit(retainedKit);
      return;
    }
    updateBpm(scene.bpm + bpmOffset);
    void changeDrumKit(scene.kit);
    voiceVolumesRef.current = { ...DEFAULT_VOICE_VOLUMES, ...scene.voiceVolumes };
    setVoiceVolumes({ ...DEFAULT_VOICE_VOLUMES, ...scene.voiceVolumes });
    swingRef.current = scene.swing;
    setSwing(scene.swing);
    const nextFeel = scene.feelAmount > 0 && pattern.originalFeel ? "original" : "quantized";
    feelModeRef.current = nextFeel;
    setFeelMode(nextFeel);
    trainerRef.current = Boolean(scene.trainer);
    setTrainer(Boolean(scene.trainer));
    if (scene.trainer) {
      trainerModeRef.current = scene.trainer.mode;
      trainerStepRef.current = scene.trainer.step;
      trainerEveryRef.current = scene.trainer.every;
      trainerMinRef.current = scene.trainer.min;
      trainerMaxRef.current = scene.trainer.max;
      setTrainerMode(scene.trainer.mode);
      setTrainerStep(scene.trainer.step);
      setTrainerEvery(scene.trainer.every);
      setTrainerMin(scene.trainer.min);
      setTrainerMax(scene.trainer.max);
    }
    const nextMode = scene.practiceMode || { type: "normal" };
    practiceModeRef.current = nextMode;
    setPracticeMode(nextMode);
    showToast(`${scene.name} vollständig geladen`);
  };

  const saveCurrentScene = async () => {
    const scene = currentScene(`scene-${Date.now()}`);
    const next = [scene, ...scenes];
    if (!await persistStore("scenes", next)) return;
    setScenes(next);
    activeSceneIdRef.current = scene.id;
    showToast("Scene vollständig gespeichert");
  };

  const duplicateScene = async (scene: Scene) => {
    const copy: Scene = { ...scene, id: `scene-${Date.now()}`, name: `${scene.name} · Variante`, sourceSceneId: scene.id, createdAt: new Date().toISOString() };
    const next = [copy, ...scenes];
    if (!await persistStore("scenes", next)) return;
    setScenes(next);
    showToast("Scene-Variante erstellt");
  };

  const deleteSceneById = async (id: string) => {
    const next = scenes.filter((scene) => scene.id !== id);
    if (!await persistStore("scenes", next)) return;
    setScenes(next);
    showToast("Scene gelöscht");
  };

  const selectLadderStage = (stageId: string) => {
    const pattern = currentPatternRef.current;
    currentStageRef.current = stageId;
    setCurrentStage(stageId);
    if (stageId === "skeleton" && pattern.drumTracks) {
      const length = pattern.pattern.length;
      const barLength = stepsPerBar(parseMeter(pattern.meter), pattern.subdivision);
      const skeleton = Object.fromEntries(DRUM_VOICES.flatMap((voice) => {
        const track = pattern.drumTracks?.[voice];
        if (!track) return [];
        const lane = track.map((hit, index) => {
          if (["crash", "openHat", "ride", "highTom", "lowTom"].includes(voice)) return "mute";
          if (hit === "ghost") return "mute";
          if (voice === "closedHat" && index % Math.max(1, Math.round(barLength / parseMeter(pattern.meter).beats)) !== 0) return "mute";
          return hit;
        });
        return [[voice, lane]];
      })) as DrumTracks;
      const summary = mergeDrumTracks(skeleton, length);
      drumTracksRef.current = skeleton;
      stepsRef.current = summary;
      setDrumTracks(skeleton);
      setStepsState(summary);
    } else if (["original", "dynamics", "pocket"].includes(stageId)) {
      const tracks = normalizedDrumTracks(pattern.drumTracks, pattern.pattern.length);
      drumTracksRef.current = tracks;
      stepsRef.current = [...pattern.pattern];
      setDrumTracks(tracks);
      setStepsState([...pattern.pattern]);
    }
    const mode: PracticeModeConfig = stageId === "internal-time" ? { type: "gap", audibleBars: 3, silentBars: 1 }
      : stageId === "independence" ? { type: "voice-dropout", voices: ["closedHat"], schedule: { audibleBars: 3, silentBars: 1 } }
        : { type: "normal" };
    practiceModeRef.current = mode;
    setPracticeMode(mode);
    if (stageId === "pocket" && pattern.originalFeel) { feelModeRef.current = "original"; setFeelMode("original"); }
    if (stageId === "tempo") { trainerRef.current = true; setTrainer(true); }
  };

  const rateResult = (rating: PracticeResult["selfRating"]) => {
    if (!recap || !rating) return;
    const rated = { ...recap, selfRating: rating };
    const next = practiceHistoryRef.current.map((result) => result.id === rated.id ? rated : result);
    practiceHistoryRef.current = next;
    setPracticeHistory(next);
    setRecap(rated);
    void persistStore("practiceResults", next);
  };

  const cacheAllKits = () => {
    setOfflineDownloadPending(true);
    navigator.serviceWorker?.controller?.postMessage({ type: "CACHE_ALL_KITS" });
  };

  const resumeSnapshot = (restart = false, bpmOffset = 0) => {
    if (!lastSnapshot) return;
    loadScene(lastSnapshot.scene, false, bpmOffset);
    const stage = restart ? "original" : lastSnapshot.currentStage || "original";
    currentStageRef.current = stage;
    setCurrentStage(stage);
    barsRef.current = restart ? 0 : lastSnapshot.barsCompleted;
    setSessionBars(barsRef.current);
    nextStepRef.current = 0;
    activeElapsedMsRef.current = restart ? 0 : lastSnapshot.activeSeconds * 1000;
    sessionStartedAtRef.current = 1;
    sessionStartBpmRef.current = lastSnapshot.scene.bpm + bpmOffset;
    checkpointRef.current = { nextStep: 0, bars: barsRef.current, bpm: lastSnapshot.scene.bpm + bpmOffset, trainerDirection: 1 };
    void startPlayback(true);
  };

  const savePreset = async () => {
    const nextId = editingPresetId || `custom-${Date.now()}`;
    const preset: Pattern = {
      id: nextId,
      name: presetName.trim() || "Mein Pattern",
      category: presetCategory,
      bpmMin: bpm,
      bpmMax: bpm,
      meter: `${meter.beats}/${meter.denominator}`,
      subdivision,
      bars: Math.max(1, Math.round(editorSteps.length / stepsPerBar(meter, subdivision))),
      grouping: [...grouping],
      tempoUnit,
      pattern: [...editorSteps],
      drumTracks: cloneDrumTracks(editorTracks),
      drumOnly: true,
      difficulty: "Mittel",
      instruction: "Eigenes Drum-Pattern — Groove und Dynamik konzentriert wiederholen.",
      attribution: "Eigenes Preset",
      learningGoals: ["Eigene Übung"],
      whyInteresting: "Individuell zusammengestelltes Trainingspattern.",
      playback: {
        bpm,
        swing,
        kit: sound,
        ...(timerMinutes ? { timerMinutes } : {}),
        ...(repeatBars ? { repeatBars } : {}),
        ...(trainer ? {
          trainer: {
            mode: trainerMode,
            step: trainerStep,
            every: trainerEvery,
            min: trainerMinRef.current,
            max: trainerMaxRef.current,
          },
        } : {}),
      },
    };
    const nextPresets = editingPresetId
      ? presets.map((item) => item.id === editingPresetId ? preset : item)
      : [preset, ...presets];
    const saved = await persistStore("presets", nextPresets);
    if (!saved) return;
    const scene = createScene(preset, {
      id: `scene-${Date.now()}`,
      name: preset.name,
      bpm,
      kit: sound,
      voiceVolumes,
      swing,
      feelAmount: feelMode === "original" ? 1 : 0,
      trainer: trainer ? { mode: trainerMode, step: trainerStep, every: trainerEvery, min: trainerMin, max: trainerMax } : undefined,
      practiceMode,
    });
    const nextScenes = [scene, ...scenes];
    await persistStore("scenes", nextScenes);
    setPresets(nextPresets);
    setScenes(nextScenes);
    activeSceneIdRef.current = scene.id;
    setPatternId(preset.id);
    setPatternName(preset.name);
    setPatternInstruction(preset.instruction);
    setPatternAttribution("Eigenes Preset");
    setPatternGoals(["Eigene Übung"]);
    currentPatternRef.current = preset;
    setEditingPresetId(preset.id);
    drumTracksRef.current = cloneDrumTracks(editorTracks);
    stepsRef.current = [...editorSteps];
    setDrumTracks(cloneDrumTracks(editorTracks));
    setStepsState([...editorSteps]);
    showToast(editingPresetId ? "Pattern aktualisiert" : "Pattern offline gespeichert");
  };

  const deletePresetById = async (id: string) => {
    const next = presets.filter((item) => item.id !== id);
    if (!await persistStore("presets", next)) return;
    setPresets(next);
    await deleteStore(`preset:${id}`).catch(() => undefined);
    showToast("Preset gelöscht");
  };

  const exportLocalData = () => {
    const payload = JSON.stringify({ version: DATA_SCHEMA_VERSION, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), presets, scenes, favorites, practiceResults: practiceHistory, lastSessionSnapshot: lastSnapshot }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `drumgrid-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importLocalData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { presets?: Pattern[]; scenes?: Scene[]; favorites?: string[]; practiceHistory?: PracticeEntry[]; practiceResults?: PracticeResult[]; lastSessionSnapshot?: LastSessionSnapshot };
      const importedPresets = Array.isArray(data.presets) ? data.presets.filter((item) => item?.id && item?.drumTracks && Array.isArray(item.pattern)) : [];
      const merged = [...importedPresets, ...presets.filter((item) => !importedPresets.some((candidate) => candidate.id === item.id))];
      const importedScenes = Array.isArray(data.scenes) ? data.scenes.filter((scene) => scene?.id && (scene.patternId || scene.customPattern)) : migrateLegacyPresets(importedPresets);
      const mergedScenes = [...importedScenes, ...scenes.filter((scene) => !importedScenes.some((candidate) => candidate.id === scene.id))];
      const importedResults = Array.isArray(data.practiceResults) ? data.practiceResults : migrateLegacyPractice(Array.isArray(data.practiceHistory) ? data.practiceHistory : []);
      await Promise.all([
        persistStore("presets", merged),
        persistStore("scenes", mergedScenes),
        persistStore("favorites", Array.isArray(data.favorites) ? data.favorites : favorites),
        persistStore("practiceResults", importedResults.length ? importedResults : practiceHistory),
        persistStore("lastSessionSnapshot", data.lastSessionSnapshot || lastSnapshot),
      ]);
      setPresets(merged);
      setScenes(mergedScenes);
      if (Array.isArray(data.favorites)) setFavorites(data.favorites);
      if (importedResults.length) setPracticeHistory(importedResults);
      if (data.lastSessionSnapshot) setLastSnapshot(data.lastSessionSnapshot);
      showToast(`${importedScenes.length} Scenes importiert`);
    } catch {
      setStorageError("Diese Backup-Datei ist ungültig.");
    }
  };

  const meters = useMemo(() => ["Alle", ...new Set(library.map((pattern) => pattern.meter))], [library]);
  const query = search.trim().toLocaleLowerCase("de");
  const patternsWithoutStyle = useMemo(() => library.filter((pattern) => matchesSearchQuery(pattern, query)
    && (patternTypeFilter === "Alle" || pattern.patternType === patternTypeFilter)
    && matchesLearningFilters(pattern, learningFilters, practiceHistory)), [library, query, patternTypeFilter, learningFilters, practiceHistory]);
  const filteredPatterns = useMemo(() => patternsWithoutStyle.filter((pattern) => matchesStyleSelection(pattern, category)), [patternsWithoutStyle, category]);
  const categoryCounts = useMemo(() => new Map(PATTERN_CATEGORIES.map((item) => [item, patternsWithoutStyle.filter((pattern) => pattern.category === item).length])), [patternsWithoutStyle]);
  const typeCountPatterns = useMemo(() => library.filter((pattern) => matchesSearchQuery(pattern, query)
    && matchesStyleSelection(pattern, category)
    && matchesLearningFilters(pattern, learningFilters, practiceHistory)), [library, query, category, learningFilters, practiceHistory]);
  const patternTypeCounts = useMemo(() => new Map(PATTERN_TYPES.map((item) => [item, typeCountPatterns.filter((pattern) => pattern.patternType === item).length])), [typeCountPatterns]);
  const availablePatternTypes = useMemo(() => PATTERN_TYPES.filter((item) => library.some((pattern) => pattern.patternType === item)), [library]);

  const recommendations = useMemo(() => dailyRecommendations(library, practiceHistory, favorites), [library, practiceHistory, favorites]);
  const activeFilterChips = useMemo(() => [
    category !== "Alle" ? ["category", `Stil · ${styleSelectionLabel(category)}`] : null,
    patternTypeFilter !== "Alle" ? ["patternType", `Art · ${PATTERN_TYPE_INFO[patternTypeFilter as PatternType].label}`] : null,
    learningFilters.difficulty !== "Alle" ? ["difficulty", `Niveau · ${learningFilters.difficulty}`] : null,
    learningFilters.skillId !== "Alle" ? ["skillId", `Ziel · ${SKILLS.find((skill) => skill.id === learningFilters.skillId)?.label || learningFilters.skillId}`] : null,
    learningFilters.meter !== "Alle" ? ["meter", `Takt · ${learningFilters.meter}`] : null,
    learningFilters.subdivision !== "Alle" ? ["subdivision", `Raster · ${learningFilters.subdivision}`] : null,
    learningFilters.feel ? ["feel", "Original Feel"] : null,
    learningFilters.length !== "Alle" ? ["length", `Länge · ${learningFilters.length}`] : null,
    learningFilters.kit !== "Alle" ? ["kit", `Kit · ${drumKitLabel(learningFilters.kit as DrumKit)}`] : null,
    learningFilters.tempo !== null ? ["tempo", `${learningFilters.tempo} BPM`] : null,
    learningFilters.unpracticed ? ["unpracticed", "Noch nicht geübt"] : null,
    learningFilters.difficult ? ["difficult", "Zuletzt schwierig"] : null,
  ].filter(Boolean) as Array<[LibraryFilterKey, string]>, [category, patternTypeFilter, learningFilters]);
  const detailFilterCount = activeFilterChips.filter(([key]) => key !== "category").length;
  const hasActiveLibraryCriteria = Boolean(search) || activeFilterChips.length > 0;
  const advancedFiltersActive = learningFilters.subdivision !== "Alle" || learningFilters.length !== "Alle" || learningFilters.kit !== "Alle" || learningFilters.feel || learningFilters.tempo !== null;

  const clearLibraryFilter = (key: LibraryFilterKey) => {
    if (key === "category") return setCategory("Alle");
    if (key === "patternType") return setPatternTypeFilter("Alle");
    setLearningFilters((current) => ({
      ...current,
      [key]: key === "feel" || key === "unpracticed" || key === "difficult" ? false : key === "tempo" ? null : "Alle",
    }));
  };

  const resetLibraryFilters = (clearSearch = true) => {
    if (clearSearch) setSearch("");
    setCategory("Alle");
    setPatternTypeFilter("Alle");
    setLearningFilters({ ...EMPTY_LIBRARY_FILTERS });
    setAdvancedFiltersOpen(false);
    setVisibleCount(18);
  };

  const applyQuickFilter = (id: QuickFilterId) => {
    const next = { ...EMPTY_LIBRARY_FILTERS };
    let nextType = "Alle";
    if (id === "easy") next.difficulty = "Leicht";
    if (id === "timing") next.skillId = "timing-pulse";
    if (id === "pocket") next.skillId = "pocket-straight";
    if (id === "break") nextType = "Break";
    if (id === "technique") nextType = "Technik";
    if (id === "continue") next.difficult = true;
    setSearch(""); setCategory("Alle"); setPatternTypeFilter(nextType); setLearningFilters(next); setAdvancedFiltersOpen(false); setVisibleCount(18);
  };

  const quickFilterActive = (id: QuickFilterId) => id === "easy" ? learningFilters.difficulty === "Leicht"
    : id === "timing" ? learningFilters.skillId === "timing-pulse"
      : id === "pocket" ? learningFilters.skillId === "pocket-straight"
        : id === "break" ? patternTypeFilter === "Break"
          : id === "technique" ? patternTypeFilter === "Technik"
            : learningFilters.difficult;

  useEffect(() => {
    if (!stylePickerOpen && !filterPanelOpen) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocusTo = stylePickerOpen ? stylePickerTriggerRef.current : filterPanelTriggerRef.current;
    const closePanel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setStylePickerOpen(false); setFilterPanelOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closePanel);
    (stylePickerOpen ? stylePickerCloseRef.current : filterPanelCloseRef.current)?.focus();
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closePanel); returnFocusTo?.focus(); };
  }, [stylePickerOpen, filterPanelOpen]);

  const resetControls = () => {
    volumeRef.current = 72; soundRef.current = "707"; swingRef.current = 50; timerMinutesRef.current = 0;
    voiceVolumesRef.current = { ...DEFAULT_VOICE_VOLUMES };
    repeatBarsRef.current = 0; trainerRef.current = false; trainerModeRef.current = "up"; trainerMinRef.current = 20; trainerMaxRef.current = 300; trainerDirectionRef.current = 1;
    timerRemainingRef.current = 0;
    feelModeRef.current = "quantized";
    setVolume(72); setVoiceVolumes({ ...DEFAULT_VOICE_VOLUMES }); setSound("707"); setSwing(50); setTimerMinutes(0); setTimerText("∞"); setRepeatBars(0); setTrainer(false); setTrainerMode("up"); setTrainerMin(20); setTrainerMax(300);
    setFeelMode("quantized");
    showToast("Einstellungen zurückgesetzt");
  };

  const chooseSession = (kind: SessionKind) => {
    setSessionKind(kind);
    if (kind === "free") {
      timerMinutesRef.current = 0; trainerRef.current = false;
      setTimerMinutes(0); setTimerText("∞"); setTrainer(false);
    } else if (kind === "timing") {
      timerMinutesRef.current = 5; trainerRef.current = false;
      setTimerMinutes(5); setTimerText("5:00"); setTrainer(false);
    } else if (kind === "groove") {
      timerMinutesRef.current = 10; trainerRef.current = false;
      setTimerMinutes(10); setTimerText("10:00"); setTrainer(false);
    } else {
      timerMinutesRef.current = 10; trainerRef.current = true; trainerModeRef.current = "pyramid";
      trainerMinRef.current = bpmRef.current; trainerMaxRef.current = Math.min(300, bpmRef.current + 30);
      setTimerMinutes(10); setTimerText("10:00"); setTrainer(true); setTrainerMode("pyramid"); setTrainerMin(bpmRef.current); setTrainerMax(Math.min(300, bpmRef.current + 30));
    }
    showToast(kind === "free" ? "Freies Training" : kind === "timing" ? "5 Minuten Timing" : kind === "groove" ? "10 Minuten Groove" : "Tempo-Pyramide bereit");
  };

  const navigateTo = (next: AppSection) => {
    setSection(next);
    const id = next === "trainer" ? "trainer" : next === "library" ? "bibliothek" : "meine-grooves";
    document.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const applyUpdate = () => {
    navigator.serviceWorker?.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    updateRegistrationRef.current?.waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  const clearAllLocalData = async () => {
    try {
      await clearLocalData();
      setFavorites([]); setPresets([]); setScenes([]); setRecent([]); setPracticeHistory([]); setLastSnapshot(null); setRecap(null);
      showToast("Lokale Daten gelöscht");
    } catch {
      setStorageError("Lokale Daten konnten nicht gelöscht werden.");
    }
  };

  const meterLabel = `${meter.beats}/${meter.denominator}`;
  const isPlaying = phase === "running";
  const cycleBars = Math.max(1, Math.round(steps.length / stepsPerBar(meter, subdivision)));
  const favoritePatterns = library.filter((item) => favorites.includes(item.id));
  const practicedMinutes = Math.round(practiceHistory.reduce((sum, item) => sum + item.activeSeconds, 0) / 60);
  const activeDrumEntries = useMemo<Array<[DrumVoice, DrumHitState[]]>>(() => DRUM_VOICES.flatMap((voice) => {
    const track = drumTracks?.[voice];
    return track?.some((state) => state !== "mute") ? [[voice, track] as [DrumVoice, DrumHitState[]]] : [];
  }), [drumTracks]);
  const audioFeedbackMarkers = useMemo(() => {
    const markers = new Map<number, { timeMs: number; kind: "matched" | "missed"; offsetMs?: number; classification?: "early" | "on-time" | "late" }>();
    for (const item of audioFeedbackAnalysis?.missed || []) {
      const current = markers.get(item.expected.stepIndex);
      if (!current || current.timeMs <= item.expected.timeMs) markers.set(item.expected.stepIndex, { timeMs: item.expected.timeMs, kind: "missed" });
    }
    for (const item of audioFeedbackAnalysis?.matched || []) {
      const current = markers.get(item.expected.stepIndex);
      if (!current || current.timeMs <= item.expected.timeMs) markers.set(item.expected.stepIndex, {
        timeMs: item.expected.timeMs,
        kind: "matched",
        offsetMs: item.offsetMs,
        classification: item.classification,
      });
    }
    return markers;
  }, [audioFeedbackAnalysis]);
  const ladderStages = useMemo(() => ladderFor(library.find((pattern) => pattern.id === patternId) || presets.find((pattern) => pattern.id === patternId) || FALLBACK_PATTERNS[0]), [library, patternId, presets]);
  const phaseLabel = phase === "running" ? "Läuft" : phase === "starting" ? "Startet …" : phase === "recovering" ? "Audio kommt zurück …" : phase === "lifecycle-paused" ? "Im Hintergrund pausiert" : "Bereit";
  const pwaLabel = pwaStatus === "update" ? "Update bereit" : !online ? offlineStatus.appReady ? "App offline bereit" : "Offline eingeschränkt" : offlineStatus.appReady
    ? offlineStatus.availableKits >= offlineStatus.totalKits ? "Offline bereit" : `App offline · ${offlineStatus.availableKits}/${offlineStatus.totalKits} Kits`
    : pwaStatus === "error" ? "Nur online" : "Wird vorbereitet";
  const feedbackStatusLabel = audioFeedbackStatus === "listening" ? "Hört zu" : audioFeedbackStatus === "ready" ? "Bereit" : audioFeedbackStatus === "requesting" ? calibratingLatency ? `Kalibrierung ${calibrationProgress}/6` : "Mikrofon wird geöffnet" : audioFeedbackStatus === "denied" ? "Mikrofon abgelehnt" : audioFeedbackStatus === "unsupported" ? "Nicht unterstützt" : audioFeedbackStatus === "error" ? "Audiofehler" : "Aus";
  const latencySourceLabel = audioFeedbackConfig.latencySource === "calibrated" ? "gemessen" : audioFeedbackConfig.latencySource === "manual" ? "manuell" : "geschätzt";
  const liveFeedback = audioFeedbackAnalysis?.overall;
  const feedbackStepDurationMs = useMemo(() => {
    const barSteps = Math.max(1, stepsPerBar(meter, subdivision));
    const tempoUnitScale = tempoUnit === "dotted-quarter" ? 1.5 : tempoUnit === "eighth" ? .5 : 1;
    return (meter.beats * 4 / meter.denominator) / tempoUnitScale * (60_000 / Math.max(20, bpm)) / barSteps;
  }, [bpm, meter, subdivision, tempoUnit]);
  const recapTiming = recap?.timingResult;
  const recapOverallTiming = recapTiming?.observations.find((item) => item.voice === "all") || recapTiming?.observations[0];

  useEffect(() => {
    if (phase !== "running") return;
    const interval = window.setInterval(() => saveLastSnapshot(), 5000);
    return () => window.clearInterval(interval);
  }, [phase, saveLastSnapshot]);

  return (
    <main className="app-shell">
      <div className="app-content">
      <div className="page">
        <header className="app-titlebar">
          <span className="brand-glyph" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="title-rail" aria-hidden="true" />
          <div className="app-brand"><strong>drumgrid</strong><small>DRUM PRACTICE WORKSTATION</small></div>
          <span className="title-rail" aria-hidden="true" />
          <span className="title-version">V3.0</span>
        </header>
        <section className="practice-bar" id="trainer" aria-label="Training wählen">
          <h1 className="sr-only">drumgrid Drum-Trainer</h1>
          <nav className="desktop-nav" aria-label="Hauptnavigation">
            <button className={section === "trainer" ? "active" : ""} onClick={() => navigateTo("trainer")}>Üben</button>
            <button className={section === "library" ? "active" : ""} onClick={() => navigateTo("library")}>Patterns</button>
            <button className={section === "mine" ? "active" : ""} onClick={() => navigateTo("mine")}>Meine</button>
          </nav>
          <div className="session-options" aria-label="Session wählen">
            {([
              ["free", "Frei"], ["timing", "5m Timing"], ["groove", "10m Groove"], ["speed", "Pyramide"],
            ] as Array<[SessionKind, string]>).map(([kind, title]) => <button key={kind} className={sessionKind === kind ? "active" : ""} aria-pressed={sessionKind === kind} onClick={() => chooseSession(kind)}>{title}</button>)}
          </div>
          <button className={`status-pill ${pwaStatus}`} onClick={pwaStatus === "update" ? applyUpdate : installPrompt ? installApp : undefined} title={pwaLabel} aria-label={pwaLabel}><span className="status-dot" /><span>{installPrompt && pwaStatus === "ready" ? "Installieren" : pwaLabel}</span></button>
        </section>
        <section className="coach-deck" aria-label="Dein Übecoach">
          {lastSnapshot && <article className="continue-card">
            <div><small>Weiterüben</small><strong>{lastSnapshot.scene.name} · {lastSnapshot.scene.bpm} BPM · {drumKitLabel(lastSnapshot.scene.kit)}</strong><span>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastSnapshot.savedAt))} · {Math.max(1, Math.round(lastSnapshot.activeSeconds / 60))} Min. · {lastSnapshot.currentStage || "Originalform"}</span></div>
            <div className="coach-actions"><button className="primary" onClick={() => resumeSnapshot(false)}>▶ Exakt fortsetzen</button><button onClick={() => resumeSnapshot(true)}>Neu beginnen</button><button onClick={() => resumeSnapshot(false, 3)}>+3 BPM</button></div>
          </article>}
          <article className="daily-card">
            <div className="coach-card-head"><div><small>Heute für dich</small><strong>10 Minuten · lokal zusammengestellt</strong></div><span>Warm-up · Fokus · Neu · Internal Time</span></div>
            <div className="daily-list">{recommendations.map(({ pattern, reason }, index) => <button key={pattern.id} onClick={() => loadPattern(pattern)}><b>{index + 1}</b><span><strong>{pattern.name}</strong><small>{index === 0 ? "2 Min." : index === 1 ? "4 Min." : "2 Min."} · {reason}</small></span></button>)}</div>
          </article>
          <article className="offline-card"><small>Offline-Stand</small><strong>{offlineStatus.appReady ? "App bereit" : "App wird geprüft"}</strong><span>{offlineStatus.availableKits} von {offlineStatus.totalKits} Kits verfügbar</span>{offlineStatus.availableKits < offlineStatus.totalKits && <button onClick={cacheAllKits} disabled={offlineDownloadPending}>{offlineDownloadPending ? "Wird gespeichert …" : `Alle Kits offline · ${(offlineStatus.totalAudioBytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 2 })} MB`}</button>}</article>
        </section>
        <section className="workspace" aria-label="Drum-Groove-Trainer">
          <div className="panel metronome-panel">
            <div className="meter-head">
              <div className="live-label"><span className={`live-pulse ${isPlaying ? "playing" : ""}`} />{phaseLabel}</div>
              <div className="sound-label">{drumKitLabel(sound)} · {volume}%</div>
            </div>
            <div className="session-context">
              <div><span className="authenticity-badge">{patternAttribution}</span><strong>{patternInstruction}</strong></div>
              <div className="goal-tags">{patternGoals.map((goal) => <span key={goal}>{goal}</span>)}</div>
              <div className="session-progress" aria-live="polite"><span>{sessionBars} Takte</span><span>{timerText === "∞" ? "freie Session" : `${timerText} verbleibend`}</span></div>
              <div className="ladder-control"><label htmlFor="ladder-stage">Lernleiter</label><select id="ladder-stage" value={currentStage} onChange={(event) => selectLadderStage(event.target.value)}>{ladderStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label} · {stage.description}</option>)}</select><button onClick={() => void saveCurrentScene()}>Scene speichern</button></div>
            </div>
            <div className="tempo-toolbar" aria-label="Tempo">
              <button className="play-button tempo-play" onClick={togglePlayback} aria-label={isPlaying ? "Wiedergabe stoppen" : "Abspielen"} aria-pressed={isPlaying}>{isPlaying ? "Ⅱ" : "▶"}</button>
              <button className="tap-compact" onClick={tapTempo}>TAP</button>
              <button className="nudge" onClick={() => updateBpm(bpmRef.current - 1)} aria-label="Tempo um eins verringern">−</button>
              <label className="bpm-compact"><input type="number" min="20" max="300" value={bpm} onChange={(event) => updateBpm(Number(event.target.value))} aria-label="Tempo in BPM" /><span>BPM</span></label>
              <button className="nudge" onClick={() => updateBpm(bpmRef.current + 1)} aria-label="Tempo um eins erhöhen">+</button>
              <input className="tempo-range" type="range" min="20" max="300" value={bpm} onChange={(event) => updateBpm(Number(event.target.value))} aria-label="Tempo-Regler" />
              <FftSpectrum analyserRef={analyserRef} active={isPlaying} />
            </div>

            <div className="beat-strip">
              <div className="beat-strip-top">
                <div><div className="pattern-name">{patternName}</div><div className="pattern-meta">{meterLabel} · {subdivision} · {steps.length} Schritte{cycleBars > 1 ? ` · ${cycleBars} Takte` : ""}</div></div>
                <div className="beat-strip-actions">{audioFeedbackEnabled && <span className={`feedback-live-pill ${audioFeedbackStatus}`}><i />{feedbackStatusLabel}{liveFeedback?.matchedHits ? ` · ${Math.round(liveFeedback.meanAbsoluteMs)} ms · ${Math.round(liveFeedback.hitRate)}%` : ""}</span>}<button className={`edit-link ${editorOpen ? "active" : ""}`} aria-expanded={editorOpen} aria-controls="inline-pattern-editor" onClick={(event) => editorOpen ? closeEditor() : openEditor(undefined, event.currentTarget)}>{editorOpen ? "Bearbeitung beenden" : "Pattern bearbeiten"}</button></div>
              </div>
              {editorOpen ? <section id="inline-pattern-editor" className="inline-editor" ref={inlineEditorRef} tabIndex={-1} aria-labelledby="inline-editor-title">
                <div className="inline-editor-head"><div><strong id="inline-editor-title">Pattern live bearbeiten</strong><span>Änderungen wirken sofort. Beim Speichern bleiben Pattern, Kit, Tempo und Training gemeinsam als Scene erhalten.</span></div><span className="live-edit-badge">LIVE</span></div>
                <div className="editor-toolbar">
                  <label>Takte<select value={Math.max(1, Math.round(editorSteps.length / stepsPerBar(meter, subdivision)))} onChange={(event) => resizeEditorBars(Number(event.target.value))}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                  <button onClick={togglePlayback}>{isPlaying ? "Ⅱ Stop" : "▶ Vorschau"}</button>
                  <button onClick={undoEditor} disabled={!editorHistory.length}>↶ Rückgängig</button>
                  <button onClick={resetEditorPattern}>Grundmuster</button>
                  <span>{meterLabel} · {subdivision} · {editorSteps.length} Schritte</span>
                </div>
                <div className="drum-editor-scroll" role="region" aria-label="Drum-Pattern bearbeiten">
                  <div className="drum-editor-grid">
                    {DRUM_VOICES.map((voice) => {
                      const track = editorTracks[voice] || Array<DrumHitState>(editorSteps.length).fill("mute");
                      return <div className="drum-lane editor-lane" key={voice} style={{ gridTemplateColumns: `94px repeat(${editorSteps.length}, minmax(40px, 1fr))` }}>
                        <VoiceLaneLabel voice={voice} volume={voiceVolumes[voice]} onVolumeChange={updateVoiceVolume} onClear={() => clearEditorLane(voice)} />
                        {track.map((state, index) => <button key={index} tabIndex={index === 0 ? 0 : -1} className={`editor-step ${state} ${currentStep === index ? "current" : ""} ${index % stepsPerBar(meter, subdivision) === 0 ? "bar-start" : ""}`} onClick={() => updateEditorHit(voice, index)} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); const cells = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(".editor-step") || []); cells[Math.max(0, Math.min(cells.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))]?.focus(); }} aria-label={`${DRUM_LABELS[voice]}, Schritt ${index + 1}: ${HIT_LABELS[state]}`} aria-pressed={state !== "mute"}>{index + 1}</button>)}
                      </div>;
                    })}
                  </div>
                </div>
                <div className="editor-legend"><span><i className="legend-dot accent" />Akzent</span><span><i className="legend-dot" />Schlag</span><span><i className="legend-dot ghost" />Ghostnote</span><span><i className="legend-dot mute" />Stille</span></div>
                <div className="inline-editor-footer">
                  <div className="editor-fields"><input className="text-field" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Name der Scene" aria-label="Scene-Name" /><select className="field-select" value={presetCategory} onChange={(event) => setPresetCategory(event.target.value)} aria-label="Pattern-Kategorie"><option>Eigene Presets</option><option>Groove</option><option>Rudiment</option><option>Timing</option><option>Song</option></select></div>
                  <div className="inline-editor-actions"><button className="secondary" onClick={closeEditor}>Fertig</button><button className="primary" onClick={() => void savePreset()}>{editingPresetId ? "Scene aktualisieren" : "Scene speichern"}</button></div>
                </div>
              </section> : activeDrumEntries.length ? <div className="drum-grid-scroll" ref={drumGridScrollRef} role="region" aria-label="Aktuelles Drum-Pattern">
                <div className="drum-grid">
                  <div className="drum-lane drum-ruler" style={{ gridTemplateColumns: `82px repeat(${steps.length}, minmax(24px, 1fr))` }}><span className="drum-lane-label">Takt</span>{steps.map((_, index) => <span key={index} className={index % stepsPerBar(meter, subdivision) === 0 ? "bar-start" : ""}>{index % stepsPerBar(meter, subdivision) === 0 ? Math.floor(index / stepsPerBar(meter, subdivision)) + 1 : ""}</span>)}</div>
                  {audioFeedbackEnabled && <div className="drum-lane feedback-lane" style={{ gridTemplateColumns: `82px repeat(${steps.length}, minmax(24px, 1fr))` }}>
                    <span className="drum-lane-label feedback-lane-label"><strong>DU</strong><small>{liveFeedback?.matchedHits ? `${Math.round(liveFeedback.medianMs)} ms` : "Timing"}</small></span>
                    {steps.map((_, index) => {
                      const marker = audioFeedbackMarkers.get(index);
                      const offset = marker?.offsetMs || 0;
                      const markerLeft = Math.max(8, Math.min(92, 50 + offset / 120 * 42));
                      const description = marker?.kind === "missed" ? "verpasst" : marker ? `${offset < 0 ? Math.abs(Math.round(offset)) + " ms zu früh" : offset > 0 ? Math.round(offset) + " ms zu spät" : "genau"}` : "noch kein Messwert";
                      return <span key={index} className={`feedback-cell ${currentStep === index ? "current" : ""} ${index % stepsPerBar(meter, subdivision) === 0 ? "bar-start" : ""}`} aria-label={`Dein Spiel, Schritt ${index + 1}: ${description}`}>
                        {marker && <i className={`feedback-marker ${marker.kind === "missed" ? "missed" : marker.classification}`} style={{ left: `${markerLeft}%` }} title={description}>{marker.kind === "missed" ? "×" : ""}</i>}
                      </span>;
                    })}
                  </div>}
                  {activeDrumEntries.map(([voice, track]) => <div className="drum-lane" key={voice} style={{ gridTemplateColumns: `82px repeat(${steps.length}, minmax(24px, 1fr))` }}>
                    <VoiceLaneLabel voice={voice} volume={voiceVolumes[voice]} onVolumeChange={updateVoiceVolume} />
                    {track.map((state, index) => <button key={index} data-step={index} className={`drum-cell ${state} ${currentStep === index ? "current" : ""} ${index % stepsPerBar(meter, subdivision) === 0 ? "bar-start" : ""}`} onClick={() => updateDrumHit(voice, index)} aria-label={`${DRUM_LABELS[voice]}, Schritt ${index + 1}: ${HIT_LABELS[state]}`} aria-pressed={state !== "mute"} />)}
                  </div>)}
                </div>
              </div> : <div className="beat-steps" aria-label="Aktuelles Akzentmuster">
                {steps.map((step, index) => <button key={index} className={`beat-dot ${step} ${currentStep === index ? "current" : ""}`} onClick={() => updateStep(index)} aria-label={`Schritt ${index + 1}: ${step}`} />)}
              </div>}
            </div>

            {audioFeedbackEnabled && <MemoizedTimingDiagnostics analysis={audioFeedbackAnalysis} barSteps={stepsPerBar(meter, subdivision)} stepDurationMs={feedbackStepDurationMs} drumTracks={drumTracks} steps={steps} />}

            <div className="shortcut-hint">Leertaste: Start/Stop · T: Tap Tempo · +/−: BPM</div>
          </div>

          <aside className="panel controls-panel" aria-label="Drum-Trainer-Einstellungen">
            <div className="panel-title-row"><h2 className="panel-title">Einstellungen</h2><button className="reset-button" onClick={resetControls}>Reset</button></div>
            <div className="control-group compact-sound settings-cell settings-sound">
              <div className="control-label"><span>Klang</span><span>{volume}%</span></div>
              <div className="select-row"><select className="field-select" value={sound} title={DRUM_KIT_OPTIONS.find((kit) => kit.value === sound)?.description} onChange={(event) => void changeDrumKit(event.target.value as DrumKit)} aria-label="Drumkit">{DRUM_KIT_OPTIONS.map((kit) => <option key={kit.value} value={kit.value}>{kit.label}</option>)}</select><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Lautstärke" /></div>
            </div>
            <div className="control-group settings-cell settings-feel">
              <div className="control-label"><span>Spielweise</span><span>{feelMode === "original" ? originalFeel?.label || "Original Feel" : "Raster"}</span></div>
              <div className="segmented feel-toggle">
                <button className={feelMode === "quantized" ? "active" : ""} aria-pressed={feelMode === "quantized"} onClick={() => { feelModeRef.current = "quantized"; setFeelMode("quantized"); }}>Quantisiert</button>
                <button className={feelMode === "original" ? "active" : ""} aria-pressed={feelMode === "original"} disabled={!originalFeel} title={originalFeel?.note || "Keine belegten Mikro-Timing-Daten vorhanden"} onClick={() => { if (!originalFeel) return; feelModeRef.current = "original"; setFeelMode("original"); }}>Original Feel</button>
              </div>
              {originalFeel && <small className="feel-note">{feelMode === "original" ? originalFeel.note : "Gerades Raster; Dynamikstufen bleiben erhalten."}</small>}
            </div>
            <div className="control-group settings-cell settings-meter">
              <div className="control-label"><span>Takt</span><span>{meterLabel}</span></div>
              <div className="meter-compact">
                <button onClick={() => changeMeter(Math.max(1, meter.beats - 1))} aria-label="Einen Schlag weniger">−</button>
                <input type="number" min="1" max="16" value={meter.beats} onChange={(event) => changeMeter(Number(event.target.value))} aria-label="Schläge pro Takt" />
                <button onClick={() => changeMeter(Math.min(16, meter.beats + 1))} aria-label="Einen Schlag mehr">+</button>
                <div className="segmented denominator">{[4, 8, 16].map((value) => <button key={value} className={meter.denominator === value ? "active" : ""} aria-pressed={meter.denominator === value} onClick={() => changeMeter(meter.beats, value)}>/{value}</button>)}</div>
              </div>
            </div>
            <div className="control-group settings-cell settings-subdivision">
              <div className="control-label"><span>Unterteilung</span><span>{subdivision}</span></div>
              <div className="segmented five">
                {SUBDIVISIONS.map((item) => <button key={item} className={subdivision === item ? "active" : ""} aria-pressed={subdivision === item} disabled={!hasExactGrid(meter, item)} title={!hasExactGrid(meter, item) ? `Kein vollständiges ${item}-Raster in ${meterLabel}` : undefined} onClick={() => changeSubdivision(item)}>{item === "Viertel" ? "¼" : item === "Achtel" ? "⅛" : item === "16tel" ? "¹⁄₁₆" : item === "Triolen" ? "3" : "6"}</button>)}
              </div>
            </div>
            <div className="control-group settings-cell settings-swing">
              <div className="control-label"><span>Swing</span><span>{Math.round((swing - 50) * 2)}%</span></div>
              <div className="slider-row"><span className="slider-icon">0</span><input type="range" min="0" max="50" value={(swing - 50) * 2} onChange={(event) => { const value = 50 + Number(event.target.value) / 2; swingRef.current = value; setSwing(value); }} aria-label="Swing von null bis fünfzig Prozent" /><span>50</span></div>
            </div>
            <div className="control-group settings-extras">
              <button className="session-extras-toggle" onClick={() => setSessionExtrasOpen((open) => !open)} aria-expanded={sessionExtrasOpen}><span>Zeit & Ende</span><small>{timerMinutes ? `${timerMinutes} Min.` : "ohne Timer"}{repeatBars ? ` · ${repeatBars} Takte` : ""}</small><b>{sessionExtrasOpen ? "−" : "+"}</b></button>
              {sessionExtrasOpen && <div className="session-extras">
                <div className="control-label sub-label"><span>Timer</span><span>{timerMinutes ? `${timerMinutes}m` : "aus"}</span></div>
                <div className="segmented compact four">{[0, 5, 10, 20].map((value) => <button key={value} className={timerMinutes === value ? "active" : ""} aria-pressed={timerMinutes === value} onClick={() => { timerMinutesRef.current = value; setTimerMinutes(value); setTimerText(value ? `${value}:00` : "∞"); }}>{value || "aus"}</button>)}</div>
                <div className="control-label sub-label"><span>Wiederholen</span><span>{repeatBars || "∞"}</span></div>
                <div className="segmented compact five">{[0, 4, 8, 16, 32].map((value) => <button key={value} className={repeatBars === value ? "active" : ""} aria-pressed={repeatBars === value} onClick={() => { repeatBarsRef.current = value; setRepeatBars(value); }}>{value || "∞"}</button>)}</div>
              </div>}
            </div>
            <div className="practice-mode-card">
              <div className="control-label"><span>Übemodus</span><span>{practiceModeLabel(practiceMode)}</span></div>
              <select className="field-select" value={practiceMode.type} onChange={(event) => {
                const type = event.target.value;
                const mode: PracticeModeConfig = type === "gap" ? { type: "gap", audibleBars: 3, silentBars: 1 }
                  : type === "random-gap" ? { type: "random-gap", probability: .3, maxSilentBars: 2 }
                    : type === "voice-dropout" ? { type: "voice-dropout", voices: ["closedHat"], schedule: { audibleBars: 3, silentBars: 1 } }
                      : type === "call-response" ? { type: "call-response", playBars: 2, responseBars: 2 }
                        : { type: "normal" };
                practiceModeRef.current = mode; setPracticeMode(mode);
              }} aria-label="Übemodus"><option value="normal">Normal</option><option value="gap">Gap Click 3/1</option><option value="random-gap">Zufällige Lücken</option><option value="voice-dropout">Stimme ausblenden</option><option value="call-response">Call & Response</option></select>
              {practiceMode.type === "voice-dropout" && <div className="voice-dropout-choices">{activeDrumEntries.map(([voice]) => <button key={voice} className={practiceMode.voices.includes(voice) ? "active" : ""} aria-pressed={practiceMode.voices.includes(voice)} onClick={() => {
                const voices = practiceMode.voices.includes(voice) ? practiceMode.voices.filter((item) => item !== voice) : [...practiceMode.voices, voice];
                const next = { ...practiceMode, voices: voices.length ? voices : [voice] }; practiceModeRef.current = next; setPracticeMode(next);
              }}>{DRUM_LABELS[voice]}</button>)}</div>}
            </div>
            <div className="trainer-card settings-trainer">
              <div className="toggle-row"><div><strong>{trainerMode === "pyramid" ? "Tempo-Pyramide" : "Tempo-Trainer"}</strong><small>{trainerMode === "pyramid" ? "Automatisch hoch und wieder herunter" : "Automatisch schneller werden"}</small></div><button className={`switch ${trainer ? "on" : ""}`} onClick={() => { const value = !trainer; trainerRef.current = value; setTrainer(value); }} aria-label="Tempo-Trainer umschalten" aria-pressed={trainer} /></div>
              {trainer && <div className="trainer-settings"><select value={trainerMode} onChange={(event) => { const value = event.target.value as TrainerMode; trainerModeRef.current = value; setTrainerMode(value); }} aria-label="Trainer-Modus"><option value="up">Steigern</option><option value="pyramid">Pyramide</option></select><select value={trainerStep} onChange={(event) => { const value = Number(event.target.value); trainerStepRef.current = value; setTrainerStep(value); }} aria-label="Tempo-Schritt"><option value="2">{trainerMode === "pyramid" ? "±2" : "+2"} BPM</option><option value="5">{trainerMode === "pyramid" ? "±5" : "+5"} BPM</option><option value="10">{trainerMode === "pyramid" ? "±10" : "+10"} BPM</option></select><select value={trainerEvery} onChange={(event) => { const value = Number(event.target.value); trainerEveryRef.current = value; setTrainerEvery(value); }} aria-label="Intervall"><option value="4">alle 4 Takte</option><option value="8">alle 8 Takte</option><option value="16">alle 16 Takte</option></select><label>Start<input type="number" min="20" max="300" value={trainerMin} onChange={(event) => setTrainerMin(Number(event.target.value))} /></label><label>Ziel<input type="number" min="20" max="300" value={trainerMax} onChange={(event) => setTrainerMax(Number(event.target.value))} /></label><p>{bpm} BPM → {trainerMode === "pyramid" ? `${trainerMax} → ${trainerMin}` : trainerMax} · alle {trainerEvery} Takte</p></div>}
            </div>
            <div className={`feedback-card ${audioFeedbackEnabled ? "enabled" : ""}`}>
              <div className="toggle-row"><div><strong>Audio-Feedback</strong><small>Transienten direkt gegen das Soll-Raster</small></div><button className={`switch ${audioFeedbackEnabled ? "on" : ""}`} onClick={() => audioFeedbackEnabled ? disableAudioFeedback() : void enableAudioFeedback()} aria-label="Audio-Feedback umschalten" aria-pressed={audioFeedbackEnabled} /></div>
              {audioFeedbackEnabled && <div className="feedback-controls">
                <div className="feedback-status-row"><span className={`feedback-status-dot ${audioFeedbackStatus}`} /><strong>{feedbackStatusLabel}</strong><span>{audioFeedbackConfig.latencyMs} ms · {latencySourceLabel}</span></div>
                {audioInputOptions.length > 0 && <label>Mikrofon<select className="field-select" value={audioInputDeviceId} disabled={isPlaying || calibratingLatency} onChange={(event) => void enableAudioFeedback(event.target.value)}>{audioInputOptions.map((input) => <option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label>}
                <label className="feedback-latency-control"><span>Latenzkorrektur <b>{audioFeedbackConfig.latencyMs} ms</b></span><input type="range" min="0" max="600" step="1" value={audioFeedbackConfig.latencyMs} disabled={isPlaying || calibratingLatency} onChange={(event) => setManualAudioLatency(Number(event.target.value))} /></label>
                <button className="feedback-calibrate" disabled={isPlaying || calibratingLatency} onClick={() => void calibrateAudioLatency()}>{calibratingLatency ? `Messung ${calibrationProgress}/6` : "Bluetooth-Latenz messen"}</button>
                <p>Kopfhörer verwenden, damit der App-Beat nicht als eigener Schlag zählt. Zur Messung einen Hörer direkt ans Mikrofon halten.</p>
              </div>}
            </div>
            <button className="midi-button settings-midi" onClick={enableMidi} disabled={midiStatus === "connected"}>{midiStatus === "connected" ? "MIDI verbunden" : midiStatus === "unsupported" ? "Kein MIDI" : midiStatus === "denied" ? "MIDI abgelehnt" : "MIDI verbinden"}</button>
          </aside>
        </section>

        {recap && <section className="recap-card" aria-label="Session-Abschluss" aria-live="polite">
          <div className="recap-head"><div><small>Session abgeschlossen</small><h2>{recap.sceneName}</h2></div><button onClick={() => setRecap(null)} aria-label="Recap schließen">×</button></div>
          <div className="recap-stats"><div><strong>{Math.floor(recap.activeSeconds / 60)}:{String(recap.activeSeconds % 60).padStart(2, "0")}</strong><span>aktive Übezeit</span></div><div><strong>{recap.barsCompleted}</strong><span>Takte</span></div><div><strong>{recap.bpmStart}{recap.bpmEnd !== recap.bpmStart ? ` → ${recap.bpmEnd}` : ""}</strong><span>BPM</span></div><div><strong>{practiceModeLabel(recap.practiceMode || { type: "normal" })}</strong><span>Übemodus</span></div></div>
          {recapOverallTiming && <div className="timing-recap">
            <div className="timing-recap-head"><div><small>Audioanalyse</small><strong>{recapOverallTiming.medianMs < -1 ? `${Math.abs(Math.round(recapOverallTiming.medianMs))} ms früh` : recapOverallTiming.medianMs > 1 ? `${Math.round(recapOverallTiming.medianMs)} ms spät` : "mittig"}</strong></div><span>{recapTiming?.latencyMs || 0} ms Latenz · {recapTiming?.latencySource === "calibrated" ? "gemessen" : recapTiming?.latencySource === "manual" ? "manuell" : "geschätzt"}</span></div>
            <div className="timing-recap-stats"><div><strong>{Math.round(recapOverallTiming.meanAbsoluteMs)} ms</strong><span>Ø Abweichung</span></div><div><strong>{Math.round(recapOverallTiming.spreadMs)} ms</strong><span>Streuung</span></div><div><strong>{Math.round(recapOverallTiming.hitRate)}%</strong><span>Trefferquote</span></div><div><strong>{recapTiming?.matchedHits || 0}/{(recapTiming?.matchedHits || 0) + (recapTiming?.missedHits || 0)}</strong><span>Erkannt</span></div><div><strong>{recapTiming?.extraHits || 0}</strong><span>Zusätzlich</span></div></div>
            {!!recapTiming?.samples?.length && <div className="timing-recap-plot" aria-label="Timingverlauf, oben zu früh, unten zu spät"><span className="timing-zero-line" />{recapTiming.samples.slice(-48).map((sample, index) => {
              const top = Math.max(7, Math.min(93, 50 + sample.offsetMs / 120 * 43));
              return <i key={`${sample.stepIndex}-${index}`}><b className={sample.classification} style={{ top: `${top}%` }} /></i>;
            })}</div>}
          </div>}
          <div className="rating-row"><span>Wie fühlte es sich an?</span>{(["unsicher", "stabil", "leicht"] as const).map((rating) => <button key={rating} className={recap.selfRating === rating ? "active" : ""} aria-pressed={recap.selfRating === rating} onClick={() => rateResult(rating)}>{rating}</button>)}</div>
          <p className="next-step"><strong>Nächster Schritt:</strong> {nextStepFor(recap)}</p>
        </section>}

        <section className="section" id="bibliothek">
          <div className="library-bar">
            <h2>Patterns <span>{libraryStatus === "loading" ? "…" : library.length}</span></h2>
            <div className="search-field"><label className="sr-only" htmlFor="pattern-search">Patterns durchsuchen</label><input id="pattern-search" className="text-field" placeholder="Name, Stil, Ziel …" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button className="search-clear" onClick={() => setSearch("")} aria-label="Suche löschen">×</button>}</div>
          </div>
          <div className="library-finder">
            <div className="finder-toolbar">
              <div className="finder-result" aria-live="polite"><strong>{filteredPatterns.length}</strong><span>von {library.length} Patterns</span></div>
              <div className="finder-actions">
                <button ref={stylePickerTriggerRef} className={`finder-select ${category !== "Alle" ? "active" : ""}`} aria-expanded={stylePickerOpen} aria-controls="style-picker" onClick={() => { setFilterPanelOpen(false); setStylePickerOpen(true); }}><span>Stil</span><strong>{styleSelectionLabel(category)}</strong><b>⌄</b></button>
                <button ref={filterPanelTriggerRef} className={`finder-select filter-button ${detailFilterCount ? "active" : ""}`} aria-expanded={filterPanelOpen} aria-controls="library-filter-panel" onClick={() => { setStylePickerOpen(false); setAdvancedFiltersOpen(advancedFiltersActive); setFilterPanelOpen(true); }}><span>Filter</span><strong>{detailFilterCount ? `${detailFilterCount} aktiv` : "Verfeinern"}</strong><b>{detailFilterCount || "⌄"}</b></button>
              </div>
            </div>
            <div className="quick-filter-row" aria-label="Schnellwahl"><span>Schnellwahl</span><div>{QUICK_FILTERS.map((item) => <button key={item.id} className={quickFilterActive(item.id) ? "active" : ""} aria-pressed={quickFilterActive(item.id)} onClick={() => applyQuickFilter(item.id)}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div></div>
            {hasActiveLibraryCriteria && <div className="active-filter-chips" aria-label="Aktive Filter">{activeFilterChips.map(([key, label]) => <button key={key} onClick={() => clearLibraryFilter(key)}>{label} ×</button>)}<button className="clear-all" onClick={() => resetLibraryFilters(true)}>Alles zurücksetzen</button></div>}
          </div>

          {stylePickerOpen && <div className="library-dialog-layer">
            <button className="library-dialog-backdrop" tabIndex={-1} onClick={() => setStylePickerOpen(false)} aria-label="Stilauswahl schließen" />
            <section id="style-picker" className="library-dialog style-dialog" role="dialog" aria-modal="true" aria-labelledby="style-dialog-title">
              <header><div><small>Patterns eingrenzen</small><h3 id="style-dialog-title">Stil auswählen</h3></div><button ref={stylePickerCloseRef} className="dialog-close" onClick={() => setStylePickerOpen(false)} aria-label="Stilauswahl schließen">×</button></header>
              <div className="dialog-scroll">
                <button className={`style-all-option ${category === "Alle" ? "active" : ""}`} aria-pressed={category === "Alle"} onClick={() => setCategory("Alle")}><span><strong>Alle Stile</strong><small>Die gesamte Bibliothek durchsuchen</small></span><b>{patternsWithoutStyle.length}</b></button>
                <div className="style-family-list">{STYLE_FAMILIES.map((family) => {
                  const availableCategories = family.categories.filter((item) => library.some((pattern) => pattern.category === item));
                  if (!availableCategories.length) return null;
                  const value = familySelection(family.id);
                  const familyCount = availableCategories.reduce((sum, item) => sum + (categoryCounts.get(item) || 0), 0);
                  return <section className="style-family" key={family.id}>
                    <button className={`style-family-option ${category === value ? "active" : ""}`} disabled={familyCount === 0 && category !== value} aria-pressed={category === value} onClick={() => setCategory(value)}><span><strong>{family.label}</strong><small>{availableCategories.join(" · ")}</small></span><b>{familyCount}</b></button>
                    <div className="style-category-grid">{availableCategories.map((item) => {
                      const count = categoryCounts.get(item) || 0;
                      return <button key={item} className={category === item ? "active" : ""} disabled={count === 0 && category !== item} aria-pressed={category === item} onClick={() => setCategory(item)}><span>{item}</span><b>{count}</b></button>;
                    })}</div>
                  </section>;
                })}</div>
              </div>
              <footer><button disabled={category === "Alle"} onClick={() => setCategory("Alle")}>Stil entfernen</button><button className="primary" onClick={() => setStylePickerOpen(false)}>{filteredPatterns.length} Patterns anzeigen</button></footer>
            </section>
          </div>}

          {filterPanelOpen && <div className="library-dialog-layer">
            <button className="library-dialog-backdrop" tabIndex={-1} onClick={() => setFilterPanelOpen(false)} aria-label="Filter schließen" />
            <section id="library-filter-panel" className="library-dialog filter-dialog" role="dialog" aria-modal="true" aria-labelledby="filter-dialog-title">
              <header><div><small>Patterns eingrenzen</small><h3 id="filter-dialog-title">Filter</h3></div><button ref={filterPanelCloseRef} className="dialog-close" onClick={() => setFilterPanelOpen(false)} aria-label="Filter schließen">×</button></header>
              <div className="dialog-scroll">
                <section className="filter-section"><div className="filter-section-head"><div><h4>Übungsart</h4><p>Was möchtest du gerade üben?</p></div><button className={patternTypeFilter === "Alle" ? "active" : ""} onClick={() => setPatternTypeFilter("Alle")}>Alle</button></div>
                  <div className="pattern-type-grid">{availablePatternTypes.map((item) => {
                    const count = patternTypeCounts.get(item) || 0;
                    const info = PATTERN_TYPE_INFO[item];
                    return <button key={item} className={patternTypeFilter === item ? "active" : ""} disabled={count === 0 && patternTypeFilter !== item} aria-pressed={patternTypeFilter === item} onClick={() => setPatternTypeFilter(item)}><span><strong>{info.label}</strong><small>{info.description}</small></span><b>{count}</b></button>;
                  })}</div>
                </section>
                <section className="filter-section"><div className="filter-section-head"><div><h4>Grundfilter</h4><p>Niveau, Lernziel und Takt</p></div></div>
                  <div className="filter-field-grid">
                    <label>Schwierigkeit<select value={learningFilters.difficulty} onChange={(event) => setLearningFilters((current) => ({ ...current, difficulty: event.target.value }))}><option>Alle</option><option>Leicht</option><option>Mittel</option><option>Fortgeschritten</option></select></label>
                    <label>Lernziel<select value={learningFilters.skillId} onChange={(event) => setLearningFilters((current) => ({ ...current, skillId: event.target.value }))}><option value="Alle">Alle</option>{SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.group} · {skill.label}</option>)}</select></label>
                    <label>Takt<select value={learningFilters.meter} onChange={(event) => setLearningFilters((current) => ({ ...current, meter: event.target.value }))}>{meters.map((item) => <option key={item}>{item}</option>)}</select></label>
                  </div>
                </section>
                <details className="more-filters" open={advancedFiltersOpen} onToggle={(event) => setAdvancedFiltersOpen(event.currentTarget.open)}><summary>Weitere Filter <span>Raster, Länge, Kit und Feel</span></summary><div className="filter-field-grid">
                  <label>Unterteilung<select value={learningFilters.subdivision} onChange={(event) => setLearningFilters((current) => ({ ...current, subdivision: event.target.value }))}><option>Alle</option>{SUBDIVISIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label>Länge<select value={learningFilters.length} onChange={(event) => setLearningFilters((current) => ({ ...current, length: event.target.value }))}><option>Alle</option><option>1 Takt</option><option>Mehrere Takte</option></select></label>
                  <label>Bevorzugtes Kit<select value={learningFilters.kit} onChange={(event) => setLearningFilters((current) => ({ ...current, kit: event.target.value }))}><option>Alle</option>{DRUM_KIT_OPTIONS.map((kit) => <option key={kit.value} value={kit.value}>{kit.label}</option>)}</select></label>
                </div><div className="filter-toggles"><button className={learningFilters.feel ? "active" : ""} aria-pressed={learningFilters.feel} onClick={() => setLearningFilters((current) => ({ ...current, feel: !current.feel }))}>Original Feel</button><button className={learningFilters.tempo !== null ? "active" : ""} aria-pressed={learningFilters.tempo !== null} onClick={() => setLearningFilters((current) => ({ ...current, tempo: current.tempo === null ? bpm : null }))}>Passend zu {bpm} BPM</button></div></details>
                <section className="filter-section"><div className="filter-section-head"><div><h4>Übeverlauf</h4><p>Passend zu deinem Fortschritt</p></div></div><div className="filter-toggles"><button className={learningFilters.unpracticed ? "active" : ""} aria-pressed={learningFilters.unpracticed} onClick={() => setLearningFilters((current) => ({ ...current, unpracticed: !current.unpracticed }))}>Noch nicht geübt</button><button className={learningFilters.difficult ? "active" : ""} aria-pressed={learningFilters.difficult} onClick={() => setLearningFilters((current) => ({ ...current, difficult: !current.difficult }))}>Zuletzt schwierig</button></div></section>
              </div>
              <footer><button disabled={!hasActiveLibraryCriteria} onClick={() => resetLibraryFilters(true)}>Alles zurücksetzen</button><button className="primary" onClick={() => setFilterPanelOpen(false)}>{filteredPatterns.length} Patterns anzeigen</button></footer>
            </section>
          </div>}
          <div className="pattern-grid">
            {filteredPatterns.slice(0, visibleCount).map((pattern) => (
              <article className={`pattern-card ${patternId === pattern.id ? "loaded" : ""}`} key={pattern.id}>
                <div className="card-top"><div><div className="card-category" title={pattern.attribution}>{pattern.category} · {PATTERN_TYPE_INFO[pattern.patternType || "Groove"].label} · {pattern.attribution || (pattern.source ? "Übungsrekonstruktion" : "Genreübung")}</div><h3>{pattern.name}</h3>{patternId === pattern.id && <span className="loaded-badge">Aktuell geladen</span>}</div><button className={`favorite ${favorites.includes(pattern.id) ? "on" : ""}`} onClick={() => toggleFavorite(pattern.id)} aria-label={favorites.includes(pattern.id) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"} aria-pressed={favorites.includes(pattern.id)}>{favorites.includes(pattern.id) ? "♥" : "♡"}</button></div>
                <div className="mini-pattern">{pattern.pattern.slice(0, 32).map((step, index) => <span key={index} className={`mini-step ${step}`} />)}</div>
                <div className="card-skills">{skillLabelsFor(pattern).map((skill) => <span key={skill}>{skill}</span>)}<span>Start {pattern.playback?.bpm || Math.round((pattern.bpmMin + pattern.bpmMax) / 2)} BPM</span></div>
                <div className="card-footer"><div className="card-meta"><span>{pattern.meter}</span><span>{pattern.subdivision}</span><span>{pattern.bpmMin}–{pattern.bpmMax}</span>{(pattern.bars || 1) > 1 && <span>{pattern.bars}T</span>}{(pattern.playback?.swing ?? 50) > 50 && <span>Swing {Math.round(((pattern.playback?.swing ?? 50) - 50) * 2)}%</span>}{pattern.originalFeel && <span>Original Feel</span>}<span>{pattern.difficulty}</span></div><div className="card-actions"><button onClick={() => setExpandedPatternId((current) => current === pattern.id ? null : pattern.id)} aria-expanded={expandedPatternId === pattern.id}>Details</button><button onClick={() => loadPattern(pattern, true, false)}>Anhören</button><button className="start-small" onClick={() => loadPattern(pattern)}>Zum Trainer</button></div></div>
                {expandedPatternId === pattern.id && <div className="pattern-details"><p><strong>Worauf hören?</strong>{pattern.instruction}</p><p><strong>Warum interessant?</strong>{pattern.whyInteresting}</p><p><strong>Typischer Stolperstein</strong>{pattern.difficulty === "Leicht" ? "Tempo nicht vor Klangbalance stellen." : pattern.difficulty === "Mittel" ? "Kernpuls bei Ghostnotes und Synkopen nicht verlieren." : "Dichte Passagen taktweise isolieren, bevor du die Form verbindest."}</p><p><strong>Vereinfachen / steigern</strong>Erst Skeleton und langsamer; danach Original Feel, Gap Click oder Voice Dropout.</p>{pattern.source && <a className="source-link" href={pattern.source.url} target="_blank" rel="noreferrer">{pattern.source.label} · Quelle öffnen</a>}</div>}
              </article>
            ))}
            {!filteredPatterns.length && <div className="empty-state"><p>Kein Pattern passt zu dieser Auswahl.</p><button onClick={() => resetLibraryFilters(true)}>Alles zurücksetzen</button></div>}
          </div>
          {visibleCount < filteredPatterns.length && <button className="load-more" onClick={() => setVisibleCount((count) => count + 18)}>Weitere Patterns</button>}
        </section>

        <section className="section mine-section" id="meine-grooves">
          <div className="section-head"><div><div className="section-eyebrow">Auf diesem Gerät</div><h2>Meine Grooves.</h2></div><div className="mine-actions"><button onClick={exportLocalData}>Backup exportieren</button><button onClick={() => importInputRef.current?.click()}>Backup importieren</button><button className="primary" onClick={(event) => openEditor(undefined, event.currentTarget)}>＋ Eigenes Pattern</button><input ref={importInputRef} type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importLocalData(file); event.target.value = ""; }} /></div></div>
          <div className="practice-summary"><div><strong>{practicedMinutes}</strong><span>aktive Minuten</span></div><div><strong>{practiceHistory.length}</strong><span>Sessions</span></div><div><strong>{favorites.length}</strong><span>Favoriten</span></div><div><strong>{scenes.length}</strong><span>Scenes</span></div></div>

          <div className="mine-block"><div className="mine-block-head"><h3>Favoriten</h3><span>{favoritePatterns.length}</span></div><div className="compact-cards">{favoritePatterns.length ? favoritePatterns.map((pattern) => <button key={pattern.id} onClick={() => loadPattern(pattern)}><small>{pattern.category}</small><strong>{pattern.name}</strong><span>{pattern.meter} · {pattern.difficulty}</span></button>) : <p>Noch keine Favoriten. Markiere interessante Übungen mit ♥.</p>}</div></div>
          <div className="mine-block"><div className="mine-block-head"><h3>Zuletzt verwendet</h3><span>{recent.length}</span></div><div className="compact-cards">{recent.length ? recent.map((pattern) => <button key={pattern.id} onClick={() => loadPattern(pattern)}><small>{pattern.category}</small><strong>{pattern.name}</strong><span>{pattern.meter} · {pattern.subdivision}</span></button>) : <p>Deine zuletzt geladenen Grooves erscheinen hier.</p>}</div></div>
          <div className="mine-block"><div className="mine-block-head"><h3>Scenes</h3><span>{scenes.length}</span></div><div className="preset-manager">{scenes.length ? scenes.map((scene) => <article key={scene.id}><div><small>{practiceModeLabel(scene.practiceMode || { type: "normal" })}</small><strong>{scene.name}</strong><span>{scene.bpm} BPM · {drumKitLabel(scene.kit)} · Swing {Math.round((scene.swing - 50) * 2)}%</span></div><div><button onClick={() => loadScene(scene)}>Komplett laden</button><button onClick={() => loadScene(scene, true)}>Nur Pattern</button><button onClick={() => void duplicateScene(scene)}>Duplizieren</button><button className="danger" onClick={() => void deleteSceneById(scene.id)}>Löschen</button></div></article>) : <button className="empty-preset" onClick={() => void saveCurrentScene()}>＋ Aktuelle Scene speichern</button>}</div></div>
          <div className="mine-block"><div className="mine-block-head"><h3>Eigene Patterns</h3><span>{presets.length}</span></div><div className="preset-manager">{presets.length ? presets.map((preset) => <article key={preset.id}><div><small>{preset.category}</small><strong>{preset.name}</strong><span>{preset.meter} · {preset.subdivision} · {preset.bpmMin} BPM</span></div><div><button onClick={() => loadPattern(preset)}>Laden</button><button onClick={(event) => openEditor(preset, event.currentTarget)}>Bearbeiten</button><button className="danger" onClick={() => void deletePresetById(preset.id)}>Löschen</button></div></article>) : <button className="empty-preset" onClick={(event) => openEditor(undefined, event.currentTarget)}>＋ Erstes Pattern bauen</button>}</div></div>
          <div className="mine-block"><div className="mine-block-head"><h3>Übungsverlauf</h3><span>{practiceHistory.length}</span></div><div className="history-list">{practiceHistory.slice(0, 20).map((entry) => <div key={entry.id}><strong>{entry.sceneName}</strong><span>{Math.max(1, Math.round(entry.activeSeconds / 60))} Min. aktiv · {entry.barsCompleted} Takte · {entry.bpmStart}{entry.bpmEnd !== entry.bpmStart ? ` → ${entry.bpmEnd}` : ""} BPM{entry.selfRating ? ` · ${entry.selfRating}` : ""}</span><time dateTime={entry.completedAt}>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(entry.completedAt))}</time></div>)}</div></div>
          <div className="local-data-note"><div><strong>Privat und lokal</strong><span>Keine Aufnahme, kein Konto, keine Telemetrie.</span></div><button className="danger" onClick={() => { if (window.confirm("Alle Favoriten, Scenes und Übungsverläufe auf diesem Gerät löschen?")) void clearAllLocalData(); }}>Lokale Daten löschen</button></div>
        </section>

        <footer className="footer"><span>drumgrid · Sample- &amp; Synthese-Kits</span><span>Installierbar · Offline · Kompakt · Präzise</span></footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile Hauptnavigation">
        <button className={`mobile-destination mobile-trainer ${section === "trainer" ? "active" : ""}`} aria-current={section === "trainer" ? "page" : undefined} onClick={() => navigateTo("trainer")}><MobileNavIcon name="practice" /><span className="mobile-nav-label">Üben</span></button>
        <button className={`mobile-destination mobile-library ${section === "library" ? "active" : ""}`} aria-current={section === "library" ? "page" : undefined} onClick={() => navigateTo("library")}><MobileNavIcon name="library" /><span className="mobile-nav-label">Patterns</span></button>
        <button className={`mobile-play ${isPlaying ? "playing" : ""}`} onClick={togglePlayback} aria-label={isPlaying ? "Wiedergabe stoppen" : "Wiedergabe starten"} aria-pressed={isPlaying}><MobileNavIcon name={isPlaying ? "stop" : "play"} /><span className="mobile-nav-label">{isPlaying ? "Stopp" : "Start"}</span></button>
        <button className={`mobile-destination mobile-mine ${section === "mine" ? "active" : ""}`} aria-current={section === "mine" ? "page" : undefined} onClick={() => navigateTo("mine")}><MobileNavIcon name="mine" /><span className="mobile-nav-label">Meine</span></button>
      </nav>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
      {storageError && <div className="storage-alert" role="alert"><span>{storageError}</span><button onClick={() => setStorageError("")}>×</button></div>}
    </main>
  );
}
