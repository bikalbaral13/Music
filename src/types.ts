export interface Song {
  id: string;
  title: string;
  composer?: string;
  scale: string; // key, e.g. "C", "G", "Dm"
  tempo: number; // qpm (quarter notes per minute)
  abc: string;   // raw ABC notation
  createdAt: number;
}

export type ViewMode = 'sheet' | 'piano' | 'falling';

export interface PlayerSettings {
  tempo: number;          // overrides song tempo when set
  transpose: number;      // semitones
  instrument: number;     // GM program number
  metronome: boolean;
  showNoteLabels: boolean;
  loop: { enabled: boolean; startMs: number; endMs: number };
  practiceMode: boolean;  // wait for correct MIDI input
}

export const GM_INSTRUMENTS: { value: number; label: string }[] = [
  { value: 0,  label: 'Piano' },
  { value: 24, label: 'Guitar' },
  { value: 73, label: 'Flute' },
  { value: 20, label: 'Harmonium' }, // GM 20 = Reed Organ — closest to harmonium timbre
  { value: 25, label: 'Ukulele' },   // GM 25 = Acoustic Guitar (steel) — closest plucked timbre to a uke
  { value: 40, label: 'Violin' },    // GM 40 = Violin
];
