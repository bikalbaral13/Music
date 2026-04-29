import { useEffect, useMemo, useState } from 'react';
import type { Song } from './types';
import { exportSongsAsJson, importSongsFromFile, loadSongs, saveSongs } from './lib/storage';
import SongList from './components/SongList';
import SongEditor from './components/SongEditor';
import Player from './components/Player';

type Tab = 'library' | 'editor' | 'player';
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' ? 'light' : 'dark';
}

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('library');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const initial = loadSongs();
    setSongs(initial);
    if (initial.length > 0) setSelectedId(initial[0].id);
  }, []);

  useEffect(() => {
    if (songs.length > 0) saveSongs(songs);
  }, [songs]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('ml-theme', theme); } catch { /* noop */ }
  }, [theme]);

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
      <header
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in oklab, var(--bg) 80%, transparent)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <span aria-hidden style={{ color: 'var(--accent)' }}>♪</span>
            <span style={{ color: 'var(--accent)' }}>Music</span>
            <span>Learner</span>
          </h1>
          <nav className="flex gap-1 ml-auto items-center">
            {(['library', 'editor', 'player'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t === 'editor' && !editingId) setEditingId(null);
                  setTab(t);
                }}
                className={`nav-link capitalize ${tab === t ? 'active' : ''}`}
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
              className="icon-btn ml-1"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
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
            <Player key={selectedSong.id} song={selectedSong} />
          ) : (
            <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
              No song selected. Pick one from the Library.
            </div>
          )
        )}
      </main>
    </div>
  );
}
