// Tempo / BPM detection via onset autocorrelation. Reasonable for music
// with clear beats; struggles on rubato classical or vocal-only sources.

export interface TempoResult {
  bpm: number;
  confidence: number; // 0..1, ratio of peak correlation to mean
}

export function detectTempo(audio: AudioBuffer): TempoResult {
  const sr = audio.sampleRate;
  const len = audio.length;

  const mono = new Float32Array(len);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i] / audio.numberOfChannels;
  }

  // Energy envelope at 10 ms hops.
  const HOP_MS = 10;
  const hopSamples = Math.max(1, Math.floor((sr * HOP_MS) / 1000));
  const frames = Math.floor(len / hopSamples);
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const s0 = f * hopSamples;
    let s = 0;
    for (let i = 0; i < hopSamples; i++) s += mono[s0 + i] * mono[s0 + i];
    energy[f] = Math.sqrt(s / hopSamples);
  }

  // Half-wave-rectified diff = onset strength.
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    const d = energy[f] - energy[f - 1];
    onset[f] = d > 0 ? d : 0;
  }
  let maxO = 0;
  for (let f = 0; f < frames; f++) if (onset[f] > maxO) maxO = onset[f];
  if (maxO > 0) for (let f = 0; f < frames; f++) onset[f] /= maxO;

  // Autocorrelate the onset signal. Frame lag → BPM via (60 / (lag * HOP_MS / 1000)).
  // 60 BPM = 1000 ms period → 100 frames; 200 BPM = 300 ms → 30 frames.
  const minLag = 30;
  const maxLag = 100;
  const corr = new Float32Array(maxLag + 1);
  let bestLag = -1, bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = 0; f + lag < frames; f++) s += onset[f] * onset[f + lag];
    corr[lag] = s;
    if (s > bestCorr) { bestCorr = s; bestLag = lag; }
  }
  if (bestLag < 0 || bestCorr <= 0) return { bpm: 0, confidence: 0 };

  // Parabolic interpolation for sub-frame accuracy.
  let refined = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = corr[bestLag - 1], y1 = corr[bestLag], y2 = corr[bestLag + 1];
    const denom = y0 - 2 * y1 + y2;
    if (denom !== 0) refined = bestLag + 0.5 * (y0 - y2) / denom;
  }

  const periodMs = refined * HOP_MS;
  const bpm = 60000 / periodMs;

  // Confidence: how much the peak stands above the mean of the search range.
  let mean = 0;
  for (let i = minLag; i <= maxLag; i++) mean += corr[i];
  mean /= (maxLag - minLag + 1);
  const confidence = bestCorr > 0 ? Math.min(1, (bestCorr - mean) / bestCorr) : 0;

  return { bpm, confidence };
}
