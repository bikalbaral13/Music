import { useRef } from 'react';
import type { Song } from '../types';

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

export default function SongList({
  songs, selectedId, onSelect, onEdit, onDelete, onNew, onExport, onImport,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h2 className="text-lg font-semibold tracking-tight">Library</h2>
        <span className="text-sm tabular" style={{ color: 'var(--text-muted)' }}>
          {songs.length} song{songs.length === 1 ? '' : 's'}
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

      {songs.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          No songs yet. Click "New Song".
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {songs.map((s) => (
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
              <div className="mt-2.5 flex items-center gap-1.5">
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
    </div>
  );
}
