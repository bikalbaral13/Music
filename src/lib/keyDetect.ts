// Krumhansl-Schmuckler key-finding: compute a 12-bin pitch-class profile
// (chromagram) from the audio, correlate with major/minor templates rotated
// to each of 12 possible tonics, return the best match.
//
// Three well-known profile sets are offered. Krumhansl is the classic;
// Temperley and Bellman-Budge are refinements derived from larger corpora.

export type DetectionMethod = 'krumhansl' | 'temperley' | 'bellman-budge';

export const DETECTION_METHODS: { value: DetectionMethod; label: string; hint: string }[] = [
  { value: 'krumhansl',     label: 'Krumhansl–Kessler (1982)', hint: 'Classic perceptual-experiment profiles. Strong default.' },
  { value: 'temperley',     label: 'Temperley (1999)',         hint: 'Refined from common-practice corpora; favours tonic/dominant slightly less.' },
  { value: 'bellman-budge', label: 'Bellman-Budge (1958)',     hint: 'Older statistical profiles from classical music analysis.' },
];

const PROFILES: Record<DetectionMethod, { major: number[]; minor: number[] }> = {
  krumhansl: {
    major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
  },
  temperley: {
    major: [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0],
    minor: [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0],
  },
  'bellman-budge': {
    major: [16.80, 0.86, 12.95, 1.41, 13.49, 11.93, 1.25, 20.28, 1.80, 8.04, 0.62, 10.57],
    minor: [18.16, 0.69, 12.99, 13.34, 1.07, 11.15, 1.38, 21.07, 7.49, 1.53, 0.92, 10.21],
  },
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export interface KeyDetectionResult {
  root: number;                   // 0..11
  rootName: string;
  mode: 'major' | 'minor';
  confidence: number;             // Pearson correlation, -1..1
  alternatives: Array<{ rootName: string; mode: 'major' | 'minor'; correlation: number }>;
  chroma: number[];               // normalized 12-element pitch-class profile
}

export function detectKey(audio: AudioBuffer, method: DetectionMethod = 'krumhansl'): KeyDetectionResult {
  const chroma = computeChroma(audio);
  return correlateProfiles(chroma, method);
}

// ── Chromagram via STFT → log-bin into 12 pitch classes ──────────────────
function computeChroma(audio: AudioBuffer): number[] {
  const sr = audio.sampleRate;
  const len = audio.length;

  // Downmix to mono.
  const mono = new Float32Array(len);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i] / audio.numberOfChannels;
  }

  const N = 4096;
  const HOP = 2048;
  // Hann window
  const window = new Float32Array(N);
  for (let i = 0; i < N; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

  const chroma = new Array<number>(12).fill(0);
  const re = new Float32Array(N);
  const im = new Float32Array(N);

  for (let start = 0; start + N <= len; start += HOP) {
    for (let i = 0; i < N; i++) {
      re[i] = mono[start + i] * window[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    for (let k = 1; k < N / 2; k++) {
      const freq = (k * sr) / N;
      if (freq < 80 || freq > 4000) continue;
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      // MIDI pitch from frequency: 12 * log2(f / 440) + 69
      const pitch = 12 * Math.log2(freq / 440) + 69;
      const pc = ((Math.round(pitch) % 12) + 12) % 12;
      chroma[pc] += mag;
    }
  }
  const sum = chroma.reduce((a, b) => a + b, 0);
  if (sum > 0) for (let i = 0; i < 12; i++) chroma[i] /= sum;
  return chroma;
}

// ── Compare chroma against rotated profile templates ─────────────────────
function correlateProfiles(chroma: number[], method: DetectionMethod): KeyDetectionResult {
  const { major, minor } = PROFILES[method];
  const candidates: { root: number; mode: 'major' | 'minor'; correlation: number }[] = [];
  for (let r = 0; r < 12; r++) {
    candidates.push({ root: r, mode: 'major', correlation: pearson(chroma, rotateProfile(major, r)) });
    candidates.push({ root: r, mode: 'minor', correlation: pearson(chroma, rotateProfile(minor, r)) });
  }
  candidates.sort((a, b) => b.correlation - a.correlation);
  const top = candidates[0];
  return {
    root: top.root,
    rootName: NOTE_NAMES[top.root],
    mode: top.mode,
    confidence: top.correlation,
    chroma,
    alternatives: candidates.slice(0, 5).map((c) => ({
      rootName: NOTE_NAMES[c.root],
      mode: c.mode,
      correlation: c.correlation,
    })),
  };
}

function rotateProfile(profile: number[], root: number): number[] {
  const out = new Array<number>(12);
  for (let i = 0; i < 12; i++) out[(i + root) % 12] = profile[i];
  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n, meanB = sumB / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  return denA && denB ? num / Math.sqrt(denA * denB) : 0;
}

// ── Radix-2 Cooley-Tukey FFT (in-place, length must be power of 2) ──────
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const xRe = re[i + j + half], xIm = im[i + j + half];
        const vRe = xRe * curRe - xIm * curIm;
        const vIm = xRe * curIm + xIm * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const tmp = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = tmp;
      }
    }
  }
}

// ── Mic capture helper — record `durationMs` and decode to AudioBuffer ───
export async function recordToAudioBuffer(durationMs: number): Promise<AudioBuffer> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const chunks: BlobPart[] = [];
  const rec = new MediaRecorder(stream);
  return new Promise<AudioBuffer>((resolve, reject) => {
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onerror = () => reject(new Error('MediaRecorder error'));
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const arr = await blob.arrayBuffer();
        const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new Ctor();
        const buf = await ctx.decodeAudioData(arr);
        void ctx.close().catch(() => {});
        resolve(buf);
      } catch (e) {
        reject(e);
      }
    };
    rec.start();
    setTimeout(() => { try { rec.stop(); } catch { /* noop */ } }, durationMs);
  });
}
