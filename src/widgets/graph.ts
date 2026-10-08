import type { Board } from '../board';
import { pathFromPoints, uid } from '../geometry';
import { compile, type Fn, fmtNum, prettyExpr, usedParams } from '../mathexpr';
import { PAGE } from '../page';
import { drawEls, isDarkColor, measureText } from '../renderer';
import { store } from '../store';
import type { El, PathEl, Rect, TextEl } from '../types';
import { icon } from '../ui/icons';
import { closePanel, floatingPanel, toast } from '../ui/panel';
import { mathKeyboard } from './mathkeys';

// Graph tool (Desmos-style): a list of equations on the left, a live graph
// on the right that you drag to move and pinch / scroll to zoom. Touch a
// curve to read its coordinates. "Put on board" places exactly what you
// see as one piece (with a futuristic panel, neon curves and bold labels).

const CURVES = ['#22d3ee', '#f472b6', '#facc15', '#4ade80', '#a78bfa', '#fb923c'];
const MAX = 6;
const KEY = 'teachly.graph2';

interface Spec {
  fns: string[];
  hidden: boolean[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  grid: boolean;
  marks: boolean;
  params: Record<string, number>;
}

type Theme = 'dark' | 'light';
const THEMES = {
  dark: { bg: '#050a14', edge: '#1b3354', grid: '#38bdf8', axis: '#e2e8f0', tick: '#9fb3c8', label: 'rgba(5,10,20,0.88)' },
  light: { bg: '#ffffff', edge: '#cbd5e1', grid: '#64748b', axis: '#0f172a', tick: '#475569', label: 'rgba(255,255,255,0.92)' },
};

const EXAMPLES: [string, string][] = [
  ['Line', '2x + 1'],
  ['Parabola', 'x^2 - 2'],
  ['Cubic', 'x^3 - 3x'],
  ['sin', 'sin(x)'],
  ['cos', 'cos(x)'],
  ['tan', 'tan(x)'],
  ['|x|', 'abs(x)'],
  ['1/x', '1/x'],
  ['√x', 'sqrt(x)'],
  ['eˣ', 'e^x'],
  ['log', 'log(x)'],
  ['ax²+bx+c', 'a x^2 + b x + c'],
  ['a·sin(bx)', 'a sin(b x)'],
];

function niceStep(range: number, target = 10): number {
  const raw = range / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function safe(f: Fn, x: number): number {
  try {
    return f(x);
  } catch {
    return NaN;
  }
}

function load(): Spec {
  const def: Spec = { fns: ['x^2 - 2', 'sin(x)'], hidden: [], x0: -6, x1: 6, y0: -4, y1: 6, grid: true, marks: true, params: {} };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Spec;
    if (Array.isArray(s.fns) && isFinite(s.x0) && isFinite(s.y0)) return { ...def, ...s };
  } catch {
    /* default */
  }
  return def;
}

/** Fit the y range to the visible part of the curves. */
function autoY(fs: Fn[], x0: number, x1: number): [number, number] {
  const ys: number[] = [];
  for (const f of fs) for (let i = 0; i <= 200; i++) {
    const y = safe(f, x0 + ((x1 - x0) * i) / 200);
    if (isFinite(y)) ys.push(y);
  }
  if (!ys.length) return [-5, 5];
  ys.sort((a, b) => a - b);
  let lo = ys[Math.floor(ys.length * 0.04)], hi = ys[Math.ceil(ys.length * 0.96) - 1];
  lo = Math.min(lo, 0);
  hi = Math.max(hi, 0);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.12;
  return [lo - pad, hi + pad];
}

/** Points worth showing: roots, the y-intercept, and turning points. */
function keyPoints(f: Fn, x0: number, x1: number, span: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = 900;
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    xs.push(x);
    ys.push(safe(f, x));
  }
  const ok = (i: number) => isFinite(ys[i]) && isFinite(ys[i + 1]) && Math.abs(ys[i + 1] - ys[i]) < span * 0.5;
  for (let i = 0; i < n && out.length < 12; i++) {
    if (!ok(i)) continue;
    // Root: sign change, narrowed down by halving.
    if (ys[i] === 0 || ys[i] * ys[i + 1] < 0) {
      let a = xs[i], b = xs[i + 1], fa = ys[i];
      for (let k = 0; k < 40; k++) {
        const m = (a + b) / 2, fm = safe(f, m);
        if (fa * fm <= 0) b = m;
        else {
          a = m;
          fa = fm;
        }
      }
      out.push({ x: (a + b) / 2, y: 0 });
    }
    // Turning point: the slope changes sign.
    if (i > 0 && ok(i - 1)) {
      const d1 = ys[i] - ys[i - 1], d2 = ys[i + 1] - ys[i];
      if (d1 * d2 < 0 && Math.abs(d1) + Math.abs(d2) > 1e-12) {
        let a = xs[i - 1], b = xs[i + 1];
        const max = d1 > 0;
        for (let k = 0; k < 60; k++) {
          const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
          const f1 = safe(f, m1), f2 = safe(f, m2);
          if (max ? f1 < f2 : f1 > f2) a = m1;
          else b = m2;
        }
        const x = (a + b) / 2;
        out.push({ x, y: safe(f, x) });
      }
    }
  }
  if (x0 < 0 && x1 > 0) {
    const y = safe(f, 0);
    if (isFinite(y)) out.push({ x: 0, y });
  }
  // Drop duplicates (a root that is also a turning point, etc.).
  return out.filter((p, i) => out.findIndex((q) => Math.abs(q.x - p.x) < (x1 - x0) * 1e-4 && Math.abs(q.y - p.y) < span * 1e-4) === i);
}

