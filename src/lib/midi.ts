// Helpers for converting MIDI numbers <-> note names, and laying out a piano keyboard.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToName(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function isBlackKey(midi: number): boolean {
  const pc = midi % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

// Standard 88-key piano: A0 (21) to C8 (108).
export const PIANO_MIN = 21;
export const PIANO_MAX = 108;

// Transpose a written key like "C", "Dm", "F#", "Bbm" by N semitones.
// Returns the new key in sharp spelling (e.g. "C#m"). Returns input if unparsable.
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ROOT_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export function transposeKey(scale: string, semitones: number): string {
  const m = scale.trim().match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!m) return scale;
  const root = (m[1].toUpperCase() + m[2]) as string;
  const suffix = m[3] ?? '';
  const pc = ROOT_TO_PC[root];
  if (pc === undefined) return scale;
  const newPc = ((pc + semitones) % 12 + 12) % 12;
  return SHARP_NAMES[newPc] + suffix;
}

export function pianoMidiRange(): number[] {
  const arr: number[] = [];
  for (let m = PIANO_MIN; m <= PIANO_MAX; m++) arr.push(m);
  return arr;
}
