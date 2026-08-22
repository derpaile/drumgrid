"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StepState = "accent" | "normal" | "mute";
type DrumHitState = StepState | "ghost";
type Subdivision = "Viertel" | "Achtel" | "16tel" | "Triolen" | "Sextolen";
type TempoUnit = "quarter" | "eighth" | "dotted-quarter";
type TrainerMode = "up" | "pyramid";
type Meter = { beats: number; denominator: number };
type DrumKit = "Studio" | "Trocken" | "Elektronisch";
type PlaybackPhase = "stopped" | "starting" | "running" | "lifecycle-paused" | "recovering";
type SessionCheckpoint = { nextStep: number; countRemaining: number; bars: number; bpm: number; trainerDirection: 1 | -1 };

const DRUM_VOICES = ["kick", "snare", "closedHat", "openHat", "ride", "crash", "rim", "highTom", "lowTom"] as const;
type DrumVoice = typeof DRUM_VOICES[number];
type DrumTracks = Partial<Record<DrumVoice, DrumHitState[]>>;

type PlaybackDefaults = {
  bpm?: number;
  swing?: number;
  countIn?: number;
  timerMinutes?: number;
  repeatBars?: number;
  kit?: DrumKit;
  trainer?: { mode: TrainerMode; step: number; every: number; min: number; max: number };
};

type Pattern = {
  id: string;
  name: string;
  category: string;
  bpmMin: number;
  bpmMax: number;
  meter: string;
  subdivision: Subdivision;
  bars?: number;
  grouping?: number[];
  tempoUnit?: TempoUnit;
  pattern: StepState[];
  drumTracks?: DrumTracks;
  drumOnly?: boolean;
  difficulty: "Leicht" | "Mittel" | "Fortgeschritten";
  instruction: string;
  playback?: PlaybackDefaults;
  source?: { label: string; url: string };
};

type WakeLockHandle = { release: () => Promise<void> };

const SUBDIVISIONS: Subdivision[] = ["Viertel", "Achtel", "16tel", "Triolen", "Sextolen"];
const FACTOR: Record<Subdivision, number> = { Viertel: 1, Achtel: 2, "16tel": 4, Triolen: 3, Sextolen: 6 };
const DRUM_LABELS: Record<DrumVoice, string> = {
  kick: "Kick", snare: "Snare", closedHat: "Hi-Hat", openHat: "Open Hat", ride: "Ride",
  crash: "Crash", rim: "Rim", highTom: "High Tom", lowTom: "Floor Tom",
};
const FALLBACK_PATTERNS: Pattern[] = [
  {
    id: "drum-basic-rock", name: "Rock-Backbeat", category: "Grundlagen", bpmMin: 45, bpmMax: 160,
    meter: "4/4", subdivision: "Achtel", bars: 1, grouping: [1, 1, 1, 1], tempoUnit: "quarter",
    pattern: ["accent", "normal", "accent", "normal", "accent", "normal", "accent", "normal"],
    drumTracks: {
      kick: ["accent", "mute", "mute", "mute", "accent", "mute", "mute", "mute"],
      snare: ["mute", "mute", "accent", "mute", "mute", "mute", "accent", "mute"],
      closedHat: ["accent", "normal", "accent", "normal", "accent", "normal", "accent", "normal"],
    },
    difficulty: "Leicht", drumOnly: true,
    instruction: "Spiele Kick auf eins und drei, Snare auf zwei und vier und führe die Hi-Hat in Achteln.",
    playback: { bpm: 92, kit: "Studio" },
  },
];

const parseMeter = (meter: string) => {
  const [beats, denominator] = meter.split("/").map(Number);
  return { beats: beats || 4, denominator: denominator || 4 };
};

const exactStepCount = (meter: Meter, subdivision: Subdivision) =>
  meter.beats * 4 / meter.denominator * FACTOR[subdivision];

const hasExactGrid = (meter: Meter, subdivision: Subdivision) =>
  Number.isInteger(exactStepCount(meter, subdivision));

const stepsPerBar = (meter: Meter, subdivision: Subdivision) =>
  Math.max(1, Math.round(exactStepCount(meter, subdivision)));

const defaultGrouping = (meter: Meter) =>
  meter.denominator === 8 && meter.beats % 3 === 0
    ? Array(meter.beats / 3).fill(3)
    : Array(meter.beats).fill(1);

const defaultTempoUnit = (meter: Meter, grouping = defaultGrouping(meter)): TempoUnit =>
  meter.denominator === 8 && grouping.every((size) => size === 3)
    ? "dotted-quarter"
    : meter.denominator === 8
      ? "eighth"
      : "quarter";

const tempoUnitLabel: Record<TempoUnit, string> = {
  quarter: "♩",
  eighth: "♪",
  "dotted-quarter": "♩.",
};

const normalizedSteps = (steps: StepState[], length: number): StepState[] =>
  Array.from({ length }, (_, index) => steps[index % Math.max(1, steps.length)] || (index === 0 ? "accent" : "normal"));

const normalizedDrumTracks = (tracks: DrumTracks | undefined, length: number): DrumTracks | null => {
  if (!tracks || !Object.keys(tracks).length) return null;
  return Object.fromEntries(
    DRUM_VOICES.flatMap((voice) => tracks[voice]
      ? [[voice, Array.from({ length }, (_, index) => tracks[voice]?.[index] || "mute")]]
      : []),
  ) as DrumTracks;
};

const cloneDrumTracks = (tracks: DrumTracks): DrumTracks => Object.fromEntries(
  DRUM_VOICES.flatMap((voice) => tracks[voice] ? [[voice, [...tracks[voice]!]]] : []),
) as DrumTracks;

const mergeDrumTracks = (tracks: DrumTracks, length: number): StepState[] =>
  Array.from({ length }, (_, index) => {
    const states = Object.values(tracks).map((track) => track?.[index] || "mute");
    return states.includes("accent") ? "accent" : states.some((state) => state !== "mute") ? "normal" : "mute";
  });

