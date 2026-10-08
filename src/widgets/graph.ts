import type { Board } from '../board';
import { pathFromPoints, uid } from '../geometry';
import { compile, type Fn, fmtNum } from '../mathexpr';
import { PAGE } from '../page';
import { drawEls, isDarkColor, measureText } from '../renderer';
import { store } from '../store';
import type { El, PathEl, TextEl } from '../types';
import { closePanel, floatingPanel, toast } from '../ui/panel';

// Graph plotter: type y = f(x) (up to three), see a live preview, and put a
// clean graph with axes, grid and numbers on the board. Everything it adds
// is ordinary drawing, so it can be moved, resized, coloured or written on.

const CURVES = ['#38bdf8', '#f472b6', '#facc15'];
const KEY = 'teachly.graph';

function niceStep(range: number): number {
  const raw = range / 10;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

interface Spec {
  fns: string[];
  x0: number;
  x1: number;
  y0: number | null;
  y1: number | null;
  grid: boolean;
}

function load(): Spec {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Spec;
    if (Array.isArray(s.fns)) return s;
  } catch {
    /* default */
  }
  return { fns: ['x^2 - 2', 'sin(x)', ''], x0: -5, x1: 5, y0: null, y1: null, grid: true };
}

/** Sample a function into screen-ready runs (broken at gaps and asymptotes). */
function sample(f: Fn, x0: number, x1: number, y0: number, y1: number, n = 700): [number, number][][] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  const span = y1 - y0;
  let prev = NaN;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    let y: number;
    try {
      y = f(x);
    } catch {
      y = NaN;
    }
    const bad = !isFinite(y) || y < y0 - span * 2 || y > y1 + span * 2 || (isFinite(prev) && Math.abs(y - prev) > span * 0.9);
    if (bad) {
      if (run.length > 1) runs.push(run);
      run = [];
      if (!isFinite(y) || Math.abs(y - prev) > span * 0.9) {
        prev = y;
        if (isFinite(y) && y >= y0 - span * 2 && y <= y1 + span * 2) run.push([x, y]);
        continue;
      }
    } else run.push([x, y]);
    prev = y;
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

function autoY(fs: Fn[], x0: number, x1: number): [number, number] {
  const ys: number[] = [];
  for (const f of fs) {
    for (let i = 0; i <= 200; i++) {
      try {
        const y = f(x0 + ((x1 - x0) * i) / 200);
        if (isFinite(y)) ys.push(y);
      } catch {
        /* skip */
      }
    }
  }
  if (!ys.length) return [-5, 5];
  ys.sort((a, b) => a - b);
  // Ignore extreme spikes (e.g. tan near its asymptotes).
  let lo = ys[Math.floor(ys.length * 0.03)], hi = ys[Math.ceil(ys.length * 0.97) - 1];
  lo = Math.min(lo, 0);
  hi = Math.max(hi, 0);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}

/** Build the graph as board elements inside `box` (world units). */
export function buildGraph(spec: Spec, box: { x: number; y: number; w: number; h: number }, ink: string): El[] {
  const fs: { f: Fn; src: string; color: string }[] = [];
  spec.fns.forEach((src, i) => {
    if (src.trim()) fs.push({ f: compile(src), src: src.trim(), color: CURVES[i] });
  });
  const { x0, x1 } = spec;
  const [ay0, ay1] = autoY(fs.map((q) => q.f), x0, x1);
  const y0 = spec.y0 ?? ay0, y1 = spec.y1 ?? ay1;
  const X = (x: number) => box.x + ((x - x0) / (x1 - x0)) * box.w;
  const Y = (y: number) => box.y + box.h - ((y - y0) / (y1 - y0)) * box.h;
  const els: El[] = [];
  const line = (pts: [number, number][], color: string, size: number, extra: Partial<PathEl> = {}): PathEl => ({
    id: uid(), type: 'path', style: 'shape', pts: pathFromPoints(pts, false), color, size, opacity: 1, ...extra,
  });
  const sx = niceStep(x1 - x0), sy = niceStep(y1 - y0);
  if (spec.grid) {
    for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx) els.push(line([[X(x), box.y], [X(x), box.y + box.h]], ink, 1, { opacity: 0.18 }));
    for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) els.push(line([[box.x, Y(y)], [box.x + box.w, Y(y)]], ink, 1, { opacity: 0.18 }));
  }
  // Axes (at zero when visible, otherwise along the edge).
  const axX = Math.min(Math.max(0, x0), x1), axY = Math.min(Math.max(0, y0), y1);
  els.push(line([[box.x - 10, Y(axY)], [box.x + box.w + 18, Y(axY)]], ink, 2.5, { arrow: 1 }));
  els.push(line([[X(axX), box.y + box.h + 10], [X(axX), box.y - 18]], ink, 2.5, { arrow: 1 }));
  const fontSize = Math.max(14, Math.min(22, box.w / 40));
  const label = (text: string, cx: number, cy: number, color = ink, size = fontSize, align: 'c' | 'l' = 'c'): TextEl => {
    const m = measureText(text, size, false, 2000, false);
    return { id: uid(), type: 'text', text, color, fontSize: size, x: align === 'c' ? cx - m.w / 2 : cx, y: cy - m.h / 2, w: m.w, h: m.h, rot: 0 };
  };
  // Numbers on the axes (every other tick when crowded).
  const xTicks = Math.round((x1 - x0) / sx), yTicks = Math.round((y1 - y0) / sy);
  const xEvery = xTicks > 12 ? 2 : 1, yEvery = yTicks > 10 ? 2 : 1;
  let n = 0;
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx, n++) {
    if (Math.abs(x) < sx / 2 || n % xEvery) continue;
    els.push(line([[X(x), Y(axY) - 5], [X(x), Y(axY) + 5]], ink, 2));
    els.push(label(fmtNum(+x.toPrecision(10)), X(x), Y(axY) + fontSize * 0.95));
  }
  n = 0;
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy, n++) {
    if (Math.abs(y) < sy / 2 || n % yEvery) continue;
    els.push(line([[X(axX) - 5, Y(y)], [X(axX) + 5, Y(y)]], ink, 2));
    const t = fmtNum(+y.toPrecision(10));
    const m = measureText(t, fontSize, false, 2000, false);
    els.push(label(t, X(axX) - 10 - m.w, Y(y), ink, fontSize, 'l'));
  }
  els.push(label('x', box.x + box.w + 30, Y(axY), ink, fontSize * 1.1));
  els.push(label('y', X(axX), box.y - 32, ink, fontSize * 1.1));
  if (x0 < 0 && x1 > 0 && y0 < 0 && y1 > 0) els.push(label('0', X(0) - fontSize * 0.6, Y(0) + fontSize * 0.9));
  // Curves, then their equations in the same colour.
  fs.forEach((q, i) => {
    for (const run of sample(q.f, x0, x1, y0, y1)) {
      const pts = run.map(([x, y]) => [X(x), Math.max(box.y - 40, Math.min(box.y + box.h + 40, Y(y)))] as [number, number]);
      els.push(line(pts, q.color, 4));
    }
    els.push(label(`y = ${q.src}`, box.x + 12, box.y + 18 + i * fontSize * 1.5, q.color, fontSize * 1.1, 'l'));
  });
  return els;
}

