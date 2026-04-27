import { useEffect, useMemo, useRef } from 'react';

interface Props {
  abc: string;
  /** Wall-clock playback position (ms). */
  currentMs: number;
  /** Live tempo (qpm) — used to map wall-clock time onto the parsed ABC timeline. */
  tempo: number;
}

type Token =
  | { kind: 'bar' }
  | {
      kind: 'note';
      label: string;
      pitchClass: number; // 0..11 for hue
      isBlack: boolean;
      startBeats: number; // quarter-note offsets
      endBeats: number;
    }
  | { kind: 'rest'; startBeats: number; endBeats: number };

interface Parsed {
  tokens: Token[];
  /** Tempo specified by Q: header (qpm). */
  parsedQpm: number;
}

const PC_MAP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const isBlackPc = (pc: number) => [1, 3, 6, 8, 10].includes(pc);

// Parse a length suffix at position i ("", "2", "/2", "3/2", "/", "//"). Returns
// the multiplier applied to the unit note length (L:), and how many chars were
// consumed.
function readLength(code: string, i: number): { value: number; consumed: number } {
  const start = i;
  let num = '';
  while (i < code.length && /[0-9]/.test(code[i])) { num += code[i]; i++; }
  let denom = '';
  if (i < code.length && code[i] === '/') {
    let slashes = 0;
    while (i < code.length && code[i] === '/') { slashes++; i++; }
    let d = '';
    while (i < code.length && /[0-9]/.test(code[i])) { d += code[i]; i++; }
    if (d) denom = d;
    else denom = String(Math.pow(2, slashes)); // "/" = /2, "//" = /4, etc.
  }
  const n = num ? parseInt(num, 10) : 1;
  const dn = denom ? parseInt(denom, 10) : 1;
  return { value: n / dn, consumed: i - start };
}

