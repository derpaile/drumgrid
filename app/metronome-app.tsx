"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cloneDrumTracks, cycleDrumHit, cycleStep, defaultDrumTracks, defaultGrouping, defaultTempoUnit,
  DRUM_LABELS, DRUM_VOICES, FALLBACK_PATTERNS, firstValidSubdivision, hasExactGrid, HIT_LABELS,
  learningGoalsFor, mergeDrumTracks, normalizedDrumTracks, normalizedSteps, parseMeter, stepsPerBar,
  SUBDIVISIONS, tempoName, tempoUnitLabel,
  type DrumHitState, type DrumKit, type DrumTracks, type DrumVoice, type Meter, type Pattern,
  type PracticeEntry, type StepState, type Subdivision, type TempoUnit, type TrainerMode,
} from "./metronome-core";
import { clearLocalData, deleteStore, readStore, writeStore } from "./local-store";

type PlaybackPhase = "stopped" | "starting" | "running" | "lifecycle-paused" | "recovering";
type SessionCheckpoint = { nextStep: number; countRemaining: number; bars: number; bpm: number; trainerDirection: 1 | -1 };
type AppSection = "trainer" | "library" | "mine";
type SessionKind = "free" | "timing" | "groove" | "speed";
type PwaStatus = "checking" | "ready" | "offline" | "update" | "error";
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type MidiInputLike = { onmidimessage: ((event: { data: Uint8Array }) => void) | null };
type MidiAccessLike = { inputs: Map<string, MidiInputLike>; onstatechange: (() => void) | null };

