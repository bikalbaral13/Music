import { useMemo } from 'react';

// One of the kit pieces. Keep the set small — easier visuals, easier patterns.
export type DrumPiece = 'K' | 'S' | 'H' | 'O' | 'CR' | 'R' | 'T1' | 'T2' | 'F';

export interface DrumPattern {
  id: string;
  name: string;
  beats: number;        // beats per cycle (usually 4)
  slotsPerBeat: number; // 1, 2, 3 (triplet swing), or 4 (16ths)
  // length === beats * slotsPerBeat. Empty array = rest.
  slots: DrumPiece[][];
}

export const DRUM_PATTERNS: DrumPattern[] = [
  {
    id: 'rock',
    name: 'Rock (4/4)',
    beats: 4,
    slotsPerBeat: 2,
    slots: [
      ['K','H'], ['H'], ['S','H'], ['H'],
      ['K','H'], ['H'], ['S','H'], ['H'],
    ],
  },
  {
    id: 'backbeat',
    name: 'Backbeat (slow)',
    beats: 4,
    slotsPerBeat: 1,
    slots: [['K','H'], ['S','H'], ['K','H'], ['S','H']],
  },
  {
    id: 'disco',
    name: 'Disco (4-on-floor)',
    beats: 4,
    slotsPerBeat: 2,
    slots: [
      ['K','O'], ['H'], ['K','S'], ['H'],
      ['K','O'], ['H'], ['K','S'], ['H'],
    ],
  },
  {
    id: 'halftime',
    name: 'Half-time',
    beats: 4,
    slotsPerBeat: 2,
    slots: [
      ['K','H'], ['H'], ['H'], ['H'],
      ['S','H'], ['H'], ['H'], ['H'],
    ],
  },
  {
    id: 'march',
    name: 'March',
    beats: 4,
    slotsPerBeat: 2,
    slots: [
      ['K','S'], ['S'], ['S'], ['S'],
      ['K','S'], ['S'], ['S'], ['S'],
    ],
  },
  {
    id: 'swing',
    name: 'Swing (jazz ride)',
    beats: 4,
    slotsPerBeat: 3,
    slots: [
      ['K','R'], [], ['R'],
      ['S','R'], [], ['R'],
      ['K','R'], [], ['R'],
      ['S','R'], [], ['R'],
    ],
  },
  {
    id: 'sixeight',
    name: '6/8 ballad',
    beats: 6,
    slotsPerBeat: 1,
    slots: [['K','H'], ['H'], ['H'], ['S','H'], ['H'], ['H']],
  },
  {
    id: 'fill',
    name: 'Tom roll fill',
    beats: 4,
    slotsPerBeat: 4,
    slots: [
      ['K'],['H'],['T1'],['T1'],
      ['T2'],['T2'],['F'],['F'],
      ['K'],['H'],['T1'],['T2'],
      ['F'],['S'],['S'],['CR','K'],
    ],
  },
];

interface Props {
  pattern: DrumPattern;
  onPatternChange: (p: DrumPattern) => void;
  currentMs: number;
  tempo: number;
  isPlaying: boolean;
}

export default function Drumset({ pattern, onPatternChange, currentMs, tempo, isPlaying }: Props) {
  const slotIndex = useMemo(() => {
    if (!isPlaying) return -1;
    const slotSec = 60 / tempo / pattern.slotsPerBeat;
    const totalSlots = pattern.beats * pattern.slotsPerBeat;
    const idx = Math.floor((currentMs / 1000) / slotSec);
    return ((idx % totalSlots) + totalSlots) % totalSlots;
  }, [currentMs, tempo, pattern, isPlaying]);

  const activeHits = slotIndex >= 0 ? pattern.slots[slotIndex] ?? [] : [];

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex items-center gap-2">
        <label className="label">Groove:</label>
        <select
          value={pattern.id}
          onChange={(e) => {
            const p = DRUM_PATTERNS.find((x) => x.id === e.target.value);
            if (p) onPatternChange(p);
          }}
          className="field"
        >
          {DRUM_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <DrumKit active={activeHits} />

      <BeatStrip pattern={pattern} slotIndex={slotIndex} />
    </div>
  );
}

// Per-piece active styling. Drums get a scale + glow filter; cymbals get the
// same plus a slight rotation so they appear to wobble when struck.
function pieceStyle(on: boolean, opts: { cx: number; cy: number; cymbal?: boolean }): React.CSSProperties {
  return {
    transition: 'transform 80ms, filter 80ms',
    transformOrigin: `${opts.cx}px ${opts.cy}px`,
    transform: on
      ? (opts.cymbal ? 'scale(1.06) rotate(2deg)' : 'scale(1.06)')
      : 'scale(1) rotate(0deg)',
    filter: on
      ? (opts.cymbal
          ? 'drop-shadow(0 0 14px #ffd24a) drop-shadow(0 0 6px #fff6)'
          : 'drop-shadow(0 0 14px #ffb347) drop-shadow(0 0 4px #fff5)')
      : 'drop-shadow(0 3px 5px rgba(0,0,0,0.4))',
  };
}

