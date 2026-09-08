import type { Meter, Subdivision } from "./metronome-core";
import { countStep } from "./practice-tools";

export type CountingVoiceLanguage = "off" | "en" | "de";
export type CountingVoiceCache = Map<string, AudioBuffer>;

const NUMBER_TOKENS = {
  en: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"],
  de: ["eins", "zwei", "drei", "vier", "fuenf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwoelf", "dreizehn", "vierzehn", "fuenfzehn", "sechzehn"],
} as const;

const SUBDIVISION_TOKENS = {
  en: { "&": "and", e: "e", a: "a", tri: "and", ole: "a", ta: "trip", la: "let" },
  de: { "&": "und", e: "e", a: "a", tri: "und", ole: "a", ta: "ta", la: "la" },
} as const;

const TOKENS = {
  en: [...NUMBER_TOKENS.en, "and", "e", "a", "trip", "let"],
  de: [...NUMBER_TOKENS.de, "und", "e", "a", "ta", "la"],
} as const;

const inFlightSamples = new Map<string, Promise<AudioBuffer>>();
const pathFor = (language: Exclude<CountingVoiceLanguage, "off">, token: string) => `/audio/counting/${language}/${token}.mp3`;

export function normalizeCountingVoice(value: unknown): CountingVoiceLanguage {
  return value === "en" || value === "de" ? value : "off";
}

export function countingVoiceOfflinePaths(language: CountingVoiceLanguage): string[] {
  return language === "off" ? [] : TOKENS[language].map((token) => pathFor(language, token));
}

export function spokenCountToken(
  index: number,
  meter: Meter,
  subdivision: Subdivision,
  language: Exclude<CountingVoiceLanguage, "off">,
): string {
  const label = countStep(index, meter, subdivision).label;
  const beat = Number(label);
  if (Number.isInteger(beat) && beat >= 1) return NUMBER_TOKENS[language][(beat - 1) % NUMBER_TOKENS[language].length]!;
  return SUBDIVISION_TOKENS[language][label as keyof typeof SUBDIVISION_TOKENS[typeof language]] || (language === "de" ? "und" : "and");
}

async function loadSample(context: AudioContext, cache: CountingVoiceCache, url: string) {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = inFlightSamples.get(url);
  if (pending) return pending;
  const request = fetch(url, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Zählstimmen-Sample konnte nicht geladen werden: ${url}`);
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

export async function primeCountingVoice(
  context: AudioContext,
  cache: CountingVoiceCache,
  language: CountingVoiceLanguage,
) {
  await Promise.all(countingVoiceOfflinePaths(language).map((url) => loadSample(context, cache, url)));
}

export function countingVoiceSampleFor(
  cache: CountingVoiceCache,
  language: Exclude<CountingVoiceLanguage, "off">,
  token: string,
) {
  return cache.get(pathFor(language, token)) || null;
}
