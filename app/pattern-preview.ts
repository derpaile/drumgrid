import { useCallback, useEffect, useRef, useState } from "react";
import { DRUM_VOICES, parseMeter, stepsPerBar, type Pattern } from "./metronome-core";
import { drumHitLevel, drumPlaybackRate, drumSampleFor, normalizeDrumKit, primeDrumKit, type DrumSampleCache } from "./drum-synthesis";

/** Separate graph and transport: auditioning never writes a trainer setting or history entry. */
export function usePatternPreview() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const runtime = useRef<{ context: AudioContext; timer?: number } | null>(null);
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
    if (runtime.current) {
      window.clearTimeout(runtime.current.timer);
      void runtime.current.context.close().catch(() => undefined);
      runtime.current = null;
    }
    setPreviewId(null);
    setLoading(false);
  }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); stop(); };
  }, [stop]);
  const play = useCallback(async (pattern: Pattern, volume: number) => {
    stop();
    const token = generation.current;
    setPreviewId(pattern.id);
    setLoading(true);
    setError("");
    try {
      const context = new AudioContext({ latencyHint: "interactive" });
      runtime.current = { context };
      await context.resume();
      const cache: DrumSampleCache = new Map();
      const kit = normalizeDrumKit("707");
      await primeDrumKit(context, cache, kit, DRUM_VOICES);
      if (generation.current !== token) return;
      const output = context.createGain();
      const limiter = context.createDynamicsCompressor();
      output.gain.value = .9;
      output.connect(limiter).connect(context.destination);
      const bpm = pattern.playback?.bpm || Math.round((pattern.bpmMin + pattern.bpmMax) / 2);
      const meter = parseMeter(pattern.meter);
      const barSteps = stepsPerBar(meter, pattern.subdivision);
      const unit = pattern.tempoUnit === "dotted-quarter" ? 1.5 : pattern.tempoUnit === "eighth" ? .5 : 1;
      const stepSeconds = meter.beats * 4 / meter.denominator / unit * 60 / bpm / barSteps;
      const length = pattern.pattern.length;
      const cycles = Math.max(1, Math.ceil(2 * barSteps / length));
      const swing = (pattern.playback?.swing || 50) / 100;
      let when = context.currentTime + .06;
      const start = when;
      let openHats: Array<{ source: AudioBufferSourceNode; gain: GainNode; end: number; level: number }> = [];
      for (let i = 0; i < length * cycles && when - start < 20; i++) {
        const index = i % length;
        for (const voice of DRUM_VOICES) {
          const state = pattern.drumTracks?.[voice]?.[index] || "mute";
          if (state === "mute") continue;
          const buffer = drumSampleFor(cache, kit, voice, i & 1);
          if (!buffer) continue;
          const source = context.createBufferSource();
          const gain = context.createGain();
          const level = drumHitLevel(voice, state, 1, volume);
          source.buffer = buffer;
          source.playbackRate.value = drumPlaybackRate(kit, voice, state, i);
          gain.gain.setValueAtTime(level, when);
          source.connect(gain).connect(output);
          openHats = openHats.filter(hat => hat.end > when);
          if (voice === "closedHat") for (const hat of openHats) {
            hat.gain.gain.cancelScheduledValues(when);
            hat.gain.gain.setValueAtTime(hat.level, when);
            hat.gain.gain.exponentialRampToValueAtTime(.0001, when + .028);
            hat.source.stop(when + .035);
            hat.end = when + .035;
          }
          source.start(when);
          const end = when + buffer.duration / source.playbackRate.value + .02;
          source.stop(end);
          source.onended = () => { source.disconnect(); gain.disconnect(); };
          if (voice === "openHat") openHats.push({ source, gain, end, level });
        }
        when += stepSeconds * (["Achtel", "16tel"].includes(pattern.subdivision) ? 2 * (i % barSteps % 2 === 0 ? swing : 1 - swing) : 1);
      }
      setLoading(false);
      runtime.current!.timer = window.setTimeout(stop, Math.max(0, when - context.currentTime + .25) * 1000);
    } catch {
      if (generation.current !== token) return;
      stop();
      setError("Vorschau konnte nicht geladen werden. Bitte erneut versuchen.");
    }
  }, [stop]);
  return { previewId, loading, error, play, stop };
}
