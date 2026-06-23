// Editorial "figure" renderer. Turns a structured chart spec (produced by the
// model from the post) into a clean, legible SVG — then rasterises it to PNG.
// This is how we get technical, data-bearing images with real typography
// instead of an image model's garbled fake charts.

export interface ChartSpec {
  type: 'bars' | 'comparison' | 'stat' | 'matrix';
  title?: string;
  takeaway?: string;
  unit?: string;
  illustrative?: boolean;
  bars?: { label: string; value: number; highlight?: boolean }[];
  left?: { label: string; value: number };
  right?: { label: string; value: number };
  stat?: { value: string; label: string };
  axisX?: { low: string; high: string };
  axisY?: { low: string; high: string };
  points?: { label: string; x: number; y: number; highlight?: boolean }[];
}

const W = 1200, H = 675;
// Editorial palette — warm paper, ink, one red accent + a muted slate.
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
// Wrap a string into <=maxChars lines (word-based), up to maxLines.
function wrap(s: string, maxChars: number, maxLines: number): string[] {
  const words = String(s || '').split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && cur && lines[maxLines - 1] !== cur) { /* truncated */ }
  return lines.slice(0, maxLines);
}

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
  const { svg: head, bottom } = header(spec);
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const top = bottom + 6, areaH = H - top - 96;
  const rowH = Math.min(76, areaH / Math.max(1, bars.length));
  const labelW = 300, barX = 64 + labelW, barMaxW = W - barX - 150;
  let svg = head;
  bars.forEach((b, i) => {
    const cy = top + i * rowH + rowH / 2;
    const w = Math.max(3, (Math.abs(b.value) / max) * barMaxW);
    const col = b.highlight ? ACCENT : SLATE;
    svg += `<text x="${64 + labelW - 16}" y="${cy + 6}" text-anchor="end" font-family="${SANS}" font-size="20" fill="${INK}">${esc(b.label)}</text>`;
    svg += `<rect x="${barX}" y="${cy - rowH * 0.28}" width="${w}" height="${rowH * 0.56}" fill="${col}" rx="2"/>`;
    svg += `<text x="${barX + w + 12}" y="${cy + 7}" font-family="${SERIF}" font-size="24" font-weight="700" fill="${INK}">${esc(fmt(b.value, spec.unit))}</text>`;
  });
  return svg;
}

function renderComparison(spec: ChartSpec): string {
  const { svg: head, bottom } = header(spec);
  const l = spec.left || { label: '', value: 0 }, r = spec.right || { label: '', value: 0 };
  const cy = bottom + (H - bottom - 90) / 2;
  const colW = (W - 128) / 2;
  let svg = head;
  const cell = (cx: number, d: { label: string; value: number }, accent: boolean) => {
    let s = `<text x="${cx}" y="${cy - 36}" text-anchor="middle" font-family="${SERIF}" font-size="96" font-weight="700" fill="${accent ? ACCENT : INK}">${esc(fmt(d.value, spec.unit))}</text>`;
    wrap(d.label, 30, 2).forEach((ln, i) => { s += `<text x="${cx}" y="${cy + 24 + i * 28}" text-anchor="middle" font-family="${SANS}" font-size="22" fill="${MUTE}">${esc(ln)}</text>`; });
    return s;
  };
  svg += cell(64 + colW / 2, l, false);
  svg += `<line x1="${W / 2}" y1="${bottom + 20}" x2="${W / 2}" y2="${H - 110}" stroke="${RULE}" stroke-width="2"/>`;
  svg += `<text x="${W / 2}" y="${cy - 70}" text-anchor="middle" font-family="${SANS}" font-size="18" fill="${SLATE}">vs</text>`;
  svg += cell(64 + colW + colW / 2, r, true);
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
  const gx = 220, gy = bottom + 18;
  const gw = W - gx - 90, gh = H - gy - 86;
  let svg = head;
  // quadrant frame + crosshair
  svg += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="none" stroke="${RULE}" stroke-width="2"/>`;
  svg += `<line x1="${gx + gw / 2}" y1="${gy}" x2="${gx + gw / 2}" y2="${gy + gh}" stroke="${RULE}" stroke-width="1.5"/>`;
  svg += `<line x1="${gx}" y1="${gy + gh / 2}" x2="${gx + gw}" y2="${gy + gh / 2}" stroke="${RULE}" stroke-width="1.5"/>`;
  // axis labels
  const ax = spec.axisX || { low: '', high: '' }, ay = spec.axisY || { low: '', high: '' };
  svg += `<text x="${gx}" y="${gy + gh + 34}" font-family="${SANS}" font-size="18" fill="${MUTE}">${esc(ax.low)}</text>`;
  svg += `<text x="${gx + gw}" y="${gy + gh + 34}" text-anchor="end" font-family="${SANS}" font-size="18" fill="${MUTE}">${esc(ax.high)}</text>`;
  svg += `<text transform="translate(${gx - 18},${gy + gh}) rotate(-90)" font-family="${SANS}" font-size="18" fill="${MUTE}">${esc(ay.low)}</text>`;
  svg += `<text transform="translate(${gx - 18},${gy}) rotate(-90)" text-anchor="end" font-family="${SANS}" font-size="18" fill="${MUTE}">${esc(ay.high)}</text>`;
  (spec.points || []).slice(0, 6).forEach((p) => {
    const px = gx + Math.max(0, Math.min(1, p.x)) * gw;
    const py = gy + gh - Math.max(0, Math.min(1, p.y)) * gh;
    const col = p.highlight ? ACCENT : INK;
    svg += `<circle cx="${px}" cy="${py}" r="9" fill="${col}"/>`;
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
    ? `<text x="64" y="${H - 40}" font-family="${SANS}" font-size="15" fill="${SLATE}">Illustrative — figures for illustration</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${PAPER}"/>`
    + `<rect x="0" y="0" width="${W}" height="10" fill="${INK}"/>`
    + body + foot
    + `</svg>`;
}

// Rasterise the SVG to a base64 PNG (no data: prefix) at 2× for crispness.
export function svgToPng(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = W * 2; canvas.height = H * 2;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Figure render failed')); };
    img.src = url;
  });
}
