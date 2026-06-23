// Editorial figure + carousel renderer — dark "espresso" template with a
// high-contrast serif (Playfair Display), gold accent and monospace labels.
// Builds SVGs from structured specs and rasterises them to PNG. Fonts are
// embedded as data-URI @font-face at raster time so the PNG is faithful.

// ---- Pragma design-system tokens ----
const BG = '#0F0E0B', CREAM = '#F2EEE4', GOLD = '#C2861E', GOLDLT = '#DDB778';
const MUTE = '#A89E8B', FAINT = '#74695A', RULE = '#2B261C';
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const MONO = "'JetBrains Mono', 'Courier New', monospace";

// semantic data colours (so values differ by meaning, on a dark ground)
const KIND: Record<string, { c: string; label: string }> = {
  base: { c: '#8A8273', label: 'Baseline' },
  gain: { c: '#8FB08A', label: 'Improvement' },
  result: { c: GOLD, label: 'Result' },
  loss: { c: '#C2453E', label: 'Decline' },
  neutral: { c: '#5A5345', label: 'Other' },
};
function kindColor(k?: string): string { return (k && KIND[k]) ? KIND[k].c : '#8A8273'; }

export interface ChartBar { label: string; value: number; kind?: string; highlight?: boolean }
export interface ChartSpec {
  type: 'bars' | 'comparison' | 'stat' | 'matrix';
  title?: string; takeaway?: string; kicker?: string; unit?: string; illustrative?: boolean;
  bars?: ChartBar[];
  left?: { label: string; value: number; kind?: string };
  right?: { label: string; value: number; kind?: string };
  stat?: { value: string; label: string };
  axisX?: { low: string; high: string }; axisY?: { low: string; high: string };
  points?: { label: string; x: number; y: number; highlight?: boolean }[];
}
export interface Slide {
  kind: 'cover' | 'point' | 'stat' | 'bars' | 'cta' | 'steps';
  kicker?: string; title?: string; accent?: string; subtitle?: string;
  bullets?: string[]; value?: string; label?: string; context?: string;
  unit?: string; bars?: ChartBar[]; question?: string; footer?: string;
  steps?: { n?: string; label: string; note?: string }[];
}

const W = 1200, H = 675;       // landscape figure (16:9)
const PW = 1080, PH = 1350;    // portrait carousel slide (4:5)

