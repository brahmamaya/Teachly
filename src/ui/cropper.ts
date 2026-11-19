import type { Board } from '../board';
import { store } from '../store';
import type { El, ImageEl } from '../types';
import { icon } from './icons';
import { fadeOut } from './panel';

// Crop a picture. The whole picture is shown with a frame on it; the frame's edges and corners (or the frame itself)
// are dragged to keep just the part wanted. Nothing is thrown away: the picture keeps all of its pixels and only a
// window onto it is stored (`crop`), so the crop can be changed again later ("Reset" shows it whole). Works for
// rotated pictures too, and for finger, pen and mouse.

const MIN = 24; // the smallest piece that can be kept (board units)
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move';

export function openCrop(host: HTMLElement, board: Board, el: ImageEl): void {
  if (host.querySelector('.crop-ui')) return;
  const c0 = el.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  // The whole picture, in board units, and where the kept part sits inside it.
  const fullW = el.w / c0.w, fullH = el.h / c0.h;
  const a = c0.x * fullW, b = c0.y * fullH;
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const cos = Math.cos(el.rot), sin = Math.sin(el.rot);
  /** A point of the whole picture -> the board. */
  const toBoard = (fx: number, fy: number): [number, number] => {
    const lx = fx - a - el.w / 2, ly = fy - b - el.h / 2;
    return [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];
  };
  /** The board -> a point of the whole picture. */
  const toFull = (wx: number, wy: number): [number, number] => {
    const dx = wx - cx, dy = wy - cy;
    return [dx * cos + dy * sin + el.w / 2 + a, -dx * sin + dy * cos + el.h / 2 + b];
  };
  const r = { x0: a, y0: b, x1: a + el.w, y1: b + el.h };

  const ui = document.createElement('div');
  ui.className = 'crop-ui';
  ui.setAttribute('role', 'dialog');
  ui.setAttribute('aria-label', 'Crop the picture');
  ui.innerHTML = `
    <div class="crop-pic"><img alt="" draggable="false"><div class="crop-box" data-e="move">
      ${(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => `<i class="crop-h" data-e="${h}"></i>`).join('')}
      <b class="crop-grid" aria-hidden="true"></b>
    </div></div>
    <div class="crop-bar">
      <button type="button" class="crop-btn" data-c="cancel">${icon('close', 20)}<span>Cancel</span></button>
      <button type="button" class="crop-btn" data-c="reset">${icon('undo', 20)}<span>Whole picture</span></button>
      <button type="button" class="crop-btn go" data-c="done">${icon('check', 20)}<span>Done</span></button>
    </div>`;
  host.appendChild(ui);
  const pic = ui.querySelector('.crop-pic') as HTMLElement;
  const img = pic.querySelector('img') as HTMLImageElement;
  const box = pic.querySelector('.crop-box') as HTMLElement;
  img.src = el.src;

  const layout = () => {
    const z = board.cam.z;
    const rect = board.el.getBoundingClientRect();
    const [wx, wy] = toBoard(0, 0);
    const [sx, sy] = board.toScreen(wx, wy);
    pic.style.left = `${rect.left + sx}px`;
    pic.style.top = `${rect.top + sy}px`;
    pic.style.width = `${fullW * z}px`;
    pic.style.height = `${fullH * z}px`;
    pic.style.transform = `rotate(${el.rot}rad)`;
    box.style.left = `${r.x0 * z}px`;
    box.style.top = `${r.y0 * z}px`;
    box.style.width = `${(r.x1 - r.x0) * z}px`;
    box.style.height = `${(r.y1 - r.y0) * z}px`;
  };
  layout();

  // ---- dragging
  let drag: { e: Edge; id: number; p: [number, number]; r: typeof r } | null = null;
  const point = (ev: PointerEvent): [number, number] => {
    const rect = board.el.getBoundingClientRect();
    const [wx, wy] = board.toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
    return toFull(wx, wy);
  };
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  pic.addEventListener('pointerdown', (ev) => {
    const t = (ev.target as HTMLElement).closest('[data-e]') as HTMLElement | null;
    if (!t) return;
    ev.preventDefault();
    pic.setPointerCapture(ev.pointerId);
    drag = { e: t.dataset.e as Edge, id: ev.pointerId, p: point(ev), r: { ...r } };
  });
  pic.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const [px, py] = point(ev);
    const dx = px - drag.p[0], dy = py - drag.p[1];
    const s = drag.r, e = drag.e;
    if (e === 'move') {
      const w = s.x1 - s.x0, h = s.y1 - s.y0;
      r.x0 = clamp(s.x0 + dx, 0, fullW - w);
      r.y0 = clamp(s.y0 + dy, 0, fullH - h);
      r.x1 = r.x0 + w;
      r.y1 = r.y0 + h;
    } else {
      if (e.includes('w')) r.x0 = clamp(s.x0 + dx, 0, s.x1 - MIN);
      if (e.includes('e')) r.x1 = clamp(s.x1 + dx, s.x0 + MIN, fullW);
      if (e.includes('n')) r.y0 = clamp(s.y0 + dy, 0, s.y1 - MIN);
      if (e.includes('s')) r.y1 = clamp(s.y1 + dy, s.y0 + MIN, fullH);
    }
    layout();
  });
  const end = (ev: PointerEvent) => {
    if (drag && ev.pointerId === drag.id) drag = null;
  };
  pic.addEventListener('pointerup', end);
  pic.addEventListener('pointercancel', end);

  // ---- buttons
  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', layout);
    fadeOut(ui, 160);
  };
  const done = () => {
    const nw = r.x1 - r.x0, nh = r.y1 - r.y0;
    const whole = r.x0 < 0.5 && r.y0 < 0.5 && r.x1 > fullW - 0.5 && r.y1 > fullH - 0.5;
    const [mx, my] = toBoard((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
    const same = Math.abs(nw - el.w) < 0.5 && Math.abs(nh - el.h) < 0.5 && Math.abs(r.x0 - a) < 0.5 && Math.abs(r.y0 - b) < 0.5;
    if (!same) {
      store.mapEls(new Set([el.id]), (e: El) => {
        if (e.type !== 'image') return e;
        const next: ImageEl = { ...e, x: mx - nw / 2, y: my - nh / 2, w: nw, h: nh };
        if (whole) delete next.crop;
        else next.crop = { x: r.x0 / fullW, y: r.y0 / fullH, w: nw / fullW, h: nh / fullH };
        return next;
      });
    }
    close();
  };
  ui.addEventListener('click', (ev) => {
    const c = (ev.target as HTMLElement).closest('[data-c]') as HTMLElement | null;
    if (!c) return;
    if (c.dataset.c === 'cancel') close();
    else if (c.dataset.c === 'done') done();
    else {
      r.x0 = 0;
      r.y0 = 0;
      r.x1 = fullW;
      r.y1 = fullH;
      layout();
    }
  });
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      close();
    } else if (ev.key === 'Enter') {
      ev.stopPropagation();
      done();
    }
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', layout);
}
