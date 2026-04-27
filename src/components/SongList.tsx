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
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h2 className="text-lg font-semibold">Library</h2>
        <span className="text-sm text-slate-400">{songs.length} song{songs.length === 1 ? '' : 's'}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={onNew}
            className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm">
            + New Song
          </button>
          <button onClick={onExport}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sm">
            Export JSON
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sm">
            Import JSON
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}/>
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="text-center text-slate-400 py-16">No songs yet. Click "New Song".</div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {songs.map((s) => (
            <li key={s.id}
              className={`rounded-lg border p-4 transition cursor-pointer ${
                s.id === selectedId
                  ? 'border-indigo-500 bg-slate-900'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
              }`}
              onClick={() => onSelect(s.id)}>
              <div className="font-medium truncate">{s.title}</div>
              {s.composer && <div className="text-xs text-slate-400 truncate">{s.composer}</div>}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span className="px-1.5 py-0.5 rounded bg-slate-800">Key {s.scale}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800">{s.tempo} BPM</span>
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                <button onClick={(e) => { e.stopPropagation(); onSelect(s.id); }}
                  className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500">▶ Play</button>
                <button onClick={(e) => { e.stopPropagation(); onEdit(s.id); }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Edit</button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  className="ml-auto px-2 py-1 rounded bg-red-900/40 hover:bg-red-800/60 text-red-200">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
