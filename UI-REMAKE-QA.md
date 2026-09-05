# UI-Remake: Abschlussprüfung

05.09.2026 · lokale Vorschau: http://localhost:3017

- TypeScript, Lint, Produktionsbuild und alle 30 Tests erfolgreich.
- Keine offenen Browserfehler in der frischen Vorschau.
- Geprüfte Bildschirmgrößen (CSS-Pixel): 320 × 666, 375 × 666, 390 × 844, 844 × 390 und 1280 × 900. Kein horizontaler Seitenüberlauf.
- Bei 390 × 844: Starttaste 80 px hoch, Unterkante bei 528 px; Navigation beginnt bei 778 px. Tempo und Spieltasten vollständig sichtbar.
- Fokusansicht: 112 px große BPM-Ziffern und 100 px hohe Starttaste auf dem iPhone-Layout.
- Desktop: Anzeige und Spieltasten nebeneinander, Starttaste 96 px hoch.
- Plus-Taste, direkte Tempoeingabe und Tastaturbedienung geprüft.
- Laufendes Audio beim Wechsel zwischen Üben und Patterns erhalten; 120 BPM unverändert.
- Stopp im Klangdialog, Solo-Auswahl, Dialog-Schließen und Fokus-Rückgabe geprüft.
- Mobile Schrittbearbeitung: Akzent setzen, Rückgängig und Abschnittswechsel geprüft.
- 7/8-Takt: sieben Zählzeiten sichtbar, kein Überlauf; Gap-Übung auswählbar.
- Suche bleibt beim Ansichtswechsel erhalten. Filterdialog mit Escape geschlossen; Fokus kehrt zur auslösenden Taste zurück.
- Englisch und Glacier-Theme geprüft, danach Deutsch und Signal wiederhergestellt.
- Letzte Session nach Neuladen mit gespeichertem Tempo wieder bereit; kein automatischer Audiostart.

Die Prüfung erfolgte im Browser mit angepassten Bildschirmmaßen. Reale Griffweite, Lesbarkeit aus Sitzposition und iPhone-Audio/Mikrofon müssen am Gerät beurteilt werden. Ein echter Offline-Durchlauf war nicht Bestandteil der Browserprüfung; vorhandene PWA- und Asset-Prüfungen sind erfolgreich. Entwicklungsansichten registrieren keinen neuen Offline-Cache, damit alte Oberflächen die Vorschau nicht verfälschen.
