# Klangmaß

Lokaler, adaptiver Übecoach mit 194 kuratierten Schlagzeugübungen sowie kompakten
Sample- und Synthese-Kits. Scenes halten Pattern, Klang und Trainingslogik zusammen;
Practice Results verbinden Weiterüben, Recap und nachvollziehbare Tagesempfehlungen.

## Enthalten

- Web-Audio-Scheduler mit Tempo, Taktart, Unterteilungen und Swing
- elf kompakte Sample-Kits plus ein vollständig prozedurales Präzisions-Kit mit Kick, Snare, Hats, Toms, Rim und Cymbals
- mehrspuriges Groove-Raster mit Ghostnotes und Akzenten
- pro Pattern umschaltbar zwischen quantisiertem Raster und belegtem Original-Feel mit Mikro-Timing/Dynamik
- Session-Start für freies Üben, 5-Minuten-Timing, 10-Minuten-Groove und Tempo-Pyramide
- Timer, Wiederholungen, Tempo-Trainer und aktive Übezeit ohne Hintergrundzeit
- optionale Echtzeit-Transientenanalyse per Mikrofon mit Raster-Markern, Session-Auswertung und kalibrierbarer Bluetooth-Latenzkorrektur
- automatische Lernleitern, Gap Click, zufällige Lücken, Voice Dropout und Call & Response
- normalisierte Skill-Taxonomie und Filter nach Ziel, Takt, Schwierigkeit, Tempo, Länge, Kit und Verlauf
- vollständige Scenes, „Weiterüben“, Session-Recap und lokal erklärtes „Heute für dich“
- breite Stilbibliothek von Jazz, Country und Gospel bis Progressive Metal, Afro-Karibik und Clubmusik
- Pattern-Editor mit mehreren Takten, Undo, Spur-Löschen sowie Import/Export
- Favoriten, Verlauf, eigene Patterns, Scenes und verlustfreie Migrationen in IndexedDB
- Tastatursteuerung (`Leertaste`, `T`, `+`, `-`) und optionaler MIDI-Start
- buildrevidiertes Asset-Manifest, atomare Updates, genauer Kit-Offline-Status, Wake Lock und mobile Navigation

## Lokal starten

```bash
npm install
npm run dev
```

Qualitätsprüfung: `npm run typecheck && npm run lint && npm test`

Optional setzt `NEXT_PUBLIC_SITE_URL` die öffentliche Basis-URL für Metadaten.
