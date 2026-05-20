import { useMemo, useRef, useState } from 'react';
import type { Song, SongCategory } from '../types';

const CATEGORY_ORDER: SongCategory[] = ['Alankaars', 'Nepali Songs', 'Hindi Songs', 'English Songs', 'Bhajan', 'Other'];

interface Props {
  songs: Song[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

type SortKey = 'recent' | 'title' | 'tempo';

export default function SongList({
  songs, selectedId, onSelect, onEdit, onDelete, onNew, onExport, onImport,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [keyFilter, setKeyFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const keys = useMemo(() => {
    const set = new Set<string>();
    for (const s of songs) if (s.scale) set.add(s.scale);
    return Array.from(set).sort();
  }, [songs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = songs.filter((s) => {
      if (keyFilter && s.scale !== keyFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.composer ?? '').toLowerCase().includes(q) ||
        s.scale.toLowerCase().includes(q)
      );
    });
    out = [...out].sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      if (sortKey === 'tempo') return a.tempo - b.tempo;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
    return out;
  }, [songs, query, keyFilter, sortKey]);

  const grouped = useMemo(() => {
    const map = new Map<SongCategory, Song[]>();
    for (const s of filtered) {
      const cat: SongCategory = s.category ?? 'Other';
      const arr = map.get(cat);
      if (arr) arr.push(s);
      else map.set(cat, [s]);
    }
    return CATEGORY_ORDER
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
  }, [filtered]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-semibold tracking-tight">Library</h2>
        <span className="text-sm tabular" style={{ color: 'var(--text-muted)' }}>
          {filtered.length === songs.length
            ? `${songs.length} song${songs.length === 1 ? '' : 's'}`
            : `${filtered.length} of ${songs.length}`}
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={onNew} className="btn btn-primary">+ New Song</button>
          <button onClick={onExport} className="btn btn-ghost">Export JSON</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost">Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}/>
        </div>
      </div>

      <div className="library-toolbar">
        <div className="library-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search title, composer, key…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search songs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="library-search-clear"
              aria-label="Clear search"
              title="Clear"
            >
              ×
            </button>
          )}
        </div>

        <div className="library-sort">
          <label className="label" htmlFor="sort-key">Sort</label>
          <select
            id="sort-key"
            className="field"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="recent">Recently added</option>
            <option value="title">Title (A–Z)</option>
            <option value="tempo">Tempo (slow→fast)</option>
          </select>
        </div>
      </div>

      {keys.length > 0 && (
        <div className="library-chips" role="group" aria-label="Filter by key">
          <button
            type="button"
            className={`filter-chip ${keyFilter === null ? 'active' : ''}`}
            onClick={() => setKeyFilter(null)}
          >
            All keys
          </button>
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              className={`filter-chip ${keyFilter === k ? 'active' : ''}`}
              onClick={() => setKeyFilter((cur) => (cur === k ? null : k))}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {songs.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          No songs yet. Click "New Song".
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          No songs match your filters.{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => { setQuery(''); setKeyFilter(null); }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(({ category, items }) => {
            const isOpen = !collapsed[category];
            return (
              <section key={category} className="library-group">
                <button
                  type="button"
                  className="library-group-header"
                  aria-expanded={isOpen}
                  onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}
                >
                  <span className={`library-group-caret ${isOpen ? 'open' : ''}`} aria-hidden>▸</span>
                  <span className="library-group-title">{category}</span>
                  <span className="library-group-count tabular">{items.length}</span>
                </button>
                {isOpen && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                    {items.map((s) => (
                      <li
                        key={s.id}
                        className={`song-card ${s.id === selectedId ? 'selected' : ''}`}
                        onClick={() => onSelect(s.id)}
                      >
                        <div className="font-medium truncate">{s.title}</div>
                        {s.composer && (
                          <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {s.composer}
                          </div>
                        )}
                        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                          <span className="chip">Key {s.scale}</span>
                          <span className="chip tabular">{s.tempo} BPM</span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelect(s.id); }}
                            className="btn btn-primary"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            ▶ Play
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(s.id); }}
                            className="btn btn-ghost"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                            className="btn btn-danger ml-auto"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
