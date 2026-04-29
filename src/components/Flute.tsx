import React, { useRef } from 'react';

// Realistic 6-hole bamboo flute SVG with per-note fingerings.
// Ported from a Python generator (cairosvg) to inline React/SVG.
// The SVG re-renders whenever `note` changes, swapping hole open/closed/half states.

interface Props {
  /** Absolute note letter being sounded (C, C#, D, ... B). null = no note. */
  note: string | null;
  /** Bansuri's base scale (C, C#, D, ... B). The flute's "1f 2f 3f" fingering produces this pitch. */
  bansuriScale: string;
  /** Optional — when provided, an interactive circle-of-fifths dial wraps the embouchure. */
  onScaleChange?: (scale: string) => void;
  /** The song's current playing key (e.g. "G", "F#m"). Highlighted green on the wheel
      so the player can always see which bansuri scale matches the tune. */
  songKey?: string;
  /** Big readout shown at the top of the flute. Lets the parent route in
      whatever notation the Notes block is currently using (sargam syllable,
      sharp/flat name, etc.). Falls back to `note` if not provided. */
  displayLabel?: React.ReactNode;
}

export const BANSURI_SCALES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Circle-of-fifths order (sharps only). Adjacent positions differ by one
// accidental, so visual distance from C maps to fingering complexity.
const FIFTHS: readonly string[] = ['C','G','D','A','E','B','F#','C#','G#','D#','A#','F'];

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

// Embouchure-wrapped wheel — annular ring centered on the blow hole.
// R_OUT is constrained so the wheel sits within the SVG viewBox vertically
// (CENTER_Y ± R_OUT must fit inside 0..BASE_HEIGHT) without being cropped
// by the instrument-canvas container.
const WHEEL_R_OUT = 130;
const WHEEL_R_IN = 72;
const WHEEL_HALF = Math.PI / 12; // 15° per side of each wedge center

function polar(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function sectorPath(cx: number, cy: number, rOut: number, rIn: number, a1: number, a2: number) {
  const p1 = polar(cx, cy, rOut, a1);
  const p2 = polar(cx, cy, rOut, a2);
  const p3 = polar(cx, cy, rIn, a2);
  const p4 = polar(cx, cy, rIn, a1);
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${rOut} ${rOut} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rIn} ${rIn} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
}

