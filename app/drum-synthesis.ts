import type { DrumHitState, DrumKit, DrumVoice } from "./metronome-core";

type RecordedDrumKit = "Studio" | "Trocken" | "Vintage" | "Elektronisch" | "Holzwerk" | "Quartz Click" | "707" | "808" | "808 Deep" | "909" | "PSS-795";
type PlayableDrumKit = RecordedDrumKit | "Präzision";
type SampleManifest = Record<DrumVoice, readonly string[]>;
type Mode = readonly [frequency: number, decay: number, level: number];

export const DRUM_KIT_OPTIONS: ReadonlyArray<{ value: PlayableDrumKit; label: string; description: string }> = [
  { value: "Studio", label: "Jungle", description: "Kräftige Breakbeat-One-Shots aus dem bereitgestellten Jungle-Pack" },
  { value: "Trocken", label: "Future Garage", description: "Kurze, reduzierte One-Shots aus dem Future-Garage-Projekt" },
  { value: "Vintage", label: "Lo-Fi", description: "Warme Kicks, Snares und Hats aus dem bereitgestellten Lo-Fi-Kit" },
  { value: "Elektronisch", label: "80s", description: "Komplettes elektronisches Kit aus den bereitgestellten 80s-Samples" },
  { value: "Holzwerk", label: "Holzwerk", description: "Trockenes akustisches Click-Kit aus Holzblock-, Clave- und Metalltransienten" },
  { value: "Quartz Click", label: "Quartz Click", description: "Modernes Präzisions-Click-Kit mit kurzen Ticks, Rims und Blips" },
  { value: "Präzision", label: "Präzision · Synth", description: "Sample-genau generierte, kurze Drumklänge ohne Aufnahmen oder Ladezeit" },
  { value: "707", label: "707", description: "Klassisches digitales Roland-Drum-Machine-Kit" },
  { value: "808", label: "808", description: "Tiefe analoge Kick und prägnante elektronische Percussion" },
  { value: "808 Deep", label: "808 Deep", description: "Lange Sub-Kick, ausklingende Snare und breite Cymbals" },
  { value: "909", label: "909", description: "Druckvolles Dance- und Techno-Drum-Machine-Kit" },
  { value: "PSS-795", label: "PSS-795", description: "Lo-Fi-PCM-Drums aus dem Yamaha PSS-795" },
];

const PROCEDURAL_KIT = "Präzision" as const;
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
  Studio: {
    kick: [sample("jungle", "kick-a"), sample("jungle", "kick-b")],
    snare: [sample("jungle", "snare-a"), sample("jungle", "snare-b")],
    closedHat: [sample("jungle", "closed-hat-a"), sample("jungle", "closed-hat-b")],
    openHat: [sample("jungle", "open-hat")],
    ride: [sample("jungle", "ride")],
    crash: [sample("jungle", "crash")],
    rim: [sample("jungle", "rim-a")],
    highTom: shared80s("high-tom"),
    lowTom: shared80s("low-tom"),
  },
  Trocken: {
    kick: [sample("garage", "kick")],
    snare: [sample("garage", "snare-a"), sample("garage", "snare-b")],
    closedHat: [sample("garage", "closed-hat-a"), sample("garage", "closed-hat-b")],
    openHat: [sample("garage", "open-hat-a"), sample("garage", "open-hat-b")],
    ride: shared80s("ride"),
    crash: shared80s("crash"),
    rim: [sample("garage", "rim-a"), sample("garage", "rim-b")],
    highTom: shared80s("high-tom"),
    lowTom: shared80s("low-tom"),
  },
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
  "808 Deep": completeKit("808-deep"),
  "909": completeKit("909"),
  "PSS-795": completeKit("pss795"),
};

export function drumKitOfflinePaths(kit: DrumKit): string[] {
  const normalized = normalizeDrumKit(kit);
  if (normalized === PROCEDURAL_KIT) return [];
  return [...new Set(Object.values(SAMPLE_MANIFESTS[normalized]).flat())];
}

const PLAYABLE_KITS = new Set<PlayableDrumKit>(DRUM_KIT_OPTIONS.map((option) => option.value));
const FIXED_PITCH_KITS = new Set<PlayableDrumKit>(["Elektronisch", "Holzwerk", "Quartz Click", PROCEDURAL_KIT, "707", "808", "808 Deep", "909", "PSS-795"]);

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

const PROCEDURAL_DURATIONS: Record<DrumVoice, number> = {
  kick: .3,
  snare: .24,
  closedHat: .07,
  openHat: .34,
  ride: .46,
  crash: .68,
  rim: .1,
  highTom: .25,
  lowTom: .34,
};

