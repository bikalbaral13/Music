import { useEffect, useMemo, useRef, useState } from 'react';
import abcjs from 'abcjs';
import type { Song } from '../types';
import { GM_INSTRUMENTS } from '../types';
import PianoView from './PianoView';
import FallingNotesView from './FallingNotesView';
import { buildFallingNotes } from '../lib/fallingNotes';
import Flute, { BANSURI_SCALES } from './Flute';
import GuitarTabs from './GuitarTabs';
import UkuleleTabs from './UkuleleTabs';
import ViolinView from './ViolinView';
import HarmoniumView from './HarmoniumView';
import Drumset, { DRUM_PATTERNS } from './Drumset';
import { DrumPlayer } from '../lib/drumAudio';
import { CHORDS, STRUM_PATTERNS } from '../lib/guitarChords';
import { GuitarStrumPlayer } from '../lib/guitarStrumAudio';
import NoteBlocksView from './NoteBlocksView';
import { transposeKey } from '../lib/midi';
import {
  type Mode,
  type Notation,
  type Spelling,
  SARGAM,
  westernNameForPc,
  tonicPcFor,
} from '../lib/notation';
import { useAbcSheet } from '../hooks/useAbcSheet';
import { useAbcSynth } from '../hooks/useAbcSynth';

const DRUMSET_PROGRAM = 118;

