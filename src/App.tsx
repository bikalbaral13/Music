import { useEffect, useMemo, useState } from 'react';
import type { Song } from './types';
import { exportSongsAsJson, importSongsFromFile, loadSongs, saveSongs } from './lib/storage';
import SongList from './components/SongList';
import SongEditor from './components/SongEditor';
import Player from './components/Player';

type Tab = 'library' | 'editor' | 'player';

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('library');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const initial = loadSongs();
    setSongs(initial);
    if (initial.length > 0) setSelectedId(initial[0].id);
  }, []);

  useEffect(() => {
    if (songs.length > 0) saveSongs(songs);
  }, [songs]);

  const selectedSong = useMemo(
    () => songs.find((s) => s.id === selectedId) ?? null,
    [songs, selectedId]
  );
  const editingSong = useMemo(
    () => songs.find((s) => s.id === editingId) ?? null,
    [songs, editingId]
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    setTab('player');
  }

  function handleEdit(id: string | null) {
    setEditingId(id);
    setTab('editor');
  }

  function handleSave(song: Song) {
    setSongs((prev) => {
      const idx = prev.findIndex((s) => s.id === song.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = song;
        return next;
      }
      return [song, ...prev];
    });
    setSelectedId(song.id);
    setTab('player');
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this song?')) return;
    setSongs((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function handleImport(file: File) {
    try {
      const imported = await importSongsFromFile(file);
      setSongs((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const s of imported) map.set(s.id, s);
        return Array.from(map.values());
      });
      alert(`Imported ${imported.length} songs.`);
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <h1 className="text-xl font-semibold tracking-tight">
            🎵 <span className="text-indigo-400">Music</span> Learner
          </h1>
          <nav className="flex gap-1 ml-auto">
            {(['library', 'editor', 'player'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t === 'editor' && !editingId) setEditingId(null);
                  setTab(t);
                }}
                className={`px-3 py-1.5 rounded-md text-sm capitalize transition ${
                  tab === t
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {tab === 'library' && (
          <SongList
            songs={songs}
            selectedId={selectedId}
            onSelect={handleSelect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNew={() => handleEdit(null)}
            onExport={() => exportSongsAsJson(songs)}
            onImport={handleImport}
          />
        )}
        {tab === 'editor' && (
          <SongEditor
            initial={editingSong}
            onSave={handleSave}
            onCancel={() => setTab(selectedSong ? 'player' : 'library')}
          />
        )}
        {tab === 'player' && (
          selectedSong ? (
            <Player song={selectedSong} />
          ) : (
            <div className="text-center text-slate-400 py-20">
              No song selected. Pick one from the Library.
            </div>
          )
        )}
      </main>

    </div>
  );
}
