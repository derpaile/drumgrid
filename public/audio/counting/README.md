# Counting voice samples

These short English and German count syllables are generated locally with
[eSpeak NG](https://github.com/espeak-ng/espeak-ng) and normalized with FFmpeg.
They are original deterministic synthesizer output; no third-party recording is
redistributed. Regenerate them with `scripts/generate-counting-voice.sh`.

The implementation follows the proven approach used by the purpose-built
[Dance Count Metronome](https://github.com/masato5579/dance-count-metronom):
pre-rendered syllables scheduled on the Web Audio clock instead of live browser
speech synthesis. eSpeak NG itself is GPL-3.0-or-later licensed.
