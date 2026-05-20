// Guitar view: split into a melody fretboard (live notes from playback) and a
// chord fretboard (player-selected chord + strum pattern that loops in time).

import { useMemo } from 'react';
import {
  CHORDS, STRUM_PATTERNS, type ChordShape, type StrumPattern,
  OPEN_MIDI, STRING_NAMES, chordMidis,
} from '../lib/guitarChords';

interface Props {
  activeMidi: Set<number>;
  showLabels: boolean;
  capo?: number;
  // Chord section state — owned by the parent so audio + UI stay in sync.
  chord: ChordShape;
  onChordChange: (c: ChordShape) => void;
  strumPattern: StrumPattern;
  onStrumPatternChange: (p: StrumPattern) => void;
  currentMs: number;
  tempo: number;
  isPlaying: boolean;
}

const STRINGS = OPEN_MIDI.map((m, i) => ({ name: STRING_NAMES[i], openMidi: m }));
const FRETS = 15;

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

export default function GuitarTabs({
  activeMidi, showLabels, capo = 0,
  chord, onChordChange, strumPattern, onStrumPatternChange,
  currentMs, tempo, isPlaying,
}: Props) {
  return (
    <div className="space-y-4">
      <MelodyFretboard activeMidi={activeMidi} showLabels={showLabels} capo={capo} />
      <ChordSection
        chord={chord}
        onChordChange={onChordChange}
        strumPattern={strumPattern}
        onStrumPatternChange={onStrumPatternChange}
        currentMs={currentMs}
        tempo={tempo}
        isPlaying={isPlaying}
      />
    </div>
  );
}

// =============================================================================
// Melody fretboard — same as before, just isolated into its own component.
// =============================================================================