function DrumKit({ active }: { active: DrumPiece[] }) {
  const isOn = (p: DrumPiece) => active.includes(p);
  return (
    <svg viewBox="0 0 620 400" width="620" height="400" style={{ maxWidth: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="dk-wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0"    stopColor="#a26e35"/>
          <stop offset="0.45" stopColor="#7d4d22"/>
          <stop offset="1"    stopColor="#3f2410"/>
        </linearGradient>
        <linearGradient id="dk-woodFloor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0"    stopColor="#9c6730"/>
          <stop offset="0.5"  stopColor="#73471f"/>
          <stop offset="1"    stopColor="#3a2110"/>
        </linearGradient>
        <radialGradient id="dk-head" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0"    stopColor="#fefaf0"/>
          <stop offset="0.55" stopColor="#ece2c8"/>
          <stop offset="1"    stopColor="#9b8a64"/>
        </radialGradient>
        <radialGradient id="dk-kickHead" cx="0.42" cy="0.38" r="0.68">
          <stop offset="0"    stopColor="#fff8e8"/>
          <stop offset="0.55" stopColor="#e9dcb5"/>
          <stop offset="1"    stopColor="#7a6230"/>
        </radialGradient>
        <linearGradient id="dk-snareShell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0"    stopColor="#dadada"/>
          <stop offset="0.5"  stopColor="#9a9a9a"/>
          <stop offset="1"    stopColor="#5e5e5e"/>
        </linearGradient>
        <radialGradient id="dk-cymbal" cx="0.35" cy="0.4" r="0.75">
          <stop offset="0"    stopColor="#f8e07b"/>
          <stop offset="0.45" stopColor="#d4a017"/>
          <stop offset="1"    stopColor="#7d5c0f"/>
        </radialGradient>
        <radialGradient id="dk-stageShadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.45"/>
          <stop offset="1" stopColor="#000" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Floor shadow */}
      <ellipse cx="310" cy="370" rx="290" ry="22" fill="url(#dk-stageShadow)"/>

      {/* Hardware (stands) — under everything */}
      <g stroke="#2a2a2a" strokeWidth="2.6" strokeLinecap="round">
        <line x1="92"  y1="220" x2="92"  y2="370"/>
        <line x1="55"  y1="135" x2="78"  y2="370"/>
        <line x1="540" y1="155" x2="500" y2="370"/>
        <line x1="155" y1="285" x2="120" y2="370"/>
        <line x1="155" y1="285" x2="195" y2="370"/>
        <line x1="155" y1="285" x2="155" y2="370"/>
      </g>

      {/* Floor tom */}
      <g style={pieceStyle(isOn('F'), { cx: 461, cy: 250 })}>
        <line x1="425" y1="270" x2="412" y2="370" stroke="#2a2a2a" strokeWidth="2.4"/>
        <line x1="495" y1="270" x2="508" y2="370" stroke="#2a2a2a" strokeWidth="2.4"/>
        <rect x="420" y="200" width="82" height="105" fill="url(#dk-woodFloor)" stroke="#2a1608" strokeWidth="1.5" rx="3"/>
        <ellipse cx="461" cy="305" rx="41" ry="8" fill="#3a1e0c"/>
        <ellipse cx="461" cy="200" rx="41" ry="11" fill="url(#dk-head)"/>
        <ellipse cx="461" cy="200" rx="41" ry="11" fill="none" stroke="#3a1e0c" strokeWidth="3.2"/>
        <g fill="#1a0d05">
          <circle cx="424" cy="225" r="2.6"/><circle cx="498" cy="225" r="2.6"/>
          <circle cx="424" cy="260" r="2.6"/><circle cx="498" cy="260" r="2.6"/>
          <circle cx="424" cy="290" r="2.6"/><circle cx="498" cy="290" r="2.6"/>
        </g>
      </g>

      {/* Kick */}
      <g style={pieceStyle(isOn('K'), { cx: 310, cy: 265 })}>
        <circle cx="310" cy="265" r="112" fill="#3a2310"/>
        <circle cx="310" cy="265" r="108" fill="none" stroke="#62381b" strokeWidth="2"/>
        <circle cx="310" cy="265" r="104" fill="url(#dk-kickHead)"/>
        <g fill="#1a0d05">
          <circle cx="310" cy="155" r="3.2"/><circle cx="376" cy="174" r="3.2"/>
          <circle cx="416" cy="226" r="3.2"/><circle cx="416" cy="304" r="3.2"/>
          <circle cx="376" cy="356" r="3.2"/><circle cx="310" cy="375" r="3.2"/>
          <circle cx="244" cy="356" r="3.2"/><circle cx="204" cy="304" r="3.2"/>
          <circle cx="204" cy="226" r="3.2"/><circle cx="244" cy="174" r="3.2"/>
        </g>
        <rect x="290" y="256" width="40" height="22" rx="3" fill="#1a0d05" stroke="#5a3a18" strokeWidth="0.8"/>
        <text x="310" y="271" textAnchor="middle" fontSize="9" fontFamily="Georgia, serif" fill="#d4a017" fontWeight="700">KICK</text>
        <circle cx="310" cy="265" r="3" fill="#5a3a18" opacity="0.4"/>
      </g>

      {/* Tom 1 */}
      <g style={pieceStyle(isOn('T1'), { cx: 248, cy: 200 })}>
        <line x1="248" y1="178" x2="280" y2="160" stroke="#2a2a2a" strokeWidth="2"/>
        <ellipse cx="248" cy="225" rx="38" ry="9" fill="#3a1e0c"/>
        <rect x="210" y="170" width="76" height="58" fill="url(#dk-wood)" stroke="#2a1608" strokeWidth="1.4"/>
        <ellipse cx="248" cy="170" rx="38" ry="10" fill="url(#dk-head)"/>
        <ellipse cx="248" cy="170" rx="38" ry="10" fill="none" stroke="#3a1e0c" strokeWidth="2.8"/>
        <g fill="#1a0d05">
          <circle cx="214" cy="190" r="2.2"/><circle cx="282" cy="190" r="2.2"/>
          <circle cx="214" cy="215" r="2.2"/><circle cx="282" cy="215" r="2.2"/>
        </g>
      </g>

      {/* Tom 2 */}
      <g style={pieceStyle(isOn('T2'), { cx: 372, cy: 198 })}>
        <line x1="372" y1="172" x2="340" y2="155" stroke="#2a2a2a" strokeWidth="2"/>
        <ellipse cx="372" cy="227" rx="42" ry="10" fill="#3a1e0c"/>
        <rect x="330" y="165" width="84" height="65" fill="url(#dk-wood)" stroke="#2a1608" strokeWidth="1.4"/>
        <ellipse cx="372" cy="165" rx="42" ry="11" fill="url(#dk-head)"/>
        <ellipse cx="372" cy="165" rx="42" ry="11" fill="none" stroke="#3a1e0c" strokeWidth="2.8"/>
        <g fill="#1a0d05">
          <circle cx="334" cy="186" r="2.2"/><circle cx="410" cy="186" r="2.2"/>
          <circle cx="334" cy="216" r="2.2"/><circle cx="410" cy="216" r="2.2"/>
        </g>
      </g>

      {/* Snare */}
      <g style={pieceStyle(isOn('S'), { cx: 155, cy: 270 })}>
        <rect x="100" y="252" width="110" height="40" fill="url(#dk-snareShell)" stroke="#3a3a3a" strokeWidth="1.2" rx="1.5"/>
        <line x1="100" y1="282" x2="210" y2="282" stroke="#a8a8a8" strokeWidth="0.7"/>
        <line x1="100" y1="285" x2="210" y2="285" stroke="#a8a8a8" strokeWidth="0.7"/>
        <line x1="100" y1="288" x2="210" y2="288" stroke="#a8a8a8" strokeWidth="0.7"/>
        <ellipse cx="155" cy="252" rx="55" ry="14" fill="url(#dk-head)"/>
        <ellipse cx="155" cy="252" rx="55" ry="14" fill="none" stroke="#7a7a7a" strokeWidth="3"/>
        <ellipse cx="155" cy="252" rx="55" ry="14" fill="none" stroke="#cfcfcf" strokeWidth="0.8"/>
        <g fill="#2a2a2a">
          <circle cx="105" cy="270" r="2"/><circle cx="125" cy="275" r="2"/>
          <circle cx="155" cy="278" r="2"/><circle cx="185" cy="275" r="2"/>
          <circle cx="205" cy="270" r="2"/>
        </g>
        <rect x="195" y="262" width="14" height="8" rx="1" fill="#2a2a2a"/>
      </g>

      {/* Hi-hat — closed (H) brings the cymbals together; open (O) splits them */}
      <g style={pieceStyle(isOn('H') || isOn('O'), { cx: 92, cy: 215, cymbal: true })}>
        <ellipse cx="92" cy={isOn('O') ? 226 : 222} rx="44" ry="11" fill="url(#dk-cymbal)" opacity="0.85"/>
        <ellipse cx="92" cy={isOn('O') ? 226 : 222} rx="44" ry="11" fill="none" stroke="#5a4210" strokeWidth="0.5"/>
        <ellipse cx="92" cy={isOn('O') ? 204 : 212} rx="44" ry="11" fill="url(#dk-cymbal)"/>
        <ellipse cx="92" cy={isOn('O') ? 204 : 212} rx="13" ry="3.5" fill="#7d5c0f"/>
        <circle cx="92" cy={isOn('O') ? 204 : 212} r="2" fill="#3a2a05"/>
        <ellipse cx="92" cy={isOn('O') ? 204 : 212} rx="32" ry="8" fill="none" stroke="#a07a10" strokeWidth="0.5" opacity="0.7"/>
        <ellipse cx="92" cy={isOn('O') ? 204 : 212} rx="22" ry="5.5" fill="none" stroke="#a07a10" strokeWidth="0.5" opacity="0.7"/>
        <text x="92" y="252" textAnchor="middle" fontSize="8" fill="#888">hi-hat{isOn('O') ? ' (open)' : ''}</text>
      </g>

      {/* Crash */}
      <g style={pieceStyle(isOn('CR'), { cx: 55, cy: 135, cymbal: true })}>
        <g transform="rotate(-15 55 135)">
          <ellipse cx="55" cy="138" rx="58" ry="14" fill="url(#dk-cymbal)" opacity="0.9"/>
          <ellipse cx="55" cy="135" rx="58" ry="14" fill="url(#dk-cymbal)"/>
          <ellipse cx="55" cy="135" rx="16" ry="4" fill="#7d5c0f"/>
          <circle cx="55" cy="135" r="2" fill="#3a2a05"/>
          <ellipse cx="55" cy="135" rx="42" ry="10" fill="none" stroke="#a07a10" strokeWidth="0.5" opacity="0.7"/>
          <ellipse cx="55" cy="135" rx="28" ry="6.5" fill="none" stroke="#a07a10" strokeWidth="0.5" opacity="0.7"/>
          <ellipse cx="55" cy="135" rx="50" ry="12" fill="none" stroke="#a07a10" strokeWidth="0.5" opacity="0.5"/>
        </g>
        <text x="20" y="175" fontSize="8" fill="#888">crash</text>
      </g>

      {/* Ride */}
      <g style={pieceStyle(isOn('R'), { cx: 540, cy: 155, cymbal: true })}>
        <g transform="rotate(10 540 155)">
          <ellipse cx="540" cy="158" rx="68" ry="17" fill="url(#dk-cymbal)" opacity="0.9"/>
          <ellipse cx="540" cy="155" rx="68" ry="17" fill="url(#dk-cymbal)"/>
          <ellipse cx="540" cy="155" rx="20" ry="5" fill="#7d5c0f"/>
          <circle cx="540" cy="155" r="2.5" fill="#3a2a05"/>
          <ellipse cx="540" cy="155" rx="52" ry="13" fill="none" stroke="#a07a10" strokeWidth="0.5" opacity="0.7"/>
          <ellipse cx="540" cy="155" rx="38" ry="9.5" fill="none" stroke="#a07a10" strokeWidth="0.5" opacity="0.7"/>
          <ellipse cx="540" cy="155" rx="60" ry="15" fill="none" stroke="#a07a10" strokeWidth="0.5" opacity="0.5"/>
        </g>
        <text x="585" y="190" fontSize="8" fill="#888">ride</text>
      </g>
    </svg>
  );
}

function BeatStrip({ pattern, slotIndex }: { pattern: DrumPattern; slotIndex: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 max-w-full">
      {pattern.slots.map((hits, i) => {
        const isCurrent = i === slotIndex;
        const isDownbeat = i % pattern.slotsPerBeat === 0;
        const beatNum = Math.floor(i / pattern.slotsPerBeat) + 1;
        return (
          <div key={i} className="flex flex-col items-center gap-0.5" style={{ minWidth: 26 }}>
            <div
              style={{
                width: isDownbeat ? 14 : 10,
                height: isDownbeat ? 14 : 10,
                borderRadius: '50%',
                background: isCurrent ? 'var(--accent)' : (isDownbeat ? 'var(--text-subtle)' : 'var(--surface-3, #2a2a2a)'),
                boxShadow: isCurrent ? '0 0 10px var(--accent)' : 'none',
                transition: 'background 80ms, box-shadow 80ms',
              }}
            />
            <span className="text-[9px] tabular" style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-subtle)', fontWeight: isCurrent ? 700 : 400 }}>
              {hits.length > 0 ? hits.join('+') : '·'}
            </span>
            {isDownbeat && (
              <span className="text-[10px] tabular" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{beatNum}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
