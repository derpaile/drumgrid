import {
  DRUM_VOICES,
  learningGoalsFor,
  type DrumKit,
  type DrumVoice,
  type Pattern,
  type PracticeEntry,
  type Subdivision,
  type TrainerMode,
} from "./metronome-core";

export const APP_VERSION = "3.0.0";
export const DATA_SCHEMA_VERSION = 3;
export const LIBRARY_SCHEMA_VERSION = 2;

export type TrainerConfig = {
  mode: TrainerMode;
  step: number;
  every: number;
  min: number;
  max: number;
};

export type GapSchedule = { audibleBars: number; silentBars: number };

export type PracticeModeConfig =
  | { type: "normal" }
  | { type: "gap"; audibleBars: number; silentBars: number }
  | { type: "random-gap"; probability: number; maxSilentBars: number }
  | { type: "voice-dropout"; voices: DrumVoice[]; schedule: GapSchedule }
  | { type: "call-response"; playBars: number; responseBars: number };

export type Scene = {
  id: string;
  name: string;
  patternId?: string;
  customPattern?: Pattern;
  bpm: number;
  kit: DrumKit;
  voiceVolumes: Record<DrumVoice, number>;
  swing: number;
  feelAmount: number;
  trainer?: TrainerConfig;
  practiceMode?: PracticeModeConfig;
  sourceSceneId?: string;
  createdAt?: string;
};

export type LastSessionSnapshot = {
  scene: Scene;
  currentStage?: string;
  activeSeconds: number;
  barsCompleted: number;
  savedAt: string;
};

export type TimingObservation = {
  voice: DrumVoice;
  medianMs: number;
  meanAbsoluteMs: number;
  spreadMs: number;
  hitRate: number;
};

export type TimingResult = {
  input: "midi";
  latencyMs: number;
  observations: TimingObservation[];
};

export type PracticeResult = {
  id: string;
  sceneId: string;
  sceneName: string;
  patternId?: string;
  activeSeconds: number;
  barsCompleted: number;
  bpmStart: number;
  bpmEnd: number;
  completed: boolean;
  completionReason: "manual" | "timer" | "bars" | "background" | "error";
  selfRating?: "unsicher" | "stabil" | "leicht";
  timingResult?: TimingResult;
  practiceMode?: PracticeModeConfig;
  currentStage?: string;
  completedAt: string;
};

export type SkillGroup = "Timing" | "Pocket" | "Koordination" | "Dynamik" | "Technik" | "Form" | "Metrik" | "Stil";
export type SkillDefinition = { id: string; label: string; group: SkillGroup; aliases: string[] };

export const SKILLS: SkillDefinition[] = [
  { id: "timing-pulse", label: "Puls", group: "Timing", aliases: ["timing", "puls", "grundlagen", "internal time"] },
  { id: "timing-subdivision", label: "Unterteilung", group: "Timing", aliases: ["unterteilung", "achtel", "sechzehntel", "double time"] },
  { id: "timing-gap", label: "Gap Click", group: "Timing", aliases: ["gap click", "gap-click"] },
  { id: "timing-micro", label: "Mikro-Timing", group: "Timing", aliases: ["mikrotiming", "mikro-timing", "microtiming"] },
  { id: "pocket-straight", label: "Straight", group: "Pocket", aliases: ["straight", "gerade", "pocket"] },
  { id: "pocket-laidback", label: "Laid back", group: "Pocket", aliases: ["laid back", "laid-back", "behind the beat"] },
  { id: "pocket-shuffle", label: "Shuffle", group: "Pocket", aliases: ["shuffle", "half time shuffle", "half-time shuffle"] },
  { id: "pocket-swing", label: "Swing", group: "Pocket", aliases: ["swing", "jazz phrasing"] },
  { id: "coordination-limbs", label: "Hand/Fuß", group: "Koordination", aliases: ["hand/foot", "hand-fuß", "fußtechnik", "coordination", "koordination"] },
  { id: "coordination-independence", label: "Unabhängigkeit", group: "Koordination", aliases: ["unabhängigkeit", "independence", "ostinato"] },
  { id: "coordination-linear", label: "Linearität", group: "Koordination", aliases: ["linear", "linearität"] },
  { id: "dynamics-accents", label: "Akzente", group: "Dynamik", aliases: ["akzente", "accent", "akzent"] },
  { id: "dynamics-ghosts", label: "Ghostnotes", group: "Dynamik", aliases: ["ghostnotes", "ghost notes", "ghostnote"] },
  { id: "dynamics-balance", label: "Balance", group: "Dynamik", aliases: ["balance", "dynamik", "velocity"] },
  { id: "technique-doubles", label: "Doubles", group: "Technik", aliases: ["doubles", "double stroke", "doppelschläge"] },
  { id: "technique-paradiddle", label: "Paradiddle", group: "Technik", aliases: ["paradiddle"] },
  { id: "technique-speed", label: "Geschwindigkeit", group: "Technik", aliases: ["geschwindigkeit", "speed", "schnelligkeit"] },
  { id: "technique-endurance", label: "Ausdauer", group: "Technik", aliases: ["ausdauer", "endurance"] },
  { id: "form-multibar", label: "Mehrtaktform", group: "Form", aliases: ["form", "zweitakt", "viertakt", "achttakt", "turnaround"] },
  { id: "meter-odd", label: "Ungerade Takte", group: "Metrik", aliases: ["ungerade takte", "odd meter", "5/4", "7/8", "additiv"] },
  { id: "style-funk", label: "Funk", group: "Stil", aliases: ["funk", "funk & soul"] },
  { id: "style-jazz", label: "Jazz", group: "Stil", aliases: ["jazz"] },
  { id: "style-metal", label: "Metal", group: "Stil", aliases: ["metal", "punk & metal", "progressive & heavy"] },
  { id: "style-hiphop", label: "Hip-Hop", group: "Stil", aliases: ["hip-hop", "hip hop", "old school hip-hop", "trip-hop"] },
  { id: "style-latin", label: "Latin", group: "Stil", aliases: ["latin", "afro", "world"] },
  { id: "style-electronic", label: "Electronic", group: "Stil", aliases: ["electronic", "dance", "jungle", "drum and bass"] },
];