type WakeLockHandle = { release: () => Promise<void> };

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
  const [currentStep, setCurrentStep] = useState(-1);
  const [sessionBars, setSessionBars] = useState(0);
  const [sessionKind, setSessionKind] = useState<SessionKind>("free");
  const [section, setSection] = useState<AppSection>("trainer");
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const [trainerMin, setTrainerMin] = useState(20);
  const [trainerMax, setTrainerMax] = useState(300);
  const [library, setLibrary] = useState<Pattern[]>(FALLBACK_PATTERNS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [presets, setPresets] = useState<Pattern[]>([]);
  const [recent, setRecent] = useState<Pattern[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeEntry[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [goalFilter, setGoalFilter] = useState("Alle Ziele");
  const [meterFilter, setMeterFilter] = useState("Alle Takte");
  const [difficultyFilter, setDifficultyFilter] = useState("Alle Stufen");
  const [subdivisionFilter, setSubdivisionFilter] = useState("Alle Unterteilungen");
  const [visibleCount, setVisibleCount] = useState(9);
  const [editorOpen, setEditorOpen] = useState(false);
  const [presetName, setPresetName] = useState("Mein Pattern");
  const [presetCategory, setPresetCategory] = useState("Eigene Presets");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editorTracks, setEditorTracks] = useState<DrumTracks>({});
  const [editorSteps, setEditorSteps] = useState<StepState[]>([]);
  const [editorHistory, setEditorHistory] = useState<DrumTracks[]>([]);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [libraryStatus, setLibraryStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>("checking");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [storageError, setStorageError] = useState("");
  const [midiStatus, setMidiStatus] = useState<"idle" | "connected" | "unsupported" | "denied">("idle");

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
  const patternNameRef = useRef(patternName);
  const patternIdRef = useRef(patternId);
  const sessionStartedAtRef = useRef(0);
  const sessionStartBpmRef = useRef(bpm);
  const practiceHistoryRef = useRef<PracticeEntry[]>([]);
  const drumGridScrollRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const editorTriggerRef = useRef<HTMLElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const midiAccessRef = useRef<MidiAccessLike | null>(null);
  const updateRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

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
  useEffect(() => { trainerMinRef.current = trainerMin; }, [trainerMin]);
  useEffect(() => { trainerMaxRef.current = trainerMax; }, [trainerMax]);
  useEffect(() => { repeatBarsRef.current = repeatBars; }, [repeatBars]);
  useEffect(() => { patternNameRef.current = patternName; }, [patternName]);
  useEffect(() => { patternIdRef.current = patternId; }, [patternId]);
  useEffect(() => { practiceHistoryRef.current = practiceHistory; }, [practiceHistory]);

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
    const serviceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "OFFLINE_READY") setPwaStatus(navigator.onLine ? "ready" : "offline");
    };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("beforeinstallprompt", installHandler);
    window.addEventListener("appinstalled", installedHandler);
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
        const runtimeUrls = performance.getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => {
            try { return new URL(url).origin === location.origin; } catch { return false; }
          });
        ready.active?.postMessage({ type: "PRECACHE_URLS", urls: [location.href, ...runtimeUrls] });
      }).catch(() => setPwaStatus("error"));
    } else queueMicrotask(() => setPwaStatus("error"));
    Promise.all([
      readStore<string[]>("favorites", []),
      readStore<Pattern[]>("presets", []),
      readStore<Pattern[]>("recent", []),
      readStore<PracticeEntry[]>("practiceHistory", []),
      readStore<number>("libraryVersion", 1),
    ]).then(([savedFavorites, savedPresets, savedRecent, savedPractice, savedVersion]) => {
      const compatible = savedVersion === 2;
      setFavorites(compatible ? savedFavorites : []);
      setPresets(Array.isArray(savedPresets) ? savedPresets.filter((item) => item?.id?.startsWith("custom-") && item.drumTracks) : []);
      setRecent(compatible ? savedRecent : []);
      setPracticeHistory(Array.isArray(savedPractice) ? savedPractice.slice(0, 100) : []);
      if (!compatible) {
        void persistStore("favorites", []);
        void persistStore("recent", []);
      }
    });
    fetch("/data/patterns-v1.json")
      .then((response) => {
        if (!response.ok) throw new Error("Bibliothek nicht erreichbar");
        return response.json();
      })
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
    const startedAt = sessionStartedAtRef.current;
    const elapsedSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    if (elapsedSeconds >= 10 && barsRef.current > 0) {
      const entry: PracticeEntry = {
        id: `session-${Date.now()}`,
        patternId: patternIdRef.current,
        patternName: patternNameRef.current,
        durationSeconds: elapsedSeconds,
        bars: barsRef.current,
        bpmStart: sessionStartBpmRef.current,
        bpmEnd: bpmRef.current,
        completedAt: new Date().toISOString(),
      };
      const nextHistory = [entry, ...practiceHistoryRef.current].slice(0, 100);
      practiceHistoryRef.current = nextHistory;
      setPracticeHistory(nextHistory);
      void persistStore("practiceHistory", nextHistory);
    }
    sessionStartedAtRef.current = 0;
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
  }, [clearRuntime, persistStore, setPlaybackPhase]);
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
      setSessionBars(0);
      sessionStartedAtRef.current = Date.now();
      sessionStartBpmRef.current = bpmRef.current;
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
        if (endAtRef.current && Date.now() + Math.max(0, nextTimeRef.current - context.currentTime) * 1000 >= endAtRef.current) {
          stopRef.current();
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
              }, visualDelay + stepSeconds * 1000 + 20);
              visualTimersRef.current.add(stopTimer);
              stopAfterStep = true;
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

  const togglePlayback = useCallback(() => {
    if (phaseRef.current === "running" || phaseRef.current === "starting") stopPlayback();
    else if (wantsPlaybackRef.current) {
      generationRef.current += 1;
      recoveryPromiseRef.current = null;
      clearRuntime(true);
      void startPlayback(true);
    }
    else void startPlayback(false);
  }, [clearRuntime, startPlayback, stopPlayback]);

  const updateBpm = useCallback((value: number) => {
    const next = Math.max(20, Math.min(300, Math.round(value)));
    bpmRef.current = next;
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
      if (target?.matches("input, select, textarea, [contenteditable='true']")) return;
      if (editorOpen) return;
      if (event.code === "Space") { event.preventDefault(); togglePlayback(); }
      else if (event.key.toLocaleLowerCase("de") === "t") registerTap(performance.now());
      else if (event.key === "+" || event.key === "=") updateBpm(bpmRef.current + 1);
      else if (event.key === "-") updateBpm(bpmRef.current - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editorOpen, registerTap, togglePlayback, updateBpm]);

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

  const openEditor = (preset?: Pattern, trigger?: HTMLElement) => {
    editorTriggerRef.current = trigger || document.activeElement as HTMLElement | null;
    const sourceSteps = preset?.pattern || stepsRef.current;
    const sourceTracks = normalizedDrumTracks(preset?.drumTracks || drumTracksRef.current || defaultDrumTracks(meterRef.current, subdivisionRef.current), sourceSteps.length) || {};
    setEditorTracks(cloneDrumTracks(sourceTracks));
    setEditorSteps([...sourceSteps]);
    setEditorHistory([]);
    setPresetName(preset?.name || patternNameRef.current || "Mein Pattern");
    setPresetCategory(preset?.category || "Eigene Presets");
    setEditingPresetId(preset?.id.startsWith("custom-") ? preset.id : null);
    setEditorOpen(true);
  };

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    window.setTimeout(() => editorTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!editorOpen) return;
    const background = document.querySelector<HTMLElement>(".app-content");
    background?.setAttribute("inert", "");
    document.body.classList.add("modal-open");
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ) || []);
    window.setTimeout(() => focusables()[0]?.focus(), 0);
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") return closeEditor();
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("keydown", keyHandler);
      background?.removeAttribute("inert");
      document.body.classList.remove("modal-open");
    };
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
    setEditorTracks(next);
    setEditorSteps(mergeDrumTracks(next, length));
  };

  const undoEditor = () => {
    const previous = editorHistory.at(-1);
    if (!previous) return;
    setEditorTracks(cloneDrumTracks(previous));
    setEditorSteps(mergeDrumTracks(previous, editorSteps.length));
    setEditorHistory((current) => current.slice(0, -1));
  };

  const clearEditorLane = (voice: DrumVoice) => {
    setEditorHistory((current) => [...current.slice(-19), cloneDrumTracks(editorTracks)]);
    const next = cloneDrumTracks(editorTracks);
    next[voice] = Array<DrumHitState>(editorSteps.length).fill("mute");
    setEditorTracks(next);
    setEditorSteps(mergeDrumTracks(next, editorSteps.length));
  };

  const resizeEditorBars = (bars: number) => {
    const length = stepsPerBar(meter, subdivision) * bars;
    setEditorHistory((current) => [...current.slice(-19), cloneDrumTracks(editorTracks)]);
    const next = normalizedDrumTracks(editorTracks, length) || {};
    setEditorTracks(next);
    setEditorSteps(mergeDrumTracks(next, length));
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
    setTrainerMin(nextTrainer?.min ?? 20);
    setTrainerMax(nextTrainer?.max ?? 300);
    setPatternId(pattern.id);
    setPatternName(pattern.name);
    setPatternInstruction(pattern.instruction);
    setPatternAttribution(pattern.attribution || (pattern.source ? "Quellenbasierte Übungsrekonstruktion" : "Genreübung"));
    setPatternGoals(learningGoalsFor(pattern));
    if (playback.bpm !== undefined) updateBpm(playback.bpm);
    else if (bpmRef.current < pattern.bpmMin || bpmRef.current > pattern.bpmMax) updateBpm(Math.round((pattern.bpmMin + pattern.bpmMax) / 2));
    setRecent((current) => {
      const next = [pattern, ...current.filter((item) => item.id !== pattern.id)].slice(0, 8);
      void persistStore("recent", next);
      return next;
    });
    showToast(`${pattern.name} geladen`);
    setSection("trainer");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (autoStart || wasPlaying) void startPlayback(false);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      void persistStore("favorites", next);
      return next;
    });
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
    const nextPresets = editingPresetId
      ? presets.map((item) => item.id === editingPresetId ? preset : item)
      : [preset, ...presets];
    const saved = await persistStore("presets", nextPresets);
    if (!saved) return;
    setPresets(nextPresets);
    setPatternId(preset.id);
    setPatternName(preset.name);
    setPatternInstruction(preset.instruction);
    setPatternAttribution("Eigenes Preset");
    setPatternGoals(["Eigene Übung"]);
    drumTracksRef.current = cloneDrumTracks(editorTracks);
    stepsRef.current = [...editorSteps];
    setDrumTracks(cloneDrumTracks(editorTracks));
    setStepsState([...editorSteps]);
    closeEditor();
    showToast(editingPresetId ? "Preset aktualisiert" : "Preset offline gespeichert");
  };

  const deletePresetById = async (id: string) => {
    const next = presets.filter((item) => item.id !== id);
    if (!await persistStore("presets", next)) return;
    setPresets(next);
    await deleteStore(`preset:${id}`).catch(() => undefined);
    showToast("Preset gelöscht");
  };

  const exportLocalData = () => {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), presets, favorites, practiceHistory }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `klangmass-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importLocalData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { presets?: Pattern[]; favorites?: string[]; practiceHistory?: PracticeEntry[] };
      const importedPresets = Array.isArray(data.presets) ? data.presets.filter((item) => item?.id && item?.drumTracks && Array.isArray(item.pattern)) : [];
      const merged = [...importedPresets, ...presets.filter((item) => !importedPresets.some((candidate) => candidate.id === item.id))];
      await Promise.all([
        persistStore("presets", merged),
        persistStore("favorites", Array.isArray(data.favorites) ? data.favorites : favorites),
        persistStore("practiceHistory", Array.isArray(data.practiceHistory) ? data.practiceHistory : practiceHistory),
      ]);
      setPresets(merged);
      if (Array.isArray(data.favorites)) setFavorites(data.favorites);
      if (Array.isArray(data.practiceHistory)) setPracticeHistory(data.practiceHistory);
      showToast(`${importedPresets.length} Presets importiert`);
    } catch {
      setStorageError("Diese Backup-Datei ist ungültig.");
    }
  };

  const categories = useMemo(() => ["Alle", ...Array.from(new Set(library.map((item) => item.category)))], [library]);
  const meterOptions = useMemo(() => Array.from(new Set(library.map((item) => item.meter))), [library]);
  const goalOptions = useMemo(() => ["Alle Ziele", ...Array.from(new Set(library.flatMap(learningGoalsFor)))], [library]);
  const filteredPatterns = useMemo(() => library.filter((pattern) => {
    const query = search.toLocaleLowerCase("de");
    return (!query || `${pattern.name} ${pattern.category} ${pattern.instruction} ${learningGoalsFor(pattern).join(" ")}`.toLocaleLowerCase("de").includes(query))
      && (category === "Alle" || pattern.category === category)
      && (goalFilter === "Alle Ziele" || learningGoalsFor(pattern).includes(goalFilter))
      && (meterFilter === "Alle Takte" || pattern.meter === meterFilter)
      && (difficultyFilter === "Alle Stufen" || pattern.difficulty === difficultyFilter)
      && (subdivisionFilter === "Alle Unterteilungen" || pattern.subdivision === subdivisionFilter);
  }), [library, search, category, goalFilter, meterFilter, difficultyFilter, subdivisionFilter]);

  const resetControls = () => {
    volumeRef.current = 72; soundRef.current = "Studio"; swingRef.current = 50; countInRef.current = 1; timerMinutesRef.current = 0;
    repeatBarsRef.current = 0; trainerRef.current = false; trainerModeRef.current = "up"; trainerMinRef.current = 20; trainerMaxRef.current = 300; trainerDirectionRef.current = 1;
    timerRemainingRef.current = 0;
    setVolume(72); setSound("Studio"); setSwing(50); setCountIn(1); setTimerMinutes(0); setTimerText("∞"); setRepeatBars(0); setTrainer(false); setTrainerMode("up"); setTrainerMin(20); setTrainerMax(300);
    showToast("Einstellungen zurückgesetzt");
  };

  const chooseSession = (kind: SessionKind) => {
    setSessionKind(kind);
    if (kind === "free") {
      timerMinutesRef.current = 0; trainerRef.current = false;
      setTimerMinutes(0); setTimerText("∞"); setTrainer(false);
    } else if (kind === "timing") {
      timerMinutesRef.current = 5; trainerRef.current = false; countInRef.current = 1;
      setTimerMinutes(5); setTimerText("5:00"); setTrainer(false); setCountIn(1);
    } else if (kind === "groove") {
      timerMinutesRef.current = 10; trainerRef.current = false; countInRef.current = 1;
      setTimerMinutes(10); setTimerText("10:00"); setTrainer(false); setCountIn(1);
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
      setFavorites([]); setPresets([]); setRecent([]); setPracticeHistory([]);
      showToast("Lokale Daten gelöscht");
    } catch {
      setStorageError("Lokale Daten konnten nicht gelöscht werden.");
    }
  };

  const meterLabel = `${meter.beats}/${meter.denominator}`;
  const isPlaying = phase === "running";
  const cycleBars = Math.max(1, Math.round(steps.length / stepsPerBar(meter, subdivision)));
  const favoritePatterns = library.filter((item) => favorites.includes(item.id));
  const practicedMinutes = Math.round(practiceHistory.reduce((sum, item) => sum + item.durationSeconds, 0) / 60);
  const activeDrumEntries = useMemo<Array<[DrumVoice, DrumHitState[]]>>(() => DRUM_VOICES.flatMap((voice) => {
    const track = drumTracks?.[voice];
    return track?.some((state) => state !== "mute") ? [[voice, track] as [DrumVoice, DrumHitState[]]] : [];
  }), [drumTracks]);
  const phaseLabel = phase === "running" ? "Läuft" : phase === "starting" ? "Startet …" : phase === "recovering" ? "Audio kommt zurück …" : phase === "lifecycle-paused" ? "Im Hintergrund pausiert" : "Bereit";
  const pwaLabel = !online ? "Offline" : pwaStatus === "ready" ? "Offline bereit" : pwaStatus === "update" ? "Update bereit" : pwaStatus === "error" ? "Nur online" : "Wird vorbereitet";

  return (
    <main className="app-shell">
      <div className="app-content">
      <header className="topbar">
        <button className="brand" onClick={() => navigateTo("trainer")} aria-label="Zum Drum-Trainer">
          <span className="brand-mark" aria-hidden="true" />
          KLANGMASS
        </button>
        <nav className="nav" aria-label="Hauptnavigation">
          <button className={section === "trainer" ? "active" : ""} aria-current={section === "trainer" ? "page" : undefined} onClick={() => navigateTo("trainer")}>Üben</button>
          <button className={section === "library" ? "active" : ""} aria-current={section === "library" ? "page" : undefined} onClick={() => navigateTo("library")}>Bibliothek</button>
          <button className={section === "mine" ? "active" : ""} aria-current={section === "mine" ? "page" : undefined} onClick={() => navigateTo("mine")}>Meine Grooves</button>
        </nav>
        <button className={`status-pill ${pwaStatus}`} onClick={pwaStatus === "update" ? applyUpdate : installPrompt ? installApp : undefined} title={pwaLabel}>
          <span className="status-dot" /><span>{installPrompt && pwaStatus === "ready" ? "Installieren" : pwaLabel}</span>
        </button>
      </header>

      <div className="page">
        <section className="session-launch" id="trainer" aria-labelledby="page-title">
          <div><div className="hero-kicker">Drumgrooves präzise trainieren</div><h1 id="page-title">Was möchtest du heute üben?</h1><p>Wähle einen Rahmen oder starte direkt frei. Alles bleibt lokal auf diesem Gerät.</p></div>
          <div className="session-options" aria-label="Session wählen">
            {([
              ["free", "Freies Training", "Ohne Zeitlimit"],
              ["timing", "5 Min. Timing", "Konstanz zuerst"],
              ["groove", "10 Min. Groove", "Pocket vertiefen"],
              ["speed", "Tempo-Pyramide", "Kontrolliert steigern"],
            ] as Array<[SessionKind, string, string]>).map(([kind, title, copy]) => <button key={kind} className={sessionKind === kind ? "active" : ""} aria-pressed={sessionKind === kind} onClick={() => chooseSession(kind)}><strong>{title}</strong><span>{copy}</span></button>)}
          </div>
        </section>
        <section className="workspace" aria-label="Drum-Groove-Trainer">
          <div className="panel metronome-panel">
            <div className="meter-head">
              <div className="live-label"><span className={`live-pulse ${isPlaying ? "playing" : ""}`} />{phaseLabel}</div>
              <div className="sound-label">{sound} · {volume}%</div>
            </div>
            <div className="session-context">
              <div><span className="authenticity-badge">{patternAttribution}</span><strong>{patternInstruction}</strong></div>
              <div className="goal-tags">{patternGoals.map((goal) => <span key={goal}>{goal}</span>)}</div>
              <div className="session-progress" aria-live="polite"><span>{sessionBars} Takte</span><span>{timerText === "∞" ? "freie Session" : `${timerText} verbleibend`}</span></div>
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
                <button className="edit-link" onClick={(event) => openEditor(undefined, event.currentTarget)}>Pattern bearbeiten</button>
              </div>
              {activeDrumEntries.length ? <div className="drum-grid-scroll" ref={drumGridScrollRef} role="region" aria-label="Aktuelles Drum-Pattern">
                <div className="drum-grid">
                  <div className="drum-lane drum-ruler" style={{ gridTemplateColumns: `70px repeat(${steps.length}, minmax(20px, 1fr))` }}><span className="drum-lane-label">Takt</span>{steps.map((_, index) => <span key={index} className={index % stepsPerBar(meter, subdivision) === 0 ? "bar-start" : ""}>{index % stepsPerBar(meter, subdivision) === 0 ? Math.floor(index / stepsPerBar(meter, subdivision)) + 1 : ""}</span>)}</div>
                  {activeDrumEntries.map(([voice, track]) => <div className="drum-lane" key={voice} style={{ gridTemplateColumns: `70px repeat(${steps.length}, minmax(20px, 1fr))` }}>
                    <span className="drum-lane-label">{DRUM_LABELS[voice]}</span>
                    {track.map((state, index) => <button key={index} data-step={index} className={`drum-cell ${state} ${currentStep === index ? "current" : ""} ${index % stepsPerBar(meter, subdivision) === 0 ? "bar-start" : ""}`} onClick={() => updateDrumHit(voice, index)} aria-label={`${DRUM_LABELS[voice]}, Schritt ${index + 1}: ${HIT_LABELS[state]}`} aria-pressed={state !== "mute"} />)}
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
            <div className="shortcut-hint">Leertaste: Start/Stop · T: Tap Tempo · +/−: BPM</div>
          </div>

          <aside className={`panel controls-panel ${advancedOpen ? "advanced-open" : ""}`} aria-label="Drum-Trainer-Einstellungen">
            <div className="panel-title-row"><h2 className="panel-title">Session & Klang</h2><button className="reset-button" onClick={resetControls}>Zurücksetzen</button></div>
            <div className="quick-settings">
              <div className="control-group"><div className="control-label"><span>Drumkit & Lautstärke</span><span>{volume}%</span></div><div className="select-row"><select className="field-select" value={sound} onChange={(event) => { const value = event.target.value as DrumKit; soundRef.current = value; setSound(value); }} aria-label="Drumkit"><option>Studio</option><option>Trocken</option><option>Elektronisch</option></select><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Lautstärke" /></div></div>
              <div className="control-group"><div className="control-label"><span>Session</span><span>{timerText}</span></div><div className="select-row"><select className="field-select" value={countIn} onChange={(event) => { const value = Number(event.target.value); countInRef.current = value; setCountIn(value); }} aria-label="Einzähltakte"><option value="0">Ohne Count-in</option><option value="1">1 Takt Count-in</option><option value="2">2 Takte Count-in</option></select><select className="field-select" value={timerMinutes} onChange={(event) => { const value = Number(event.target.value); timerMinutesRef.current = value; setTimerMinutes(value); setTimerText(value ? `${value}:00` : "∞"); }} aria-label="Timer"><option value="0">Timer: aus</option><option value="5">5 Minuten</option><option value="10">10 Minuten</option><option value="20">20 Minuten</option></select></div></div>
              <button className="advanced-toggle" onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen}>{advancedOpen ? "Weniger Einstellungen" : "Takt, Swing & Trainer"}</button>
              <button className="midi-button" onClick={enableMidi} disabled={midiStatus === "connected"}>{midiStatus === "connected" ? "MIDI-Pedal verbunden" : midiStatus === "unsupported" ? "MIDI nicht unterstützt" : midiStatus === "denied" ? "MIDI-Zugriff abgelehnt" : "MIDI-Pedal verbinden"}</button>
            </div>
            <div className={`advanced-settings ${advancedOpen ? "open" : ""}`}>
            <div className="control-group">
              <div className="control-label"><span>Taktart</span><span>{meterLabel}</span></div>
              <div className="segmented">
                {[2, 3, 4, 6].map((beats) => <button key={beats} className={meter.beats === beats ? "active" : ""} aria-pressed={meter.beats === beats} onClick={() => changeMeter(beats)}>{beats}/{meter.denominator}</button>)}
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
                {SUBDIVISIONS.map((item) => <button key={item} className={subdivision === item ? "active" : ""} aria-pressed={subdivision === item} disabled={!hasExactGrid(meter, item)} title={!hasExactGrid(meter, item) ? `Kein vollständiges ${item}-Raster in ${meterLabel}` : undefined} onClick={() => changeSubdivision(item)}>{item === "Viertel" ? "¼" : item === "Achtel" ? "⅛" : item === "16tel" ? "¹⁄₁₆" : item === "Triolen" ? "3" : "6"}</button>)}
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
              {trainer && <div className="trainer-settings"><select value={trainerMode} onChange={(event) => { const value = event.target.value as TrainerMode; trainerModeRef.current = value; setTrainerMode(value); }} aria-label="Trainer-Modus"><option value="up">Steigern</option><option value="pyramid">Pyramide</option></select><select value={trainerStep} onChange={(event) => { const value = Number(event.target.value); trainerStepRef.current = value; setTrainerStep(value); }} aria-label="Tempo-Schritt"><option value="2">{trainerMode === "pyramid" ? "±2" : "+2"} BPM</option><option value="5">{trainerMode === "pyramid" ? "±5" : "+5"} BPM</option><option value="10">{trainerMode === "pyramid" ? "±10" : "+10"} BPM</option></select><select value={trainerEvery} onChange={(event) => { const value = Number(event.target.value); trainerEveryRef.current = value; setTrainerEvery(value); }} aria-label="Intervall"><option value="4">alle 4 Takte</option><option value="8">alle 8 Takte</option><option value="16">alle 16 Takte</option></select><label>Start<input type="number" min="20" max="300" value={trainerMin} onChange={(event) => setTrainerMin(Number(event.target.value))} /></label><label>Ziel<input type="number" min="20" max="300" value={trainerMax} onChange={(event) => setTrainerMax(Number(event.target.value))} /></label><p>{bpm} BPM → {trainerMode === "pyramid" ? `${trainerMax} → ${trainerMin}` : trainerMax} · alle {trainerEvery} Takte</p></div>}
            </div>
            <button className="advanced-toggle advanced-close" onClick={() => setAdvancedOpen(false)}>Weniger Einstellungen</button>
            </div>
          </aside>
        </section>

        <section className="section" id="bibliothek">
          <div className="section-head"><div><div className="section-eyebrow">Drum-Bibliothek · {libraryStatus === "loading" ? "lädt …" : libraryStatus === "fallback" ? "Fallback" : `${library.length} Übungen`}</div><h2>Finde deinen<br />nächsten Groove.</h2></div><p className="section-copy">Nach Lernziel, Schwierigkeit und Stil filtern. Quellenbasierte Rekonstruktionen sind klar von Genreübungen getrennt.</p></div>
          <div className="learning-paths" aria-label="Lernpfade">{[["Grundlagen","Erster Backbeat"],["Pocket","Pocket & Dynamik"],["Fußtechnik","Kick-Kontrolle"],["Ungerade Takte","Odd Meter"]].map(([goal,title]) => <button key={goal} onClick={() => { setGoalFilter(goal); setVisibleCount(9); }}><span>{goal}</span><strong>{title}</strong></button>)}</div>
          <div className="category-chips" aria-label="Kategorien">{categories.map((item) => <button key={item} className={`chip ${category === item ? "active" : ""}`} aria-pressed={category === item} onClick={() => { setCategory(item); setVisibleCount(9); }}>{item}</button>)}</div>
          <div className="filters">
            <label className="search-field"><input className="text-field" placeholder="Pattern, Genre oder Übungsziel suchen …" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Bibliothek durchsuchen" /></label>
            <select className="field-select" value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)} aria-label="Nach Übungsziel filtern">{goalOptions.map((item) => <option key={item}>{item}</option>)}</select>
            <select className="field-select" value={meterFilter} onChange={(event) => setMeterFilter(event.target.value)} aria-label="Nach Taktart filtern"><option>Alle Takte</option>{meterOptions.map((item) => <option key={item}>{item}</option>)}</select>
            <select className="field-select" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} aria-label="Nach Schwierigkeit filtern"><option>Alle Stufen</option><option>Leicht</option><option>Mittel</option><option>Fortgeschritten</option></select>
            <select className="field-select" value={subdivisionFilter} onChange={(event) => setSubdivisionFilter(event.target.value)} aria-label="Nach Unterteilung filtern"><option>Alle Unterteilungen</option>{SUBDIVISIONS.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <div className="pattern-grid">
            {filteredPatterns.slice(0, visibleCount).map((pattern) => (
              <article className="pattern-card" key={pattern.id}>
                <div className="card-top"><div><div className="card-category">{pattern.category} · {pattern.attribution || (pattern.source ? "Übungsrekonstruktion" : "Genreübung")}</div><h3>{pattern.name}</h3></div><button className={`favorite ${favorites.includes(pattern.id) ? "on" : ""}`} onClick={() => toggleFavorite(pattern.id)} aria-label={favorites.includes(pattern.id) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"} aria-pressed={favorites.includes(pattern.id)}>{favorites.includes(pattern.id) ? "♥" : "♡"}</button></div>
                <p className="card-instruction">{pattern.instruction}</p>
                <div className="goal-tags">{learningGoalsFor(pattern).map((goal) => <span key={goal}>{goal}</span>)}</div>
                <div className="mini-pattern">{pattern.pattern.slice(0, 32).map((step, index) => <span key={index} className={`mini-step ${step}`} />)}</div>
                <div className="card-footer"><div className="card-meta"><span>{pattern.meter}</span><span>{pattern.subdivision}</span><span>{pattern.bpmMin}–{pattern.bpmMax}</span>{(pattern.bars || 1) > 1 && <span>{pattern.bars} Takte</span>}{(pattern.playback?.swing ?? 50) > 50 && <span>Swing {pattern.playback?.swing}%</span>}<span>{pattern.difficulty}</span>{pattern.source && <a className="source-link" href={pattern.source.url} target="_blank" rel="noreferrer" title={pattern.source.label}>Quelle ↗</a>}</div><div className="card-actions"><button className="secondary-small" onClick={() => loadPattern(pattern)}>Laden</button><button className="start-small" onClick={() => loadPattern(pattern, true)}>Üben</button></div></div>
              </article>
            ))}
            {!filteredPatterns.length && <div className="empty-state">Kein Pattern passt zu diesen Filtern. Ändere Suche oder Auswahl.</div>}
          </div>
          {visibleCount < filteredPatterns.length && <button className="load-more" onClick={() => setVisibleCount((count) => count + 9)}>Mehr Patterns anzeigen</button>}
        </section>

        <section className="section mine-section" id="meine-grooves">
          <div className="section-head"><div><div className="section-eyebrow">Auf diesem Gerät</div><h2>Meine Grooves.</h2></div><div className="mine-actions"><button onClick={exportLocalData}>Backup exportieren</button><button onClick={() => importInputRef.current?.click()}>Backup importieren</button><button className="primary" onClick={(event) => openEditor(undefined, event.currentTarget)}>＋ Eigenes Pattern</button><input ref={importInputRef} type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importLocalData(file); event.target.value = ""; }} /></div></div>
          <div className="practice-summary"><div><strong>{practicedMinutes}</strong><span>Minuten geübt</span></div><div><strong>{practiceHistory.length}</strong><span>Sessions</span></div><div><strong>{favorites.length}</strong><span>Favoriten</span></div><div><strong>{presets.length}</strong><span>Eigene Presets</span></div></div>

          <div className="mine-block"><div className="mine-block-head"><h3>Favoriten</h3><span>{favoritePatterns.length}</span></div><div className="compact-cards">{favoritePatterns.length ? favoritePatterns.map((pattern) => <button key={pattern.id} onClick={() => loadPattern(pattern)}><small>{pattern.category}</small><strong>{pattern.name}</strong><span>{pattern.meter} · {pattern.difficulty}</span></button>) : <p>Noch keine Favoriten. Markiere interessante Übungen mit ♥.</p>}</div></div>
          <div className="mine-block"><div className="mine-block-head"><h3>Zuletzt verwendet</h3><span>{recent.length}</span></div><div className="compact-cards">{recent.length ? recent.map((pattern) => <button key={pattern.id} onClick={() => loadPattern(pattern)}><small>{pattern.category}</small><strong>{pattern.name}</strong><span>{pattern.meter} · {pattern.subdivision}</span></button>) : <p>Deine zuletzt geladenen Grooves erscheinen hier.</p>}</div></div>
          <div className="mine-block"><div className="mine-block-head"><h3>Eigene Presets</h3><span>{presets.length}</span></div><div className="preset-manager">{presets.length ? presets.map((preset) => <article key={preset.id}><div><small>{preset.category}</small><strong>{preset.name}</strong><span>{preset.meter} · {preset.subdivision} · {preset.bpmMin} BPM</span></div><div><button onClick={() => loadPattern(preset)}>Laden</button><button onClick={(event) => openEditor(preset, event.currentTarget)}>Bearbeiten</button><button onClick={() => openEditor({ ...preset, id: `copy-${preset.id}`, name: `${preset.name} Kopie` }, undefined)}>Duplizieren</button><button className="danger" onClick={() => void deletePresetById(preset.id)}>Löschen</button></div></article>) : <button className="empty-preset" onClick={(event) => openEditor(undefined, event.currentTarget)}>＋ Erstes Pattern bauen</button>}</div></div>
          <div className="mine-block"><div className="mine-block-head"><h3>Übungsverlauf</h3><span>{practiceHistory.length}</span></div><div className="history-list">{practiceHistory.slice(0, 20).map((entry) => <div key={entry.id}><strong>{entry.patternName}</strong><span>{Math.max(1, Math.round(entry.durationSeconds / 60))} Min. · {entry.bars} Takte · {entry.bpmStart}{entry.bpmEnd !== entry.bpmStart ? ` → ${entry.bpmEnd}` : ""} BPM</span><time dateTime={entry.completedAt}>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(entry.completedAt))}</time></div>)}</div></div>
          <div className="local-data-note"><div><strong>Privat und lokal</strong><span>Keine Aufnahme, kein Konto, keine Telemetrie.</span></div><button className="danger" onClick={() => { if (window.confirm("Alle Favoriten, Presets und Übungsverläufe auf diesem Gerät löschen?")) void clearAllLocalData(); }}>Lokale Daten löschen</button></div>
        </section>

        <footer className="footer"><span>KLANGMASS · Synthetische Drumkits</span><span>Installierbar · Offline · Keine Samples · Keine Aufnahme</span></footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile Hauptnavigation"><button className={section === "trainer" ? "active" : ""} onClick={() => navigateTo("trainer")}><span>●</span>Üben</button><button className={section === "library" ? "active" : ""} onClick={() => navigateTo("library")}><span>⌕</span>Bibliothek</button><button className="mobile-play" onClick={togglePlayback} aria-label={isPlaying ? "Wiedergabe stoppen" : "Abspielen"}>{isPlaying ? "Ⅱ" : "▶"}</button><button className={section === "mine" ? "active" : ""} onClick={() => navigateTo("mine")}><span>♥</span>Meine</button></nav>
      </div>

      {editorOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
        <section className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <div className="modal-head"><div><h2 id="editor-title">Drum-Pattern-Editor</h2><p>Entwurf bearbeiten, mit Pfeiltasten navigieren und erst beim Speichern übernehmen.</p></div><button className="close-button" onClick={closeEditor} aria-label="Editor schließen">×</button></div>
          <div className="editor-toolbar"><label>Takte<select value={Math.max(1, Math.round(editorSteps.length / stepsPerBar(meter, subdivision)))} onChange={(event) => resizeEditorBars(Number(event.target.value))}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button onClick={undoEditor} disabled={!editorHistory.length}>↶ Rückgängig</button><span>{meterLabel} · {subdivision} · {editorSteps.length} Schritte</span></div>
          <div className="drum-editor-scroll">
            <div className="drum-editor-grid">
              {DRUM_VOICES.map((voice) => {
                const track = editorTracks[voice] || Array<DrumHitState>(editorSteps.length).fill("mute");
                return <div className="drum-lane editor-lane" key={voice} style={{ gridTemplateColumns: `94px repeat(${editorSteps.length}, 44px)` }}>
                  <span className="drum-lane-label"><span>{DRUM_LABELS[voice]}</span><button onClick={() => clearEditorLane(voice)} aria-label={`${DRUM_LABELS[voice]} leeren`}>×</button></span>
                  {track.map((state, index) => <button key={index} tabIndex={index === 0 ? 0 : -1} className={`editor-step ${state} ${index % stepsPerBar(meter, subdivision) === 0 ? "bar-start" : ""}`} onClick={() => updateEditorHit(voice, index)} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); const cells = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(".editor-step") || []); cells[Math.max(0, Math.min(cells.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))]?.focus(); }} aria-label={`${DRUM_LABELS[voice]}, Schritt ${index + 1}: ${HIT_LABELS[state]}`} aria-pressed={state !== "mute"}>{index + 1}</button>)}
                </div>;
              })}
            </div>
          </div>
          <div className="editor-legend"><span><i className="legend-dot accent" />Akzent</span><span><i className="legend-dot" />Schlag</span><span><i className="legend-dot ghost" />Ghostnote</span><span><i className="legend-dot mute" />Stille</span></div>
          <div className="editor-fields"><input className="text-field" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Name des Patterns" aria-label="Preset-Name" /><select className="field-select" value={presetCategory} onChange={(event) => setPresetCategory(event.target.value)} aria-label="Preset-Kategorie"><option>Eigene Presets</option><option>Groove</option><option>Rudiment</option><option>Timing</option><option>Song</option></select></div>
          <div className="modal-actions"><button className="secondary" onClick={closeEditor}>Verwerfen</button><button className="secondary" onClick={() => { setEditorHistory((current) => [...current.slice(-19), cloneDrumTracks(editorTracks)]); const nextTracks = defaultDrumTracks(meter, subdivision); setEditorTracks(nextTracks); setEditorSteps(mergeDrumTracks(nextTracks, stepsPerBar(meter, subdivision))); }}>Grundmuster</button><button className="primary" onClick={() => void savePreset()}>{editingPresetId ? "Änderungen speichern" : "Als Preset speichern"}</button></div>
        </section>
      </div>}
      {toast && <div className="toast" role="status">{toast}</div>}
      {storageError && <div className="storage-alert" role="alert"><span>{storageError}</span><button onClick={() => setStorageError("")}>×</button></div>}
    </main>
  );
}
