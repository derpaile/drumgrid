import type { DrumHitState, DrumKit, DrumVoice } from "./metronome-core";

export const DRUM_KIT_OPTIONS: ReadonlyArray<{ value: DrumKit; label: string; description: string }> = [
  { value: "Studio", label: "Studio", description: "Ausgewogen, offen und räumlich" },
  { value: "Trocken", label: "Trocken", description: "Kurz, direkt und präzise" },
  { value: "Vintage", label: "Vintage", description: "Warm, weich und leicht gesättigt" },
  { value: "Besen", label: "Besen", description: "Leise, luftig und jazzig" },
  { value: "Elektronisch", label: "Elektronisch", description: "Hell, straff und synthetisch" },
  { value: "808", label: "808", description: "Tiefe Sub-Kick und klassische Drum-Machine" },
];

export type DrumSampleCache = Map<string, AudioBuffer>;

type KitProfile = {
  brightness: number;
  decay: number;
  room: number;
  saturation: number;
  tuning: number;
  electronic: number;
  brush: number;
};

const KIT_PROFILES: Record<DrumKit, KitProfile> = {
  Studio: { brightness: 1, decay: 1, room: .13, saturation: .05, tuning: 1, electronic: 0, brush: 0 },
  Trocken: { brightness: .88, decay: .62, room: .015, saturation: .04, tuning: 1.04, electronic: 0, brush: 0 },
  Vintage: { brightness: .66, decay: .78, room: .075, saturation: .3, tuning: .94, electronic: 0, brush: 0 },
  Besen: { brightness: .78, decay: 1.12, room: .11, saturation: .02, tuning: 1.03, electronic: 0, brush: 1 },
  Elektronisch: { brightness: 1.2, decay: .86, room: .025, saturation: .12, tuning: 1.08, electronic: 1, brush: 0 },
  "808": { brightness: .72, decay: 1.48, room: .01, saturation: .18, tuning: .79, electronic: .82, brush: 0 },
};

const BASE_DURATIONS: Record<DrumVoice, number> = {
  kick: .62,
  snare: .3,
  closedHat: .09,
  openHat: .62,
  ride: 1.05,
  crash: 1.5,
  rim: .12,
  highTom: .58,
  lowTom: .78,
};

const VOICE_LEVELS: Record<DrumVoice, number> = {
  kick: .94,
  snare: .76,
  closedHat: .39,
  openHat: .43,
  ride: .47,
  crash: .55,
  rim: .5,
  highTom: .72,
  lowTom: .76,
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

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

const seededNoise = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296 * 2 - 1;
  };
};

const sampleDuration = (voice: DrumVoice, kit: DrumKit) => {
  const profile = KIT_PROFILES[kit];
  if (voice === "kick" && kit === "808") return 1.28;
  if (voice === "snare" && profile.brush) return .48;
  const decayScale = ["closedHat", "rim"].includes(voice) ? Math.min(1.15, profile.decay) : profile.decay;
  return clamp(BASE_DURATIONS[voice] * decayScale, .055, 1.7);
};

const sampleKey = (kit: DrumKit, voice: DrumVoice, variant: number) => `${kit}:${voice}:${variant & 1}`;

