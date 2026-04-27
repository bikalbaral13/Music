// Realistic 6-hole bamboo flute SVG with per-note fingerings.
// Ported from a Python generator (cairosvg) to inline React/SVG.
// The SVG re-renders whenever `note` changes, swapping hole open/closed/half states.

interface Props {
  /** Absolute note letter being sounded (C, C#, D, ... B). null = no note. */
  note: string | null;
  /** Bansuri's base scale (C, C#, D, ... B). The flute's "1f 2f 3f" fingering produces this pitch. */
  bansuriScale: string;
}

export const BANSURI_SCALES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const PC: Record<string, number> = {
  C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11,
};

// Convert an absolute pitch to its position relative to the bansuri's base scale.
// e.g. on a D bansuri, absolute E (pc 4) is relative D (pc 2 above base, fingering for "D").
function toRelativeNote(absNote: string, bansuriScale: string): string | null {
  const a = PC[absNote];
  const b = PC[bansuriScale];
  if (a === undefined || b === undefined) return null;
  const rel = (a - b + 12) % 12;
  return BANSURI_SCALES[rel];
}

type HoleState = 'closed' | 'open' | 'half';

// Holes numbered 1–6 (index 0..5). f = full closed, h = half, anything not listed = open.
// Sharps half-cover the LAST closed hole of the next-natural-down's fingering.
//   C  1f 2f 3f         C# 1f 2f 3h
//   D  1f 2f            D# 1f 2h
//   E  1f               F  1h           F# (all open)
//   G  1f 2f 3f 4f 5f 6f   G# 1f 2f 3f 4f 5f 6h
//   A  1f 2f 3f 4f 5f   A# 1f 2f 3f 4f 5h
//   B  1f 2f 3f 4f
const FINGERINGS: Record<string, HoleState[]> = {
  C:    ['closed', 'closed', 'closed', 'open',   'open',   'open'  ],
  'C#': ['closed', 'closed', 'half',   'open',   'open',   'open'  ],
  D:    ['closed', 'closed', 'open',   'open',   'open',   'open'  ],
  'D#': ['closed', 'half',   'open',   'open',   'open',   'open'  ],
  E:    ['closed', 'open',   'open',   'open',   'open',   'open'  ],
  F:    ['half',   'open',   'open',   'open',   'open',   'open'  ],
  'F#': ['open',   'open',   'open',   'open',   'open',   'open'  ],
  G:    ['closed', 'closed', 'closed', 'closed', 'closed', 'closed'],
  'G#': ['closed', 'closed', 'closed', 'closed', 'closed', 'half'  ],
  A:    ['closed', 'closed', 'closed', 'closed', 'closed', 'open'  ],
  'A#': ['closed', 'closed', 'closed', 'closed', 'half',   'open'  ],
  B:    ['closed', 'closed', 'closed', 'closed', 'open',   'open'  ],
};

// Default geometry — same coordinate system as the Python script (BASE 1000x350).
// We render at a viewBox so the SVG scales fluidly.
const BASE_WIDTH = 1000;
const BASE_HEIGHT = 350;
const FLUTE_X = 50;
const FLUTE_LENGTH = 900;
const FLUTE_HEIGHT = 70;
const FLUTE_Y = (BASE_HEIGHT - FLUTE_HEIGHT) / 2;
const CENTER_Y = FLUTE_Y + FLUTE_HEIGHT / 2;

const EMBOUCHURE_POS = 130;
const HOLE_POSITIONS = [380, 460, 540, 680, 760, 840];
const HOLE_DIAMETERS = [40, 36, 36, 36, 36, 36];
const THREAD_POSITIONS = [240, 880];

