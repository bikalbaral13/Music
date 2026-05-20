import type { DrumPattern, DrumPiece } from '../components/Drumset';

// Web Audio scheduler that loops a drum groove locked to the song clock.
// Each kit piece has its own synthesised voice.
export class DrumPlayer {
  private ctx: AudioContext;
  private master: GainNode;
  private noiseBuffer: AudioBuffer;
  private timerId: number | null = null;
  private nextNoteTime = 0;
  private nextSlot = 0;
  private pattern: DrumPattern;
  private tempo: number;
  private playing = false;

  constructor(ctx: AudioContext, pattern: DrumPattern, tempo: number) {
    this.ctx = ctx;
    this.pattern = pattern;
    this.tempo = tempo;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);
    this.noiseBuffer = this.makeNoise();
  }

  setPattern(p: DrumPattern) { this.pattern = p; }
  setTempo(t: number) { this.tempo = t; }

  start(songMs: number) {
    if (this.playing) return;
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

  private scheduler = () => {
    const lookaheadSec = 0.12;
    const slotSec = 60 / this.tempo / this.pattern.slotsPerBeat;
    const total = this.pattern.beats * this.pattern.slotsPerBeat;
    while (this.playing && this.nextNoteTime < this.ctx.currentTime + lookaheadSec) {
      const idx = ((this.nextSlot % total) + total) % total;
      const hits = this.pattern.slots[idx] ?? [];
      for (const h of hits) this.firePiece(h, this.nextNoteTime);
      this.nextNoteTime += slotSec;
      this.nextSlot++;
    }
    if (this.playing) this.timerId = window.setTimeout(this.scheduler, 25);
  };

  private firePiece(p: DrumPiece, when: number) {
    switch (p) {
      case 'K':  return this.kick(when);
      case 'S':  return this.snare(when);
      case 'H':  return this.hatClosed(when);
      case 'O':  return this.hatOpen(when);
      case 'CR': return this.crash(when);
      case 'R':  return this.ride(when);
      case 'T1': return this.tom(when, 220);
      case 'T2': return this.tom(when, 165);
      case 'F':  return this.tom(when, 110);
    }
  }

  // --- Voices -------------------------------------------------------------

  private kick(when: number) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 1.0; g.connect(this.master);
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    og.gain.setValueAtTime(0.0001, when);
    og.gain.exponentialRampToValueAtTime(1.0, when + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(og).connect(g);
    osc.start(when); osc.stop(when + 0.3);
    // Click for beater attack
    this.noiseBurst(when, 2500, 0.012, 0.4, g);
  }

  private snare(when: number) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0.85; g.connect(this.master);
    // Tonal body — two sines for the head fundamental
    const osc1 = ctx.createOscillator(); const og1 = ctx.createGain();
    osc1.frequency.setValueAtTime(200, when);
    osc1.frequency.exponentialRampToValueAtTime(170, when + 0.08);
    og1.gain.setValueAtTime(0.0001, when);
    og1.gain.exponentialRampToValueAtTime(0.6, when + 0.005);
    og1.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    osc1.connect(og1).connect(g); osc1.start(when); osc1.stop(when + 0.15);
    // Snare wires — bandpassed noise
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.9, when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    src.connect(bp).connect(ng).connect(g);
    src.start(when); src.stop(when + 0.22);
  }

  private hatClosed(when: number) { this.hat(when, 0.04, 0.45); }
  private hatOpen(when: number)   { this.hat(when, 0.30, 0.50); }
  private hat(when: number, dur: number, vol: number) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = vol; g.connect(this.master);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; hp.Q.value = 0.7;
    const peak = ctx.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 9500; peak.Q.value = 5; peak.gain.value = 6;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(1.0, when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(hp).connect(peak).connect(ng).connect(g);
    src.start(when); src.stop(when + dur + 0.02);
  }

  private crash(when: number) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0.6; g.connect(this.master);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
    const peak = ctx.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 8000; peak.Q.value = 3; peak.gain.value = 8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(1.0, when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 1.2);
    src.connect(hp).connect(peak).connect(ng).connect(g);
    src.start(when); src.stop(when + 1.3);
  }

  private ride(when: number) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0.55; g.connect(this.master);
    // Bell tone
    const osc = ctx.createOscillator(); const og = ctx.createGain();
    osc.frequency.value = 620;
    og.gain.setValueAtTime(0.0001, when);
    og.gain.exponentialRampToValueAtTime(0.5, when + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
    osc.connect(og).connect(g); osc.start(when); osc.stop(when + 0.3);
    // Shimmer
    this.noiseBurst(when, 7000, 0.18, 0.35, g);
  }

  private tom(when: number, freq: number) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0.85; g.connect(this.master);
    const osc = ctx.createOscillator(); const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.6, when);
    osc.frequency.exponentialRampToValueAtTime(freq, when + 0.08);
    og.gain.setValueAtTime(0.0001, when);
    og.gain.exponentialRampToValueAtTime(1.0, when + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
    osc.connect(og).connect(g); osc.start(when); osc.stop(when + 0.32);
    this.noiseBurst(when, freq * 6, 0.04, 0.4, g);
  }

  private noiseBurst(when: number, lpFreq: number, dur: number, vol: number, dest: AudioNode) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = lpFreq;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(vol, when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filt).connect(ng).connect(dest);
    src.start(when); src.stop(when + dur + 0.02);
  }

  private makeNoise(): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * 0.5), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