/** Tidy signs after filling in values: "+ (-2)" → "− 2", "1x" → "x". */
function tidy(src: string): string {
  return src
    .replace(/\+\s*\((-[\d.]+)\)/g, (_, v: string) => `- ${v.slice(1)}`)
    .replace(/-\s*\((-[\d.]+)\)/g, (_, v: string) => `+ ${v.slice(1)}`)
    .replace(/^\((-[\d.]+)\)/, '$1')
    .replace(/(^|[^\d.])1\s*(?=[a-z(])/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Put the slider values into the equation for its label (a x^2 → 2x^2). */
function withValues(src: string, params: Record<string, number>): string {
  return src.replace(/(^|[^a-z])([abckm])(?![a-z])/gi, (all, pre: string, name: string) => {
    const v = params[name];
    if (v === undefined) return all;
    const t = fmtNum(+v.toFixed(2));
    return `${pre}${/[0-9.]$/.test(pre) ? '·' : ''}${v < 0 ? `(${t})` : t}`;
  });
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Cut a screen polyline to the rows between top and bottom. */
function clipRows(run: [number, number][], top: number, bottom: number): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  const inside = (y: number) => y >= top && y <= bottom;
  for (let i = 0; i < run.length; i++) {
    const [x, y] = run[i];
    if (inside(y)) {
      if (!cur.length && i > 0) {
        const [px, py] = run[i - 1];
        const ey = py < top ? top : bottom;
        cur.push([px + ((x - px) * (ey - py)) / (y - py), ey]);
      }
      cur.push([x, y]);
    } else if (cur.length) {
      const [px, py] = run[i - 1];
      const ey = y < top ? top : bottom;
      cur.push([px + ((x - px) * (ey - py)) / (y - py), ey]);
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Build the graph as board elements inside `box` (world units or canvas pixels). */
export function buildGraph(spec: Spec, box: Rect, theme: Theme): El[] {
  const T = THEMES[theme];
  const fs: { f: Fn; label: string; color: string }[] = [];
  spec.fns.forEach((src, i) => {
    if (!src.trim() || spec.hidden[i]) return;
    fs.push({ f: compile(src, { params: spec.params }), label: `y = ${prettyExpr(tidy(withValues(src.trim(), spec.params)))}`, color: CURVES[i % CURVES.length] });
  });
  const { x0, x1, y0, y1 } = spec;
  const X = (x: number) => box.x + ((x - x0) / (x1 - x0)) * box.w;
  const Y = (y: number) => box.y + box.h - ((y - y0) / (y1 - y0)) * box.h;
  const els: El[] = [];
  const path = (pts: [number, number][], color: string, size: number, extra: Partial<PathEl> = {}): PathEl => ({
    id: uid(), type: 'path', style: 'shape', pts: pathFromPoints(pts, false), color, size, opacity: 1, ...extra,
  });
  const u = Math.max(0.6, Math.min(2.4, box.w / 700)); // size unit
  const fontSize = Math.round(13 * u);
  const placed: Rect[] = [];
  // Text goes on top of everything (added at the end), so curves never hide it.
  const labels: El[] = [];
  const text = (t: string, x: number, y: number, color: string, size: number, font: TextEl['font'], bg?: string): TextEl => {
    const m = measureText(t, size, true, 4000, !!bg, font);
    return { id: uid(), type: 'text', text: t, color, fontSize: size, bold: true, font, x, y, w: m.w, h: m.h, rot: 0, ...(bg ? { bg } : {}) };
  };
  /** Place a label at the first free spot (never on top of another label). */
  const place = (t: string, spots: [number, number][], color: string, size: number, font: TextEl['font'], bg?: string, force = false): void => {
    const probe = text(t, 0, 0, color, size, font, bg);
    for (const [ax, ay] of spots) {
      const r = { x: ax, y: ay, w: probe.w, h: probe.h };
      if (r.x < box.x + 2 || r.y < box.y + 2 || r.x + r.w > box.x + box.w - 2 || r.y + r.h > box.y + box.h - 2) continue;
      if (!force && placed.some((p) => overlaps(p, r))) continue;
      placed.push(r);
      labels.push({ ...probe, x: r.x, y: r.y });
      return;
    }
  };

  // Panel background with a soft edge.
  const r = Math.min(18 * u, box.w * 0.04);
  const panel: [number, number][] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      panel.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(box.x + box.w - r, box.y + r, -Math.PI / 2);
  corner(box.x + box.w - r, box.y + box.h - r, 0);
  corner(box.x + r, box.y + box.h - r, Math.PI / 2);
  corner(box.x + r, box.y + r, Math.PI);
  els.push({ ...path(panel, T.edge, 1.5 * u), pts: pathFromPoints(panel, true), closed: true, fill: T.bg });

  // Grid: faint minor lines, brighter major lines.
  const sx = niceStep(x1 - x0, 10), sy = niceStep(y1 - y0, 8);
  const inset = 6 * u;
  const gx0 = box.x + inset, gx1 = box.x + box.w - inset, gy0 = box.y + inset, gy1 = box.y + box.h - inset;
  if (spec.grid) {
    for (const [step, op] of [[sx / 5, 0.07], [sx, 0.2]] as const) {
      if ((x1 - x0) / step > 140) continue;
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) if (X(x) > gx0 && X(x) < gx1) els.push(path([[X(x), gy0], [X(x), gy1]], T.grid, 1, { opacity: op }));
    }
    for (const [step, op] of [[sy / 5, 0.07], [sy, 0.2]] as const) {
      if ((y1 - y0) / step > 140) continue;
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) if (Y(y) > gy0 && Y(y) < gy1) els.push(path([[gx0, Y(y)], [gx1, Y(y)]], T.grid, 1, { opacity: op }));
    }
  }
  // Axes (pinned to the edge when zero is off screen, like Desmos).
  const ax = Math.min(Math.max(X(0), gx0), gx1), ay = Math.min(Math.max(Y(0), gy0), gy1);
  els.push(path([[gx0, ay], [gx1, ay]], T.axis, 2.2 * u, { arrow: 1, opacity: X(0) === ax || Y(0) === ay ? 1 : 0.6 }));
  els.push(path([[ax, gy1], [ax, gy0]], T.axis, 2.2 * u, { arrow: 1 }));

  // Legend first (top-left), so nothing else lands on it.
  fs.forEach((q, i) => place(q.label, [[gx0 + 8 * u, gy0 + 8 * u + i * fontSize * 2.2]], q.color, Math.round(fontSize * 1.15), 'exo', T.label, true));
  // Axis letters.
  place('x', [[gx1 - fontSize * 1.4, ay - fontSize * 2.1], [gx1 - fontSize * 1.4, ay + 6 * u]], T.axis, Math.round(fontSize * 1.2), 'orbitron');
  place('y', [[ax + 8 * u, gy0 + 2 * u], [ax - fontSize * 1.6, gy0 + 2 * u]], T.axis, Math.round(fontSize * 1.2), 'orbitron');
  // Numbers along the axes (skipped where they would collide).
  const below = ay + 6 * u < gy1 - fontSize * 2;
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx) {
    if (Math.abs(x) < sx / 2) continue;
    const t = fmtNum(+x.toPrecision(10)), px = X(x);
    const w = measureText(t, fontSize, true, 999, false, 'orbitron').w;
    place(t, [below ? [px - w / 2, ay + 5 * u] : [px - w / 2, ay - fontSize * 1.6 - 5 * u]], T.tick, fontSize, 'orbitron');
  }
  const left = ax - 60 * u > gx0;
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) {
    if (Math.abs(y) < sy / 2) continue;
    const t = fmtNum(+y.toPrecision(10)), py = Y(y);
    const w = measureText(t, fontSize, true, 999, false, 'orbitron').w;
    place(t, [left ? [ax - w - 7 * u, py - fontSize * 0.65] : [ax + 7 * u, py - fontSize * 0.65]], T.tick, fontSize, 'orbitron');
  }
  if (X(0) === ax && Y(0) === ay) place('0', [[ax - fontSize - 4 * u, ay + 4 * u]], T.tick, fontSize, 'orbitron');

  // Curves: a soft neon glow under a crisp line, clipped to the panel.
  const span = y1 - y0;
  fs.forEach((q) => {
    const runs: [number, number][][] = [];
    let run: [number, number][] = [];
    const n = Math.round(Math.max(300, Math.min(1400, box.w * 1.2)));
    let prev = NaN;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = safe(q.f, x);
      const jump = isFinite(prev) && isFinite(y) && Math.abs(y - prev) > span * 1.5;
      if (!isFinite(y) || jump) {
        if (run.length > 1) runs.push(run);
        run = [];
      }
      if (isFinite(y)) run.push([X(x), Y(Math.max(y0 - span * 3, Math.min(y1 + span * 3, y)))]);
      prev = y;
    }
    if (run.length > 1) runs.push(run);
    for (const r0 of runs) for (const seg of clipRows(r0, gy0, gy1)) {
      els.push(path(seg, q.color, 11 * u, { opacity: 0.16 }));
      els.push(path(seg, q.color, 3.4 * u));
    }
  });

  // Key points with coordinates (labels only where there is room).
  if (spec.marks) {
    for (const q of fs) {
      for (const p of keyPoints(q.f, x0, x1, span)) {
        const px = X(p.x), py = Y(p.y);
        if (px < gx0 || px > gx1 || py < gy0 || py > gy1) continue;
        const rr = 4.5 * u;
        const ring: [number, number][] = [];
        for (let i = 0; i <= 18; i++) ring.push([px + Math.cos((i / 18) * Math.PI * 2) * rr, py + Math.sin((i / 18) * Math.PI * 2) * rr]);
        els.push({ ...path(ring, T.bg, 2 * u), pts: pathFromPoints(ring, true), closed: true, fill: q.color });
        const t = `(${fmtNum(+p.x.toFixed(2))}, ${fmtNum(+p.y.toFixed(2))})`;
        const s = Math.round(fontSize * 0.95);
        const m = measureText(t, s, true, 999, true, 'exo');
        const d = 8 * u;
        place(t, [[px + d, py - m.h - d], [px - m.w - d, py - m.h - d], [px + d, py + d], [px - m.w - d, py + d]], q.color, s, 'exo', T.label);
      }
    }
  }
  return [...els, ...labels];
}

export function openGraph(host: HTMLElement, board: Board): void {
  const wide = window.innerWidth >= 900;
  const body = floatingPanel(host, { id: 'graph', title: 'Graph', iconName: 'graph', width: wide ? 940 : 420, className: `g-panel ${wide ? 'g-wide' : ''}` });
  if (!body) return;
  const s = load();
  const params: Record<string, number> = { a: 1, b: 1, c: 0, k: 1, m: 1, ...s.params };
  const view = { x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1 };
  let fns = s.fns.length ? s.fns.slice(0, MAX) : [''];
  let hidden = fns.map((_, i) => !!s.hidden[i]);
  let grid = s.grid, marks = s.marks;
  let active = 0;
  const theme: Theme = isDarkColor(store.page.bg) ? 'dark' : 'light';

  body.innerHTML = `
    <div class="gx-side">
      <div class="gx-examples">${EXAMPLES.map(([n, f]) => `<button class="gx-ex" data-ex="${f}">${n}</button>`).join('')}</div>
      <div class="gx-list"></div>
      <button class="gx-add" data-add>+ Add equation</button>
      <div class="gx-sliders"></div>
      <div class="gx-kb"></div>
    </div>
    <div class="gx-main">
      <div class="gx-stage">
        <canvas class="gx-canvas"></canvas>
        <div class="gx-zoom">
          <button data-z="in" title="Zoom in" aria-label="Zoom in">+</button>
          <button data-z="out" title="Zoom out" aria-label="Zoom out">−</button>
          <button data-z="home" title="Fit to the curves" aria-label="Fit">${icon('fit', 16)}</button>
        </div>
        <div class="gx-hint">Drag to move · pinch or scroll to zoom · touch a curve</div>
      </div>
      <div class="gx-bar">
        <button class="gx-chip ${grid ? 'on' : ''}" data-tog="grid">Grid</button>
        <button class="gx-chip ${marks ? 'on' : ''}" data-tog="marks">Points</button>
        <span class="gx-err"></span>
        <button class="gx-put" data-put>Put on board</button>
      </div>
    </div>`;

  const list = body.querySelector('.gx-list') as HTMLElement;
  const sliders = body.querySelector('.gx-sliders') as HTMLElement;
  const err = body.querySelector('.gx-err') as HTMLElement;
  const cv = body.querySelector('.gx-canvas') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let trace: { x: number; y: number; color: string } | null = null;

  const spec = (): Spec => ({ fns, hidden, ...view, grid, marks, params: { ...params } });
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(spec()));
    } catch {
      /* ignore */
    }
  };
  const inputs = () => [...list.querySelectorAll<HTMLInputElement>('[data-f]')];

  const renderList = () => {
    list.innerHTML = fns
      .map(
        (f, i) => `<div class="gx-row ${i === active ? 'on' : ''}" data-row="${i}" style="--c:${CURVES[i % CURVES.length]}">
          <button class="gx-dot ${hidden[i] ? 'off' : ''}" data-hide="${i}" title="Show / hide" aria-label="Show or hide"></button>
          <span class="gx-y">y =</span>
          <input data-f="${i}" value="${f.replace(/"/g, '&quot;')}" placeholder="${i === 0 ? 'tap an example or the keys' : 'another equation'}" autocomplete="off" spellcheck="false" ${touch ? 'inputmode="none"' : ''}>
          <button class="gx-x" data-del="${i}" aria-label="Remove">×</button>
        </div>`,
      )
      .join('');
    (body.querySelector('[data-add]') as HTMLElement).hidden = fns.length >= MAX;
    inputs().forEach((inp, i) =>
      inp.addEventListener('focus', () => {
        active = i;
        list.querySelectorAll('.gx-row').forEach((r, k) => r.classList.toggle('on', k === i));
      }),
    );
  };

  const syncSliders = () => {
    const used = [...new Set(fns.flatMap((f) => usedParams(f)))];
    const have = [...sliders.querySelectorAll<HTMLElement>('[data-p]')].map((e) => e.dataset.p!);
    if (used.join() === have.join()) return;
    sliders.innerHTML = used
      .map((p) => `<label class="gx-slider" data-p="${p}"><b>${p}</b><input type="range" min="-10" max="10" step="0.1" value="${params[p]}" data-param="${p}"><span data-pv="${p}">${fmtNum(params[p])}</span></label>`)
      .join('');
  };

  // ---- drawing the live graph ------------------------------------------------
  let raf = 0;
  const draw = () => {
    raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    try {
      drawEls(ctx, buildGraph(spec(), { x: 0, y: 0, w: W, h: H }, theme), null);
      err.textContent = '';
    } catch (e) {
      err.textContent = (e as Error).message;
    }
    if (trace) {
      const px = ((trace.x - view.x0) / (view.x1 - view.x0)) * W, py = H - ((trace.y - view.y0) / (view.y1 - view.y0)) * H;
      ctx.fillStyle = trace.color;
      ctx.strokeStyle = THEMES[theme].bg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const t = `(${fmtNum(+trace.x.toFixed(2))}, ${fmtNum(+trace.y.toFixed(2))})`;
      ctx.font = '700 14px "Exo 2", system-ui, sans-serif';
      const tw = ctx.measureText(t).width + 16;
      const bx = Math.min(W - tw - 6, Math.max(6, px + 12)), by = Math.max(6, py - 38);
      ctx.fillStyle = THEMES[theme].label;
      ctx.beginPath();
      ctx.roundRect?.(bx, by, tw, 26, 8);
      ctx.fill();
      ctx.fillStyle = trace.color;
      ctx.textBaseline = 'middle';
      ctx.fillText(t, bx + 8, by + 13);
    }
  };
  const redraw = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };
  const changed = () => {
    fns = inputs().map((i) => i.value);
    syncSliders();
    redraw();
    save();
  };

  const fit = () => {
    const fsList: Fn[] = [];
    fns.forEach((f, i) => {
      if (!f.trim() || hidden[i]) return;
      try {
        fsList.push(compile(f, { params }));
      } catch {
        /* skip */
      }
    });
    const [lo, hi] = autoY(fsList, view.x0, view.x1);
    view.y0 = lo;
    view.y1 = hi;
  };
  const zoom = (k: number, cx = 0.5, cy = 0.5) => {
    const wx = view.x0 + (view.x1 - view.x0) * cx, wy = view.y1 - (view.y1 - view.y0) * cy;
    view.x0 = wx - (wx - view.x0) * k;
    view.x1 = wx + (view.x1 - wx) * k;
    view.y0 = wy - (wy - view.y0) * k;
    view.y1 = wy + (view.y1 - wy) * k;
    redraw();
    save();
  };

  // ---- interaction: drag to pan, pinch / wheel to zoom, touch a curve to trace
  const pts = new Map<number, { x: number; y: number }>();
  let mode: 'pan' | 'trace' | 'pinch' | null = null;
  let last = { x: 0, y: 0, d: 0 };
  const curveAt = (sx: number, sy: number): { x: number; y: number; color: string } | null => {
    const W = cv.clientWidth, H = cv.clientHeight;
    const x = view.x0 + (sx / W) * (view.x1 - view.x0);
    let best: { x: number; y: number; color: string } | null = null, bd = 22;
    fns.forEach((f, i) => {
      if (!f.trim() || hidden[i]) return;
      try {
        const y = compile(f, { params })(x);
        const py = H - ((y - view.y0) / (view.y1 - view.y0)) * H;
        if (isFinite(py) && Math.abs(py - sy) < bd) {
          bd = Math.abs(py - sy);
          best = { x, y, color: CURVES[i % CURVES.length] };
        }
      } catch {
        /* skip */
      }
    });
    return best;
  };
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    const r = cv.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    pts.set(e.pointerId, p);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      mode = 'pinch';
      trace = null;
      last = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    const hit = curveAt(p.x, p.y);
    mode = hit ? 'trace' : 'pan';
    trace = hit;
    last = { x: p.x, y: p.y, d: 0 };
    redraw();
  });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!pts.has(e.pointerId)) {
      // Mouse hover: trace without pressing.
      if (e.pointerType === 'mouse') {
        trace = curveAt(p.x, p.y);
        redraw();
      }
      return;
    }
    pts.set(e.pointerId, p);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (mode === 'pinch' && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
      const dx = ((c.x - last.x) / W) * (view.x1 - view.x0), dy = ((c.y - last.y) / H) * (view.y1 - view.y0);
      view.x0 -= dx;
      view.x1 -= dx;
      view.y0 += dy;
      view.y1 += dy;
      if (last.d > 0 && c.d > 0) zoom(last.d / c.d, c.x / W, c.y / H);
      last = c;
    } else if (mode === 'pan') {
      const dx = ((p.x - last.x) / W) * (view.x1 - view.x0), dy = ((p.y - last.y) / H) * (view.y1 - view.y0);
      view.x0 -= dx;
      view.x1 -= dx;
      view.y0 += dy;
      view.y1 += dy;
      last = { ...p, d: 0 };
    } else if (mode === 'trace') {
      const hit = curveAt(p.x, p.y);
      if (hit) trace = hit;
    }
    redraw();
  });
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size === 0) {
      mode = null;
      save();
    } else if (pts.size === 1 && mode === 'pinch') {
      const p = [...pts.values()][0];
      mode = 'pan';
      last = { ...p, d: 0 };
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !pts.size) {
      trace = null;
      redraw();
    }
  });
  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoom(Math.exp(e.deltaY * 0.0015), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    },
    { passive: false },
  );
  new ResizeObserver(redraw).observe(cv);

  // ---- list, examples, toggles ----------------------------------------------
  body.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.param) {
      params[el.dataset.param] = Number(el.value);
      (body.querySelector(`[data-pv=${el.dataset.param}]`) as HTMLElement).textContent = fmtNum(Number(el.value));
      redraw();
      save();
      return;
    }
    if (el.dataset.f !== undefined) changed();
  });
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b || b.closest('.mk')) return;
    const d = b.dataset;
    if (d.ex !== undefined) {
      // Fill the selected line if empty, else the next empty one, else add one.
      let i = fns[active]?.trim() ? fns.findIndex((f) => !f.trim()) : active;
      if (i < 0) {
        if (fns.length >= MAX) i = active;
        else {
          fns.push('');
          hidden.push(false);
          i = fns.length - 1;
        }
      }
      fns[i] = d.ex;
      hidden[i] = false;
      active = i;
      renderList();
      fit();
      changed();
    } else if (d.add !== undefined) {
      fns.push('');
      hidden.push(false);
      active = fns.length - 1;
      renderList();
      inputs()[active]?.focus();
      changed();
    } else if (d.del !== undefined) {
      const i = Number(d.del);
      if (fns.length > 1) {
        fns.splice(i, 1);
        hidden.splice(i, 1);
      } else fns = [''];
      active = Math.min(active, fns.length - 1);
      renderList();
      changed();
    } else if (d.hide !== undefined) {
      const i = Number(d.hide);
      hidden[i] = !hidden[i];
      b.classList.toggle('off', hidden[i]);
      redraw();
      save();
    } else if (d.z) {
      if (d.z === 'home') {
        view.x0 = -6;
        view.x1 = 6;
        fit();
        redraw();
        save();
      } else zoom(d.z === 'in' ? 0.7 : 1 / 0.7);
    } else if (d.tog) {
      if (d.tog === 'grid') grid = !grid;
      else marks = !marks;
      b.classList.toggle('on', d.tog === 'grid' ? grid : marks);
      redraw();
      save();
    }
  });
  (body.querySelector('.gx-kb') as HTMLElement).appendChild(mathKeyboard(() => inputs()[active] ?? inputs()[0], changed));

  (body.querySelector('[data-put]') as HTMLElement).addEventListener('click', () => {
    if (!fns.some((f, i) => f.trim() && !hidden[i])) return toast('Tap an example or type an equation first, e.g. x^2');
    let els: El[];
    const v = board.viewRect();
    // Same shape as the live graph, so the board shows exactly what you saw.
    const aspect = cv.clientHeight / Math.max(1, cv.clientWidth);
    const w = Math.min(PAGE.w * 0.62, v.w * 0.66), h = Math.min(w * aspect, PAGE.h * 0.8, v.h * 0.8);
    const cx = Math.max(PAGE.x + w / 2 + 30, Math.min(PAGE.x + PAGE.w - w / 2 - 30, v.x + v.w / 2));
    const cy = Math.max(PAGE.y + h / 2 + 30, Math.min(PAGE.y + PAGE.h - h / 2 - 30, v.y + v.h / 2));
    try {
      els = buildGraph(spec(), { x: cx - w / 2, y: cy - h / 2, w, h }, theme);
    } catch (e) {
      return toast((e as Error).message);
    }
    const group = uid();
    els = els.map((e) => ({ ...e, group }) as El);
    store.addEls(els);
    store.setTool({ tool: 'select' });
    store.select(els.map((e) => e.id));
    closePanel('graph');
    toast('Graph added — tap it anywhere to move or resize it');
  });

  renderList();
  syncSliders();
  // Fonts first, so labels are measured with the right typeface.
  void document.fonts?.load('700 16px "Orbitron"').then(() => document.fonts.load('700 16px "Exo 2"')).finally(redraw);
  redraw();
}
