import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import abcjs from 'abcjs';
import { usePlayhead } from './usePlayhead';

const DRUMSET_PROGRAM = 118;

interface UseAbcSynthOptions {
  visualObj: any;
  abc: string;
  songTempoQpm: number;
  tempo: number;
  instrument: number;
  transpose: number;
  mutedVoices: Set<number>;
  audioCtxRef: MutableRefObject<AudioContext | null>;
  totalMs: number;
  onActivePitchesChange: (midi: Set<number>) => void;
  onActiveFingeringChange?: (finger: number | null) => void;
}

/**
 * Look up a fingering decoration (!1!…!5!) attached to the note that begins
 * at the given character position in the ABC source. abcjs's `startChar` for
 * a note points at the *start of the whole note expression*, including any
 * preceding chord symbol ("G") and `!N!` decorations — so we scan forward,
 * skipping chord/annotation strings, and return the most recent `!N!` seen
 * before the first note letter.
 */
function fingeringAtCharPos(abc: string, charPos: number): number | null {
  if (!Number.isFinite(charPos) || charPos < 0 || charPos >= abc.length) return null;
  const end = Math.min(abc.length, charPos + 25);
  let i = charPos;
  let finger: number | null = null;
  while (i < end) {
    const ch = abc[i];
    if (ch === '"') {
      // Skip chord-symbol or annotation "...".
      const close = abc.indexOf('"', i + 1);
      if (close < 0 || close >= end) return finger;
      i = close + 1;
      continue;
    }
    if (ch === '!') {
      const close = abc.indexOf('!', i + 1);
      if (close < 0 || close >= end) return finger;
      const inner = abc.slice(i + 1, close);
      const m = /^(?:finger)?([1-5])$/.exec(inner);
      if (m) finger = Number(m[1]);
      i = close + 1;
      continue;
    }
    if (/[a-gA-Gz]/.test(ch)) return finger; // hit the note (or rest)
    i++;
  }
  return finger;
}

export interface AbcSynth {
  ready: boolean;
  isPlaying: boolean;
  error: string | null;
  currentMs: number;
  play: () => Promise<void>;
  pause: () => void;
  restart: () => Promise<void>;
  seekRatio: (ratio: number) => void;
  setManualMs: (ms: number) => void;
  synthControlRef: MutableRefObject<any>;
}

/**
 * Owns the abcjs.synth.SynthController lifecycle (load / play / pause / seek /
 * restart) plus tempo-warp and master-volume side-effects. Pairs a private
 * playhead with the synth so position state stays in lockstep with audio.
 */
