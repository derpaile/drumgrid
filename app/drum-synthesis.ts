import type { DrumHitState, DrumKit, DrumVoice } from "./metronome-core";

type RecordedDrumKit = "Vintage" | "Elektronisch" | "Holzwerk" | "Quartz Click" | "707" | "808" | "909" | "PSS-795";
type PlayableDrumKit = RecordedDrumKit;
type SampleManifest = Record<DrumVoice, readonly string[]>;

export const DRUM_KIT_OPTIONS: ReadonlyArray<{ value: PlayableDrumKit; label: string; description: string }> = [
  { value: "707", label: "707", description: "Klassisches digitales Roland-Drum-Machine-Kit" },
  { value: "Vintage", label: "Lo-Fi", description: "Warme Kicks, Snares und Hats aus dem bereitgestellten Lo-Fi-Kit" },
  { value: "Elektronisch", label: "80s", description: "Komplettes elektronisches Kit aus den bereitgestellten 80s-Samples" },
  { value: "Holzwerk", label: "Holzwerk", description: "Trockenes akustisches Click-Kit aus Holzblock-, Clave- und Metalltransienten" },
  { value: "Quartz Click", label: "Quartz Click", description: "Modernes Präzisions-Click-Kit mit kurzen Ticks, Rims und Blips" },
  { value: "808", label: "808", description: "Tiefe analoge Kick und prägnante elektronische Percussion" },
  { value: "909", label: "909", description: "Druckvolles Dance- und Techno-Drum-Machine-Kit" },
  { value: "PSS-795", label: "PSS-795", description: "Lo-Fi-PCM-Drums aus dem Yamaha PSS-795" },
];

const AUDIO_ROOT = "/audio/drums";
const sample = (kit: string, name: string) => `${AUDIO_ROOT}/${kit}/${name}.mp3`;
const shared80s = (name: string) => [sample("80s", name)];
const completeKit = (kit: string): SampleManifest => ({
  kick: [sample(kit, "kick")],
  snare: [sample(kit, "snare")],
  closedHat: [sample(kit, "closed-hat")],
  openHat: [sample(kit, "open-hat")],
  ride: [sample(kit, "ride")],
  crash: [sample(kit, "crash")],
  rim: [sample(kit, "rim")],
  highTom: [sample(kit, "high-tom")],
  lowTom: [sample(kit, "low-tom")],
});

const SAMPLE_MANIFESTS: Record<RecordedDrumKit, SampleManifest> = {
  Vintage: {
    kick: [sample("lofi", "kick-a"), sample("lofi", "kick-b")],
    snare: [sample("lofi", "snare-a"), sample("lofi", "snare-b")],
    closedHat: [sample("lofi", "closed-hat-a"), sample("lofi", "closed-hat-b")],
    openHat: [sample("lofi", "open-hat")],
    ride: shared80s("ride"),
    crash: shared80s("crash"),
    rim: shared80s("rim"),
    highTom: shared80s("high-tom"),
    lowTom: shared80s("low-tom"),
  },
  Elektronisch: {
    kick: shared80s("kick"),
    snare: shared80s("snare"),
    closedHat: shared80s("closed-hat"),
    openHat: shared80s("open-hat"),
    ride: shared80s("ride"),
    crash: shared80s("crash"),
    rim: shared80s("rim"),
    highTom: shared80s("high-tom"),
    lowTom: shared80s("low-tom"),
  },
  Holzwerk: completeKit("holzwerk"),
  "Quartz Click": completeKit("quartz-click"),
  "707": completeKit("707"),
  "808": completeKit("808"),
  "909": completeKit("909"),
  "PSS-795": completeKit("pss795"),
};

export function drumKitOfflinePaths(kit: DrumKit): string[] {
  const normalized = normalizeDrumKit(kit);
  return [...new Set(Object.values(SAMPLE_MANIFESTS[normalized]).flat())];
}

const PLAYABLE_KITS = new Set<PlayableDrumKit>(DRUM_KIT_OPTIONS.map((option) => option.value));
const FIXED_PITCH_KITS = new Set<PlayableDrumKit>(["Elektronisch", "Holzwerk", "Quartz Click", "707", "808", "909", "PSS-795"]);

const VOICE_LEVELS: Record<DrumVoice, number> = {
  kick: .94,
  snare: .8,
  closedHat: .45,
  openHat: .48,
  ride: .5,
  crash: .58,
  rim: .54,
  highTom: .75,
  lowTom: .78,
};

const VOICE_INDEX: Record<DrumVoice, number> = {
  kick: 0,
  snare: 1,
  closedHat: 2,
  openHat: 3,
  ride: 4,
  crash: 5,
  rim: 6,
  highTom: 7,
  lowTom: 8,
};

const inFlightSamples = new Map<string, Promise<AudioBuffer>>();
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export type DrumSampleCache = Map<string, AudioBuffer>;

export function normalizeDrumKit(kit: DrumKit | null | undefined): PlayableDrumKit {
  if (kit === "Besen") return "Vintage";
  return kit && PLAYABLE_KITS.has(kit as PlayableDrumKit) ? kit as PlayableDrumKit : "707";
}

export function drumKitLabel(kit: DrumKit) {
  const normalized = normalizeDrumKit(kit);
  return DRUM_KIT_OPTIONS.find((option) => option.value === normalized)?.label || "707";
}

async function loadSample(context: AudioContext, cache: DrumSampleCache, url: string) {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = inFlightSamples.get(url);
  if (pending) return pending;
  const request = fetch(url, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Sample konnte nicht geladen werden: ${url}`);
      return response.arrayBuffer();
    })
    .then((audioData) => context.decodeAudioData(audioData))
    .then((buffer) => {
      cache.set(url, buffer);
      return buffer;
    })
    .finally(() => inFlightSamples.delete(url));
  inFlightSamples.set(url, request);
  return request;
}

export async function primeDrumKit(
  context: AudioContext,
  cache: DrumSampleCache,
  kit: DrumKit,
  voices: readonly DrumVoice[],
) {
  const normalized = normalizeDrumKit(kit);
  const manifest = SAMPLE_MANIFESTS[normalized];
  const urls = [...new Set(voices.flatMap((voice) => manifest[voice]))];
  await Promise.all(urls.map((url) => loadSample(context, cache, url)));
}

export function drumSampleFor(cache: DrumSampleCache, kit: DrumKit, voice: DrumVoice, variant: number) {
  const normalized = normalizeDrumKit(kit);
  const paths = SAMPLE_MANIFESTS[normalized][voice];
  return cache.get(paths[Math.abs(variant) % paths.length]) || null;
}

export function drumHitLevel(voice: DrumVoice, state: DrumHitState, velocityMultiplier: number, volume: number) {
  const dynamic = state === "ghost" ? .25 : state === "normal" ? .68 : 1;
  return clamp(VOICE_LEVELS[voice] * dynamic * velocityMultiplier * volume / 100, .0001, 1.12);
}

export function drumPlaybackRate(kit: DrumKit, voice: DrumVoice, state: DrumHitState, hitCounter: number) {
  if (FIXED_PITCH_KITS.has(normalizeDrumKit(kit))) return 1;
  const cycle = ((hitCounter * 5 + VOICE_INDEX[voice] * 3) % 9) - 4;
  const dynamicDetune = state === "ghost" ? .004 : state === "accent" ? -.002 : 0;
  return 1 + cycle * .0008 + dynamicDetune;
}
