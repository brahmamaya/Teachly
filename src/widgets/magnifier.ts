import type { Board } from '../board';
import { icon } from '../ui/icons';
import { makeDraggable } from '../ui/panel';

// Magnifier: a round lens you drag over the board to show the class small
// details bigger. It reads the board layers directly, so it is always live.

let lens: { el: HTMLElement; raf: number } | null = null;

export function toggleMagnifier(host: HTMLElement, board: Board): void {
  if (lens) {
    cancelAnimationFrame(lens.raf);
    lens.el.remove();
    lens = null;
    return;
  }
  const size = Math.round(Math.min(360, Math.max(220, Math.min(window.innerWidth, window.innerHeight) * 0.32)));
  let zoom = 2;
  const el = document.createElement('div');
  el.className = 'magnifier';
  el.style.left = `${window.innerWidth / 2 - size / 2}px`;
  el.style.top = `${window.innerHeight / 2 - size / 2 - 40}px`;
  el.innerHTML = `<canvas class="mag-lens" style="width:${size}px;height:${size}px"></canvas>
    <div class="mag-bar"><button class="icon-btn" data-z="-1" aria-label="Less zoom">−</button><b data-zl>2×</b><button class="icon-btn" data-z="1" aria-label="More zoom">+</button><button class="icon-btn" data-close aria-label="Close magnifier">${icon('close', 16)}</button></div>`;
  host.appendChild(el);
  makeDraggable(el, el.querySelector('.mag-lens') as HTMLElement);
  const cv = el.querySelector('canvas') as HTMLCanvasElement;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.height = Math.round(size * dpr);
  const ctx = cv.getContext('2d')!;
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.close !== undefined) return toggleMagnifier(host, board);
    zoom = Math.max(1.5, Math.min(5, zoom + Number(b.dataset.z) * 0.5));
    (el.querySelector('[data-zl]') as HTMLElement).textContent = `${zoom}×`;
  });
  const draw = () => {
    const br = board.el.getBoundingClientRect();
    const lr = cv.getBoundingClientRect();
    const d = board.dpr;
    // Lens centre in board-canvas pixels, and the source square it shows.
    const cx = (lr.left + lr.width / 2 - br.left) * d, cy = (lr.top + lr.height / 2 - br.top) * d;
    const half = (size / 2 / zoom) * d;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const layer of [board.bg, board.ink, board.overlay]) ctx.drawImage(layer, cx - half, cy - half, half * 2, half * 2, 0, 0, cv.width, cv.height);
    lens!.raf = requestAnimationFrame(draw);
  };
  lens = { el, raf: requestAnimationFrame(draw) };
}
