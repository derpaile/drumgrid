"use client";

import { useEffect, useRef } from "react";

export type UiLanguage = "de" | "en";
export type UiTheme = "signal" | "ultraviolet" | "ember" | "glacier" | "mono";
export type UiDensity = "comfortable" | "compact";
export type TransportDock = "left" | "center" | "right";

export type UiPreferences = {
  language: UiLanguage;
  theme: UiTheme;
  density: UiDensity;
  scale: number;
  reduceMotion: boolean;
  texture: boolean;
  highContrast: boolean;
  beatGlow: boolean;
  showCoach: boolean;
  showSpectrum: boolean;
  floatingTransport: boolean;
  transportDock: TransportDock;
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  language: "de",
  theme: "signal",
  density: "comfortable",
  scale: 100,
  reduceMotion: false,
  texture: true,
  highContrast: false,
  beatGlow: true,
  showCoach: true,
  showSpectrum: true,
  floatingTransport: false,
  transportDock: "right",
};

const THEMES: Array<{ id: UiTheme; name: string; de: string; en: string }> = [
  { id: "signal", name: "Signal", de: "Studio-Grün, Messing und violette Sektionen", en: "Studio green, brass and violet sections" },
  { id: "ultraviolet", name: "Ultraviolet", de: "Elektrisches Cyan mit tiefem Violett", en: "Electric cyan with deep violet" },
  { id: "ember", name: "Ember", de: "Warmes Orange, Rot und dunkles Kupfer", en: "Warm orange, red and dark copper" },
  { id: "glacier", name: "Glacier", de: "Klares Eisblau mit kühlem Mint", en: "Clear ice blue with cool mint" },
  { id: "mono", name: "Mono", de: "Reduzierte Graustufen mit maximaler Klarheit", en: "Reduced grayscale with maximum clarity" },
];

