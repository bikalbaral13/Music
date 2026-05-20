// Open-string MIDI for standard tuning, low-E to high-E.
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

export interface ChordShape {
  name: string;
  // 6 entries, low-E to high-E. -1 = muted, 0 = open, n>0 = fretted.
  frets: number[];
}

// Common open-position shapes. Players can pick one from a dropdown.
export const CHORDS: ChordShape[] = [
  { name: 'C',   frets: [-1, 3, 2, 0, 1, 0] },
  { name: 'D',   frets: [-1, -1, 0, 2, 3, 2] },
  { name: 'E',   frets: [0, 2, 2, 1, 0, 0] },
  { name: 'F',   frets: [1, 3, 3, 2, 1, 1] },
  { name: 'G',   frets: [3, 2, 0, 0, 0, 3] },
  { name: 'A',   frets: [-1, 0, 2, 2, 2, 0] },
  { name: 'B7',  frets: [-1, 2, 1, 2, 0, 2] },
  { name: 'Am',  frets: [-1, 0, 2, 2, 1, 0] },
  { name: 'Dm',  frets: [-1, -1, 0, 2, 3, 1] },
  { name: 'Em',  frets: [0, 2, 2, 0, 0, 0] },
  { name: 'C7',  frets: [-1, 3, 2, 3, 1, 0] },
  { name: 'G7',  frets: [3, 2, 0, 0, 0, 1] },
];

export interface StrumPattern {
  id: string;
  name: string;
  beats: number;        // beats per cycle
  slotsPerBeat: number;
  // length === beats * slotsPerBeat. 'D' = downstroke, 'U' = upstroke, '-' = rest.
  slots: ('D' | 'U' | '-')[];
}

export const STRUM_PATTERNS: StrumPattern[] = [
  { id: 'down',    name: 'Down (quarters)',  beats: 4, slotsPerBeat: 1,
    slots: ['D','D','D','D'] },
  { id: 'dudu',    name: 'D-U-D-U (eighths)', beats: 4, slotsPerBeat: 2,
    slots: ['D','U','D','U','D','U','D','U'] },
  { id: 'folk',    name: 'D D-U U-D-U (folk)', beats: 4, slotsPerBeat: 2,
    slots: ['D','-','D','U','U','D','-','U'] },
  { id: 'ballad',  name: 'D - D-U - U D - (ballad)', beats: 4, slotsPerBeat: 2,
    slots: ['D','-','D','U','-','U','D','-'] },
  { id: 'reggae',  name: 'Off-beat', beats: 4, slotsPerBeat: 2,
    slots: ['-','D','-','D','-','D','-','D'] },
  { id: 'waltz',   name: 'Waltz (3/4)', beats: 3, slotsPerBeat: 1,
    slots: ['D','D','D'] },
];

/** Returns the MIDI pitches of a chord, low-to-high, skipping muted strings. */
export function chordMidis(chord: ChordShape): { stringIdx: number; midi: number; fret: number }[] {
  const out: { stringIdx: number; midi: number; fret: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const f = chord.frets[i];
    if (f < 0) continue;
    out.push({ stringIdx: i, midi: OPEN_MIDI[i] + f, fret: f });
  }
  return out;
}
