"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StepState = "accent" | "normal" | "mute";
type Subdivision = "Viertel" | "Achtel" | "16tel" | "Triolen" | "Sextolen";

type Pattern = {
  id: string;
  name: string;
  category: string;
  bpmMin: number;
  bpmMax: number;
  meter: string;
  subdivision: Subdivision;
  pattern: StepState[];
  difficulty: "Leicht" | "Mittel" | "Fortgeschritten";
  instruction: string;
};

type WakeLockHandle = { release: () => Promise<void> };

const SUBDIVISIONS: Subdivision[] = ["Viertel", "Achtel", "16tel", "Triolen", "Sextolen"];
const FACTOR: Record<Subdivision, number> = { Viertel: 1, Achtel: 2, "16tel": 4, Triolen: 3, Sextolen: 6 };
const FALLBACK_PATTERNS: Pattern[] = [
  { id: "g-4-4", name: "Solider Vierer", category: "Grundlagen", bpmMin: 55, bpmMax: 120, meter: "4/4", subdivision: "Viertel", pattern: ["accent", "normal", "normal", "normal"], difficulty: "Leicht", instruction: "Halte jeden Schlag gleich lang und atme ruhig weiter." },
  { id: "g-6-8", name: "Fließender Sechser", category: "Grundlagen", bpmMin: 45, bpmMax: 110, meter: "6/8", subdivision: "Achtel", pattern: ["accent", "mute", "normal", "normal", "mute", "normal", "normal", "mute", "normal", "normal", "mute", "normal"], difficulty: "Leicht", instruction: "Spüre zwei große Gruppen mit jeweils drei Pulsen." },
  { id: "u-16", name: "Sechzehntel-Kompass", category: "Unterteilungen", bpmMin: 45, bpmMax: 100, meter: "4/4", subdivision: "16tel", pattern: ["accent", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal"], difficulty: "Mittel", instruction: "Zähle 1-e-und-e und halte alle Abstände identisch." },
  { id: "r-off", name: "Offbeat-Fokus", category: "Rhythmustraining", bpmMin: 60, bpmMax: 130, meter: "4/4", subdivision: "Achtel", pattern: ["mute", "accent", "mute", "normal", "mute", "normal", "mute", "normal"], difficulty: "Mittel", instruction: "Spiele die Grundschläge selbst, der Klick antwortet auf den Und-Zählzeiten." },
  { id: "r-gap", name: "Gap Click: 2 Takte", category: "Rhythmustraining", bpmMin: 50, bpmMax: 100, meter: "4/4", subdivision: "Viertel", pattern: ["accent", "mute", "normal", "mute"], difficulty: "Fortgeschritten", instruction: "Trage den Puls durch die Lücken, ohne schneller zu werden." },
  { id: "s-jazz", name: "Jazz Walk", category: "Swing & Shuffle", bpmMin: 80, bpmMax: 190, meter: "4/4", subdivision: "Achtel", pattern: ["normal", "normal", "accent", "normal", "normal", "normal", "accent", "normal"], difficulty: "Mittel", instruction: "Betone zwei und vier, während die Achtel locker schwingen." },
  { id: "gen-funk", name: "Funk Pocket", category: "Genres", bpmMin: 82, bpmMax: 118, meter: "4/4", subdivision: "16tel", pattern: ["accent", "mute", "normal", "mute", "normal", "mute", "accent", "mute", "normal", "mute", "normal", "mute", "accent", "mute", "normal", "mute"], difficulty: "Fortgeschritten", instruction: "Platziere kurze Noten exakt zwischen den wenigen hörbaren Klicks." },
  { id: "welt-bossa", name: "Bossa-Impuls", category: "Weltmusik", bpmMin: 90, bpmMax: 150, meter: "4/4", subdivision: "Achtel", pattern: ["accent", "mute", "normal", "normal", "mute", "normal", "normal", "mute"], difficulty: "Mittel", instruction: "Lass die Synkopen weich klingen und den Grundpuls stabil." },
  { id: "odd-5", name: "Fünfer 3+2", category: "Ungerade Takte", bpmMin: 60, bpmMax: 125, meter: "5/8", subdivision: "Viertel", pattern: ["accent", "normal", "normal", "accent", "normal"], difficulty: "Mittel", instruction: "Sprich 1-2-3, 1-2 und verbinde beide Gruppen flüssig." },
  { id: "inst-git", name: "Saubere Akkordwechsel", category: "Instrumente", bpmMin: 45, bpmMax: 95, meter: "4/4", subdivision: "Viertel", pattern: ["accent", "normal", "normal", "normal"], difficulty: "Leicht", instruction: "Wechsle auf Schlag eins; bereite die Greifhand auf vier vor." },
  { id: "tech-pick", name: "Alternate Picking Leiter", category: "Technik", bpmMin: 55, bpmMax: 160, meter: "4/4", subdivision: "16tel", pattern: ["accent", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "accent", "normal", "normal", "normal", "normal", "normal", "normal", "normal"], difficulty: "Mittel", instruction: "Beginne jeden Saitenwechsel mit der geplanten Anschlagsrichtung." },
  { id: "goal-warm", name: "Ruhiges Warm-up", category: "Trainingsziele", bpmMin: 45, bpmMax: 80, meter: "4/4", subdivision: "Achtel", pattern: ["accent", "normal", "normal", "normal", "normal", "normal", "normal", "normal"], difficulty: "Leicht", instruction: "Spiele mit minimaler Spannung und erhöhe erst bei völliger Kontrolle." },
];

const parseMeter = (meter: string) => {
  const [beats, denominator] = meter.split("/").map(Number);
  return { beats: beats || 4, denominator: denominator || 4 };
};

const defaultSteps = (beats: number, subdivision: Subdivision): StepState[] =>
  Array.from({ length: beats * FACTOR[subdivision] }, (_, index) =>
    index === 0 ? "accent" : "normal",
  );

const normalizedSteps = (steps: StepState[], length: number): StepState[] =>
  Array.from({ length }, (_, index) => steps[index % Math.max(1, steps.length)] || (index === 0 ? "accent" : "normal"));

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [meter, setMeterState] = useState({ beats: 4, denominator: 4 });
  const [subdivision, setSubdivisionState] = useState<Subdivision>("Achtel");
  const [steps, setStepsState] = useState<StepState[]>(defaultSteps(4, "Achtel"));
  const [patternName, setPatternName] = useState("Solider Vierer");
  const [currentStep, setCurrentStep] = useState(-1);
  const [volume, setVolume] = useState(72);
  const [sound, setSound] = useState("Holz");
  const [swing, setSwing] = useState(50);
  const [countIn, setCountIn] = useState(1);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [repeatBars, setRepeatBars] = useState(0);
  const [timerText, setTimerText] = useState("∞");
  const [trainer, setTrainer] = useState(false);
  const [trainerStep, setTrainerStep] = useState(5);
  const [trainerEvery, setTrainerEvery] = useState(8);
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
  const visualTimersRef = useRef<number[]>([]);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const playRef = useRef(false);
  const bpmRef = useRef(bpm);
  const meterRef = useRef(meter);
  const subdivisionRef = useRef(subdivision);
  const stepsRef = useRef(steps);
  const volumeRef = useRef(volume);
  const soundRef = useRef(sound);
  const swingRef = useRef(swing);
  const trainerRef = useRef(trainer);
  const trainerStepRef = useRef(trainerStep);
  const trainerEveryRef = useRef(trainerEvery);
  const repeatBarsRef = useRef(repeatBars);
  const nextTimeRef = useRef(0);
  const nextStepRef = useRef(0);
  const countRemainingRef = useRef(0);
  const barsRef = useRef(0);
  const endAtRef = useRef(0);
  const stopRef = useRef<() => void>(() => undefined);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { meterRef.current = meter; }, [meter]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { swingRef.current = swing; }, [swing]);
  useEffect(() => { trainerRef.current = trainer; }, [trainer]);
  useEffect(() => { trainerStepRef.current = trainerStep; }, [trainerStep]);
  useEffect(() => { trainerEveryRef.current = trainerEvery; }, [trainerEvery]);
  useEffect(() => { repeatBarsRef.current = repeatBars; }, [repeatBars]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    Promise.all([
      readStore<string[]>("favorites", []),
      readStore<Pattern[]>("presets", []),
      readStore<Pattern[]>("recent", []),
    ]).then(([savedFavorites, savedPresets, savedRecent]) => {
      setFavorites(savedFavorites);
      setPresets(savedPresets);
      setRecent(savedRecent);
    });
    fetch("/data/patterns-v1.json")
      .then((response) => response.json())
      .then((data: { patterns?: Pattern[] }) => {
        if (Array.isArray(data.patterns) && data.patterns.length) setLibrary(data.patterns);
      })
      .catch(() => undefined);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      stopRef.current();
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const stopPlayback = useCallback(() => {
    playRef.current = false;
    setIsPlaying(false);
    setCurrentStep(-1);
    setTimerText(timerMinutes ? `${timerMinutes}:00` : "∞");
    if (schedulerRef.current) window.clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    visualTimersRef.current.forEach(window.clearTimeout);
    visualTimersRef.current = [];
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, [timerMinutes]);
  stopRef.current = stopPlayback;

  const scheduleSound = useCallback((context: AudioContext, when: number, state: StepState) => {
    if (state === "mute") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const isAccent = state === "accent";
    const soundProfile = soundRef.current;
    oscillator.type = soundProfile === "Digital" ? "square" : soundProfile === "Weich" ? "sine" : "triangle";
    const baseFrequency = soundProfile === "Holz" ? 760 : soundProfile === "Digital" ? 1160 : 620;
    oscillator.frequency.setValueAtTime(isAccent ? baseFrequency * 1.42 : baseFrequency, when);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(180, baseFrequency * .55), when + .035);
    const level = (volumeRef.current / 100) * (isAccent ? .46 : .28);
    gain.gain.setValueAtTime(Math.max(.0001, level), when);
    gain.gain.exponentialRampToValueAtTime(.0001, when + (soundProfile === "Weich" ? .07 : .045));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + .08);
  }, []);

  const startPlayback = useCallback(async () => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return showToast("Audio wird von diesem Browser nicht unterstützt.");
    const context = audioRef.current || new AudioContextClass();
    audioRef.current = context;
    if (context.state === "suspended") await context.resume();
    playRef.current = true;
    setIsPlaying(true);
    barsRef.current = 0;
    nextStepRef.current = 0;
    countRemainingRef.current = countIn * meterRef.current.beats * FACTOR[subdivisionRef.current];
    nextTimeRef.current = context.currentTime + .07;
    endAtRef.current = timerMinutes ? Date.now() + timerMinutes * 60_000 : 0;
    if (timerMinutes) setTimerText(`${timerMinutes}:00`);
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<WakeLockHandle> } }).wakeLock.request("screen");
      } catch { /* Wake lock is optional. */ }
    }

    const tick = () => {
      if (!playRef.current || !audioRef.current) return;
      const activeContext = audioRef.current;
      while (nextTimeRef.current < activeContext.currentTime + .12) {
        const factor = FACTOR[subdivisionRef.current];
        const beatSeconds = (60 / bpmRef.current) * (4 / meterRef.current.denominator);
        const stepIndex = nextStepRef.current;
        const isCountIn = countRemainingRef.current > 0;
        const state: StepState = isCountIn
          ? (stepIndex % factor === 0 ? (stepIndex === 0 ? "accent" : "normal") : "mute")
          : (stepsRef.current[stepIndex] || "normal");
        scheduleSound(activeContext, nextTimeRef.current, state);
        const visualDelay = Math.max(0, (nextTimeRef.current - activeContext.currentTime) * 1000);
        const timerId = window.setTimeout(() => {
          if (playRef.current) setCurrentStep(isCountIn ? -1 : stepIndex);
        }, visualDelay);
        visualTimersRef.current.push(timerId);

        if (isCountIn) {
          countRemainingRef.current -= 1;
          nextStepRef.current = (stepIndex + 1) % (meterRef.current.beats * factor);
          if (countRemainingRef.current === 0) nextStepRef.current = 0;
        } else {
          const totalSteps = meterRef.current.beats * factor;
          nextStepRef.current = (stepIndex + 1) % totalSteps;
          if (nextStepRef.current === 0) {
            barsRef.current += 1;
            if (trainerRef.current && barsRef.current % trainerEveryRef.current === 0) {
              const nextBpm = Math.min(300, bpmRef.current + trainerStepRef.current);
              bpmRef.current = nextBpm;
              setBpm(nextBpm);
            }
            if (repeatBarsRef.current && barsRef.current >= repeatBarsRef.current) {
              window.setTimeout(() => stopRef.current(), visualDelay + 20);
            }
          }
        }

        let duration = beatSeconds / factor;
        if (factor === 2 || factor === 4) {
          const pairDuration = factor === 2 ? beatSeconds : beatSeconds / 2;
          const longShare = swingRef.current / 100;
          duration = stepIndex % 2 === 0 ? pairDuration * longShare : pairDuration * (1 - longShare);
        }
        nextTimeRef.current += duration;
      }
      if (endAtRef.current) {
        const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
        setTimerText(`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`);
        if (remaining <= 0) stopRef.current();
      }
    };
    tick();
    schedulerRef.current = window.setInterval(tick, 25);
  }, [countIn, scheduleSound, showToast, timerMinutes]);

  const togglePlayback = () => isPlaying ? stopPlayback() : void startPlayback();

  const updateBpm = (value: number) => {
    const next = Math.max(20, Math.min(300, Math.round(value)));
    bpmRef.current = next;
    setBpm(next);
  };

  const tapTempo = () => {
    const now = performance.now();
    const recentTaps = tapTimesRef.current.filter((time) => now - time < 2200);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps.slice(-6);
    if (tapTimesRef.current.length > 1) {
      const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
      updateBpm(60_000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length));
    }
  };

  const changeMeter = (beats: number, denominator = meter.denominator) => {
    const nextMeter = { beats, denominator };
    meterRef.current = nextMeter;
    setMeterState(nextMeter);
    const nextSteps = defaultSteps(beats, subdivisionRef.current);
    stepsRef.current = nextSteps;
    setStepsState(nextSteps);
    setPatternName("Eigenes Pattern");
  };

  const changeSubdivision = (nextSubdivision: Subdivision) => {
    subdivisionRef.current = nextSubdivision;
    setSubdivisionState(nextSubdivision);
    const nextSteps = defaultSteps(meterRef.current.beats, nextSubdivision);
    stepsRef.current = nextSteps;
    setStepsState(nextSteps);
    setPatternName("Eigenes Pattern");
  };

  const updateStep = (index: number) => {
    const next = stepsRef.current.map((step, stepIndex) => stepIndex === index ? cycleStep(step) : step);
    stepsRef.current = next;
    setStepsState(next);
    setPatternName("Eigenes Pattern");
  };

  const loadPattern = useCallback((pattern: Pattern, autoStart = false) => {
    const nextMeter = parseMeter(pattern.meter);
    const nextSteps = normalizedSteps(pattern.pattern, nextMeter.beats * FACTOR[pattern.subdivision]);
    meterRef.current = nextMeter;
    subdivisionRef.current = pattern.subdivision;
    stepsRef.current = nextSteps;
    setMeterState(nextMeter);
    setSubdivisionState(pattern.subdivision);
    setStepsState(nextSteps);
    setPatternName(pattern.name);
    if (bpmRef.current < pattern.bpmMin || bpmRef.current > pattern.bpmMax) updateBpm(Math.round((pattern.bpmMin + pattern.bpmMax) / 2));
    setRecent((current) => {
      const next = [pattern, ...current.filter((item) => item.id !== pattern.id)].slice(0, 8);
      void writeStore("recent", next);
      return next;
    });
    showToast(`${pattern.name} geladen`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (autoStart && !playRef.current) window.setTimeout(() => void startPlayback(), 80);
  }, [showToast, startPlayback]);

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
      pattern: [...steps],
      difficulty: "Mittel",
      instruction: "Eigenes Pattern — konzentriert und gleichmäßig wiederholen.",
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
    setVolume(72); setSound("Holz"); setSwing(50); setCountIn(1); setTimerMinutes(0); setRepeatBars(0); setTrainer(false);
    showToast("Einstellungen zurückgesetzt");
  };

  const meterLabel = `${meter.beats}/${meter.denominator}`;
  const livePresets = [...recent.slice(0, Math.max(0, 3 - presets.length)), ...presets].slice(0, 3);

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Zum Metronom">
          <span className="brand-mark" aria-hidden="true" />
          KLANGMASS
        </button>
        <nav className="nav" aria-label="Hauptnavigation">
          <button className="active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Metronom</button>
          <button onClick={() => document.querySelector("#bibliothek")?.scrollIntoView({ behavior: "smooth" })}>Bibliothek</button>
          <button onClick={() => document.querySelector("#presets")?.scrollIntoView({ behavior: "smooth" })}>Presets</button>
        </nav>
        <div className="status-pill" title={online ? "Bereit und offline verfügbar" : "Offline-Modus"}>
          <span className="status-dot" /><span>{online ? "Offline bereit" : "Offline"}</span>
        </div>
      </header>

      <div className="page">
        <div className="hero-kicker">Präzise im Takt</div>
        <section className="workspace" aria-label="Metronom">
          <div className="panel metronome-panel">
            <div className="meter-head">
              <div className="live-label"><span className={`live-pulse ${isPlaying ? "playing" : ""}`} />{isPlaying ? "Läuft" : "Bereit"}</div>
              <div className="sound-label">{sound} · {volume}%</div>
            </div>
            <div className="tempo-stage">
              <div className="tempo-caption">Schläge pro Minute</div>
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
                <div><div className="pattern-name">{patternName}</div><div className="pattern-meta">{meterLabel} · {subdivision} · {steps.length} Schritte</div></div>
                <button className="edit-link" onClick={() => setEditorOpen(true)}>Pattern bearbeiten</button>
              </div>
              <div className="beat-steps" aria-label="Aktuelles Akzentmuster">
                {steps.map((step, index) => (
                  <button key={index} className={`beat-dot ${step} ${currentStep === index ? "current" : ""}`} onClick={() => updateStep(index)} aria-label={`Schritt ${index + 1}: ${step === "accent" ? "starker Akzent" : step === "normal" ? "normaler Klick" : "stumm"}`} />
                ))}
              </div>
            </div>

            <div className="transport">
              <button className="tap-button" onClick={tapTempo}>TAP TEMPO</button>
              <button className="play-button" onClick={togglePlayback} aria-label={isPlaying ? "Pausieren" : "Abspielen"}>{isPlaying ? "Ⅱ" : "▶"}</button>
              <div className="transport-note">{timerText === "∞" ? "Ohne Zeitlimit" : `Restzeit ${timerText}`}<br />{repeatBars ? `${repeatBars} Takte` : "Endlos wiederholen"}</div>
            </div>
          </div>

          <aside className="panel controls-panel" aria-label="Metronom-Einstellungen">
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
                {SUBDIVISIONS.map((item) => <button key={item} className={subdivision === item ? "active" : ""} onClick={() => changeSubdivision(item)}>{item === "Viertel" ? "¼" : item === "Achtel" ? "⅛" : item === "16tel" ? "¹⁄₁₆" : item === "Triolen" ? "3" : "6"}</button>)}
              </div>
            </div>
            <div className="control-group">
              <div className="control-label"><span>Swing</span><span>{swing}%</span></div>
              <div className="slider-row"><span className="slider-icon">↔</span><input type="range" min="50" max="75" value={swing} onChange={(event) => setSwing(Number(event.target.value))} aria-label="Swing-Anteil" /><span>{swing}</span></div>
            </div>
            <div className="control-group">
              <div className="control-label"><span>Klickklang & Lautstärke</span><span>{volume}%</span></div>
              <div className="select-row">
                <select className="field-select" value={sound} onChange={(event) => setSound(event.target.value)} aria-label="Klickklang"><option>Holz</option><option>Digital</option><option>Weich</option></select>
                <input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Lautstärke" />
              </div>
            </div>
            <div className="control-group">
              <div className="control-label"><span>Session</span><span>{timerText}</span></div>
              <div className="select-row">
                <select className="field-select" value={countIn} onChange={(event) => setCountIn(Number(event.target.value))} aria-label="Einzähltakte"><option value="0">Ohne Count-in</option><option value="1">1 Takt Count-in</option><option value="2">2 Takte Count-in</option></select>
                <select className="field-select" value={timerMinutes} onChange={(event) => { setTimerMinutes(Number(event.target.value)); setTimerText(Number(event.target.value) ? `${event.target.value}:00` : "∞"); }} aria-label="Timer"><option value="0">Timer: aus</option><option value="5">5 Minuten</option><option value="10">10 Minuten</option><option value="20">20 Minuten</option></select>
                <select className="field-select" value={repeatBars} onChange={(event) => setRepeatBars(Number(event.target.value))} aria-label="Wiederholungen"><option value="0">Endlos</option><option value="4">4 Takte</option><option value="8">8 Takte</option><option value="16">16 Takte</option><option value="32">32 Takte</option></select>
              </div>
            </div>
            <div className="trainer-card">
              <div className="toggle-row"><div><strong>Tempo-Trainer</strong><small>Automatisch schneller werden</small></div><button className={`switch ${trainer ? "on" : ""}`} onClick={() => setTrainer(!trainer)} aria-label="Tempo-Trainer umschalten" aria-pressed={trainer} /></div>
              {trainer && <div className="trainer-settings"><select value={trainerStep} onChange={(event) => setTrainerStep(Number(event.target.value))} aria-label="Tempo-Steigerung"><option value="2">+2 BPM</option><option value="5">+5 BPM</option><option value="10">+10 BPM</option></select><select value={trainerEvery} onChange={(event) => setTrainerEvery(Number(event.target.value))} aria-label="Intervall"><option value="4">alle 4 Takte</option><option value="8">alle 8 Takte</option><option value="16">alle 16 Takte</option></select></div>}
            </div>
          </aside>
        </section>

        <section className="section" id="bibliothek">
          <div className="section-head"><div><div className="section-eyebrow">Beat-Bibliothek · {library.length} Übungen</div><h2>Finde deinen<br />nächsten Fokus.</h2></div><p className="section-copy">Keine Drumloops, sondern präzise Akzentmuster für Instrument, Technik und Timing. Jedes Pattern startet sofort und bleibt offline verfügbar.</p></div>
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
                <div className="mini-pattern">{pattern.pattern.slice(0, 16).map((step, index) => <span key={index} className={`mini-step ${step}`} />)}</div>
                <div className="card-footer"><div className="card-meta"><span>{pattern.meter}</span><span>{pattern.subdivision}</span><span>{pattern.bpmMin}–{pattern.bpmMax}</span><span>{pattern.difficulty}</span></div><button className="start-small" onClick={() => loadPattern(pattern, true)}>Starten</button></div>
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

        <footer className="footer"><span>KLANGMASS · Web Audio Timing Engine</span><span>Installierbar · Offline · Keine Aufnahme · Keine Analyse</span></footer>
      </div>

      {editorOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <div className="modal-head"><div><h2 id="editor-title">Pattern-Editor</h2><p>Tippen wechselt zwischen Akzent, Klick und Stille.</p></div><button className="close-button" onClick={() => setEditorOpen(false)} aria-label="Editor schließen">×</button></div>
          <div className="editor-grid" style={{ "--editor-cols": Math.min(8, Math.max(4, FACTOR[subdivision] * 2)) } as React.CSSProperties}>
            {steps.map((step, index) => <button key={index} className={`editor-step ${step}`} onClick={() => updateStep(index)} aria-label={`Schritt ${index + 1} ändern`}>{index + 1}</button>)}
          </div>
          <div className="editor-legend"><span><i className="legend-dot accent" />Akzent</span><span><i className="legend-dot" />Klick</span><span><i className="legend-dot mute" />Stille</span></div>
          <div className="editor-fields"><input className="text-field" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Name des Patterns" aria-label="Preset-Name" /><select className="field-select" value={presetCategory} onChange={(event) => setPresetCategory(event.target.value)} aria-label="Preset-Kategorie"><option>Eigene Presets</option><option>Warm-up</option><option>Technik</option><option>Timing</option><option>Song</option></select></div>
          <div className="modal-actions"><button className="secondary" onClick={() => setStepsState(defaultSteps(meter.beats, subdivision))}>Zurücksetzen</button><button className="primary" onClick={savePreset}>Offline speichern</button></div>
        </section>
      </div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