function esc(s: any): string {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(v: number, unit?: string): string {
  const u = unit || ''; let n: string;
  if (Math.abs(v) >= 1000) n = Math.round(v).toLocaleString('en-US');
  else if (Number.isInteger(v)) n = String(v);
  else n = String(Math.round(v * 10) / 10);
  return u === '$' ? '$' + n : u === '%' ? n + '%' : u === 'x' ? n + '×' : n + (u ? ' ' + u : '');
}
function wrap(s: string, maxChars: number, maxLines: number): string[] {
  const words = String(s || '').split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}
// text element
function T(x: number, y: number, content: string, o: any = {}): string {
  const f = o.mono ? MONO : SERIF;
  const a = [
    `x="${x}"`, `y="${y}"`, `font-family="${f}"`, `font-size="${o.size || 24}"`, `fill="${o.fill || CREAM}"`,
    o.weight ? `font-weight="${o.weight}"` : '', o.italic ? 'font-style="italic"' : '',
    o.anchor ? `text-anchor="${o.anchor}"` : '', o.spacing ? `letter-spacing="${o.spacing}"` : '',
  ].filter(Boolean).join(' ');
  return `<text ${a}>${esc(content)}</text>`;
}
function rule(x1: number, y: number, x2: number): string { return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${RULE}" stroke-width="1.5"/>`; }
function legend(kinds: string[], x: number, y: number): string {
  const uniq = Array.from(new Set(kinds.filter((k) => k && KIND[k])));
  if (uniq.length < 2) return '';
  let cx = x, svg = '';
  uniq.forEach((k) => {
    const m = KIND[k];
    svg += `<rect x="${cx}" y="${y - 13}" width="16" height="16" rx="2" fill="${m.c}"/>`;
    svg += T(cx + 24, y, m.label, { mono: true, size: 17, fill: MUTE });
    cx += 40 + m.label.length * 10 + 26;
  });
  return svg;
}

// ===================== landscape single figure (16:9) =====================
function header(spec: ChartSpec): { svg: string; bottom: number } {
  const MXl = 72; let y = 96, svg = '';
  svg += T(MXl, 78, (spec.kicker || 'FIGURE').toUpperCase(), { mono: true, size: 19, fill: GOLD, spacing: 4 });
  y = 150;
  wrap(spec.title || '', 44, 2).forEach((l) => { svg += T(MXl, y, l, { size: 42, weight: 700, fill: CREAM }); y += 50; });
  if (spec.takeaway) { y += 4; wrap(spec.takeaway, 80, 2).forEach((l) => { svg += T(MXl, y, l, { mono: true, size: 20, fill: MUTE }); y += 28; }); }
  svg += rule(MXl, y + 6, W - MXl);
  return { svg, bottom: y + 30 };
}
function renderBars(spec: ChartSpec): string {
  const MXl = 72; const bars = (spec.bars || []).slice(0, 6);
  const hasLegend = new Set(bars.map((b) => b.kind).filter((k) => k && KIND[k as string])).size >= 2;
  const { svg: head, bottom } = header(spec);
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const top = bottom + 6, footH = hasLegend ? 118 : 92, areaH = H - top - footH;
  const rowH = Math.min(74, areaH / Math.max(1, bars.length));
  const labelW = 300, barX = MXl + labelW, barMaxW = W - barX - 150;
  let svg = head;
  bars.forEach((b, i) => {
    const cy = top + i * rowH + rowH / 2;
    const w = Math.max(3, (Math.abs(b.value) / max) * barMaxW);
    const col = b.kind ? kindColor(b.kind) : (b.highlight ? GOLD : '#8A8273');
    svg += T(MXl + labelW - 16, cy + 6, b.label, { mono: true, size: 20, fill: CREAM, anchor: 'end' });
    svg += `<rect x="${barX}" y="${cy - rowH * 0.28}" width="${w}" height="${rowH * 0.56}" fill="${col}" rx="2"/>`;
    svg += T(barX + w + 14, cy + 8, fmt(b.value, spec.unit), { size: 26, weight: 700, fill: CREAM });
  });
  if (hasLegend) svg += legend(bars.map((b) => b.kind || ''), MXl, H - 64);
  return svg;
}
function renderComparison(spec: ChartSpec): string {
  const MXl = 72; const { svg: head, bottom } = header(spec);
  const l = spec.left || { label: '', value: 0 }, r = spec.right || { label: '', value: 0 };
  const cy = bottom + (H - bottom - 80) / 2; const colW = (W - MXl * 2) / 2;
  let svg = head;
  const cell = (cx: number, d: any, fallback: string) => {
    const col = d.kind ? kindColor(d.kind) : fallback;
    let s = T(cx, cy - 30, fmt(d.value, spec.unit), { size: 100, weight: 700, fill: col, anchor: 'middle' });
    wrap(d.label, 28, 2).forEach((ln, i) => { s += T(cx, cy + 30 + i * 28, ln, { mono: true, size: 21, fill: MUTE, anchor: 'middle' }); });
    return s;
  };
  svg += cell(MXl + colW / 2, l, CREAM);
  svg += `<line x1="${W / 2}" y1="${bottom + 16}" x2="${W / 2}" y2="${H - 96}" stroke="${RULE}" stroke-width="1.5"/>`;
  svg += T(W / 2, cy - 76, 'vs', { mono: true, size: 18, fill: FAINT, anchor: 'middle' });
  svg += cell(MXl + colW + colW / 2, r, GOLD);
  return svg;
}
function renderStat(spec: ChartSpec): string {
  const { svg: head, bottom } = header(spec); const s = spec.stat || { value: '', label: '' };
  const cy = bottom + (H - bottom - 80) / 2; let svg = head;
  svg += T(W / 2, cy + 14, s.value, { size: 180, weight: 700, fill: GOLD, anchor: 'middle' });
  wrap(s.label, 50, 2).forEach((ln, i) => { svg += T(W / 2, cy + 78 + i * 32, ln, { mono: true, size: 23, fill: CREAM, anchor: 'middle' }); });
  return svg;
}
function renderMatrix(spec: ChartSpec): string {
  const { svg: head, bottom } = header(spec);
  const gx = 230, gy = bottom + 14, gw = W - gx - 80, gh = H - gy - 78; let svg = head;
  svg += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="none" stroke="${RULE}" stroke-width="1.5"/>`;
  svg += `<line x1="${gx + gw / 2}" y1="${gy}" x2="${gx + gw / 2}" y2="${gy + gh}" stroke="${RULE}" stroke-width="1"/>`;
  svg += `<line x1="${gx}" y1="${gy + gh / 2}" x2="${gx + gw}" y2="${gy + gh / 2}" stroke="${RULE}" stroke-width="1"/>`;
  const ax = spec.axisX || { low: '', high: '' }, ay = spec.axisY || { low: '', high: '' };
  svg += T(gx, gy + gh + 32, ax.low, { mono: true, size: 17, fill: MUTE });
  svg += T(gx + gw, gy + gh + 32, ax.high, { mono: true, size: 17, fill: MUTE, anchor: 'end' });
  svg += `<text transform="translate(${gx - 16},${gy + gh}) rotate(-90)" font-family="${MONO}" font-size="17" fill="${MUTE}">${esc(ay.low)}</text>`;
  svg += `<text transform="translate(${gx - 16},${gy}) rotate(-90)" text-anchor="end" font-family="${MONO}" font-size="17" fill="${MUTE}">${esc(ay.high)}</text>`;
  (spec.points || []).slice(0, 6).forEach((p) => {
    const px = gx + Math.max(0, Math.min(1, p.x)) * gw, py = gy + gh - Math.max(0, Math.min(1, p.y)) * gh;
    svg += `<circle cx="${px}" cy="${py}" r="9" fill="${p.highlight ? GOLD : CREAM}"/>`;
    svg += T(px + 14, py + 6, p.label, { mono: true, size: 17, fill: CREAM });
  });
  return svg;
}
export function buildChartSVG(spec: ChartSpec): string {
  let body = '';
  if (spec.type === 'comparison') body = renderComparison(spec);
  else if (spec.type === 'stat') body = renderStat(spec);
  else if (spec.type === 'matrix') body = renderMatrix(spec);
  else body = renderBars(spec);
  const foot = spec.illustrative ? T(72, H - 34, 'Illustrative — figures for illustration', { mono: true, size: 15, fill: FAINT }) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${BG}"/>` + body + foot + `</svg>`;
}

// ===================== portrait carousel slides (4:5) =====================
const MX = 96;
function counter(idx: number, total: number): string { return T(PW - MX, PH - 70, (idx + 1) + ' / ' + total, { mono: true, size: 22, fill: FAINT, anchor: 'end' }); }
function coverSlide(s: Slide): string {
  let svg = '', y = 330;
  if (s.kicker) svg += T(MX, 150, s.kicker.toUpperCase(), { mono: true, size: 26, fill: GOLD, spacing: 4 });
  wrap(s.title || '', 20, 3).forEach((l) => { svg += T(MX, y, l, { size: 84, weight: 700, fill: CREAM }); y += 96; });
  if (s.accent) { y += 6; wrap(s.accent, 24, 2).forEach((l) => { svg += T(MX, y, l, { size: 64, italic: true, fill: GOLD }); y += 76; }); }
  if (s.subtitle) { y += 18; wrap(s.subtitle, 46, 3).forEach((l) => { svg += T(MX, y, l, { mono: true, size: 28, fill: MUTE }); y += 40; }); }
  svg += T(MX, PH - 130, 'SWIPE →', { mono: true, size: 26, fill: GOLD, spacing: 3 });
  return svg;
}
function pointSlide(s: Slide): string {
  let svg = '', y = 230;
  if (s.kicker) { svg += T(MX, 160, s.kicker.toUpperCase(), { mono: true, size: 24, fill: GOLD, spacing: 4 }); }
  wrap(s.title || '', 24, 3).forEach((l) => { svg += T(MX, y, l, { size: 62, weight: 700, fill: CREAM }); y += 76; });
  y += 46; svg += rule(MX, y - 24, PW - MX);
  (s.bullets || []).slice(0, 4).forEach((b) => {
    svg += `<rect x="${MX}" y="${y - 26}" width="18" height="18" rx="3" fill="${GOLD}"/>`;
    const lines = wrap(b, 36, 3);
    lines.forEach((l, i) => { svg += T(MX + 40, y + i * 44, l, { mono: true, size: 36, fill: CREAM }); });
    y += 44 * lines.length + 36;
  });
  return svg;
}
function statSlide(s: Slide): string {
  let svg = '', cy = PH / 2 - 30;
  if (s.kicker) svg += T(MX, 170, s.kicker.toUpperCase(), { mono: true, size: 24, fill: GOLD, spacing: 4 });
  svg += T(PW / 2, cy, s.value || '', { size: 300, weight: 700, fill: GOLD, anchor: 'middle' });
  let y = cy + 96;
  wrap(s.label || '', 30, 2).forEach((l) => { svg += T(PW / 2, y, l, { mono: true, size: 40, fill: CREAM, anchor: 'middle' }); y += 52; });
  if (s.context) { y += 10; wrap(s.context, 46, 2).forEach((l) => { svg += T(PW / 2, y, l, { mono: true, size: 28, fill: MUTE, anchor: 'middle' }); y += 38; }); }
  return svg;
}
function barsSlide(s: Slide): string {
  const bars = (s.bars || []).slice(0, 5); let svg = '', y = 210;
  if (s.kicker) { svg += T(MX, 160, s.kicker.toUpperCase(), { mono: true, size: 24, fill: GOLD, spacing: 4 }); y = 240; }
  wrap(s.title || '', 28, 2).forEach((l) => { svg += T(MX, y, l, { size: 56, weight: 700, fill: CREAM }); y += 66; });
  const top = y + 46, max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const rowH = Math.min(150, (PH - top - 200) / Math.max(1, bars.length)); const barMaxW = PW - MX * 2 - 140;
  bars.forEach((b, i) => {
    const by = top + i * rowH; const w = Math.max(4, (Math.abs(b.value) / max) * barMaxW);
    svg += T(MX, by, b.label, { mono: true, size: 32, fill: CREAM });
    svg += `<rect x="${MX}" y="${by + 16}" width="${w}" height="42" rx="3" fill="${kindColor(b.kind)}"/>`;
    svg += T(MX + w + 18, by + 50, fmt(b.value, s.unit), { size: 40, weight: 700, fill: CREAM });
  });
  svg += legend(bars.map((b) => b.kind || ''), MX, PH - 140);
  return svg;
}
function stepsSlide(s: Slide): string {
  const steps = (s.steps || []).slice(0, 5); let svg = '', y = 200;
  if (s.kicker) { svg += T(MX, 170, s.kicker.toUpperCase(), { mono: true, size: 24, fill: GOLD, spacing: 4 }); y = 300; }
  wrap(s.title || '', 24, 2).forEach((l) => { svg += T(MX, y, l, { size: 58, weight: 700, fill: CREAM }); y += 70; });
  const cy = PH / 2 + 90, x0 = MX + 36, x1 = PW - MX - 36;
  svg += `<line x1="${x0}" y1="${cy}" x2="${x1}" y2="${cy}" stroke="${RULE}" stroke-width="2"/>`;
  steps.forEach((st, i) => {
    const x = steps.length === 1 ? (x0 + x1) / 2 : x0 + i * (x1 - x0) / (steps.length - 1);
    svg += T(x, cy - 44, st.n || String(i + 1).padStart(2, '0'), { size: 46, weight: 700, fill: GOLD, anchor: 'middle' });
    svg += `<circle cx="${x}" cy="${cy}" r="9" fill="${GOLD}"/>`;
    wrap(st.label, 12, 2).forEach((l, k) => { svg += T(x, cy + 50 + k * 30, l, { mono: true, size: 26, fill: CREAM, anchor: 'middle' }); });
    if (st.note) svg += T(x, cy + 110, st.note, { mono: true, size: 20, fill: MUTE, anchor: 'middle' });
  });
  return svg;
}
function ctaSlide(s: Slide): string {
  let svg = '', y = 300;
  if (s.kicker) svg += T(MX, 170, s.kicker.toUpperCase(), { mono: true, size: 24, fill: GOLD, spacing: 4 });
  wrap(s.title || '', 22, 3).forEach((l) => { svg += T(MX, y, l, { size: 64, weight: 700, fill: CREAM }); y += 78; });
  if (s.question) { y += 44; wrap(s.question, 28, 3).forEach((l) => { svg += T(MX, y, l, { size: 46, italic: true, fill: GOLD }); y += 58; }); }
  if (s.footer) wrap(s.footer, 46, 2).forEach((l, i) => { svg += T(MX, PH - 170 + i * 38, l, { mono: true, size: 28, fill: MUTE }); });
  return svg;
}
export function buildSlideSVG(slide: Slide, idx: number, total: number): string {
  let body = '';
  if (slide.kind === 'cover') body = coverSlide(slide);
  else if (slide.kind === 'stat') body = statSlide(slide);
  else if (slide.kind === 'bars') body = barsSlide(slide);
  else if (slide.kind === 'cta') body = ctaSlide(slide);
  else if (slide.kind === 'steps') body = stepsSlide(slide);
  else body = pointSlide(slide);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}">`
    + `<rect width="${PW}" height="${PH}" fill="${BG}"/>`
    + `<rect x="${MX}" y="${PH - 92}" width="46" height="5" fill="${GOLD}"/>`
    + body + counter(idx, total) + `</svg>`;
}

// ---- embed Google fonts as data-URI @font-face so the PNG is faithful ----
let _fontCss: string | null = null;
function abToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  return btoa(bin);
}
async function embeddedFontCss(): Promise<string> {
  if (_fontCss !== null) return _fontCss;
  try {
    const url = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700&family=JetBrains+Mono:wght@400;500;700&display=swap';
    const css = await (await fetch(url)).text();
    const urls = Array.from(new Set((css.match(/url\((https:[^)]+\.woff2)\)/g) || []).map((m) => m.slice(4, -1))));
    let out = css;
    for (const u of urls) {
      const buf = await (await fetch(u)).arrayBuffer();
      out = out.split(u).join('data:font/woff2;base64,' + abToB64(buf));
    }
    _fontCss = out;
  } catch { _fontCss = ''; }
  return _fontCss;
}

// ---- rasterise any SVG (reads its own width/height) to base64 PNG at 2× ----
export async function svgToPng(svg: string): Promise<string> {
  const css = await embeddedFontCss();
  if (css) svg = svg.replace(/(<svg[^>]*>)/, `$1<defs><style>${css}</style></defs>`);
  const wM = svg.match(/width="(\d+)"/), hM = svg.match(/height="(\d+)"/);
  const w = wM ? parseInt(wM[1], 10) : W, h = hM ? parseInt(hM[1], 10) : H;
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w * 2; canvas.height = h * 2;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(2, 2); ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Render failed')); };
    img.src = url;
  });
}
