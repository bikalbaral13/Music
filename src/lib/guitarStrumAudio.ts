import { type ChordShape, type StrumPattern, chordMidis } from './guitarChords';

// Sample MIDI pitches we have on disk. Anything else is played by pitch-shifting
// the nearest sample via playbackRate. Names match the file naming convention
// (sharps written with 's', e.g. As2 = A#2).
const SAMPLE_MIDIS = [40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70, 73] as const;
const SAMPLE_FILES: Record<number, string> = {
  40: 'E2.mp3', 43: 'G2.mp3', 46: 'As2.mp3', 49: 'Cs3.mp3',
  52: 'E3.mp3', 55: 'G3.mp3', 58: 'As3.mp3', 61: 'Cs4.mp3',
  64: 'E4.mp3', 67: 'G4.mp3', 70: 'As4.mp3', 73: 'Cs5.mp3',
};
const SAMPLE_BASE = '/samples/guitar-acoustic/';

// Web Audio scheduler that loops a strum pattern on a chord, locked to the
// song clock. Each strum is a sequence of plucks across the chord's strings
// with a small inter-string stagger to imitate the pick sweep.
//
// Plucks are real acoustic-guitar samples (CC-BY 3.0, tonejs-instruments) —
// for any chord note we pick the nearest sampled pitch and pitch-shift via
// playbackRate (max ±1.5 semitones, inaudible quality loss).
export class GuitarStrumPlayer {
  private ctx: AudioContext;
  private master: GainNode;
  private timerId: number | null = null;
  private nextNoteTime = 0;
  private nextSlot = 0;
  private chord: ChordShape;
  private pattern: StrumPattern;
  private tempo: number;
  private playing = false;
  private buffers: Map<number, AudioBuffer> = new Map();
  private loadPromise: Promise<void> | null = null;

  constructor(ctx: AudioContext, chord: ChordShape, pattern: StrumPattern, tempo: number) {
    this.ctx = ctx;
    this.chord = chord;
    this.pattern = pattern;
    this.tempo = tempo;
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(ctx.destination);
    this.loadPromise = this.loadSamples();
  }

  setChord(c: ChordShape) { this.chord = c; }
  setPattern(p: StrumPattern) { this.pattern = p; }
  setTempo(t: number) { this.tempo = t; }

  async start(songMs: number) {
    if (this.playing) return;
    // Make sure samples are decoded before kicking off the scheduler — first
    // strum will be silent otherwise.
    if (this.loadPromise) {
      try { await this.loadPromise; } catch { /* fall back to silence */ }
    }
    this.playing = true;
    const slotSec = 60 / this.tempo / this.pattern.slotsPerBeat;
    const songSlots = (songMs / 1000) / slotSec;
    const next = Math.floor(songSlots) + 1;
    const delaySec = Math.max(0, next * slotSec - songMs / 1000);
    this.nextSlot = next;
    this.nextNoteTime = this.ctx.currentTime + delaySec;
    this.scheduler();
  }

  stop() {
    this.playing = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private async loadSamples(): Promise<void> {
    const tasks = SAMPLE_MIDIS.map(async (m) => {
      try {
        const res = await fetch(SAMPLE_BASE + SAMPLE_FILES[m]);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr);
        this.buffers.set(m, buf);
      } catch (e) {
        console.warn('Failed to load guitar sample', SAMPLE_FILES[m], e);
      }
    });
    await Promise.all(tasks);
  }

  private scheduler = () => {
    const lookaheadSec = 0.12;
    const slotSec = 60 / this.tempo / this.pattern.slotsPerBeat;
    const total = this.pattern.beats * this.pattern.slotsPerBeat;
    while (this.playing && this.nextNoteTime < this.ctx.currentTime + lookaheadSec) {
      const idx = ((this.nextSlot % total) + total) % total;
      const dir = this.pattern.slots[idx];
      this.fireStrum(dir, this.nextNoteTime);
      this.nextNoteTime += slotSec;
      this.nextSlot++;
    }
    if (this.playing) this.timerId = window.setTimeout(this.scheduler, 25);
  };

  private fireStrum(dir: 'D' | 'U' | '-', when: number) {
    if (dir === '-') return;
    const notes = chordMidis(this.chord);
    if (notes.length === 0) return;
    const order = dir === 'D' ? notes : [...notes].reverse();
    const stagger = dir === 'D' ? 0.014 : 0.010;
    const baseVol = dir === 'D' ? 0.7 : 0.55;
    order.forEach((n, i) => this.pluck(n.midi, when + i * stagger, baseVol));
  }

  private pluck(midi: number, when: number, vol: number) {
    // Find the nearest loaded sample and pitch-shift to the requested midi.
    let nearest: number = SAMPLE_MIDIS[0];
    let bestDist = Infinity;
    for (const m of SAMPLE_MIDIS) {
      const d = Math.abs(m - midi);
      if (d < bestDist) { bestDist = d; nearest = m; }
    }
    const buf = this.buffers.get(nearest);
    if (!buf) return;

    const semitones = midi - nearest;
    const rate = Math.pow(2, semitones / 12);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    // Light release so overlapping strums don't pile up forever.
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);

    src.connect(g).connect(this.master);
    src.start(when);
    src.stop(when + 1.7);
  }
}
