"use client";
import { memo, useState } from "react";
import { DRUM_LABELS, PATTERN_TYPE_INFO, parseMeter, stepsPerBar, type Pattern, type DrumVoice } from "./metronome-core";
import { skillLabelsFor } from "./practice-model";
import { variantDifference, type PatternGroup } from "./practice-tools";

const PREVIEW_LANES: Array<{ label: string; voices: DrumVoice[] }> = [
  { label: "Kick", voices: ["kick"] }, { label: "Snare", voices: ["snare", "rim", "highTom", "lowTom"] }, { label: "Becken", voices: ["closedHat", "openHat", "ride", "crash"] },
];
export const PatternMiniature = memo(function PatternMiniature({ pattern, base }: { pattern: Pattern; base?: Pattern }) {
  const barSteps = stepsPerBar(parseMeter(pattern.meter), pattern.subdivision);
  const bars = Math.ceil(pattern.pattern.length / barSteps);
  const comparable = base && base.meter === pattern.meter && base.subdivision === pattern.subdivision && base.pattern.length === pattern.pattern.length;
  return <div className="pattern-miniature" aria-label={`${bars} ${bars === 1 ? "Takt" : "Takte"}, Kick, Snare und Toms, Becken${comparable ? `; Änderungen gegenüber ${base.name.match(/Groove [A-Z]/)?.[0] || "Grundform"} gelb markiert` : ""}`}>
    {Array.from({ length: bars }, (_, bar) => <div className="miniature-bar" key={bar}><small>T{bar + 1}</small>{PREVIEW_LANES.map(lane => <div className="miniature-lane" key={lane.label}><span>{lane.label}</span><div style={{ gridTemplateColumns: `repeat(${barSteps}, minmax(2px, 1fr))` }}>{Array.from({ length: barSteps }, (_, step) => {
      const index = bar * barSteps + step;
      const states = lane.voices.map(v => pattern.drumTracks?.[v]?.[index] || "mute");
      const state = states.includes("accent") ? "accent" : states.includes("normal") ? "normal" : states.includes("ghost") ? "ghost" : "mute";
      const changed = comparable && lane.voices.some(v => (pattern.drumTracks?.[v]?.[index] || "mute") !== (base.drumTracks?.[v]?.[index] || "mute"));
      return <i key={step} className={`${state} ${changed ? "changed" : ""}`} />;
    })}</div></div>)}</div>)}
  </div>;
});
export const PatternCard = memo(function PatternCard({ group, loadedId, favorites, previewId, previewLoading, onFavorite, onPreview, onLoad }: {
  group: PatternGroup; loadedId: string; favorites: string[]; previewId: string | null; previewLoading: boolean;
  onFavorite: (id: string) => void; onPreview: (pattern: Pattern) => void; onLoad: (pattern: Pattern) => void;
}) {
  const [selectedId, setSelectedId] = useState(group.variants.find(v => v.id === loadedId)?.id || group.variants[0]!.id);
  const [expanded, setExpanded] = useState(false);
  const pattern = group.variants.find(v => v.id === selectedId) || group.variants[0]!;
  const base = group.variants[0]!;
  const difference = pattern.id !== base.id ? variantDifference(base, pattern) : null;
  const isPreview = previewId === pattern.id;
  return <article className={`pattern-card ${loadedId === pattern.id ? "loaded" : ""}`}>
    <div className="card-top"><div><div className="card-category" title={pattern.attribution}>{pattern.category} · {PATTERN_TYPE_INFO[pattern.patternType || "Groove"].label} · {pattern.attribution || "Genreübung"}</div><h3>{group.name}</h3>{loadedId === pattern.id && <span className="loaded-badge">Aktuell geladen</span>}</div><button className={`favorite ${favorites.includes(pattern.id) ? "on" : ""}`} onClick={() => onFavorite(pattern.id)} aria-label={favorites.includes(pattern.id) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"} aria-pressed={favorites.includes(pattern.id)}>{favorites.includes(pattern.id) ? "♥" : "♡"}</button></div>
    {group.variants.length > 1 && <div className="song-variants" aria-label={`Varianten von ${group.name}`}>{group.variants.map((v, i) => <button key={v.id} onClick={() => setSelectedId(v.id)} aria-pressed={pattern.id === v.id}>{v.name.match(/ · (Groove [A-Z])/u)?.[1] || `Variante ${i + 1}`}</button>)}</div>}
    <PatternMiniature pattern={pattern} base={pattern.id !== base.id ? base : undefined} />
    {difference && <p className="variant-difference">{typeof difference === "string" ? difference : `Anders als ${base.name.match(/Groove [A-Z]/)?.[0] || "A"}: ${difference.map(v => DRUM_LABELS[v]).join(", ") || "gleiche Schläge, andere Vorgaben"}`}{Array.isArray(difference) ? " · gelb markiert" : ""}</p>}
    <div className="card-skills">{skillLabelsFor(pattern).map(skill => <span key={skill}>{skill}</span>)}<span>Start {pattern.playback?.bpm || Math.round((pattern.bpmMin + pattern.bpmMax) / 2)} BPM</span></div>
    <div className="card-footer"><div className="card-meta"><span>{pattern.meter}</span><span>{pattern.subdivision}</span><span>{pattern.bars || 1} {(pattern.bars || 1) === 1 ? "Takt" : "Takte"}</span><span>{pattern.difficulty}</span>{pattern.originalFeel && <span>Original Feel</span>}</div><div className="card-actions"><button onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>Details</button><button onClick={() => onPreview(pattern)} aria-pressed={isPreview}>{isPreview ? previewLoading ? "Lädt · Stopp" : "■ Stopp" : "▶ Anhören"}</button><button className="start-small" onClick={() => onLoad(pattern)}>Zum Trainer</button></div></div>
    {expanded && <div className="pattern-details"><p><strong>Worauf hören?</strong>{pattern.instruction}</p><p><strong>Warum interessant?</strong>{pattern.whyInteresting}</p><p>Übetempo: {pattern.bpmMin}–{pattern.bpmMax} BPM</p>{pattern.originalFeel && <p>{pattern.originalFeel.note}</p>}{pattern.source && <a className="source-link" href={pattern.source.url} target="_blank" rel="noreferrer">{pattern.source.label} · Quelle öffnen</a>}</div>}
  </article>;
});
