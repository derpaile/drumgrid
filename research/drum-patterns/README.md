# Geprüfte Drum-Pattern-Daten

## Ergebnis

- `generated/reviewed-drum-patterns-v1.json`: 54 eindeutige, geprüfte Patterns.
- `reviewed-drum-patterns-v1.schema.json`: JSON-Schema inklusive optionalem `originalFeel`.
- `original/`: unveränderte DeepSeek-Exporte zur Nachvollziehbarkeit.
- `../../scripts/build-reviewed-drum-patterns.mjs`: reproduzierbarer Generator und alle Korrekturen.
- `../../scripts/generate-patterns.mjs`: App-Katalog; belegte Breaks besitzen dort ebenfalls korrigierte Noten und Feel-Daten.

## Wesentliche Prüfergebnisse

- Generische Backbeat-Schablonen wurden ersetzt: insbesondere `think-break`, `apache-break`, `impeach-the-president`, `synthetic-substitution`, `ashleys-roachclip`, `its-a-new-day`, `express-yourself` und `cissy-strut`.
- `Think` besitzt im gewählten Break-Takt nur die Kick auf Beat 1. `Impeach the President` enthält die Kicks auf 2a, 3, 3& und 4&. `It’s a New Day` bildet beide dokumentierten Takte ab.
- `Synthetic Substitution`, `Ashley’s Roachclip`, `Express Yourself` und `Funky Drummer` sind jetzt zweitaktig statt auf einen unzutreffenden Eintakt-Loop verkürzt.
- `Seven Days` wurde auf einen zweitaktigen 5/4-Kern mit Hi-Hat-Akzentzyklus korrigiert. `Good Times Bad Times` nutzt für die Kicktechnik ein Sechstel- statt Triolenraster.
- `When the Levee Breaks`, `Immigrant Song` und `Rock and Roll` wurden gegen detaillierte Bonham-Notationen korrigiert.
- Cuban Bolero nutzt ein gerades Sechzehntelraster statt der unbelegten Triolenfassung.
- `Hot Pants (Bonus Beats)` und `God Made Me Funky` sind transparent als Stilreduktion bzw. Stilübung bezeichnet; es wird keine nicht belegte Volltranskription behauptet.
- Vier inhaltliche Duplikate sowie unbelegbare Superlative, Sampling-Zahlen und kaputte `[reference:n]`-Marker wurden entfernt.

## Quantisiert und Original Feel

`originalFeel` speichert keine Zufallswerte, sondern quellenbezogene Abweichungen:

- `sourceBpm`: Tempo der Messung oder MIDI-Rekonstruktion.
- `timingMs`: frühe oder späte Einsätze je Stimme und Schritt.
- `velocityMultipliers`: optionale Dynamikunterschiede je Stimme und Schritt.

Die App skaliert Millisekundenwerte proportional zum eingestellten Tempo. „Quantisiert“ ignoriert diesen Layer; „Original Feel“ aktiviert ihn. Der Schalter ist nur verfügbar, wenn belastbare Mess- oder MIDI-Daten hinterlegt sind. Aktuell betrifft das `Funky Drummer`, `Think`, `Apache`, `Impeach the President`, `Ashley’s Roachclip`, `It’s a New Day`, `Express Yourself` und `Cissy Strut`.

## Genauigkeitsgrenze

Das Modell besitzt neun Drumspuren, aber keine getrennte Fuß-Hi-Hat, Cowbell, Tamburin oder Bongos. Solche Ensembleanteile werden nicht auf falsche Drumstimmen umgedeutet, sondern in der jeweiligen Anleitung als ausgelassen oder ersetzt bezeichnet. „Rekonstruktion“ bezeichnet eine quellenbasierte Notenfolge; „Reduktion“ und „Stilübung“ erheben keinen Anspruch auf eine vollständige Originalstimme.

## Zentrale Referenzen

- [ZGMTH: Microtiming in Early Funk](https://www.gmth.de/zeitschrift/artikel/1224.aspx): Noten und gemessene Millisekundenwerte für `Think`, `Impeach`, `Apache`, `Cissy Strut` und `It’s a New Day`.
- [University of Hull: Rebecoming Analogue](https://hull-repository.worktribe.com/output/4218015): Break-Formen, Ghostnotes und Drummer-Zuschreibungen, unter anderem John „Jabo“ Starks.
- [Native Instruments: Drum-Break-Rekonstruktionen und MIDI](https://blog.native-instruments.com/best-drum-breaks/): `Funky Drummer`, `Ashley’s Roachclip` und `Express Yourself`.
- [Goodhertz: Synthetic Substitution](https://goodhertz.com/funklet/synthetic-substitution/): zweitaktige Noten- und Dynamikfolge.
- [International Audio Laboratories Erlangen: Amen Break](https://www.audiolabs-erlangen.de/resources/MIR/2016-IEEE-TASLP-DrumSeparation/AmenBreak): viertaktige Form und Instrumentzerlegung.
- [DrumsTheWord: Famous Drum Beats eBook](https://www.drumstheword.com/digital-media/Downloads/FamousDrumBeats_eBook.pdf): detaillierte Bonham-Notationen.
- [DRUM!: Vinnie Colaiuta on Seven Days](https://drummagazine.com/lesson-vinnie-colaiuta-on-stings-seven-days/): 5/4-Kern und zweitaktiger Hi-Hat-Akzentzyklus.
- [Hudson Music: The Breakbeat Bible sampler](https://hudsonmusic.com/wp-content/uploads/2015/03/Breakbeat-Bible-Sampler.pdf): viertaktiges `Take Me to the Mardi Gras`-Intro bei ungefähr 104 BPM.

## Reproduzieren und prüfen

```sh
npm run patterns:generate
node scripts/build-reviewed-drum-patterns.mjs
node scripts/build-reviewed-drum-patterns.mjs --check
```
