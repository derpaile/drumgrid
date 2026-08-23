export type StepState = "accent" | "normal" | "mute";
export type DrumHitState = StepState | "ghost";
export type Subdivision = "Viertel" | "Achtel" | "16tel" | "Triolen" | "Sextolen";
export type TempoUnit = "quarter" | "eighth" | "dotted-quarter";
export type TrainerMode = "up" | "pyramid";
export type Meter = { beats: number; denominator: number };
export type DrumKit = "Studio" | "Trocken" | "Elektronisch";
export type PatternType = "Groove" | "Break" | "Technik";

export const DRUM_VOICES = ["kick", "snare", "closedHat", "openHat", "ride", "crash", "rim", "highTom", "lowTom"] as const;
export type DrumVoice = typeof DRUM_VOICES[number];
export type DrumTracks = Partial<Record<DrumVoice, DrumHitState[]>>;
export type PerHitValues = Partial<Record<DrumVoice, Record<string, number>>>;

export type OriginalFeel = {
  label: string;
  note: string;
  sourceBpm: number;
  timingMs?: PerHitValues;
  velocityMultipliers?: PerHitValues;
};

export type PlaybackDefaults = {
  bpm?: number;
  swing?: number;
  timerMinutes?: number;
  repeatBars?: number;
  kit?: DrumKit;
  trainer?: { mode: TrainerMode; step: number; every: number; min: number; max: number };
};

export type Pattern = {
  id: string;
  name: string;
  category: string;
  patternType?: PatternType;
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
  attribution?: string;
  learningGoals?: string[];
  whyInteresting?: string;
  playback?: PlaybackDefaults;
  source?: { label: string; url: string };
  originalFeel?: OriginalFeel;
};

export type PracticeEntry = {
  id: string;
  patternId: string;
  patternName: string;
  durationSeconds: number;
  bars: number;
  bpmStart: number;
  bpmEnd: number;
  completedAt: string;
};

export const SUBDIVISIONS: Subdivision[] = ["Viertel", "Achtel", "16tel", "Triolen", "Sextolen"];
export const PATTERN_CATEGORIES = [
  "Rock & Pop", "Punk & Metal", "Funk & Soul", "Hip-Hop", "Dance & Electronic",
  "Reggae", "Latin & World", "Blues & Shuffle", "Genreübergreifend",
] as const;
export const PATTERN_TYPES: PatternType[] = ["Groove", "Break", "Technik"];
export const FACTOR: Record<Subdivision, number> = { Viertel: 1, Achtel: 2, "16tel": 4, Triolen: 3, Sextolen: 6 };
export const DRUM_LABELS: Record<DrumVoice, string> = {
  kick: "Kick", snare: "Snare", closedHat: "Hi-Hat", openHat: "Open Hat", ride: "Ride",
  crash: "Crash", rim: "Rim", highTom: "High Tom", lowTom: "Floor Tom",
};
export const HIT_LABELS: Record<DrumHitState, string> = {
  accent: "Akzent", normal: "Schlag", ghost: "Ghostnote", mute: "Stille",
};

export const FALLBACK_PATTERNS: Pattern[] = [{
  id: "drum-basic-rock", name: "Rock-Backbeat", category: "Rock & Pop", patternType: "Groove", bpmMin: 45, bpmMax: 160,
  meter: "4/4", subdivision: "Achtel", bars: 1, grouping: [1, 1, 1, 1], tempoUnit: "quarter",
  pattern: ["accent", "normal", "accent", "normal", "accent", "normal", "accent", "normal"],
  drumTracks: {
    kick: ["accent", "mute", "mute", "mute", "accent", "mute", "mute", "mute"],
    snare: ["mute", "mute", "accent", "mute", "mute", "mute", "accent", "mute"],
    closedHat: ["accent", "normal", "accent", "normal", "accent", "normal", "accent", "normal"],
  },
  difficulty: "Leicht", drumOnly: true,
  instruction: "Spiele Kick auf eins und drei, Snare auf zwei und vier und führe die Hi-Hat in Achteln.",
  attribution: "Genreübung", learningGoals: ["Timing", "Grundlagen"],
  whyInteresting: "Der klare Backbeat eignet sich als Referenz für saubere Abstände und Dynamik.",
  playback: { bpm: 92, kit: "Studio" },
}];

export const parseMeter = (meter: string): Meter => {
  const [beats, denominator] = meter.split("/").map(Number);
  return { beats: beats || 4, denominator: denominator || 4 };
};

export const exactStepCount = (meter: Meter, subdivision: Subdivision) =>
  meter.beats * 4 / meter.denominator * FACTOR[subdivision];

export const hasExactGrid = (meter: Meter, subdivision: Subdivision) =>
  Number.isInteger(exactStepCount(meter, subdivision));