const defaultDrumTracks = (meter: Meter, subdivision: Subdivision): DrumTracks => {
  const length = stepsPerBar(meter, subdivision);
  const track = (): DrumHitState[] => Array(length).fill("mute");
  const kick = track();
  const snare = track();
  const closedHat = track();
  const unitSteps = Math.max(1, Math.round(4 / meter.denominator * FACTOR[subdivision]));
  const hatStride = subdivision === "16tel" ? 2 : 1;
  for (let index = 0; index < length; index += hatStride) closedHat[index] = index % Math.max(1, unitSteps) === 0 ? "accent" : "normal";
  kick[0] = "accent";
  if (meter.beats >= 4 && 2 * unitSteps < length) kick[2 * unitSteps] = "accent";
  if (meter.beats >= 2 && unitSteps < length) snare[unitSteps] = "accent";
  if (meter.beats >= 4 && 3 * unitSteps < length) snare[3 * unitSteps] = "accent";
  return { kick, snare, closedHat };
};

const tempoName = (bpm: number) => {
  if (bpm < 45) return "Largo";
  if (bpm < 66) return "Adagio";
  if (bpm < 76) return "Andante";
  if (bpm < 108) return "Moderato";
  if (bpm < 120) return "Allegretto";
  if (bpm < 168) return "Allegro";
  if (bpm < 200) return "Presto";
  return "Prestissimo";
};

const cycleStep = (state: StepState): StepState =>
  state === "accent" ? "normal" : state === "normal" ? "mute" : "accent";

const cycleDrumHit = (state: DrumHitState): DrumHitState =>
  state === "mute" ? "normal" : state === "normal" ? "accent" : state === "accent" ? "ghost" : "mute";

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

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("klangmass", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("kv");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStore<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openStore();
    return await new Promise<T>((resolve) => {
      const request = db.transaction("kv").objectStore("kv").get(key);
      request.onsuccess = () => resolve((request.result as T) ?? fallback);
      request.onerror = () => resolve(fallback);
    });
  } catch { return fallback; }
}

