// Chord-tone-weighted random-walk melody generator. No ML — pure
// constrained sampling. Produces a multi-voice ABC string the rest of the
// app can render exactly like a hand-written sample song.

import type { Song } from '../types';
import { newId } from './storage';

// ── PRNG (mulberry32) so the same seed → the same song ───────────────────
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Music theory tables ──────────────────────────────────────────────────
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_CHORD_TYPES = ['M', 'm', 'm', 'M', 'M', 'm', 'd'] as const;
const MINOR_CHORD_TYPES = ['m', 'd', 'M', 'm', 'm', 'M', 'M'] as const;
const PROGRESSIONS = {
  pop:    [0, 4, 5, 3], // I  V  vi IV  (Axis of Awesome)
  folk:   [0, 3, 4, 0], // I  IV V  I
  doowop: [0, 5, 3, 4], // I  vi IV V   (50s)
  jazz:   [1, 4, 0, 0], // ii V  I  I
  romantic: [0, 5, 3, 4], // same as doowop but flagged for flavor
} as const;

const ROOT_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

function rootPc(key: string): number {
  const m = key.trim().match(/^([A-G])([#b]?)/);
  if (!m) return 0;
  const base = ROOT_PC[m[1]] ?? 0;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (base + acc + 12) % 12;
}

// ── ABC note serialization ───────────────────────────────────────────────
// We keep the key signature in K: so naturals serialize cleanly; explicit ^/_
// only when a chromatic step is needed.
const NATURAL_OF_PC: Record<number, { letter: string; sharp: boolean }> = {
  0:  { letter: 'C', sharp: false }, 1:  { letter: 'C', sharp: true },
  2:  { letter: 'D', sharp: false }, 3:  { letter: 'D', sharp: true },
  4:  { letter: 'E', sharp: false }, 5:  { letter: 'F', sharp: false },
  6:  { letter: 'F', sharp: true  }, 7:  { letter: 'G', sharp: false },
  8:  { letter: 'G', sharp: true  }, 9:  { letter: 'A', sharp: false },
  10: { letter: 'A', sharp: true  }, 11: { letter: 'B', sharp: false },
};

/** MIDI → ABC pitch string honoring the key signature (so notes that are
 *  diatonic to the key omit accidentals). MIDI 60 = C4 = "C" in ABC. */
function midiToAbc(midi: number, keyPcs: Set<number>): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1; // MIDI 60 → octave 4
  const nat = NATURAL_OF_PC[pc];
  const inKey = keyPcs.has(pc);
  // If the natural form of this letter is in the key, but our pitch is
  // sharp/flat relative to that natural, emit explicit accidental. The
  // simple heuristic: emit ^ for chromatic alterations, otherwise rely on K:.
  let letter = nat.letter;
  let accidental = '';
  if (nat.sharp) {
    // The "natural" pitch for this letter is pc-1 (e.g., pc=1 is C# → letter C)
    if (!inKey) accidental = '^';
    else accidental = ''; // K: handles it (e.g. F# in K:D)
  } else {
    // No accidental needed if this natural is in the key.
    if (!inKey) accidental = '=';
  }

  let body = letter;
  if (octave >= 5) {
    body = body.toLowerCase();
    for (let o = 5; o < octave; o++) body += "'";
  } else if (octave < 4) {
    for (let o = octave; o < 4; o++) body += ',';
  }
  return accidental + body;
}

/** Same, but appends a duration multiplier suffix (1=eighth at L:1/8 → 2=quarter, etc.). */
function midiToAbcDur(midi: number, dur: number, keyPcs: Set<number>): string {
  return midiToAbc(midi, keyPcs) + (dur === 1 ? '' : String(dur));
}

// Render a chord-symbol like "Dm" / "G" / "Bdim" for a degree.
function chordSymbol(rootMidiPc: number, type: 'M' | 'm' | 'd'): string {
  const nat = NATURAL_OF_PC[rootMidiPc];
  // Spell with sharps for symbols — readable in any key.
  const letter = nat.letter + (nat.sharp ? '#' : '');
  if (type === 'M') return letter;
  if (type === 'm') return letter + 'm';
  return letter + 'dim';
}

// ── Generator core ───────────────────────────────────────────────────────
export type Mood = 'happy' | 'romantic' | 'energetic' | 'calm' | 'melancholic';
export type Progression = keyof typeof PROGRESSIONS;

export interface GenOptions {
  title: string;
  key: string;            // e.g. 'C', 'D', 'F'  (root letter; minor inferred from `isMinor`)
  isMinor: boolean;
  tempo: number;
  bars: number;           // total bar count, 8–64 typical
  mood: Mood;
  progression: Progression;
  instruments: {
    flute: boolean;
    piano: boolean;
    violin: boolean;
    ukulele: boolean;
  };
  seed?: number;
}

/** Pull each chord-tone into the same octave as anchor, then return the one
 *  closest in pitch — keeps the melody contour smooth. */
function nearestChordTone(targetTones: number[], anchor: number): number {
  let best = targetTones[0];
  let bestDist = Math.abs(best - anchor);
  for (const t of targetTones) {
    // Allow ±1 octave shifts so we always have a "nearest"
    for (const oct of [-12, 0, 12]) {
      const cand = t + oct;
      const d = Math.abs(cand - anchor);
      if (d < bestDist) { best = cand; bestDist = d; }
    }
  }
  return best;
}

/** Take one scale step from `from`, in direction `dir` (±1), with optional
 *  `extra` step count (e.g. 2 = third). */
function stepInScale(from: number, dir: 1 | -1, scaleSemis: number[], rootPcAbs: number, extra = 1): number {
  // Find from's nearest scale position
  let nearest = from;
  let best = Infinity;
  for (let o = -2; o <= 2; o++) {
    for (const s of scaleSemis) {
      const cand = rootPcAbs + s + o * 12 + 60;
      const d = Math.abs(cand - from);
      if (d < best) { best = d; nearest = cand; }
    }
  }
  // Walk `extra` scale steps in `dir`
  let cur = nearest;
  for (let k = 0; k < extra; k++) {
    // Find current's degree, advance by 1
    const pc = ((cur - rootPcAbs) % 12 + 12) % 12;
    const idx = scaleSemis.indexOf(pc);
    const nextIdx = (idx + dir + 7) % 7;
    const wrap = dir === 1 && nextIdx === 0 ? 12 : dir === -1 && idx === 0 ? -12 : 0;
    cur = rootPcAbs + scaleSemis[nextIdx] + 12 * Math.floor((cur - rootPcAbs) / 12) + wrap;
  }
  return cur;
}

export function generateAbc(opts: GenOptions): string {
  const rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 1e9));
  const scale = opts.isMinor ? MINOR_SCALE : MAJOR_SCALE;
  const chordTypes = opts.isMinor ? MINOR_CHORD_TYPES : MAJOR_CHORD_TYPES;
  const root = rootPc(opts.key);
  const keyPcs = new Set(scale.map((s) => (root + s) % 12));
  const prog = PROGRESSIONS[opts.progression];

  // Mood configuration — controls note density, range, and leap bias.
  const moodCfg = {
    happy:       { density: 6, leapBias: 0.30, regOffset:  0 },
    romantic:    { density: 4, leapBias: 0.18, regOffset: -2 },
    energetic:   { density: 8, leapBias: 0.45, regOffset:  0 },
    calm:        { density: 3, leapBias: 0.12, regOffset: -2 },
    melancholic: { density: 4, leapBias: 0.20, regOffset: -2 },
  }[opts.mood];

  // Reference pitch for the melody — about an octave above the chord roots.
  // baseMidi = the MIDI of "root in octave 5" (C5=72, D5=74, …).
  const baseMidi = 72 + root + moodCfg.regOffset;

  // Build per-bar chord plan.
  const bars: { deg: number; midiRoot: number; type: 'M' | 'm' | 'd'; symbol: string }[] = [];
  for (let b = 0; b < opts.bars; b++) {
    const deg = prog[b % prog.length];
    const midiRoot = root + scale[deg];
    const type = chordTypes[deg];
    bars.push({ deg, midiRoot, type, symbol: chordSymbol(midiRoot % 12, type) });
  }

  // Triad for a degree (MIDI pcs).
  function triadPcs(deg: number, type: 'M' | 'm' | 'd'): number[] {
    const r = scale[deg];
    const third = type === 'M' ? 4 : 3;
    const fifth = type === 'd' ? 6 : 7;
    return [r, r + third, r + fifth];
  }

  // Generate the melody (V:1).
  const melodyLines: string[] = [];
  let prev = baseMidi + scale[0]; // start on tonic
  const SLOTS = 8; // eighths per 4/4 bar at L:1/8

  for (const bar of bars) {
    const triad = triadPcs(bar.deg, bar.type).map((pc) => (root + pc) % 12 + 60);
    const note = moodCfg.density;
    const slotsEach = Math.floor(SLOTS / note);
    const extra = SLOTS - slotsEach * note;
    const tokens: string[] = [`"${bar.symbol}"`];
    for (let n = 0; n < note; n++) {
      const strong = n === 0 || n === Math.floor(note / 2);
      let pitch: number;
      if (strong || rng() < 0.55) {
        // Strong beat / chord-tone draw
        const targets = triad.map((t) => nearestChordTone([t + 12, t, t - 12], prev));
        pitch = targets[Math.floor(rng() * targets.length)];
      } else {
        const dir: 1 | -1 = rng() < 0.5 ? -1 : 1;
        const stepSize = rng() < moodCfg.leapBias ? 2 : 1;
        pitch = stepInScale(prev, dir, scale, root, stepSize);
      }
      // Clamp range to ±octave around baseMidi
      while (pitch < baseMidi - 7) pitch += 12;
      while (pitch > baseMidi + 14) pitch -= 12;
      const dur = slotsEach + (n < extra ? 1 : 0);
      tokens.push(midiToAbcDur(pitch, dur, keyPcs));
      prev = pitch;
    }
    melodyLines.push(tokens.join(' ') + ' |');
  }

  // Piano accompaniment (V:2) — block chord on each bar.
  const pianoLines: string[] = bars.map((bar) => {
    const triad = triadPcs(bar.deg, bar.type);
    const r = (root + triad[0]) % 12 + 48; // octave 3
    const third = (root + triad[1]) % 12 + 48;
    const fifth = (root + triad[2]) % 12 + 48;
    // Make sure third/fifth are above the root in the chord (rotate up if needed)
    const cluster = [r, third < r ? third + 12 : third, fifth < r ? fifth + 12 : fifth];
    const abc = '[' + cluster.map((m) => midiToAbc(m, keyPcs)).join('') + ']';
    return `${abc}2 ${abc}2 ${abc}2 ${abc}2 |`; // 4 quarter-note stabs per bar
  });

  // Violin counter-melody (V:3) — sustained chord 3rd, octave below the flute.
  const violinLines: string[] = bars.map((bar) => {
    const triad = triadPcs(bar.deg, bar.type);
    const note = (root + triad[1]) % 12 + 60; // chord 3rd, octave 4
    return `${midiToAbc(note, keyPcs)}8 |`; // whole-bar pedal
  });

  // Ukulele strum (V:4) — eighth-note "chiki" on beats 2 & 4.
  const ukuleleLines: string[] = bars.map((bar) => {
    const triad = triadPcs(bar.deg, bar.type);
    const r = (root + triad[0]) % 12 + 48;
    const third = (root + triad[1]) % 12 + 48;
    const fifth = (root + triad[2]) % 12 + 48;
    const cluster = [r, third < r ? third + 12 : third, fifth < r ? fifth + 12 : fifth];
    const abc = '[' + cluster.map((m) => midiToAbc(m, keyPcs)).join('') + ']';
    return `z2 ${abc}2 z2 ${abc}2 |`;
  });

  // Assemble.
  const sigLetter = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][root];
  const keyHeader = sigLetter + (opts.isMinor ? 'm' : '');
  const header = [
    'X:1',
    `T:${opts.title}`,
    `C:AI (Music Learner)`,
    'M:4/4',
    'L:1/8',
    `Q:1/4=${opts.tempo}`,
    `K:${keyHeader}`,
  ].join('\n');

  const voices: string[] = [];
  if (opts.instruments.flute) {
    voices.push(['V:1 name="Bansuri (Flute)"', '%%MIDI program 73', ...melodyLines].join('\n'));
  }
  if (opts.instruments.piano) {
    voices.push(['V:2 name="Piano"', '%%MIDI program 0', ...pianoLines].join('\n'));
  }
  if (opts.instruments.violin) {
    voices.push(['V:3 name="Violin"', '%%MIDI program 40', ...violinLines].join('\n'));
  }
  if (opts.instruments.ukulele) {
    voices.push(['V:4 name="Ukulele"', '%%MIDI program 25', ...ukuleleLines].join('\n'));
  }
  // Need at least the melody — if user unchecked flute we still want one.
  if (voices.length === 0) {
    voices.push(['V:1 name="Piano"', '%%MIDI program 0', ...melodyLines].join('\n'));
  }

  return [header, ...voices].join('\n') + '\n';
}

/** Build a Song that wraps an externally-generated audio URL (e.g. Gemini
 *  Lyria mp3). ABC is a placeholder so the renderer doesn't error. */
export function audioSong(title: string, audioUrl: string, prompt?: string): Song {
  const abc = [
    'X:1',
    `T:${title}`,
    `C:Gemini Lyria`,
    'M:4/4',
    'L:1/4',
    'Q:1/4=100',
    'K:C',
    prompt ? `% Prompt: ${prompt.replace(/\n/g, ' ').slice(0, 240)}` : '%',
    'z4 |',
  ].join('\n');
  return {
    id: newId(),
    title,
    composer: 'Gemini Lyria',
    scale: 'C',
    tempo: 100,
    abc,
    audioUrl,
    createdAt: Date.now(),
    category: 'Other',
  };
}

/** Convenience: build a full Song ready to push into storage. */
export function generateSong(opts: GenOptions): Song {
  const abc = generateAbc(opts);
  return {
    id: newId(),
    title: opts.title,
    composer: 'AI (Music Learner)',
    scale: opts.isMinor ? `${opts.key}m` : opts.key,
    tempo: opts.tempo,
    abc,
    createdAt: Date.now(),
    category: 'Other',
  };
}
