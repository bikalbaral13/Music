import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import abcjs from 'abcjs';
import { GM_INSTRUMENTS } from '../types';

export interface VoiceInfo {
  /** Zero-based index in the order voices appear in the ABC. */
  idx: number;
  /** V: identifier ("1", "2", "Flute" …). */
  id: string;
  /** Display name — `name="…"` from the V: line, or the GM instrument name, or `Voice N`. */
  label: string;
  /** GM program declared via `%%MIDI program` or `[I:MIDI program N]`; `null` if none. */
  program: number | null;
}

function gmName(program: number): string | null {
  const hit = GM_INSTRUMENTS.find((i) => i.value === program);
  return hit?.label ?? null;
}

export function parseVoices(abc: string): VoiceInfo[] {
  const voices: VoiceInfo[] = [];
  const byId = new Map<string, VoiceInfo>();
  let current: VoiceInfo | null = null;
  for (const line of abc.split(/\r?\n/)) {
    const trimmed = line.trim();
    const vMatch = trimmed.match(/^V:\s*(\S+)(.*)$/);
    if (vMatch) {
      const id = vMatch[1];
      const rest = vMatch[2] ?? '';
      const nameMatch = rest.match(/name="([^"]+)"/);
      const existing = byId.get(id);
      if (existing) {
        current = existing;
        if (nameMatch && !existing.label) existing.label = nameMatch[1];
      } else {
        const info: VoiceInfo = {
          idx: voices.length,
          id,
          label: nameMatch ? nameMatch[1] : '',
          program: null,
        };
        byId.set(id, info);
        voices.push(info);
        current = info;
      }
      continue;
    }
    const progMatch = trimmed.match(/^%%MIDI\s+program\s+(\d+)/i)
      ?? trimmed.match(/^\[I:MIDI\s+program\s+(\d+)\]/i);
    if (progMatch && current) {
      current.program = Number(progMatch[1]);
    }
  }
  for (const v of voices) {
    if (!v.label) {
      v.label = (v.program !== null && gmName(v.program)) || `Voice ${v.idx + 1}`;
    }
  }
  return voices;
}

export interface AbcSheet {
  sheetRef: RefObject<HTMLDivElement>;
  visualObj: any;
  voices: VoiceInfo[];
  /** Playback duration in ms at the song's *original* tempo. Live tempo changes are applied via synth warp. */
  totalAtSongTempoMs: number;
  error: string | null;
}

/**
 * Renders ABC into a hidden container and exposes the resulting visualObj,
 * voice metadata, and total duration. Re-renders only when `abc` or `transpose`
 * change — independent of other UI state.
 */
export function useAbcSheet(abc: string, transpose: number): AbcSheet {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [visualObj, setVisualObj] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const voices = useMemo(() => parseVoices(abc), [abc]);

  useEffect(() => {
    if (!sheetRef.current) return;
    try {
      const arr = abcjs.renderAbc(sheetRef.current, abc, {
        responsive: 'resize',
        visualTranspose: transpose,
        add_classes: true,
      });
      setError(null);
      setVisualObj(arr[0]);
    } catch (e) {
      setError((e as Error).message);
      setVisualObj(null);
    }
  }, [abc, transpose]);

  const totalAtSongTempoMs = useMemo(() => {
    if (!visualObj) return 0;
    try {
      const sec = typeof visualObj.getTotalTime === 'function' ? visualObj.getTotalTime() : 0;
      return Math.max(0, (sec || 0) * 1000);
    } catch { return 0; }
  }, [visualObj]);

  return { sheetRef, visualObj, voices, totalAtSongTempoMs, error };
}