const inFlightSamples = new Map<string, Promise<AudioBuffer>>();
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const proceduralKey = (voice: DrumVoice, variant: number) => `procedural:precision:${voice}:${variant & 1}`;

export type DrumSampleCache = Map<string, AudioBuffer>;

export function normalizeDrumKit(kit: DrumKit | null | undefined): PlayableDrumKit {
  if (kit === "Besen") return "Vintage";
  return kit && PLAYABLE_KITS.has(kit as PlayableDrumKit) ? kit as PlayableDrumKit : "Studio";
}

export function drumKitLabel(kit: DrumKit) {
  const normalized = normalizeDrumKit(kit);
  return DRUM_KIT_OPTIONS.find((option) => option.value === normalized)?.label || "Jungle";
}

function createNoise(length: number, seed: number) {
  const output = new Float32Array(length);
  let state = seed | 0;
  for (let index = 0; index < length; index += 1) {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    output[index] = ((value ^ value >>> 14) >>> 0) / 0x80000000 - 1;
  }
  return output;
}

function bandLimitNoise(noise: Float32Array, sampleRate: number, lowCut: number, highCut: number) {
  if (lowCut > 0) {
    const coefficient = 1 - Math.exp(-2 * Math.PI * lowCut / sampleRate);
    let low = 0;
    for (let index = 0; index < noise.length; index += 1) {
      low += coefficient * (noise[index] - low);
      noise[index] -= low;
    }
  }
  if (highCut < sampleRate * .49) {
    const coefficient = 1 - Math.exp(-2 * Math.PI * highCut / sampleRate);
    let low = 0;
    for (let index = 0; index < noise.length; index += 1) {
      low += coefficient * (noise[index] - low);
      noise[index] = low;
    }
  }
}

function envelope(time: number, decay: number, attack: number) {
  return Math.exp(-time / decay) * (1 - Math.exp(-time / attack));
}

function addNoise(
  output: Float32Array,
  sampleRate: number,
  seed: number,
  lowCut: number,
  highCut: number,
  decay: number,
  level: number,
  attack = .00012,
) {
  const noise = createNoise(output.length, seed);
  bandLimitNoise(noise, sampleRate, lowCut, highCut);
  for (let index = 0; index < output.length; index += 1) {
    const time = index / sampleRate;
    output[index] += noise[index] * envelope(time, decay, attack) * level;
  }
}

function addModes(output: Float32Array, sampleRate: number, modes: readonly Mode[], attack = .00018, pitchRatio = 1) {
  for (let index = 0; index < output.length; index += 1) {
    const time = index / sampleRate;
    const onset = 1 - Math.exp(-time / attack);
    let value = 0;
    for (const [frequency, decay, level] of modes) {
      value += Math.sin(2 * Math.PI * frequency * pitchRatio * time) * Math.exp(-time / decay) * level;
    }
    output[index] += value * onset;
  }
}

function addPitchSweep(
  output: Float32Array,
  sampleRate: number,
  startFrequency: number,
  endFrequency: number,
  pitchDecay: number,
  amplitudeDecay: number,
  level: number,
  attack = .00025,
) {
  const frequencyDelta = startFrequency - endFrequency;
  for (let index = 0; index < output.length; index += 1) {
    const time = index / sampleRate;
    const phase = 2 * Math.PI * (endFrequency * time + frequencyDelta * pitchDecay * (1 - Math.exp(-time / pitchDecay)));
    output[index] += Math.sin(phase) * envelope(time, amplitudeDecay, attack) * level;
  }
}

