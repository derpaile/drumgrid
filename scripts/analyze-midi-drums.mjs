import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function vlq(buffer, cursor) {
  let value = 0;
  let byte;
  do {
    byte = buffer[cursor.offset++];
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return value;
}

export function parseMidi(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "MThd") throw new Error("Missing MIDI header");
  const headerLength = buffer.readUInt32BE(4);
  const division = buffer.readUInt16BE(12);
  if (division & 0x8000) throw new Error("SMPTE timing is not supported");
  const trackCount = buffer.readUInt16BE(10);
  const notes = [];
  const tempos = [];
  const meters = [];
  const trackNames = [];
  let offset = 8 + headerLength;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
    if (buffer.toString("ascii", offset, offset + 4) !== "MTrk") throw new Error(`Missing track ${trackIndex}`);
    const length = buffer.readUInt32BE(offset + 4);
    const end = offset + 8 + length;
    const cursor = { offset: offset + 8 };
    let tick = 0;
    let runningStatus = null;
    while (cursor.offset < end) {
      tick += vlq(buffer, cursor);
      let status = buffer[cursor.offset];
      if (status & 0x80) {
        cursor.offset++;
        if (status < 0xf0) runningStatus = status;
      } else if (runningStatus !== null) {
        status = runningStatus;
      } else {
        throw new Error(`Invalid running status in track ${trackIndex}`);
      }

      if (status === 0xff) {
        const type = buffer[cursor.offset++];
        const size = vlq(buffer, cursor);
        const start = cursor.offset;
        if (type === 0x03) trackNames[trackIndex] = buffer.toString("utf8", start, start + size).replace(/\0/g, "").trim();
        if (type === 0x51 && size === 3) tempos.push({ tick, micros: buffer.readUIntBE(start, 3) });
        if (type === 0x58 && size >= 2) meters.push({ tick, numerator: buffer[start], denominator: 2 ** buffer[start + 1] });
        cursor.offset += size;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        cursor.offset += vlq(buffer, cursor);
        continue;
      }

      const command = status >> 4;
      const channel = status & 0x0f;
      const data1 = buffer[cursor.offset++];
      const data2 = command === 0xc || command === 0xd ? null : buffer[cursor.offset++];
      if (command === 0x9 && data2 > 0) notes.push({ tick, channel, note: data1, velocity: data2, trackIndex });
    }
    offset = end;
  }
  return { division, notes, tempos, meters, trackNames };
}

const voices = new Map([
  [35, "kick"], [36, "kick"], [37, "rim"], [38, "snare"], [40, "snare"],
  [41, "lowTom"], [43, "lowTom"], [45, "lowTom"], [47, "highTom"], [48, "highTom"], [50, "highTom"],
  [42, "closedHat"], [44, "closedHat"], [46, "openHat"],
  [49, "crash"], [52, "crash"], [55, "crash"], [57, "crash"], [51, "ride"], [53, "ride"], [59, "ride"],
]);

function velocityState(velocity) {
  if (velocity < 55) return "ghost";
  if (velocity >= 105) return "accent";
  return "normal";
}

export function analyzeMidiDrums(parsed) {
  const drumNotes = parsed.notes.filter((note) => note.channel === 9 && voices.has(note.note));
  const meterChanges = parsed.meters.length ? parsed.meters : [{ tick: 0, numerator: 4, denominator: 4 }];
  if (meterChanges[0].tick !== 0) meterChanges.unshift({ tick: 0, numerator: 4, denominator: 4 });
  const changes = meterChanges
    .filter((meter, index, all) => index === all.findIndex((candidate) => candidate.tick === meter.tick))
    .sort((a, b) => a.tick - b.tick);
  const bars = [];
  const lastTick = Math.max(0, ...drumNotes.map((note) => note.tick));
  for (let changeIndex = 0; changeIndex < changes.length; changeIndex++) {
    const meter = changes[changeIndex];
    const segmentEnd = changes[changeIndex + 1]?.tick ?? lastTick + parsed.division * 8;
    const barTicks = parsed.division * meter.numerator * 4 / meter.denominator;
    if (!Number.isInteger(barTicks)) continue;
    for (let start = meter.tick; start < segmentEnd; start += barTicks) {
      bars.push({ index: bars.length + 1, start, end: Math.min(start + barTicks, segmentEnd), meter: `${meter.numerator}/${meter.denominator}`, numerator: meter.numerator, denominator: meter.denominator, barTicks });
    }
  }

  const analyzedBars = bars.map((bar) => {
    const steps = bar.numerator * 4 / bar.denominator * 4;
    const hits = [];
    let error = 0;
    for (const note of drumNotes.filter((candidate) => candidate.tick >= bar.start && candidate.tick < bar.end)) {
      const rawStep = (note.tick - bar.start) / bar.barTicks * steps;
      const step = Math.round(rawStep);
      error += Math.abs(rawStep - step);
      if (step >= 0 && step < steps) hits.push({ voice: voices.get(note.note), step, state: velocityState(note.velocity), velocity: note.velocity });
    }
    const deduped = new Map();
    for (const hit of hits) {
      const key = `${hit.voice}:${hit.step}`;
      if (!deduped.has(key) || deduped.get(key).velocity < hit.velocity) deduped.set(key, hit);
    }
    const ordered = [...deduped.values()].sort((a, b) => a.step - b.step || a.voice.localeCompare(b.voice));
    const signature = ordered.map(({ voice, step, state }) => `${voice[0]}${voice === "snare" ? "n" : voice === "closedHat" ? "c" : voice === "openHat" ? "o" : voice === "highTom" ? "h" : voice === "lowTom" ? "l" : voice === "crash" ? "x" : voice === "ride" ? "d" : ""}${step}${state[0]}`).join("|");
    return { ...bar, hits: ordered, hitCount: ordered.length, meanError: hits.length ? error / hits.length : 0, signature };
  }).filter((bar) => bar.hitCount);

  const grouped = new Map();
  for (const bar of analyzedBars) {
    const key = `${bar.meter}:${bar.signature}`;
    const group = grouped.get(key) || { meter: bar.meter, hits: bar.hits, bars: [], count: 0, meanError: 0 };
    group.bars.push(bar.index);
    group.count++;
    group.meanError += bar.meanError;
    grouped.set(key, group);
  }
  const patterns = [...grouped.values()]
    .map((group) => ({ ...group, meanError: group.meanError / group.count }))
    .filter((group) => group.hits.some((hit) => hit.voice === "kick" || hit.voice === "snare" || hit.voice === "rim"))
    .sort((a, b) => b.count - a.count || b.hits.length - a.hits.length)
    .slice(0, 8);
  const primaryTempo = parsed.tempos.find((tempo) => tempo.tick === 0) || parsed.tempos[0];
  return {
    ppqn: parsed.division,
    bpm: primaryTempo ? Math.round(60_000_000 / primaryTempo.micros * 10) / 10 : null,
    meters: [...new Set(changes.map((meter) => `${meter.numerator}/${meter.denominator}`))],
    drumNoteCount: drumNotes.length,
    patterns,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const input = resolve(process.argv[2] || "/tmp/radiohead-midi");
  const files = (await readdir(input)).filter((file) => /\.mid$/i.test(file)).sort();
  const results = [];
  for (const file of files) {
    try {
      const parsed = parseMidi(await readFile(resolve(input, file)));
      results.push({ file: basename(file), trackNames: parsed.trackNames.filter(Boolean), ...analyzeMidiDrums(parsed) });
    } catch (error) {
      results.push({ file: basename(file), error: error.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}
