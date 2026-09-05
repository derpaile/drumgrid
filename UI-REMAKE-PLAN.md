# drumgrid: UI-Remake fürs Drumset

Entwurf vom 05.09.2026. Grundlage: aktueller Projektstand und Ansicht der veröffentlichten App bei 390 × 844 CSS-Pixeln. Noch keine Änderung an der App. Die Zahlen unten sind Entwurfsziele; die Bedienung aus Sitzposition muss am echten iPhone geprüft werden.

## Entscheidung

Die mobile Startseite wird ein **Übepult**: aktuelles Pattern, großes Tempo, klarer Puls und große Spieltasten. Winamp bleibt durch Metallrahmen, dunkle Displays, grüne Ziffern, bernsteinfarbene Markierungen und fühlbar gestaltete Tasten erkennbar. Mehr Fläche und weniger gleichzeitig sichtbare Funktionen schaffen Übersicht.

Annahme: Das iPhone steht oder liegt in Reichweite am Drumset. Ein kurzer Blick und ein grober Fingertipp müssen für die häufigsten Handlungen reichen. Hochformat ist der Ausgangspunkt; Querformat erhält eine eigene Anordnung.

## Was aktuell stört

| Befund | Konsequenz |
| --- | --- |
| Coach und Offline-Karte stehen vor dem Player | Beim Einstieg geht Platz für Tempo und Pattern verloren. |
| „Üben“, „Patterns“, „Meine“ scrollen durch dieselbe lange Seite | Bereiche haben keine klare Grenze; die Orientierung hängt von der Scrollposition ab. |
| Tempoanzeige mobil etwa 35 px Schrift; +/- meist 42 × 44 px | Für den Blick und Griff vom Drumset zu klein. |
| Pattern-Tasten mindestens 24 × 28 px; Spurenregler 12 px hoch | Präzises Treffen nötig, versehentliche Änderungen möglich. |
| Übeprogramm, Lernleiter, Übemodus und Tempo-Trainer sind verstreut | Die Antwort auf „Was übe ich gerade?“ ist schwer erkennbar. |
| Viele Rahmen, Farben, Beschriftungen und Animationen konkurrieren | Wichtige Werte heben sich zu wenig ab. |

Die untere Starttaste ist mit 72 × 78 px bereits größer. Ihr Problem ist vor allem die Einbettung zwischen vier Navigationszielen. Deshalb braucht es eine neue Hierarchie und eine eigene Spielleiste.

## Neue Aufteilung

**Üben:** Standard beim Öffnen. Letztes Pattern mit seinen Einstellungen ist bereit; Wiedergabe startet bewusst per Tastendruck. Eine kurze Zeile bietet bei Bedarf das Fortsetzen einer unterbrochenen Session an.

**Patterns:** Suche, Favoriten und zuletzt verwendete Patterns zuerst. Danach eine Winamp-artige Playlist mit gut lesbaren Zeilen: Name, Stil, Takt und Tempo. Details und Lernhinweise öffnen sich erst bei Auswahl. Filter bleiben beim Zurückkehren erhalten. Laden und Anhören sind eindeutig beschriftete Handlungen; ein laufendes Training darf beim bloßen Durchstöbern nicht ersetzt werden.

**Sammlung:** gespeicherte Übesets (bisher „Scenes“), eigene Patterns und Verlauf. Backup und Datenverwaltung in einen untergeordneten Bereich verschieben. Die Bezeichnung kann sich ändern, gespeicherte Daten bleiben kompatibel.

**Setup:** ein gut erreichbarer Knopf im Kopfbereich für Darstellung, Sprache, Offline-Daten und Geräte. Musikalische Einstellungen liegen direkt bei der Übung.

Die drei Hauptbereiche wechseln tatsächlich die Ansicht. Wiedergabe und Session bleiben dabei bestehen. Außerhalb von „Üben“ bleibt eine kompakte Spielleiste mit aktuellem Pattern, BPM und großer Start/Stopp-Taste sichtbar.

## Aufbau der Spielansicht