const TRANSLATIONS: Array<[string, string]> = [
  ["Lokale Änderungen konnten nicht gespeichert werden. Exportiere deine Presets zur Sicherheit.", "Local changes could not be saved. Export your presets to be safe."],
  ["Alle Favoriten, Scenes und Übungsverläufe auf diesem Gerät löschen?", "Delete all favorites, scenes and practice history on this device?"],
  ["Änderungen wirken sofort. Beim Speichern bleiben Pattern, Kit, Tempo und Training gemeinsam als Scene erhalten.", "Changes apply instantly. Saving keeps pattern, kit, tempo and training together as a scene."],
  ["Drumklänge konnten nicht vorbereitet werden. Prüfe deine Verbindung und tippe erneut auf ▶.", "Drum sounds could not be prepared. Check your connection and press play again."],
  ["Kalibrierung fehlgeschlagen. Kopfhörer direkt ans Mikrofon halten oder Latenz manuell einstellen.", "Calibration failed. Hold headphones close to the microphone or set latency manually."],
  ["Keine Aufnahme, kein Konto, keine Telemetrie.", "No recording, no account, no telemetry."],
  ["Starten und mit Kopfhörern spielen", "Start and play with headphones"],
  ["Noch keine Favoriten. Markiere interessante Übungen mit ♥.", "No favorites yet. Mark interesting exercises with the heart control."],
  ["Deine zuletzt geladenen Grooves erscheinen hier.", "Your recently loaded grooves appear here."],
  ["Kein Pattern passt zu dieser Auswahl.", "No pattern matches this selection."],
  ["Die gesamte Bibliothek durchsuchen", "Search the entire library"],
  ["Was möchtest du gerade üben?", "What would you like to practice?"],
  ["Passend zu deinem Fortschritt", "Matched to your progress"],
  ["Raster, Länge, Kit und Feel", "Grid, length, kit and feel"],
  ["Alle Kits offline", "All kits offline"],
  ["App wird geprüft", "Checking app"],
  ["App wird vorbereitet", "Preparing app"],
  ["Audio kommt zurück …", "Audio is returning …"],
  ["Im Hintergrund pausiert", "Paused in background"],
  ["Mikrofon wird geöffnet", "Opening microphone"],
  ["Mikrofon abgelehnt", "Microphone denied"],
  ["Latenzmessung läuft noch.", "Latency measurement is still running."],
  ["Wird gespeichert …", "Saving …"],
  ["Wird vorbereitet", "Preparing"],
  ["Offline eingeschränkt", "Limited offline"],
  ["App offline bereit", "App ready offline"],
  ["Update bereit", "Update ready"],
  ["Nur online", "Online only"],
  ["Weiterüben", "Continue practice"],
  ["Exakt fortsetzen", "Resume exactly"],
  ["Neu beginnen", "Start over"],
  ["Heute für dich", "Today for you"],
  ["lokal zusammengestellt", "assembled locally"],
  ["Offline-Stand", "Offline status"],
  ["App bereit", "App ready"],
  ["Dein Übecoach", "Your practice coach"],
  ["Training wählen", "Choose training"],
  ["Session wählen", "Choose session"],
  ["Freies Training", "Free practice"],
  ["10 Minuten Groove", "10 minute groove"],
  ["5 Minuten Timing", "5 minute timing"],
  ["Tempo-Pyramide bereit", "Tempo pyramid ready"],
  ["Lernleiter", "Learning ladder"],
  ["Scene speichern", "Save scene"],
  ["freie Session", "free session"],
  ["verbleibend", "remaining"],
  ["Takte", "bars"],
  ["Schritte", "steps"],
  ["Wiedergabe stoppen", "Pause playback"],
  ["Wiedergabe starten", "Start playback"],
  ["Tempo um eins verringern", "Decrease tempo by one"],
  ["Tempo um eins erhöhen", "Increase tempo by one"],
  ["Tempo-Regler", "Tempo slider"],
  ["Pattern live bearbeiten", "Edit pattern live"],
  ["Drum-Trainer-Einstellungen", "Drum trainer settings"],
  ["Einstellungen zurückgesetzt", "Settings reset"],
  ["Lautstärke", "Volume"],
  ["Unterteilung", "Subdivision"],
  ["Schläge pro Takt", "Beats per bar"],
  ["Weitere Session-Optionen", "More session options"],
  ["Original Feel", "Original feel"],
  ["Tempo-Trainer", "Tempo trainer"],
  ["MIDI verbinden", "Connect MIDI"],
  ["MIDI verbunden", "MIDI connected"],
  ["Kein MIDI", "No MIDI"],
  ["MIDI abgelehnt", "MIDI denied"],
  ["Patterns durchsuchen", "Search patterns"],
  ["Name, Stil, Ziel …", "Name, style, goal …"],
  ["Patterns eingrenzen", "Narrow patterns"],
  ["Stil auswählen", "Choose style"],
  ["Alle Stile", "All styles"],
  ["Stil entfernen", "Remove style"],
  ["Patterns anzeigen", "Show patterns"],
  ["Weitere Patterns", "More patterns"],
  ["Schnellwahl", "Quick picks"],
  ["Einfach starten", "Start easy"],
  ["Leichte Patterns", "Easy patterns"],
  ["Puls festigen", "Strengthen pulse"],
  ["Groove vertiefen", "Deepen groove"],
  ["Bekannte Ausschnitte", "Familiar excerpts"],
  ["Bewegungen isolieren", "Isolate movements"],
  ["Zuletzt schwierig", "Recently difficult"],
  ["Aktive Filter", "Active filters"],
  ["Alles zurücksetzen", "Reset all"],
  ["Verfeinern", "Refine"],
  ["Grundfilter", "Basic filters"],
  ["Schwierigkeit", "Difficulty"],
  ["Lernziel", "Learning goal"],
  ["Bevorzugtes Kit", "Preferred kit"],
  ["Weitere Filter", "More filters"],
  ["Noch nicht geübt", "Not practiced yet"],
  ["Übeverlauf", "Practice history"],
  ["Auf diesem Gerät", "On this device"],
  ["Meine Grooves.", "My grooves."],
  ["Backup exportieren", "Export backup"],
  ["Backup importieren", "Import backup"],
  ["Eigenes Pattern", "Custom pattern"],
  ["aktive Minuten", "active minutes"],
  ["Favoriten", "Favorites"],
  ["Zuletzt verwendet", "Recently used"],
  ["Eigene Patterns", "Custom patterns"],
  ["Übungsverlauf", "Practice history"],
  ["Komplett laden", "Load all"],
  ["Nur Pattern", "Pattern only"],
  ["Duplizieren", "Duplicate"],
  ["Erstes Pattern bauen", "Build first pattern"],
  ["Lokale Daten löschen", "Delete local data"],
  ["Privat und lokal", "Private and local"],
  ["Installierbar", "Installable"],
  ["Kompakt", "Compact"],
  ["Präzise", "Precise"],
  ["Worauf hören?", "What to listen for"],
  ["Warum interessant?", "Why it matters"],
  ["Typischer Stolperstein", "Common pitfall"],
  ["Vereinfachen / steigern", "Simplify / advance"],
  ["Quelle öffnen", "Open source"],
  ["Aktuell geladen", "Currently loaded"],
  ["Zum Trainer", "To trainer"],
  ["Anhören", "Preview"],
  ["Bearbeiten", "Edit"],
  ["Löschen", "Delete"],
  ["Speichern", "Save"],
  ["Schließen", "Close"],
  ["Details", "Details"],
  ["Laden", "Load"],
  ["Bereit", "Ready"],
  ["Läuft", "Running"],
  ["Startet …", "Starting …"],
  ["Nicht unterstützt", "Unsupported"],
  ["Hört zu", "Listening"],
  ["geschätzt", "estimated"],
  ["gemessen", "measured"],
  ["manuell", "manual"],
  ["Meine", "Mine"],
  ["Üben", "Practice"],
  ["Stopp", "Pause"],
  ["Frei", "Free"],
  ["Pyramide", "Pyramid"],
  ["Einstellungen", "Settings"],
  ["Installieren", "Install"],
  ["Hauptnavigation", "Main navigation"],
  ["Mobile Hauptnavigation", "Mobile main navigation"],
  ["Drum-Trainer", "Drum trainer"],
  ["Drum-Groove-Trainer", "Drum groove trainer"],
  ["10 Minuten", "10 minutes"],
  ["5 Minuten", "5 minutes"],
  ["passend zu deinem Fokus", "matched to your focus"],
  ["Warm-up · Fokus · Neu", "Warm-up · Focus · New"],
  [" Kits verfügbar", " kits available"],
  [" von ", " of "],
  ["Genreübung", "Genre exercise"],
  ["Genreübergreifend", "Cross-genre"],
  ["Quellenbasierte Übungsrekonstruktion", "Source-based practice reconstruction"],
  ["Übungsrekonstruktion", "Practice reconstruction"],
  ["Eigene Übung", "Custom exercise"],
  ["Grundlagen", "Fundamentals"],
  ["Kernstimmen und Hauptakzente", "Core voices and main accents"],
  ["Vollständiges quantisiertes Pattern", "Complete quantized pattern"],
  ["Eine Stimme selbst übernehmen", "Take over one voice yourself"],
  ["Kontrollierte Tempo-Pyramide", "Controlled tempo pyramid"],
  ["Originalform", "Original form"],
  ["Tempoziel", "Tempo goal"],
  ["Abspielen", "Play"],
  ["Pattern bearbeiten", "Edit pattern"],
  ["Aktuelles Drum-Pattern", "Current drum pattern"],
  ["Leertaste: Start/Stop", "Space: Start/Stop"],
  ["Klang", "Sound"],
  ["Spielweise", "Feel"],
  ["Raster", "Grid"],
  ["Quantisiert", "Quantized"],
  ["Einen Schlag weniger", "One beat less"],
  ["Einen Schlag mehr", "One beat more"],
  ["Swing von null bis fünfzig Prozent", "Swing from zero to fifty percent"],
  ["Zeit & Ende", "Time & ending"],
  ["ohne Timer", "without timer"],
  ["Übemodus", "Practice mode"],
  ["Zufällige Lücken", "Random gaps"],
  ["Stimme ausblenden", "Voice dropout"],
  ["Automatisch schneller werden", "Increase tempo automatically"],
  ["Audio-Feedback umschalten", "Toggle audio feedback"],
  ["Tempo-Trainer umschalten", "Toggle tempo trainer"],
  ["Transienten direkt gegen das Soll-Raster", "Compare transients directly with the target grid"],
  ["Audio-Feedback", "Audio feedback"],
  ["Drumkit", "Drum kit"],
  ["Präzision · Synth", "Precision · Synth"],
  ["Stil", "Style"],
  ["Übungsart", "Practice type"],
  ["Drum-Break-Klassiker", "Classic drum breaks"],
  ["Technik", "Technique"],
  ["Puls", "Pulse"],
  ["Zu Favoriten hinzufügen", "Add to favorites"],
  ["Aus Favoriten entfernen", "Remove from favorites"],
  ["Leicht", "Easy"],
  ["Mittel", "Intermediate"],
  ["Fortgeschritten", "Advanced"],
  ["Achtel", "Eighths"],
  ["Achteln", "eighth notes"],
  ["Viertel", "Quarters"],
  ["16tel", "16ths"],
  ["Triolen", "Triplets"],
  ["Sextolen", "Sextuplets"],
  ["Takt", "Bar"],
  ["Schritt", "step"],
  ["Akzent", "accent"],
  ["Stille", "silence"],
  ["Schlag", "hit"],
  ["Eigenes Drum-Pattern", "Custom drum pattern"],
  ["von ", "of "],
];

