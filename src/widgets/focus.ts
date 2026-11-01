import { icon } from '../ui/icons';

// Presentation focus tools: spotlight and screen cover (curtain).

let spotlight: HTMLElement | null = null;

export function toggleSpotlight(host: HTMLElement): void {
  if (spotlight) {
    spotlight.remove();
    spotlight = null;
    return;
  }
  const el = document.createElement('div');
  el.className = 'spotlight';
  el.innerHTML = `<canvas></canvas><div class="focus-bar"><button class="chip" data-s="circle">● Circle</button><button class="chip" data-s="rect">■ Rectangle</button><input type="range" min="0.4" max="0.97" step="0.01" value="0.86" title="Darkness"><button class="icon-btn small" data-a="close" title="Close">${icon('close', 18)}</button></div>`;
  host.appendChild(el);
  spotlight = el;
  const c = el.querySelector('canvas')!;
  const ctx = c.getContext('2d')!;
  const range = el.querySelector('input') as HTMLInputElement;
  let shape: 'circle' | 'rect' = 'circle';
  let cx = window.innerWidth / 2, cy = window.innerHeight / 2, r = Math.min(window.innerWidth, window.innerHeight) * 0.18;
  let rw = r * 2.4, rh = r * 1.4;
  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth, h = el.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(2,6,23,${range.value})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(cx, cy, r, 0, Math.PI * 2);
    else ctx.roundRect(cx - rw / 2, cy - rh / 2, rw, rh, 16);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Resize handle
    const hx = shape === 'circle' ? cx + r * Math.SQRT1_2 : cx + rw / 2;
    const hy = shape === 'circle' ? cy + r * Math.SQRT1_2 : cy + rh / 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    return [hx, hy];
  };
  let handle = draw();
  range.addEventListener('input', () => (handle = draw()));
  window.addEventListener('resize', () => spotlight === el && (handle = draw()));
  el.querySelector('.focus-bar')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.a === 'close') toggleSpotlight(host);
    if (b.dataset.s) {
      shape = b.dataset.s as 'circle' | 'rect';
      handle = draw();
    }
  });
  let drag: { mode: 'move' | 'size'; ox: number; oy: number } | null = null;
  c.style.touchAction = 'none';
  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId);
    if (Math.hypot(e.clientX - handle[0], e.clientY - handle[1]) < 28) drag = { mode: 'size', ox: 0, oy: 0 };
    else {
      // Clicking outside the hole jumps the spot there.
      const inside = shape === 'circle' ? Math.hypot(e.clientX - cx, e.clientY - cy) < r : Math.abs(e.clientX - cx) < rw / 2 && Math.abs(e.clientY - cy) < rh / 2;
      if (!inside) {
        cx = e.clientX;
        cy = e.clientY;
      }
      drag = { mode: 'move', ox: e.clientX - cx, oy: e.clientY - cy };
    }
    handle = draw();
  });
  c.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.mode === 'move') {
      cx = e.clientX - drag.ox;
      cy = e.clientY - drag.oy;
    } else if (shape === 'circle') r = Math.max(30, Math.hypot(e.clientX - cx, e.clientY - cy));
    else {
      rw = Math.max(60, Math.abs(e.clientX - cx) * 2);
      rh = Math.max(40, Math.abs(e.clientY - cy) * 2);
    }
    handle = draw();
  });
  c.addEventListener('pointerup', () => (drag = null));
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * 0.002);
    r = Math.max(30, r * k);
    rw = Math.max(60, rw * k);
    rh = Math.max(40, rh * k);
    handle = draw();
  });
}

let curtain: HTMLElement | null = null;

/** Screen cover: an opaque shade the teacher drags to reveal content gradually. */
export function toggleCurtain(host: HTMLElement): void {
  if (curtain) {
    curtain.remove();
    curtain = null;
    return;
  }
  const el = document.createElement('div');
  el.className = 'curtain';
  el.dataset.side = 'top';
  el.innerHTML = `<div class="curtain-shade"><div class="curtain-grip" title="Drag to reveal"><span></span></div>
    <div class="focus-bar curtain-bar"><button class="chip" data-side="top">↓ Top</button><button class="chip" data-side="bottom">↑ Bottom</button><button class="chip" data-side="left">→ Left</button><button class="chip" data-side="right">← Right</button><button class="icon-btn small" data-a="close" title="Close">${icon('close', 18)}</button></div></div>`;
  host.appendChild(el);
  curtain = el;
  const shade = el.querySelector('.curtain-shade') as HTMLElement;
  const grip = el.querySelector('.curtain-grip') as HTMLElement;
  let frac = 0.7;
  const apply = () => {
    const side = el.dataset.side!;
    const vertical = side === 'top' || side === 'bottom';
    shade.style.inset = '';
    shade.style.width = vertical ? '100%' : `${frac * 100}%`;
    shade.style.height = vertical ? `${frac * 100}%` : '100%';
    shade.style.top = side === 'bottom' ? 'auto' : '0';
    shade.style.bottom = side === 'bottom' ? '0' : 'auto';
    shade.style.left = side === 'right' ? 'auto' : '0';
    shade.style.right = side === 'right' ? '0' : 'auto';
  };
  apply();
  el.querySelector('.curtain-bar')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.a === 'close') toggleCurtain(host);
    if (b.dataset.side) {
      el.dataset.side = b.dataset.side;
      apply();
    }
  });
  grip.style.touchAction = 'none';
  grip.addEventListener('pointerdown', (e) => {
    grip.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const side = el.dataset.side!;
      const W = el.clientWidth, H = el.clientHeight;
      const r = el.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      frac = side === 'top' ? y / H : side === 'bottom' ? 1 - y / H : side === 'left' ? x / W : 1 - x / W;
      frac = Math.max(0.04, Math.min(1, frac));
      apply();
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });
}
