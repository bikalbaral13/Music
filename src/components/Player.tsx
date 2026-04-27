import { useEffect, useRef, useState } from 'react';
import abcjs from 'abcjs';
import type { Song } from '../types';
import { GM_INSTRUMENTS } from '../types';
import PianoView from './PianoView';
import Flute, { BANSURI_SCALES } from './Flute';
import GuitarTabs from './GuitarTabs';
import HarmoniumView from './HarmoniumView';
import { transposeKey } from '../lib/midi';

interface Props { song: Song; }

// Loose typing — abcjs's CursorControl.onEvent uses NoteTimingEvent whose
// midiPitches shape is wider than what we read here. Treat as any to avoid
// fighting upstream type drift.
type AbcEvent = any;

// Map a MIDI number to a chromatic note letter using sharp spelling (C, C#, D, ... B).
function midiToNoteLetter(midi: number): string {
  const CHROMATIC: Record<number, string> = {
    0:'C',1:'C#',2:'D',3:'D#',4:'E',5:'F',6:'F#',7:'G',8:'G#',9:'A',10:'A#',11:'B',
  };
  return CHROMATIC[midi % 12];
}

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
  const [metronome, setMetronome] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [practiceMode, setPracticeMode] = useState(false);
  const [capo, setCapo] = useState(0);
  const [bansuriScaleIdx, setBansuriScaleIdx] = useState(0);
  const bansuriScale = BANSURI_SCALES[bansuriScaleIdx];

  const [activeMidi, setActiveMidi] = useState<Set<number>>(new Set());
  const [currentMs, setCurrentMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
            tickFrame();
          },
          onFinished: () => {
            setActiveMidi(new Set());
            if (loopEnabled) {
              try { synthControlRef.current?.restart(); } catch { /* noop */ }
            }
          },
          onEvent: (ev: AbcEvent) => {
            if (!ev?.midiPitches) return;
            // midiTranspose has already shifted ev.midiPitches — don't add transpose again.
            const next = new Set<number>();
            for (const p of ev.midiPitches) next.add(p.pitch);
            setActiveMidi(next);
            if (loopEnabled && loopEnd > loopStart && (ev.milliseconds ?? 0) >= loopEnd) {
              try { synthControlRef.current?.restart(); } catch { /* noop */ }
            }
          },
          onBeat: () => {
            if (metronome) {
              const o = audioCtx.createOscillator();
              const g = audioCtx.createGain();
              o.frequency.value = 1200;
              g.gain.value = 0.06;
              o.connect(g).connect(audioCtx.destination);
              o.start();
              o.stop(audioCtx.currentTime + 0.03);
            }
          },
        };

        const synthControl = new abcjs.synth.SynthController();
        synthControl.load('#abc-audio', cursorControl, {
          displayLoop: true, displayRestart: true, displayPlay: true, displayProgress: true, displayWarp: true,
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

  // Live tempo: warp playback speed without re-initialising the synth.
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
    if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
    try { await synthControlRef.current?.play(); } catch (e) { setError((e as Error).message); }
  }
  function handlePause() { try { synthControlRef.current?.pause(); } catch { /* noop */ } }
  function handleRestart() { try { synthControlRef.current?.restart(); } catch { /* noop */ } }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{song.title}</h2>
        {song.composer && <p className="text-sm text-slate-400">{song.composer}</p>}
      </div>

      {error && (
        <div className="rounded-md bg-red-950/60 border border-red-800 text-red-200 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Instrument-driven visual: Piano keyboard, Flute SVG, or Guitar tablature */}
      {instrument === 0 && (
        <div className="rounded-md bg-slate-900 border border-slate-800 p-4">
          <PianoView activeMidi={activeMidi} showLabels={showLabels} />
        </div>
      )}
      {instrument === 73 && (
        <div className="space-y-2">
          <Flute
            note={activeMidi.size > 0 ? midiToNoteLetter(Math.min(...activeMidi)) : null}
            bansuriScale={bansuriScale}
          />
          <div className="flex items-center gap-3 bg-stone-100 border border-stone-300 rounded-md px-3 py-2">
            <label className="text-xs font-medium text-stone-800 whitespace-nowrap">
              Bansuri scale: <span className="font-mono">{bansuriScale}</span>
            </label>
            <input
              type="range" min={0} max={BANSURI_SCALES.length - 1} step={1}
              value={bansuriScaleIdx}
              onChange={(e) => setBansuriScaleIdx(Number(e.target.value))}
              className="flex-1 accent-stone-700"
            />
            <div className="flex gap-0.5 text-[10px] text-stone-700">
              {BANSURI_SCALES.map((s) => (
                <span key={s} className="w-5 text-center font-mono">{s}</span>
              ))}
            </div>
          </div>
        </div>
      )}
      {instrument === 24 && (
        <div className="space-y-2">
          <GuitarTabs activeMidi={activeMidi} showLabels={showLabels} capo={capo} />
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <label className="text-xs font-medium text-amber-900 whitespace-nowrap">
              Capo: {capo === 0 ? 'Off' : `Fret ${capo}`}
            </label>
            <input
              type="range" min={0} max={10} step={1} value={capo}
              onChange={(e) => setCapo(Number(e.target.value))}
              className="flex-1 accent-amber-700"
            />
            <div className="flex gap-0.5 text-[10px] text-amber-800">
              {Array.from({ length: 11 }).map((_, i) => (
                <span key={i} className="w-5 text-center">{i}</span>
              ))}
            </div>
          </div>
        </div>
      )}
      {instrument === 20 && (
        <HarmoniumView activeMidi={activeMidi} showLabels={showLabels} isPumping={activeMidi.size > 0} />
      )}

      {/* abcjs needs the sheet container in the DOM for its synth/cursor; keep it off-screen */}
      <div style={{ position: 'absolute', left: -99999, top: -99999, width: 1, height: 1, overflow: 'hidden' }}>
        <div ref={sheetRef} className="abc-render" />
      </div>

      {/* Built-in abcjs audio control bar */}
      <div id="abc-audio" className="bg-slate-100 rounded-md p-2" />

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900 border border-slate-800 rounded-md p-4">
        <div className="flex gap-2 items-center flex-wrap">
          <button disabled={!ready} onClick={handlePlay}
            className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40">▶ Play</button>
          <button onClick={handlePause}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700">⏸ Pause</button>
          <button onClick={handleRestart}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700">⏮ Restart</button>
          <span className="ml-auto text-xs text-slate-400">{(currentMs / 1000).toFixed(1)}s</span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Instrument</label>
          <select value={instrument} onChange={(e) => setInstrument(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-sm">
            {GM_INSTRUMENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Tempo: {tempo} BPM</label>
          <input type="range" min={40} max={240} value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}/>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">
            Transpose: {transpose > 0 ? '+' : ''}{transpose} semitones
          </label>
          <input type="range" min={-12} max={12} value={transpose}
            onChange={(e) => setTranspose(Number(e.target.value))}/>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Scale:</span>
            <input readOnly value={transposeKey(song.scale, transpose)}
              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200 font-mono text-center"/>
            <span className="text-slate-500">(original: {song.scale})</span>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          Show note labels
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={metronome} onChange={(e) => setMetronome(e.target.checked)} />
          Metronome click
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={practiceMode} onChange={(e) => setPracticeMode(e.target.checked)} />
          Practice mode (Web MIDI — coming soon)
        </label>

        <div className="md:col-span-2 border-t border-slate-800 pt-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={loopEnabled} onChange={(e) => setLoopEnabled(e.target.checked)} />
            Loop section A↔B
          </label>
          {loopEnabled && (
            <div className="mt-2 flex gap-2 items-center text-xs text-slate-300 flex-wrap">
              <span>A:</span>
              <input type="number" value={loopStart} onChange={(e) => setLoopStart(Number(e.target.value))}
                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1"/> ms
              <button onClick={() => setLoopStart(Math.round(currentMs))}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Set A from cursor</button>
              <span>B:</span>
              <input type="number" value={loopEnd} onChange={(e) => setLoopEnd(Number(e.target.value))}
                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1"/> ms
              <button onClick={() => setLoopEnd(Math.round(currentMs))}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Set B from cursor</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
