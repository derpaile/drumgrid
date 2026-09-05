"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Native modal semantics keep focus and touch interaction inside the open sheet. */
export function PracticeSheet({ title, children, onClose, playing, onStop, className = "" }: {
  title: string; children: ReactNode; onClose: () => void;
  playing: boolean; onStop: () => void; className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className={`practice-sheet ${className}`} aria-labelledby={heading}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="sheet-header"><h2 id={heading}>{title}</h2>
      {playing && <button className="sheet-stop" onClick={onStop}>■ Stopp</button>}
      <button onClick={onClose} className="sheet-done">Fertig</button>
    </header>
    <div className="sheet-body">{children}</div>
  </dialog>;
}

/** Click/keyboard: one step. Holding: repeat, cancelled on leave, blur or pointer loss. */
export function HoldButton({ onStep, label, children, disabled }: {
  onStep: () => void; label: string; children: ReactNode; disabled?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressClick = useRef(false);
  const latestStep = useRef(onStep);
  useEffect(() => { latestStep.current = onStep; }, [onStep]);
  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (repeat.current !== null) clearInterval(repeat.current);
    timer.current = null; repeat.current = null;
  };
  useEffect(() => {
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => { clear(); window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); };
  }, []);
  return <button className="tempo-step" aria-label={label} disabled={disabled}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      clear(); suppressClick.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      timer.current = setTimeout(() => {
        suppressClick.current = true;
        latestStep.current();
        repeat.current = setInterval(() => latestStep.current(), 140);
      }, 450);
    }}
    onPointerMove={(event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        clear(); suppressClick.current = true;
      }
    }}
    onPointerUp={clear} onLostPointerCapture={clear}
    onPointerCancel={() => { clear(); suppressClick.current = true; }}
    onClick={() => { if (!suppressClick.current) onStep(); suppressClick.current = false; }}
  >{children}</button>;
}

export function TempoEntry({ bpm, onApply }: { bpm: number; onApply: (bpm: number) => void }) {
  const [draft, setDraft] = useState(String(bpm));
  const value = Number(draft);
  const valid = draft.trim() !== "" && Number.isInteger(value) && value >= 20 && value <= 300;
  return <form className="tempo-entry" onSubmit={(event) => { event.preventDefault(); if (valid) onApply(value); }}>
    <label htmlFor="exact-tempo">Tempo in BPM</label>
    <input id="exact-tempo" type="number" inputMode="numeric" min="20" max="300" step="1" value={draft} onChange={(event) => setDraft(event.target.value)} />
    <div className="tempo-entry-steps"><button type="button" onClick={() => setDraft(String(Math.max(20, (valid ? value : bpm) - 5)))}>−5 BPM</button><button type="button" onClick={() => setDraft(String(Math.min(300, (valid ? value : bpm) + 5)))}>+5 BPM</button></div>
    <p>20–300 BPM</p><button className="primary" disabled={!valid} type="submit">Tempo übernehmen</button>
  </form>;
}
