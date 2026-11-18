// Dragging selected things onto a page thumbnail of the open Pages panel (pointer events, so touch,
// stylus and mouse all work). While dragging: the thumbnail under the finger lights up, a small
// badge shows how many things are carried, and the list scrolls by itself near its top / bottom edge.

let hot: HTMLElement | null = null;
let badge: HTMLElement | null = null;
let list: HTMLElement | null = null;
let vy = 0;
let raf = 0;

function pump(): void {
  if (!list || !vy) return void (raf = 0);
  list.scrollTop += vy;
  raf = requestAnimationFrame(pump);
}

/** Is the Pages panel open (so there is somewhere to drop)? */
export const dropAvailable = (): boolean => !!document.querySelector('.pages-list');

/** Pointer at (x, y) in the window while carrying `count` things. */
export function dragOver(x: number, y: number, count: number): void {
  list = document.querySelector('.pages-list');
  if (!list) return;
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'drop-badge';
    document.body.appendChild(badge);
  }
  badge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  badge.style.transform = `translate(${x + 18}px, ${y + 18}px)`;
  const r = list.getBoundingClientRect();
  const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  const el = inside ? (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.page-thumb') ?? null : null;
  if (el !== hot) {
    hot?.classList.remove('drop-on');
    hot = el;
    hot?.classList.add('drop-on');
  }
  badge.classList.toggle('over', !!hot);
  // Near the edge of the list: scroll it (faster closer to the edge).
  const edge = 64;
  vy = inside ? (y < r.top + edge ? -Math.ceil(((r.top + edge - y) / edge) * 14) : y > r.bottom - edge ? Math.ceil(((y - (r.bottom - edge)) / edge) * 14) : 0) : 0;
  if (vy && !raf) raf = requestAnimationFrame(pump);
}

function clear(): void {
  hot?.classList.remove('drop-on');
  hot = null;
  badge?.remove();
  badge = null;
  vy = 0;
  cancelAnimationFrame(raf);
  raf = 0;
  list = null;
}

/** The drag ended: the page number (0-based) it was dropped on, or -1 (dropped elsewhere / cancelled). */
export function dragEnd(): number {
  const i = hot ? Number(hot.dataset.i) : -1;
  clear();
  return i;
}

export const dragCancel = clear;
