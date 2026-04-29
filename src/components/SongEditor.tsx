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
        <h2 className="text-lg font-semibold tracking-tight">
          {initial ? 'Edit Song' : 'New Song'}
        </h2>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="field" placeholder="Twinkle, Twinkle..."/>
        </Field>

        <Field label="Composer (optional)">
          <input value={composer} onChange={(e) => setComposer(e.target.value)}
            className="field"/>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Key / Scale">
            <input value={scale} onChange={(e) => setScale(e.target.value)}
              className="field" placeholder="C, G, Dm, F#..."/>
          </Field>
          <Field label="Tempo (BPM)">
            <input type="number" min={20} max={300} value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              className="field tabular"/>
          </Field>
        </div>

        <Field label="ABC Notation">
          <textarea value={abc} onChange={(e) => setAbc(e.target.value)}
            rows={14}
            className="field font-mono text-sm"
            spellCheck={false}/>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Tip: <code>K:</code> sets key, <code>Q:1/4=120</code> sets tempo, lowercase = higher octave.
            See <a className="underline" style={{ color: 'var(--accent)' }} href="https://abcnotation.com/learn" target="_blank" rel="noreferrer">abcnotation.com/learn</a>.
          </p>
        </Field>

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          Live Preview
        </h3>
        <div ref={previewRef} className="abc-render" />
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
