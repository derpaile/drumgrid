#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output_dir="$project_dir/public/audio/counting"
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

generate() {
  language=$1
  voice=$2
  filename=$3
  phrase=$4
  mkdir -p "$output_dir/$language"
  espeak-ng -v "$voice" -s 205 -p 52 -a 150 -w "$temp_dir/$filename.wav" "$phrase"
  ffmpeg -hide_banner -loglevel error -y -i "$temp_dir/$filename.wav" \
    -af "silenceremove=start_periods=1:start_threshold=-48dB:stop_periods=-1:stop_threshold=-48dB,highpass=f=90,lowpass=f=9500,acompressor=threshold=-20dB:ratio=2.5:attack=4:release=45,alimiter=limit=0.88,apad=pad_dur=0.018" \
    -ar 44100 -ac 1 -codec:a libmp3lame -q:a 5 "$output_dir/$language/$filename.mp3"
}

english_words="one:one two:two three:three four:four five:five six:six seven:seven eight:eight nine:nine ten:ten eleven:eleven twelve:twelve thirteen:thirteen fourteen:fourteen fifteen:fifteen sixteen:sixteen and:and e:ee a:uh trip:trip let:let"
german_words="eins:eins zwei:zwei drei:drei vier:vier fuenf:fünf sechs:sechs sieben:sieben acht:acht neun:neun zehn:zehn elf:elf zwoelf:zwölf dreizehn:dreizehn vierzehn:vierzehn fuenfzehn:fünfzehn sechzehn:sechzehn und:und e:e a:a ta:ta la:la"

for item in $english_words; do
  generate en en-us+m3 "${item%%:*}" "${item#*:}"
done
for item in $german_words; do
  generate de de+m3 "${item%%:*}" "${item#*:}"
done

printf 'Generated counting voice samples in %s\n' "$output_dir"
