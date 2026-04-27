import { isBlackKey, midiToName, pianoMidiRange, PIANO_MIN } from '../lib/midi';

interface Props {
  activeMidi: Set<number>;
  showLabels: boolean;
}

// Render an 88-key piano. White keys flow horizontally; black keys overlay.
export default function PianoView({ activeMidi, showLabels }: Props) {
  const all = pianoMidiRange();
  const whites = all.filter((m) => !isBlackKey(m));
  const whiteWidth = 100 / whites.length; // % per white key

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: '88 / 11' }}>
      {/* white keys */}
      <div className="absolute inset-0 flex">
        {whites.map((m) => {
          const active = activeMidi.has(m);
          return (
            <div key={m}
              className={`flex-1 border border-slate-700 rounded-b-md flex items-end justify-center pb-1 text-[9px] ${
                active ? 'bg-indigo-400 text-slate-900' : 'bg-slate-100 text-slate-500'
              }`}>
              {showLabels && midiToName(m).startsWith('C') && midiToName(m)}
            </div>
          );
        })}
      </div>
      {/* black keys */}
      <div className="absolute top-0 left-0 right-0 h-[60%] pointer-events-none">
        {all.filter(isBlackKey).map((m) => {
          // position black key over the boundary between two white keys
          const whiteIdxBefore = whites.indexOf(m - 1);
          const left = (whiteIdxBefore + 1) * whiteWidth - whiteWidth * 0.3;
          const active = activeMidi.has(m);
          return (
            <div key={m}
              style={{ left: `${left}%`, width: `${whiteWidth * 0.6}%` }}
              className={`absolute top-0 h-full rounded-b-md border border-slate-900 ${
                active ? 'bg-indigo-500' : 'bg-slate-900'
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
