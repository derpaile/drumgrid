"use client";
import { memo, useSyncExternalStore } from "react";
import type { AudioFeedbackAnalysis } from "./audio-feedback";
import type { LiveStore } from "./live-store";
export type InputLevel = { peak: number; noiseFloor: number; clipped: boolean; detected: number };
export const InputMeter = memo(function InputMeter({ input }: { input: LiveStore<InputLevel> }) {
  const level = useSyncExternalStore(input.subscribe, input.get, input.server);
  const percent = Math.max(0, Math.min(100, (20 * Math.log10(Math.max(.0001, level.peak)) + 60) / 60 * 100));
  return <div className={`input-meter ${level.clipped ? "clipped" : ""}`}><span>Mikrofonpegel</span><meter min="0" max="100" value={percent} aria-label="Mikrofonpegel" /><small>{level.clipped ? "Übersteuert · Eingangspegel senken" : level.peak < .002 ? "Sehr leise · näher ans Mikrofon" : "Signal vorhanden"} · {level.detected} Impulse</small></div>;
});
export const LiveFeedback = memo(function LiveFeedback({ store, input, active }: { store: LiveStore<AudioFeedbackAnalysis | null>; input: LiveStore<InputLevel>; active: boolean }) {
  const analysis = useSyncExternalStore(store.subscribe, store.get, store.server);
  const matches = analysis?.matched || [];
  const last = matches.reduce<typeof matches[number] | undefined>((previous, hit) => !previous || previous.transient.timeMs < hit.transient.timeMs ? hit : previous, undefined);
  const extra = analysis?.extra.at(-1);
  const miss = analysis?.missed.at(-1);
  const missedLatest = miss && (!last || miss.expected.timeMs > last.expected.timeMs) && (!extra || miss.expected.timeMs > extra.correctedTimeMs);
  const extraLatest = !missedLatest && extra && (!last || extra.transient.timeMs > last.transient.timeMs);
  const kind = missedLatest ? "missed" : extraLatest ? "extra" : last?.classification || "waiting";
  const text = !active ? "Bereit zum Spielen" : missedLatest ? "Schlag verpasst" : extraLatest ? "Zusätzlicher Schlag" : !last ? "Spiele zum Beat" : last.classification === "on-time" ? "Im Timing" : last.offsetMs < 0 ? "Zu früh" : "Zu spät";
  const metrics = analysis?.overall;
  return <section className={`instant-feedback ${kind}`} aria-label="Direkte Timing-Rückmeldung">
    <div className="instant-head"><div><small>DEIN LETZTER SCHLAG</small><strong>{text}</strong></div><b className="instant-offset">{active && last && !extraLatest && !missedLatest ? `${last.offsetMs > 0 ? "+" : ""}${Math.round(last.offsetMs)} ms` : "—"}</b></div>
    <div className="timing-gauge" aria-label="Früh links, passend in der Mitte, spät rechts"><span className="timing-good-zone" />{active && last && !extraLatest && !missedLatest && <i key={last.transient.timeMs} style={{ left: `${Math.max(2, Math.min(98, 50 + last.offsetMs / 120 * 48))}%` }} />}<span className="timing-center" /></div>
    <div className="gauge-labels"><span>−120 ms · früh</span><span>±25 ms passend</span><span>spät · +120 ms</span></div>
    <div className="instant-history" aria-label="Letzte 32 Schläge">{matches.slice(-32).map(hit => <i key={hit.expected.id} className={hit.classification} title={`${Math.round(hit.offsetMs)} ms`} style={{ height: `${Math.max(15, Math.min(100, Math.abs(hit.offsetMs) / 120 * 100))}%` }} />)}</div>
    <div className="instant-summary"><span><b>{metrics?.matchedHits ? `${Math.round(metrics.meanAbsoluteMs)} ms` : "—"}</b> Ø Abweichung</span><span><b>{metrics?.matchedHits ? `${Math.round(metrics.spreadMs)} ms` : "—"}</b> Streuung</span><span><b>{metrics?.expectedHits ? `${Math.round(metrics.hitRate)}%` : "—"}</b> erkannt</span></div>
    <InputMeter input={input} />
    <p>Auswertung der jüngsten Schläge. Das Mikrofon erkennt Einsätze, keine einzelnen Instrumente. Kopfhörer verhindern, dass der App-Beat mitgezählt wird.</p>
  </section>;
});
