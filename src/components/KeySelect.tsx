interface Props {
  /** Original key of the song, e.g. "F", "Bb", "Dm". */
  originalScale: string;
  /** Semitone offset relative to the original (negative or positive). */
  transpose: number;
  onChange: (transpose: number) => void;
}

const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

const ROOT_TO_PC: Record<string, number> = {
  C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,
};
const FLAT_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Cb','Dm','Gm','Cm','Fm','Bbm','Ebm','Abm']);

function originalPitchClass(scale: string): number {
  const m = scale.trim().match(/^([A-Ga-g])([#b]?)/);
  if (!m) return 0;
  const root = m[1].toUpperCase() + m[2];
  return ROOT_TO_PC[root] ?? 0;
}

function preferFlats(scale: string): boolean {
  const m = scale.trim().match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!m) return false;
  const root = m[1].toUpperCase() + (m[2] ?? '');
  const suffix = (m[3] ?? '').toLowerCase();
  const isMinor = suffix.startsWith('m') && !suffix.startsWith('maj');
  return FLAT_KEYS.has(isMinor ? `${root}m` : root);
}

/** Shortest signed offset (-6..+5) so the transpose value stays compact. */
function shortestSigned(off: number): number {
  const norm = ((off % 12) + 12) % 12;
  return norm > 6 ? norm - 12 : norm;
}

export default function KeySelect({ originalScale, transpose, onChange }: Props) {
  const origPc = originalPitchClass(originalScale);
  const NAMES = preferFlats(originalScale) ? FLATS : SHARPS;
  const activePc = ((origPc + transpose) % 12 + 12) % 12;

  return (
    <select
      className="field tabular"
      value={activePc}
      onChange={(e) => {
        const pickedPc = Number(e.target.value);
        const offset = (pickedPc - origPc + 12) % 12;
        onChange(shortestSigned(offset));
      }}
      aria-label="Key (transpose)"
      title={`Original key: ${originalScale}`}
    >
      {NAMES.map((name, pc) => (
        <option key={pc} value={pc}>
          {name}{pc === origPc ? ' (original)' : ''}
        </option>
      ))}
    </select>
  );
}
