import React, { useEffect, useMemo, useRef } from 'react';
import {
  type Mode,
  type Notation,
  type Spelling,
  SHARP_NAMES,
  FLAT_NAMES,
  SARGAM,
  pcOfKey,
  preferFlats,
  westernNameForPc,
  tonicPcFor,
} from '../lib/notation';

interface Props {
  abc: string;
  /** Wall-clock playback position (ms). */
  currentMs: number;
  /** Live tempo (qpm) — used to map wall-clock time onto the parsed ABC timeline. */
  tempo: number;
  /** User's transpose offset in semitones (from the Sound block). */
  transpose: number;
  /** The song's original key (the K: header, also visible in the Sound block).
      Used as the Sa anchor in Sargam notation. */
  songKey: string;
  /** Optional override for the Sa anchor — set to the bansuri's base scale
      when the flute is the active instrument so the sargam matches what the
      player actually fingers on that flute. The override is at a fixed
      absolute pitch and is unaffected by transpose. */
  saAnchor?: string;
  // Controlled view preferences — owned by the parent so the Instrument
  // block (e.g. Flute's top label) can mirror them.
  mode: Mode;
  onModeChange: (m: Mode) => void;
  notation: Notation;
  onNotationChange: (n: Notation) => void;
  spelling: Spelling;
  onSpellingChange: (s: Spelling) => void;
}

type Token =
  | { kind: 'bar' }
  | {
      kind: 'note';
      /** Literal label as written in source, with explicit accidental glyphs. */
      abcLabel: string;
      /** Pitch class derived purely from source letters + explicit accidentals. */
      literalPc: number;
      /** Pitch class with the K: header's key signature applied. */
      originalPc: number;
      /** Sharp-spelling label for the original (key-sig-applied) pitch class. */
      originalLabel: string;
      startBeats: number;
      endBeats: number;
    }
  | { kind: 'rest'; startBeats: number; endBeats: number };

interface Parsed {
  tokens: Token[];
  parsedQpm: number;
  /** Beats per measure (e.g. 4 for 4/4, 3 for 3/4, 6 for 6/8). */
  beatsPerMeasure: number;
  /** Length of one beat in quarter-note units (1 for 4/4, 0.5 for 6/8). */
  beatUnitQ: number;
}

const PC_MAP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const isBlackPc = (pc: number) => [1, 3, 6, 8, 10].includes(pc);

// Accidentals introduced by each major key's signature. Minor keys map back
// to their relative major via MINOR_TO_MAJOR.
const KEY_SHARPS: Record<string, Record<string, '#' | 'b'>> = {
  C: {},
  G: { F: '#' },
  D: { F: '#', C: '#' },
  A: { F: '#', C: '#', G: '#' },
  E: { F: '#', C: '#', G: '#', D: '#' },
  B: { F: '#', C: '#', G: '#', D: '#', A: '#' },
  'F#': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' },
  'C#': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#', B: '#' },
  F: { B: 'b' },
  Bb: { B: 'b', E: 'b' },
  Eb: { B: 'b', E: 'b', A: 'b' },
  Ab: { B: 'b', E: 'b', A: 'b', D: 'b' },
  Db: { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b' },
  Gb: { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b', C: 'b' },
};
const MINOR_TO_MAJOR: Record<string, string> = {
  A: 'C', E: 'G', B: 'D', 'F#': 'A', 'C#': 'E', 'G#': 'B', 'D#': 'F#', 'A#': 'C#',
  D: 'F', G: 'Bb', C: 'Eb', F: 'Ab', Bb: 'Db', Eb: 'Gb',
};

function getKeySig(scale: string): Record<string, '#' | 'b'> {
  const m = scale.trim().match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!m) return {};
  const root = m[1].toUpperCase() + (m[2] ?? '');
  const suffix = (m[3] ?? '').toLowerCase();
  const isMinor = suffix.startsWith('m') && !suffix.startsWith('maj');
  const major = isMinor ? MINOR_TO_MAJOR[root] ?? 'C' : root;
  return KEY_SHARPS[major] ?? {};
}

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
    else denom = String(Math.pow(2, slashes));
  }
  const n = num ? parseInt(num, 10) : 1;
  const dn = denom ? parseInt(denom, 10) : 1;
  return { value: n / dn, consumed: i - start };
}

// Resolve an ABC `M:` value into beat count + beat unit (in quarter notes).
// `M:C` is common time = 4/4; `M:C|` is cut time = 2/2; `M:none`/`M:free` = no meter.
function parseMeter(value: string): { beatsPerMeasure: number; beatUnitQ: number } {
  const v = value.trim();
  if (v === 'C') return { beatsPerMeasure: 4, beatUnitQ: 1 };
  if (v === 'C|') return { beatsPerMeasure: 2, beatUnitQ: 2 };
  const m = v.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return { beatsPerMeasure: 4, beatUnitQ: 1 };
  const num = +m[1];
  const den = +m[2];
  return { beatsPerMeasure: num, beatUnitQ: 4 / den };
}