export function useAbcSynth(opts: UseAbcSynthOptions): AbcSynth {
  const {
    visualObj, abc, songTempoQpm, tempo, instrument, transpose, mutedVoices,
    audioCtxRef, totalMs, onActivePitchesChange, onActiveFingeringChange,
  } = opts;

  const synthControlRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playhead = usePlayhead(audioCtxRef);

  // Keep the latest callback in a ref so cursorControl doesn't capture stale
  // closures across remounts.
  const onActiveRef = useRef(onActivePitchesChange);
  useEffect(() => { onActiveRef.current = onActivePitchesChange; }, [onActivePitchesChange]);
  const onFingeringRef = useRef(onActiveFingeringChange);
  useEffect(() => { onFingeringRef.current = onActiveFingeringChange; }, [onActiveFingeringChange]);

  useEffect(() => {
    if (!visualObj || !abcjs.synth.supportsAudio()) return;
    let cancelled = false;

    async function init() {
      try {
        const audioCtx = audioCtxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;

        const cursorControl = {
          beatSubdivisions: 2,
          onStart: () => {
            playhead.start(0);
            setIsPlaying(true);
          },
          onFinished: () => {
            onActiveRef.current(new Set());
            onFingeringRef.current?.(null);
            setIsPlaying(false);
          },
          onEvent: (ev: any) => {
            if (!ev?.midiPitches) return;
            const next = new Set<number>();
            for (const p of ev.midiPitches) next.add(p.pitch);
            onActiveRef.current(next);

            // Pull the fingering decoration (!1!…!5!) off the source note, by
            // (a) checking abcelem.decoration on every element across every voice
            //     group in this event, then
            // (b) consulting the raw ABC source at each element's startChar plus
            //     the event-level startCharPos.
            let finger: number | null = null;
            const groups: any[][] = Array.isArray(ev.elements) ? ev.elements : [];
            outer: for (const group of groups) {
              if (!Array.isArray(group)) continue;
              for (const el of group) {
                const decs: string[] | undefined = el?.abcelem?.decoration;
                if (decs) {
                  for (const d of decs) {
                    const m = /^(?:finger)?([1-5])$/.exec(d);
                    if (m) { finger = Number(m[1]); break outer; }
                  }
                }
              }
            }
            if (finger === null) {
              const positions: number[] = [];
              for (const group of groups) {
                if (!Array.isArray(group)) continue;
                for (const el of group) {
                  const sc = el?.abcelem?.startChar;
                  if (typeof sc === 'number') positions.push(sc);
                }
              }
              if (typeof ev.startCharPos === 'number') positions.push(ev.startCharPos);
              for (const p of positions) {
                const f = fingeringAtCharPos(abc, p);
                if (f !== null) { finger = f; break; }
              }
            }
            onFingeringRef.current?.(finger);
          },
        };

        const synthControl = new abcjs.synth.SynthController();
        synthControl.load('#abc-audio', cursorControl, {
          displayLoop: false, displayRestart: true, displayPlay: true, displayProgress: true, displayWarp: true,
        });
        await synthControl.setTune(visualObj, false, {
          qpm: songTempoQpm,
          program: instrument,
          midiTranspose: transpose,
          voicesOff: Array.from(mutedVoices),
        });
        if (!cancelled) {
          synthControlRef.current = synthControl;
          setReady(true);
        }
      } catch (e) {
        setError(`Audio init failed: ${(e as Error).message}`);
      }
    }
    init();

    return () => {
      cancelled = true;
      try { synthControlRef.current?.pause(); } catch { /* noop */ }
      playhead.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualObj, instrument, transpose, songTempoQpm, mutedVoices]);

  // Tempo warp — keeps the synth aligned with the user's tempo setting.
  useEffect(() => {
    const ctrl = synthControlRef.current;
    if (!ctrl) return;
    const warpPercent = Math.round((tempo / songTempoQpm) * 100);
    try { ctrl.setWarp(warpPercent); } catch { /* noop */ }
  }, [tempo, songTempoQpm, ready]);

  // Silence the abcjs synth when the view instrument is the drum kit — the
  // melody shouldn't route through a percussion patch.
  useEffect(() => {
    const ctrl = synthControlRef.current;
    if (!ctrl) return;
    const vol = instrument === DRUMSET_PROGRAM ? 0 : 100;
    try { ctrl.setMasterVolume?.(vol); } catch { /* noop */ }
  }, [instrument, ready]);

  const play = useCallback(async () => {
    const ctx = audioCtxRef.current;
    if (ctx?.state === 'suspended') await ctx.resume();
    if (ctx) playhead.start(playhead.currentMs);
    try {
      await synthControlRef.current?.play();
      setIsPlaying(true);
    } catch (e) { setError((e as Error).message); }
  }, [audioCtxRef, playhead]);

  const pause = useCallback(() => {
    try { synthControlRef.current?.pause(); } catch { /* noop */ }
    playhead.stop();
    setIsPlaying(false);
  }, [playhead]);

  const restart = useCallback(async () => {
    const ctrl = synthControlRef.current;
    try { ctrl?.pause(); } catch { /* noop */ }
    playhead.stop();
    onActiveRef.current(new Set());
    setIsPlaying(false);
    playhead.setManualMs(0);

    if (ctrl && visualObj) {
      try {
        await ctrl.setTune(visualObj, false, {
          qpm: songTempoQpm,
          program: instrument,
          midiTranspose: transpose,
        });
        const warpPercent = Math.round((tempo / songTempoQpm) * 100);
        try { ctrl.setWarp(warpPercent); } catch { /* noop */ }
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [playhead, visualObj, songTempoQpm, instrument, transpose, tempo]);

  const seekRatio = useCallback((ratio: number) => {
    const ctrl = synthControlRef.current;
    if (!ctrl || totalMs <= 0) return;
    const clamped = Math.min(1, Math.max(0, ratio));
    try { ctrl.seek(clamped, 'percent'); } catch { /* noop */ }
    playhead.setManualMs(clamped * totalMs);
  }, [playhead, totalMs]);

  return {
    ready, isPlaying, error,
    currentMs: playhead.currentMs,
    play, pause, restart, seekRatio,
    setManualMs: playhead.setManualMs,
    synthControlRef,
  };
}
