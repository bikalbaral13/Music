import type { Song, SongCategory } from '../types';

interface ManifestEntry {
  id: string;
  file: string;
  title: string;
  composer?: string;
  scale: string;
  tempo: number;
  category?: SongCategory;
  createdAt: number;
}

const MANIFEST_URL = `${import.meta.env.BASE_URL}songs/manifest.json`;
const SONGS_BASE = `${import.meta.env.BASE_URL}songs/`;

let cache: Promise<Song[]> | null = null;

export function loadSampleSongs(): Promise<Song[]> {
  if (!cache) cache = fetchSamples();
  return cache;
}

async function fetchSamples(): Promise<Song[]> {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`Failed to load song manifest (${res.status})`);
  const manifest = (await res.json()) as ManifestEntry[];

  const songs = await Promise.all(
    manifest.map(async (m): Promise<Song> => {
      const abcRes = await fetch(SONGS_BASE + m.file);
      if (!abcRes.ok) throw new Error(`Failed to load ${m.file} (${abcRes.status})`);
      const abc = await abcRes.text();
      return {
        id: m.id,
        title: m.title,
        composer: m.composer,
        scale: m.scale,
        tempo: m.tempo,
        category: m.category,
        createdAt: m.createdAt,
        abc,
      };
    }),
  );
  return songs;
}
