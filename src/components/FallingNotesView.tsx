import { useEffect, useRef } from 'react';
import { isBlackKey, midiToName, pianoMidiRange } from '../lib/midi';

interface FallingNote {
  midi: number;
  startMs: number;     // when note begins (relative to playback start)
  durationMs: number;
}

interface Props {
  notes: FallingNote[];      // pre-computed timeline of all notes in the song
  currentMs: number;         // current playback position
  isPlaying: boolean;
  showLabels: boolean;
}

// Visual constants
const LOOKAHEAD_MS = 2500;   // how far in the future to render
const PIXELS_PER_MS = 0.12;  // falling speed

export default function FallingNotesView({ notes, currentMs, showLabels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const all = pianoMidiRange();
  const whites = all.filter((m) => !isBlackKey(m));

  // Map midi -> x% (centred on its key)
  const xPercentForMidi = (midi: number): number => {
    if (isBlackKey(midi)) {
      const whiteIdxBefore = whites.indexOf(midi - 1);
      return ((whiteIdxBefore + 1) / whites.length) * 100;
    }
    const idx = whites.indexOf(midi);
    return ((idx + 0.5) / whites.length) * 100;
  };

  useEffect(() => {
    // No-op effect; here in case we add a canvas-based renderer later.
  }, []);

  const visible = notes.filter((n) => {
    const endMs = n.startMs + n.durationMs;
    return endMs > currentMs - 500 && n.startMs < currentMs + LOOKAHEAD_MS;
  });

  return (
    <div ref={containerRef}
      className="relative w-full bg-slate-950 border border-slate-800 rounded-md overflow-hidden"
      style={{ height: 280 }}>
      {/* hit line at the bottom */}
      <div className="absolute left-0 right-0 bottom-0 h-1 bg-indigo-500/70" />

      {/* notes */}
      {visible.map((n, i) => {
        const msUntilHit = n.startMs - currentMs;
        const bottom = -msUntilHit * PIXELS_PER_MS; // negative msUntilHit means past hit line
        const height = Math.max(8, n.durationMs * PIXELS_PER_MS);
        const left = xPercentForMidi(n.midi);
        const widthPct = (1 / whites.length) * 100 * (isBlackKey(n.midi) ? 0.7 : 0.85);
        const past = bottom > 0; // already crossed hit line
        return (
          <div key={`${i}-${n.midi}-${n.startMs}`}
            className={`absolute rounded-sm border ${
              past ? 'bg-indigo-700/40 border-indigo-700/40' : 'bg-indigo-500 border-indigo-300'
            }`}
            style={{
              left: `calc(${left}% - ${widthPct / 2}%)`,
              width: `${widthPct}%`,
              bottom: `${bottom}px`,
              height: `${height}px`,
            }}>
            {showLabels && (
              <span className="absolute inset-x-0 -top-4 text-[9px] text-slate-400 text-center">
                {midiToName(n.midi)}
              </span>
            )}
          </div>
        );
      })}

      {visible.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm">
          Press Play — notes will fall toward the line
        </div>
      )}
    </div>
  );
}

export type { FallingNote };
