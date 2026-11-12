import { icon } from './icons';
import { fadeOut } from './panel';

// "Download": which pages to put in the PDF. Three choices (the page you
// are on, all pages, or a range) and two wheels, From and To: the number in
// the middle is bigger and clear, the ones above and below get smaller and
// fainter. Scrolling a wheel picks the range.

export interface PageRange {
  from: number;
  to: number;
}

interface Wheel {
  set(value: number, smooth?: boolean): void;
}

/** One scrolling wheel of the numbers 1..count; calls `onPick` when the middle number changes. */
function makeWheel(root: HTMLElement, count: number, start: number, onPick: (v: number) => void): Wheel {
  root.innerHTML = Array.from({ length: count }, (_, i) => `<button type="button" class="wh-i" data-v="${i + 1}" tabindex="-1">${i + 1}</button>`).join('');
  const items = [...root.children] as HTMLElement[];
  let cur = -1;
  let raf = 0;
  /** A value the program is scrolling to (those scroll steps are not the user's choice). */
  let target = 0;
  let release = 0;
  const rowH = () => items[0]?.offsetHeight || 46;
  const paint = (idx: number) => {
    // Only the few numbers near the middle are styled; the rest stay faint.
    for (let k = Math.max(0, cur - 4); k <= Math.min(count - 1, cur + 4); k++) items[k].removeAttribute('data-d');
    cur = idx;
    for (let k = Math.max(0, idx - 4); k <= Math.min(count - 1, idx + 4); k++) items[k].dataset.d = String(Math.abs(k - idx));
  };
  const read = () => {
    raf = 0;
    const idx = Math.max(0, Math.min(count - 1, Math.round(root.scrollTop / rowH())));
    if (idx === cur) return;
    paint(idx);
    if (target) {
      if (idx + 1 === target) target = 0;
      return;
    }
    onPick(idx + 1);
  };
  root.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(read);
  });
  root.addEventListener('click', (e) => {
    const it = (e.target as HTMLElement).closest('.wh-i') as HTMLElement | null;
    if (it) root.scrollTo({ top: (Number(it.dataset.v) - 1) * rowH(), behavior: 'smooth' });
  });
  const set = (v: number, smooth = true) => {
    const val = Math.max(1, Math.min(count, v));
    const top = (val - 1) * rowH();
    if (!smooth) {
      paint(val - 1);
      root.scrollTop = top;
      return;
    }
    if (val - 1 === cur) return;
    // A long way: jump (a slow glide through a hundred numbers would look like the user scrolling).
    if (Math.abs(val - 1 - cur) > 10) {
      paint(val - 1);
      root.scrollTop = top;
      return;
    }
    target = val;
    clearTimeout(release);
    release = window.setTimeout(() => (target = 0), 900);
    root.scrollTo({ top, behavior: 'smooth' });
  };
  // After the box is on screen the rows have a height: put the wheel on its start value.
  requestAnimationFrame(() => set(start, false));
  return { set };
}

/**
 * Ask for the pages of a notebook to download. `current` is the page the
 * notebook is on (0 = not open: no "Current page" choice). Resolves with
 * the range (1-based, from <= to) or null if cancelled.
 */
export function askPdfRange(host: HTMLElement, o: { total: number; current: number; title: string }): Promise<PageRange | null> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'sv-back dl-back';
    const rows = [...(o.current ? [['cur', 'Current page']] : []), ['all', 'All pages'], ['range', '']];
    back.innerHTML = `
      <div class="dl-box" role="dialog" aria-label="Download as PDF">
        <header class="dl-head">
          <button type="button" class="dl-back-btn" data-d="cancel" aria-label="Back">${icon('prev', 22)}</button>
          <h3>Download PDF</h3>
          <span class="dl-sp"></span>
        </header>
        <p class="dl-note"></p>
        <div class="dl-rows">${rows.map(([k, l]) => `<button type="button" class="dl-row" data-m="${k}"><span data-l>${l}</span><i>${icon('check', 20)}</i></button>`).join('')}</div>
        <div class="dl-pick" aria-label="Choose the pages">
          <div class="wh-col"><div class="wh" data-w="from" role="listbox" aria-label="From page"></div></div>
          <span class="dl-to">To</span>
          <div class="wh-col"><div class="wh" data-w="to" role="listbox" aria-label="To page"></div></div>
        </div>
        <button type="button" class="dl-go" data-d="go">${icon('download', 20)}<span>Download</span></button>
      </div>`;
    host.appendChild(back);
    const box = back.querySelector('.dl-box') as HTMLElement;
    const note = box.querySelector('.dl-note') as HTMLElement;
    let from = 1, to = o.total;
    let mode = 'all';

    const label = () => (from === to ? `Page ${from}` : `Pages ${from} - ${to}`);
    const paint = () => {
      box.querySelectorAll<HTMLElement>('.dl-row').forEach((r) => r.classList.toggle('on', r.dataset.m === mode));
      (box.querySelector('[data-m=range] [data-l]') as HTMLElement).textContent = label();
      note.textContent = `${o.title} · ${to - from + 1} of ${o.total} page${o.total === 1 ? '' : 's'} as one PDF`;
    };
    const done = (v: PageRange | null) => {
      fadeOut(back, 180);
      resolve(v);
    };

    const wFrom = makeWheel(box.querySelector('[data-w=from]') as HTMLElement, o.total, from, (v) => {
      from = v;
      if (to < from) {
        to = from;
        wTo.set(to);
      }
      mode = 'range';
      paint();
    });
    const wTo = makeWheel(box.querySelector('[data-w=to]') as HTMLElement, o.total, to, (v) => {
      to = v;
      if (from > to) {
        from = to;
        wFrom.set(from);
      }
      mode = 'range';
      paint();
    });
    paint();

    box.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const row = t.closest('.dl-row') as HTMLElement | null;
      if (row) {
        mode = row.dataset.m ?? 'all';
        if (mode === 'all') [from, to] = [1, o.total];
        else if (mode === 'cur') [from, to] = [o.current, o.current];
        if (mode !== 'range') {
          wFrom.set(from);
          wTo.set(to);
        }
        return paint();
      }
      const d = (t.closest('[data-d]') as HTMLElement | null)?.dataset.d;
      if (d === 'cancel') done(null);
      else if (d === 'go') done({ from, to });
    });
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) done(null);
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') done(null);
    });
  });
}