const TRANSLATION_MAP = new Map(TRANSLATIONS);
const TRANSLATION_PATTERN = new RegExp(
  [...TRANSLATION_MAP.keys()]
    .sort((left, right) => right.length - left.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "g",
);

export function translateUiText(value: string, language: UiLanguage): string {
  if (language === "de" || !value.trim()) return value;
  return value.replace(TRANSLATION_PATTERN, (match) => TRANSLATION_MAP.get(match) || match);
}

export function localeFor(language: UiLanguage): string {
  return language === "en" ? "en-US" : "de-DE";
}

export function normalizeUiPreferences(value: Partial<UiPreferences> | null | undefined): UiPreferences {
  const themes: UiTheme[] = ["signal", "ultraviolet", "ember", "glacier", "mono"];
  const docks: TransportDock[] = ["left", "center", "right"];
  return {
    ...DEFAULT_UI_PREFERENCES,
    ...(value || {}),
    language: value?.language === "en" ? "en" : "de",
    theme: themes.includes(value?.theme as UiTheme) ? value!.theme as UiTheme : DEFAULT_UI_PREFERENCES.theme,
    density: value?.density === "compact" ? "compact" : "comfortable",
    scale: Math.max(90, Math.min(115, Math.round(Number(value?.scale) || 100))),
    transportDock: docks.includes(value?.transportDock as TransportDock) ? value!.transportDock as TransportDock : "right",
  };
}

type TranslationRecord = { source: string; rendered: string };

export function useUiLocalization(language: UiLanguage): void {
  const textRecordsRef = useRef(new WeakMap<Node, TranslationRecord>());
  const attributeRecordsRef = useRef(new WeakMap<Element, Map<string, TranslationRecord>>());

  useEffect(() => {
    document.documentElement.lang = language;
    const root = document.querySelector(".app-shell");
    if (!root) return;
    const attributeNames = ["aria-label", "title", "placeholder"];

    const translateTextNode = (node: Node) => {
      const current = node.nodeValue || "";
      const previous = textRecordsRef.current.get(node);
      const source = previous && current === previous.rendered ? previous.source : current;
      const rendered = translateUiText(source, language);
      textRecordsRef.current.set(node, { source, rendered });
      if (current !== rendered) node.nodeValue = rendered;
    };

    const translateElement = (element: Element) => {
      const records = attributeRecordsRef.current.get(element) || new Map<string, TranslationRecord>();
      for (const attribute of attributeNames) {
        const current = element.getAttribute(attribute);
        if (current === null) continue;
        const previous = records.get(attribute);
        const source = previous && current === previous.rendered ? previous.source : current;
        const rendered = translateUiText(source, language);
        records.set(attribute, { source, rendered });
        if (current !== rendered) element.setAttribute(attribute, rendered);
      }
      attributeRecordsRef.current.set(element, records);
    };

    const translateTree = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      if (node instanceof Element) translateElement(node);
      node.childNodes.forEach(translateTree);
    };

    translateTree(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateTextNode(mutation.target);
        else if (mutation.type === "attributes" && mutation.target instanceof Element) translateElement(mutation.target);
        else mutation.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributeNames });
    return () => observer.disconnect();
  }, [language]);
}

