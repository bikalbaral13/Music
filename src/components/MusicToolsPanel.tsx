import { useEffect, useRef, useState } from 'react';
import type { Song } from '../types';
import { generateSong, audioSong, type Mood, type Progression } from '../lib/musicGen';
import { generateWithLyria, toDataUrl, LYRIA_MODELS } from '../lib/lyriaGen';
import {
  STEM_METHODS,
  type StemMethod,
  decodeAudio,
  processStem,
  audioBufferToWav,
} from '../lib/stemSplit';
import { detectPitch, type PitchResult } from '../lib/pitchDetect';
import {
  DETECTION_METHODS,
  type DetectionMethod,
  detectKey,
  recordToAudioBuffer,
  type KeyDetectionResult,
} from '../lib/keyDetect';
import { analyzeNoteRange, type NoteRangeResult } from '../lib/noteRange';
import { detectTempo, type TempoResult } from '../lib/tempoDetect';
import { analyzeLoudness, type LoudnessResult } from '../lib/loudness';
import {
  transcribeAudio,
  transcriptionToSong,
  type TranscriptionResult,
} from '../lib/audioTranscribe';

interface Props {
  onCreate: (song: Song) => void;
}

const KEY_OPTIONS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const MOODS: Mood[] = ['happy', 'romantic', 'energetic', 'calm', 'melancholic'];
const PROGRESSIONS: { value: Progression; label: string }[] = [
  { value: 'pop',      label: 'Pop (I–V–vi–IV)' },
  { value: 'folk',     label: 'Folk (I–IV–V–I)' },
  { value: 'doowop',   label: "Doo-wop (I–vi–IV–V)" },
  { value: 'jazz',     label: 'Jazz (ii–V–I–I)' },
  { value: 'romantic', label: 'Romantic (I–vi–IV–V)' },
];

interface Block {
  id: string;
  title: string;
}

const BLOCKS: Block[] = [
  { id: 'create',  title: '✨ Create Music' },
  { id: 'ai',      title: '🤖 Create Music With AI' },
  { id: 'stems',   title: '🎚 Stem Splitter' },
  { id: 'pitch',   title: '🎤 Frequency Detector' },
  { id: 'keyfind', title: '🎹 Key Detector' },
  { id: 'range',   title: '📏 Note Range Analyser' },
  { id: 'tempo',   title: '⏱ Tempo / BPM Tracker' },
  { id: 'loud',    title: '📢 Loudness Meter' },
  { id: 'tx',      title: '🎼 Audio → ABC Transcription' },
  // Future tools can be added here as additional foldable blocks.
];

