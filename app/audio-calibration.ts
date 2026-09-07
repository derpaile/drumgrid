export type CalibrationDetection = { timeMs: number; confidence?: number };
export type LatencyMeasurement = { latencyMs: number; spreadMs: number; accepted: number; total: number; offsets: number[] };
const median = (values: number[]) => { const a = [...values].sort((x, y) => x - y), i = Math.floor(a.length / 2); return a.length % 2 ? a[i]! : (a[i - 1]! + a[i]!) / 2; };
/** Find a repeated early arrival, not the loudest reflection. Each click contributes at most once. */
export function measureLatency(scheduledMs: number[], detections: CalibrationDetection[]): LatencyMeasurement | null {
  if (scheduledMs.length < 6) return null;
  const candidates = scheduledMs.map((time, index) => detections
    .filter(hit => Number.isFinite(hit.timeMs) && (hit.confidence ?? 2) >= 1.2)
    .map(hit => hit.timeMs - time)
    .filter(offset => offset >= 0 && offset <= Math.min(600, (scheduledMs[index + 1] ?? time + 750) - time - 100)));
  let best: number[] = [];
  for (const seed of candidates.flat()) {
    const cluster = candidates.flatMap(offsets => {
      const near = offsets.filter(x => Math.abs(x - seed) <= 12).sort((a, b) => Math.abs(a - seed) - Math.abs(b - seed));
      return near.length ? [near[0]!] : [];
    });
    if (cluster.length > best.length || (cluster.length === best.length && median(cluster) < median(best))) best = cluster;
  }
  if (best.length < Math.max(6, Math.ceil(scheduledMs.length * .75))) return null;
  const center = median(best), mad = median(best.map(x => Math.abs(x - center)));
  const stable = best.filter(x => Math.abs(x - center) <= Math.max(3, 3 * mad));
  if (stable.length < 6) return null;
  const latencyMs = median(stable), spreadMs = median(stable.map(x => Math.abs(x - latencyMs)));
  if (spreadMs > 8 || Math.max(...stable) - Math.min(...stable) > 25) return null;
  return { latencyMs: Math.round(latencyMs), spreadMs: Math.round(spreadMs * 10) / 10, accepted: stable.length, total: scheduledMs.length, offsets: stable };
}