export function openGraph(host: HTMLElement, board: Board): void {
  const body = floatingPanel(host, { id: 'graph', title: 'Graph', iconName: 'graph', width: 360 });
  if (!body) return;
  const s = load();
  body.innerHTML = `
    ${s.fns.map((f, i) => `<label class="g-row"><i style="background:${CURVES[i]}"></i><span>y =</span><input data-f="${i}" value="${f.replace(/"/g, '&quot;')}" placeholder="${['e.g. 2x + 1', 'e.g. x^2', 'e.g. sin(x)'][i]}" autocomplete="off" spellcheck="false"></label>`).join('')}
    <div class="g-range">
      <label>x from <input type="number" data-r="x0" value="${s.x0}"></label>
      <label>to <input type="number" data-r="x1" value="${s.x1}"></label>
    </div>
    <div class="g-range">
      <label>y from <input type="number" data-r="y0" value="${s.y0 ?? ''}" placeholder="auto"></label>
      <label>to <input type="number" data-r="y1" value="${s.y1 ?? ''}" placeholder="auto"></label>
    </div>
    <label class="check"><input type="checkbox" data-grid ${s.grid ? 'checked' : ''}> Grid lines</label>
    <canvas class="g-preview" width="640" height="400"></canvas>
    <div class="g-err muted small"></div>
    <button class="btn primary wide" data-put>Put graph on board</button>`;
  const cv = body.querySelector('canvas') as HTMLCanvasElement;
  const err = body.querySelector('.g-err') as HTMLElement;
  const read = (): Spec => {
    const num = (k: string) => {
      const v = (body.querySelector(`[data-r=${k}]`) as HTMLInputElement).value;
      return v === '' ? null : Number(v);
    };
    const x0 = num('x0') ?? -5, x1 = num('x1') ?? 5;
    return {
      fns: [...body.querySelectorAll<HTMLInputElement>('[data-f]')].map((i) => i.value),
      x0: Math.min(x0, x1 - 1e-6), x1: Math.max(x1, x0 + 1e-6),
      y0: num('y0'), y1: num('y1'),
      grid: (body.querySelector('[data-grid]') as HTMLInputElement).checked,
    };
  };
  const preview = () => {
    const spec = read();
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, cv.width, cv.height);
    try {
      const els = buildGraph(spec, { x: 60, y: 50, w: cv.width - 110, h: cv.height - 100 }, '#ffffff');
      // Draw with the real renderer so the preview matches the board.
      drawEls(ctx, els, null);
      err.textContent = '';
      try {
        localStorage.setItem(KEY, JSON.stringify(spec));
      } catch {
        /* ignore */
      }
      return true;
    } catch (e) {
      err.textContent = (e as Error).message;
      return false;
    }
  };
  let t = 0;
  body.addEventListener('input', () => {
    clearTimeout(t);
    t = window.setTimeout(preview, 120);
  });
  body.addEventListener('change', preview);
  (body.querySelector('[data-put]') as HTMLElement).addEventListener('click', () => {
    if (!preview()) return;
    const spec = read();
    if (!spec.fns.some((f) => f.trim())) return toast('Type an equation first, e.g. x^2');
    const v = board.viewRect();
    const w = Math.min(PAGE.w * 0.55, v.w * 0.6), h = Math.min(PAGE.h * 0.62, v.h * 0.62, w * 0.68);
    const cx = Math.max(PAGE.x + w / 2 + 40, Math.min(PAGE.x + PAGE.w - w / 2 - 40, v.x + v.w / 2));
    const cy = Math.max(PAGE.y + h / 2 + 50, Math.min(PAGE.y + PAGE.h - h / 2 - 40, v.y + v.h / 2));
    const els = buildGraph(spec, { x: cx - w / 2, y: cy - h / 2, w, h }, isDarkColor(store.page.bg) ? '#ffffff' : '#1e293b');
    store.addEls(els);
    store.setTool({ tool: 'select' });
    store.select(els.map((e) => e.id));
    closePanel('graph');
    toast('Graph added — drag to move, use the corners to resize');
  });
  preview();
}
