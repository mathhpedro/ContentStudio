// Editorial figure + carousel renderer. Turns structured specs (produced by the
// model from the post) into clean, legible SVGs, then rasterises them to PNG.
// This is how we get technical, data-bearing visuals with real typography
// instead of an image model's garbled fake charts.

// ---- semantic data colours (so bars aren't all the same) ----
const KIND: Record<string, { c: string; label: string }> = {
  base: { c: '#9A9A92', label: 'Baseline' },
  gain: { c: '#2E8B74', label: 'Improvement' },
  result: { c: '#2F6FB0', label: 'Result' },
  loss: { c: '#C2453E', label: 'Decline' },
  neutral: { c: '#C9C4B8', label: 'Other' },
};
function kindColor(k?: string): string { return (k && KIND[k]) ? KIND[k].c : '#9A9A92'; }

export interface ChartBar { label: string; value: number; kind?: string; highlight?: boolean }
export interface ChartSpec {
  type: 'bars' | 'comparison' | 'stat' | 'matrix';
  title?: string;
  takeaway?: string;
  unit?: string;
  illustrative?: boolean;
  bars?: ChartBar[];
  left?: { label: string; value: number; kind?: string };
  right?: { label: string; value: number; kind?: string };
  stat?: { value: string; label: string };
  axisX?: { low: string; high: string };
  axisY?: { low: string; high: string };
  points?: { label: string; x: number; y: number; highlight?: boolean }[];
}

export interface Slide {
  kind: 'cover' | 'point' | 'stat' | 'bars' | 'cta';
  kicker?: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  value?: string;
  label?: string;
  context?: string;
  unit?: string;
  bars?: ChartBar[];
  question?: string;
  footer?: string;
}

const W = 1200, H = 675;          // landscape single figure
const PW = 1080, PH = 1350;       // portrait carousel slide (4:5)
const PAPER = '#F4F1EA', INK = '#16181D', MUTE = '#6B6B66', ACCENT = '#C2453E', SLATE = '#9A9A92', RULE = '#DAD5C8';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Arial, sans-serif";

