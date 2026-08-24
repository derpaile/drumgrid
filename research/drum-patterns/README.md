# Geprüfte Drum-Pattern-Daten

## Ergebnis

- `../../public/data/patterns-v1.json`: 120 App-Patterns; darunter 22 klar als Rekonstruktion oder Reduktion bezeichnete Trip-Hop- und Hip-Hop-Presets, elf kostenlose MIDI-basierte Funk-/DnB-Ergänzungen und 35 eigenständige Stilübungen.
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
- Die drei bisher fehlenden kostenlosen Native-Instruments-Breaks `I Got You`, `Funky President` und `Come Dancing` wurden mit Velocity und Mikro-Timing ergänzt.
- Acht nicht redundante Simon-V-MIDI-Patterns erweitern Jungle und Drum and Bass; Tamburin- und Dirty-Hat-Spuren werden transparent auf vorhandene Beckenstimmen reduziert.
- 35 eigenständige Hip-Hop-, Funk- und DnB-Stilübungen vergrößern den Katalog ohne zusätzliche Songkopien oder kostenpflichtige Packs.

## Quantisiert und Original Feel

`originalFeel` speichert keine Zufallswerte, sondern quellenbezogene Abweichungen:

- `sourceBpm`: Tempo der Messung oder MIDI-Rekonstruktion.
- `timingMs`: frühe oder späte Einsätze je Stimme und Schritt.
- `velocityMultipliers`: optionale Dynamikunterschiede je Stimme und Schritt.

Die App skaliert Millisekundenwerte proportional zum eingestellten Tempo. „Quantisiert“ ignoriert diesen Layer; „Original Feel“ aktiviert ihn. Der Schalter ist nur verfügbar, wenn belastbare Mess- oder MIDI-Daten hinterlegt sind. Aktuell betrifft das `Funky Drummer`, `Think`, `Apache`, `Impeach the President`, `Ashley’s Roachclip`, `It’s a New Day`, `Express Yourself`, `Cissy Strut` und den aus einem lokal bereitgestellten Drum-Stem gemessenen Eintakt-Loop von `High Noon`.

## Genauigkeitsgrenze

Das Modell besitzt neun Drumspuren, aber keine getrennte Fuß-Hi-Hat, Cowbell, Tamburin oder Bongos. Solche Ensembleanteile werden nicht auf falsche Drumstimmen umgedeutet, sondern in der jeweiligen Anleitung als ausgelassen oder ersetzt bezeichnet. „Rekonstruktion“ bezeichnet eine quellenbasierte Notenfolge; „Reduktion“ und „Stilübung“ erheben keinen Anspruch auf eine vollständige Originalstimme.

## Zentrale Referenzen