// Walk the ABC source and emit a flat token list. Repeats (|:...:|) are
// expanded once so playback time lines up. Multi-endings, tuplets, ties,
// inline meta, and grace notes are intentionally not handled — they would
// require a full parser; this is a best-effort visualizer.
function parseAbc(abc: string): Parsed {
  const lines = abc.split(/\r?\n/);
  let unitLenQuarters = 0.5; // default L:1/8 for our samples
  let parsedQpm = 120;
  let inBody = false;
  let cursor = 0;

  const tokens: Token[] = [];
  // Indices into `tokens` so we can duplicate sections on `:|`.
  let lastRepeatStart = 0;

  function pushNote(letter: string, octShift: number, lenMul: number, acc: string) {
    const isLower = letter === letter.toLowerCase();
    const baseOct = isLower ? 5 : 4; // ABC: 'C'=C4=60, 'c'=C5=72
    const pc = PC_MAP[letter.toUpperCase()];
    let midi = (baseOct + 1) * 12 + pc + octShift * 12;
    if (acc === '^') midi += 1;
    else if (acc === '_') midi -= 1;
    else if (acc === '^^') midi += 2;
    else if (acc === '__') midi -= 2;
    const durBeats = lenMul * unitLenQuarters;
    const startBeats = cursor;
    cursor += durBeats;
    const sharp = acc === '^' ? '♯' : acc === '_' ? '♭' : '';
    tokens.push({
      kind: 'note',
      label: sharp + letter,
      pitchClass: ((midi % 12) + 12) % 12,
      isBlack: isBlackPc(midi % 12),
      startBeats,
      endBeats: cursor,
    });
  }

  function pushRest(lenMul: number) {
    const durBeats = lenMul * unitLenQuarters;
    const startBeats = cursor;
    cursor += durBeats;
    tokens.push({ kind: 'rest', startBeats, endBeats: cursor });
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ABC headers are "X:", "T:", ..., "K:"; K: marks the transition to body.
    if (!inBody && /^[A-Za-z]:/.test(trimmed)) {
      const k = trimmed[0];
      const value = trimmed.slice(2).trim();
      if (k === 'L') {
        const m = value.match(/(\d+)\s*\/\s*(\d+)/);
        if (m) unitLenQuarters = 4 * (+m[1] / +m[2]);
      } else if (k === 'Q') {
        const m = value.match(/(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)/);
        if (m) parsedQpm = ((+m[1] / +m[2]) / 0.25) * +m[3];
        else {
          const m2 = value.match(/(\d+)/);
          if (m2) parsedQpm = +m2[1];
        }
      } else if (k === 'K') {
        inBody = true;
      }
      continue;
    }
    if (!inBody) continue;

    const code = trimmed.split('%')[0]; // strip line comments
    let i = 0;
    while (i < code.length) {
      const ch = code[i];
      if (/\s/.test(ch)) { i++; continue; }

      // Bar lines and repeats: consume the whole punctuation cluster.
      if (ch === '|' || ch === ':' || ch === ']' || ch === '[') {
        // Inline header like [K:G] — skip whole thing.
        if (ch === '[' && /^\[[A-Z]:/.test(code.slice(i))) {
          const close = code.indexOf(']', i);
          if (close > 0) { i = close + 1; continue; }
        }
        let cluster = '';
        while (i < code.length && /[|:\]\[]/.test(code[i])) {
          cluster += code[i];
          i++;
        }
        if (cluster.includes('|:')) {
          tokens.push({ kind: 'bar' });
          lastRepeatStart = tokens.length;
        } else if (cluster.includes(':|')) {
          // Duplicate the section since lastRepeatStart, advancing the cursor so
          // the replayed tokens get their own start times in the timeline.
          const slice = tokens.slice(lastRepeatStart);
          tokens.push({ kind: 'bar' });
          for (const t of slice) {
            if (t.kind === 'bar') {
              tokens.push({ kind: 'bar' });
            } else {
              const dur = t.endBeats - t.startBeats;
              const s = cursor;
              cursor += dur;
              if (t.kind === 'note') {
                tokens.push({ ...t, startBeats: s, endBeats: cursor });
              } else {
                tokens.push({ kind: 'rest', startBeats: s, endBeats: cursor });
              }
            }
          }
          lastRepeatStart = tokens.length;
        } else {
          tokens.push({ kind: 'bar' });
        }
        continue;
      }

      // Chord: take the first pitch only (visualizer simplification).
      if (ch === '[') {
        const close = code.indexOf(']', i);
        if (close < 0) { i++; continue; }
        const inside = code.slice(i + 1, close);
        i = close + 1;
        const lenInfo = readLength(code, i);
        i += lenInfo.consumed;
        // pull first note letter from chord contents
        const m = inside.match(/(\^\^|__|\^|_|=)?([A-Ga-g])([,']*)/);
        if (m) {
          const acc = m[1] ?? '';
          const letter = m[2];
          const octs = m[3] ?? '';
          const oct = (octs.match(/'/g)?.length ?? 0) - (octs.match(/,/g)?.length ?? 0);
          pushNote(letter, oct, lenInfo.value, acc);
        }
        continue;
      }

      // Tuplet markers like (3 — skip the marker, leave notes to be parsed normally
      if (ch === '(' && /\d/.test(code[i + 1] ?? '')) { i += 2; continue; }
      if (ch === '(' || ch === ')' || ch === '-') { i++; continue; } // ties/slurs

      // Accidentals
      let acc = '';
      if (ch === '^' || ch === '_' || ch === '=') {
        acc = ch;
        i++;
        if (i < code.length && (code[i] === '^' || code[i] === '_')) {
          acc += code[i]; i++;
        }
      }

      const c = code[i];
      if (c && /[A-Ga-g]/.test(c)) {
        i++;
        let oct = 0;
        while (i < code.length && (code[i] === ',' || code[i] === "'")) {
          oct += code[i] === "'" ? 1 : -1;
          i++;
        }
        const lenInfo = readLength(code, i);
        i += lenInfo.consumed;
        pushNote(c, oct, lenInfo.value, acc);
        continue;
      }
      if (c === 'z' || c === 'Z' || c === 'x' || c === 'X') {
        i++;
        const lenInfo = readLength(code, i);
        i += lenInfo.consumed;
        pushRest(lenInfo.value);
        continue;
      }

      // Anything else (decorations !..!, "..." chord symbols, etc.): skip char.
      if (ch === '!') {
        const close = code.indexOf('!', i + 1);
        i = close > 0 ? close + 1 : i + 1;
        continue;
      }
      if (ch === '"') {
        const close = code.indexOf('"', i + 1);
        i = close > 0 ? close + 1 : i + 1;
        continue;
      }
      i++;
    }
  }

  return { tokens, parsedQpm };
}

type PlayedToken = Exclude<Token, { kind: 'bar' }>;

// Group tokens into measures separated by 'bar' tokens.
function groupMeasures(tokens: Token[]): PlayedToken[][] {
  const measures: PlayedToken[][] = [];
  let cur: PlayedToken[] = [];
  for (const t of tokens) {
    if (t.kind === 'bar') {
      if (cur.length > 0) measures.push(cur);
      cur = [];
    } else {
      cur.push(t);
    }
  }
  if (cur.length > 0) measures.push(cur);
  return measures;
}

const noteColor = (pc: number, isBlack: boolean) => {
  const hue = pc * 30;
  return isBlack ? `hsl(${hue} 55% 38%)` : `hsl(${hue} 60% 55%)`;
};

export default function NoteBlocksView({ abc, currentMs, tempo }: Props) {
  const parsed = useMemo(() => parseAbc(abc), [abc]);
  const measures = useMemo(() => groupMeasures(parsed.tokens), [parsed.tokens]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert wall-clock ms → beats in the parsed timeline. Playback runs at
  // `tempo` qpm; the parser's beats are quarter notes, so beats-elapsed is
  // (currentMs / 60000) * tempo.
  const currentBeats = (currentMs / 60000) * tempo;

  const activeKey = useMemo(() => {
    let mIdx = -1, tIdx = -1;
    outer: for (let mi = 0; mi < measures.length; mi++) {
      const m = measures[mi];
      for (let ti = 0; ti < m.length; ti++) {
        const t = m[ti];
        if (currentBeats >= t.startBeats && currentBeats < t.endBeats) {
          mIdx = mi; tIdx = ti; break outer;
        }
      }
    }
    return { mIdx, tIdx };
  }, [measures, currentBeats]);

  // Auto-scroll the active block into view.
  useEffect(() => {
    if (activeKey.mIdx < 0) return;
    const node = containerRef.current?.querySelector<HTMLElement>(
      `[data-key="${activeKey.mIdx}-${activeKey.tIdx}"]`
    );
    if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeKey]);

  if (parsed.tokens.length === 0) {
    return (
      <div className="h-24 w-full rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
        No notes parsed from ABC.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full max-h-48 overflow-y-auto rounded-md bg-slate-950 border border-slate-800 p-2 space-y-1"
    >
      {measures.map((m, mi) => (
        <div key={mi} className="flex items-stretch gap-1 flex-wrap">
          <span className="text-[10px] text-slate-500 self-center w-6 text-right pr-1 select-none">
            {mi + 1}
          </span>
          {m.map((t, ti) => {
            const isActive = mi === activeKey.mIdx && ti === activeKey.tIdx;
            const dur = t.endBeats - t.startBeats;
            // Block width scales with note duration so half-notes look longer than eighths.
            const widthPx = Math.max(28, dur * 36);
            if (t.kind === 'rest') {
              return (
                <div
                  key={ti}
                  data-key={`${mi}-${ti}`}
                  className={`flex items-center justify-center rounded text-[11px] font-mono border border-dashed select-none ${
                    isActive
                      ? 'bg-amber-300/30 border-amber-300 text-amber-100 ring-2 ring-amber-300'
                      : 'border-slate-700 text-slate-500 bg-slate-900/40'
                  }`}
                  style={{ width: widthPx, height: 28 }}
                  title={`Rest · ${dur} beat${dur === 1 ? '' : 's'}`}
                >
                  —
                </div>
              );
            }
            // note
            return (
              <div
                key={ti}
                data-key={`${mi}-${ti}`}
                className={`flex items-center justify-center rounded text-[11px] font-mono font-semibold text-slate-50 select-none ${
                  isActive ? 'ring-2 ring-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.6)] scale-105' : ''
                }`}
                style={{
                  width: widthPx,
                  height: 28,
                  background: noteColor(t.pitchClass, t.isBlack),
                  borderLeft: t.isBlack ? '2px solid rgb(15 23 42)' : 'none',
                  transition: 'transform 80ms ease, box-shadow 80ms ease',
                }}
                title={`${NAMES[t.pitchClass]} · ${dur} beat${dur === 1 ? '' : 's'}`}
              >
                {t.label}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