function parseAbc(abc: string): Parsed {
  const lines = abc.split(/\r?\n/);
  let unitLenQuarters = 0.5;
  let parsedQpm = 120;
  let inBody = false;
  let cursor = 0;
  let keySig: Record<string, '#' | 'b'> = {};
  let meter = { beatsPerMeasure: 4, beatUnitQ: 1 };

  const tokens: Token[] = [];
  let lastRepeatStart = 0;

  function pushNote(letter: string, _octShift: number, lenMul: number, acc: string) {
    const upper = letter.toUpperCase();
    const naturalPc = PC_MAP[upper];

    // Literal pc — only explicit accidentals in the source modify it.
    let literalAdj = 0;
    if (acc === '^') literalAdj = 1;
    else if (acc === '_') literalAdj = -1;
    else if (acc === '^^') literalAdj = 2;
    else if (acc === '__') literalAdj = -2;

    // Original pc — apply key signature when no explicit accidental is present.
    // `=` (natural) overrides the key sig back to natural.
    let originalAdj = literalAdj;
    if (!acc && keySig[upper]) {
      originalAdj = keySig[upper] === '#' ? 1 : -1;
    } else if (acc === '=') {
      originalAdj = 0;
    }

    const literalPc = ((naturalPc + literalAdj) % 12 + 12) % 12;
    const originalPc = ((naturalPc + originalAdj) % 12 + 12) % 12;

    const accGlyph =
      acc === '^' ? '♯' :
      acc === '_' ? '♭' :
      acc === '^^' ? '𝄪' :
      acc === '__' ? '𝄫' :
      acc === '=' ? '♮' : '';

    const durBeats = lenMul * unitLenQuarters;
    const startBeats = cursor;
    cursor += durBeats;
    tokens.push({
      kind: 'note',
      abcLabel: accGlyph + upper,
      literalPc,
      originalPc,
      originalLabel: SHARP_NAMES[originalPc],
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

    if (!inBody && /^[A-Za-z]:/.test(trimmed)) {
      const k = trimmed[0];
      const value = trimmed.slice(2).trim();
      if (k === 'L') {
        const m = value.match(/(\d+)\s*\/\s*(\d+)/);
        if (m) unitLenQuarters = 4 * (+m[1] / +m[2]);
      } else if (k === 'M') {
        meter = parseMeter(value);
      } else if (k === 'Q') {
        const m = value.match(/(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)/);
        if (m) parsedQpm = ((+m[1] / +m[2]) / 0.25) * +m[3];
        else {
          const m2 = value.match(/(\d+)/);
          if (m2) parsedQpm = +m2[1];
        }
      } else if (k === 'K') {
        keySig = getKeySig(value);
        inBody = true;
      }
      continue;
    }
    if (!inBody) continue;

    const code = trimmed.split('%')[0];
    let i = 0;
    while (i < code.length) {
      const ch = code[i];
      if (/\s/.test(ch)) { i++; continue; }

      if (ch === '|' || ch === ':' || ch === ']' || ch === '[') {
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

      if (ch === '[') {
        const close = code.indexOf(']', i);
        if (close < 0) { i++; continue; }
        const inside = code.slice(i + 1, close);
        i = close + 1;
        const lenInfo = readLength(code, i);
        i += lenInfo.consumed;
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

      if (ch === '(' && /\d/.test(code[i + 1] ?? '')) { i += 2; continue; }
      if (ch === '(' || ch === ')' || ch === '-') { i++; continue; }

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

  return { tokens, parsedQpm, beatsPerMeasure: meter.beatsPerMeasure, beatUnitQ: meter.beatUnitQ };
}

type PlayedToken = Exclude<Token, { kind: 'bar' }>;

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

function noteStyle(pc: number): React.CSSProperties {
  const hue = pc * 30;
  const black = isBlackPc(pc);
  const sat = black ? 'var(--note-black-sat)' : 'var(--note-base-sat)';
  const light = black ? 'var(--note-black-light)' : 'var(--note-base-light)';
  return { background: `hsl(${hue} ${sat} ${light})` };
}

interface Display {
  label: React.ReactNode;
  pc: number;
  /** Plain-text version for tooltips/aria. */
  ariaLabel: string;
}

// Derive the chip label, pitch class (for hue), and accessible text for one
// note, given the view mode + notation system + spelling preference.
function deriveDisplay(
  t: Extract<Token, { kind: 'note' }>,
  mode: Mode,
  transpose: number,
  notation: Notation,
  spelling: Spelling,
  songKey: string,
  saAnchor: string | undefined,
): Display {
  // Pitch class shown in this row, depending on which interpretation tab is active.
  let pc: number;
  if (mode === 'abc') pc = t.literalPc;
  else if (mode === 'original') pc = t.originalPc;
  else pc = ((t.originalPc + transpose) % 12 + 12) % 12;

  if (notation === 'sargam') {
    const tonicPc = tonicPcFor(mode, songKey, transpose, saAnchor);
    const degree = ((pc - tonicPc) % 12 + 12) % 12;
    const s = SARGAM[degree];
    return {
      label: <span className={`sargam ${s.mark}`}>{s.dev}</span>,
      pc,
      ariaLabel: `${s.roman}${s.mark === 'komal' ? ' (komal)' : s.mark === 'tivra' ? ' (tivra)' : ''}`,
    };
  }

  // Western
  if (mode === 'abc') {
    return { label: t.abcLabel, pc, ariaLabel: t.abcLabel };
  }
  const name = westernNameForPc(pc, spelling, songKey);
  return { label: name, pc, ariaLabel: name };
}

const TAB_LABELS: { id: Mode; label: string; hint: string }[] = [
  { id: 'abc', label: 'ABC notes', hint: 'Letters as written in the ABC source' },
  { id: 'original', label: 'Original notes', hint: 'Source notes with the song key signature applied' },
  { id: 'transposed', label: 'Transposed notes', hint: 'Original notes shifted by the Sound block transpose' },
];

export default function NoteBlocksView({
  abc, currentMs, tempo, transpose, songKey, saAnchor,
  mode, onModeChange,
  notation, onNotationChange,
  spelling, onSpellingChange,
}: Props) {
  const parsed = useMemo(() => parseAbc(abc), [abc]);
  const measures = useMemo(() => groupMeasures(parsed.tokens), [parsed.tokens]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sargam doesn't apply meaningfully to literal ABC source letters — there's
  // no "Sa as written in source" concept. Auto-bounce the user to the
  // Original tab if they switch to Sargam while ABC was active.
  useEffect(() => {
    if (notation === 'sargam' && mode === 'abc') onModeChange('original');
  }, [notation, mode, onModeChange]);

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

  // Sheet-music-style follow scroll: when the active measure changes, glide
  // the container so the active row sits one row below the top edge — leaving
  // a row of context above and freshly revealing the rows below. We only
  // scroll on row changes (not on every note within a row) to avoid jitter.
  useEffect(() => {
    if (activeKey.mIdx < 0) return;
    const container = containerRef.current;
    const row = container?.querySelector<HTMLElement>(`[data-row="${activeKey.mIdx}"]`);
    if (!container || !row) return;
    const rowOffset = row.offsetTop - container.offsetTop;
    const rowH = row.offsetHeight + 4; // +gap
    const desired = Math.max(0, rowOffset - rowH);
    if (Math.abs(container.scrollTop - desired) > 4) {
      container.scrollTo({ top: desired, behavior: 'smooth' });
    }
  }, [activeKey.mIdx]);

  if (parsed.tokens.length === 0) {
    return (
      <div
        className="h-24 w-full rounded-md flex items-center justify-center text-xs"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          color: 'var(--text-subtle)',
        }}
      >
        No notes parsed from ABC.
      </div>
    );
  }

  const transposeDisabled = transpose === 0;

  // Each "beat" follows the meter's denominator, so 4/4 has 4 quarter-beats
  // per row and 6/8 has 6 eighth-beats per row. We render one measure per row,
  // every measure the same fixed width — bar boundaries line up vertically.
  const PX_PER_BEAT = 64;
  const NOTE_MIN_PX = 22;
  const beatsPerMeasure = parsed.beatsPerMeasure;
  const beatUnitQ = parsed.beatUnitQ;
  const measureWidthPx = beatsPerMeasure * PX_PER_BEAT;

  function pxForDurationQ(durQ: number): number {
    const beats = durQ / beatUnitQ;
    return Math.max(NOTE_MIN_PX, beats * PX_PER_BEAT);
  }

  // Sa anchor for the caption when sargam is active. Bansuri override (when
  // present) wins — it pins Sa to a fixed absolute pitch.
  const saKey = saAnchor
    ? saAnchor
    : mode === 'transposed'
      ? (() => {
          const pc = (pcOfKey(songKey) + transpose + 1200) % 12;
          return preferFlats(songKey) && spelling !== 'sharps' ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
        })()
      : songKey;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        {TAB_LABELS.map((t) => {
          const isDisabledTab = (t.id === 'transposed' && transposeDisabled)
            || (t.id === 'abc' && notation === 'sargam');
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => !isDisabledTab && onModeChange(t.id)}
              className={`note-tab ${mode === t.id ? 'active' : ''}`}
              disabled={isDisabledTab}
              title={
                isDisabledTab
                  ? t.id === 'abc'
                    ? 'ABC source letters have no Sargam mapping — switch Notation back to Western to view them'
                    : `${t.hint} — set a transpose value first`
                  : t.hint
              }
            >
              {t.label}
            </button>
          );
        })}
        <span className="text-xs ml-2 tabular" style={{ color: 'var(--text-subtle)' }}>
          {beatsPerMeasure}/{Math.round(4 / beatUnitQ)} · {beatsPerMeasure} beats per measure
          {mode === 'transposed' && transpose !== 0 && (
            <> · {transpose > 0 ? '+' : ''}{transpose} semitones</>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="label" style={{ marginRight: '0.25rem' }}>Notation</span>
          {(['western', 'sargam'] as Notation[]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onNotationChange(n)}
              className={`note-tab ${notation === n ? 'active' : ''}`}
            >
              {n === 'western' ? 'Western' : 'Sargam'}
            </button>
          ))}
        </div>
        {notation === 'western' && (
          <div className="flex items-center gap-1">
            <span className="label" style={{ marginRight: '0.25rem' }}>Spelling</span>
            {(['auto', 'sharps', 'flats'] as Spelling[]).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => onSpellingChange(sp)}
                className={`note-tab ${spelling === sp ? 'active' : ''}`}
                disabled={mode === 'abc'}
                title={
                  mode === 'abc'
                    ? 'Spelling is fixed by the ABC source on this tab'
                    : sp === 'auto'
                      ? `Use the spelling that matches the song key (${preferFlats(songKey) ? 'flats' : 'sharps'} for ${songKey})`
                      : sp === 'sharps' ? 'Force sharp spelling' : 'Force flat spelling'
                }
              >
                {sp === 'auto' ? 'Auto' : sp === 'sharps' ? '♯' : '♭'}
              </button>
            ))}
          </div>
        )}
        {notation === 'sargam' && (
          <span className="text-xs tabular" style={{ color: 'var(--text-subtle)' }}>
            Sa = <span className="font-mono" style={{ color: 'var(--text)' }}>{saKey}</span>
            {saAnchor
              ? <> (bansuri)</>
              : mode === 'transposed' && <> (transposed)</>}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="note-roll w-full max-h-56 overflow-y-auto space-y-1"
      >
        {measures.map((m, mi) => (
          <div
            key={mi}
            data-row={mi}
            className={`measure-row ${mi === activeKey.mIdx ? 'active' : ''}`}
          >
            <span className="measure-num tabular">{mi + 1}</span>
            <div
              className="measure"
              style={{
                width: measureWidthPx,
                ['--beat-width' as any]: `${PX_PER_BEAT}px`,
                ['--beats' as any]: beatsPerMeasure,
              }}
            >
              {/* Beat-tick guides (one per beat past the first) so the grid is felt visually */}
              {Array.from({ length: beatsPerMeasure - 1 }).map((_, k) => (
                <div
                  key={`tick-${k}`}
                  className={`beat-tick ${(k + 1) % 2 === 0 ? 'strong' : ''}`}
                  style={{ left: PX_PER_BEAT * (k + 1) }}
                  aria-hidden
                />
              ))}
              {m.map((t, ti) => {
                const isActive = mi === activeKey.mIdx && ti === activeKey.tIdx;
                const dur = t.endBeats - t.startBeats;
                const widthPx = pxForDurationQ(dur);
                if (t.kind === 'rest') {
                  return (
                    <div
                      key={ti}
                      data-key={`${mi}-${ti}`}
                      className={`rest-block ${isActive ? 'active' : ''}`}
                      style={{ width: widthPx }}
                      title={`Rest · ${(dur / beatUnitQ).toFixed(2)} beat${dur === beatUnitQ ? '' : 's'}`}
                    >
                      —
                    </div>
                  );
                }
                const { label, pc, ariaLabel } = deriveDisplay(t, mode, transpose, notation, spelling, songKey, saAnchor);
                return (
                  <div
                    key={ti}
                    data-key={`${mi}-${ti}`}
                    className={`note-block ${isActive ? 'active' : ''}`}
                    style={{
                      width: widthPx,
                      ...noteStyle(pc),
                    }}
                    title={`${ariaLabel} · ${(dur / beatUnitQ).toFixed(2)} beat${dur === beatUnitQ ? '' : 's'}`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
