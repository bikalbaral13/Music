// Monophonic audio → ABC notation. Slides the pitch detector across the
// audio, groups consecutive same-MIDI windows into notes, quantises duration
// to a sixteenth-note grid at the given (or auto-detected) BPM.

import { detectPitch } from './pitchDetect';
import { detectTempo } from './tempoDetect';
import { detectKey } from './keyDetect';
import { newId } from './storage';
import type { Song } from '../types';

const SHARP_TOKENS = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B'];

export interface TranscribedNote {
  midi: number;
  startMs: number;
  durationMs: number;
}

export interface TranscribeOptions {
  /** Force a specific BPM. If omitted, BPM is auto-detected and exposed in the result. */
  bpm?: number;
  /** Drop note events shorter than this (jitter). Default 100 ms. */
  minNoteMs?: number;
  /** Use detected key for the K: header. Default true. */
  detectKeyForHeader?: boolean;
  /** Title for the X: block. Default "Transcription". */
  title?: string;
}

export interface TranscriptionResult {
  notes: TranscribedNote[];
  abc: string;
  bpm: number;
  keyHeader: string;     // e.g. "C" or "Am"
}

export function transcribeAudio(audio: AudioBuffer, opts: TranscribeOptions = {}): TranscriptionResult {
  const sr = audio.sampleRate;
  const len = audio.length;

  // Downmix to mono.
  const mono = new Float32Array(len);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i] / audio.numberOfChannels;
  }

  // ── Pitch track ─────────────────────────────────────────────────────
  const N = 2048;
  const HOP = 1024;
  const win = new Float32Array(N);
  const hopMs = (HOP * 1000) / sr;
  type Sample = { t: number; midi: number | null };
  const samples: Sample[] = [];
  for (let start = 0; start + N <= len; start += HOP) {
    for (let i = 0; i < N; i++) win[i] = mono[start + i];
    const r = detectPitch(win, sr);
    samples.push({ t: (start * 1000) / sr, midi: r ? r.midi : null });
  }

  // ── Group consecutive same-MIDI windows into note events ────────────
  type Event = { midi: number | null; startMs: number; endMs: number };
  const events: Event[] = [];
  for (const s of samples) {
    const last = events[events.length - 1];
    if (last && last.midi === s.midi) last.endMs = s.t + hopMs;
    else events.push({ midi: s.midi, startMs: s.t, endMs: s.t + hopMs });
  }

  // ── Drop very short events (octave-jitter, single-frame glitches) ───
  const minNote = opts.minNoteMs ?? 100;
  const cleaned: Event[] = [];
  for (const e of events) {
    const dur = e.endMs - e.startMs;
    if (dur >= minNote || cleaned.length === 0) {
      cleaned.push({ ...e });
    } else {
      // Absorb into previous event's duration as continuation (so timing is preserved).
      cleaned[cleaned.length - 1].endMs = e.endMs;
    }
  }

  const notes: TranscribedNote[] = cleaned
    .filter((e) => e.midi !== null)
    .map((e) => ({ midi: e.midi!, startMs: e.startMs, durationMs: e.endMs - e.startMs }));

  // ── Tempo ───────────────────────────────────────────────────────────
  let bpm = opts.bpm;
  if (!bpm) {
    const t = detectTempo(audio);
    bpm = t.bpm > 0 ? Math.round(t.bpm) : 100;
  }

  // ── Key (for header) ───────────────────────────────────────────────
  let keyHeader = 'C';
  if (opts.detectKeyForHeader ?? true) {
    try {
      const k = detectKey(audio, 'krumhansl');
      keyHeader = k.rootName.replace('♯', '#') + (k.mode === 'minor' ? 'm' : '');
    } catch { /* fall back to C */ }
  }

  // ── Build ABC ───────────────────────────────────────────────────────
  const sixteenthMs = 15000 / bpm; // 60000 / bpm / 4
  const tokens: string[] = [];
  let cumulativeSixteenths = 0;
  let lastEndMs = 0;

  for (const n of notes) {
    // Insert rest for any silence gap before this note.
    const gap = n.startMs - lastEndMs;
    if (gap > sixteenthMs * 0.7) {
      const len16 = Math.max(1, Math.round(gap / sixteenthMs));
      tokens.push(`z${len16 === 1 ? '' : len16}`);
      cumulativeSixteenths += len16;
      while (cumulativeSixteenths >= 16) {
        tokens.push('|');
        cumulativeSixteenths -= 16;
      }
    }
    const noteLen16 = Math.max(1, Math.round(n.durationMs / sixteenthMs));
    tokens.push(`${midiToAbc(n.midi)}${noteLen16 === 1 ? '' : noteLen16}`);
    cumulativeSixteenths += noteLen16;
    while (cumulativeSixteenths >= 16) {
      tokens.push('|');
      cumulativeSixteenths -= 16;
    }
    lastEndMs = n.startMs + n.durationMs;
  }
  if (tokens.length > 0 && tokens[tokens.length - 1] !== '|') tokens.push('|]');

  const header = [
    'X:1',
    `T:${opts.title ?? 'Transcription'}`,
    'C:Transcribed audio',
    'M:4/4',
    'L:1/16',
    `Q:1/4=${bpm}`,
    `K:${keyHeader}`,
  ].join('\n');

  const abc = header + '\n' + tokens.join(' ') + '\n';
  return { notes, abc, bpm, keyHeader };
}

function midiToAbc(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const token = SHARP_TOKENS[pc];
  const letter = token.replace('^', '');
  const sharp = token.startsWith('^') ? '^' : '';
  let body = letter;
  if (octave >= 5) {
    body = body.toLowerCase();
    for (let o = 5; o < octave; o++) body += "'";
  } else if (octave < 4) {
    for (let o = octave; o < 4; o++) body += ',';
  }
  return sharp + body;
}

/** Convenience: wrap a transcription as a Song ready to drop into the library. */
export function transcriptionToSong(t: TranscriptionResult, title: string): Song {
  return {
    id: newId(),
    title,
    composer: 'Transcribed audio',
    scale: t.keyHeader,
    tempo: t.bpm,
    abc: t.abc.replace(/^T:.+$/m, `T:${title}`),
    createdAt: Date.now(),
    category: 'Other',
  };
}
