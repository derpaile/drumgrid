# Klangmaß

Installierbarer Drum-Groove-Trainer mit 47 kuratierten Schlagzeugübungen und
synthetischen Drumkits. Die App funktioniert ohne Konto und nach dem ersten
Aufruf vollständig offline. Songbezogene Grooves sind als Übungsrekonstruktion
gekennzeichnet; Genreübungen geben keine falsche Transkriptionsgenauigkeit vor.

## Enthalten

- Web-Audio-Scheduler mit Tempo, Taktart, Unterteilungen und Swing
- synthetische Drumkits mit Kick, Snare, Hats, Toms, Rim und Crash
- mehrspuriges Groove-Raster mit Ghostnotes und Akzenten
- Session-Start für freies Üben, 5-Minuten-Timing, 10-Minuten-Groove und Tempo-Pyramide
- Count-in, Timer, Wiederholungen, Tempo-Trainer und Übeverlauf
- Lernpfade und Filter nach Ziel, Takt, Schwierigkeit und Unterteilung
- Pattern-Editor mit mehreren Takten, Undo, Spur-Löschen sowie Import/Export
- Favoriten, Verlauf und eigene Presets in IndexedDB
- Tastatursteuerung (`Leertaste`, `T`, `+`, `-`) und optionaler MIDI-Start
- robuste Offline-Installation, Update-Hinweis, Wake Lock und mobile Navigation

## Lokal starten

```bash
npm install
npm run dev
```

Qualitätsprüfung: `npm run typecheck && npm run lint && npm test`

Optional setzt `NEXT_PUBLIC_SITE_URL` die öffentliche Basis-URL für Metadaten.
