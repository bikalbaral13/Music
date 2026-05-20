// Client-side stem-splitting via classical DSP. NOT neural-network quality —
// for that you'd ship a Demucs/Spleeter model (~150MB) or call a cloud API.
// Each method runs entirely in Web Audio API, so it works offline.

export type StemMethod =
  | 'karaoke'   // L−R: subtracts hard-centred content (vocals, kick, bass)
  | 'vocal'     // band-pass on mid (L+R)/2 in 200 Hz–4 kHz
  | 'bass'      // low-pass < 200 Hz
  | 'highs'     // high-pass > 4 kHz
  | 'mid';      // band-pass 200 Hz–4 kHz (no center isolation)

export const STEM_METHODS: { value: StemMethod; label: string; hint: string }[] = [
  { value: 'karaoke', label: 'Karaoke (remove vocals)',   hint: 'Subtracts L−R so anything panned to the centre (vocals, kick, bass) is cancelled.' },
  { value: 'vocal',   label: 'Vocal isolate (mid + BP)',  hint: 'Sums L+R then band-passes 200 Hz–4 kHz. Leans the mix toward centred mid-range content.' },
  { value: 'bass',    label: 'Bass (low-pass)',           hint: 'Keeps frequencies below 200 Hz — bass and kick.' },
  { value: 'highs',   label: 'Highs (high-pass)',         hint: 'Keeps frequencies above 4 kHz — cymbals, sibilance, air.' },
  { value: 'mid',     label: 'Mids (band-pass)',          hint: 'Vocal-range filter, 200 Hz–4 kHz.' },
];

export async function decodeAudio(file: File): Promise<AudioBuffer> {
  const buf = await file.arrayBuffer();
  const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctor();
  try {
    return await ctx.decodeAudioData(buf.slice(0));
  } finally {
    void ctx.close().catch(() => {});
  }
}

export async function processStem(input: AudioBuffer, method: StemMethod): Promise<AudioBuffer> {
  switch (method) {
    case 'karaoke': return processKaraoke(input);
    case 'vocal':   return processFilteredMid(input, 200, 4000);
    case 'bass':    return processFilter(input, 'lowpass',  200, 0.7);
    case 'highs':   return processFilter(input, 'highpass', 4000, 0.7);
    case 'mid':     return processBandpass(input, 200, 4000);
  }
}

// ── Center-channel removal: out = (L − R) * 0.7 on both channels ─────────
async function processKaraoke(input: AudioBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, input.length, input.sampleRate);
  const out = ctx.createBuffer(2, input.length, input.sampleRate);
  if (input.numberOfChannels < 2) {
    // Mono input — nothing to subtract; return as-is.
    out.copyToChannel(input.getChannelData(0), 0);
    out.copyToChannel(input.getChannelData(0), 1);
    return out;
  }
  const L = input.getChannelData(0);
  const R = input.getChannelData(1);
  const O = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) O[i] = (L[i] - R[i]) * 0.7;
  out.copyToChannel(O, 0);
  out.copyToChannel(O, 1);
  return out;
}

// ── Mid (L+R)/2 then band-pass ───────────────────────────────────────────
async function processFilteredMid(input: AudioBuffer, lowHz: number, highHz: number): Promise<AudioBuffer> {
  const monoMid = new Float32Array(input.length);
  if (input.numberOfChannels < 2) {
    monoMid.set(input.getChannelData(0));
  } else {
    const L = input.getChannelData(0);
    const R = input.getChannelData(1);
    for (let i = 0; i < input.length; i++) monoMid[i] = (L[i] + R[i]) * 0.5;
  }
  const midBuf = new AudioBuffer({ length: input.length, sampleRate: input.sampleRate, numberOfChannels: 1 });
  midBuf.copyToChannel(monoMid, 0);
  return processBandpass(midBuf, lowHz, highHz);
}

// ── Single-stage biquad filter ───────────────────────────────────────────
async function processFilter(input: AudioBuffer, type: BiquadFilterType, frequency: number, Q: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(input.numberOfChannels, input.length, input.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = input;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = frequency; f.Q.value = Q;
  src.connect(f).connect(ctx.destination);
  src.start();
  return await ctx.startRendering();
}

// ── HP → LP chain to form a wider band-pass than the biquad bandpass type ─
async function processBandpass(input: AudioBuffer, lowHz: number, highHz: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(input.numberOfChannels, input.length, input.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = input;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = lowHz;  hp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = highHz; lp.Q.value = 0.7;
  src.connect(hp).connect(lp).connect(ctx.destination);
  src.start();
  return await ctx.startRendering();
}

// ── AudioBuffer → 16-bit PCM WAV Blob ────────────────────────────────────
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const length = buffer.length;
  const dataSize = length * blockAlign;
  const bufferOut = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bufferOut);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bufferOut], { type: 'audio/wav' });
}
