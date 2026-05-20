// Gemini Lyria 3 music generation via REST. Returns base64-encoded audio
// the caller can stash as a data URL on a Song or expose for download.
//
// Browser security note: the API key travels in a query string from the
// user's browser — anyone inspecting network traffic on their machine can
// read it. The UI surfaces a warning about this. For production, the key
// would belong on a backend proxy.

export interface LyriaResult {
  audioBase64: string;
  mimeType: string;
  /** Any text parts returned alongside the audio (lyrics, metadata). */
  texts: string[];
}

export const LYRIA_MODELS: { value: string; label: string; hint: string }[] = [
  { value: 'lyria-3-clip-preview', label: 'Lyria 3 — Clip (≈30s)',   hint: 'Short instrumental clip. Fastest.' },
  { value: 'lyria-3-pro-preview',  label: 'Lyria 3 — Pro (full)',    hint: 'Full-length composition. Slower and larger.' },
];

export async function generateWithLyria(opts: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<LyriaResult> {
  const apiKey = opts.apiKey.trim();
  if (!apiKey) throw new Error('Missing API key');
  if (!opts.prompt.trim()) throw new Error('Prompt is empty');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ parts: [{ text: opts.prompt }] }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j).slice(0, 200);
    } catch { /* ignore */ }
    throw new Error(`Gemini API ${res.status}: ${detail || res.statusText}`);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) throw new Error('No content parts in response');

  let audioBase64: string | null = null;
  let mimeType = 'audio/mp3';
  const texts: string[] = [];
  for (const p of parts) {
    if (p?.inlineData?.data) {
      audioBase64 = p.inlineData.data;
      if (p.inlineData.mimeType) mimeType = p.inlineData.mimeType;
    } else if (typeof p?.text === 'string') {
      texts.push(p.text);
    }
  }
  if (!audioBase64) throw new Error('Response contained no audio data');

  return { audioBase64, mimeType, texts };
}

/** Convert base64 + mime to a `data:` URL so we can stash it on a Song. */
export function toDataUrl(audioBase64: string, mimeType: string): string {
  return `data:${mimeType};base64,${audioBase64}`;
}
