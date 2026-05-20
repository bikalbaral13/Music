import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Music theory data ─────────────────────────────────────────────────────
const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const CHROMATIC_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

const CHORD_TYPES_SCALE = ['Major', 'Minor', 'Minor', 'Major', 'Major', 'Minor', 'Diminished'] as const;
const ROMAN_SCALE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MODES_SCALE = ['Major', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Minor', 'Locrian'];

// CoF wheel inner ring ordering (IV → I → V → II → VI → III → VII°)
const CHORD_TYPES_COF = ['Major', 'Major', 'Major', 'Minor', 'Minor', 'Minor', 'Diminished'] as const;
const ROMAN_COF = ['IV', 'I', 'V', 'II', 'VI', 'III', 'VII'];
const MODES_COF = ['Lydian', 'Major', 'Mixolydian', 'Dorian', 'Minor', 'Phrygian', 'Locrian'];

const KEY_COLORS_DARK = [
  '#4a3a8a', '#3a4a8a', '#2a5a7a', '#2a6a5a', '#3a6a3a', '#5a6a2a',
  '#7a5a2a', '#8a4a2a', '#8a3a3a', '#7a2a5a', '#6a2a6a', '#5a2a7a',
];
const KEY_COLORS_LIGHT = [
  '#c0b0f0', '#b0c0f0', '#a0d0e8', '#a0e0d0', '#b0e0b0', '#d0e0a0',
  '#e0c890', '#e0b090', '#e0a0a0', '#d090b0', '#c090c0', '#b090d0',
];
const MODE_COLORS = ['#4e9af1', '#7bcf8e', '#f0c040', '#e07060', '#a070d0', '#60c0d0', '#f08040'];

type ChordType = (typeof CHORD_TYPES_SCALE)[number];
type Accidental = 'sharp' | 'flat';

function noteName(midi: number, accidental: Accidental): string {
  const idx = ((midi % 12) + 12) % 12;
  return accidental === 'sharp' ? SHARP_NAMES[idx] : FLAT_NAMES[idx];
}

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

// ──────────────────────────────────────────────────────────────────────────
export default function WheelView() {
  const cofRef = useRef<HTMLCanvasElement>(null);
  const chrRef = useRef<HTMLCanvasElement>(null);

  // Persistent state
  const [accidental, setAccidental] = useState<Accidental>('sharp');
  const [synced, setSynced] = useState(true);
  // Start at C: n_steps=11 puts I/Major wedge over C in the CoF ring.
  const SEG = Math.PI * 2 / 12;
  const [cofRot, setCofRot] = useState<number>(11 * SEG);
  const [chrRot, setChrRot] = useState<number>(11 * SEG);
  const [selectedMode, setSelectedMode] = useState<number | null>(null);
  const [size, setSize] = useState(420);

  // Track theme attribute so wheels redraw on toggle
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((n) => n + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Refs that need to stay current inside drag handlers
  const cofRotRef = useRef(cofRot);
  const chrRotRef = useRef(chrRot);
  const syncedRef = useRef(synced);
  useEffect(() => { cofRotRef.current = cofRot; }, [cofRot]);
  useEffect(() => { chrRotRef.current = chrRot; }, [chrRot]);
  useEffect(() => { syncedRef.current = synced; }, [synced]);

  // ── Derived: current root pitch class ─────────────────────────────────
  const root = useMemo(() => {
    const n_steps = ((Math.round(cofRot / SEG) % 12) + 12) % 12;
    return FIFTHS_ORDER[(n_steps + 1) % 12];
  }, [cofRot, SEG]);

  const rotDeg = useMemo(
    () => (((cofRot * 180 / Math.PI) % 360 + 360) % 360).toFixed(0),
    [cofRot],
  );

  const scaleNotes = useMemo(() => MAJOR_SCALE.map((i) => (root + i) % 12), [root]);

  // ── Drawing: Circle of Fifths ─────────────────────────────────────────
  const drawCoF = useCallback(() => {
    const canvas = cofRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const isDark = isDarkTheme();
    const borderCol = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    const keyColors = isDark ? KEY_COLORS_DARK : KEY_COLORS_LIGHT;

    const R_OUTER = 230;
    const R_NOTE = 200;
    const R_NOTE_IN = 155;
    const R_INNER = 154;
    const R_INNER_IN = 68;
    const R_CENTER = 56;
    const N = 12;
    const SEG_LOCAL = Math.PI * 2 / N;

    // Outer note ring window-fade logic
    const windowStart = (-Math.PI / 2 - SEG_LOCAL / 2 + cofRot + Math.PI * 10) % (Math.PI * 2);
    const windowEnd = (-Math.PI / 2 + 6 * SEG_LOCAL + SEG_LOCAL / 2 + cofRot + Math.PI * 10) % (Math.PI * 2);
    const isInWindow = (segIdx: number) => {
      const midA = ((-Math.PI / 2 + segIdx * SEG_LOCAL) + Math.PI * 10) % (Math.PI * 2);
      return windowStart <= windowEnd
        ? (midA >= windowStart && midA <= windowEnd)
        : (midA >= windowStart || midA <= windowEnd);
    };

    // Canvas drawing uses a "world" coord system of 480×480. Scale.
    ctx.save();
    ctx.scale(W / 480, H / 480);

    for (let i = 0; i < N; i++) {
      const a0 = -Math.PI / 2 + i * SEG_LOCAL - SEG_LOCAL / 2;
      const a1 = a0 + SEG_LOCAL;
      const midA = (a0 + a1) / 2;
      const active = isInWindow(i);
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.32;
      ctx.beginPath();
      ctx.moveTo(240, 240);
      ctx.arc(240, 240, R_NOTE, a0, a1);
      ctx.closePath();
      ctx.fillStyle = keyColors[i];
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5; ctx.stroke();

      const noteIdx = FIFTHS_ORDER[i];
      const name = noteName(noteIdx, accidental);
      const tr = R_NOTE_IN + (R_NOTE - R_NOTE_IN) * 0.5;
      ctx.translate(240 + tr * Math.cos(midA), 240 + tr * Math.sin(midA));
      ctx.fillStyle = isDark ? '#f0f0ff' : '#0a0a1a';
      ctx.font = `bold ${name.length > 2 ? 15 : 19}px 'Playfair Display', serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(240, 240, R_NOTE, 0, Math.PI * 2);
    ctx.strokeStyle = borderCol; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(240, 240, R_NOTE_IN, 0, Math.PI * 2);
    ctx.strokeStyle = borderCol; ctx.lineWidth = 1.5; ctx.stroke();

    // Inner rotating wheel
    ctx.save();
    ctx.translate(240, 240);
    ctx.rotate(cofRot);
    ctx.beginPath(); ctx.arc(0, 0, R_INNER, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(16,16,32,0.6)' : 'rgba(230,230,248,0.6)';
    ctx.fill();

    const R_CHORD_OUT = R_INNER;
    const R_CHORD_IN = R_INNER_IN + (R_INNER - R_INNER_IN) * 0.45;
    const R_MODE_OUT = R_CHORD_IN;
    const R_MODE_IN = R_INNER_IN;
    const CHORD_FILLS: Record<ChordType, string> = {
      Major: isDark ? '#1e3a5f' : '#b8d4f0',
      Minor: isDark ? '#5a1a1a' : '#f0c0b0',
      Diminished: isDark ? '#3a3000' : '#f0e0a0',
    };
    const CHORD_MODE_COLORS = ['#6090e8', '#60c890', '#e8c840', '#e86060', '#b060e8', '#60d0e0', '#e89040'];

    for (let d = 0; d < 7; d++) {
      const a0 = -Math.PI / 2 + d * SEG_LOCAL - SEG_LOCAL / 2;
      const a1 = a0 + SEG_LOCAL;
      const midA = (a0 + a1) / 2;
      const ctype = CHORD_TYPES_COF[d];

      ctx.beginPath();
      ctx.arc(0, 0, R_CHORD_OUT, a0, a1);
      ctx.arc(0, 0, R_CHORD_IN, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = CHORD_FILLS[ctype];
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5; ctx.stroke();

      const chordMidR = R_CHORD_IN + (R_CHORD_OUT - R_CHORD_IN) * 0.38;
      ctx.save();
      ctx.translate(chordMidR * Math.cos(midA), chordMidR * Math.sin(midA));
      ctx.rotate(midA + Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = isDark ? '#d0d8ff' : '#0a0a3a';
      ctx.font = `bold 12px 'Inter', sans-serif`;
      ctx.fillText(ROMAN_COF[d], 0, -8);
      ctx.font = `600 8px 'Inter', sans-serif`;
      ctx.fillStyle = isDark ? '#9090c0' : '#303070';
      ctx.fillText(ctype === 'Diminished' ? 'Dim°' : ctype, 0, 5);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(0, 0, R_MODE_OUT, a0, a1);
      ctx.arc(0, 0, R_MODE_IN, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = isDark ? `${CHORD_MODE_COLORS[d]}35` : `${CHORD_MODE_COLORS[d]}30`;
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1; ctx.stroke();

      const modeMidR = R_MODE_IN + (R_MODE_OUT - R_MODE_IN) * 0.5;
      ctx.save();
      ctx.translate(modeMidR * Math.cos(midA), modeMidR * Math.sin(midA));
      ctx.rotate(midA + Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = CHORD_MODE_COLORS[d];
      ctx.font = `600 8px 'Inter', sans-serif`;
      ctx.fillText(MODES_COF[d], 0, 0);
      ctx.restore();
    }

    // Red outline of 7-wedge arc
    const arcStart = -Math.PI / 2 - SEG_LOCAL / 2;
    const arcEnd = -Math.PI / 2 + 6 * SEG_LOCAL + SEG_LOCAL / 2;
    ctx.beginPath();
    ctx.arc(0, 0, R_INNER, arcStart, arcEnd);
    ctx.arc(0, 0, R_INNER_IN, arcEnd, arcStart, true);
    ctx.closePath();
    ctx.strokeStyle = isDark ? 'rgba(255,80,80,0.85)' : 'rgba(200,0,30,0.75)';
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();

    // Hub
    ctx.beginPath(); ctx.arc(0, 0, R_CENTER, 0, Math.PI * 2);
    const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R_CENTER);
    hubGrad.addColorStop(0, isDark ? '#2a2a4a' : '#d8d8f0');
    hubGrad.addColorStop(1, isDark ? '#18182a' : '#e8e8fa');
    ctx.fillStyle = hubGrad; ctx.fill();
    ctx.strokeStyle = borderCol; ctx.lineWidth = 2; ctx.stroke();
    // Counter-rotate hub text so it stays upright
    ctx.rotate(-cofRot);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? '#f0f0ff' : '#0a0a1a';
    ctx.font = `bold 15px 'Playfair Display', serif`;
    ctx.fillText('CoF', 0, -8);
    ctx.font = `400 9px 'Inter', sans-serif`;
    ctx.fillStyle = isDark ? '#7070a0' : '#5050a0';
    ctx.fillText('Circle of Fifths', 0, 8);

    ctx.restore();

    ctx.beginPath();
    ctx.arc(240, 240, R_OUTER, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? 'rgba(160,144,255,0.25)' : 'rgba(85,64,208,0.25)';
    ctx.lineWidth = 3; ctx.stroke();

    ctx.restore();
  }, [cofRot, accidental, themeTick]);

  // ── Drawing: Chromatic wheel ──────────────────────────────────────────
  const drawChr = useCallback(() => {
    const canvas = chrRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const isDark = isDarkTheme();
    const borderCol = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';

    const R_OUTER = 230, R_NOTE = 200, R_NOTE_IN = 150;
    const R_INNER = R_NOTE_IN - 1;
    const R_INNER_IN = 68, R_CENTER = 56;
    const R_CHORD_IN = R_INNER_IN + (R_INNER - R_INNER_IN) * 0.45;
    const N = 12, SEG_LOCAL = Math.PI * 2 / N;
    const chromaHues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

    const n_steps = ((Math.round(cofRot / SEG_LOCAL) % 12) + 12) % 12;
    const cofPosMap: Record<number, number> = {};
    for (let d = 0; d < 7; d++) {
      const note = FIFTHS_ORDER[(d + n_steps) % 12];
      cofPosMap[note] = d;
    }
    const scaleSet = new Set(Object.keys(cofPosMap).map(Number));

    const CHORD_FILLS_CHR: Record<ChordType, string> = {
      Major: isDark ? '#1e3a5f' : '#b8d4f0',
      Minor: isDark ? '#5a1a1a' : '#f0c0b0',
      Diminished: isDark ? '#3a3000' : '#f0e0a0',
    };
    const CHORD_MODE_COLORS_CHR = ['#6090e8', '#60c890', '#e8c840', '#e86060', '#b060e8', '#60d0e0', '#e89040'];

    ctx.save();
    ctx.scale(W / 480, H / 480);

    // Outer chromatic ring
    for (let i = 0; i < N; i++) {
      const a0 = -Math.PI / 2 + i * SEG_LOCAL - SEG_LOCAL / 2;
      const a1 = a0 + SEG_LOCAL;
      const midA = (a0 + a1) / 2;
      const noteIdx = CHROMATIC_ORDER[i];
      const inScale = scaleSet.has(noteIdx);
      const hue = chromaHues[i];

      ctx.save();
      ctx.globalAlpha = inScale ? 1.0 : 0.32;
      ctx.beginPath(); ctx.moveTo(240, 240);
      ctx.arc(240, 240, R_NOTE, a0, a1); ctx.closePath();
      ctx.fillStyle = isDark ? `hsla(${hue},55%,25%,1)` : `hsla(${hue},65%,80%,1)`;
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5; ctx.stroke();

      const name = noteName(noteIdx, accidental);
      const tr = R_NOTE_IN + (R_NOTE - R_NOTE_IN) * 0.5;
      ctx.translate(240 + tr * Math.cos(midA), 240 + tr * Math.sin(midA));
      ctx.fillStyle = isDark ? '#f0f0ff' : '#0a0a1a';
      ctx.font = `bold ${name.length > 2 ? 14 : 17}px 'Playfair Display', serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }

    ctx.beginPath(); ctx.arc(240, 240, R_NOTE, 0, Math.PI * 2);
    ctx.strokeStyle = borderCol; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(240, 240, R_NOTE_IN, 0, Math.PI * 2);
    ctx.strokeStyle = borderCol; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.save();
    ctx.translate(240, 240);
    ctx.beginPath(); ctx.arc(0, 0, R_INNER, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(16,16,32,0.55)' : 'rgba(230,230,248,0.55)';
    ctx.fill();

    for (let i = 0; i < N; i++) {
      const a0 = -Math.PI / 2 + i * SEG_LOCAL - SEG_LOCAL / 2;
      const a1 = a0 + SEG_LOCAL;
      const midA = (a0 + a1) / 2;
      const noteIdx = CHROMATIC_ORDER[i];
      const inScale = scaleSet.has(noteIdx);

      if (inScale) {
        const cofIdx = cofPosMap[noteIdx];
        const ctype = CHORD_TYPES_COF[cofIdx];
        const modeColor = CHORD_MODE_COLORS_CHR[cofIdx];

        ctx.beginPath();
        ctx.arc(0, 0, R_INNER, a0, a1);
        ctx.arc(0, 0, R_CHORD_IN, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = CHORD_FILLS_CHR[ctype]; ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.2; ctx.stroke();

        const chordMidR = R_CHORD_IN + (R_INNER - R_CHORD_IN) * 0.38;
        ctx.save();
        ctx.translate(chordMidR * Math.cos(midA), chordMidR * Math.sin(midA));
        ctx.rotate(midA + Math.PI / 2);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = isDark ? '#d0d8ff' : '#0a0a3a';
        ctx.font = `bold 11px 'Inter', sans-serif`;
        ctx.fillText(ROMAN_COF[cofIdx], 0, -7);
        ctx.font = `600 7.5px 'Inter', sans-serif`;
        ctx.fillStyle = isDark ? '#9090c0' : '#303070';
        ctx.fillText(ctype === 'Diminished' ? 'Dim°' : ctype, 0, 4);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, 0, R_CHORD_IN, a0, a1);
        ctx.arc(0, 0, R_INNER_IN, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = isDark ? `${modeColor}38` : `${modeColor}30`;
        ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1; ctx.stroke();

        const modeMidR = R_INNER_IN + (R_CHORD_IN - R_INNER_IN) * 0.5;
        ctx.save();
        ctx.translate(modeMidR * Math.cos(midA), modeMidR * Math.sin(midA));
        ctx.rotate(midA + Math.PI / 2);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = modeColor;
        ctx.font = `600 7.5px 'Inter', sans-serif`;
        ctx.fillText(MODES_COF[cofIdx], 0, 0);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, 0, R_INNER, a0, a1);
        ctx.arc(0, 0, R_INNER_IN, a1, a0, true);
        ctx.closePath();
        ctx.strokeStyle = isDark ? 'rgba(255,80,80,0.75)' : 'rgba(200,0,30,0.65)';
        ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, R_INNER, a0, a1);
        ctx.arc(0, 0, R_INNER_IN, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = isDark ? 'rgba(30,30,50,0.4)' : 'rgba(210,210,230,0.35)';
        ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1; ctx.stroke();
      }
    }

    ctx.beginPath(); ctx.arc(0, 0, R_CENTER, 0, Math.PI * 2);
    const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R_CENTER);
    hubGrad.addColorStop(0, isDark ? '#2a2a4a' : '#d8d8f0');
    hubGrad.addColorStop(1, isDark ? '#18182a' : '#e8e8fa');
    ctx.fillStyle = hubGrad; ctx.fill();
    ctx.strokeStyle = borderCol; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? '#f0f0ff' : '#0a0a1a';
    ctx.font = `bold 14px 'Playfair Display', serif`;
    ctx.fillText('CHR', 0, -8);
    ctx.font = `400 8px 'Inter', sans-serif`;
    ctx.fillStyle = isDark ? '#7070a0' : '#5050a0';
    ctx.fillText('Chromatic', 0, 8);

    ctx.restore();

    ctx.beginPath(); ctx.arc(240, 240, R_OUTER, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? 'rgba(160,144,255,0.25)' : 'rgba(85,64,208,0.25)';
    ctx.lineWidth = 3; ctx.stroke();

    ctx.restore();
  }, [cofRot, chrRot, accidental, themeTick]);

  useEffect(() => { drawCoF(); drawChr(); }, [drawCoF, drawChr]);

  // ── Drag rotation ─────────────────────────────────────────────────────
  const dragRef = useRef<null | { which: 'cof' | 'chr'; lastAngle: number; startRot: number; totalDelta: number }>(null);

  const getAngle = (canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const ev = ('touches' in e && e.touches[0]) ? e.touches[0] : (e as MouseEvent);
    const x = (ev.clientX - rect.left) - cx;
    const y = (ev.clientY - rect.top) - cy;
    return Math.atan2(y, x);
  };

  const isInsideInner = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const ev = ('touches' in e && e.touches[0]) ? e.touches[0] : (e as unknown as MouseEvent);
    const x = (ev.clientX - rect.left) - cx;
    const y = (ev.clientY - rect.top) - cy;
    // R_INNER (=154) in world coords maps to (154/480) of rendered size.
    return Math.sqrt(x * x + y * y) < rect.width * (154 / 480);
  };

  const snapToNearest = (cof: number, chr: number): [number, number] => {
    return [Math.round(cof / SEG) * SEG, Math.round(chr / SEG) * SEG];
  };

  const startDrag = (which: 'cof' | 'chr', e: React.MouseEvent | React.TouchEvent) => {
    const canvas = which === 'cof' ? cofRef.current : chrRef.current;
    if (!canvas) return;
    if (!isInsideInner(canvas, e)) return;
    e.preventDefault();
    const angle = getAngle(canvas, e);
    dragRef.current = {
      which,
      lastAngle: angle,
      startRot: which === 'cof' ? cofRotRef.current : chrRotRef.current,
      totalDelta: 0,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const canvas = d.which === 'cof' ? cofRef.current : chrRef.current;
      if (!canvas) return;
      const angle = getAngle(canvas, e);
      let step = angle - d.lastAngle;
      if (step > Math.PI) step -= Math.PI * 2;
      if (step < -Math.PI) step += Math.PI * 2;
      d.totalDelta += step;
      d.lastAngle = angle;
      const newRot = d.startRot + d.totalDelta;
      if (d.which === 'cof') {
        setCofRot(newRot);
        if (syncedRef.current) setChrRot(newRot);
      } else {
        setChrRot(newRot);
        if (syncedRef.current) setCofRot(newRot);
      }
    };
    const onUp = () => {
      if (!dragRef.current) return;
      const [c1, c2] = snapToNearest(cofRotRef.current, chrRotRef.current);
      // Reset mode highlight if the key actually changed
      if (Math.round(c1 / SEG) !== Math.round(cofRotRef.current / SEG)) setSelectedMode(null);
      setCofRot(c1); setChrRot(c2);
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [SEG]);

  // ── Resize ────────────────────────────────────────────────────────────
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const compute = () => {
      const w = wrapRef.current?.clientWidth ?? 800;
      const h = window.innerHeight - 220;
      const isMobile = window.innerWidth <= 700;
      let s: number;
      if (isMobile) s = Math.min((window.innerWidth - 20) / 2, h, 320);
      else s = Math.min((w - 100) / 2, h, 480);
      s = Math.max(240, s);
      setSize(s);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const reset = () => {
    setCofRot(11 * SEG); setChrRot(11 * SEG); setSelectedMode(null);
  };
  const toggleSync = () => {
    setSynced((s) => {
      const next = !s;
      if (next) setChrRot(cofRotRef.current);
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="wheel-view">
      <div className="wheel-toolbar">
        <div className="wheel-toolbar-group">
          <button
            type="button"
            className={`btn ${accidental === 'sharp' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem' }}
            onClick={() => setAccidental('sharp')}
          >Sharp ♯</button>
          <button
            type="button"
            className={`btn ${accidental === 'flat' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem' }}
            onClick={() => setAccidental('flat')}
          >Flat ♭</button>
        </div>
        <div className="wheel-toolbar-group">
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={synced} onChange={toggleSync} />
            Sync wheels
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem' }}
            onClick={reset}
          >↺ Reset to C</button>
        </div>
        <div className="wheel-rot-display tabular">
          Root: <strong style={{ color: 'var(--accent)' }}>{noteName(root, accidental)}</strong> · {rotDeg}°
        </div>
      </div>

      <div className="wheel-layout" ref={wrapRef}>
        <div className="wheel-canvases">
          <div className="wheel-canvas-card">
            <div className="wheel-canvas-title">Circle of Fifths</div>
            <canvas
              ref={cofRef}
              width={480} height={480}
              style={{ width: size, height: size, touchAction: 'none', cursor: 'grab' }}
              onMouseDown={(e) => startDrag('cof', e)}
              onTouchStart={(e) => startDrag('cof', e)}
            />
          </div>
          <div className="wheel-canvas-card">
            <div className="wheel-canvas-title">Chromatic Wheel</div>
            <canvas
              ref={chrRef}
              width={480} height={480}
              style={{ width: size, height: size, touchAction: 'none', cursor: 'grab' }}
              onMouseDown={(e) => startDrag('chr', e)}
              onTouchStart={(e) => startDrag('chr', e)}
            />
          </div>
        </div>

        <aside className="wheel-side">
          <section className="section">
            <header className="section-header"><span className="section-title">Scale Notes</span></header>
            <div className="section-body">
              <div className="flex flex-wrap gap-1.5">
                {scaleNotes.map((n, i) => (
                  <span key={i} className={`chip ${i === 0 ? 'chip-accent' : ''}`}>
                    {noteName(n, accidental)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="section">
            <header className="section-header"><span className="section-title">Diatonic Chords</span></header>
            <div className="section-body flex flex-col gap-1.5">
              {scaleNotes.map((n, i) => {
                const type = CHORD_TYPES_SCALE[i];
                const suffix = type === 'Major' ? '' : type === 'Minor' ? 'm' : '°';
                return (
                  <div key={i} className="wheel-chord-row">
                    <span className="wheel-chord-degree">{ROMAN_SCALE[i]}</span>
                    <span className="wheel-chord-name">{noteName(n, accidental)}{suffix}</span>
                    <span className={`wheel-chord-badge wheel-chord-${type.toLowerCase()}`}>{type}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section">
            <header className="section-header"><span className="section-title">Modes</span></header>
            <div className="section-body flex flex-col gap-1.5">
              {MODES_SCALE.map((mode, i) => {
                const color = MODE_COLORS[i];
                const faded = selectedMode !== null && selectedMode !== i;
                const highlighted = selectedMode === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedMode((s) => (s === i ? null : i))}
                    className={`wheel-mode-row ${highlighted ? 'highlighted' : ''} ${faded ? 'faded' : ''}`}
                    style={{ color }}
                  >
                    <span className="font-semibold">{mode}</span>
                    <span className="text-xs tabular" style={{ color: 'var(--text-muted)' }}>
                      {noteName(scaleNotes[i], accidental)} {mode}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
