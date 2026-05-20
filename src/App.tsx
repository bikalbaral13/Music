import { useEffect, useMemo, useRef, useState } from 'react';
import type { Song, SongCategory } from './types';

const SIDEBAR_CATEGORY_ORDER: SongCategory[] = ['Alankaars', 'Nepali Songs', 'Hindi Songs', 'English Songs', 'Bhajan', 'Other'];
import { exportSongsAsJson, importSongsFromFile, loadSongs, saveSongs } from './lib/storage';
import SongList from './components/SongList';
import SongEditor from './components/SongEditor';
import Player from './components/Player';
import WheelView from './components/WheelView';
import MusicToolsPanel from './components/MusicToolsPanel';

type View = 'player' | 'editor' | 'library' | 'wheel';
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' ? 'light' : 'dark';
}

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('player');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const sidebarSearchRef = useRef<HTMLInputElement>(null);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    loadSongs()
      .then((initial) => {
        if (cancelled) return;
        setSongs(initial);
        if (initial.length > 0) setSelectedId(initial[0].id);
      })
      .catch((e) => console.error('Failed to load songs:', e));
    return () => { cancelled = true; };
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
    setView('player');
  }

  function handleEdit(id: string | null) {
    setEditingId(id);
    setView('editor');
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
    setView('player');
  }

  function handleGenerated(song: Song) {
    setSongs((prev) => [song, ...prev]);
    setSelectedId(song.id);
    setView('player');
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this song?')) return;
    setSongs((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  const sidebarSongs = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      (s.composer ?? '').toLowerCase().includes(q) ||
      s.scale.toLowerCase().includes(q)
    );
  }, [songs, sidebarQuery]);

  const sidebarGroups = useMemo(() => {
    const map = new Map<SongCategory, Song[]>();
    for (const s of sidebarSongs) {
      const cat: SongCategory = s.category ?? 'Other';
      const arr = map.get(cat);
      if (arr) arr.push(s);
      else map.set(cat, [s]);
    }
    return SIDEBAR_CATEGORY_ORDER
      .filter((c) => map.has(c))
      .map((c) => ({
        category: c,
        items: [...map.get(c)!].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
      }));
  }, [sidebarSongs]);

  function selectByOffset(offset: number) {
    if (songs.length === 0) return;
    const idx = selectedId ? songs.findIndex((s) => s.id === selectedId) : -1;
    const nextIdx = idx < 0
      ? (offset > 0 ? 0 : songs.length - 1)
      : (idx + offset + songs.length) % songs.length;
    setSelectedId(songs[nextIdx].id);
    setView('player');
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '?' && !typing) {
        e.preventDefault();
        setShowShortcuts((p) => !p);
        return;
      }
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false);
        return;
      }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        sidebarSearchRef.current?.focus();
      } else if (e.key === '[') {
        e.preventDefault();
        setSidebarOpen((p) => !p);
      } else if (e.key === 'b' || e.key === 'B') {
        setView('library');
      } else if (e.key === 'w' || e.key === 'W') {
        setView('wheel');
      } else if (e.key === 'p' || e.key === 'P') {
        if (selectedSong) setView('player');
      } else if (e.key === 'e' || e.key === 'E') {
        if (selectedSong) handleEdit(selectedSong.id);
      } else if (e.key === 'n' || e.key === 'N') {
        handleEdit(null);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        selectByOffset(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        selectByOffset(-1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, selectedId, showShortcuts]);

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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSidebarOpen((p) => !p)}
            title={sidebarOpen ? 'Hide sidebar ([)' : 'Show sidebar ([)'}
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <span aria-hidden style={{ color: 'var(--accent)' }}>♪</span>
            <span style={{ color: 'var(--accent)' }}>Music</span>
            <span>Learner</span>
          </h1>

          {view !== 'player' && selectedSong && (
            <button
              type="button"
              className="nav-link ml-2"
              onClick={() => setView('player')}
              title="Back to Player (P)"
            >
              ← Player
            </button>
          )}

          <button
            type="button"
            className={`nav-link ml-2 ${view === 'wheel' ? 'active' : ''}`}
            onClick={() => setView('wheel')}
            title="Music Theory Wheel (W)"
          >
            ◎ Wheel
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="icon-btn ml-1"
              title="Keyboard shortcuts (?)"
              aria-label="Show keyboard shortcuts"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
              className="icon-btn"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className={`app-shell with-tools ${sidebarOpen ? 'with-sidebar' : ''}`}>
        {sidebarOpen && (
          <aside className="app-sidebar" aria-label="Songs">
            <div className="app-sidebar-header">
              <span className="section-title">Library</span>
              <button
                type="button"
                className="link-btn text-xs"
                onClick={() => { handleEdit(null); }}
                title="New song (N)"
              >
                + New
              </button>
            </div>
            <div className="app-sidebar-search">
              <input
                ref={sidebarSearchRef}
                type="search"
                placeholder="Search… ( / )"
                value={sidebarQuery}
                onChange={(e) => setSidebarQuery(e.target.value)}
                aria-label="Search songs"
              />
            </div>
            <div className="app-sidebar-list" role="listbox" aria-label="Song list">
              {sidebarSongs.length === 0 ? (
                <div className="app-sidebar-empty">No songs.</div>
              ) : sidebarGroups.map(({ category, items }) => {
                const isOpen = !sidebarCollapsed[category];
                return (
                  <div key={category} className="app-sidebar-group">
                    <button
                      type="button"
                      className="app-sidebar-group-header"
                      aria-expanded={isOpen}
                      onClick={() => setSidebarCollapsed((c) => ({ ...c, [category]: !c[category] }))}
                    >
                      <span className={`app-sidebar-group-caret ${isOpen ? 'open' : ''}`} aria-hidden>▸</span>
                      <span className="app-sidebar-group-title">{category}</span>
                      <span className="app-sidebar-group-count tabular">{items.length}</span>
                    </button>
                    {isOpen && (
                      <ul className="app-sidebar-group-items">
                        {items.map((s) => (
                          <li
                            key={s.id}
                            role="option"
                            aria-selected={s.id === selectedId}
                            className={`app-sidebar-item ${s.id === selectedId ? 'selected' : ''}`}
                            onClick={() => handleSelect(s.id)}
                            title={s.title}
                          >
                            <div className="app-sidebar-item-main">
                              <div className="app-sidebar-item-title">{s.title}</div>
                              <div className="app-sidebar-item-meta tabular">
                                {s.scale} · {s.tempo} BPM
                              </div>
                            </div>
                            <button
                              type="button"
                              className="app-sidebar-item-edit"
                              onClick={(e) => { e.stopPropagation(); handleEdit(s.id); }}
                              title="Edit song (E)"
                              aria-label={`Edit ${s.title}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="app-sidebar-footer">
              <button
                type="button"
                className="link-btn text-xs"
                onClick={() => setView('library')}
                title="Browse all (B)"
              >
                Browse all →
              </button>
            </div>
          </aside>
        )}

        <main className="app-main">
          {view === 'wheel' && <WheelView />}
          {view === 'library' && (
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
          {view === 'editor' && (
            <SongEditor
              initial={editingSong}
              onSave={handleSave}
              onCancel={() => setView(selectedSong ? 'player' : 'library')}
            />
          )}
          {view === 'player' && (
            selectedSong ? (
              <Player key={selectedSong.id} song={selectedSong} />
            ) : (
              <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
                {songs.length === 0 ? (
                  <>
                    No songs yet.{' '}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => handleEdit(null)}
                    >
                      Create one
                    </button>
                    .
                  </>
                ) : (
                  <>Pick a song from the sidebar to start playing.</>
                )}
              </div>
            )
          )}
        </main>

        <MusicToolsPanel onCreate={handleGenerated} />
      </div>

      {showShortcuts && (
        <div
          className="shortcuts-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={() => setShowShortcuts(false)}
        >
          <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <span className="section-title">Keyboard shortcuts</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close"
                title="Close (Esc)"
              >
                ×
              </button>
            </div>
            <dl className="shortcuts-grid">
              <dt><kbd>Space</kbd></dt><dd>Play / pause</dd>
              <dt><kbd>↑</kbd> <kbd>↓</kbd> / <kbd>J</kbd> <kbd>K</kbd></dt><dd>Previous / next song</dd>
              <dt><kbd>P</kbd></dt><dd>Player view</dd>
              <dt><kbd>B</kbd></dt><dd>Browse all (Library)</dd>
              <dt><kbd>W</kbd></dt><dd>Music Theory Wheel</dd>
              <dt><kbd>E</kbd></dt><dd>Edit current song</dd>
              <dt><kbd>N</kbd></dt><dd>New song</dd>
              <dt><kbd>/</kbd></dt><dd>Focus sidebar search</dd>
              <dt><kbd>[</kbd></dt><dd>Toggle sidebar</dd>
              <dt><kbd>?</kbd></dt><dd>Show / hide this panel</dd>
              <dt><kbd>Esc</kbd></dt><dd>Close panel</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