function MelodyFretboard({ activeMidi, showLabels, capo }: { activeMidi: Set<number>; showLabels: boolean; capo: number }) {
  const positions = [...activeMidi]
    .map((m) => {
      const pos = pickStringFret(m, capo);
      return pos ? { midi: m, ...pos } : null;
    })
    .filter((p): p is { midi: number; stringIdx: number; fret: number; displayFret: number } => p !== null);

  const W = 1000, H = 200, padL = 60, padR = 30, padT = 26, padB = 30;
  const fretboardW = W - padL - padR;
  const fretboardH = H - padT - padB;
  const fretW = fretboardW / FRETS;
  const stringGap = fretboardH / (STRINGS.length - 1);

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-600">Melody — live notes from playback</span>
        <span className="text-xs text-slate-500">
          Sounding: <strong className="text-slate-800">
            {positions.length === 0 ? '—' : positions.map((p) => noteNameOf(p.midi)).join(' ')}
          </strong>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Guitar melody tab">
        <rect x={padL} y={padT} width={fretboardW} height={fretboardH} fill="#f5e6c8" stroke="#8b6f47" strokeWidth={1}/>
        <line x1={padL} x2={padL} y1={padT - 4} y2={padT + fretboardH + 4} stroke="#3e2716" strokeWidth={5}/>
        {Array.from({ length: FRETS }).map((_, i) => {
          const x = padL + (i + 1) * fretW;
          return <line key={i} x1={x} x2={x} y1={padT} y2={padT + fretboardH} stroke="#8b6f47" strokeWidth={1}/>;
        })}
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
        {Array.from({ length: FRETS }).map((_, i) => {
          const x = padL + (i + 0.5) * fretW;
          return <text key={i} x={x} y={padT + fretboardH + 18} fontSize={11} textAnchor="middle" fill="#8b6f47">{i + 1}</text>;
        })}
        {STRINGS.map((s, i) => {
          const y = padT + (STRINGS.length - 1 - i) * stringGap;
          const thickness = 1 + (STRINGS.length - 1 - i) * 0.4;
          return (
            <g key={i}>
              <text x={padL - 12} y={y + 4} fontSize={14} fontWeight="bold" textAnchor="end" fill="#3e2716">{s.name}</text>
              <line x1={padL} x2={padL + fretboardW} y1={y} y2={y} stroke="#3e2716" strokeWidth={thickness}/>
            </g>
          );
        })}
        {capo > 0 && capo <= FRETS && (() => {
          const x = padL + (capo - 0.5) * fretW;
          const yTop = padT - 10;
          const yBot = padT + fretboardH + 10;
          const barW = 14;
          return (
            <g>
              <rect x={x - 4} y={yTop - 14} width={8} height={18} fill="#1f2937" stroke="#0f172a" strokeWidth={1} rx={2}/>
              <rect x={x - barW / 2} y={yTop} width={barW} height={yBot - yTop} rx={5} fill="#111827" stroke="#000" strokeWidth={1.2}/>
              <rect x={x - barW / 2 + 2} y={yTop + 4} width={3} height={yBot - yTop - 8} rx={1.5} fill="#9ca3af" opacity={0.6}/>
              <circle cx={x} cy={yBot + 6} r={5} fill="#374151" stroke="#000" strokeWidth={1}/>
              <text x={x} y={yTop - 18} fontSize={11} fontWeight="bold" textAnchor="middle" fill="#1f2937">CAPO {capo}</text>
            </g>
          );
        })()}
        {positions.map((p, i) => {
          const y = padT + (STRINGS.length - 1 - p.stringIdx) * stringGap;
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

// =============================================================================
// Chord section — chord shape on a small fretboard, strum pattern beat strip,
// dropdowns for chord and strum pattern.
// =============================================================================

function ChordSection({
  chord, onChordChange, strumPattern, onStrumPatternChange,
  currentMs, tempo, isPlaying,
}: {
  chord: ChordShape;
  onChordChange: (c: ChordShape) => void;
  strumPattern: StrumPattern;
  onStrumPatternChange: (p: StrumPattern) => void;
  currentMs: number;
  tempo: number;
  isPlaying: boolean;
}) {
  const slotIndex = useMemo(() => {
    if (!isPlaying) return -1;
    const slotSec = 60 / tempo / strumPattern.slotsPerBeat;
    const total = strumPattern.beats * strumPattern.slotsPerBeat;
    const idx = Math.floor((currentMs / 1000) / slotSec);
    return ((idx % total) + total) % total;
  }, [currentMs, tempo, strumPattern, isPlaying]);

  const notes = chordMidis(chord);
  const noteNames = notes.map((n) => noteNameOf(n.midi)).join(' ');

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <span className="text-xs font-medium text-slate-600">Chord — strums on the song clock</span>
        <span className="text-xs text-slate-500">
          Notes: <strong className="text-slate-800">{noteNames || '—'}</strong>
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-700">
          <span>Chord</span>
          <select
            value={chord.name}
            onChange={(e) => {
              const c = CHORDS.find((x) => x.name === e.target.value);
              if (c) onChordChange(c);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800"
          >
            {CHORDS.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-700">
          <span>Strumming pattern</span>
          <select
            value={strumPattern.id}
            onChange={(e) => {
              const p = STRUM_PATTERNS.find((x) => x.id === e.target.value);
              if (p) onStrumPatternChange(p);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800"
          >
            {STRUM_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <ChordFretboard chord={chord} />
      <StrumStrip pattern={strumPattern} slotIndex={slotIndex} />
      <p className="text-[10px] text-slate-400 text-right">
        Guitar samples:{' '}
        <a href="https://github.com/nbrosowsky/tonejs-instruments" target="_blank" rel="noreferrer" className="underline">
          tonejs-instruments
        </a>
        {' '}(CC-BY 3.0)
      </p>
    </div>
  );
}

function ChordFretboard({ chord }: { chord: ChordShape }) {
  // Show 5 frets starting at the lowest fretted position (or fret 1 if all open).
  const fretted = chord.frets.filter((f) => f > 0);
  const minFret = fretted.length > 0 ? Math.min(...fretted) : 1;
  const startFret = Math.max(1, minFret > 4 ? minFret - 1 : 1);
  const visibleFrets = 5;

  const W = 360, H = 160, padL = 50, padR = 18, padT = 22, padB = 22;
  const fbW = W - padL - padR;
  const fbH = H - padT - padB;
  const fretW = fbW / visibleFrets;
  const stringGap = fbH / (STRINGS.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ maxWidth: '100%', height: 'auto' }} role="img" aria-label="Chord shape">
      {/* Fretboard wood */}
      <rect x={padL} y={padT} width={fbW} height={fbH} fill="#f5e6c8" stroke="#8b6f47" strokeWidth={1}/>

      {/* Nut (only when starting at fret 1) */}
      {startFret === 1 && (
        <line x1={padL} x2={padL} y1={padT - 3} y2={padT + fbH + 3} stroke="#3e2716" strokeWidth={5}/>
      )}
      {/* "starting fret" indicator if not fret 1 */}
      {startFret > 1 && (
        <text x={padL - 8} y={padT - 6} fontSize={10} textAnchor="end" fill="#8b6f47">fret {startFret}</text>
      )}

      {/* Frets */}
      {Array.from({ length: visibleFrets }).map((_, i) => {
        const x = padL + (i + 1) * fretW;
        return <line key={i} x1={x} x2={x} y1={padT} y2={padT + fbH} stroke="#8b6f47" strokeWidth={1}/>;
      })}

      {/* Strings + name labels */}
      {STRINGS.map((s, i) => {
        const y = padT + (STRINGS.length - 1 - i) * stringGap;
        const thickness = 1 + (STRINGS.length - 1 - i) * 0.35;
        const f = chord.frets[i];
        const muted = f < 0;
        return (
          <g key={i}>
            <text x={padL - 12} y={y + 4} fontSize={11} fontWeight="bold" textAnchor="end" fill="#3e2716">{s.name}</text>
            <line x1={padL} x2={padL + fbW} y1={y} y2={y} stroke="#3e2716" strokeWidth={thickness}/>
            {/* X for muted, O for open — drawn just to the left of the nut/board */}
            {muted && (
              <text x={padL - 28} y={y + 4} fontSize={12} fontWeight="bold" textAnchor="middle" fill="#7f1d1d">×</text>
            )}
            {f === 0 && (
              <circle cx={padL - 28} cy={y} r={6} fill="none" stroke="#3e2716" strokeWidth={1.4}/>
            )}
          </g>
        );
      })}

      {/* Chord dots */}
      {chord.frets.map((f, i) => {
        if (f <= 0) return null;
        const visibleIdx = f - startFret;
        if (visibleIdx < 0 || visibleIdx >= visibleFrets) return null;
        const y = padT + (STRINGS.length - 1 - i) * stringGap;
        const x = padL + (visibleIdx + 0.5) * fretW;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={11} fill="#1f2937" stroke="#000" strokeWidth={1}/>
            <text x={x} y={y + 4} fontSize={11} fontWeight="bold" textAnchor="middle" fill="#fff">{f}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StrumStrip({ pattern, slotIndex }: { pattern: StrumPattern; slotIndex: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {pattern.slots.map((s, i) => {
        const isCurrent = i === slotIndex;
        const isDownbeat = i % pattern.slotsPerBeat === 0;
        const beatNum = Math.floor(i / pattern.slotsPerBeat) + 1;
        return (
          <div key={i} className="flex flex-col items-center gap-0.5" style={{ minWidth: 30 }}>
            <span style={{
              fontSize: 18,
              fontWeight: 700,
              color: s === '-' ? '#cbd5e1' : (isCurrent ? '#dc2626' : '#475569'),
              transform: isCurrent && s !== '-' ? 'scale(1.2)' : 'scale(1)',
              transition: 'transform 80ms, color 80ms',
            }}>
              {s === 'D' ? '↓' : s === 'U' ? '↑' : '·'}
            </span>
            {isDownbeat && (
              <span className="text-[10px] tabular text-slate-500 font-semibold">{beatNum}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
