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
        const bottom = -msUntilHit * PIXELS_PER_MS;
        const height = Math.max(8, n.durationMs * PIXELS_PER_MS);
        const left = xPercentForMidi(n.midi);
        const widthPct = (1 / whites.length) * 100 * (isBlackKey(n.midi) ? 0.7 : 0.85);
        const past = bottom > 0;
        // "Bright light" — the note glows hottest as it crosses the hit line,
        // fades to a dim trail once it has passed.
        const endMs = n.startMs + n.durationMs;
        const sounding = currentMs >= n.startMs && currentMs <= endMs;
        const approachT = Math.max(0, Math.min(1, 1 - Math.min(800, Math.abs(msUntilHit)) / 800));
        const glowAlpha = sounding ? 0.95 : approachT * 0.65;
        return (
          <div key={`${i}-${n.midi}-${n.startMs}`}
            className={`absolute rounded-sm border ${
              past && !sounding
                ? 'bg-indigo-700/30 border-indigo-700/30'
                : sounding
                ? 'bg-amber-300 border-amber-100'
                : 'bg-indigo-400 border-indigo-200'
            }`}
            style={{
              left: `calc(${left}% - ${widthPct / 2}%)`,
              width: `${widthPct}%`,
              bottom: `${bottom}px`,
              height: `${height}px`,
              boxShadow: glowAlpha > 0
                ? `0 0 ${sounding ? 18 : 10}px ${sounding ? 6 : 3}px rgba(${sounding ? '253,224,71' : '129,140,248'},${glowAlpha})`
                : 'none',
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