interface Props { song: Song; }

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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const extraSynthsRef = useRef<any[]>([]);
  const drumPlayerRef = useRef<DrumPlayer | null>(null);
  const strumPlayerRef = useRef<GuitarStrumPlayer | null>(null);

  const [tempo, setTempo] = useState(song.tempo);
  const [transpose, setTranspose] = useState(0);
  const [instrument, setInstrument] = useState(0);
  const [extraPrograms, setExtraPrograms] = useState<Set<number>>(new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [capo, setCapo] = useState(0);
  const [bansuriScaleIdx, setBansuriScaleIdx] = useState(0);
  const bansuriScale = BANSURI_SCALES[bansuriScaleIdx];
  const [drumPattern, setDrumPattern] = useState(DRUM_PATTERNS[0]);
  const [chord, setChord] = useState(CHORDS[0]);
  const [strumPattern, setStrumPattern] = useState(STRUM_PATTERNS[0]);

  const [mutedVoices, setMutedVoices] = useState<Set<number>>(new Set());
  const [activeMidi, setActiveMidi] = useState<Set<number>>(new Set());
  const [activeFinger, setActiveFinger] = useState<number | null>(null);
  const [pianoDisplay, setPianoDisplay] = useState<'normal' | 'falling'>('normal');

  const [mode, setMode] = useState<Mode>('original');
  const [notation, setNotation] = useState<Notation>('western');
  const [spelling, setSpelling] = useState<Spelling>('auto');

  const { sheetRef, visualObj, voices: songVoices, totalAtSongTempoMs, error: sheetError } =
    useAbcSheet(song.abc, transpose);

  const totalMs = totalAtSongTempoMs > 0 ? totalAtSongTempoMs * (song.tempo / tempo) : 0;

  const synth = useAbcSynth({
    visualObj,
    abc: song.abc,
    songTempoQpm: song.tempo,
    tempo,
    instrument,
    transpose,
    mutedVoices,
    audioCtxRef,
    totalMs,
    onActivePitchesChange: setActiveMidi,
    onActiveFingeringChange: setActiveFinger,
  });
  const { ready, isPlaying, currentMs, synthControlRef } = synth;
  const error = sheetError ?? synth.error;

  // Reset per-song UI state.
  useEffect(() => {
    setMutedVoices(new Set());
    setTempo(song.tempo);
    setTranspose(0);
  }, [song.id, song.tempo]);

  // Space toggles play/pause when not typing in an input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      if (isPlaying) handlePause(); else if (ready) void handlePlay();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, ready]);

  function stopExtras() {
    for (const s of extraSynthsRef.current) {
      try { s.stop(); } catch { /* noop */ }
    }
  }

  // Drumset is a groove loop, not a melody track. Active whenever it's the
  // view instrument OR included in the extras set.
  const drumsActive = instrument === DRUMSET_PROGRAM || extraPrograms.has(DRUMSET_PROGRAM);
  function stopDrums() {
    try { drumPlayerRef.current?.stop(); } catch { /* noop */ }
  }
  function startDrums() {
    if (!drumsActive) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (!drumPlayerRef.current) {
      drumPlayerRef.current = new DrumPlayer(ctx, drumPattern, tempo);
    } else {
      drumPlayerRef.current.setPattern(drumPattern);
      drumPlayerRef.current.setTempo(tempo);
    }
    drumPlayerRef.current.start(currentMs);
  }

  const strumActive = instrument === 24;
  function stopStrum() {
    try { strumPlayerRef.current?.stop(); } catch { /* noop */ }
  }
  function startStrum() {
    if (!strumActive) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (!strumPlayerRef.current) {
      strumPlayerRef.current = new GuitarStrumPlayer(ctx, chord, strumPattern, tempo);
    } else {
      strumPlayerRef.current.setChord(chord);
      strumPlayerRef.current.setPattern(strumPattern);
      strumPlayerRef.current.setTempo(tempo);
    }
    void strumPlayerRef.current.start(currentMs);
  }

  async function rebuildExtras(qpm: number, programs: Set<number>) {
    stopExtras();
    extraSynthsRef.current = [];
    if (!visualObj || programs.size === 0) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const created: any[] = [];
    for (const program of programs) {
      if (program === DRUMSET_PROGRAM) continue;
      try {
        const s = new (abcjs as any).synth.CreateSynth();
        await s.init({
          audioContext: ctx,
          visualObj,
          options: { program, midiTranspose: transpose, qpm },
        });
        await s.prime();
        created.push(s);
      } catch (e) {
        console.warn('Extra instrument failed to load', program, e);
      }
    }
    extraSynthsRef.current = created;
  }

  useEffect(() => {
    return () => {
      stopExtras();
      stopDrums(); stopStrum();
    };
  }, []);

  // Live-update tāl/tempo on a running madal loop so changes apply immediately.
  useEffect(() => { drumPlayerRef.current?.setPattern(drumPattern); }, [drumPattern]);
  useEffect(() => {
    drumPlayerRef.current?.setTempo(tempo);
    strumPlayerRef.current?.setTempo(tempo);
  }, [tempo]);
  useEffect(() => { strumPlayerRef.current?.setChord(chord); }, [chord]);
  useEffect(() => { strumPlayerRef.current?.setPattern(strumPattern); }, [strumPattern]);

  // Drop the view instrument from the extras set so we never double-layer it.
  useEffect(() => {
    setExtraPrograms((prev) => {
      if (!prev.has(instrument)) return prev;
      const next = new Set(prev);
      next.delete(instrument);
      return next;
    });
  }, [instrument]);

  async function handlePlay() {
    try {
      await rebuildExtras(tempo, extraPrograms);
      await synth.play();
      for (const s of extraSynthsRef.current) {
        try { s.start(); } catch { /* noop */ }
      }
      startDrums();
      startStrum();
    } catch (e) { /* handled by synth.error */ console.warn(e); }
  }
  function handlePause() {
    synth.pause();
    stopExtras();
    stopDrums(); stopStrum();
  }
  async function handleRestart() {
    stopExtras();
    stopDrums(); stopStrum();
    setActiveMidi(new Set());
    await synth.restart();
  }
  function handleSeekMs(ms: number) {
    if (totalMs <= 0) return;
    handleSeek(Math.min(1, Math.max(0, ms / totalMs)));
  }
  function handleSeek(ratio: number) {
    // Extras can't be seeked — silence them; the next Play call rebuilds them.
    stopExtras();
    stopDrums(); stopStrum();
    synth.seekRatio(ratio);
  }

  const progressPct = totalMs > 0 ? Math.min(100, (currentMs / totalMs) * 100) : 0;
  const beatIndex = tempo > 0 ? Math.floor(currentMs / (60000 / tempo)) : 0;

  // Render the same label the Notes block shows for the currently-sounding
  // pitch. Used by the Flute (and any other instrument) for its big readout.
  const saAnchorForFlute = instrument === 73 ? bansuriScale : undefined;
  function liveLabel(): React.ReactNode {
    if (activeMidi.size === 0) return null;
    const lowest = Math.min(...activeMidi);
    const pc = ((lowest % 12) + 12) % 12;
    if (notation === 'sargam') {
      const tonicPc = tonicPcFor(mode, song.scale, transpose, saAnchorForFlute);
      const degree = ((pc - tonicPc) % 12 + 12) % 12;
      const s = SARGAM[degree];
      return <span className={`sargam ${s.mark}`}>{s.dev}</span>;
    }
    return westernNameForPc(pc, spelling, song.scale);
  }

  const fallingNotes = useMemo(
    () => (instrument === 0 && pianoDisplay === 'falling')
      ? buildFallingNotes(song.abc, tempo)
      : [],
    [song.abc, tempo, instrument, pianoDisplay],
  );

  function renderInstrumentVisual() {
    if (instrument === 0) {
      if (pianoDisplay === 'falling') {
        return (
          <div className="space-y-2">
            <FallingNotesView
              notes={fallingNotes}
              currentMs={currentMs}
              isPlaying={isPlaying}
              showLabels={showLabels}
            />
            <PianoView activeMidi={activeMidi} showLabels={showLabels} bright />
          </div>
        );
      }
      return <PianoView activeMidi={activeMidi} showLabels={showLabels} />;
    }
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
    if (instrument === 24) return (
      <GuitarTabs
        activeMidi={activeMidi}
        showLabels={showLabels}
        capo={capo}
        chord={chord}
        onChordChange={setChord}
        strumPattern={strumPattern}
        onStrumPatternChange={setStrumPattern}
        currentMs={currentMs}
        tempo={tempo}
        isPlaying={isPlaying}
      />
    );
    if (instrument === 20) return <HarmoniumView activeMidi={activeMidi} showLabels={showLabels} isPumping={activeMidi.size > 0} activeFinger={activeFinger} />;
    if (instrument === 40) return <ViolinView activeMidi={activeMidi} showLabels={showLabels} />;
    if (instrument === 25) return <UkuleleTabs activeMidi={activeMidi} showLabels={showLabels} capo={capo} />;
    if (instrument === DRUMSET_PROGRAM) return (
      <Drumset
        pattern={drumPattern}
        onPatternChange={setDrumPattern}
        currentMs={currentMs}
        tempo={tempo}
        isPlaying={isPlaying}
      />
    );
    return <PianoView activeMidi={activeMidi} showLabels={showLabels} />;
  }

  // silence unused-binding warning for synthControlRef when not consumed in JSX
  void synthControlRef;

  // Audio-only songs (e.g. Gemini Lyria output) bypass the ABC synth entirely.
  if (song.audioUrl) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{song.title}</h2>
          {song.composer && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{song.composer}</p>
          )}
        </div>
        <section className="section">
          <header className="section-header">
            <span className="section-title">Audio</span>
          </header>
          <div className="section-body space-y-3">
            <audio
              controls
              src={song.audioUrl}
              style={{ width: '100%' }}
            />
            <a
              href={song.audioUrl}
              download={`${song.title.replace(/[^\w-]+/g, '_')}.mp3`}
              className="btn btn-subtle"
              style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
            >
              ⬇ Download mp3
            </a>
            {song.abc && song.abc.includes('% Prompt:') && (
              <details>
                <summary className="text-xs" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Generation prompt
                </summary>
                <pre className="tx-preview">{song.abc.split('\n').find((l) => l.startsWith('% Prompt:'))?.replace('% Prompt:', '').trim()}</pre>
              </details>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{song.title}</h2>
        {song.composer && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{song.composer}</p>
        )}
      </div>

      <div className="transport-bar inline" role="region" aria-label="Playback controls">
        <div className="transport-bar-inner">
          <div className="transport-bar-meta">
            <div className="transport-bar-title" title={song.title}>{song.title}</div>
            <div className="transport-bar-sub tabular">
              <span
                className={`beat-dot ${isPlaying ? 'pulse' : ''}`}
                style={{ ['--bpm' as any]: tempo }}
                aria-hidden
              />
              <span>♩ {beatIndex + 1}</span>
              <span aria-hidden>·</span>
              <span>{tempo} BPM</span>
            </div>
          </div>

          <div className="transport-bar-controls">
            <button onClick={handleRestart} className="transport" title="Restart" aria-label="Restart">
              <IconRestart />
            </button>
            {isPlaying ? (
              <button onClick={handlePause} className="transport primary" title="Pause (Space)" aria-label="Pause">
                <IconPause />
              </button>
            ) : (
              <button disabled={!ready} onClick={handlePlay} className="transport primary" title="Play (Space)" aria-label="Play">
                <IconPlay />
              </button>
            )}
          </div>

          <div className="transport-bar-scrub">
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
        </div>
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

      <section className="section">
        <header className="section-header">
          <span className="section-title">Song</span>
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
            onSeekMs={handleSeekMs}
            onTempoChange={setTempo}
            onTransposeChange={setTranspose}
            voices={songVoices}
            mutedVoices={mutedVoices}
            onToggleVoice={(idx) => {
              setMutedVoices((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx); else next.add(idx);
                return next;
              });
            }}
          />
        </div>
      </section>

      <section className="section">
        <header className="section-header">
          <span className="section-title">Instrument</span>
        </header>
        <div className="section-body space-y-3">
          <div className="instrument-canvas">{renderInstrumentVisual()}</div>

          {instrument === 0 && (
            <div className="surface-2 flex items-center gap-2 px-3 py-2">
              <span className="label">Display</span>
              <button
                type="button"
                className={`btn ${pianoDisplay === 'normal' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem' }}
                onClick={() => setPianoDisplay('normal')}
              >
                Normal
              </button>
              <button
                type="button"
                className={`btn ${pianoDisplay === 'falling' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem' }}
                onClick={() => setPianoDisplay('falling')}
              >
                Falling Notes ✨
              </button>
            </div>
          )}
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

          <div className="flex flex-col gap-2 pt-1">
            <label className="label">Extra instruments (play alongside the view instrument)</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {GM_INSTRUMENTS.filter((i) => i.value !== instrument).map((i) => {
                const checked = extraPrograms.has(i.value);
                return (
                  <label key={i.value} className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setExtraPrograms((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(i.value); else next.delete(i.value);
                          return next;
                        });
                      }}
                    />
                    {i.label}
                  </label>
                );
              })}
            </div>
            {extraPrograms.size > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                Extras start with the next Play and stop on Pause/Seek. Tempo changes apply on the next Play.
              </p>
            )}
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
