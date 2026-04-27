// Guitar tablature view. Renders 6 strings (standard tuning E A D G B E),
// numbered frets, and highlights the fret position of the currently-sounding note(s).

interface Props {
  activeMidi: Set<number>;
  showLabels: boolean;
  /** Capo fret position (0 = no capo). */
  capo?: number;
}

// Standard tuning, low to high: E2, A2, D3, G3, B3, E4
const STRINGS = [
  { name: 'E', openMidi: 40 },
  { name: 'A', openMidi: 45 },
  { name: 'D', openMidi: 50 },
  { name: 'G', openMidi: 55 },
  { name: 'B', openMidi: 59 },
  { name: 'e', openMidi: 64 },
];

const FRETS = 15;

// For a midi pitch, choose the highest string (i.e. lowest fret position) that can play it
// within the fretboard range. With a capo at fret `capo`, the lowest playable fret on every
// string is `capo` — anything below that is muted. The displayed fret number is relative to
// the capo (since that's how players read positions when capo'd).
function pickStringFret(midi: number, capo: number):
  { stringIdx: number; fret: number; displayFret: number } | null {
  for (let i = STRINGS.length - 1; i >= 0; i--) {
    const fret = midi - STRINGS[i].openMidi;
    if (fret >= capo && fret <= FRETS) {
      return { stringIdx: i, fret, displayFret: fret - capo };
    }
  }
  return null;
}

const NATURAL_BY_PC: Record<number, string> = {
  0:'C',1:'C#',2:'D',3:'D#',4:'E',5:'F',6:'F#',7:'G',8:'G#',9:'A',10:'A#',11:'B',
};
const noteNameOf = (midi: number) => NATURAL_BY_PC[midi % 12];

export default function GuitarTabs({ activeMidi, showLabels, capo = 0 }: Props) {
  const positions = [...activeMidi]
    .map((m) => {
      const pos = pickStringFret(m, capo);
      return pos ? { midi: m, ...pos } : null;
    })
    .filter((p): p is { midi: number; stringIdx: number; fret: number; displayFret: number } => p !== null);

  // SVG layout
  const W = 1000;
  const H = 220;
  const padL = 60;
  const padR = 30;
  const padT = 30;
  const padB = 30;
  const fretboardW = W - padL - padR;
  const fretboardH = H - padT - padB;
  const fretW = fretboardW / FRETS;
  const stringGap = fretboardH / (STRINGS.length - 1);

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-600">Guitar tablature (standard tuning)</span>
        <span className="text-xs text-slate-500">
          Sounding: <strong className="text-slate-800">
            {positions.length === 0 ? '—' : positions.map((p) => noteNameOf(p.midi)).join(' ')}
          </strong>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Guitar tab">
        {/* Fretboard background */}
        <rect x={padL} y={padT} width={fretboardW} height={fretboardH}
              fill="#f5e6c8" stroke="#8b6f47" strokeWidth={1}/>

        {/* Nut (bold line at fret 0) */}
        <line x1={padL} x2={padL} y1={padT - 4} y2={padT + fretboardH + 4}
              stroke="#3e2716" strokeWidth={5}/>

        {/* Frets */}
        {Array.from({ length: FRETS }).map((_, i) => {
          const x = padL + (i + 1) * fretW;
          return <line key={i} x1={x} x2={x} y1={padT} y2={padT + fretboardH}
                       stroke="#8b6f47" strokeWidth={1}/>;
        })}

        {/* Fret position dots (3, 5, 7, 9, 12) — traditional inlays */}
        {[3, 5, 7, 9, 12].map((f) => {
          const x = padL + (f - 0.5) * fretW;
          const cy = padT + fretboardH / 2;
          if (f === 12) {
            return (
              <g key={f}>
                <circle cx={x} cy={cy - stringGap} r={4} fill="#8b6f47" opacity={0.6}/>
                <circle cx={x} cy={cy + stringGap} r={4} fill="#8b6f47" opacity={0.6}/>
              </g>
            );
          }
          return <circle key={f} cx={x} cy={cy} r={4} fill="#8b6f47" opacity={0.6}/>;
        })}

        {/* Fret numbers */}
        {Array.from({ length: FRETS }).map((_, i) => {
          const x = padL + (i + 0.5) * fretW;
          return <text key={i} x={x} y={padT + fretboardH + 18}
                       fontSize={11} textAnchor="middle" fill="#8b6f47">{i + 1}</text>;
        })}

        {/* Strings (low E at bottom by convention; here string idx 0 = low E at bottom) */}
        {STRINGS.map((s, i) => {
          const y = padT + (STRINGS.length - 1 - i) * stringGap;
          const thickness = 1 + (STRINGS.length - 1 - i) * 0.4; // bass strings thicker
          return (
            <g key={i}>
              <text x={padL - 12} y={y + 4} fontSize={14} fontWeight="bold"
                    textAnchor="end" fill="#3e2716">{s.name}</text>
              <line x1={padL} x2={padL + fretboardW} y1={y} y2={y}
                    stroke="#3e2716" strokeWidth={thickness}/>
            </g>
          );
        })}

        {/* Capo — drawn across all strings at the chosen fret, slightly behind the nut spacing */}
        {capo > 0 && capo <= FRETS && (() => {
          const x = padL + (capo - 0.5) * fretW;
          const yTop = padT - 10;
          const yBot = padT + fretboardH + 10;
          const barW = 14;
          return (
            <g>
              {/* clamp arm extending above the fretboard */}
              <rect x={x - 4} y={yTop - 14} width={8} height={18}
                    fill="#1f2937" stroke="#0f172a" strokeWidth={1} rx={2}/>
              {/* main rubber-padded bar across the strings */}
              <rect x={x - barW / 2} y={yTop} width={barW} height={yBot - yTop}
                    rx={5}
                    fill="#111827" stroke="#000" strokeWidth={1.2}/>
              {/* highlight stripe down the bar */}
              <rect x={x - barW / 2 + 2} y={yTop + 4} width={3} height={yBot - yTop - 8}
                    rx={1.5} fill="#9ca3af" opacity={0.6}/>
              {/* lower clamp knob */}
              <circle cx={x} cy={yBot + 6} r={5}
                      fill="#374151" stroke="#000" strokeWidth={1}/>
              {/* "CAPO @ N" label */}
              <text x={x} y={yTop - 18}
                    fontSize={11} fontWeight="bold" textAnchor="middle"
                    fill="#1f2937">CAPO {capo}</text>
            </g>
          );
        })()}

        {/* Active fret markers — drawn at the physical fret, labelled relative to the capo */}
        {positions.map((p, i) => {
          const y = padT + (STRINGS.length - 1 - p.stringIdx) * stringGap;
          // displayFret 0 = "open" relative to capo: place marker just to the right of the capo
          // (or just before the nut when no capo).
          const x = p.displayFret === 0
            ? (capo > 0 ? padL + (capo - 0.5) * fretW + 16 : padL - 16)
            : padL + (p.fret - 0.5) * fretW;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={13} fill="#dc2626" stroke="#7f1d1d" strokeWidth={1.5}/>
              <text x={x} y={y + 4} fontSize={12} fontWeight="bold" textAnchor="middle" fill="white">
                {showLabels ? (p.displayFret === 0 ? 'O' : p.displayFret) : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