function synthesizeDrumSample(context: AudioContext, kit: DrumKit, voice: DrumVoice, variant: number) {
  const profile = KIT_PROFILES[kit];
  const duration = sampleDuration(voice, kit);
  const sampleRate = context.sampleRate;
  const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  const random = seededNoise(0x51f15e + VOICE_INDEX[voice] * 7919 + (variant & 1) * 104729 + kit.length * 1543);
  const variantTune = variant & 1 ? .992 : 1.009;
  const tuning = profile.tuning * variantTune;
  let lowNoise = 0;
  let lowerNoise = 0;
  let phase = variant ? .71 : .19;
  let phase2 = variant ? 1.37 : .43;
  let phase3 = variant ? 2.11 : 1.04;
  let phase4 = variant ? 2.83 : 1.81;

  for (let index = 0; index < frameCount; index += 1) {
    const time = index / sampleRate;
    const progress = time / duration;
    const white = random();
    lowNoise += (white - lowNoise) * clamp(.055 * profile.brightness, .018, .14);
    lowerNoise += (lowNoise - lowerNoise) * .035;
    const highNoise = white - lowNoise;
    const bandNoise = lowNoise - lowerNoise;
    let value = 0;

    if (voice === "kick") {
      const startFrequency = (kit === "808" ? 118 : profile.electronic ? 168 : 142) * tuning;
      const endFrequency = (kit === "808" ? 42 : profile.electronic ? 48 : 50) * tuning;
      const pitchEnvelope = Math.exp(-time / (kit === "808" ? .105 : .052));
      const frequency = endFrequency + (startFrequency - endFrequency) * pitchEnvelope;
      phase += Math.PI * 2 * frequency / sampleRate;
      phase2 += Math.PI * 4 * frequency / sampleRate;
      const bodyDecay = kit === "808" ? .62 : .18 * profile.decay;
      const body = Math.sin(phase) * Math.exp(-time / bodyDecay);
      const harmonic = Math.sin(phase2) * Math.exp(-time / (.055 * profile.decay)) * (kit === "808" ? .05 : .16);
      const beater = (highNoise * .46 + bandNoise * .22) * Math.exp(-time / (profile.brush ? .018 : .0075)) * (1.18 * profile.brightness);
      value = body * (kit === "808" ? 1.08 : .92) + harmonic + beater;
    } else if (voice === "snare") {
      const shellFrequency = (profile.electronic ? 205 : profile.brush ? 172 : 184) * tuning;
      phase += Math.PI * 2 * shellFrequency * (1 - .06 * progress) / sampleRate;
      phase2 += Math.PI * 2 * shellFrequency * 1.83 / sampleRate;
      const shell = (Math.sin(phase) + Math.sin(phase2) * .42) * Math.exp(-time / (.075 * profile.decay));
      const wireDecay = profile.brush ? .24 : profile.electronic ? .105 : .13 * profile.decay;
      const wires = (highNoise * .83 + bandNoise * .38) * Math.exp(-time / wireDecay);
      const brushTail = profile.brush * (bandNoise * .54 + highNoise * .2) * Math.exp(-time / .33) * (1 - Math.exp(-time / .018));
      value = shell * (profile.brush ? .18 : .38) + wires * (profile.brush ? .52 : .82) + brushTail;
    } else if (voice === "closedHat" || voice === "openHat" || voice === "ride" || voice === "crash") {
      const isHat = voice === "closedHat" || voice === "openHat";
      const baseFrequency = (voice === "ride" ? 1880 : voice === "crash" ? 1420 : 2680) * tuning * profile.brightness;
      const frequencyScale = Math.min(1, 17500 / (baseFrequency * 4.21));
      phase += Math.PI * 2 * baseFrequency * frequencyScale / sampleRate;
      phase2 += Math.PI * 2 * baseFrequency * 1.47 * frequencyScale / sampleRate;
      phase3 += Math.PI * 2 * baseFrequency * 2.63 * frequencyScale / sampleRate;
      phase4 += Math.PI * 2 * baseFrequency * 4.21 * frequencyScale / sampleRate;
      const metal = Math.sin(phase) * .22 + Math.sin(phase2) * .2 + Math.sin(phase3) * .15 + Math.sin(phase4) * .1;
      const mainDecay = voice === "closedHat" ? .032 : voice === "openHat" ? .23 : voice === "ride" ? .48 : .62;
      const wash = (metal + highNoise * .68 + bandNoise * .13) * Math.exp(-time / (mainDecay * profile.decay));
      const attack = 1 - Math.exp(-time / (voice === "crash" ? .009 : .0015));
      const ping = voice === "ride" ? Math.sin(phase3) * Math.exp(-time / .16) * .48 : 0;
      const brushWash = profile.brush * highNoise * Math.exp(-time / (isHat ? .18 : .42)) * .38;
      value = wash * attack * (profile.brush && isHat ? .47 : 1) + ping + brushWash;
    } else if (voice === "rim") {
      const baseFrequency = (profile.electronic ? 1610 : profile.brush ? 1040 : 1260) * tuning;
      phase += Math.PI * 2 * baseFrequency / sampleRate;
      phase2 += Math.PI * 2 * baseFrequency * 1.71 / sampleRate;
      phase3 += Math.PI * 2 * baseFrequency * 2.38 / sampleRate;
      const ring = Math.sin(phase) * .52 + Math.sin(phase2) * .32 + Math.sin(phase3) * .16;
      value = ring * Math.exp(-time / (.018 * profile.decay)) + highNoise * Math.exp(-time / .004) * .42;
    } else {
      const isHigh = voice === "highTom";
      const startFrequency = (isHigh ? 238 : 132) * tuning;
      const endFrequency = startFrequency * (profile.electronic ? .72 : .78);
      const frequency = endFrequency + (startFrequency - endFrequency) * Math.exp(-time / .065);
      phase += Math.PI * 2 * frequency / sampleRate;
      phase2 += Math.PI * 4 * frequency / sampleRate;
      const bodyDecay = (isHigh ? .2 : .29) * profile.decay;
      const body = Math.sin(phase) * Math.exp(-time / bodyDecay);
      const skin = Math.sin(phase2) * Math.exp(-time / .055) * .2;
      const stick = (highNoise + bandNoise * .25) * Math.exp(-time / .009) * .26 * profile.brightness;
      value = body * .86 + skin + stick;
    }

    if (profile.saturation) value = Math.tanh(value * (1 + profile.saturation * 2.5)) / (1 + profile.saturation * .35);
    data[index] = value;
  }

  if (profile.room > 0) {
    const delayA = Math.max(1, Math.round(sampleRate * .011));
    const delayB = Math.max(1, Math.round(sampleRate * .023));
    for (let index = delayA; index < frameCount; index += 1) {
      const reflection = data[index - delayA] * profile.room + (index >= delayB ? data[index - delayB] * profile.room * .54 : 0);
      data[index] += reflection * Math.exp(-index / frameCount * 2.2);
    }
  }

  let peak = .0001;
  for (let index = 0; index < frameCount; index += 1) peak = Math.max(peak, Math.abs(data[index]));
  const normalizer = Math.min(1.35, .92 / peak);
  const fadeFrames = Math.min(frameCount, Math.max(32, Math.round(sampleRate * .012)));
  for (let index = 0; index < frameCount; index += 1) {
    const fade = index >= frameCount - fadeFrames ? (frameCount - index - 1) / fadeFrames : 1;
    data[index] *= normalizer * Math.max(0, fade);
  }

  return buffer;
}