export const firstValidSubdivision = (meter: Meter, preferred: Subdivision): Subdivision =>
  hasExactGrid(meter, preferred) ? preferred : SUBDIVISIONS.find((item) => hasExactGrid(meter, item)) || "16tel";

export const stepsPerBar = (meter: Meter, subdivision: Subdivision) => {
  const count = exactStepCount(meter, subdivision);
  if (!Number.isInteger(count)) throw new Error(`Ungültiges Raster: ${meter.beats}/${meter.denominator} ${subdivision}`);
  return Math.max(1, count);
};

export const defaultGrouping = (meter: Meter) =>
  meter.denominator === 8 && meter.beats % 3 === 0
    ? Array(meter.beats / 3).fill(3)
    : Array(meter.beats).fill(1);

export const defaultTempoUnit = (meter: Meter, grouping = defaultGrouping(meter)): TempoUnit =>
  meter.denominator === 8 && grouping.every((size) => size === 3)
    ? "dotted-quarter"
    : meter.denominator === 8 ? "eighth" : "quarter";

export const tempoUnitLabel: Record<TempoUnit, string> = { quarter: "♩", eighth: "♪", "dotted-quarter": "♩." };

export const normalizedSteps = (steps: StepState[], length: number): StepState[] =>
  Array.from({ length }, (_, index) => steps[index % Math.max(1, steps.length)] || (index === 0 ? "accent" : "normal"));

export const normalizedDrumTracks = (tracks: DrumTracks | undefined, length: number): DrumTracks | null => {
  if (!tracks || !Object.keys(tracks).length) return null;
  return Object.fromEntries(DRUM_VOICES.flatMap((voice) => tracks[voice]
    ? [[voice, Array.from({ length }, (_, index) => tracks[voice]?.[index] || "mute")]] : [])) as DrumTracks;
};

export const cloneDrumTracks = (tracks: DrumTracks): DrumTracks => Object.fromEntries(
  DRUM_VOICES.flatMap((voice) => tracks[voice] ? [[voice, [...tracks[voice]!]]] : []),
) as DrumTracks;

export const mergeDrumTracks = (tracks: DrumTracks, length: number): StepState[] =>
  Array.from({ length }, (_, index) => {
    const states = Object.values(tracks).map((track) => track?.[index] || "mute");
    return states.includes("accent") ? "accent" : states.some((state) => state !== "mute") ? "normal" : "mute";
  });

export const defaultDrumTracks = (meter: Meter, subdivision: Subdivision): DrumTracks => {
  const length = stepsPerBar(meter, subdivision);
  const track = (): DrumHitState[] => Array(length).fill("mute");
  const kick = track(); const snare = track(); const closedHat = track();
  const unitSteps = Math.max(1, Math.round(4 / meter.denominator * FACTOR[subdivision]));
  const hatStride = subdivision === "16tel" ? 2 : 1;
  for (let index = 0; index < length; index += hatStride) closedHat[index] = index % unitSteps === 0 ? "accent" : "normal";
  kick[0] = "accent";
  if (meter.beats >= 4 && 2 * unitSteps < length) kick[2 * unitSteps] = "accent";
  if (meter.beats >= 2 && unitSteps < length) snare[unitSteps] = "accent";
  if (meter.beats >= 4 && 3 * unitSteps < length) snare[3 * unitSteps] = "accent";
  return { kick, snare, closedHat };
};

export const tempoName = (bpm: number) => bpm < 45 ? "Largo" : bpm < 66 ? "Adagio" : bpm < 76 ? "Andante"
  : bpm < 108 ? "Moderato" : bpm < 120 ? "Allegretto" : bpm < 168 ? "Allegro" : bpm < 200 ? "Presto" : "Prestissimo";

export const cycleStep = (state: StepState): StepState => state === "accent" ? "normal" : state === "normal" ? "mute" : "accent";
export const cycleDrumHit = (state: DrumHitState): DrumHitState => state === "mute" ? "normal" : state === "normal" ? "accent" : state === "accent" ? "ghost" : "mute";

export function learningGoalsFor(pattern: Pattern): string[] {
  if (pattern.learningGoals?.length) return pattern.learningGoals;
  const goals = new Set<string>();
  if (pattern.difficulty === "Leicht") goals.add("Grundlagen");
  if ((pattern.playback?.swing ?? 50) > 50 || pattern.category === "Blues & Shuffle") goals.add("Pocket");
  if (pattern.patternType === "Technik") goals.add("Technik");
  if (pattern.bpmMax >= 170) goals.add("Geschwindigkeit");
  if (pattern.drumTracks?.kick) goals.add("Fußtechnik");
  if (!goals.size) goals.add("Timing");
  return [...goals].slice(0, 3);
}
