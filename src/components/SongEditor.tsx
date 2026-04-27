import { useEffect, useRef, useState } from 'react';
import abcjs from 'abcjs';
import type { Song } from '../types';
import { newId } from '../lib/storage';

interface Props {
  initial: Song | null;
  onSave: (song: Song) => void;
  onCancel: () => void;
}

const BLANK_ABC = `X:1
T:My New Song
M:4/4
L:1/4
Q:1/4=100
K:C
CDEF GABc |`;

export default function SongEditor({ initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [composer, setComposer] = useState(initial?.composer ?? '');
  const [scale, setScale] = useState(initial?.scale ?? 'C');
  const [tempo, setTempo] = useState(initial?.tempo ?? 100);
  const [abc, setAbc] = useState(initial?.abc ?? BLANK_ABC);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewRef.current) {
      try {
        abcjs.renderAbc(previewRef.current, abc, { responsive: 'resize' });
      } catch {
        /* invalid ABC — ignore */
      }
    }
  }, [abc]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please give the song a title.');
      return;
    }
    const song: Song = {
      id: initial?.id ?? newId(),
      title: title.trim(),
      composer: composer.trim() || undefined,
      scale: scale.trim() || 'C',
      tempo: Number(tempo) || 100,
      abc,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    onSave(song);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{initial ? 'Edit Song' : 'New Song'}</h2>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
            placeholder="Twinkle, Twinkle..."/>
        </Field>

        <Field label="Composer (optional)">
          <input value={composer} onChange={(e) => setComposer(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"/>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Key / Scale">
            <input value={scale} onChange={(e) => setScale(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
              placeholder="C, G, Dm, F#..."/>
          </Field>
          <Field label="Tempo (BPM)">
            <input type="number" min={20} max={300} value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"/>
          </Field>
        </div>

        <Field label="ABC Notation">
          <textarea value={abc} onChange={(e) => setAbc(e.target.value)}
            rows={14}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 font-mono text-sm"
            spellCheck={false}/>
          <p className="text-xs text-slate-400 mt-1">
            Tip: <code>K:</code> sets key, <code>Q:1/4=120</code> sets tempo, lowercase = higher octave.
            See <a className="underline" href="https://abcnotation.com/learn" target="_blank" rel="noreferrer">abcnotation.com/learn</a>.
          </p>
        </Field>

        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500">
            Save
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700">
            Cancel
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Live Preview</h3>
        <div ref={previewRef} className="abc-render" />
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
