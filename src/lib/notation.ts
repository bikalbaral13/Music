// Shared label-derivation helpers — used by both the Notes block (per-chip
// labels) and the Flute big top label so they stay in lockstep with the
// user's notation/spelling choices.

export type Mode = 'abc' | 'original' | 'transposed';
export type Notation = 'western' | 'sargam';
export type Spelling = 'auto' | 'sharps' | 'flats';

export const SHARP_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const FLAT_NAMES  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

export const SARGAM: { dev: string; roman: string; mark: 'shuddha' | 'komal' | 'tivra' }[] = [
  { dev: 'सा', roman: 'Sa',  mark: 'shuddha' },
  { dev: 'रे', roman: 're',  mark: 'komal'   },
  { dev: 'रे', roman: 'Re',  mark: 'shuddha' },
  { dev: 'ग',  roman: 'ga',  mark: 'komal'   },
  { dev: 'ग',  roman: 'Ga',  mark: 'shuddha' },
  { dev: 'म',  roman: 'Ma',  mark: 'shuddha' },
  { dev: 'म',  roman: 'Ma',  mark: 'tivra'   },
  { dev: 'प',  roman: 'Pa',  mark: 'shuddha' },
  { dev: 'ध',  roman: 'dha', mark: 'komal'   },
  { dev: 'ध',  roman: 'Dha', mark: 'shuddha' },
  { dev: 'नि', roman: 'ni',  mark: 'komal'   },
  { dev: 'नि', roman: 'Ni',  mark: 'shuddha' },
];

const KEY_PC: Record<string, number> = {
  C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,
  G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,
};
export function pcOfKey(key: string): number {
  const m = key.trim().match(/^([A-Ga-g])([#b]?)/);
  if (!m) return 0;
  const root = m[1].toUpperCase() + (m[2] ?? '');
  return KEY_PC[root] ?? 0;
}

const FLAT_KEYS = new Set([
  'F','Bb','Eb','Ab','Db','Gb','Cb',
  'Dm','Gm','Cm','Fm','Bbm','Ebm','Abm',
]);
export function preferFlats(scale: string): boolean {
  const m = scale.trim().match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!m) return false;
  const root = m[1].toUpperCase() + (m[2] ?? '');
  const suffix = (m[3] ?? '').toLowerCase();
  const isMinor = suffix.startsWith('m') && !suffix.startsWith('maj');
  return FLAT_KEYS.has(isMinor ? `${root}m` : root);
}

export function westernNameForPc(pc: number, spelling: Spelling, songKey: string): string {
  const useFlats = spelling === 'flats' || (spelling === 'auto' && preferFlats(songKey));
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[pc];
}

// Resolve where Sa lives for the current view.
//   - `saAnchor` (e.g. bansuri scale) wins — fixed absolute pitch.
//   - In transposed mode without an anchor, the song's tonic moves with
//     transpose so degrees stay invariant.
export function tonicPcFor(
  mode: Mode,
  songKey: string,
  transpose: number,
  saAnchor: string | undefined,
): number {
  if (saAnchor) return pcOfKey(saAnchor);
  return mode === 'transposed'
    ? ((pcOfKey(songKey) + transpose) % 12 + 12) % 12
    : pcOfKey(songKey);
}