const normalize = (value: string) => value.toLocaleLowerCase("de").replace(/[–—_/]/g, " ").replace(/\s+/g, " ").trim();

export function skillIdsFor(pattern: Pattern): string[] {
  const terms = [pattern.category, pattern.meter, pattern.instruction, ...learningGoalsFor(pattern)].map(normalize);
  const ids = SKILLS.filter((skill) => skill.aliases.some((alias) => terms.some((term) => term.includes(normalize(alias))))).map((skill) => skill.id);
  if ((pattern.bars || 1) > 1) ids.push("form-multibar");
  if (!["2/4", "3/4", "4/4", "6/8", "9/8", "12/8"].includes(pattern.meter)) ids.push("meter-odd");
  if (pattern.originalFeel) ids.push("timing-micro");
  return [...new Set(ids.length ? ids : ["timing-pulse"])].slice(0, 5);
}

export function skillLabelsFor(pattern: Pattern, limit = 2): string[] {
  const ids = skillIdsFor(pattern);
  return ids.flatMap((id) => SKILLS.find((skill) => skill.id === id)?.label || []).slice(0, limit);
}

export function createScene(
  pattern: Pattern,
  settings?: Partial<Omit<Scene, "id" | "name" | "patternId" | "customPattern">> & { id?: string; name?: string },
): Scene {
  const playback = pattern.playback || {};
  const voiceVolumes = Object.fromEntries(DRUM_VOICES.map((voice) => [voice, settings?.voiceVolumes?.[voice] ?? 100])) as Record<DrumVoice, number>;
  return {
    id: settings?.id || `scene-${Date.now()}`,
    name: settings?.name || pattern.name,
    ...(pattern.id.startsWith("custom-") ? { customPattern: pattern } : { patternId: pattern.id }),
    bpm: settings?.bpm ?? playback.bpm ?? Math.round((pattern.bpmMin + pattern.bpmMax) / 2),
    kit: settings?.kit ?? playback.kit ?? "Studio",
    voiceVolumes,
    swing: settings?.swing ?? playback.swing ?? 50,
    feelAmount: settings?.feelAmount ?? 0,
    trainer: settings?.trainer ?? playback.trainer,
    practiceMode: settings?.practiceMode ?? { type: "normal" },
    sourceSceneId: settings?.sourceSceneId,
    createdAt: settings?.createdAt || new Date().toISOString(),
  };
}

export function migrateLegacyPresets(patterns: Pattern[]): Scene[] {
  return patterns.filter((pattern) => pattern?.id && pattern?.drumTracks).map((pattern) => createScene(pattern, {
    id: `scene-${pattern.id.replace(/^custom-/, "")}`,
    name: pattern.name,
  }));
}

export function migrateLegacyPractice(entries: PracticeEntry[]): PracticeResult[] {
  return entries.filter((entry) => entry?.id).map((entry) => ({
    id: entry.id,
    sceneId: `legacy-${entry.patternId}`,
    sceneName: entry.patternName,
    patternId: entry.patternId,
    activeSeconds: entry.durationSeconds,
    barsCompleted: entry.bars,
    bpmStart: entry.bpmStart,
    bpmEnd: entry.bpmEnd,
    completed: true,
    completionReason: "manual",
    practiceMode: { type: "normal" },
    completedAt: entry.completedAt,
  }));
}

export type LadderStage = { id: string; label: string; description: string };

export function ladderFor(pattern: Pattern): LadderStage[] {
  const stages: LadderStage[] = [
    { id: "skeleton", label: "1 · Skeleton", description: "Kernstimmen und Hauptakzente" },
    { id: "original", label: "2 · Originalform", description: "Vollständiges quantisiertes Pattern" },
  ];
  if (Object.values(pattern.drumTracks || {}).some((track) => track?.includes("ghost"))) stages.push({ id: "dynamics", label: "3 · Dynamik", description: "Ghostnotes und Akzente" });
  if (pattern.originalFeel) stages.push({ id: "pocket", label: "4 · Pocket", description: pattern.originalFeel.label });
  stages.push(
    { id: "internal-time", label: "5 · Internal Time", description: "Gap Click 3/1" },
    { id: "independence", label: "6 · Independence", description: "Eine Stimme selbst übernehmen" },
    { id: "tempo", label: "7 · Tempoziel", description: "Kontrollierte Tempo-Pyramide" },
  );
  return stages;
}