// Find the FIFTHS index whose pitch class matches `key` (e.g. "G", "F#m", "Bbm").
// Lets us locate the song's key on the wheel even when its spelling uses flats
// or carries a minor suffix that the FIFTHS list doesn't.
function fifthsIdxForKey(key: string | undefined): number | null {
  if (!key) return null;
  const m = key.trim().match(/^([A-Ga-g])([#b]?)/);
  if (!m) return null;
  const root = m[1].toUpperCase() + m[2];
  const pc = PC[root];
  if (pc === undefined) return null;
  for (let i = 0; i < FIFTHS.length; i++) {
    if (PC[FIFTHS[i]] === pc) return i;
  }
  return null;
}

// Shortest distance between two indices on a circular list.
function circDist(a: number, b: number, n: number): number {
  const d = ((a - b) % n + n) % n;
  return Math.min(d, n - d);
}

export default function Flute({ note, bansuriScale, onScaleChange, songKey, displayLabel }: Props) {
  const relativeNote = note ? toRelativeNote(note, bansuriScale) : null;
  const fingering: HoleState[] = (relativeNote ? FINGERINGS[relativeNote] : undefined)
    ?? ['open','open','open','open','open','open'];
  const embRadius = HOLE_DIAMETERS[0] / 2;
  const activeIdx = FIFTHS.indexOf(bansuriScale);
  const songKeyIdx = fifthsIdxForKey(songKey);
  // Complexity = circle-of-fifths distance between the song's key and the
  // bansuri's base scale. 0 = perfect match, 6 = tritone away (hardest).
  // We anchor to the song key when we know it; otherwise fall back to C.
  const complexityAnchor = songKeyIdx ?? 0;
  const complexity = activeIdx >= 0 ? circDist(activeIdx, complexityAnchor, 12) : 0;

  // Track an in-progress drag rotation so the wedges' onClick can ignore the
  // pointer-up that ends a drag (otherwise the wedge under the cursor would
  // fire a stray click).
  const dragRef = useRef<{
    startAngle: number;
    startIdx: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  // Set briefly after a real drag so the wedge's onClick (which fires on
  // pointerup) doesn't snap us back to whichever wedge the cursor ended on.
  const justDraggedRef = useRef(false);

  function angleFromCenter(svg: SVGSVGElement, clientX: number, clientY: number): number {
    const rect = svg.getBoundingClientRect();
    // The actual painted SVG is letterboxed inside `rect` because of
    // preserveAspectRatio. Compute the painted box, then translate.
    const vbAspect = BASE_WIDTH / BASE_HEIGHT;
    const elAspect = rect.width / rect.height;
    let drawW: number, drawH: number, offX: number, offY: number;
    if (elAspect > vbAspect) {
      drawH = rect.height;
      drawW = drawH * vbAspect;
      offX = (rect.width - drawW) / 2;
      offY = 0;
    } else {
      drawW = rect.width;
      drawH = drawW / vbAspect;
      offX = 0;
      offY = (rect.height - drawH) / 2;
    }
    const cxPx = rect.left + offX + (EMBOUCHURE_POS / BASE_WIDTH) * drawW;
    const cyPx = rect.top + offY + (CENTER_Y / BASE_HEIGHT) * drawH;
    return Math.atan2(clientY - cyPx, clientX - cxPx);
  }

  function commitFromAngle(currentAngle: number) {
    const ds = dragRef.current;
    if (!ds || !onScaleChange) return;
    let delta = currentAngle - ds.startAngle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    // Each wedge spans 30° (π/6 rad). The user "rotates the wheel" — so the
    // label that ends up at 3 o'clock is the one that started Δ counter-clockwise
    // from there. Hence newIdx = startIdx − steps.
    const steps = Math.round(delta / (Math.PI / 6));
    if (steps === 0) return;
    const newIdx = ((ds.startIdx - steps) % 12 + 12) % 12;
    if (FIFTHS[newIdx] !== bansuriScale) {
      onScaleChange(FIFTHS[newIdx]);
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!onScaleChange || activeIdx < 0) return;
    const svg = e.currentTarget;
    const ang = angleFromCenter(svg, e.clientX, e.clientY);
    dragRef.current = { startAngle: ang, startIdx: activeIdx, moved: false, pointerId: e.pointerId };
    try { svg.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const ds = dragRef.current;
    if (!ds) return;
    const ang = angleFromCenter(e.currentTarget, e.clientX, e.clientY);
    let delta = ang - ds.startAngle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    if (Math.abs(delta) > 0.05) ds.moved = true;
    commitFromAngle(ang);
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const ds = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    // If movement was negligible, treat as a tap and let the wedge's onClick fire.
    // We intentionally don't preventDefault here so click bubbles.
    if (ds?.moved) {
      justDraggedRef.current = true;
      window.setTimeout(() => { justDraggedRef.current = false; }, 80);
    }
  }

  const label: React.ReactNode = displayLabel !== undefined ? displayLabel : note;

  return (
    <div className="rounded-md bg-slate-100 border border-slate-300 p-3 flex flex-col relative" style={{ height: '100%' }}>
      <div className="flex items-baseline justify-between mb-1 shrink-0">
        <span className="text-xs font-medium text-slate-600">
          Bansuri fingering · <span className="font-mono">{bansuriScale}</span> scale
          {onScaleChange && (
            <span className="text-slate-500">
              {' '}· complexity <span className="font-semibold text-slate-700">{complexity}</span>
              {songKey && (
                <span className="text-slate-400">
                  {' '}
                  {complexity === 0
                    ? '(matches song)'
                    : <>({complexity} from <span className="font-mono text-slate-600">{songKey}</span>)</>}
                </span>
              )}
            </span>
          )}
        </span>
        <span className="text-xs text-slate-500">
          Sounding: <strong className="text-slate-800">{note ?? '—'}</strong>
          {relativeNote && relativeNote !== note && (
            <span className="text-slate-500"> · finger as <strong>{relativeNote}</strong></span>
          )}
        </span>
      </div>
      {/* Big top-center readout — mirrors whatever the Notes block is showing
          for the currently-sounding pitch. Sits as an HTML overlay so sargam
          glyphs (with their CSS underline/overline marks) render correctly. */}
      <div className="flute-readout" aria-live="polite">
        {label ?? ''}
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', flex: '1 1 auto', minHeight: 0, display: 'block', touchAction: 'none' }}
        role="img"
        aria-label={`Flute fingering for note ${note ?? 'none'}`}
        onPointerDown={onScaleChange ? onPointerDown : undefined}
        onPointerMove={onScaleChange ? onPointerMove : undefined}
        onPointerUp={onScaleChange ? onPointerUp : undefined}
        onPointerCancel={onScaleChange ? onPointerUp : undefined}
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

        {/* Flute Body */}
        <rect x={FLUTE_X} y={FLUTE_Y}
              width={FLUTE_LENGTH} height={FLUTE_HEIGHT}
              rx={10}
              fill="url(#bambooGradient)"
              stroke="#1a0e04" strokeWidth={3}/>

        {/* Threads */}
        {THREAD_POSITIONS.map((tx, i) => (
          <rect key={i}
            x={tx} y={FLUTE_Y}
            width={28} height={FLUTE_HEIGHT}
            rx={3} fill="url(#threadGradient)"
            stroke="#1a0e04" strokeWidth={1.5}/>
        ))}

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

        {/* (Top-center label rendered as an HTML overlay below — SVG text
            can't host React-styled spans like the sargam glyphs.) */}

        {/* Circle-of-fifths wheel wrapping the embouchure. The active wedge is
            placed at 3 o'clock so the chosen scale label sits right next to
            the blow hole. Click any wedge to switch scales. */}
        {onScaleChange && activeIdx >= 0 && (
          <g className="bansuri-flute-wheel">
            {FIFTHS.map((label, i) => {
              const centerRad = ((i - activeIdx) * 30) * Math.PI / 180;
              const a1 = centerRad - WHEEL_HALF;
              const a2 = centerRad + WHEEL_HALF;
              const isActive = i === activeIdx;
              const isSongKey = songKeyIdx !== null && i === songKeyIdx;
              // Non-active, non-song-key wedges fade with distance from the
              // selected bansuri so the user feels "where they are" on the
              // circle of fifths at a glance.
              const dist = circDist(i, activeIdx, 12);
              const fade = isActive || isSongKey ? 1 : 1 - (dist / 6) * 0.65;
              const lp = polar(EMBOUCHURE_POS, CENTER_Y, (WHEEL_R_OUT + WHEEL_R_IN) / 2, centerRad);
              const wedgeClass = isSongKey
                ? 'song-key'
                : isActive
                  ? 'active'
                  : '';
              return (
                <g
                  key={label}
                  className={`bansuri-flute-wedge ${wedgeClass}`}
                  style={{ opacity: fade }}
                  onClick={() => { if (!justDraggedRef.current) onScaleChange(label); }}
                >
                  <title>
                    {label} scale · complexity {circDist(i, complexityAnchor, 12)}
                    {isSongKey ? ' · matches song key' : ''}
                  </title>
                  <path d={sectorPath(EMBOUCHURE_POS, CENTER_Y, WHEEL_R_OUT, WHEEL_R_IN, a1, a2)} />
                  <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central">
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Embouchure (Blow Hole) — drawn last so it stays on top of the wheel center */}
        <circle cx={EMBOUCHURE_POS} cy={CENTER_Y} r={embRadius}
                fill="white" stroke="#f0dcb8" strokeWidth={3}/>
      </svg>
    </div>
  );
}
