import type { Song } from '../types';
import { SAMPLE_SONGS } from '../data/sampleSongs';

const KEY = 'music-learner.songs.v1';

export function loadSongs(): Song[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // Seed with samples on first run
      localStorage.setItem(KEY, JSON.stringify(SAMPLE_SONGS));
      return SAMPLE_SONGS;
    }
    const existing = JSON.parse(raw) as Song[];
    // Merge in any sample songs that the user doesn't already have (by id) —
    // ensures newly added bundled samples appear for returning users.
    const ids = new Set(existing.map((s) => s.id));
    const missing = SAMPLE_SONGS.filter((s) => !ids.has(s.id));
    if (missing.length > 0) {
      const merged = [...missing, ...existing];
      localStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    }
    return existing;
  } catch {
    return SAMPLE_SONGS;
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
