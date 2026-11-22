import { icon } from './icons';
import { scaleFloating, ui } from './scale';

export interface PanelOpts {
  id: string;
  title: string;
  iconName?: string;
  width?: number;
  x?: number;
  y?: number;
  onClose?: () => void;
  className?: string;
  /** Drag the panel by touching it anywhere (buttons still work with a tap); for small widgets with no scrolling. */
  dragAnywhere?: boolean;
}

/** The part of the screen not covered by the toolbars (a panel's title must never hide under them). */
function room(): { top: number; bottom: number } {
  let top = 8, bottom = window.innerHeight - 8;
  for (const b of document.querySelectorAll<HTMLElement>('.toolbars .toolbar')) {
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.top < window.innerHeight / 2) top = Math.max(top, r.bottom + 8);
    else bottom = Math.min(bottom, r.top - 8);
  }
  return { top, bottom };
}

const open = new Map<string, HTMLElement>();
let zTop = 50;

/** Next z-index for a panel; renumbers panels so they always stay below the toolbar. */
function nextZ(): number {
  if (zTop > 3000) {
    zTop = 50;
    for (const p of [...open.values()].sort((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex))) p.style.zIndex = String(nextZ());
  }
  return ++zTop;
}

/** Create (or focus) a floating, draggable widget panel. Returns body element or null if it was toggled closed. */
export function floatingPanel(host: HTMLElement, opts: PanelOpts, toggle = true): HTMLElement | null {
  const existing = open.get(opts.id);
  if (existing) {
    if (toggle) {
      closePanel(opts.id);
      return null;
    }
    existing.style.zIndex = String(nextZ());
    return existing.querySelector('.panel-body') as HTMLElement;
  }
  const el = document.createElement('section');
  el.className = `panel ${opts.className ?? ''}`;
  el.style.width = opts.width ? `${opts.width}px` : '';
  el.style.zIndex = String(nextZ());
  el.innerHTML = `<header class="panel-head">${opts.iconName ? icon(opts.iconName, 18) : ''}<span>${opts.title}</span><button class="icon-btn small" title="Close">${icon('close', 18)}</button></header><div class="panel-body"></div>`;
  host.appendChild(el);
  const n = open.size;
  // Position once the caller has filled the body, so the real size is known.
  el.style.visibility = 'hidden';
  requestAnimationFrame(() => {
    scaleFloating(el);
    const W = el.offsetWidth * ui(), H = el.offsetHeight * ui();
    // Keep clear of the bottom toolbar where possible.
    const x = opts.x ?? Math.max(12, Math.min(window.innerWidth - W - 12, window.innerWidth / 2 - W / 2 + n * 28));
    // Below a toolbar at the top and above one at the bottom; a panel taller than that room starts just below the top bar.
    const rm = room();
    const y = opts.y ?? Math.max(rm.top, Math.min(rm.bottom - H, rm.top + 16 + n * 28));
    el.style.left = `${Math.max(0, x)}px`;
    el.style.top = `${y}px`;
    el.style.visibility = '';
  });
  open.set(opts.id, el);
  (el as HTMLElement & { _onClose?: () => void })._onClose = opts.onClose;

  el.querySelector('.panel-head button')!.addEventListener('click', () => closePanel(opts.id));
  el.addEventListener('pointerdown', () => (el.style.zIndex = String(nextZ())));
  makeDraggable(el, opts.dragAnywhere ? el : (el.querySelector('.panel-head') as HTMLElement));
  return el.querySelector('.panel-body') as HTMLElement;
}

export function closePanel(id: string): void {
  const el = open.get(id) as (HTMLElement & { _onClose?: () => void }) | undefined;
  if (!el) return;
  open.delete(id);
  el._onClose?.();
  el.remove();
}

export function isPanelOpen(id: string): boolean {
  return open.has(id);
}

/**
 * Move `el` by dragging `handle`. A drag starts only after the finger has moved a little, so a tap on a button inside
 * the handle still presses that button (and the tap that ended a drag never presses one). Text boxes and sliders keep
 * their own touch. The title can never be dragged under a toolbar at the top.
 */
export function makeDraggable(el: HTMLElement, handle: HTMLElement): void {
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input,select,textarea')) return;
    const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop, x0 = e.clientX, y0 = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
        dragging = true;
        handle.setPointerCapture(ev.pointerId);
        el.classList.add('dragging');
      }
      const top = room().top;
      el.style.left = `${Math.max(-el.offsetWidth + 60, Math.min(window.innerWidth - 60, ev.clientX - sx))}px`;
      el.style.top = `${Math.max(top, Math.min(window.innerHeight - 40, ev.clientY - sy))}px`;
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      if (!dragging) return;
      el.classList.remove('dragging');
      // the click that follows a drag must not press the button the drag started on
      const stop = (ce: Event) => {
        ce.stopPropagation();
        ce.preventDefault();
      };
      el.addEventListener('click', stop, { capture: true, once: true });
      window.setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 0);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

/** Simple toast message. */
/**
 * Close something smoothly: a short fade, then it is removed. It stops
 * taking taps at once, so the next thing can open straight away.
 */
export function fadeOut(el: Element, ms = 150): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return el.remove();
  el.classList.add('leaving');
  window.setTimeout(() => el.remove(), ms);
}

export function toast(msg: string, ms = 2200): void {
  let host = document.querySelector('.toasts') as HTMLElement | null;
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    document.body.appendChild(host);
  }
  // Only the newest message is shown, so they never pile up.
  host.replaceChildren();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

/** Tiny beep using WebAudio (timer alarms, picker). */
let audio: AudioContext | null = null;
export function beep(freq = 880, ms = 180, times = 1): void {
  try {
    // One shared audio context (Safari allows only a few).
    audio ??= new AudioContext();
    const ac = audio;
    if (ac.state === 'suspended') void ac.resume();
    for (let i = 0; i < times; i++) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = freq;
      o.type = 'sine';
      o.connect(g);
      g.connect(ac.destination);
      const t0 = ac.currentTime + i * (ms / 1000 + 0.12);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      o.start(t0);
      o.stop(t0 + ms / 1000 + 0.05);
    }
  } catch {
    /* audio unavailable */
  }
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