export default function Flute({ note, bansuriScale }: Props) {
  const relativeNote = note ? toRelativeNote(note, bansuriScale) : null;
  const fingering: HoleState[] = (relativeNote ? FINGERINGS[relativeNote] : undefined)
    ?? ['open','open','open','open','open','open'];
  const embRadius = HOLE_DIAMETERS[0] / 2;

  return (
    <div className="rounded-md bg-slate-100 border border-slate-300 p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-600">
          Bansuri fingering · <span className="font-mono">{bansuriScale}</span> scale
        </span>
        <span className="text-xs text-slate-500">
          Sounding: <strong className="text-slate-800">{note ?? '—'}</strong>
          {relativeNote && relativeNote !== note && (
            <span className="text-slate-500"> · finger as <strong>{relativeNote}</strong></span>
          )}
        </span>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Flute fingering for note ${note ?? 'none'}`}
      >
        <defs>
          <linearGradient id="bambooGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#5c3a21"/>
            <stop offset="15%"  stopColor="#8f5e35"/>
            <stop offset="40%"  stopColor="#f5dcb8"/>
            <stop offset="60%"  stopColor="#c49a6c"/>
            <stop offset="100%" stopColor="#5c3a21"/>
          </linearGradient>
          <linearGradient id="threadGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#2b0a15"/>
            <stop offset="40%"  stopColor="#b03058"/>
            <stop offset="100%" stopColor="#2b0a15"/>
          </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="white"/>

        {/* Flute Body — sharp, well-defined border */}
        <rect x={FLUTE_X} y={FLUTE_Y}
              width={FLUTE_LENGTH} height={FLUTE_HEIGHT}
              rx={10}
              fill="url(#bambooGradient)"
              stroke="#1a0e04" strokeWidth={3}/>

        {/* Threads — flush with the flute body (no overhang above or below) */}
        {THREAD_POSITIONS.map((tx, i) => (
          <rect key={i}
            x={tx} y={FLUTE_Y}
            width={28} height={FLUTE_HEIGHT}
            rx={3} fill="url(#threadGradient)"
            stroke="#1a0e04" strokeWidth={1.5}/>
        ))}

        {/* Embouchure (Blow Hole) */}
        <circle cx={EMBOUCHURE_POS} cy={CENTER_Y} r={embRadius}
                fill="white" stroke="#f0dcb8" strokeWidth={3}/>

        {/* Vertical bansuri scale label */}
        <text
          x={EMBOUCHURE_POS + HOLE_DIAMETERS[0] + 20}
          y={CENTER_Y + 18 - 10}
          fontSize={32}
          fontWeight="bold"
          transform={`rotate(-90 ${EMBOUCHURE_POS + HOLE_DIAMETERS[0] + 20} ${CENTER_Y + 18 - 10})`}
          fill="#000">
          {bansuriScale}
        </text>

        {/* Finger holes */}
        {fingering.map((state, i) => {
          const cx = HOLE_POSITIONS[i];
          const r  = HOLE_DIAMETERS[i] / 2;
          if (state === 'closed') {
            return <circle key={i} cx={cx} cy={CENTER_Y} r={r} fill="black"/>;
          }
          if (state === 'half') {
            return (
              <g key={i}>
                <path d={`M ${cx} ${CENTER_Y - r} A ${r} ${r} 0 0 0 ${cx} ${CENTER_Y + r} L ${cx} ${CENTER_Y} Z`}
                      fill="black"/>
                <path d={`M ${cx} ${CENTER_Y - r} A ${r} ${r} 0 0 1 ${cx} ${CENTER_Y + r} L ${cx} ${CENTER_Y} Z`}
                      fill="white" stroke="#111" strokeWidth={1}/>
              </g>
            );
          }
          return <circle key={i} cx={cx} cy={CENTER_Y} r={r} fill="white" stroke="#111" strokeWidth={1}/>;
        })}

        {/* Note label, top center */}
        <text x={BASE_WIDTH / 2} y={50}
              fontSize={60} fontWeight="bold" textAnchor="middle">
          {note ?? ''}
        </text>
      </svg>
    </div>
  );
}