function condition(output: Float32Array, sampleRate: number, targetPeak = .86) {
  const dcCoefficient = 1 - Math.exp(-2 * Math.PI * 24 / sampleRate);
  let dc = 0;
  let peak = 0;
  const drive = 1.12;
  const compensation = Math.tanh(drive);
  const fadeSamples = Math.min(output.length, Math.round(sampleRate * .006));
  for (let index = 0; index < output.length; index += 1) {
    dc += dcCoefficient * (output[index] - dc);
    let value = Math.tanh((output[index] - dc) * drive) / compensation;
    if (index >= output.length - fadeSamples) value *= (output.length - 1 - index) / fadeSamples;
    output[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  const scale = peak > 0 ? targetPeak / peak : 1;
  for (let index = 0; index < output.length; index += 1) output[index] *= scale;
}

function renderPrecisionVoice(context: AudioContext, voice: DrumVoice, variant: number) {
  const sampleRate = context.sampleRate;
  const length = Math.ceil(PROCEDURAL_DURATIONS[voice] * sampleRate);
  const buffer = context.createBuffer(1, length, sampleRate);
  const output = buffer.getChannelData(0);
  const seed = 0x51f15e + VOICE_INDEX[voice] * 0x9e37 + (variant & 1) * 0x45d9;
  const pitchRatio = variant & 1 ? 1.0012 : .9994;

  switch (voice) {
    case "kick":
      addPitchSweep(output, sampleRate, 154, 53, .023, .105, 1);
      addModes(output, sampleRate, [[53, .18, .2], [106, .052, .055]], .00035, pitchRatio);
      addNoise(output, sampleRate, seed, 1_100, 5_600, .006, .18, .00005);
      break;
    case "snare":
      addModes(output, sampleRate, [[181, .09, .27], [326, .063, .17], [512, .038, .07]], .00015, pitchRatio);
      addNoise(output, sampleRate, seed, 650, 9_200, .095, .78);
      addNoise(output, sampleRate, seed ^ 0x61c8, 210, 2_500, .025, .2, .00006);
      break;
    case "closedHat":
      addModes(output, sampleRate, [[4_030, .024, .17], [5_210, .021, .14], [6_170, .019, .12], [7_430, .016, .1], [8_910, .013, .08], [10_370, .011, .06]], .00006, pitchRatio);
      addNoise(output, sampleRate, seed, 5_800, 13_400, .021, .36, .00004);
      break;
    case "openHat":
      addModes(output, sampleRate, [[3_970, .13, .15], [5_170, .17, .13], [6_240, .12, .11], [7_510, .2, .09], [8_840, .14, .075], [10_260, .1, .055]], .00008, pitchRatio);
      addNoise(output, sampleRate, seed, 5_200, 13_200, .14, .34, .00005);
      break;
    case "ride":
      addModes(output, sampleRate, [[1_970, .027, .12], [3_130, .019, .075], [4_670, .013, .04]], .00004, pitchRatio);
      addModes(output, sampleRate, [[1_360, .13, .022], [2_440, .19, .026], [3_570, .25, .024], [4_920, .3, .021], [6_380, .27, .018], [7_940, .23, .015], [9_610, .16, .011]], .00035, pitchRatio);
      addNoise(output, sampleRate, seed, 1_500, 6_300, .014, .32, .000035);
      addNoise(output, sampleRate, seed ^ 0x3ad1, 3_700, 11_800, .19, .34, .0007);
      break;
    case "crash":
      addModes(output, sampleRate, [[1_080, .2, .045], [1_760, .38, .08], [2_690, .51, .1], [3_820, .43, .095], [5_060, .58, .085], [6_670, .37, .07], [8_290, .31, .055], [10_100, .23, .04]], .00008, pitchRatio);
      addNoise(output, sampleRate, seed, 1_900, 12_600, .31, .3, .00004);
      break;
    case "rim":
      addModes(output, sampleRate, [[890, .026, .3], [1_740, .018, .26], [3_260, .013, .18], [5_120, .009, .07]], .00004, pitchRatio);
      addNoise(output, sampleRate, seed, 1_200, 7_500, .007, .13, .00003);
      break;
    case "highTom":
      addPitchSweep(output, sampleRate, 235, 153, .032, .105, .9);
      addModes(output, sampleRate, [[306, .075, .1], [465, .046, .045]], .00022, pitchRatio);
      addNoise(output, sampleRate, seed, 600, 4_200, .018, .095, .00006);
      break;
    case "lowTom":
      addPitchSweep(output, sampleRate, 168, 96, .039, .145, .95);
      addModes(output, sampleRate, [[193, .11, .1], [292, .062, .04]], .00025, pitchRatio);
      addNoise(output, sampleRate, seed, 450, 3_500, .021, .085, .00006);
      break;
  }

  condition(output, sampleRate, voice === "ride" ? .3 : .86);
  return buffer;
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
  if (normalized === PROCEDURAL_KIT) {
    for (const voice of voices) {
      for (let variant = 0; variant < 2; variant += 1) {
        const key = proceduralKey(voice, variant);
        if (cache.get(key)?.sampleRate !== context.sampleRate) cache.set(key, renderPrecisionVoice(context, voice, variant));
      }
    }
    return;
  }
  const manifest = SAMPLE_MANIFESTS[normalized];
  const urls = [...new Set(voices.flatMap((voice) => manifest[voice]))];
  await Promise.all(urls.map((url) => loadSample(context, cache, url)));
}

export function drumSampleFor(cache: DrumSampleCache, kit: DrumKit, voice: DrumVoice, variant: number) {
  const normalized = normalizeDrumKit(kit);
  if (normalized === PROCEDURAL_KIT) return cache.get(proceduralKey(voice, variant)) || null;
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
