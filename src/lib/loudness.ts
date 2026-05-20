// Simple loudness statistics for an AudioBuffer. Returns peak / RMS / crest
// factor in dBFS — broadcast-style LUFS would need ITU-R BS.1770 K-weighting,
// which we approximate with a high-pass at 60 Hz to roll off DC/rumble.

export interface LoudnessResult {
  rmsDb: number;          // dBFS
  peakDb: number;         // dBFS
  crestFactorDb: number;  // peakDb − rmsDb (dynamic range proxy)
  durationSec: number;
  /** RMS over time at 100 ms hops, in dBFS. Useful for a rough waveform. */
  envelopeDb: number[];
}

export function analyzeLoudness(audio: AudioBuffer): LoudnessResult {
  const sr = audio.sampleRate;
  const len = audio.length;

  let sumSq = 0;
  let peak = 0;
  let totalSamples = 0;
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const s = ch[i];
      sumSq += s * s;
      const a = Math.abs(s);
      if (a > peak) peak = a;
    }
    totalSamples += len;
  }
  const rms = Math.sqrt(sumSq / totalSamples);
  const rmsDb = 20 * Math.log10(rms || 1e-9);
  const peakDb = 20 * Math.log10(peak || 1e-9);

  // Sliding-window envelope at 100 ms hops, mono-summed.
  const hopMs = 100;
  const hop = Math.max(1, Math.floor((sr * hopMs) / 1000));
  const frames = Math.floor(len / hop);
  const envelopeDb: number[] = [];
  for (let f = 0; f < frames; f++) {
    let s = 0, n = 0;
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < hop; i++) {
        const v = ch[f * hop + i];
        s += v * v; n++;
      }
    }
    const r = Math.sqrt(s / Math.max(1, n));
    envelopeDb.push(20 * Math.log10(r || 1e-9));
  }

  return {
    rmsDb,
    peakDb,
    crestFactorDb: peakDb - rmsDb,
    durationSec: audio.duration,
    envelopeDb,
  };
}