type IconName = "settings" | "close" | "play" | "pause" | "minus" | "plus";

export function InterfaceIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
    close: <path d="m7 7 10 10M17 7 7 17" />,
    play: <path d="m9 7 8 5-8 5z" fill="currentColor" stroke="none" />,
    pause: <><rect x="8" y="7" width="3" height="10" fill="currentColor" stroke="none" /><rect x="13" y="7" width="3" height="10" fill="currentColor" stroke="none" /></>,
    minus: <path d="M6 12h12" />,
    plus: <path d="M6 12h12M12 6v12" />,
  };
  return <svg className="interface-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">{paths[name]}</svg>;
}

function ToggleSetting({ checked, title, description, onChange }: { checked: boolean; title: string; description: string; onChange: (value: boolean) => void }) {
  return <button className={`ui-toggle-card ${checked ? "active" : ""}`} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
    <span><strong>{title}</strong><small>{description}</small></span><i aria-hidden="true"><b /></i>
  </button>;
}

export function SettingsOverlay({
  preferences, closeRef, onChange, onReset, onClose,
}: {
  preferences: UiPreferences;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onChange: (patch: Partial<UiPreferences>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const t = (de: string, en: string) => preferences.language === "de" ? de : en;
  return <div className="interface-settings-layer">
    <button className="interface-settings-backdrop" tabIndex={-1} onClick={onClose} aria-label={t("Interface-Einstellungen schließen", "Close interface settings")} />
    <section className="interface-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="interface-settings-title">
      <header>
        <div className="settings-heading-mark" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        <div><small>CONTROL SURFACE</small><h2 id="interface-settings-title">{t("Interface Studio", "Interface studio")}</h2><p>{t("Mach drumgrid zu deinem Instrument.", "Make drumgrid feel like your instrument.")}</p></div>
        <button ref={closeRef} className="interface-close" onClick={onClose} aria-label={t("Schließen", "Close")}><InterfaceIcon name="close" /></button>
      </header>

      <div className="interface-settings-scroll">
        <section className="settings-feature-intro">
          <div><small>{t("Live-Vorschau", "Live preview")}</small><strong>{THEMES.find((theme) => theme.id === preferences.theme)?.name}</strong><span>{preferences.density === "compact" ? t("Kompakt", "Compact") : t("Großzügig", "Comfortable")} · {preferences.scale}%</span></div>
          <div className="settings-preview-grid" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} className={index % 5 === 0 ? "accent" : index % 3 === 0 ? "ghost" : ""} />)}</div>
        </section>

        <section className="interface-setting-group">
          <div className="interface-group-title"><span>01</span><div><h3>{t("Farbwelt", "Color world")}</h3><p>{t("Fünf eigenständige Bühnen für dieselbe Maschine.", "Five distinct stages for the same machine.")}</p></div></div>
          <div className="theme-choice-grid">{THEMES.map((theme) => <button key={theme.id} className={`theme-choice theme-${theme.id} ${preferences.theme === theme.id ? "active" : ""}`} aria-pressed={preferences.theme === theme.id} onClick={() => onChange({ theme: theme.id })}><span className="theme-swatches" aria-hidden="true"><i /><i /><i /><i /></span><strong>{theme.name}</strong><small>{preferences.language === "de" ? theme.de : theme.en}</small></button>)}</div>
        </section>

        <div className="interface-settings-columns">
          <section className="interface-setting-group">
            <div className="interface-group-title"><span>02</span><div><h3>{t("Sprache & Maßstab", "Language & scale")}</h3><p>{t("Bedienoberfläche und Lesbarkeit.", "Interface language and readability.")}</p></div></div>
            <div className="ui-segmented" aria-label={t("Sprache", "Language")}><button className={preferences.language === "de" ? "active" : ""} onClick={() => onChange({ language: "de" })}>Deutsch</button><button className={preferences.language === "en" ? "active" : ""} onClick={() => onChange({ language: "en" })}>English</button></div>
            <div className="ui-scale-control"><span><strong>{t("UI-Größe", "UI size")}</strong><b>{preferences.scale}%</b></span><input type="range" min="90" max="115" step="5" aria-label={t("UI-Größe", "UI size")} value={preferences.scale} onChange={(event) => onChange({ scale: Number(event.target.value) })} /></div>
            <div className="ui-segmented" aria-label={t("Dichte", "Density")}><button className={preferences.density === "comfortable" ? "active" : ""} onClick={() => onChange({ density: "comfortable" })}>{t("Großzügig", "Comfortable")}</button><button className={preferences.density === "compact" ? "active" : ""} onClick={() => onChange({ density: "compact" })}>{t("Kompakt", "Compact")}</button></div>
          </section>

          <section className="interface-setting-group">
            <div className="interface-group-title"><span>03</span><div><h3>{t("Atmosphäre", "Atmosphere")}</h3><p>{t("Von ruhig und sachlich bis leuchtend und taktil.", "From calm and factual to vivid and tactile.")}</p></div></div>
            <div className="ui-toggle-grid">
              <ToggleSetting checked={preferences.texture} title={t("Oberflächentextur", "Surface texture")} description={t("Feine Studio-Körnung", "Fine studio grain")} onChange={(texture) => onChange({ texture })} />
              <ToggleSetting checked={preferences.beatGlow} title={t("Beat Glow", "Beat glow")} description={t("Aktive Schritte leuchten", "Active steps illuminate")} onChange={(beatGlow) => onChange({ beatGlow })} />
              <ToggleSetting checked={preferences.highContrast} title={t("Hoher Kontrast", "High contrast")} description={t("Härtere Kanten, hellere Schrift", "Sharper edges, brighter type")} onChange={(highContrast) => onChange({ highContrast })} />
              <ToggleSetting checked={preferences.reduceMotion} title={t("Bewegung reduzieren", "Reduce motion")} description={t("Animationen fast vollständig stoppen", "Stop almost all animation")} onChange={(reduceMotion) => onChange({ reduceMotion })} />
            </div>
          </section>
        </div>

        <div className="interface-settings-columns">
          <section className="interface-setting-group">
            <div className="interface-group-title"><span>04</span><div><h3>{t("Fokus", "Focus")}</h3><p>{t("Bestimme, wie viel Kontext du beim Spielen siehst.", "Choose how much context surrounds your playing.")}</p></div></div>
            <div className="ui-toggle-grid">
              <ToggleSetting checked={preferences.showCoach} title={t("Übecoach", "Practice coach")} description={t("Tagesplan und Offline-Status", "Daily plan and offline status")} onChange={(showCoach) => onChange({ showCoach })} />
              <ToggleSetting checked={preferences.showSpectrum} title={t("Spektrum", "Spectrum")} description={t("Live-Audioanzeige im Tempo-Bereich", "Live audio view in the tempo area")} onChange={(showSpectrum) => onChange({ showSpectrum })} />
            </div>
          </section>

          <section className="interface-setting-group transport-setting-group">
            <div className="interface-group-title"><span>05</span><div><h3>{t("Fliegender Transport", "Floating transport")}</h3><p>{t("Play/Pause und Tempo bleiben auf Desktop immer greifbar.", "Keep play/pause and tempo within reach on desktop.")}</p></div></div>
            <ToggleSetting checked={preferences.floatingTransport} title={t("Desktop-Dock anzeigen", "Show desktop dock")} description={t("Unterhalb des Inhalts schwebend", "Floating above the content")} onChange={(floatingTransport) => onChange({ floatingTransport })} />
            <div className="dock-position-picker" aria-label={t("Position des fliegenden Transports", "Floating transport position")}>
              {(["left", "center", "right"] as TransportDock[]).map((dock) => <button key={dock} disabled={!preferences.floatingTransport} className={preferences.transportDock === dock ? "active" : ""} onClick={() => onChange({ transportDock: dock })}><i aria-hidden="true"><b /></i><span>{dock === "left" ? t("Links", "Left") : dock === "center" ? t("Mitte", "Center") : t("Rechts", "Right")}</span></button>)}
            </div>
          </section>
        </div>
      </div>

      <footer><button className="interface-reset" onClick={onReset}>{t("UI zurücksetzen", "Reset UI")}</button><span>{t("Wird nur auf diesem Gerät gespeichert", "Saved only on this device")}</span><button className="interface-done" onClick={onClose}>{t("Fertig", "Done")}</button></footer>
    </section>
  </div>;
}