- [ZGMTH: Microtiming in Early Funk](https://www.gmth.de/zeitschrift/artikel/1224.aspx): Noten und gemessene Millisekundenwerte für `Think`, `Impeach`, `Apache`, `Cissy Strut` und `It’s a New Day`.
- [University of Hull: Rebecoming Analogue](https://hull-repository.worktribe.com/output/4218015): Break-Formen, Ghostnotes und Drummer-Zuschreibungen, unter anderem John „Jabo“ Starks.
- [Native Instruments: Drum-Break-Rekonstruktionen und MIDI](https://blog.native-instruments.com/best-drum-breaks/): `Funky Drummer`, `Ashley’s Roachclip` und `Express Yourself`.
- [Simon V: Drum & Bass Patterns](https://www.simonv.com/tutorials/drum_patterns.php): freie MIDI-Vorlagen für acht ergänzende DnB- und Jungle-Übungen.
- [Goodhertz: Synthetic Substitution](https://goodhertz.com/funklet/synthetic-substitution/): zweitaktige Noten- und Dynamikfolge.
- [International Audio Laboratories Erlangen: Amen Break](https://www.audiolabs-erlangen.de/resources/MIR/2016-IEEE-TASLP-DrumSeparation/AmenBreak): viertaktige Form und Instrumentzerlegung.
- [DrumsTheWord: Famous Drum Beats eBook](https://www.drumstheword.com/digital-media/Downloads/FamousDrumBeats_eBook.pdf): detaillierte Bonham-Notationen.
- [DRUM!: Vinnie Colaiuta on Seven Days](https://drummagazine.com/lesson-vinnie-colaiuta-on-stings-seven-days/): 5/4-Kern und zweitaktiger Hi-Hat-Akzentzyklus.
- [Hudson Music: The Breakbeat Bible sampler](https://hudsonmusic.com/wp-content/uploads/2015/03/Breakbeat-Bible-Sampler.pdf): viertaktiges `Take Me to the Mardi Gras`-Intro bei ungefähr 104 BPM.
- [Bonedo: Glory Box Drum-Workshop](https://www.bonedo.de/artikel/portishead-glory-box-auf-dem-schlagzeug-lernen-mit-noten-audios/) und [DrumsTheWord: Sour Times](https://www.drumstheword.com/pdf/FamousDrumBeats_eBook.pdf): Portishead-Tempo, Viertaktformen, Ghostnotes, Kick- und Hi-Hat-Details.
- [One Song: Teardrop](https://podscripts.co/podcasts/one-song/massive-attacks-teardrop) und [Sound On Sound: Mezzanine](https://www.soundonsound.com/techniques/how-got-sound-neil-davidge): Loop-Herkunft, Zusatz-Kick sowie die später zugeschaltete Double-Time-Version durch den MPC-Delay.
- [DJ Premier über N.Y. State of Mind](https://djpremierblog.com/2011/02/19/dj-premier-tells-all-the-stories-behind-his-classic-records/) und [Pete Rock über The World Is Yours](https://www.complex.com/music/a/daniel-isenberg/interview-pete-rock-classics): Produktions- und Groove-Kontext der Nas-Presets.
- [Song Exploder: Shook Ones Pt. II](https://songexploder.net/transcripts/mobb-deep-transcript.pdf) und [Complex: The Making of The Infamous](https://www.complex.com/music/a/insanulahmed/the-making-of-mobb-deep-the-infamous): Havocs Drumloop sowie Q-Tips Überarbeitung des Mobb-Deep-Sounds.
- [Groove: Kruder & Dorfmeister Zeitgeschichte](https://groove.de/2014/11/10/zeitgeschichten-kruder-und-dorfmeister/2/) und [Beatport: K&D-Tempi](https://www.beatport.com/artist/kruder-dorfmeister/52461/tracks): Produktionskontext und Referenztempi der beiden Downtempo-Stilreduktionen.
- [Tufts University: DJ Shadows MPC-Breakanalyse](https://dl.tufts.edu/downloads/t722hn50h?filename=bk128p23q.pdf) und [Sound On Sound: Midnight in a Perfect World](https://www.soundonsound.com/techniques/classic-tracks-dj-shadow-midnight-perfect-world): Zweitakt-Break, Chopping und dynamisch variierende MPC-Programmierung.
- [Sound On Sound: Tricky](https://www.soundonsound.com/techniques/classic-tracks-tricky-black-steel), [The Guardian: Safe From Harm](https://www.theguardian.com/music/musicblog/2009/feb/26/sampling-epiphany-massive-attack) und [MusicRadar: Morcheeba](https://www.musicradar.com/news/tech/classic-album-morcheeba-on-big-calm-601271): Bristol-Samplekontext sowie die Ausgangsloops von `Safe From Harm` und `The Sea`.
- [DrumsTheWord: 6 Underground](https://www.drumstheword.com/pdf/SneakerPimps_6Underground.pdf): vollständige Drum Chart bei 84 BPM mit durchgehend geshuffelten Sechzehnteln.
- [Larry Smith über Sucker M.C.'s](https://medium.com/@briancoleman/larry-smith-q-a-january-2006-229fd9bd8e91), [Sound On Sound: Planet Rock](https://www.soundonsound.com/techniques/classic-tracks-afrika-bambaataa-soulsonic-force-planet-rock) und [Roland: Paul Revere](https://articles.roland.com/paul-revere-beastie-boys/): DMX-Minimalismus, früher TR-808-Electro und der rückwärts aufgenommene Beastie-Boys-Beat.
- [BeatTips: Mass Appeal](https://beattips.com/check-this-gang-starr-mass-appeal-2/) und [Beat Production: Boom-Bap-Grooves](https://beatproduction.net/the-beginners-guide-to-making-boom-bap-drum-beats/): Kick-Synkopen, Hat-Swing und Percussion-Kerne von Gang Starr, A Tribe Called Quest und Wu-Tang Clan.

## Reproduzieren und prüfen

```sh
npm run patterns:generate
node scripts/build-reviewed-drum-patterns.mjs
node scripts/build-reviewed-drum-patterns.mjs --check
```
