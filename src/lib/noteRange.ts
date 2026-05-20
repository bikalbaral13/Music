// Note-range analyser: slide the monophonic pitch detector over the input
// audio and report the lowest + highest detected pitches.

import { detectPitch } from './pitchDetect';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function midiToNoteName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export interface NoteExtremum {
  frequency: number;   // Hz
  midi: number;        // 21..108
  noteName: string;    // e.g. "G3"
}

export interface NoteRangeResult {
  lowest: NoteExtremum | null;
  highest: NoteExtremum | null;
  /** Robust low/high — 5th and 95th percentile, ignores one-off spikes. */
  lowestRobust: NoteExtremum | null;
  highestRobust: NoteExtremum | null;
  /** Pitched-window count vs total — gives a sense of how much of the audio was usable. */
  samples: number;
  totalWindows: number;
  /** Span in semitones between the extreme low and high (null if no pitch). */
  rangeSemitones: number | null;
}

export function analyzeNoteRange(audio: AudioBuffer): NoteRangeResult {
  const sr = audio.sampleRate;
  const len = audio.length;

  // Downmix to mono.
  const mono = new Float32Array(len);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i] / audio.numberOfChannels;
  }

  const N = 4096;
  const HOP = 2048;
  const window = new Float32Array(N);

  const detections: { f: number; midi: number }[] = [];
  let totalWindows = 0;
  for (let start = 0; start + N <= len; start += HOP) {
    totalWindows++;
    for (let i = 0; i < N; i++) window[i] = mono[start + i];
    const r = detectPitch(window, sr);
    if (!r) continue;
    detections.push({ f: r.frequency, midi: r.midi });
  }

  if (detections.length === 0) {
    return {
      lowest: null, highest: null,
      lowestRobust: null, highestRobust: null,
      samples: 0, totalWindows, rangeSemitones: null,
    };
  }

  // Strict min / max
  let lo = detections[0], hi = detections[0];
  for (const d of detections) {
    if (d.f < lo.f) lo = d;
    if (d.f > hi.f) hi = d;
  }

  // Robust 5th / 95th percentile (sorted, picked by index)
  const sortedByFreq = [...detections].sort((a, b) => a.f - b.f);
  const pick = (p: number) => sortedByFreq[Math.max(0, Math.min(sortedByFreq.length - 1, Math.floor(sortedByFreq.length * p)))];
  const lor = pick(0.05);
  const hir = pick(0.95);

  const toExt = (d: { f: number; midi: number }): NoteExtremum => ({
    frequency: d.f,
    midi: d.midi,
    noteName: midiToNoteName(d.midi),
  });

  return {
    lowest:        toExt(lo),
    highest:       toExt(hi),
    lowestRobust:  toExt(lor),
    highestRobust: toExt(hir),
    samples: detections.length,
    totalWindows,
    rangeSemitones: hi.midi - lo.midi,
  };
}