export default function MusicToolsPanel({ onCreate }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="tools-panel" aria-label="Music tools">
      <div className="tools-panel-header">
        <span className="section-title">Music Tools</span>
      </div>
      <div className="tools-panel-body">
        {BLOCKS.map((b) => {
          const isOpen = !collapsed[b.id];
          return (
            <section key={b.id} className="tools-block">
              <button
                type="button"
                className="tools-block-header"
                aria-expanded={isOpen}
                onClick={() => setCollapsed((c) => ({ ...c, [b.id]: !c[b.id] }))}
              >
                <span className={`tools-block-caret ${isOpen ? 'open' : ''}`} aria-hidden>▸</span>
                <span className="tools-block-title">{b.title}</span>
              </button>
              {isOpen && (
                <div className="tools-block-body">
                  {b.id === 'create'  && <CreateMusicTool onCreate={onCreate} />}
                  {b.id === 'ai'      && <CreateMusicWithAITool onCreate={onCreate} />}
                  {b.id === 'stems'   && <StemSplitterTool />}
                  {b.id === 'pitch'   && <FrequencyDetectorTool />}
                  {b.id === 'keyfind' && <KeyDetectorTool />}
                  {b.id === 'range'   && <NoteRangeAnalyserTool />}
                  {b.id === 'tempo'   && <TempoTrackerTool />}
                  {b.id === 'loud'    && <LoudnessMeterTool />}
                  {b.id === 'tx'      && <TranscribeTool onCreate={onCreate} />}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function CreateMusicTool({ onCreate }: { onCreate: (song: Song) => void }) {
  const [title, setTitle] = useState('Untitled Tune');
  const [keyRoot, setKeyRoot] = useState('C');
  const [isMinor, setIsMinor] = useState(false);
  const [tempo, setTempo] = useState(110);
  const [bars, setBars] = useState(16);
  const [mood, setMood] = useState<Mood>('happy');
  const [progression, setProgression] = useState<Progression>('pop');
  const [useFlute, setUseFlute] = useState(true);
  const [usePiano, setUsePiano] = useState(true);
  const [useViolin, setUseViolin] = useState(true);
  const [useUkulele, setUseUkulele] = useState(true);
  const [seedText, setSeedText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  function apply() {
    const parsedSeed = seedText.trim() === '' ? undefined : Number(seedText);
    const seed = Number.isFinite(parsedSeed) ? parsedSeed : undefined;
    const finalTitle = title.trim() || 'Untitled Tune';
    try {
      const song = generateSong({
        title: finalTitle,
        key: keyRoot,
        isMinor,
        tempo,
        bars,
        mood,
        progression,
        instruments: {
          flute: useFlute,
          piano: usePiano,
          violin: useViolin,
          ukulele: useUkulele,
        },
        seed,
      });
      onCreate(song);
      setStatus(`Created "${finalTitle}" — added to Library.`);
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <div className="tools-form">
      <div className="tools-field">
        <label className="label">Name</label>
        <input
          type="text"
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Tune"
        />
      </div>

      <div className="tools-field-row">
        <div className="tools-field" style={{ flex: 1 }}>
          <label className="label">Key</label>
          <select className="field" value={keyRoot} onChange={(e) => setKeyRoot(e.target.value)}>
            {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="tools-field" style={{ flex: 1 }}>
          <label className="label">Mode</label>
          <select className="field" value={isMinor ? 'm' : 'M'} onChange={(e) => setIsMinor(e.target.value === 'm')}>
            <option value="M">Major</option>
            <option value="m">Minor</option>
          </select>
        </div>
      </div>

      <div className="tools-field-row">
        <div className="tools-field" style={{ flex: 1 }}>
          <label className="label tabular">Tempo: {tempo} BPM</label>
          <input
            type="range"
            min={40} max={200} step={1}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
          />
        </div>
        <div className="tools-field" style={{ flex: 1 }}>
          <label className="label tabular">Length: {bars} bars</label>
          <input
            type="range"
            min={4} max={64} step={2}
            value={bars}
            onChange={(e) => setBars(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="tools-field">
        <label className="label">Mood</label>
        <select className="field" value={mood} onChange={(e) => setMood(e.target.value as Mood)}>
          {MOODS.map((m) => (
            <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="tools-field">
        <label className="label">Chord progression</label>
        <select className="field" value={progression} onChange={(e) => setProgression(e.target.value as Progression)}>
          {PROGRESSIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="tools-field">
        <label className="label">Instruments</label>
        <div className="tools-checks">
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={useFlute} onChange={(e) => setUseFlute(e.target.checked)} /> Flute (melody)
          </label>
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={usePiano} onChange={(e) => setUsePiano(e.target.checked)} /> Piano (chords)
          </label>
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={useViolin} onChange={(e) => setUseViolin(e.target.checked)} /> Violin (pedal)
          </label>
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={useUkulele} onChange={(e) => setUseUkulele(e.target.checked)} /> Ukulele (strum)
          </label>
        </div>
      </div>

      <div className="tools-field">
        <label className="label">Seed (optional — same number = same song)</label>
        <input
          type="text"
          className="field tabular"
          value={seedText}
          onChange={(e) => setSeedText(e.target.value)}
          placeholder="random"
        />
      </div>

      <button type="button" className="btn btn-primary tools-apply" onClick={apply}>
        Apply — Create &amp; Save
      </button>

      {status && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>{status}</p>
      )}
    </div>
  );
}

interface StemResult {
  method: StemMethod;
  url: string;       // ObjectURL for <audio src=>/download
  filename: string;
}

function StemSplitterTool() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState<StemMethod>('karaoke');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<StemResult | null>(null);

  function onFile(f: File | null) {
    setFile(f);
    setResult((cur) => {
      if (cur) URL.revokeObjectURL(cur.url);
      return null;
    });
    setStatus(f ? `Loaded: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)` : null);
  }

  async function separate() {
    if (!file) {
      setStatus('Pick an audio file first.');
      return;
    }
    setBusy(true);
    setStatus('Decoding audio…');
    try {
      const decoded = await decodeAudio(file);
      setStatus(`Processing (${decoded.duration.toFixed(1)}s, ${decoded.sampleRate} Hz)…`);
      // Yield to the browser so the status text paints.
      await new Promise((r) => setTimeout(r, 30));
      const out = await processStem(decoded, method);
      const blob = audioBufferToWav(out);
      const url = URL.createObjectURL(blob);
      const stem = STEM_METHODS.find((m) => m.value === method)?.label.replace(/\W+/g, '_') ?? method;
      const filename = `${file.name.replace(/\.[^.]+$/, '')}__${stem}.wav`;
      setResult((cur) => {
        if (cur) URL.revokeObjectURL(cur.url);
        return { method, url, filename };
      });
      setStatus(`Done — ${(blob.size / 1024 / 1024).toFixed(2)} MB WAV.`);
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const hint = STEM_METHODS.find((m) => m.value === method)?.hint;

  return (
    <div className="tools-form">
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Client-side DSP (no ML). For Demucs/Spleeter-quality separation,
        a backend or in-browser neural model would be needed.
      </p>

      <div className="tools-field">
        <label className="label">Upload audio (mp3 / wav / m4a / ogg)</label>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: '0.78rem' }}
        />
      </div>

      <div className="tools-field">
        <label className="label">Method</label>
        <select className="field" value={method} onChange={(e) => setMethod(e.target.value as StemMethod)}>
          {STEM_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {hint && (
          <p className="text-xs" style={{ color: 'var(--text-subtle)', marginTop: '0.2rem' }}>{hint}</p>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary tools-apply"
        onClick={separate}
        disabled={busy || !file}
      >
        {busy ? 'Working…' : 'Separate Stem'}
      </button>

      {status && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>{status}</p>
      )}

      {result && (
        <div className="tools-stem-result">
          <audio controls src={result.url} style={{ width: '100%' }} />
          <a
            href={result.url}
            download={result.filename}
            className="btn btn-subtle"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', justifyContent: 'center' }}
          >
            ⬇ Download {result.filename}
          </a>
        </div>
      )}
    </div>
  );
}

function FrequencyDetectorTool() {
  const [running, setRunning] = useState(false);
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs hold the live audio graph so the rAF loop doesn't re-init on every render.
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    bufRef.current = null;
    setRunning(false);
    setPitch(null);
  };

  // Cleanup on unmount.
  useEffect(() => () => stop(), []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctor();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096; // 4096 samples ≈ 93 ms at 44.1 kHz — fine for ~60 Hz lows
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      streamRef.current = stream;
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      bufRef.current = buf;
      setRunning(true);

      const tick = () => {
        const a = analyserRef.current;
        const b = bufRef.current;
        const c = ctxRef.current;
        if (!a || !b || !c) return;
        a.getFloatTimeDomainData(b as Float32Array<ArrayBuffer>);
        const result = detectPitch(b, c.sampleRate);
        setPitch(result);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError((e as Error).message ?? 'Microphone unavailable');
      stop();
    }
  }

  const centsClamped = pitch ? Math.max(-50, Math.min(50, pitch.cents)) : 0;
  const inTune = pitch && Math.abs(pitch.cents) < 10;

  return (
    <div className="tools-form">
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Sing or play a single sustained note into the mic. Best with
        monophonic input — chords confuse autocorrelation.
      </p>

      <button
        type="button"
        className={`btn ${running ? 'btn-subtle' : 'btn-primary'} tools-apply`}
        onClick={() => (running ? stop() : start())}
      >
        {running ? '■ Stop' : '🎤 Start listening'}
      </button>

      {error && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      {running && (
        <div className="pitch-readout">
          <div className="pitch-readout-main">
            <div
              className="pitch-note"
              style={{ color: inTune ? '#16a34a' : pitch ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              {pitch ? pitch.noteName : '—'}
            </div>
            <div className="pitch-hz tabular">
              {pitch ? `${pitch.frequency.toFixed(1)} Hz` : 'listening…'}
            </div>
          </div>

          <div className="pitch-meter" aria-label="cents deviation">
            <div className="pitch-meter-track">
              <div className="pitch-meter-center" />
              <div
                className="pitch-meter-needle"
                style={{
                  left: `calc(50% + ${centsClamped}%)`,
                  background: inTune ? '#16a34a' : 'var(--accent)',
                  visibility: pitch ? 'visible' : 'hidden',
                }}
              />
            </div>
            <div className="pitch-meter-labels tabular">
              <span>−50¢</span>
              <span>{pitch ? `${pitch.cents >= 0 ? '+' : ''}${pitch.cents.toFixed(0)}¢` : ''}</span>
              <span>+50¢</span>
            </div>
          </div>

          <div className="pitch-amp" style={{ visibility: pitch ? 'visible' : 'hidden' }}>
            <div
              className="pitch-amp-bar"
              style={{ width: `${Math.min(100, (pitch?.amplitude ?? 0) * 400)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function KeyDetectorTool() {
  const [source, setSource] = useState<'upload' | 'record'>('upload');
  const [method, setMethod] = useState<DetectionMethod>('krumhansl');
  const [recordSec, setRecordSec] = useState(10);
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [audioLabel, setAudioLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'recording' | 'detecting' | 'decoding'>(null);
  const [result, setResult] = useState<KeyDetectionResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onUpload(f: File | null) {
    if (!f) return;
    setBusy('decoding');
    setStatus(`Decoding ${f.name}…`);
    setResult(null);
    try {
      const buf = await decodeAudio(f);
      setAudio(buf);
      setAudioLabel(`${f.name} · ${buf.duration.toFixed(1)}s`);
      setStatus('Audio ready — click Detect.');
    } catch (e) {
      setStatus(`Decode failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function record() {
    setBusy('recording');
    setStatus(`Recording for ${recordSec}s — sing or play your song…`);
    setResult(null);
    try {
      const buf = await recordToAudioBuffer(recordSec * 1000);
      setAudio(buf);
      setAudioLabel(`Live recording · ${buf.duration.toFixed(1)}s`);
      setStatus('Recording done — click Detect.');
    } catch (e) {
      setStatus(`Recording failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function detect() {
    if (!audio) {
      setStatus('Need audio first — upload a file or record one.');
      return;
    }
    setBusy('detecting');
    setStatus('Analysing chromagram…');
    setResult(null);
    // Yield so the status text paints before the heavy FFT loop runs.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const r = detectKey(audio, method);
      setResult(r);
      setStatus(null);
    } catch (e) {
      setStatus(`Detection failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const methodHint = DETECTION_METHODS.find((m) => m.value === method)?.hint;

  return (
    <div className="tools-form">
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Major or minor key detection via Krumhansl-Schmuckler chroma profile
        matching. Best on harmonic content (≥ 5 s); humming a single note
        is too thin to fit a key.
      </p>

      <div className="tools-field">
        <label className="label">Source</label>
        <div className="tools-checks" role="radiogroup">
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" name="keyfind-src" checked={source === 'upload'} onChange={() => setSource('upload')} />
            Upload audio file
          </label>
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" name="keyfind-src" checked={source === 'record'} onChange={() => setSource('record')} />
            Record live (mic)
          </label>
        </div>
      </div>

      {source === 'upload' && (
        <div className="tools-field">
          <label className="label">Audio file (mp3 / wav / m4a / ogg)</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            style={{ fontSize: '0.78rem' }}
            disabled={busy !== null}
          />
        </div>
      )}

      {source === 'record' && (
        <>
          <div className="tools-field">
            <label className="label tabular">Duration: {recordSec}s</label>
            <input
              type="range" min={5} max={30} step={1}
              value={recordSec}
              onChange={(e) => setRecordSec(Number(e.target.value))}
              disabled={busy === 'recording'}
            />
          </div>
          <button
            type="button"
            className="btn btn-subtle"
            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
            onClick={record}
            disabled={busy !== null}
          >
            {busy === 'recording' ? '● Recording…' : '🎤 Record now'}
          </button>
        </>
      )}

      <div className="tools-field">
        <label className="label">Method</label>
        <select className="field" value={method} onChange={(e) => setMethod(e.target.value as DetectionMethod)}>
          {DETECTION_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {methodHint && (
          <p className="text-xs" style={{ color: 'var(--text-subtle)', marginTop: '0.2rem' }}>{methodHint}</p>
        )}
      </div>

      {audioLabel && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loaded: {audioLabel}</p>
      )}

      <button
        type="button"
        className="btn btn-primary tools-apply"
        onClick={detect}
        disabled={busy !== null || !audio}
      >
        {busy === 'detecting' ? 'Analysing…' : 'Detect'}
      </button>

      {status && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{status}</p>
      )}

      {result && (
        <div className="key-result">
          <div className="key-result-main">
            <span className="key-result-label">KEY</span>
            <span className="key-result-key">{result.rootName}</span>
            <span className="key-result-label">MODE</span>
            <span className="key-result-mode">{result.mode}</span>
          </div>
          <div className="key-result-conf tabular">
            Confidence: {(result.confidence * 100).toFixed(1)}%
          </div>
          {result.alternatives.length > 1 && (
            <details className="key-result-alts">
              <summary>Top alternatives</summary>
              <ol>
                {result.alternatives.slice(1).map((a, i) => (
                  <li key={i} className="tabular">
                    {a.rootName} {a.mode} — {(a.correlation * 100).toFixed(1)}%
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function NoteRangeAnalyserTool() {
  const [source, setSource] = useState<'upload' | 'record'>('upload');
  const [recordSec, setRecordSec] = useState(15);
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [audioLabel, setAudioLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'recording' | 'decoding' | 'analysing'>(null);
  const [result, setResult] = useState<NoteRangeResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onUpload(f: File | null) {
    if (!f) return;
    setBusy('decoding');
    setStatus(`Decoding ${f.name}…`);
    setResult(null);
    try {
      const buf = await decodeAudio(f);
      setAudio(buf);
      setAudioLabel(`${f.name} · ${buf.duration.toFixed(1)}s`);
      setStatus('Audio ready — click Analyse.');
    } catch (e) {
      setStatus(`Decode failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function record() {
    setBusy('recording');
    setStatus(`Recording for ${recordSec}s — sing your lowest and highest notes…`);
    setResult(null);
    try {
      const buf = await recordToAudioBuffer(recordSec * 1000);
      setAudio(buf);
      setAudioLabel(`Live recording · ${buf.duration.toFixed(1)}s`);
      setStatus('Recording done — click Analyse.');
    } catch (e) {
      setStatus(`Recording failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function analyse() {
    if (!audio) {
      setStatus('Need audio first — upload a file or record one.');
      return;
    }
    setBusy('analysing');
    setStatus('Scanning for pitches…');
    setResult(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const r = analyzeNoteRange(audio);
      setResult(r);
      if (r.samples === 0) {
        setStatus('No clear pitches found — try a louder or more sustained source.');
      } else {
        setStatus(`Analysed ${r.samples}/${r.totalWindows} windows.`);
      }
    } catch (e) {
      setStatus(`Analysis failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="tools-form">
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Finds the lowest and highest pitched notes in the audio. Best on a
        single voice or instrument; polyphonic material confuses the
        autocorrelation pitch tracker.
      </p>

      <div className="tools-field">
        <label className="label">Source</label>
        <div className="tools-checks" role="radiogroup">
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" name="range-src" checked={source === 'upload'} onChange={() => setSource('upload')} />
            Upload audio file
          </label>
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" name="range-src" checked={source === 'record'} onChange={() => setSource('record')} />
            Record live (mic)
          </label>
        </div>
      </div>

      {source === 'upload' && (
        <div className="tools-field">
          <label className="label">Audio file (mp3 / wav / m4a / ogg)</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            style={{ fontSize: '0.78rem' }}
            disabled={busy !== null}
          />
        </div>
      )}

      {source === 'record' && (
        <>
          <div className="tools-field">
            <label className="label tabular">Duration: {recordSec}s</label>
            <input
              type="range" min={5} max={60} step={1}
              value={recordSec}
              onChange={(e) => setRecordSec(Number(e.target.value))}
              disabled={busy === 'recording'}
            />
          </div>
          <button
            type="button"
            className="btn btn-subtle"
            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
            onClick={record}
            disabled={busy !== null}
          >
            {busy === 'recording' ? '● Recording…' : '🎤 Record now'}
          </button>
        </>
      )}

      {audioLabel && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loaded: {audioLabel}</p>
      )}

      <button
        type="button"
        className="btn btn-primary tools-apply"
        onClick={analyse}
        disabled={busy !== null || !audio}
      >
        {busy === 'analysing' ? 'Analysing…' : 'Analyse Range'}
      </button>

      {status && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{status}</p>
      )}

      {result && result.lowest && result.highest && (
        <div className="range-result">
          <div className="range-result-row">
            <span className="range-result-label">LOWEST</span>
            <span className="range-result-note">{result.lowest.noteName}</span>
            <span className="range-result-hz tabular">{result.lowest.frequency.toFixed(1)} Hz</span>
          </div>
          <div className="range-result-row">
            <span className="range-result-label">HIGHEST</span>
            <span className="range-result-note">{result.highest.noteName}</span>
            <span className="range-result-hz tabular">{result.highest.frequency.toFixed(1)} Hz</span>
          </div>
          <div className="range-result-span tabular">
            Range: {result.rangeSemitones} semitones
            {result.rangeSemitones !== null && ` (≈ ${(result.rangeSemitones / 12).toFixed(1)} octaves)`}
          </div>
          {result.lowestRobust && result.highestRobust && (
            <details className="key-result-alts">
              <summary>Robust range (5th–95th percentile)</summary>
              <p className="text-xs tabular" style={{ marginTop: '0.3rem' }}>
                {result.lowestRobust.noteName} ({result.lowestRobust.frequency.toFixed(1)} Hz)
                {' – '}
                {result.highestRobust.noteName} ({result.highestRobust.frequency.toFixed(1)} Hz)
              </p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
                Discards single-window outliers (coughs, glitches).
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared helpers for upload + record state across analysis tools ──────
function useAudioInput() {
  const [source, setSource] = useState<'upload' | 'record'>('upload');
  const [recordSec, setRecordSec] = useState(15);
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [audioLabel, setAudioLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onUpload(f: File | null) {
    if (!f) return;
    setBusy('decoding'); setStatus(`Decoding ${f.name}…`);
    try {
      const buf = await decodeAudio(f);
      setAudio(buf);
      setAudioLabel(`${f.name} · ${buf.duration.toFixed(1)}s`);
      setStatus('Audio ready.');
    } catch (e) {
      setStatus(`Decode failed: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }
  async function onRecord() {
    setBusy('recording'); setStatus(`Recording for ${recordSec}s…`);
    try {
      const buf = await recordToAudioBuffer(recordSec * 1000);
      setAudio(buf);
      setAudioLabel(`Live recording · ${buf.duration.toFixed(1)}s`);
      setStatus('Recording ready.');
    } catch (e) {
      setStatus(`Recording failed: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }
  return {
    source, setSource, recordSec, setRecordSec,
    audio, audioLabel, busy, setBusy, status, setStatus,
    onUpload, onRecord,
  };
}

function AudioSourceControls({
  audio, audioLabel, busy, source, setSource, onUpload, onRecord,
  recordSec, setRecordSec,
}: {
  audio: AudioBuffer | null;
  audioLabel: string | null;
  busy: string | null;
  source: 'upload' | 'record';
  setSource: (s: 'upload' | 'record') => void;
  onUpload: (f: File | null) => void;
  onRecord: () => void;
  recordSec: number;
  setRecordSec: (n: number) => void;
}) {
  void audio;
  return (
    <>
      <div className="tools-field">
        <label className="label">Source</label>
        <div className="tools-checks" role="radiogroup">
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" checked={source === 'upload'} onChange={() => setSource('upload')} />
            Upload audio file
          </label>
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" checked={source === 'record'} onChange={() => setSource('record')} />
            Record live (mic)
          </label>
        </div>
      </div>
      {source === 'upload' && (
        <div className="tools-field">
          <label className="label">Audio file (mp3 / wav / m4a / ogg)</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            style={{ fontSize: '0.78rem' }}
            disabled={busy !== null}
          />
        </div>
      )}
      {source === 'record' && (
        <>
          <div className="tools-field">
            <label className="label tabular">Duration: {recordSec}s</label>
            <input
              type="range" min={5} max={60} step={1}
              value={recordSec}
              onChange={(e) => setRecordSec(Number(e.target.value))}
              disabled={busy === 'recording'}
            />
          </div>
          <button
            type="button"
            className="btn btn-subtle"
            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
            onClick={onRecord}
            disabled={busy !== null}
          >
            {busy === 'recording' ? '● Recording…' : '🎤 Record now'}
          </button>
        </>
      )}
      {audioLabel && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loaded: {audioLabel}</p>
      )}
    </>
  );
}

function TempoTrackerTool() {
  const i = useAudioInput();
  const [result, setResult] = useState<TempoResult | null>(null);

  async function detect() {
    if (!i.audio) { i.setStatus('Need audio first.'); return; }
    i.setBusy('detecting'); i.setStatus('Analysing onsets…'); setResult(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const r = detectTempo(i.audio);
      setResult(r);
      i.setStatus(r.bpm > 0 ? 'Done.' : 'No stable tempo found.');
    } catch (e) {
      i.setStatus(`Failed: ${(e as Error).message}`);
    } finally { i.setBusy(null); }
  }

  return (
    <div className="tools-form">
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Best on rhythmic material (drums, percussion, clear downbeats).
        Free / rubato passages have no detectable beat.
      </p>
      <AudioSourceControls {...i} />
      <button
        type="button"
        className="btn btn-primary tools-apply"
        onClick={detect}
        disabled={i.busy !== null || !i.audio}
      >
        {i.busy === 'detecting' ? 'Analysing…' : 'Detect BPM'}
      </button>
      {i.status && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{i.status}</p>}
      {result && result.bpm > 0 && (
        <div className="key-result">
          <div className="key-result-main">
            <span className="key-result-label">BPM</span>
            <span className="key-result-key">{result.bpm.toFixed(1)}</span>
          </div>
          <div className="key-result-conf tabular">
            Confidence: {(result.confidence * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}

function LoudnessMeterTool() {
  const i = useAudioInput();
  const [result, setResult] = useState<LoudnessResult | null>(null);

  async function analyse() {
    if (!i.audio) { i.setStatus('Need audio first.'); return; }
    i.setBusy('analysing'); i.setStatus('Computing levels…'); setResult(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const r = analyzeLoudness(i.audio);
      setResult(r);
      i.setStatus(null);
    } catch (e) {
      i.setStatus(`Failed: ${(e as Error).message}`);
    } finally { i.setBusy(null); }
  }

  return (
    <div className="tools-form">
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        RMS &amp; peak in dBFS (0 dB = full scale). More negative = quieter.
        Crest factor is the dynamic-range gap between them.
      </p>
      <AudioSourceControls {...i} />
      <button
        type="button"
        className="btn btn-primary tools-apply"
        onClick={analyse}
        disabled={i.busy !== null || !i.audio}
      >
        {i.busy === 'analysing' ? 'Analysing…' : 'Measure Loudness'}
      </button>
      {i.status && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{i.status}</p>}
      {result && (
        <div className="range-result">
          <div className="range-result-row">
            <span className="range-result-label">RMS</span>
            <span className="range-result-note">{result.rmsDb.toFixed(1)} dB</span>
          </div>
          <div className="range-result-row">
            <span className="range-result-label">PEAK</span>
            <span className="range-result-note">{result.peakDb.toFixed(1)} dB</span>
          </div>
          <div className="range-result-span tabular">
            Crest: {result.crestFactorDb.toFixed(1)} dB · Duration: {result.durationSec.toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  );
}

function TranscribeTool({ onCreate }: { onCreate: (s: Song) => void }) {
  const i = useAudioInput();
  const [title, setTitle] = useState('My Transcription');
  const [bpmOverride, setBpmOverride] = useState<string>('');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  async function transcribe() {
    if (!i.audio) { i.setStatus('Need audio first.'); return; }
    i.setBusy('analysing'); i.setStatus('Transcribing…'); setResult(null); setSaveStatus(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const parsed = bpmOverride.trim() === '' ? undefined : Number(bpmOverride);
      const bpm = parsed !== undefined && Number.isFinite(parsed)
        ? Math.max(40, Math.min(240, parsed))
        : undefined;
      const r = transcribeAudio(i.audio, { bpm, title });
      setResult(r);
      i.setStatus(`Transcribed ${r.notes.length} notes @ ${r.bpm} BPM, K:${r.keyHeader}.`);
    } catch (e) {
      i.setStatus(`Failed: ${(e as Error).message}`);
    } finally { i.setBusy(null); }
  }

  function saveToLibrary() {
    if (!result) return;
    try {
      const finalTitle = title.trim() || 'My Transcription';
      const song = transcriptionToSong(result, finalTitle);
      onCreate(song);
      setSaveStatus(`Saved "${finalTitle}" to Library.`);
    } catch (e) {
      setSaveStatus(`Save failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="tools-form">
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Monophonic only — single voice / single-line instrument.
        Polyphony produces nonsense. ABC is approximate; expect to clean up rhythm.
      </p>

      <AudioSourceControls {...i} />

      <div className="tools-field">
        <label className="label">Title</label>
        <input
          type="text"
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My Transcription"
        />
      </div>

      <div className="tools-field">
        <label className="label">BPM (blank = auto-detect)</label>
        <input
          type="text"
          className="field tabular"
          value={bpmOverride}
          onChange={(e) => setBpmOverride(e.target.value)}
          placeholder="auto"
        />
      </div>

      <button
        type="button"
        className="btn btn-primary tools-apply"
        onClick={transcribe}
        disabled={i.busy !== null || !i.audio}
      >
        {i.busy === 'analysing' ? 'Transcribing…' : 'Detect & Transcribe'}
      </button>

      {i.status && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{i.status}</p>}

      {result && (
        <div className="range-result">
          <div className="range-result-row">
            <span className="range-result-label">NOTES</span>
            <span className="range-result-note">{result.notes.length}</span>
            <span className="range-result-hz tabular">{result.bpm} BPM</span>
          </div>
          <div className="range-result-row">
            <span className="range-result-label">KEY</span>
            <span className="range-result-note">{result.keyHeader}</span>
          </div>
          <details className="key-result-alts">
            <summary>ABC preview</summary>
            <pre className="tx-preview">{result.abc.slice(0, 1200)}{result.abc.length > 1200 ? '…' : ''}</pre>
          </details>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
            onClick={saveToLibrary}
          >
            💾 Save to Library
          </button>
          {saveStatus && <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>{saveStatus}</p>}
        </div>
      )}
    </div>
  );
}

function CreateMusicWithAITool({ onCreate }: { onCreate: (s: Song) => void }) {
  const [title, setTitle] = useState('AI Tune');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(LYRIA_MODELS[0].value);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function apply() {
    const finalTitle = title.trim() || 'AI Tune';
    if (!prompt.trim()) {
      setStatus('Type a prompt describing the music you want.');
      return;
    }
    if (!apiKey.trim()) {
      setStatus('Gemini API key required. Get one at aistudio.google.com.');
      return;
    }
    setBusy(true);
    setStatus('Calling Gemini Lyria — this can take 20–60s…');
    try {
      const res = await generateWithLyria({ apiKey, model, prompt });
      const audioUrl = toDataUrl(res.audioBase64, res.mimeType);
      const song = audioSong(finalTitle, audioUrl, prompt);
      onCreate(song);
      const sizeKb = Math.round((res.audioBase64.length * 0.75) / 1024);
      setStatus(`Created "${finalTitle}" via Lyria (≈${sizeKb} KB) — added to Library.`);
    } catch (e) {
      setStatus(`Lyria failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const modelHint = LYRIA_MODELS.find((m) => m.value === model)?.hint;

  return (
    <div className="tools-form">
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Generates audio via Google Gemini Lyria 3 from a natural-language
        prompt. The result is saved as an audio song in your Library.
      </p>
      <p className="text-xs" style={{ color: 'var(--danger)' }}>
        ⚠ Your API key is sent directly from the browser; anyone with access
        to this device can read it. For shared deployments, route through a
        backend instead.
      </p>

      <div className="tools-field">
        <label className="label">Name</label>
        <input
          type="text"
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="AI Tune"
        />
      </div>

      <div className="tools-field">
        <label className="label">Gemini API key</label>
        <input
          type="password"
          className="field"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="paste key — stored only in memory"
          autoComplete="off"
        />
      </div>

      <div className="tools-field">
        <label className="label">Model</label>
        <select className="field" value={model} onChange={(e) => setModel(e.target.value)}>
          {LYRIA_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {modelHint && (
          <p className="text-xs" style={{ color: 'var(--text-subtle)', marginTop: '0.2rem' }}>{modelHint}</p>
        )}
      </div>

      <div className="tools-field">
        <label className="label">Prompt</label>
        <textarea
          className="field"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Upbeat acoustic folk in D major with bansuri lead and madal drums."
        />
      </div>

      <button
        type="button"
        className="btn btn-primary tools-apply"
        onClick={apply}
        disabled={busy}
      >
        {busy ? 'Calling Lyria…' : 'Apply — Generate & Save'}
      </button>

      {status && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>{status}</p>
      )}
    </div>
  );
}