function deterministicBarValue(bar: number) {
  const value = Math.sin((bar + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function isVoiceAudible(mode: PracticeModeConfig, completedBars: number, voice: DrumVoice): boolean {
  if (mode.type === "normal") return true;
  if (mode.type === "gap") return completedBars % Math.max(1, mode.audibleBars + mode.silentBars) < mode.audibleBars;
  if (mode.type === "call-response") return completedBars % Math.max(1, mode.playBars + mode.responseBars) < mode.playBars;
  if (mode.type === "random-gap") return deterministicBarValue(completedBars) >= mode.probability;
  if (!mode.voices.includes(voice)) return true;
  return completedBars % Math.max(1, mode.schedule.audibleBars + mode.schedule.silentBars) < mode.schedule.audibleBars;
}

export function practiceModeLabel(mode: PracticeModeConfig): string {
  if (mode.type === "normal") return "Normal";
  if (mode.type === "gap") return `Gap ${mode.audibleBars}/${mode.silentBars}`;
  if (mode.type === "random-gap") return `Zufallslücken ${Math.round(mode.probability * 100)}%`;
  if (mode.type === "call-response") return `Call & Response ${mode.playBars}/${mode.responseBars}`;
  return `${mode.voices.join(" + ")} ausblenden`;
}

export function nextStepFor(result: PracticeResult): string {
  if (!result.selfRating) return "Bewerte kurz dein Gefühl, damit die nächste Übung passt.";
  if (result.selfRating === "unsicher") return `Gleiche Stufe bei ${Math.max(20, result.bpmEnd - 5)} BPM wiederholen.`;
  if (result.selfRating === "stabil") return `Bei ${Math.min(300, result.bpmEnd + 3)} BPM festigen oder Gap Click ergänzen.`;
  return "Zur nächsten Lernleiterstufe wechseln.";
}

export type LibraryFilters = {
  difficulty: string;
  skillId: string;
  meter: string;
  subdivision: string;
  feel: boolean;
  length: string;
  kit: string;
  tempo: number | null;
  unpracticed: boolean;
  difficult: boolean;
};

export function matchesLearningFilters(pattern: Pattern, filters: LibraryFilters, results: PracticeResult[]): boolean {
  const patternResults = results.filter((result) => result.patternId === pattern.id);
  return (filters.difficulty === "Alle" || pattern.difficulty === filters.difficulty)
    && (filters.skillId === "Alle" || skillIdsFor(pattern).includes(filters.skillId))
    && (filters.meter === "Alle" || pattern.meter === filters.meter)
    && (filters.subdivision === "Alle" || pattern.subdivision === filters.subdivision as Subdivision)
    && (!filters.feel || Boolean(pattern.originalFeel))
    && (filters.length === "Alle" || (filters.length === "1 Takt" ? (pattern.bars || 1) === 1 : (pattern.bars || 1) > 1))
    && (filters.kit === "Alle" || pattern.playback?.kit === filters.kit)
    && (filters.tempo === null || (filters.tempo >= pattern.bpmMin && filters.tempo <= pattern.bpmMax))
    && (!filters.unpracticed || patternResults.length === 0)
    && (!filters.difficult || patternResults.some((result) => result.selfRating === "unsicher"));
}

export function dailyRecommendations(patterns: Pattern[], results: PracticeResult[], favorites: string[], limit = 4) {
  const recentIds = new Set(results.slice(0, 5).flatMap((result) => result.patternId || []));
  const latestSkills = results.flatMap((result) => patterns.find((pattern) => pattern.id === result.patternId) || []).flatMap(skillIdsFor).slice(0, 4);
  return patterns.map((pattern) => {
    const prior = results.filter((result) => result.patternId === pattern.id);
    const skillMatch = skillIdsFor(pattern).some((skill) => latestSkills.includes(skill));
    let score = prior.length ? 0 : 5;
    if (favorites.includes(pattern.id)) score += 4;
    if (skillMatch) score += 3;
    if (recentIds.has(pattern.id)) score -= 5;
    if (prior.length > 0 && prior.slice(0, 2).every((result) => result.selfRating === "unsicher")) score -= 2;
    const reason = favorites.includes(pattern.id)
      ? "ein Favorit, der gut in eine kurze Session passt"
      : skillMatch ? `passend zu deinem Fokus ${skillLabelsFor(pattern, 1)[0]}`
        : prior.length ? "eine länger nicht vertiefte Übung" : "noch nicht geübt";
    return { pattern, score, reason };
  }).sort((a, b) => b.score - a.score || a.pattern.difficulty.localeCompare(b.pattern.difficulty)).slice(0, limit);
}
