// Violin fingerboard view. Standard tuning G3 D4 A4 E5 (MIDI 55, 62, 69, 76).
// Violin is fretless, so instead of frets we draw faint chromatic gridlines
// and label the four standard finger positions (1st position) on each string:
// open (0), 1st finger, 2nd, 3rd, 4th — at major-scale spacing for the open string's key.

interface Props {
  activeMidi: Set<number>;
  showLabels: boolean;
}

// Bottom of diagram = lowest string (G3). Top = highest (E5).
const STRINGS = [
  { name: 'G', openMidi: 55 },
  { name: 'D', openMidi: 62 },
  { name: 'A', openMidi: 69 },
  { name: 'E', openMidi: 76 },
];

// Chromatic semitone steps drawn on the fingerboard (covers 1st–3rd position).
const SEMITONES = 13;

// Major-scale finger spacing for first position: whole, whole, half, whole.
// Semitone offsets from open string: 0, 2, 4, 5, 7 → fingers 0..4.
const FINGER_OFFSETS = [0, 2, 4, 5, 7];

function pickStringPos(midi: number):
  { stringIdx: number; semis: number } | null {
  // Prefer the highest string that can play the note within range —
  // closest hand position to the bridge mirrors typical violin technique.
  for (let i = STRINGS.length - 1; i >= 0; i--) {
    const semis = midi - STRINGS[i].openMidi;
    if (semis >= 0 && semis <= SEMITONES) return { stringIdx: i, semis };
  }
  return null;
}

const NATURAL_BY_PC: Record<number, string> = {
  0:'C',1:'C#',2:'D',3:'D#',4:'E',5:'F',6:'F#',7:'G',8:'G#',9:'A',10:'A#',11:'B',
};
const noteNameOf = (midi: number) => NATURAL_BY_PC[midi % 12];

export default function ViolinView({ activeMidi, showLabels }: Props) {
  const positions = [...activeMidi]
    .map((m) => {
      const pos = pickStringPos(m);
      return pos ? { midi: m, ...pos } : null;
    })
    .filter((p): p is { midi: number; stringIdx: number; semis: number } => p !== null);

  const W = 900;
  const H = 200;
  const padL = 70;
  const padR = 30;
  const padT = 30;
  const padB = 30;
  const boardW = W - padL - padR;
  const boardH = H - padT - padB;
  const stepW = boardW / SEMITONES;
  const stringGap = boardH / (STRINGS.length - 1);

  return (
    <div className="rounded-md bg-amber-100 border border-amber-300 p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-700">Violin fingerboard (GDAE — fretless)</span>
        <span className="text-xs text-slate-600">
          Sounding: <strong className="text-slate-900">
            {positions.length === 0 ? '—' : positions.map((p) => noteNameOf(p.midi)).join(' ')}
          </strong>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Violin fingerboard">
        {/* Dark wood fingerboard */}
        <rect x={padL} y={padT} width={boardW} height={boardH}
              fill="#2a1a10" stroke="#1a0e08" strokeWidth={1} rx={3}/>

        {/* Nut */}
        <line x1={padL} x2={padL} y1={padT - 4} y2={padT + boardH + 4}
              stroke="#e8d8b8" strokeWidth={5}/>

        {/* Faint chromatic gridlines (semitone reference, not real frets) */}
        {Array.from({ length: SEMITONES }).map((_, i) => {
          const x = padL + (i + 1) * stepW;
          return <line key={i} x1={x} x2={x} y1={padT} y2={padT + boardH}
                       stroke="#ffffff" strokeOpacity={0.06} strokeWidth={1}/>;
        })}

        {/* Finger-position markers (1–4 in 1st position) labelled below the board */}
        {FINGER_OFFSETS.slice(1).map((off, idx) => {
          const x = padL + off * stepW;
          return (
            <g key={idx}>
              <line x1={x} x2={x} y1={padT} y2={padT + boardH}
                    stroke="#fbbf24" strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="3 3"/>
              <text x={x} y={padT + boardH + 18}
                    fontSize={11} fontWeight="bold" textAnchor="middle" fill="#92400e">
                {idx + 1}
              </text>
            </g>
          );
        })}
        <text x={padL} y={padT + boardH + 18}
              fontSize={11} fontWeight="bold" textAnchor="middle" fill="#92400e">0</text>

        {/* Strings */}
        {STRINGS.map((s, i) => {
          const y = padT + (STRINGS.length - 1 - i) * stringGap;
          // Lower strings are wound and visually thicker.
          const thickness = 1 + (STRINGS.length - 1 - i) * 0.4;
          return (
            <g key={i}>
              <text x={padL - 14} y={y + 4} fontSize={14} fontWeight="bold"
                    textAnchor="end" fill="#fde68a">{s.name}</text>
              <line x1={padL} x2={padL + boardW} y1={y} y2={y}
                    stroke="#f5deb3" strokeWidth={thickness} opacity={0.9}/>
            </g>
          );
        })}

        {/* Active finger positions */}
        {positions.map((p, i) => {
          const y = padT + (STRINGS.length - 1 - p.stringIdx) * stringGap;
          const x = p.semis === 0 ? padL - 16 : padL + p.semis * stepW;
          // Map semitone offset to a finger number when it lands on a major-scale degree;
          // otherwise show the chromatic note letter.
          const fingerIdx = FINGER_OFFSETS.indexOf(p.semis);
          const label = p.semis === 0 ? 'O'
                       : fingerIdx > 0 ? String(fingerIdx)
                       : noteNameOf(p.midi);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={13} fill="#f59e0b" stroke="#7c2d12" strokeWidth={1.5}/>
              <text x={x} y={y + 4} fontSize={11} fontWeight="bold" textAnchor="middle" fill="#3b1e07">
                {showLabels ? label : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
