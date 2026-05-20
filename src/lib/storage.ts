import type { Song } from '../types';
import { loadSampleSongs } from '../data/sampleSongs';

const KEY = 'music-learner.songs.v1';

export async function loadSongs(): Promise<Song[]> {
  let samples: Song[] = [];
  try {
    samples = await loadSampleSongs();
  } catch (e) {
    console.error('Failed to load sample songs:', e);
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(samples));
      return samples;
    }
    const existing = JSON.parse(raw) as Song[];
    const byId = new Map(existing.map((s) => [s.id, s]));
    let changed = false;

    // Purge sample-* entries that have been removed from the manifest, so
    // edits/removals propagate to existing users on next load.
    const sampleIds = new Set(samples.map((s) => s.id));
    for (const id of Array.from(byId.keys())) {
      if (id.startsWith('sample-') && !sampleIds.has(id)) {
        byId.delete(id);
        changed = true;
      }
    }

    for (const sample of samples) {
      const cur = byId.get(sample.id);
      if (!cur) {
        byId.set(sample.id, sample);
        changed = true;
      } else if (sample.id.startsWith('sample-')) {
        const abcChanged = cur.abc !== sample.abc;
        const categoryChanged = cur.category !== sample.category;
        const titleChanged = cur.title !== sample.title;
        const composerChanged = cur.composer !== sample.composer;
        const createdAtChanged = cur.createdAt !== sample.createdAt;
        if (abcChanged || categoryChanged || titleChanged || composerChanged || createdAtChanged) {
          byId.set(sample.id, {
            ...cur,
            abc: sample.abc,
            category: sample.category,
            title: sample.title,
            composer: sample.composer,
            createdAt: sample.createdAt,
          });
          changed = true;
        }
      }
    }
    if (changed) {
      const merged = Array.from(byId.values());
      localStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    }
    return existing;
  } catch {
    return samples;
  }
}

export function saveSongs(songs: Song[]): void {
  localStorage.setItem(KEY, JSON.stringify(songs));
}

export function exportSongsAsJson(songs: Song[]): void {
  const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `music-learner-songs-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importSongsFromFile(file: File): Promise<Song[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error('Expected an array of songs');
        resolve(parsed as Song[]);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function newId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
