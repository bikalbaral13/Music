import { isBlackKey, midiToName, pianoMidiRange, PIANO_MIN } from '../lib/midi';

interface Props {
  activeMidi: Set<number>;
  showLabels: boolean;
  /** When true, active keys get a saturated glow so they read clearly under a
      falling-notes overlay. */
  bright?: boolean;
}

export default function PianoView({ activeMidi, showLabels, bright = false }: Props) {
  const all = pianoMidiRange();
  const whites = all.filter((m) => !isBlackKey(m));
  const whiteWidth = 100 / whites.length;

  const whiteActiveClass = bright
    ? 'bg-amber-300 text-slate-900 shadow-[0_0_18px_4px_rgba(253,224,71,0.85)]'
    : 'bg-indigo-400 text-slate-900';
  const blackActiveClass = bright
    ? 'bg-amber-400 shadow-[0_0_14px_3px_rgba(251,191,36,0.85)]'
    : 'bg-indigo-500';

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: '88 / 11' }}>
      <div className="absolute inset-0 flex">
        {whites.map((m) => {
          const active = activeMidi.has(m);
          return (
            <div key={m}
              className={`flex-1 border border-slate-700 rounded-b-md flex items-end justify-center pb-1 text-[9px] transition-shadow ${
                active ? whiteActiveClass : 'bg-slate-100 text-slate-500'
              }`}>
              {showLabels && midiToName(m).startsWith('C') && midiToName(m)}
            </div>
          );
        })}
      </div>
      <div className="absolute top-0 left-0 right-0 h-[60%] pointer-events-none">
        {all.filter(isBlackKey).map((m) => {
          const whiteIdxBefore = whites.indexOf(m - 1);
          const left = (whiteIdxBefore + 1) * whiteWidth - whiteWidth * 0.3;
          const active = activeMidi.has(m);
          return (
            <div key={m}
              style={{ left: `${left}%`, width: `${whiteWidth * 0.6}%` }}
              className={`absolute top-0 h-full rounded-b-md border border-slate-900 transition-shadow ${
                active ? blackActiveClass : 'bg-slate-900'
              }`}
              title={midiToName(m)}/>
          );
        })}
      </div>
      <div className="absolute -top-4 left-0 text-[10px] text-slate-500">
        A{Math.floor(PIANO_MIN / 12) - 1}
      </div>
    </div>
  );
}
