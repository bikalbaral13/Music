// Autocorrelation-based pitch detection. Works well for clean monophonic
// input (single voice, flute, guitar) — not for polyphony.

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export interface PitchResult {
  frequency: number;        // Hz
  noteName: string;         // e.g. "A4"
  midi: number;             // 21..108
  cents: number;            // signed offset from the nearest note, -50..+50
  amplitude: number;        // RMS of the analysed window, 0..1
}

/**
 * Estimate the fundamental frequency of `buffer` using a normalised
 * autocorrelation function with parabolic peak interpolation.
 * Returns null if the signal is too quiet or aperiodic.
 */
export function detectPitch(buffer: Float32Array<ArrayBufferLike>, sampleRate: number): PitchResult | null {
  const N = buffer.length;

  // RMS gate — too quiet means there's nothing meaningful to analyse.
  let sumSq = 0;
  for (let i = 0; i < N; i++) sumSq += buffer[i] * buffer[i];
  const rms = Math.sqrt(sumSq / N);
  if (rms < 0.01) return null;

  // Trim leading/trailing samples below 20% peak — focuses correlation on
  // the steady portion of the signal.
  const threshold = 0.2;
  let start = 0, end = N - 1;
  for (let i = 0; i < N / 2; i++) {
    if (Math.abs(buffer[i]) > threshold) { start = i; break; }
  }
  for (let i = N - 1; i >= N / 2; i--) {
    if (Math.abs(buffer[i]) > threshold) { end = i; break; }
  }
  const len = end - start;
  if (len < 200) return null;

  // Autocorrelation over the trimmed window.
  const minPeriod = Math.floor(sampleRate / 2000); // up to ~2 kHz (e.g. C7)
  const maxPeriod = Math.floor(sampleRate / 50);   // down to ~50 Hz (sub-bass)
  const correlations = new Float32Array(maxPeriod + 1);

  let bestVal = 0;
  for (let k = minPeriod; k <= maxPeriod; k++) {
    let sum = 0;
    for (let i = 0; i < len - k; i++) {
      sum += buffer[start + i] * buffer[start + i + k];
    }
    correlations[k] = sum;
    if (sum > bestVal) bestVal = sum;
  }

  if (bestVal <= 0) return null;

  // Walk past the descending edge from lag 0 until we hit a local minimum,
  // then pick the FIRST local maximum whose correlation exceeds 90 % of the
  // global max. This avoids two failure modes:
  //   (a) the classic autocorrelation octave error where the 2×-period peak
  //       outweighs the true fundamental at low frequencies;
  //   (b) treating the high correlation just past lag 0 as a "peak" against
  //       uninitialised zeros.
  const peakThresh = 0.9 * bestVal;
  let bestK = -1;
  // Find first local minimum after minPeriod.
  let k0 = minPeriod + 1;
  while (k0 < maxPeriod && correlations[k0] <= correlations[k0 - 1]) k0++;
  for (let k = k0; k <= maxPeriod - 1; k++) {
    if (correlations[k] > peakThresh &&
        correlations[k] >= correlations[k - 1] &&
        correlations[k] >= correlations[k + 1]) {
      bestK = k;
      break;
    }
  }
  if (bestK < 0) return null;

  // Parabolic interpolation around the peak for sub-sample accuracy.
  let refinedK = bestK;
  if (bestK > minPeriod && bestK < maxPeriod) {
    const y0 = correlations[bestK - 1];
    const y1 = correlations[bestK];
    const y2 = correlations[bestK + 1];
    const denom = y0 - 2 * y1 + y2;
    if (denom !== 0) {
      const shift = 0.5 * (y0 - y2) / denom;
      refinedK = bestK + shift;
    }
  }

  const frequency = sampleRate / refinedK;
  if (!Number.isFinite(frequency) || frequency < 50 || frequency > 2000) return null;

  // Map Hz → MIDI → note name + cents offset.
  const midiFloat = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(midiFloat);
  const cents = (midiFloat - midi) * 100;
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);

  return { frequency, noteName, midi, cents, amplitude: rms };
}