export function FloatingTransport({
  language, dock, isPlaying, bpm, patternName, onToggle, onNudge,
}: {
  language: UiLanguage;
  dock: TransportDock;
  isPlaying: boolean;
  bpm: number;
  patternName: string;
  onToggle: () => void;
  onNudge: (delta: number) => void;
}) {
  const t = (de: string, en: string) => language === "de" ? de : en;
  return <aside className={`floating-transport dock-${dock} ${isPlaying ? "playing" : ""}`} aria-label={t("Fliegender Wiedergabebereich", "Floating transport")}>
    <span className="floating-transport-status" aria-hidden="true"><i /></span>
    <div className="floating-transport-context"><small>{isPlaying ? t("Läuft", "Running") : t("Bereit", "Ready")}</small><strong>{patternName}</strong></div>
    <button className="floating-nudge" onClick={() => onNudge(-1)} aria-label={t("Tempo um eins verringern", "Decrease tempo by one")}><InterfaceIcon name="minus" /></button>
    <button className="floating-play" onClick={onToggle} aria-label={isPlaying ? t("Wiedergabe pausieren", "Pause playback") : t("Wiedergabe starten", "Start playback")} aria-pressed={isPlaying}><InterfaceIcon name={isPlaying ? "pause" : "play"} /><span>{isPlaying ? t("Pause", "Pause") : t("Start", "Play")}</span></button>
    <button className="floating-nudge" onClick={() => onNudge(1)} aria-label={t("Tempo um eins erhöhen", "Increase tempo by one")}><InterfaceIcon name="plus" /></button>
    <div className="floating-bpm"><strong>{bpm}</strong><span>BPM</span></div>
  </aside>;
}