async function writeStore(key: string, value: unknown) {
  try {
    const db = await openStore();
    db.transaction("kv", "readwrite").objectStore("kv").put(value, key);
  } catch { /* Private browsing can deny storage; playback still works. */ }
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
  const [patternName, setPatternName] = useState("Rock-Backbeat");
  const [currentStep, setCurrentStep] = useState(-1);
  const [volume, setVolume] = useState(72);
  const [sound, setSound] = useState<DrumKit>("Studio");
  const [swing, setSwing] = useState(50);
  const [countIn, setCountIn] = useState(1);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [repeatBars, setRepeatBars] = useState(0);
  const [timerText, setTimerText] = useState("∞");
  const [trainer, setTrainer] = useState(false);
  const [trainerStep, setTrainerStep] = useState(5);
  const [trainerEvery, setTrainerEvery] = useState(8);
  const [trainerMode, setTrainerMode] = useState<TrainerMode>("up");
  const [library, setLibrary] = useState<Pattern[]>(FALLBACK_PATTERNS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [presets, setPresets] = useState<Pattern[]>([]);
  const [recent, setRecent] = useState<Pattern[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [meterFilter, setMeterFilter] = useState("Alle Takte");
  const [difficultyFilter, setDifficultyFilter] = useState("Alle Stufen");
  const [subdivisionFilter, setSubdivisionFilter] = useState("Alle Unterteilungen");
  const [visibleCount, setVisibleCount] = useState(9);
  const [editorOpen, setEditorOpen] = useState(false);
  const [presetName, setPresetName] = useState("Mein Pattern");
  const [presetCategory, setPresetCategory] = useState("Eigene Presets");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);

  const audioRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const visualTimersRef = useRef<Set<number>>(new Set());
  const scheduledSourcesRef = useRef<Set<AudioScheduledSourceNode>>(new Set());
  const masterGainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const phaseRef = useRef<PlaybackPhase>("stopped");
  const wantsPlaybackRef = useRef(false);
  const generationRef = useRef(0);
  const recoveryPromiseRef = useRef<Promise<void> | null>(null);
  const contextTransitionRef = useRef<Promise<void>>(Promise.resolve());
  const bpmRef = useRef(bpm);
  const meterRef = useRef(meter);
  const subdivisionRef = useRef(subdivision);
  const stepsRef = useRef(steps);
  const drumTracksRef = useRef<DrumTracks | null>(drumTracks);
  const groupingRef = useRef(grouping);
  const tempoUnitRef = useRef(tempoUnit);
  const volumeRef = useRef(volume);
  const soundRef = useRef<DrumKit>(sound);
  const swingRef = useRef(swing);
  const countInRef = useRef(countIn);
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
  const countRemainingRef = useRef(0);
  const barsRef = useRef(0);
  const endAtRef = useRef(0);
  const timerRemainingRef = useRef(0);
  const checkpointRef = useRef<SessionCheckpoint>({ nextStep: 0, countRemaining: 0, bars: 0, bpm, trainerDirection: 1 });
  const stopRef = useRef<() => void>(() => undefined);
  const startRef = useRef<(recover?: boolean) => Promise<void>>(async () => undefined);
  const pauseLifecycleRef = useRef<() => void>(() => undefined);
  const resumeLifecycleRef = useRef<() => void>(() => undefined);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { meterRef.current = meter; }, [meter]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { drumTracksRef.current = drumTracks; }, [drumTracks]);
  useEffect(() => { groupingRef.current = grouping; }, [grouping]);
  useEffect(() => { tempoUnitRef.current = tempoUnit; }, [tempoUnit]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { swingRef.current = swing; }, [swing]);
  useEffect(() => { countInRef.current = countIn; }, [countIn]);
  useEffect(() => { timerMinutesRef.current = timerMinutes; }, [timerMinutes]);
  useEffect(() => { trainerRef.current = trainer; }, [trainer]);
  useEffect(() => { trainerStepRef.current = trainerStep; }, [trainerStep]);
  useEffect(() => { trainerEveryRef.current = trainerEvery; }, [trainerEvery]);
  useEffect(() => { trainerModeRef.current = trainerMode; }, [trainerMode]);
  useEffect(() => { repeatBarsRef.current = repeatBars; }, [repeatBars]);

  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    const visibilityHandler = () => document.hidden ? pauseLifecycleRef.current() : resumeLifecycleRef.current();
    const pageHideHandler = () => pauseLifecycleRef.current();
    const pageShowHandler = () => resumeLifecycleRef.current();
    const focusHandler = () => { if (!document.hidden) resumeLifecycleRef.current(); };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("pagehide", pageHideHandler);
    window.addEventListener("pageshow", pageShowHandler);
    window.addEventListener("focus", focusHandler);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    Promise.all([
      readStore<string[]>("favorites", []),
      readStore<Pattern[]>("presets", []),
      readStore<Pattern[]>("recent", []),
      readStore<number>("libraryVersion", 1),
    ]).then(([savedFavorites, savedPresets, savedRecent, savedVersion]) => {
      const compatible = savedVersion === 2;
      setFavorites(compatible ? savedFavorites : []);
      setPresets(savedPresets);
      setRecent(compatible ? savedRecent : []);
      if (!compatible) {
        void writeStore("favorites", []);
        void writeStore("recent", []);
      }
    });
    fetch("/data/patterns-v1.json")
      .then((response) => response.json())
      .then((data: { version?: number; patterns?: Pattern[] }) => {
        const drums = Array.isArray(data.patterns)
          ? data.patterns.filter((pattern) => pattern.drumOnly === true && pattern.drumTracks)
          : [];
        if (!drums.length) return;
        const ids = new Set(drums.map((pattern) => pattern.id));
        setLibrary(drums);
        setFavorites((current) => {
          const next = current.filter((id) => ids.has(id));
          void writeStore("favorites", next);
          return next;
        });
        setRecent((current) => {
          const next = current.filter((pattern) => pattern.id.startsWith("custom-") || ids.has(pattern.id));
          void writeStore("recent", next);
          return next;
        });
        void writeStore("libraryVersion", data.version || 2);
      })
      .catch(() => undefined);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("pagehide", pageHideHandler);
      window.removeEventListener("pageshow", pageShowHandler);
      window.removeEventListener("focus", focusHandler);
      stopRef.current();
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const setPlaybackPhase = useCallback((next: PlaybackPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const registerSource = useCallback((source: AudioScheduledSourceNode) => {
    scheduledSourcesRef.current.add(source);
    source.onended = () => {
      scheduledSourcesRef.current.delete(source);
      try { source.disconnect(); } catch { /* Already disconnected. */ }
    };
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
    try { masterGainRef.current?.disconnect(); } catch { /* Already disconnected. */ }
    try { compressorRef.current?.disconnect(); } catch { /* Already disconnected. */ }
    masterGainRef.current = null;
    compressorRef.current = null;
    noiseBufferRef.current = null;
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
    const context = audioRef.current;
    if (context) context.onstatechange = null;
    if (closeContext && context) {
      audioRef.current = null;
      contextTransitionRef.current = Promise.resolve();
      if (context.state !== "closed") void context.close().catch(() => undefined);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    wantsPlaybackRef.current = false;
    generationRef.current += 1;
    recoveryPromiseRef.current = null;
    clearRuntime(true);
    setPlaybackPhase("stopped");
    setCurrentStep(-1);
    nextStepRef.current = 0;
    countRemainingRef.current = 0;
    barsRef.current = 0;
    endAtRef.current = 0;
    timerRemainingRef.current = timerMinutesRef.current * 60_000;
    setTimerText(timerMinutesRef.current ? `${timerMinutesRef.current}:00` : "∞");
  }, [clearRuntime, setPlaybackPhase]);
  useEffect(() => { stopRef.current = stopPlayback; }, [stopPlayback]);

  const noiseBufferFor = useCallback((context: AudioContext) => {
    if (noiseBufferRef.current) return noiseBufferRef.current;
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
    noiseBufferRef.current = buffer;
    return buffer;
  }, []);

  const scheduleDrumVoice = useCallback((context: AudioContext, when: number, voice: DrumVoice, state: DrumHitState) => {
    if (state === "mute") return;
    const output: AudioNode = masterGainRef.current || context.destination;
    const dynamic = state === "ghost" ? .24 : state === "normal" ? .58 : 1;
    const volumeLevel = volumeRef.current / 100;
    const kit = soundRef.current;
    const track = (source: AudioScheduledSourceNode) => registerSource(source);

    if (voice === "kick") {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kit === "Elektronisch" ? "sine" : "triangle";
      const startFrequency = kit === "Elektronisch" ? 185 : kit === "Trocken" ? 125 : 155;
      oscillator.frequency.setValueAtTime(startFrequency, when);
      oscillator.frequency.exponentialRampToValueAtTime(46, when + (kit === "Trocken" ? .11 : .18));
      gain.gain.setValueAtTime(Math.max(.0001, .95 * dynamic * volumeLevel), when);
      gain.gain.exponentialRampToValueAtTime(.0001, when + (kit === "Elektronisch" ? .28 : .22));
      oscillator.connect(gain).connect(output);
      track(oscillator);
      oscillator.start(when);
      oscillator.stop(when + .3);
      return;
    }

    if (voice === "snare") {
      const noise = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      noise.buffer = noiseBufferFor(context);
      filter.type = kit === "Elektronisch" ? "bandpass" : "highpass";
      filter.frequency.value = kit === "Trocken" ? 1450 : 1050;
      filter.Q.value = kit === "Elektronisch" ? 1.8 : .7;
      const duration = kit === "Trocken" ? .09 : kit === "Elektronisch" ? .16 : .13;
      gain.gain.setValueAtTime(Math.max(.0001, .62 * dynamic * volumeLevel), when);
      gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
      noise.connect(filter).connect(gain).connect(output);
      track(noise);
      noise.start(when);
      noise.stop(when + duration + .02);
      const tone = context.createOscillator();
      const toneGain = context.createGain();
      tone.type = "triangle";
      tone.frequency.setValueAtTime(kit === "Elektronisch" ? 205 : 178, when);
      toneGain.gain.setValueAtTime(Math.max(.0001, .25 * dynamic * volumeLevel), when);
      toneGain.gain.exponentialRampToValueAtTime(.0001, when + .075);
      tone.connect(toneGain).connect(output);
      track(tone);
      tone.start(when);
      tone.stop(when + .09);
      return;
    }

    if (["closedHat", "openHat", "ride", "crash"].includes(voice)) {
      const noise = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      noise.buffer = noiseBufferFor(context);
      filter.type = voice === "ride" ? "bandpass" : "highpass";
      filter.frequency.value = voice === "crash" ? 3900 : voice === "ride" ? 6100 : kit === "Elektronisch" ? 8200 : 6800;
      filter.Q.value = voice === "ride" ? 2.4 : .8;
      const duration = voice === "closedHat" ? .045 : voice === "openHat" ? .3 : voice === "ride" ? .2 : .58;
      const baseLevel = voice === "closedHat" ? .22 : voice === "openHat" ? .28 : voice === "ride" ? .24 : .34;
      gain.gain.setValueAtTime(Math.max(.0001, baseLevel * dynamic * volumeLevel), when);
      gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
      noise.connect(filter).connect(gain).connect(output);
      track(noise);
      noise.start(when);
      noise.stop(when + duration + .02);
      return;
    }

    if (voice === "rim") {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(kit === "Elektronisch" ? 1850 : 1320, when);
      gain.gain.setValueAtTime(Math.max(.0001, .24 * dynamic * volumeLevel), when);
      gain.gain.exponentialRampToValueAtTime(.0001, when + .035);
      oscillator.connect(gain).connect(output);
      track(oscillator);
      oscillator.start(when);
      oscillator.stop(when + .045);
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    const startFrequency = voice === "highTom" ? 235 : 125;
    oscillator.frequency.setValueAtTime(startFrequency, when);
    oscillator.frequency.exponentialRampToValueAtTime(startFrequency * .68, when + .16);
    gain.gain.setValueAtTime(Math.max(.0001, .56 * dynamic * volumeLevel), when);
    gain.gain.exponentialRampToValueAtTime(.0001, when + .2);
    oscillator.connect(gain).connect(output);
    track(oscillator);
    oscillator.start(when);
    oscillator.stop(when + .22);
  }, [noiseBufferFor, registerSource]);

  const pauseForLifecycle = useCallback(() => {
    if (!wantsPlaybackRef.current) return;
    if (phaseRef.current === "lifecycle-paused" && schedulerRef.current === null) return;
    generationRef.current += 1;
    if (endAtRef.current) timerRemainingRef.current = Math.max(0, endAtRef.current - Date.now());
    endAtRef.current = 0;
    const context = audioRef.current;
    clearRuntime(false);
    const checkpoint = checkpointRef.current;
    nextStepRef.current = checkpoint.nextStep;
    countRemainingRef.current = checkpoint.countRemaining;
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
  }, [clearRuntime, setPlaybackPhase]);
  useEffect(() => { pauseLifecycleRef.current = pauseForLifecycle; }, [pauseForLifecycle]);

  const startPlayback = useCallback(async (recover = false) => {
    const token = generationRef.current + 1;
    generationRef.current = token;
    wantsPlaybackRef.current = true;
    clearRuntime(!recover);
    setPlaybackPhase(recover ? "recovering" : "starting");
    if (document.hidden) {
      setPlaybackPhase("lifecycle-paused");
      return;
    }
    if (!recover) {
      barsRef.current = 0;
      nextStepRef.current = 0;
      countRemainingRef.current = countInRef.current * stepsPerBar(meterRef.current, subdivisionRef.current);
      trainerDirectionRef.current = 1;
      timerRemainingRef.current = timerMinutesRef.current * 60_000;
      setTimerText(timerMinutesRef.current ? `${timerMinutesRef.current}:00` : "∞");
      checkpointRef.current = {
        nextStep: nextStepRef.current,
        countRemaining: countRemainingRef.current,
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

    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = .9;
    compressor.threshold.value = -15;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = .003;
    compressor.release.value = .18;
    master.connect(compressor).connect(context.destination);
    masterGainRef.current = master;
    compressorRef.current = compressor;
    nextTimeRef.current = context.currentTime + .07;
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
        planned += 1;
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
        const isCountIn = countRemainingRef.current > 0;
        if (isCountIn) {
          const unitSteps = barSteps / currentMeter.beats;
          let units = 0;
          const groupStarts = groupingRef.current.map((size) => {
            const start = Math.round(units * unitSteps);
            units += size;
            return start;
          });
          const state: DrumHitState = groupStarts.includes(stepInBar) ? (stepInBar === 0 ? "accent" : "normal") : "mute";
          scheduleDrumVoice(context, nextTimeRef.current, "rim", state);
        } else if (drumTracksRef.current) {
          for (const voice of DRUM_VOICES) {
            const state = drumTracksRef.current[voice]?.[stepIndex] || "mute";
            scheduleDrumVoice(context, nextTimeRef.current, voice, state);
          }
        } else {
          scheduleDrumVoice(context, nextTimeRef.current, "rim", stepsRef.current[stepIndex] || "normal");
        }

        const visualDelay = Math.max(0, (nextTimeRef.current - context.currentTime) * 1000);
        if (isCountIn) {
          countRemainingRef.current -= 1;
          nextStepRef.current = (stepIndex + 1) % barSteps;
          if (countRemainingRef.current === 0) nextStepRef.current = 0;
        } else {
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
              bpmRef.current = nextBpm;
            }
            if (repeatBarsRef.current && barsRef.current >= repeatBarsRef.current) {
              const stopTimer = window.setTimeout(() => {
                visualTimersRef.current.delete(stopTimer);
                if (generationRef.current === token) stopRef.current();
              }, visualDelay + 20);
              visualTimersRef.current.add(stopTimer);
            }
          }
        }

        const checkpoint: SessionCheckpoint = {
          nextStep: nextStepRef.current,
          countRemaining: countRemainingRef.current,
          bars: barsRef.current,
          bpm: bpmRef.current,
          trainerDirection: trainerDirectionRef.current,
        };
        const timerId = window.setTimeout(() => {
          visualTimersRef.current.delete(timerId);
          if (generationRef.current !== token || phaseRef.current !== "running") return;
          checkpointRef.current = checkpoint;
          setBpm(checkpoint.bpm);
          setCurrentStep(isCountIn ? -1 : stepIndex);
        }, visualDelay);
        visualTimersRef.current.add(timerId);

        let duration = stepSeconds;
        if (subdivisionRef.current === "Achtel" || subdivisionRef.current === "16tel") {
          const pairDuration = stepSeconds * 2;
          const longShare = swingRef.current / 100;
          duration = stepInBar % 2 === 0 ? pairDuration * longShare : pairDuration * (1 - longShare);
        }
        nextTimeRef.current += duration;
      }
      if (endAtRef.current) {
        timerRemainingRef.current = Math.max(0, endAtRef.current - Date.now());
        const remaining = Math.ceil(timerRemainingRef.current / 1000);
        setTimerText(`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`);
        if (remaining <= 0) stopRef.current();
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
  }, [clearRuntime, scheduleDrumVoice, setPlaybackPhase, showToast]);
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

  const togglePlayback = () => {
    if (phaseRef.current === "running" || phaseRef.current === "starting") stopPlayback();
    else if (wantsPlaybackRef.current) {
      generationRef.current += 1;
      recoveryPromiseRef.current = null;
      clearRuntime(true);
      void startPlayback(true);
    }
    else void startPlayback(false);
  };

  const updateBpm = (value: number) => {
    const next = Math.max(20, Math.min(300, Math.round(value)));
    bpmRef.current = next;
    setBpm(next);
  };

  const tapTempo = (event: React.MouseEvent<HTMLButtonElement>) => {
    const now = event.timeStamp;
    const recentTaps = tapTimesRef.current.filter((time) => now - time < 2200);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps.slice(-6);
    if (tapTimesRef.current.length > 1) {
      const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
      updateBpm(60_000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length));
    }
  };

  const changeMeter = (beats: number, denominator = meter.denominator) => {
    if (wantsPlaybackRef.current) stopPlayback();
    const nextMeter: Meter = { beats, denominator };
    const nextSubdivision = hasExactGrid(nextMeter, subdivisionRef.current) ? subdivisionRef.current : "Achtel";
    const nextGrouping = defaultGrouping(nextMeter);
    const nextTempoUnit = defaultTempoUnit(nextMeter, nextGrouping);
    meterRef.current = nextMeter;
    subdivisionRef.current = nextSubdivision;
    groupingRef.current = nextGrouping;
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
    setPatternName("Eigenes Drum-Pattern");
  };

  const updateStep = (index: number) => {
    const next = stepsRef.current.map((step, stepIndex) => stepIndex === index ? cycleStep(step) : step);
    stepsRef.current = next;
    setStepsState(next);
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
    setPatternName("Eigenes Drum-Pattern");
  };

  const loadPattern = (pattern: Pattern, autoStart = false) => {
    const wasPlaying = wantsPlaybackRef.current;
    if (wasPlaying) stopPlayback();
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
    const nextCountIn = playback.countIn ?? 1;
    const nextKit = playback.kit ?? "Studio";
    const nextTrainer = playback.trainer;
    meterRef.current = nextMeter;
    subdivisionRef.current = pattern.subdivision;
    stepsRef.current = nextSteps;
    drumTracksRef.current = nextTracks;
    groupingRef.current = nextGrouping;
    tempoUnitRef.current = nextTempoUnit;
    swingRef.current = nextSwing;
    timerMinutesRef.current = nextTimerMinutes;
    repeatBarsRef.current = nextRepeatBars;
    countInRef.current = nextCountIn;
    soundRef.current = nextKit;
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
    setCountIn(nextCountIn);
    setSound(nextKit);
    setTrainer(Boolean(nextTrainer));
    setTrainerMode(nextTrainer?.mode ?? "up");
    setTrainerStep(nextTrainer?.step ?? 5);
    setTrainerEvery(nextTrainer?.every ?? 8);
    setPatternName(pattern.name);
    if (playback.bpm !== undefined) updateBpm(playback.bpm);
    else if (bpmRef.current < pattern.bpmMin || bpmRef.current > pattern.bpmMax) updateBpm(Math.round((pattern.bpmMin + pattern.bpmMax) / 2));
    setRecent((current) => {
      const next = [pattern, ...current.filter((item) => item.id !== pattern.id)].slice(0, 8);
      void writeStore("recent", next);
      return next;
    });
    showToast(`${pattern.name} geladen`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (autoStart || wasPlaying) void startPlayback(false);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      void writeStore("favorites", next);
      return next;
    });
  };

  const savePreset = () => {
    const preset: Pattern = {
      id: `custom-${Date.now()}`,
      name: presetName.trim() || "Mein Pattern",
      category: presetCategory,
      bpmMin: bpm,
      bpmMax: bpm,
      meter: `${meter.beats}/${meter.denominator}`,
      subdivision,
      bars: Math.max(1, Math.round(steps.length / stepsPerBar(meter, subdivision))),
      grouping: [...grouping],
      tempoUnit,
      pattern: [...steps],
      ...(drumTracks ? {
        drumTracks: cloneDrumTracks(drumTracks),
      } : {}),
      drumOnly: true,
      difficulty: "Mittel",
      instruction: "Eigenes Drum-Pattern — Groove und Dynamik konzentriert wiederholen.",
      playback: {
        bpm,
        swing,
        countIn,
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
    setPresets((current) => {
      const next = [preset, ...current];
      void writeStore("presets", next);
      return next;
    });
    setPatternName(preset.name);
    setEditorOpen(false);
    showToast("Preset offline gespeichert");
  };

  const categories = useMemo(() => ["Alle", ...Array.from(new Set(library.map((item) => item.category)))], [library]);
  const meterOptions = useMemo(() => Array.from(new Set(library.map((item) => item.meter))), [library]);
  const filteredPatterns = useMemo(() => library.filter((pattern) => {
    const query = search.toLocaleLowerCase("de");
    return (!query || `${pattern.name} ${pattern.category} ${pattern.instruction}`.toLocaleLowerCase("de").includes(query))
      && (category === "Alle" || pattern.category === category)
      && (meterFilter === "Alle Takte" || pattern.meter === meterFilter)
      && (difficultyFilter === "Alle Stufen" || pattern.difficulty === difficultyFilter)
      && (subdivisionFilter === "Alle Unterteilungen" || pattern.subdivision === subdivisionFilter);
  }), [library, search, category, meterFilter, difficultyFilter, subdivisionFilter]);

  const resetControls = () => {
    volumeRef.current = 72; soundRef.current = "Studio"; swingRef.current = 50; countInRef.current = 1; timerMinutesRef.current = 0;
    repeatBarsRef.current = 0; trainerRef.current = false; trainerModeRef.current = "up"; trainerMinRef.current = 20; trainerMaxRef.current = 300; trainerDirectionRef.current = 1;
    timerRemainingRef.current = 0;
    setVolume(72); setSound("Studio"); setSwing(50); setCountIn(1); setTimerMinutes(0); setTimerText("∞"); setRepeatBars(0); setTrainer(false); setTrainerMode("up");
    showToast("Einstellungen zurückgesetzt");
  };

  const meterLabel = `${meter.beats}/${meter.denominator}`;
  const isPlaying = phase === "running";
  const cycleBars = Math.max(1, Math.round(steps.length / stepsPerBar(meter, subdivision)));
  const livePresets = [...recent.slice(0, Math.max(0, 3 - presets.length)), ...presets].slice(0, 3);
  const activeDrumEntries = useMemo<Array<[DrumVoice, DrumHitState[]]>>(() => DRUM_VOICES.flatMap((voice) => {
    const track = drumTracks?.[voice];
    return track?.some((state) => state !== "mute") ? [[voice, track] as [DrumVoice, DrumHitState[]]] : [];
  }), [drumTracks]);
  const phaseLabel = phase === "running" ? "Läuft" : phase === "starting" ? "Startet …" : phase === "recovering" ? "Audio kommt zurück …" : phase === "lifecycle-paused" ? "Im Hintergrund pausiert" : "Bereit";

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Zum Drum-Trainer">
          <span className="brand-mark" aria-hidden="true" />
          KLANGMASS
        </button>
        <nav className="nav" aria-label="Hauptnavigation">
          <button className="active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Groove-Trainer</button>
          <button onClick={() => document.querySelector("#bibliothek")?.scrollIntoView({ behavior: "smooth" })}>Bibliothek</button>
          <button onClick={() => document.querySelector("#presets")?.scrollIntoView({ behavior: "smooth" })}>Presets</button>
        </nav>
        <div className="status-pill" title={online ? "Bereit und offline verfügbar" : "Offline-Modus"}>
          <span className="status-dot" /><span>{online ? "Offline bereit" : "Offline"}</span>
        </div>
      </header>

      <div className="page">
        <div className="hero-kicker">Drumgrooves präzise trainieren</div>
        <section className="workspace" aria-label="Drum-Groove-Trainer">
          <div className="panel metronome-panel">
            <div className="meter-head">
              <div className="live-label"><span className={`live-pulse ${isPlaying ? "playing" : ""}`} />{phaseLabel}</div>
              <div className="sound-label">{sound} · {volume}%</div>
            </div>
            <div className="tempo-stage">
              <div className="tempo-caption">Schläge pro Minute · {tempoUnitLabel[tempoUnit]}</div>
              <div className="tempo-line">
                <button className="nudge" onClick={() => updateBpm(bpm - 1)} aria-label="Tempo um eins verringern">−</button>
                <input className="bpm-input" type="number" min="20" max="300" value={bpm} onChange={(event) => updateBpm(Number(event.target.value))} aria-label="Tempo in BPM" />
                <button className="nudge" onClick={() => updateBpm(bpm + 1)} aria-label="Tempo um eins erhöhen">+</button>
              </div>
              <span className="tempo-name">{tempoName(bpm)}</span>
              <div className="range-wrap">
                <input className="tempo-range" type="range" min="20" max="300" value={bpm} onChange={(event) => updateBpm(Number(event.target.value))} aria-label="Tempo-Regler" />
                <div className="range-ticks"><span>20</span><span>80</span><span>140</span><span>200</span><span>260</span><span>300</span></div>
              </div>
            </div>

            <div className="beat-strip">
              <div className="beat-strip-top">
                <div><div className="pattern-name">{patternName}</div><div className="pattern-meta">{meterLabel} · {subdivision} · {steps.length} Schritte{cycleBars > 1 ? ` · ${cycleBars} Takte` : ""}</div></div>
                <button className="edit-link" onClick={() => setEditorOpen(true)}>Pattern bearbeiten</button>
              </div>
              {activeDrumEntries.length ? <div className="drum-grid-scroll" aria-label="Aktuelles Drum-Pattern">
                <div className="drum-grid">
                  {activeDrumEntries.map(([voice, track]) => <div className="drum-lane" key={voice} style={{ gridTemplateColumns: `70px repeat(${steps.length}, minmax(20px, 1fr))` }}>
                    <span className="drum-lane-label">{DRUM_LABELS[voice]}</span>
                    {track.map((state, index) => <button key={index} className={`drum-cell ${state} ${currentStep === index ? "current" : ""}`} onClick={() => updateDrumHit(voice, index)} aria-label={`${DRUM_LABELS[voice]}, Schritt ${index + 1}: ${state}`} />)}
                  </div>)}
                </div>
              </div> : <div className="beat-steps" aria-label="Aktuelles Akzentmuster">
                {steps.map((step, index) => <button key={index} className={`beat-dot ${step} ${currentStep === index ? "current" : ""}`} onClick={() => updateStep(index)} aria-label={`Schritt ${index + 1}: ${step}`} />)}
              </div>}
            </div>

            <div className="transport">
              <button className="tap-button" onClick={tapTempo}>TAP TEMPO</button>
              <button className="play-button" onClick={togglePlayback} aria-label={isPlaying ? "Wiedergabe stoppen" : "Abspielen"}>{isPlaying ? "Ⅱ" : "▶"}</button>
              <div className="transport-note">{timerText === "∞" ? "Ohne Zeitlimit" : `Restzeit ${timerText}`}<br />{repeatBars ? `${repeatBars} Takte` : "Endlos wiederholen"}</div>
            </div>
          </div>

          <aside className="panel controls-panel" aria-label="Drum-Trainer-Einstellungen">
            <div className="panel-title-row"><h2 className="panel-title">Takt & Klang</h2><button className="reset-button" onClick={resetControls}>Zurücksetzen</button></div>
            <div className="control-group">
              <div className="control-label"><span>Taktart</span><span>{meterLabel}</span></div>
              <div className="segmented">
                {[2, 3, 4, 6].map((beats) => <button key={beats} className={meter.beats === beats ? "active" : ""} onClick={() => changeMeter(beats)}>{beats}/{meter.denominator}</button>)}
              </div>
              <div className="select-row" style={{ marginTop: 8 }}>
                <select className="field-select" value={meter.beats} onChange={(event) => changeMeter(Number(event.target.value))} aria-label="Anzahl Schläge">
                  {Array.from({ length: 16 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} Schläge</option>)}
                </select>
                <select className="field-select" value={meter.denominator} onChange={(event) => changeMeter(meter.beats, Number(event.target.value))} aria-label="Notenwert">
                  {[4, 8, 16].map((value) => <option key={value} value={value}>/{value}</option>)}
                </select>
              </div>
            </div>
            <div className="control-group">
              <div className="control-label"><span>Unterteilung</span><span>{subdivision}</span></div>
              <div className="segmented five">
                {SUBDIVISIONS.map((item) => <button key={item} className={subdivision === item ? "active" : ""} disabled={!hasExactGrid(meter, item)} title={!hasExactGrid(meter, item) ? `Kein vollständiges ${item}-Raster in ${meterLabel}` : undefined} onClick={() => changeSubdivision(item)}>{item === "Viertel" ? "¼" : item === "Achtel" ? "⅛" : item === "16tel" ? "¹⁄₁₆" : item === "Triolen" ? "3" : "6"}</button>)}
              </div>
            </div>
            <div className="control-group">
              <div className="control-label"><span>Swing</span><span>{swing}%</span></div>
              <div className="slider-row"><span className="slider-icon">↔</span><input type="range" min="50" max="75" value={swing} onChange={(event) => { const value = Number(event.target.value); swingRef.current = value; setSwing(value); }} aria-label="Swing-Anteil" /><span>{swing}</span></div>
            </div>
            <div className="control-group">
              <div className="control-label"><span>Drumkit & Lautstärke</span><span>{volume}%</span></div>
              <div className="select-row">
                <select className="field-select" value={sound} onChange={(event) => { const value = event.target.value as DrumKit; soundRef.current = value; setSound(value); }} aria-label="Drumkit"><option>Studio</option><option>Trocken</option><option>Elektronisch</option></select>
                <input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Lautstärke" />
              </div>
            </div>
            <div className="control-group">
              <div className="control-label"><span>Session</span><span>{timerText}</span></div>
              <div className="select-row">
                <select className="field-select" value={countIn} onChange={(event) => { const value = Number(event.target.value); countInRef.current = value; setCountIn(value); }} aria-label="Einzähltakte"><option value="0">Ohne Count-in</option><option value="1">1 Takt Count-in</option><option value="2">2 Takte Count-in</option></select>
                <select className="field-select" value={timerMinutes} onChange={(event) => { const value = Number(event.target.value); timerMinutesRef.current = value; setTimerMinutes(value); setTimerText(value ? `${value}:00` : "∞"); }} aria-label="Timer"><option value="0">Timer: aus</option><option value="5">5 Minuten</option><option value="10">10 Minuten</option><option value="20">20 Minuten</option></select>
                <select className="field-select" value={repeatBars} onChange={(event) => { const value = Number(event.target.value); repeatBarsRef.current = value; setRepeatBars(value); }} aria-label="Wiederholungen"><option value="0">Endlos</option><option value="4">4 Takte</option><option value="8">8 Takte</option><option value="16">16 Takte</option><option value="32">32 Takte</option></select>
              </div>
            </div>
            <div className="trainer-card">
              <div className="toggle-row"><div><strong>{trainerMode === "pyramid" ? "Tempo-Pyramide" : "Tempo-Trainer"}</strong><small>{trainerMode === "pyramid" ? "Automatisch hoch und wieder herunter" : "Automatisch schneller werden"}</small></div><button className={`switch ${trainer ? "on" : ""}`} onClick={() => { const value = !trainer; trainerRef.current = value; setTrainer(value); }} aria-label="Tempo-Trainer umschalten" aria-pressed={trainer} /></div>
              {trainer && <div className="trainer-settings"><select value={trainerStep} onChange={(event) => { const value = Number(event.target.value); trainerStepRef.current = value; setTrainerStep(value); }} aria-label="Tempo-Schritt"><option value="2">{trainerMode === "pyramid" ? "±2" : "+2"} BPM</option><option value="5">{trainerMode === "pyramid" ? "±5" : "+5"} BPM</option><option value="10">{trainerMode === "pyramid" ? "±10" : "+10"} BPM</option></select><select value={trainerEvery} onChange={(event) => { const value = Number(event.target.value); trainerEveryRef.current = value; setTrainerEvery(value); }} aria-label="Intervall"><option value="4">alle 4 Takte</option><option value="8">alle 8 Takte</option><option value="16">alle 16 Takte</option></select></div>}
            </div>
          </aside>
        </section>

        <section className="section" id="bibliothek">
          <div className="section-head"><div><div className="section-eyebrow">Drum-Bibliothek · {library.length} Übungen</div><h2>Finde deinen<br />nächsten Groove.</h2></div><p className="section-copy">Kick, Snare, Hats, Cymbals und Toms werden live synthetisiert. Von Grundlagen bis Amen Break — ohne Audiosamples und offline verfügbar.</p></div>
          <div className="category-chips" aria-label="Kategorien">{categories.map((item) => <button key={item} className={`chip ${category === item ? "active" : ""}`} onClick={() => { setCategory(item); setVisibleCount(9); }}>{item}</button>)}</div>
          <div className="filters">
            <label className="search-field"><input className="text-field" placeholder="Pattern, Genre oder Übungsziel suchen …" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Bibliothek durchsuchen" /></label>
            <select className="field-select" value={meterFilter} onChange={(event) => setMeterFilter(event.target.value)} aria-label="Nach Taktart filtern"><option>Alle Takte</option>{meterOptions.map((item) => <option key={item}>{item}</option>)}</select>
            <select className="field-select" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} aria-label="Nach Schwierigkeit filtern"><option>Alle Stufen</option><option>Leicht</option><option>Mittel</option><option>Fortgeschritten</option></select>
            <select className="field-select" value={subdivisionFilter} onChange={(event) => setSubdivisionFilter(event.target.value)} aria-label="Nach Unterteilung filtern"><option>Alle Unterteilungen</option>{SUBDIVISIONS.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <div className="pattern-grid">
            {filteredPatterns.slice(0, visibleCount).map((pattern) => (
              <article className="pattern-card" key={pattern.id}>
                <div className="card-top"><div><div className="card-category">{pattern.category}</div><h3>{pattern.name}</h3></div><button className={`favorite ${favorites.includes(pattern.id) ? "on" : ""}`} onClick={() => toggleFavorite(pattern.id)} aria-label={favorites.includes(pattern.id) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}>{favorites.includes(pattern.id) ? "♥" : "♡"}</button></div>
                <p className="card-instruction">{pattern.instruction}</p>
                <div className="mini-pattern">{pattern.pattern.slice(0, 32).map((step, index) => <span key={index} className={`mini-step ${step}`} />)}</div>
                <div className="card-footer"><div className="card-meta"><span>{pattern.meter}</span><span>{pattern.subdivision}</span><span>{pattern.bpmMin}–{pattern.bpmMax}</span>{(pattern.bars || 1) > 1 && <span>{pattern.bars} Takte</span>}{(pattern.playback?.swing ?? 50) > 50 && <span>Swing {pattern.playback?.swing}%</span>}<span>{pattern.difficulty}</span>{pattern.source && <a className="source-link" href={pattern.source.url} target="_blank" rel="noreferrer" title={pattern.source.label}>Quelle ↗</a>}</div><button className="start-small" onClick={() => loadPattern(pattern, true)}>Starten</button></div>
              </article>
            ))}
            {!filteredPatterns.length && <div className="empty-state">Kein Pattern passt zu diesen Filtern. Ändere Suche oder Auswahl.</div>}
          </div>
          {visibleCount < filteredPatterns.length && <button className="load-more" onClick={() => setVisibleCount((count) => count + 9)}>Mehr Patterns anzeigen</button>}
        </section>

        <section className="section" id="presets">
          <div className="section-head"><div><div className="section-eyebrow">Auf diesem Gerät</div><h2>Zuletzt & selbst gebaut.</h2></div><p className="section-copy">Favoriten, letzte Übungen und eigene Presets werden lokal gespeichert — ohne Konto und ohne Verbindung.</p></div>
          <div className="presets-row">
            {livePresets.map((preset) => <button key={preset.id} className="preset-card" onClick={() => loadPattern(preset)}><small>{preset.category}</small><strong>{preset.name}</strong><span>{preset.meter} · {preset.subdivision} · {preset.bpmMin}{preset.bpmMax !== preset.bpmMin ? `–${preset.bpmMax}` : ""} BPM</span></button>)}
            <button className="preset-card add-preset" onClick={() => setEditorOpen(true)}><span><strong>＋</strong>Eigenes Pattern</span></button>
          </div>
        </section>

        <footer className="footer"><span>KLANGMASS · Synthetische Drumkits</span><span>Installierbar · Offline · Keine Samples · Keine Aufnahme</span></footer>
      </div>

      {editorOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <div className="modal-head"><div><h2 id="editor-title">Drum-Pattern-Editor</h2><p>Tippen wechselt zwischen Schlag, Akzent, Ghostnote und Stille.</p></div><button className="close-button" onClick={() => setEditorOpen(false)} aria-label="Editor schließen">×</button></div>
          <div className="drum-editor-scroll">
            <div className="drum-editor-grid">
              {DRUM_VOICES.map((voice) => {
                const track = drumTracks?.[voice] || Array<DrumHitState>(steps.length).fill("mute");
                return <div className="drum-lane editor-lane" key={voice} style={{ gridTemplateColumns: `82px repeat(${steps.length}, 34px)` }}>
                  <span className="drum-lane-label">{DRUM_LABELS[voice]}</span>
                  {track.map((state, index) => <button key={index} className={`editor-step ${state}`} onClick={() => updateDrumHit(voice, index)} aria-label={`${DRUM_LABELS[voice]}, Schritt ${index + 1} ändern`}>{index + 1}</button>)}
                </div>;
              })}
            </div>
          </div>
          <div className="editor-legend"><span><i className="legend-dot accent" />Akzent</span><span><i className="legend-dot" />Schlag</span><span><i className="legend-dot ghost" />Ghostnote</span><span><i className="legend-dot mute" />Stille</span></div>
          <div className="editor-fields"><input className="text-field" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Name des Patterns" aria-label="Preset-Name" /><select className="field-select" value={presetCategory} onChange={(event) => setPresetCategory(event.target.value)} aria-label="Preset-Kategorie"><option>Eigene Presets</option><option>Groove</option><option>Rudiment</option><option>Timing</option><option>Song</option></select></div>
          <div className="modal-actions"><button className="secondary" onClick={() => { const nextTracks = defaultDrumTracks(meter, subdivision); const nextSteps = mergeDrumTracks(nextTracks, stepsPerBar(meter, subdivision)); drumTracksRef.current = nextTracks; stepsRef.current = nextSteps; setDrumTracks(nextTracks); setStepsState(nextSteps); }}>Zurücksetzen</button><button className="primary" onClick={savePreset}>Offline speichern</button></div>
        </section>
      </div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
