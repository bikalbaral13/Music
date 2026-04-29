import { useEffect, useMemo, useRef, useState } from 'react';
import abcjs from 'abcjs';
import type { Song } from '../types';
import { GM_INSTRUMENTS } from '../types';
import PianoView from './PianoView';
import Flute, { BANSURI_SCALES } from './Flute';
import GuitarTabs from './GuitarTabs';
import UkuleleTabs from './UkuleleTabs';
import ViolinView from './ViolinView';
import HarmoniumView from './HarmoniumView';
import NoteBlocksView from './NoteBlocksView';
import KeyWheel from './KeyWheel';
import { transposeKey } from '../lib/midi';
import {
  type Mode,
  type Notation,
  type Spelling,
  SARGAM,
  westernNameForPc,
  tonicPcFor,
} from '../lib/notation';

interface Props { song: Song; }

// Loose typing — abcjs's CursorControl.onEvent uses NoteTimingEvent whose
// midiPitches shape is wider than what we read here. Treat as any to avoid
// fighting upstream type drift.
type AbcEvent = any;

function midiToNoteLetter(midi: number): string {
  const CHROMATIC: Record<number, string> = {
    0:'C',1:'C#',2:'D',3:'D#',4:'E',5:'F',6:'F#',7:'G',8:'G#',9:'A',10:'A#',11:'B',
  };
  return CHROMATIC[midi % 12];
}

function fmtTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const IconPlay = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
  </svg>
);
const IconPause = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="5" width="4" height="14" rx="1.2" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" />
  </svg>
);
const IconRestart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export default function Player({ song }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const synthControlRef = useRef<any>(null);
  const audioStartCtxRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const [tempo, setTempo] = useState(song.tempo);
  const [transpose, setTranspose] = useState(0);
  const [instrument, setInstrument] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [capo, setCapo] = useState(0);
  const [bansuriScaleIdx, setBansuriScaleIdx] = useState(0);
  const bansuriScale = BANSURI_SCALES[bansuriScaleIdx];

  const [activeMidi, setActiveMidi] = useState<Set<number>>(new Set());
  const [currentMs, setCurrentMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Notation preferences live here so the Notes block and the Instrument
  // visuals can both render the same label for the currently-sounding note.
  const [mode, setMode] = useState<Mode>('original');
  const [notation, setNotation] = useState<Notation>('western');
  const [spelling, setSpelling] = useState<Spelling>('auto');

  // Reset local controls when song changes.
  useEffect(() => {
    setTempo(song.tempo);
    setTranspose(0);
  }, [song.id]);

  const [visualObj, setVisualObj] = useState<any>(null);
  useEffect(() => {
    if (!sheetRef.current) return;
    try {
      const arr = abcjs.renderAbc(sheetRef.current, song.abc, {
        responsive: 'resize',
        visualTranspose: transpose,
        add_classes: true,
      });
      setError(null);
      setVisualObj(arr[0]);
    } catch (e) {
      setError((e as Error).message);
      setVisualObj(null);
    }
  }, [song.abc, transpose]);

  // Total playback duration in ms at the song's original tempo. Live tempo
  // changes use synth warp, which scales wall-clock duration — so the slider
  // max is derived from `totalAtSongTempoMs * (song.tempo / tempo)`.
  const totalAtSongTempoMs = useMemo(() => {
    if (!visualObj) return 0;
    try {
      const sec = typeof visualObj.getTotalTime === 'function' ? visualObj.getTotalTime() : 0;
      return Math.max(0, (sec || 0) * 1000);
    } catch { return 0; }
  }, [visualObj]);
  const totalMs = totalAtSongTempoMs > 0 ? totalAtSongTempoMs * (song.tempo / tempo) : 0;

  // Initialise the abcjs synth controller once we have a visualObj.
  useEffect(() => {
    if (!visualObj || !abcjs.synth.supportsAudio()) return;
    let cancelled = false;

    async function init() {
      try {
        const audioCtx = audioCtxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;

        const cursorControl = {
          beatSubdivisions: 2,
          onStart: () => {
            audioStartCtxRef.current = audioCtx.currentTime;
            if (rafRef.current === null) tickFrame();
            setIsPlaying(true);
          },
          onFinished: () => {
            setActiveMidi(new Set());
            setIsPlaying(false);
          },
          onEvent: (ev: AbcEvent) => {
            if (!ev?.midiPitches) return;
            const next = new Set<number>();
            for (const p of ev.midiPitches) next.add(p.pitch);
            setActiveMidi(next);
          },
        };

        const synthControl = new abcjs.synth.SynthController();
        synthControl.load('#abc-audio', cursorControl, {
          displayLoop: false, displayRestart: true, displayPlay: true, displayProgress: true, displayWarp: true,
        });
        await synthControl.setTune(visualObj, false, {
          qpm: song.tempo,
          program: instrument,
          midiTranspose: transpose,
        });
        if (!cancelled) {
          synthControlRef.current = synthControl;
          setReady(true);
        }
      } catch (e) {
        setError(`Audio init failed: ${(e as Error).message}`);
      }
    }
    init();

    return () => {
      cancelled = true;
      try { synthControlRef.current?.pause(); } catch { /* noop */ }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualObj, instrument, transpose, song.tempo]);

  useEffect(() => {
    const ctrl = synthControlRef.current;
    if (!ctrl) return;
    const warpPercent = Math.round((tempo / song.tempo) * 100);
    try { ctrl.setWarp(warpPercent); } catch { /* noop */ }
  }, [tempo, song.tempo, ready]);

  function tickFrame() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = (ctx.currentTime - audioStartCtxRef.current) * 1000;
    setCurrentMs(elapsed);
    rafRef.current = requestAnimationFrame(tickFrame);
  }

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  async function handlePlay() {
    const ctx = audioCtxRef.current;
    if (ctx?.state === 'suspended') await ctx.resume();
    if (ctx && rafRef.current === null) {
      audioStartCtxRef.current = ctx.currentTime - currentMs / 1000;
      tickFrame();
    }
    try {
      await synthControlRef.current?.play();
      setIsPlaying(true);
    } catch (e) { setError((e as Error).message); }
  }
  function handlePause() {
    try { synthControlRef.current?.pause(); } catch { /* noop */ }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
  }
  async function handleRestart() {
    // Hard-reset: pause, then re-init the tune so any in-flight scheduled
    // audio is dropped and abcjs's internal cursor returns to 0. seek(0) alone
    // leaves notes ringing and sometimes resumes playback.
    const ctrl = synthControlRef.current;
    try { ctrl?.pause(); } catch { /* noop */ }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setActiveMidi(new Set());
    setIsPlaying(false);
    setCurrentMs(0);

    if (ctrl && visualObj) {
      try {
        await ctrl.setTune(visualObj, false, {
          qpm: song.tempo,
          program: instrument,
          midiTranspose: transpose,
        });
        const warpPercent = Math.round((tempo / song.tempo) * 100);
        try { ctrl.setWarp(warpPercent); } catch { /* noop */ }
      } catch (e) {
        setError((e as Error).message);
      }
    }

    const ctx = audioCtxRef.current;
    if (ctx) audioStartCtxRef.current = ctx.currentTime;
  }
  function handleSeek(ratio: number) {
    const ctrl = synthControlRef.current;
    if (!ctrl || totalMs <= 0) return;
    const clamped = Math.min(1, Math.max(0, ratio));
    try { ctrl.seek(clamped, 'percent'); } catch { /* fallback below */ }
    const ctx = audioCtxRef.current;
    if (ctx) {
      const newMs = clamped * totalMs;
      audioStartCtxRef.current = ctx.currentTime - newMs / 1000;
      setCurrentMs(newMs);
    }
  }

  const progressPct = totalMs > 0 ? Math.min(100, (currentMs / totalMs) * 100) : 0;

  // Render the same label the Notes block shows for the currently-sounding
  // pitch. Used by the Flute (and any other instrument) for its big readout.
  const saAnchorForFlute = instrument === 73 ? bansuriScale : undefined;
  function liveLabel(): React.ReactNode {
    if (activeMidi.size === 0) return null;
    const lowest = Math.min(...activeMidi);
    // The synth has already shifted MIDI pitches by `transpose`, so its raw
    // pitch class IS the sounded pitch class regardless of mode.
    const pc = ((lowest % 12) + 12) % 12;
    if (notation === 'sargam') {
      const tonicPc = tonicPcFor(mode, song.scale, transpose, saAnchorForFlute);
      const degree = ((pc - tonicPc) % 12 + 12) % 12;
      const s = SARGAM[degree];
      return <span className={`sargam ${s.mark}`}>{s.dev}</span>;
    }
    // Western. ABC mode falls back to chromatic letter — we don't have the
    // source token here, but matching pitch is close enough for a big readout.
    return westernNameForPc(pc, spelling, song.scale);
  }

  function renderInstrumentVisual() {
    if (instrument === 0) return <PianoView activeMidi={activeMidi} showLabels={showLabels} />;
    if (instrument === 73) {
      return (
        <Flute
          note={activeMidi.size > 0 ? midiToNoteLetter(Math.min(...activeMidi)) : null}
          bansuriScale={bansuriScale}
          songKey={transposeKey(song.scale, transpose)}
          displayLabel={liveLabel()}
          onScaleChange={(s) => {
            const idx = BANSURI_SCALES.indexOf(s as typeof BANSURI_SCALES[number]);
            if (idx >= 0) setBansuriScaleIdx(idx);
          }}
        />
      );
    }
    if (instrument === 24) return <GuitarTabs activeMidi={activeMidi} showLabels={showLabels} capo={capo} />;
    if (instrument === 20) return <HarmoniumView activeMidi={activeMidi} showLabels={showLabels} isPumping={activeMidi.size > 0} />;
    if (instrument === 40) return <ViolinView activeMidi={activeMidi} showLabels={showLabels} />;
    if (instrument === 25) return <UkuleleTabs activeMidi={activeMidi} showLabels={showLabels} capo={capo} />;
    return <PianoView activeMidi={activeMidi} showLabels={showLabels} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{song.title}</h2>
        {song.composer && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{song.composer}</p>
        )}
      </div>

      {error && (
        <div
          className="rounded-md px-3 py-2 text-sm"
          style={{
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      {/* ============================== NOTES BLOCK ============================== */}
      <section className="section">
        <header className="section-header">
          <span className="section-title">Notes</span>
        </header>
        <div className="section-body">
          <NoteBlocksView
            abc={song.abc}
            currentMs={currentMs}
            tempo={tempo}
            transpose={transpose}
            songKey={song.scale}
            saAnchor={saAnchorForFlute}
            mode={mode}
            onModeChange={setMode}
            notation={notation}
            onNotationChange={setNotation}
            spelling={spelling}
            onSpellingChange={setSpelling}
          />
        </div>
      </section>

      {/* ============================== INSTRUMENT BLOCK ============================== */}
      <section className="section">
        <header className="section-header">
          <span className="section-title">Instrument</span>
        </header>
        <div className="section-body space-y-3">
          <div className="instrument-canvas">{renderInstrumentVisual()}</div>

          {instrument === 73 && (
            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              Click any note around the embouchure to switch bansuri. Closer to{' '}
              <span className="font-mono" style={{ color: 'var(--text)' }}>C</span>{' '}
              = fewer sharps = simpler fingering.
            </p>
          )}
          {(instrument === 24 || instrument === 25) && (
            <div className="surface-2 flex items-center gap-3 px-3 py-2">
              <label className="label whitespace-nowrap">
                Capo: <span style={{ color: 'var(--text)' }}>{capo === 0 ? 'Off' : `Fret ${capo}`}</span>
              </label>
              <input
                type="range" min={0} max={10} step={1} value={capo}
                onChange={(e) => setCapo(Number(e.target.value))}
                className="flex-1"
              />
              <div className="flex gap-0.5 text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                {Array.from({ length: 11 }).map((_, i) => (
                  <span key={i} className="w-5 text-center">{i}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4 pt-1">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[12rem]">
              <label className="label">Instrument</label>
              <select
                value={instrument}
                onChange={(e) => setInstrument(Number(e.target.value))}
                className="field"
              >
                {GM_INSTRUMENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-sm pb-2" style={{ color: 'var(--text)' }}>
              <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
              Show note labels
            </label>
          </div>
        </div>
      </section>

      {/* ============================== SOUND BLOCK ============================== */}
      <section className="section">
        <header className="section-header">
          <span className="section-title">Sound</span>
        </header>
        <div className="section-body space-y-4">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleRestart}
              className="transport"
              title="Restart"
              aria-label="Restart"
            >
              <IconRestart />
            </button>
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="transport primary"
                title="Pause"
                aria-label="Pause"
              >
                <IconPause />
              </button>
            ) : (
              <button
                disabled={!ready}
                onClick={handlePlay}
                className="transport primary"
                title="Play"
                aria-label="Play"
              >
                <IconPlay />
              </button>
            )}
            <div style={{ width: 44 }} aria-hidden />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs tabular" style={{ color: 'var(--text-muted)', minWidth: '3rem' }}>
              {fmtTime(currentMs)}
            </span>
            <input
              type="range"
              className="progress flex-1"
              min={0}
              max={1000}
              step={1}
              value={totalMs > 0 ? Math.min(1000, Math.round((currentMs / totalMs) * 1000)) : 0}
              onChange={(e) => handleSeek(Number(e.target.value) / 1000)}
              style={{ ['--progress' as any]: `${progressPct}%` }}
              disabled={!ready || totalMs <= 0}
              aria-label="Playback position"
            />
            <span className="text-xs tabular" style={{ color: 'var(--text-muted)', minWidth: '3rem', textAlign: 'right' }}>
              {fmtTime(totalMs)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="label tabular">Tempo: {tempo} BPM</label>
              <input type="range" min={40} max={240} value={tempo}
                onChange={(e) => setTempo(Number(e.target.value))}/>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="label tabular">
                Key: <span style={{ color: 'var(--text)' }}>{transposeKey(song.scale, transpose)}</span>
                {transpose !== 0 && (
                  <span style={{ color: 'var(--text-subtle)' }}>
                    {' '}({transpose > 0 ? '+' : ''}{transpose} semitones)
                  </span>
                )}
              </label>
              <KeyWheel
                originalScale={song.scale}
                transpose={transpose}
                onChange={setTranspose}
              />
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                Original: {song.scale}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* abcjs needs the sheet container in the DOM for its synth/cursor; keep it off-screen */}
      <div style={{ position: 'absolute', left: -99999, top: -99999, width: 1, height: 1, overflow: 'hidden' }}>
        <div ref={sheetRef} className="abc-render" />
      </div>
      <div id="abc-audio" className="hidden" />
    </div>
  );
}
