import { useCallback, useRef, useState, type RefObject } from 'react';

export interface Playhead {
  currentMs: number;
  setManualMs: (ms: number) => void;
  start: (offsetMs: number) => void;
  stop: () => void;
}

/**
 * rAF-driven playhead, anchored to an AudioContext clock so the displayed
 * position stays in sync with audio scheduling instead of drifting with the
 * render cadence.
 */
export function usePlayhead(audioCtxRef: RefObject<AudioContext | null>): Playhead {
  const [currentMs, setCurrentMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const audioStartCtxRef = useRef<number>(0);

  const tick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = (ctx.currentTime - audioStartCtxRef.current) * 1000;
    setCurrentMs(elapsed);
    rafRef.current = requestAnimationFrame(tick);
  }, [audioCtxRef]);

  const start = useCallback((offsetMs: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    audioStartCtxRef.current = ctx.currentTime - offsetMs / 1000;
    if (rafRef.current === null) tick();
  }, [audioCtxRef, tick]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const setManualMs = useCallback((ms: number) => {
    setCurrentMs(ms);
    const ctx = audioCtxRef.current;
    if (ctx) audioStartCtxRef.current = ctx.currentTime - ms / 1000;
  }, [audioCtxRef]);

  return { currentMs, setManualMs, start, stop };
}
