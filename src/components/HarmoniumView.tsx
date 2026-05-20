// Indian harmonium view: a 3-octave keyboard (C3–C6) with warm wood styling,
// a stylised drone-stop panel, and bellows on the right that "pump" while playing.

import { isBlackKey, midiToName, NOTE_NAMES } from '../lib/midi';

interface Props {
  activeMidi: Set<number>;
  showLabels: boolean;
  isPumping?: boolean; // animate bellows when something is playing
  /** Right-hand finger (1=thumb … 5=pinky) for the current note, parsed from ABC fingerings. */
  activeFinger?: number | null;
}

// Right-hand finger names + per-finger tint so 1 / 2 / 3 read at a glance.
const FINGER_META: Record<number, { name: string; bg: string }> = {
  1: { name: 'Thumb',  bg: '#e11d48' }, // rose-600
  2: { name: 'Index',  bg: '#2563eb' }, // blue-600
  3: { name: 'Middle', bg: '#16a34a' }, // green-600
  4: { name: 'Ring',   bg: '#d97706' }, // amber-600
  5: { name: 'Pinky',  bg: '#7c3aed' }, // violet-600
};

const MIN_MIDI = 48; // C3
const MAX_MIDI = 84; // C6

export default function HarmoniumView({ activeMidi, showLabels, isPumping, activeFinger }: Props) {
  const fingerMeta = activeFinger ? FINGER_META[activeFinger] : null;
  const range: number[] = [];
  for (let m = MIN_MIDI; m <= MAX_MIDI; m++) range.push(m);
  const whites = range.filter((m) => !isBlackKey(m));
  const whiteWidthPct = 100 / whites.length;

  return (
    <div className="rounded-md bg-amber-100/90 border border-amber-700 p-4 shadow-inner">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-amber-900 tracking-wide uppercase">Harmonium</span>
        <span className="text-xs text-amber-800 flex items-center gap-2">
          {fingerMeta && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-amber-50"
              style={{ background: fingerMeta.bg }}
              title={`Right hand · ${fingerMeta.name}`}
            >
              <span className="font-bold">{activeFinger}</span>
              <span className="text-[10px] opacity-90">{fingerMeta.name}</span>
            </span>
          )}
          Sounding: <strong className="text-amber-950">
            {activeMidi.size === 0 ? '—' : [...activeMidi].map((m) => NOTE_NAMES[m % 12]).join(' ')}
          </strong>
        </span>
      </div>

      {/* Drone stops (decorative) */}
      <div className="flex gap-2 mb-3">
        {['Sa', 'Pa', 'Ma', 'Ni'].map((s) => (
          <div key={s}
            className="px-3 py-1 rounded-full bg-amber-800/80 text-amber-50 text-[10px] font-medium border border-amber-900">
            {s}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {/* Bellows */}
          <div className="text-[10px] text-amber-800">Bellows</div>
          <div
            className={`w-16 h-6 rounded-md border-2 border-amber-900 bg-amber-200 origin-right ${
              isPumping ? 'animate-[pump_0.6s_ease-in-out_infinite]' : ''
            }`}
            style={{ background: 'repeating-linear-gradient(90deg, #fcd9a0 0 4px, #d49a4a 4px 8px)' }}
          />
        </div>
      </div>

      {/* Keyboard */}
      <div className="relative w-full select-none rounded-md overflow-hidden border-2 border-amber-900"
           style={{ aspectRatio: `${whites.length * 1.0} / 4.5` }}>
        {/* white keys */}
        <div className="absolute inset-0 flex">
          {whites.map((m) => {
            const active = activeMidi.has(m);
            const isC = m % 12 === 0;
            return (
              <div key={m}
                className={`relative flex-1 border-r border-amber-900/40 flex items-end justify-center pb-1 text-[9px] ${
                  active ? 'bg-rose-500 text-amber-50' : 'bg-amber-50 text-amber-900/70'
                }`}>
                {active && fingerMeta && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-bold text-amber-50 shadow-md border-2 border-amber-50"
                    style={{
                      background: fingerMeta.bg,
                      width: 'min(70%, 1.8rem)',
                      aspectRatio: '1',
                      fontSize: '0.85rem',
                    }}
                    title={`Right hand · ${fingerMeta.name}`}
                  >
                    {activeFinger}
                  </div>
                )}
                {showLabels && isC && midiToName(m)}
              </div>
            );
          })}
        </div>
        {/* black keys */}
        <div className="absolute top-0 left-0 right-0 h-[60%]">
          {range.filter(isBlackKey).map((m) => {
            const whiteIdxBefore = whites.indexOf(m - 1);
            const left = (whiteIdxBefore + 1) * whiteWidthPct - whiteWidthPct * 0.3;
            const active = activeMidi.has(m);
            return (
              <div key={m}
                style={{ left: `${left}%`, width: `${whiteWidthPct * 0.6}%` }}
                className={`absolute top-0 h-full rounded-b-md border border-amber-950 flex items-center justify-center pointer-events-none ${
                  active ? 'bg-rose-700' : 'bg-amber-950'
                }`}
                title={midiToName(m)}>
                {active && fingerMeta && (
                  <div
                    className="rounded-full flex items-center justify-center font-bold text-amber-50 shadow-md border-2 border-amber-50"
                    style={{
                      background: fingerMeta.bg,
                      width: '85%',
                      aspectRatio: '1',
                      fontSize: '0.75rem',
                    }}
                  >
                    {activeFinger}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Local keyframes for bellows pump animation */}
      <style>{`
        @keyframes pump {
          0%, 100% { transform: scaleX(1); }
          50%      { transform: scaleX(0.55); }
        }
      `}</style>
    </div>
  );
}
