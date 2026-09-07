"use client";
import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DRUM_LABELS, DRUM_VOICES, HIT_LABELS, cycleDrumHit, stepsPerBar, type DrumHitState, type DrumTracks, type DrumVoice, type Meter, type Subdivision } from "./metronome-core";
import { countStep, type BarLoop } from "./practice-tools";
import type { LiveStore, PlaybackDisplay } from "./live-store";

export const LiveProgress = memo(function LiveProgress({ clock }: { clock: LiveStore<PlaybackDisplay> }) {
  const { bars, timer } = useSyncExternalStore(clock.subscribe, clock.get, clock.server);
  return <div className="session-progress"><span>{bars} Takte</span><span>{timer === "∞" ? "freie Session" : `${timer} verbleibend`}</span></div>;
});
export type GridView = "continuous" | "stacked" | "bars";
export const PracticeGrid = memo(function PracticeGrid({ tracks, length, meter, subdivision, clock, volumes, onVolume, onHit, view = "continuous", loop, editing = false, tool = "cycle", onPaintStart, onPaintEnd, onClear, onShift }: {
  tracks: DrumTracks; length: number; meter: Meter; subdivision: Subdivision;
  clock: LiveStore<PlaybackDisplay>; volumes: Record<DrumVoice, number>;
  onVolume: (voice: DrumVoice, value: number) => void;
  onHit: (voice: DrumVoice, index: number, state?: DrumHitState) => void;
  view?: GridView; loop?: BarLoop | null; editing?: boolean; tool?: DrumHitState | "cycle";
  onPaintStart?: () => void; onPaintEnd?: () => void; onClear?: (voice: DrumVoice) => void; onShift?: (voice: DrumVoice, delta: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const paint = useRef<{ id: number; state: DrumHitState; visited: Set<string> } | null>(null);
  const [selectedBar, setSelectedBar] = useState(0);
  const barSteps = stepsPerBar(meter, subdivision);
  const bars = Math.max(1, Math.ceil(length / barSteps));
  const selected = Math.min(selectedBar, bars - 1);
  const voices = editing ? [...DRUM_VOICES] : DRUM_VOICES.filter(v => tracks[v]?.some(s => s !== "mute"));
  const sections = view === "continuous" ? [0] : Array.from({ length: bars }, (_, i) => i);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let previous = -2;
    const update = () => {
      const step = clock.get().step;
      if (step === previous) return;
      container.querySelectorAll('[data-playing="true"]').forEach(cell => cell.removeAttribute("data-playing"));
      const active = container.querySelectorAll<HTMLElement>(`[data-play-step="${step}"]`);
      active.forEach(cell => { cell.dataset.playing = "true"; });
      if (view === "bars") {
        const visibleBar = step >= 0 ? Math.floor(step / barSteps) : selected;
        container.querySelectorAll<HTMLElement>("[data-grid-bar]").forEach(panel => { panel.hidden = Number(panel.dataset.gridBar) !== visibleBar; });
        container.querySelectorAll<HTMLElement>("[data-bar-button]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.barButton) === visibleBar)));
      }
      const cell = active[0];
      const scroller = cell?.closest<HTMLElement>(".practice-grid-scroll");
      if (scroller && cell) {
        const a = cell.getBoundingClientRect(), b = scroller.getBoundingClientRect();
        if (a.right > b.right || a.left < b.left + 100) scroller.scrollLeft += a.left - b.left - scroller.clientWidth * .4;
      }
      previous = step;
    };
    update();
    return clock.subscribe(update);
  }, [clock, view, selected, barSteps, tracks, length]);
  const finishPaint = () => { if (paint.current) { paint.current = null; onPaintEnd?.(); } };
  return <div ref={root} className={`practice-grid-view ${view} ${editing ? "editing" : ""}`}>
    {view === "bars" && <div className="bar-tabs" aria-label="Takt auswählen">{Array.from({ length: bars }, (_, i) => <button type="button" key={i} data-bar-button={i} aria-pressed={selected === i} onClick={() => setSelectedBar(i)}>Takt {i + 1}</button>)}<small>Bei Wiedergabe folgt die Ansicht dem Takt.</small></div>}
    {sections.map(bar => {
      const start = view === "continuous" ? 0 : bar * barSteps;
      const indices = Array.from({ length: Math.min(view === "continuous" ? length : barSteps, length - start) }, (_, i) => i + start);
      const columns = `100px repeat(${indices.length}, minmax(${editing ? 36 : 30}px, 1fr))`;
      return <section className="practice-grid-bar" key={bar} data-grid-bar={bar} aria-label={view === "continuous" ? "Alle Takte" : `Takt ${bar + 1}`}>
        {view !== "continuous" && <div className="grid-bar-title">Takt {bar + 1}{loop && bar + 1 >= loop.start && bar + 1 <= loop.end ? " · Loop" : ""}</div>}
        <div className="practice-grid-scroll drum-grid-scroll" role="region" aria-label={editing ? "Drum-Pattern bearbeiten" : "Aktuelles Drum-Pattern"}>
          <div className="drum-lane count-ruler" style={{ gridTemplateColumns: columns }}><span className="drum-lane-label">Zählen</span>{indices.map(i => {
            const count = countStep(i % barSteps, meter, subdivision);
            return <span key={i} className={`${count.beatStart ? "beat-start" : ""} ${i % barSteps === 0 ? "bar-start" : ""}`}><small>{i % barSteps === 0 ? `T${Math.floor(i / barSteps) + 1}` : ""}</small>{count.label}</span>;
          })}</div>
          {voices.map(voice => <div className="drum-lane" key={voice} style={{ gridTemplateColumns: columns }}>
            <span className="drum-lane-label voice-lane-label"><span>{DRUM_LABELS[voice]}</span>
              <input className="voice-volume-input" type="range" min="0" max="100" step="5" value={volumes[voice]} onChange={e => onVolume(voice, Number(e.target.value))} aria-label={`${DRUM_LABELS[voice]} Lautstärke`} />
              {editing && <span className="lane-tools"><button onClick={() => onShift?.(voice, -1)} aria-label={`${DRUM_LABELS[voice]} einen Schritt zurück`}>←</button><button onClick={() => onShift?.(voice, 1)} aria-label={`${DRUM_LABELS[voice]} einen Schritt vor`}>→</button><button onClick={() => onClear?.(voice)} aria-label={`${DRUM_LABELS[voice]} leeren`}>×</button></span>}
            </span>
            {indices.map((i, position) => {
              const state = tracks[voice]?.[i] || "mute";
              const inLoop = !loop || (Math.floor(i / barSteps) + 1 >= loop.start && Math.floor(i / barSteps) + 1 <= loop.end);
              return <button key={i} type="button" data-play-step={i} data-hit-voice={voice} data-hit-index={i} tabIndex={position === 0 ? 0 : -1}
                className={`${editing ? "editor-step" : "drum-cell"} ${state} ${countStep(i % barSteps, meter, subdivision).beatStart ? "beat-start" : ""} ${i % barSteps === 0 ? "bar-start" : ""} ${inLoop ? "" : "outside-loop"}`}
                aria-label={`${DRUM_LABELS[voice]}, Takt ${Math.floor(i / barSteps) + 1}, ${countStep(i % barSteps, meter, subdivision).label}, Schritt ${i + 1}: ${HIT_LABELS[state]}`} aria-pressed={state !== "mute"}
                onPointerDown={e => {
                  if (!editing || e.button !== 0) return;
                  e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId);
                  const next = tool === "cycle" ? cycleDrumHit(state) : tool;
                  paint.current = { id: e.pointerId, state: next, visited: new Set([`${voice}-${i}`]) };
                  onPaintStart?.(); onHit(voice, i, next);
                }}
                onPointerMove={e => {
                  const stroke = paint.current;
                  if (!stroke || stroke.id !== e.pointerId) return;
                  const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-hit-voice]");
                  if (!cell || !root.current?.contains(cell)) return;
                  const v = cell.dataset.hitVoice as DrumVoice, index = Number(cell.dataset.hitIndex), key = `${v}-${index}`;
                  if (stroke.visited.has(key)) return;
                  stroke.visited.add(key); onHit(v, index, stroke.state);
                }} onPointerUp={finishPaint} onPointerCancel={finishPaint} onLostPointerCapture={finishPaint}
                onClick={e => { if (!editing) onHit(voice, i); else if (e.detail === 0) { onPaintStart?.(); onHit(voice, i, tool === "cycle" ? cycleDrumHit(state) : tool); onPaintEnd?.(); } }}
                onKeyDown={e => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
                  e.preventDefault();
                  const cells = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[data-play-step]");
                  const target = e.key === "Home" ? 0 : e.key === "End" ? indices.length - 1 : Math.max(0, Math.min(indices.length - 1, position + (e.key === "ArrowRight" ? 1 : -1)));
                  cells?.[target]?.focus();
                }}>{editing ? state === "accent" ? ">" : state === "ghost" ? "·" : state === "normal" ? "●" : "" : null}</button>;
            })}
          </div>)}
        </div>
      </section>;
    })}
  </div>;
});
