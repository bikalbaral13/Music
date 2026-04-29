import { useEffect, useMemo, useRef } from 'react';

interface Props {
  /** Original key of the song, e.g. "F", "Bb", "Dm". */
  originalScale: string;
  /** Semitone offset relative to the original. -11..+11; we normalize to 0..11 internally. */
  transpose: number;
  /** Fired when the user lands on a new note. Returns shortest signed offset (-6..+5). */
  onChange: (transpose: number) => void;
}

const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

const ROOT_TO_PC: Record<string, number> = {
  C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,
};
const FLAT_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Cb','Dm','Gm','Cm','Fm','Bbm','Ebm','Abm']);

function originalPitchClass(scale: string): number {
  const m = scale.trim().match(/^([A-Ga-g])([#b]?)/);
  if (!m) return 0;
  const root = m[1].toUpperCase() + m[2];
  return ROOT_TO_PC[root] ?? 0;
}

function preferFlats(scale: string): boolean {
  const m = scale.trim().match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!m) return false;
  const root = m[1].toUpperCase() + (m[2] ?? '');
  const suffix = (m[3] ?? '').toLowerCase();
  const isMinor = suffix.startsWith('m') && !suffix.startsWith('maj');
  const lookup = isMinor ? `${root}m` : root;
  return FLAT_KEYS.has(lookup);
}

const ITEM_W = 56;          // matches .key-wheel-item flex-basis
const COPIES = 5;           // odd so a "middle" copy exists
const VISIBLE_PADDING = 4;  // notes shown on either side of the marker

// Convert a signed transpose into the nearest 0..11 pitch-class offset relative
// to the original key — and back. We round-trip through a 0..11 representation
// so the wheel always advances within one octave (musically equivalent).
function transposeToPcOffset(t: number): number {
  return ((t % 12) + 12) % 12;
}
function pcOffsetToShortest(off: number): number {
  // Shortest signed offset (-6..+5): keeps consumers' transpose value compact.
  return off > 6 ? off - 12 : off;
}

export default function KeyWheel({ originalScale, transpose, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const lastEmittedRef = useRef<number>(transpose);

  const origPc = originalPitchClass(originalScale);
  const useFlats = preferFlats(originalScale);
  const NAMES = useFlats ? FLATS : SHARPS;

  // Repeat the 12 notes COPIES times so users can scroll left/right without
  // hitting an edge. The middle copy is the canonical one we re-center to.
  const items = useMemo(() => {
    const arr: { pc: number; copy: number }[] = [];
    for (let c = 0; c < COPIES; c++) {
      for (let pc = 0; pc < 12; pc++) arr.push({ pc, copy: c });
    }
    return arr;
  }, []);

  const middleCopyStart = Math.floor(COPIES / 2) * 12;

  // Position the wheel so the currently selected note sits centered under
  // the marker. We center via scrollLeft = (target * ITEM_W) - (containerW/2 - ITEM_W/2).
  function scrollToPc(pc: number, behavior: ScrollBehavior = 'auto') {
    const el = trackRef.current;
    if (!el) return;
    const targetIdx = middleCopyStart + pc;
    const left = targetIdx * ITEM_W - el.clientWidth / 2 + ITEM_W / 2;
    el.scrollTo({ left, behavior });
  }

  // Sync wheel to external transpose (e.g. song change resets it to 0).
  useEffect(() => {
    const pc = transposeToPcOffset(transpose);
    const targetPc = (origPc + pc) % 12;
    lastEmittedRef.current = transpose;
    // Defer to next frame so the container has its layout width before we scroll.
    requestAnimationFrame(() => scrollToPc(targetPc, 'auto'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transpose, origPc]);

  function activeIdxFromScroll(): number {
    const el = trackRef.current;
    if (!el) return middleCopyStart;
    const center = el.scrollLeft + el.clientWidth / 2;
    return Math.round((center - ITEM_W / 2) / ITEM_W);
  }

  function commit(idx: number) {
    const pc = ((idx % 12) + 12) % 12;
    const offset = (pc - origPc + 12) % 12;
    const signed = pcOffsetToShortest(offset);
    if (signed !== lastEmittedRef.current) {
      lastEmittedRef.current = signed;
      onChange(signed);
    }
  }

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;

    // Re-center invisibly when the user has scrolled close to either edge,
    // so the wheel feels infinite without the browser ever hitting a bound.
    const idx = activeIdxFromScroll();
    if (idx < 12 || idx >= items.length - 12) {
      const pc = ((idx % 12) + 12) % 12;
      const targetIdx = middleCopyStart + pc;
      const left = targetIdx * ITEM_W - el.clientWidth / 2 + ITEM_W / 2;
      el.scrollLeft = left;
    }

    // Commit only after the user pauses, to avoid spamming transpose updates
    // while the scroll-snap animation is still in flight.
    if (settleRef.current) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      if (draggingRef.current) return;
      commit(activeIdxFromScroll());
    }, 110);
  }

  function onWheel(e: React.WheelEvent) {
    const el = trackRef.current;
    if (!el) return;
    e.preventDefault();
    el.scrollBy({ left: Math.sign(e.deltaY) * ITEM_W, behavior: 'smooth' });
  }

  function onItemClick(idx: number) {
    const el = trackRef.current;
    if (!el) return;
    const left = idx * ITEM_W - el.clientWidth / 2 + ITEM_W / 2;
    el.scrollTo({ left, behavior: 'smooth' });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const el = trackRef.current;
    if (!el) return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    el.scrollBy({ left: dir * ITEM_W, behavior: 'smooth' });
  }

  const activePc = (origPc + transposeToPcOffset(transpose)) % 12;

  return (
    <div
      className="key-wheel"
      tabIndex={0}
      role="slider"
      aria-label="Key (transpose)"
      aria-valuemin={0}
      aria-valuemax={11}
      aria-valuenow={activePc}
      aria-valuetext={NAMES[activePc]}
      onKeyDown={onKeyDown}
    >
      <div className="key-wheel-marker" />
      <div
        ref={trackRef}
        className="key-wheel-track"
        onScroll={onScroll}
        onWheel={onWheel}
        onPointerDown={() => { draggingRef.current = true; }}
        onPointerUp={() => {
          draggingRef.current = false;
          // Give scroll-snap a beat to finish, then commit.
          window.setTimeout(() => commit(activeIdxFromScroll()), 60);
        }}
      >
        {items.map((it, i) => {
          const isActive = it.pc === activePc;
          const dist = Math.abs((i - (middleCopyStart + activePc)));
          const isAdjacent = dist <= VISIBLE_PADDING && !isActive;
          return (
            <div
              key={i}
              className={`key-wheel-item ${isActive ? 'active' : isAdjacent ? 'adjacent' : ''}`}
              onClick={() => onItemClick(i)}
            >
              {NAMES[it.pc]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
