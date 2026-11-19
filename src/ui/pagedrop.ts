// Dragging selected things onto a page thumbnail of the open Pages panel (pointer events, so touch,
// stylus and mouse all work). While dragging: the thumbnail under the finger lights up, a small
// badge shows how many things are carried, and the list scrolls by itself near its top / bottom edge.

let hot: HTMLElement | null = null;
let badge: HTMLElement | null = null;
let list: HTMLElement | null = null;
let vy = 0;
let raf = 0;
let carried = 0;
let tracking = false;

/** Window-level pointer follower: keeps working even if the board stops getting move events (pen, iPad). */
const follow = (e: PointerEvent): void => dragOver(e.clientX, e.clientY, carried);

function pump(): void {
  if (!list || !vy) return void (raf = 0);
  list.scrollTop += vy;
  raf = requestAnimationFrame(pump);
}

/** Is the Pages panel open (so there is somewhere to drop)? */
export const dropAvailable = (): boolean => !!document.querySelector('.pages-list');

/** Pointer at (x, y) in the window while carrying `count` things. */
export function dragOver(x: number, y: number, count: number): void {
  carried = count;
  if (!tracking) {
    tracking = true;
    window.addEventListener('pointermove', follow, true);
  }
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
  let el = inside ? (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.page-thumb') ?? null : null;
  // Between two thumbnails, or just beside one: the nearest page up or down (forgiving for a pen or a big finger).
  if (!el && inside) {
    let best = 48;
    for (const t of list.querySelectorAll<HTMLElement>('.page-thumb')) {
      const b = t.getBoundingClientRect();
      const d = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
      if (d < best) {
        best = d;
        el = t;
      }
    }
  }
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
  window.removeEventListener('pointermove', follow, true);
  tracking = false;
  carried = 0;
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
export function dragEnd(x?: number, y?: number): number {
  if (x !== undefined && y !== undefined && carried) dragOver(x, y, carried); // where it really ended
  const i = hot ? Number(hot.dataset.i) : -1;
  clear();
  return i;
}

export const dragCancel = clear;