Reihenfolge von oben nach unten, schematisch:

```text
drumgrid                          Setup

Rock-Backbeat                  Wechseln
4/4 · Achtel · Freies Üben

                 092
                 BPM

          [1]   2    3    4
       Takt 12 · freie Session

        [ − ]  [ TAP ]  [ + ]

       [       START       ]

       [ Klang ]  [ Übung ]

       Üben   Patterns   Sammlung
```

- BPM zunächst 80–96 px, Patternname 22–24 px, wichtige Beschriftungen 16–18 px. Schriftgrößen an verfügbaren Platz und Vergrößerung anpassen.
- Minus, TAP und Plus mindestens 64 px hoch; Start/Stopp über die verfügbare Breite, 80–96 px hoch. Zwischen benachbarten Haupttasten 10–12 px Abstand.
- +/- ändert um einen BPM. Halten wiederholt kontrolliert und endet beim Loslassen, Abbruch oder Verlassen der Taste. BPM antippen öffnet die direkte Eingabe; dort auch explizit ±5. Den langen Temporegler aus der Hauptansicht entfernen.
- Start wird während der Wiedergabe zu eindeutig beschriftetem Stopp mit passendem Symbol. Position und Größe bleiben unverändert. Kein zusätzliches Pause-Verhalten im ersten Umbau; bestehende Sessionlogik beibehalten.
- Der Puls folgt den tatsächlichen Schlägen. Erster Schlag klar markiert; bei ungeraden und zusammengesetzten Takten sinnvolle Gruppierung plus aktuelle Zählzeit. Keine feste Annahme von vier Schlägen.
- Laufzeit bzw. Restzeit und aktive Übungsphase stehen in einer ruhigen Statuszeile. Bei Gap Click ausdrücklich „Stille · 1/1“ anzeigen, damit eine Übungspause nicht wie ein Fehler wirkt.
- Auf kleinen Höhen reduziert sich zuerst die ergänzende Patternvorschau. Tempo und Spieltasten bleiben erreichbar. Bei stark vergrößerter Schrift darf Inhalt scrollen; Tasten werden dafür nicht verkleinert.

## Funktionen gezielt öffnen

**Klang** öffnet einen von unten kommenden Bereich mit Gesamtlautstärke und Kit-Auswahl; den Mixer erreicht man von dort. Pro Stimme große Lautstärkeregler, Stumm und Solo. Die Hauptansicht zeigt den aktuellen Klangzustand knapp an.

**Übung** bündelt freie Session, Timing, Groove, Pyramide, Lernstufe, Gap Click und Zeitlimit. Zuerst verständliche Auswahl, anschließend nur die dazugehörigen Parameter. Bestehende Kombinationen bleiben möglich und werden gemeinsam zusammengefasst, etwa „Pyramide 80–110 · Gap 3/1 · 10 Min.“. Empfehlungen wandern ebenfalls hierhin. Aktives Audio-Feedback bekommt eine kompakte Anzeige; Analyse und Kalibrierung stehen im Detailbereich.

Alle geöffneten Bereiche haben eine große Schließen-/Fertig-Taste, klare Überschrift und nachvollziehbares Zurück-Verhalten. Die laufende Wiedergabe bleibt kontrollierbar. Stoppen muss auch aus einem geöffneten Einstellbereich möglich sein.

**Pattern bearbeiten** wird eine eigene Bearbeitungsansicht. Die normale Patternvorschau ist lesend; Berühren verändert keine Schläge. Mobil eine Stimme und einen Ausschnitt bearbeiten, mit Taktübersicht und deutlich beschrifteter Abschnittswahl. Maximal so viele Schritte nebeneinander zeigen, wie mit mindestens 48 × 48 px hineinpassen; bei Bedarf vier oder acht Schritte je Abschnitt. Instrument und Schlagzustand erhalten explizite Auswahlen. Rückgängig und Speichern bleiben sichtbar. Desktop darf weiterhin mehrere Spuren gleichzeitig zeigen.

## Gestaltung

