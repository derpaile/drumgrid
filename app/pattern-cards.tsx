"use client";
import { memo, useId, useState } from "react";
import { DRUM_LABELS, PATTERN_TYPE_INFO, parseMeter, stepsPerBar, type Pattern, type DrumVoice } from "./metronome-core";
import { patternStyleFamily } from "./pattern-style";
import { skillLabelsFor } from "./practice-model";
import { countStep, variantDifference, type PatternGroup } from "./practice-tools";

const PREVIEW_LANES: Array<{ label: string; tone: string; voices: DrumVoice[] }> = [
  { label: "Kick", tone: "kick", voices: ["kick"] },
  { label: "Snare/Toms", tone: "snare", voices: ["snare", "rim", "highTom", "lowTom"] },
  { label: "Becken", tone: "cymbal", voices: ["closedHat", "openHat", "ride", "crash"] },
];
export const PatternMiniature = memo(function PatternMiniature({ pattern, base }: { pattern: Pattern; base?: Pattern }) {
  const [selectedBar, setSelectedBar] = useState(0);
  const previewId = useId();
  const meter = parseMeter(pattern.meter);
  const barSteps = stepsPerBar(meter, pattern.subdivision);
  const bars = Math.ceil(pattern.pattern.length / barSteps);
  const bar = Math.min(selectedBar, bars - 1);
  const comparable = base && base.meter === pattern.meter && base.subdivision === pattern.subdivision && base.pattern.length === pattern.pattern.length;
  const counts = Array.from({ length: barSteps }, (_, step) => countStep(step, meter, pattern.subdivision));
  const lanes = pattern.drumTracks ? PREVIEW_LANES : [{ label: "Puls", tone: "kick", voices: [] }];
  return <div className="pattern-miniature" aria-label={`${bars} ${bars === 1 ? "Takt" : "Takte"}, Zählzeiten und Schlagspuren${comparable ? "; Änderungen gegenüber der Grundform gelb markiert" : ""}`}>
    <div className="miniature-navigation">
      <span>Vorschau · {bars === 1 ? "1 Takt" : `${bars} Takte insgesamt`}</span>
      {bars > 1 && <div className="miniature-navigation-controls">
        <button aria-label="Vorheriger Takt" disabled={bar === 0} onClick={() => setSelectedBar(bar - 1)}>◀</button>
        <select aria-label="Takt der Vorschau" aria-controls={previewId} value={bar} onChange={event => setSelectedBar(Number(event.target.value))}>{Array.from({ length: bars }, (_, index) => <option key={index} value={index}>Takt {index + 1} / {bars}</option>)}</select>
        <button aria-label="Nächster Takt" disabled={bar === bars - 1} onClick={() => setSelectedBar(bar + 1)}>▶</button>
      </div>}
    </div>
    <div className="miniature-bar" id={previewId}>
      {/* Keyboard focus lets users scroll dense rhythms without a mouse. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="miniature-scroll" tabIndex={0} role="region" aria-label={`Takt ${bar + 1}: Zählzeiten und Schläge, bei Bedarf seitlich scrollen`}>
        <div style={{ minWidth: 72 + barSteps * (pattern.subdivision === "Triolen" ? 24 : 18) }}>
          <div className="miniature-lane miniature-count"><span>Zählzeit</span><div style={{ gridTemplateColumns: `repeat(${barSteps}, minmax(0, 1fr))` }}>{counts.map((count, step) => <b key={step} className={count.beatStart ? "beat-start" : ""}>{count.label}</b>)}</div></div>
          {lanes.map(lane => <div className={`miniature-lane lane-${lane.tone}`} key={lane.label}><span>{lane.label}</span><div style={{ gridTemplateColumns: `repeat(${barSteps}, minmax(0, 1fr))` }}>{counts.map((count, step) => {
            const index = bar * barSteps + step;
            const states = lane.voices.length ? lane.voices.map(v => pattern.drumTracks?.[v]?.[index] || "mute") : [pattern.pattern[index] || "mute"];
            const state = states.includes("accent") ? "accent" : states.includes("normal") ? "normal" : states.includes("ghost") ? "ghost" : "mute";
            const changed = comparable && (lane.voices.length ? lane.voices.some(v => (pattern.drumTracks?.[v]?.[index] || "mute") !== (base.drumTracks?.[v]?.[index] || "mute")) : pattern.pattern[index] !== base.pattern[index]);
            return <i key={step} title={`${lane.label} · ${count.label} · ${state === "accent" ? "Akzent" : state === "normal" ? "Schlag" : state === "ghost" ? "Ghostnote" : "Pause"}${changed ? " · geändert" : ""}`} className={`${state} ${count.beatStart ? "beat-start" : ""} ${changed ? "changed" : ""}`} />;
          })}</div></div>)}
        </div>
      </div>
    </div>
  </div>;
});
export const PatternCard = memo(function PatternCard({ group, loadedId, favorites, previewId, previewLoading, onFavorite, onPreview, onLoad }: {
  group: PatternGroup; loadedId: string; favorites: string[]; previewId: string | null; previewLoading: boolean;
  onFavorite: (id: string) => void; onPreview: (pattern: Pattern) => void; onLoad: (pattern: Pattern) => void;
}) {
  const [selectedId, setSelectedId] = useState(group.variants.find(v => v.id === loadedId)?.id || group.variants[0]!.id);
  const [expanded, setExpanded] = useState(false);
  const [highlightChanges, setHighlightChanges] = useState(false);
  const detailsId = useId();
  const pattern = group.variants.find(v => v.id === selectedId) || group.variants[0]!;
  const base = group.variants[0]!;
  const difference = pattern.id !== base.id ? variantDifference(base, pattern) : null;
  const isPreview = previewId === pattern.id;
  const bars = Math.ceil(pattern.pattern.length / stepsPerBar(parseMeter(pattern.meter), pattern.subdivision));
  const canHighlight = difference && Array.isArray(difference) && difference.length > 0;
  const selectVariant = (id: string) => { setSelectedId(id); setHighlightChanges(false); };
  const variantLabel = (variant: Pattern, index: number) => variant.name.match(/ · (Groove [A-Z])/u)?.[1] || `Variante ${index + 1}`;
  return <article data-style-family={patternStyleFamily(pattern.category)} data-pattern-type={pattern.patternType || "Groove"} className={`pattern-card ${loadedId === pattern.id ? "loaded" : ""}`}>
    <div className="card-top"><div><div className="card-category"><span className="pattern-type-badge">{PATTERN_TYPE_INFO[pattern.patternType || "Groove"].label}</span><span className="pattern-style-label">{pattern.category}</span></div><h3>{group.name}</h3>{loadedId === pattern.id && <span className="loaded-badge">Aktuell geladen</span>}</div><button className={`favorite ${favorites.includes(pattern.id) ? "on" : ""}`} onClick={() => onFavorite(pattern.id)} aria-label={favorites.includes(pattern.id) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"} aria-pressed={favorites.includes(pattern.id)}>{favorites.includes(pattern.id) ? "♥" : "♡"}</button></div>
    <div className="card-rhythm"><div className="card-meter"><small>Takt</small><strong>{pattern.meter}</strong></div><div className="card-rhythm-info"><strong>{pattern.subdivision} · {bars} {bars === 1 ? "Takt" : "Takte"}</strong>{pattern.grouping?.length ? <span>{pattern.grouping.join(" + ")}</span> : null}</div><span className="difficulty-badge" data-difficulty={pattern.difficulty}>{pattern.difficulty}</span></div>
    {group.variants.length > 1 && <div className="song-variants" aria-label={`Varianten von ${group.name}`}>
      <span>{group.variants.length} Parts</span>
      {group.variants.length > 4 ? <select aria-label={`Part von ${group.name}`} value={pattern.id} onChange={event => selectVariant(event.target.value)}>{group.variants.map((v, i) => <option key={v.id} value={v.id}>{variantLabel(v, i)}{loadedId === v.id ? " · geladen" : ""}</option>)}</select> : group.variants.map((v, i) => <button key={v.id} onClick={() => selectVariant(v.id)} aria-pressed={pattern.id === v.id}>{variantLabel(v, i)}</button>)}
    </div>}
    <PatternMiniature key={pattern.id} pattern={pattern} base={highlightChanges && canHighlight ? base : undefined} />
    {canHighlight && <label className="variant-highlight-control"><input type="checkbox" checked={highlightChanges} onChange={event => setHighlightChanges(event.target.checked)} />Änderungen zu {variantLabel(base, 0)} markieren</label>}
    <div className="card-skills">{skillLabelsFor(pattern).map(skill => <span key={skill}>{skill}</span>)}<span>Start {pattern.playback?.bpm || Math.round((pattern.bpmMin + pattern.bpmMax) / 2)} BPM</span></div>
    <div className="card-footer"><div className="card-meta"><span>{pattern.bpmMin}–{pattern.bpmMax} BPM</span>{pattern.originalFeel && <span>Original Feel</span>}</div><div className="card-actions"><button onClick={() => setExpanded(v => !v)} aria-expanded={expanded} aria-controls={detailsId}>Details</button><button onClick={() => onPreview(pattern)} aria-pressed={isPreview}>{isPreview ? previewLoading ? "Lädt · Stopp" : "■ Stopp" : "▶ Anhören"}</button><button className="start-small" onClick={() => onLoad(pattern)}>Zum Trainer</button></div></div>
    {expanded && <div className="pattern-details" id={detailsId}><p className="card-attribution">{pattern.attribution || "Genreübung"}</p>{difference && <p className="variant-difference">{typeof difference === "string" ? difference : `Anders als ${variantLabel(base, 0)}: ${difference.map(v => DRUM_LABELS[v]).join(", ") || "gleiche Schläge, andere Vorgaben"}`}</p>}<p><strong>Worauf hören?</strong>{pattern.instruction}</p><p><strong>Warum interessant?</strong>{pattern.whyInteresting}</p><p>Übetempo: {pattern.bpmMin}–{pattern.bpmMax} BPM</p>{pattern.originalFeel && <p>{pattern.originalFeel.note}</p>}{pattern.source && <a className="source-link" href={pattern.source.url} target="_blank" rel="noreferrer">{pattern.source.label} · Quelle öffnen</a>}</div>}
  </article>;
});
