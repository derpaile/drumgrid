import { DRUM_VOICES, FACTOR, type DrumTracks, type DrumVoice, type DrumHitState, type Meter, type Pattern, type Subdivision } from "./metronome-core";

export type BarLoop = { start: number; end: number };
export function loopBounds(loop: BarLoop | null, barSteps: number, length: number) {
  const bars = Math.max(1, Math.ceil(length / barSteps));
  const startBar = Math.max(1, Math.min(bars, Math.floor(loop?.start || 1)));
  const endBar = Math.max(startBar, Math.min(bars, Math.floor(loop?.end || bars)));
  return { start: (startBar - 1) * barSteps, end: Math.min(length, endBar * barSteps) };
}
export function nextLoopStep(step: number, bounds: { start: number; end: number }) {
  return step + 1 >= bounds.end || step < bounds.start ? bounds.start : step + 1;
}
export function countStep(index: number, meter: Meter, subdivision: Subdivision) {
  const factor = FACTOR[subdivision];
  const unit = factor * 4 / meter.denominator;
  const stride = Number.isInteger(unit) && unit >= 1 ? unit : factor;
  const beat = Math.floor(index / stride) + 1;
  const part = index % stride;
  const syllables = stride === 6 ? ["", "ta", "la", "&", "ta", "la"]
    : stride === 4 ? ["", "e", "&", "a"] : stride === 3 ? ["", "tri", "ole"] : ["", "&"];
  return { label: part === 0 ? String(beat) : syllables[part] || "·", beatStart: part === 0 };
}
export function setTrackHit(tracks: DrumTracks, length: number, voice: DrumVoice, index: number, state: DrumHitState): DrumTracks {
  const next = { ...tracks, [voice]: [...(tracks[voice] || Array<DrumHitState>(length).fill("mute"))] };
  next[voice]![index] = state;
  if (state !== "mute" && (voice === "closedHat" || voice === "openHat")) {
    const other = voice === "closedHat" ? "openHat" : "closedHat";
    next[other] = [...(tracks[other] || Array<DrumHitState>(length).fill("mute"))];
    next[other]![index] = "mute";
  }
  return next;
}
export function copyBar(tracks: DrumTracks, barSteps: number, from: number, to: number): DrumTracks {
  return Object.fromEntries(DRUM_VOICES.flatMap(voice => {
    const lane = tracks[voice];
    if (!lane) return [];
    const next = [...lane];
    next.splice((to - 1) * barSteps, barSteps, ...lane.slice((from - 1) * barSteps, from * barSteps));
    return [[voice, next]];
  }));
}
export function shiftLane(tracks: DrumTracks, voice: DrumVoice, shift: number): DrumTracks {
  const lane = tracks[voice];
  if (!lane?.length) return tracks;
  const next = { ...tracks, [voice]: lane.map((_, index) => lane[((index - shift) % lane.length + lane.length) % lane.length]!) };
  if (voice === "closedHat" || voice === "openHat") {
    const other = voice === "closedHat" ? "openHat" : "closedHat";
    if (next[other]) next[other] = next[other]!.map((hit, i) => next[voice]![i] !== "mute" ? "mute" : hit);
  }
  return next;
}
export type PatternGroup = { id: string; name: string; variants: Pattern[] };
export function groupPatterns(patterns: Pattern[]): PatternGroup[] {
  const groups = new Map<string, PatternGroup>();
  for (const pattern of patterns) {
    const name = /^Radiohead — /.test(pattern.name) ? pattern.name.replace(/ · Groove [A-Z].*$/, "") : pattern.name;
    const key = /^Radiohead — /.test(pattern.name) ? name : pattern.id;
    const existing = groups.get(key);
    if (existing) existing.variants.push(pattern);
    else groups.set(key, { id: key, name, variants: [pattern] });
  }
  return [...groups.values()];
}
export function variantDifference(base: Pattern, variant: Pattern) {
  if (base.meter !== variant.meter || base.subdivision !== variant.subdivision || base.pattern.length !== variant.pattern.length) return "Andere Taktform oder Unterteilung";
  const changed = DRUM_VOICES.filter(voice => Array.from({ length: base.pattern.length }, (_, i) => i).some(i => (base.drumTracks?.[voice]?.[i] || "mute") !== (variant.drumTracks?.[voice]?.[i] || "mute")));
  return changed;
}
