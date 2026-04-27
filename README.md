# 🎵 Music Learner

A browser-based music learning app for ABC notation. Upload a song (ABC + tempo + scale), play it back with selectable instruments, and follow along on **sheet music**, **piano keyboard**, or **falling notes** views.

Built with **Vite + React + TypeScript + Tailwind v4 + abcjs**.

## Features

- Library of songs stored in **localStorage** (no backend required)
- **Import / Export** songs as JSON (you own your data)
- **ABC notation editor** with live preview
- Three synced playback views: Sheet music · Piano · Falling notes
- **Selectable instruments** (Piano, Guitar, Violin, Flute, etc. — General MIDI)
- **Tempo slider** (40–240 BPM)
- **Transpose** (±12 semitones)
- **A↔B loop** for practicing a section
- **Metronome** click track
- Toggleable note labels
- Three sample songs preloaded (Twinkle Twinkle, Ode to Joy, C Major Scale)
- Practice mode (Web MIDI input) — UI present, full implementation in next iteration

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

> Audio note: browsers require a user gesture to start audio. Click **Play** on the audio bar — autoplay won't work.

## Build for production

```bash
npm run build
npm run preview     # smoke-test the production build locally
```

The static site is emitted to `dist/`.

## Deploy: Local → GitHub → Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Music Learner app"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com/new
2. **Import** your GitHub repo
3. Vercel auto-detects Vite. Defaults are correct:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Click **Deploy**.

Every push to `main` will redeploy automatically. The included `vercel.json` rewrites all routes to `index.html` so the SPA works on direct URL hits.

## ABC notation primer

```
X:1                    ← reference number (required)
T:Song Title           ← title
C:Composer
M:4/4                  ← time signature
L:1/4                  ← default note length (quarter)
Q:1/4=120              ← tempo
K:C                    ← key signature
CDEF GABc | c2 G2 |    ← notes; UPPER = octave 4, lower = octave 5; ',' lowers, "'" raises
```

Learn more: <https://abcnotation.com/learn>

## Project structure

```
src/
├─ App.tsx              ← top-level shell, tab routing
├─ types.ts             ← Song, ViewMode, GM_INSTRUMENTS
├─ data/sampleSongs.ts  ← seed data
├─ lib/
│  ├─ storage.ts        ← localStorage + JSON import/export
│  └─ midi.ts           ← MIDI helpers, piano layout
├─ hooks/
│  └─ useLocalStorageState.ts
└─ components/
   ├─ SongList.tsx
   ├─ SongEditor.tsx
   ├─ Player.tsx        ← orchestrates abcjs synth + views
   ├─ PianoView.tsx
   └─ FallingNotesView.tsx
```

## Roadmap

- Web MIDI input for Practice mode (wait-for-correct-key)
- Better A↔B loop UX (click on sheet to set markers)
- Tempo automation (gradually speed up over repeats)
- Recording / playback comparison
- Sharable song URLs (encode ABC in URL hash)

## License

MIT