function esc(s: any): string {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(v: number, unit?: string): string {
  const u = unit || '';
  let n: string;
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
function legend(kinds: string[], x: number, y: number): string {
  const uniq = Array.from(new Set(kinds.filter((k) => k && KIND[k])));
  if (uniq.length < 2) return '';
  let cx = x, svg = '';
  uniq.forEach((k) => {
    const m = KIND[k];
    svg += `<rect x="${cx}" y="${y - 12}" width="16" height="16" rx="2" fill="${m.c}"/>`;
    svg += `<text x="${cx + 24}" y="${y + 2}" font-family="${SANS}" font-size="17" fill="${MUTE}">${esc(m.label)}</text>`;
    cx += 34 + m.label.length * 10 + 26;
  });
  return svg;
}

// ===================== landscape single figure (16:9) =====================
function header(spec: ChartSpec): { svg: string; bottom: number } {
  const titleLines = wrap(spec.title || '', 46, 2);
  let y = 92;
  let svg = `<rect x="64" y="56" width="56" height="6" fill="${ACCENT}"/>`;
  titleLines.forEach((l) => { svg += `<text x="64" y="${y}" font-family="${SERIF}" font-size="40" font-weight="700" fill="${INK}">${esc(l)}</text>`; y += 48; });
  if (spec.takeaway) {
    const tl = wrap(spec.takeaway, 78, 2); y += 2;
    tl.forEach((l) => { svg += `<text x="64" y="${y}" font-family="${SANS}" font-size="21" fill="${MUTE}">${esc(l)}</text>`; y += 28; });
  }
  return { svg, bottom: y + 14 };
}
function renderBars(spec: ChartSpec): string {
  const bars = (spec.bars || []).slice(0, 6);
  const hasLegend = new Set(bars.map((b) => b.kind).filter((k) => k && KIND[k as string])).size >= 2;
  const { svg: head, bottom } = header(spec);
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const top = bottom + 6, footH = hasLegend ? 120 : 96, areaH = H - top - footH;
  const rowH = Math.min(76, areaH / Math.max(1, bars.length));
  const labelW = 300, barX = 64 + labelW, barMaxW = W - barX - 150;
  let svg = head;
  bars.forEach((b, i) => {
    const cy = top + i * rowH + rowH / 2;
    const w = Math.max(3, (Math.abs(b.value) / max) * barMaxW);
    const col = b.kind ? kindColor(b.kind) : (b.highlight ? ACCENT : SLATE);
    svg += `<text x="${64 + labelW - 16}" y="${cy + 6}" text-anchor="end" font-family="${SANS}" font-size="20" fill="${INK}">${esc(b.label)}</text>`;
    svg += `<rect x="${barX}" y="${cy - rowH * 0.28}" width="${w}" height="${rowH * 0.56}" fill="${col}" rx="2"/>`;
    svg += `<text x="${barX + w + 12}" y="${cy + 7}" font-family="${SERIF}" font-size="24" font-weight="700" fill="${INK}">${esc(fmt(b.value, spec.unit))}</text>`;
  });
  if (hasLegend) svg += legend(bars.map((b) => b.kind || ''), 64, H - 70);
  return svg;
}
function renderComparison(spec: ChartSpec): string {
  const { svg: head, bottom } = header(spec);
  const l = spec.left || { label: '', value: 0 }, r = spec.right || { label: '', value: 0 };
  const cy = bottom + (H - bottom - 90) / 2;
  const colW = (W - 128) / 2;
  let svg = head;
  const cell = (cx: number, d: { label: string; value: number; kind?: string }, fallback: string) => {
    const col = d.kind ? kindColor(d.kind) : fallback;
    let s = `<text x="${cx}" y="${cy - 36}" text-anchor="middle" font-family="${SERIF}" font-size="96" font-weight="700" fill="${col}">${esc(fmt(d.value, spec.unit))}</text>`;
    wrap(d.label, 30, 2).forEach((ln, i) => { s += `<text x="${cx}" y="${cy + 24 + i * 28}" text-anchor="middle" font-family="${SANS}" font-size="22" fill="${MUTE}">${esc(ln)}</text>`; });
    return s;
  };
  svg += cell(64 + colW / 2, l, INK);
  svg += `<line x1="${W / 2}" y1="${bottom + 20}" x2="${W / 2}" y2="${H - 110}" stroke="${RULE}" stroke-width="2"/>`;
  svg += `<text x="${W / 2}" y="${cy - 70}" text-anchor="middle" font-family="${SANS}" font-size="18" fill="${SLATE}">vs</text>`;
  svg += cell(64 + colW + colW / 2, r, ACCENT);
  return svg;
}
function renderStat(spec: ChartSpec): string {
  const { svg: head, bottom } = header(spec);
  const s = spec.stat || { value: '', label: '' };
  const cy = bottom + (H - bottom - 90) / 2;
  let svg = head;
  svg += `<text x="${W / 2}" y="${cy + 10}" text-anchor="middle" font-family="${SERIF}" font-size="170" font-weight="700" fill="${ACCENT}">${esc(s.value)}</text>`;
  wrap(s.label, 52, 2).forEach((ln, i) => { svg += `<text x="${W / 2}" y="${cy + 70 + i * 32}" text-anchor="middle" font-family="${SANS}" font-size="24" fill="${INK}">${esc(ln)}</text>`; });
  return svg;
}
function renderMatrix(spec: ChartSpec): string {
  const { svg: head, bottom } = header(spec);
  const gx = 220, gy = bottom + 18, gw = W - gx - 90, gh = H - gy - 86;
  let svg = head;
  svg += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="none" stroke="${RULE}" stroke-width="2"/>`;
  svg += `<line x1="${gx + gw / 2}" y1="${gy}" x2="${gx + gw / 2}" y2="${gy + gh}" stroke="${RULE}" stroke-width="1.5"/>`;
  svg += `<line x1="${gx}" y1="${gy + gh / 2}" x2="${gx + gw}" y2="${gy + gh / 2}" stroke="${RULE}" stroke-width="1.5"/>`;
  const ax = spec.axisX || { low: '', high: '' }, ay = spec.axisY || { low: '', high: '' };
  svg += `<text x="${gx}" y="${gy + gh + 34}" font-family="${SANS}" font-size="18" fill="${MUTE}">${esc(ax.low)}</text>`;
  svg += `<text x="${gx + gw}" y="${gy + gh + 34}" text-anchor="end" font-family="${SANS}" font-size="18" fill="${MUTE}">${esc(ax.high)}</text>`;
  svg += `<text transform="translate(${gx - 18},${gy + gh}) rotate(-90)" font-family="${SANS}" font-size="18" fill="${MUTE}">${esc(ay.low)}</text>`;
  svg += `<text transform="translate(${gx - 18},${gy}) rotate(-90)" text-anchor="end" font-family="${SANS}" font-size="18" fill="${MUTE}">${esc(ay.high)}</text>`;
  (spec.points || []).slice(0, 6).forEach((p) => {
    const px = gx + Math.max(0, Math.min(1, p.x)) * gw;
    const py = gy + gh - Math.max(0, Math.min(1, p.y)) * gh;
    svg += `<circle cx="${px}" cy="${py}" r="9" fill="${p.highlight ? ACCENT : INK}"/>`;
    svg += `<text x="${px + 14}" y="${py + 6}" font-family="${SANS}" font-size="18" fill="${INK}">${esc(p.label)}</text>`;
  });
  return svg;
}
export function buildChartSVG(spec: ChartSpec): string {
  let body = '';
  if (spec.type === 'comparison') body = renderComparison(spec);
  else if (spec.type === 'stat') body = renderStat(spec);
  else if (spec.type === 'matrix') body = renderMatrix(spec);
  else body = renderBars(spec);
  const foot = spec.illustrative
    ? `<text x="64" y="${H - 36}" font-family="${SANS}" font-size="15" fill="${SLATE}">Illustrative — figures for illustration</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${PAPER}"/>`
    + `<rect x="0" y="0" width="${W}" height="10" fill="${INK}"/>`
    + body + foot + `</svg>`;
}

// ===================== portrait carousel slides (4:5) =====================
const MX = 88;
function slideFrame(idx: number, total: number): string {
  return `<rect width="${PW}" height="${PH}" fill="${PAPER}"/>`
    + `<rect x="0" y="0" width="${PW}" height="14" fill="${INK}"/>`
    + `<rect x="${MX}" y="${PH - 80}" width="44" height="6" fill="${ACCENT}"/>`
    + `<text x="${PW - MX}" y="${PH - 70}" text-anchor="end" font-family="${SANS}" font-size="22" fill="${SLATE}">${idx + 1} / ${total}</text>`;
}
function coverSlide(s: Slide): string {
  let svg = '', y = 360;
  if (s.kicker) svg += `<text x="${MX}" y="240" font-family="${SANS}" font-size="26" letter-spacing="3" fill="${ACCENT}">${esc((s.kicker || '').toUpperCase())}</text>`;
  wrap(s.title || '', 22, 4).forEach((l) => { svg += `<text x="${MX}" y="${y}" font-family="${SERIF}" font-size="82" font-weight="700" fill="${INK}">${esc(l)}</text>`; y += 96; });
  if (s.subtitle) { y += 14; wrap(s.subtitle, 40, 3).forEach((l) => { svg += `<text x="${MX}" y="${y}" font-family="${SANS}" font-size="34" fill="${MUTE}">${esc(l)}</text>`; y += 46; }); }
  svg += `<text x="${MX}" y="${PH - 150}" font-family="${SANS}" font-size="28" fill="${ACCENT}">Swipe →</text>`;
  return svg;
}
function pointSlide(s: Slide): string {
  let svg = '', y = 250;
  wrap(s.title || '', 26, 3).forEach((l) => { svg += `<text x="${MX}" y="${y}" font-family="${SERIF}" font-size="60" font-weight="700" fill="${INK}">${esc(l)}</text>`; y += 72; });
  y += 50;
  (s.bullets || []).slice(0, 4).forEach((b) => {
    svg += `<rect x="${MX}" y="${y - 26}" width="18" height="18" rx="3" fill="${ACCENT}"/>`;
    const lines = wrap(b, 38, 3);
    lines.forEach((l, i) => { svg += `<text x="${MX + 38}" y="${y - i * 0 + i * 44}" font-family="${SANS}" font-size="38" fill="${INK}">${esc(l)}</text>`; });
    y += 44 * lines.length + 34;
  });
  return svg;
}
function statSlide(s: Slide): string {
  let svg = '', cy = PH / 2 - 40;
  svg += `<text x="${PW / 2}" y="${cy}" text-anchor="middle" font-family="${SERIF}" font-size="300" font-weight="700" fill="${ACCENT}">${esc(s.value || '')}</text>`;
  let y = cy + 90;
  wrap(s.label || '', 30, 2).forEach((l) => { svg += `<text x="${PW / 2}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="44" font-weight="600" fill="${INK}">${esc(l)}</text>`; y += 56; });
  if (s.context) { y += 8; wrap(s.context, 44, 2).forEach((l) => { svg += `<text x="${PW / 2}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="30" fill="${MUTE}">${esc(l)}</text>`; y += 40; }); }
  return svg;
}
function barsSlide(s: Slide): string {
  const bars = (s.bars || []).slice(0, 5);
  let svg = '', y = 230;
  wrap(s.title || '', 30, 2).forEach((l) => { svg += `<text x="${MX}" y="${y}" font-family="${SERIF}" font-size="54" font-weight="700" fill="${INK}">${esc(l)}</text>`; y += 64; });
  const top = y + 40, max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const rowH = Math.min(150, (PH - top - 200) / Math.max(1, bars.length));
  const barMaxW = PW - MX * 2 - 130;
  bars.forEach((b, i) => {
    const by = top + i * rowH;
    const w = Math.max(4, (Math.abs(b.value) / max) * barMaxW);
    svg += `<text x="${MX}" y="${by}" font-family="${SANS}" font-size="32" fill="${INK}">${esc(b.label)}</text>`;
    svg += `<rect x="${MX}" y="${by + 16}" width="${w}" height="40" rx="3" fill="${kindColor(b.kind)}"/>`;
    svg += `<text x="${MX + w + 16}" y="${by + 48}" font-family="${SERIF}" font-size="38" font-weight="700" fill="${INK}">${esc(fmt(b.value, s.unit))}</text>`;
  });
  svg += legend(bars.map((b) => b.kind || ''), MX, PH - 140);
  return svg;
}
function ctaSlide(s: Slide): string {
  let svg = '', y = 300;
  wrap(s.title || '', 24, 3).forEach((l) => { svg += `<text x="${MX}" y="${y}" font-family="${SERIF}" font-size="62" font-weight="700" fill="${INK}">${esc(l)}</text>`; y += 76; });
  if (s.question) { y += 40; wrap(s.question, 30, 3).forEach((l) => { svg += `<text x="${MX}" y="${y}" font-family="${SERIF}" font-style="italic" font-size="44" fill="${ACCENT}">${esc(l)}</text>`; y += 56; }); }
  if (s.footer) { wrap(s.footer, 44, 2).forEach((l, i) => { svg += `<text x="${MX}" y="${PH - 180 + i * 38}" font-family="${SANS}" font-size="30" fill="${MUTE}">${esc(l)}</text>`; }); }
  return svg;
}
export function buildSlideSVG(slide: Slide, idx: number, total: number): string {
  let body = '';
  if (slide.kind === 'cover') body = coverSlide(slide);
  else if (slide.kind === 'stat') body = statSlide(slide);
  else if (slide.kind === 'bars') body = barsSlide(slide);
  else if (slide.kind === 'cta') body = ctaSlide(slide);
  else body = pointSlide(slide);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}">`
    + slideFrame(idx, total) + body + `</svg>`;
}

// ---- rasterise any SVG (reads its own width/height) to base64 PNG at 2× ----
export function svgToPng(svg: string): Promise<string> {
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
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Render failed')); };
    img.src = url;
  });
}
