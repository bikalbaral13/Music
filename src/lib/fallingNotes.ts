import abcjs from 'abcjs';
import type { FallingNote } from '../components/FallingNotesView';

/**
 * Parse the ABC into a flat timeline of notes (one entry per pitch per onset)
 * scaled to the given qpm so wall-clock ms maps directly to playhead position.
 *
 * Renders into a throwaway off-screen container so the player's shared
 * visualObj/SynthController state isn't disturbed.
 */
export function buildFallingNotes(abc: string, qpm: number): FallingNote[] {
  if (typeof document === 'undefined') return [];
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;pointer-events:none';
  document.body.appendChild(container);
  try {
    const [vo] = abcjs.renderAbc(container, abc, { add_classes: false });
    if (!vo || typeof (vo as any).setUpAudio !== 'function') return [];
    const seq = (vo as any).setUpAudio({ qpm });
    const notes: FallingNote[] = [];
    for (const track of seq.tracks ?? []) {
      for (const ev of track) {
        if (ev?.cmd !== 'note' || typeof ev.pitch !== 'number') continue;
        notes.push({
          midi: ev.pitch,
          startMs: (ev.start ?? 0) * 1000,
          durationMs: (ev.duration ?? 0) * 1000,
        });
      }
    }
    return notes;
  } catch (e) {
    console.warn('buildFallingNotes failed:', e);
    return [];
  } finally {
    container.remove();
  }
}