export function drumSampleFor(context: AudioContext, cache: DrumSampleCache, kit: DrumKit, voice: DrumVoice, variant: number) {
  const key = sampleKey(kit, voice, variant);
  const cached = cache.get(key);
  if (cached) return cached;
  const sample = synthesizeDrumSample(context, kit, voice, variant);
  cache.set(key, sample);
  return sample;
}

export function primeDrumKit(context: AudioContext, cache: DrumSampleCache, kit: DrumKit, voices: readonly DrumVoice[]) {
  for (const voice of voices) {
    drumSampleFor(context, cache, kit, voice, 0);
    drumSampleFor(context, cache, kit, voice, 1);
  }
}

export function drumHitLevel(voice: DrumVoice, state: DrumHitState, velocityMultiplier: number, volume: number) {
  const dynamic = state === "ghost" ? .27 : state === "normal" ? .68 : 1;
  return clamp(VOICE_LEVELS[voice] * dynamic * velocityMultiplier * volume / 100, .0001, 1.12);
}

export function drumPlaybackRate(kit: DrumKit, voice: DrumVoice, state: DrumHitState, hitCounter: number) {
  if (kit === "Elektronisch" || kit === "808") return 1;
  const cycle = ((hitCounter * 5 + VOICE_INDEX[voice] * 3) % 9) - 4;
  const humanDetune = cycle * .00115;
  const dynamicDetune = state === "ghost" ? .006 : state === "accent" ? -.003 : 0;
  return 1 + humanDetune + dynamicDetune;
}