- Drei dominante Flächen: dunkler Hintergrund, metallisches Gehäuse, schwarzes Display. Große Rahmen trennen Bereiche; kleine Rahmen nur an echten Bedienelementen.
- Grün für Tempo und aktive Wiedergabe, Bernstein für Akzent und Übungsphase. Farbe immer mit Text oder Form kombinieren. Vorhandene Themes übertragen dieselbe Hierarchie.
- Retro-Schrift für Logo und kurze Bereichstitel, klare Alltagsschrift für Namen, Hinweise und Bedienung; Ziffern mit gleichbleibender Breite für BPM und Zeit.
- Spektrumanzeige als optionales kleines Detail. Der musikalisch relevante Puls erhält den Platz und die Aufmerksamkeit.
- Dichte- und Skaleneinstellungen dürfen die Mindestgröße mobiler Haupttasten nicht unterschreiten.
- Optional später: ausdrücklich einschaltbare Fokusansicht mit noch größeren Zahlen und Tasten, auch im Querformat. Die normale Ansicht muss bereits am Set funktionieren; kein automatischer Layoutwechsel beim Start.

## Umsetzung in drei Paketen

1. **Übepult und Navigation:** echte getrennte Ansichten, Tempo/Puls/Spielleiste, Coach und Offline-Karten umziehen, kompakte laufende Wiedergabe in den anderen Bereichen. Größter unmittelbarer Nutzen.
2. **Klang, Übung und Playlist:** Einstellungen bündeln, große Auswahlflächen, übersichtliche Patternzeilen, konsistente Beschriftungen und Zustände.
3. **Bearbeitung und Feinschliff:** mobile Schrittbearbeitung, Sammlung, Querformat, optionale Fokusansicht und Anpassung aller Themes.

Vor Paket 1 einen maßstäblichen klickbaren Entwurf für Spielansicht, Patternwechsel und Übungsauswahl erstellen. Bestehende Audioengine, Offline-Funktion und Datenhaltung weiterverwenden. Änderungen an der Oberfläche von Audio- und Sessionzustand trennen, damit Ansichtswechsel keine Neustarts auslösen.

## Abschließende Abnahme

- Bei 390 × 844 und 375 × 667 px: Patternname, BPM, Puls, +/- und Start/Stopp ohne Seitensuche erreichbar; Safari-Leisten und geschützte Bildschirmränder berücksichtigen. Bei 320 px und vergrößerter Schrift kein Abschneiden wichtiger Bedienelemente.
- Querformat mit geringer Höhe: Anzeige und Bedienung nebeneinander. Keine reine Verkleinerung der Hochformatansicht.
- Am tatsächlichen Drumset: BPM und Wiedergabestatus aus normaler Sitzposition erkennen, Start/Stopp und +/- wiederholt ohne Fehlgriff treffen. Dieses Ergebnis entscheidet über die endgültigen Größen.
- Letztes Pattern mit einem Tipp starten; Tempo um einen BPM mit einem Tipp ändern; Favoriten mit höchstens drei gezielten Tipps laden.
- Ansicht wechseln, Einstellungen öffnen und schließen: Tempo, Pattern und laufendes Audio bleiben erhalten. Stopp ist jederzeit erreichbar; Dialoge lassen sich auch mit Tastatur schließen.
- Normales Berühren der Vorschau verändert kein Pattern. Bearbeitungsänderungen lassen sich rückgängig machen. Lange Namen, 7/8, Mehrtakt-Patterns und dichtes Raster prüfen.
- Bestehende Funktionsprüfungen am Ende gemeinsam ausführen; gezielt Audio, Sessionfortsetzung, lokale Daten und Offlinebetrieb nach dem Umbau prüfen.

Als Orientierung nennt WCAG 2.2 für das erweiterte Zielgrößen-Kriterium 44 × 44 CSS-Pixel und empfiehlt bei häufigen oder schwer erreichbaren Aktionen größere Flächen. Die hier vorgeschlagenen 64–96 px sind eine eigene Entscheidung für die Nutzung am Drumset. Quelle: [W3C: Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).
