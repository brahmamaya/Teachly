import { uid } from '../geometry';
import { store } from '../store';
import type { Page } from '../types';
import { icon } from './icons';
import { lazyThumbs } from './pagegrid';
import { fadeOut, toast } from './panel';

// Pages (side panel): every page as a thumbnail in a vertical list.
// Tap a page to open it; the buttons below act on the open page. The
// "Expand" tab on its edge opens the full-screen page grid (pagegrid.ts).

/** Drag data type for a page dragged out of the page sorter. */
export const PAGE_DRAG = 'application/x-teachly-page';

let copied: Page | null = null;

export class PagesPanel {
  private el: HTMLElement | null = null;
  private unsub: (() => void) | null = null;
  private stopThumbs: (() => void) | null = null;

  constructor(
    private host: HTMLElement,
    private onToggle: () => void = () => {},
    private onExpand: () => void = () => {},
    /** A page was dragged out of the panel and let go over the board at (x, y): copy its content there. */
    private onDropPage: (i: number, x: number, y: number) => void = () => {},
  ) {}

  get open(): boolean {
    return !!this.el;
  }

  toggle(): void {
    if (this.el) this.close();
    else this.show();
  }

  close(): void {
    if (!this.el) return;
    fadeOut(this.el, 240);
    this.el = null;
    this.stopThumbs?.();
    this.stopThumbs = null;
    this.unsub?.();
    this.unsub = null;
    this.onToggle();
  }

  private show(): void {
    const el = document.createElement('aside');
    el.className = 'pages-panel';
    el.setAttribute('aria-label', 'All pages');
    this.host.appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => this.onClick(e));
    this.wireSort(el);
    // Drag a page onto the board: it carries the page itself (sharp, editable
    // lines), not the small preview picture.
    el.addEventListener('dragstart', (e) => {
      const t = (e.target as HTMLElement).closest('.page-thumb') as HTMLElement | null;
      if (!t || !e.dataTransfer) return;
      e.dataTransfer.clearData();
      e.dataTransfer.setData(PAGE_DRAG, t.dataset.i ?? '');
      e.dataTransfer.effectAllowed = 'copy';
    });
    const offDoc = store.on('doc', () => this.render());
    const offPage = store.on('page', () => this.render());
    this.unsub = () => {
      offDoc();
      offPage();
    };
    this.render();
    this.onToggle();
  }

  private render(): void {
    const el = this.el;
    if (!el) return;
    const pages = store.doc.pages;
    const i = store.index;
    const list = el.querySelector('.pages-list');
    const scroll = list?.scrollTop ?? 0;
    el.innerHTML = `
      <button class="pages-expand" data-pg="expand" title="Show all pages full screen" aria-label="Expand: show all pages full screen">${icon('expand', 18)}<span>Expand</span></button>
      <header class="pages-head"><b>Pages</b><span>${pages.length}</span><button class="icon-btn small" data-pg="close" aria-label="Close">${icon('close', 20)}</button></header>
      <div class="pages-list">${pages
        .map(
          (_p, k) => `<button class="page-thumb ${k === i ? 'on' : ''}" data-pg="go" data-i="${k}" aria-label="Page ${k + 1}">
            <img alt="" draggable="false"><span>${k + 1}</span></button>`,
        )
        .join('')}</div>
      <div class="pages-actions">
        <button data-pg="up" ${i === 0 ? 'disabled' : ''}>${icon('up', 20)}<span>Up</span></button>
        <button data-pg="down" ${i === pages.length - 1 ? 'disabled' : ''}>${icon('down', 20)}<span>Down</span></button>
        <button data-pg="copy">${icon('copy', 20)}<span>Copy</span></button>
        <button data-pg="paste" ${copied ? '' : 'disabled'}>${icon('paste', 20)}<span>Paste</span></button>
        <button data-pg="delete" class="danger">${icon('trash', 20)}<span>Delete</span></button>
      </div>
      <button class="btn primary wide" data-pg="add">${icon('plus', 20)} New page</button>`;
    const newList = el.querySelector('.pages-list') as HTMLElement;
    newList.scrollTop = scroll;
    this.stopThumbs?.();
    this.stopThumbs = lazyThumbs(newList, '.page-thumb', (c) => store.doc.pages[Number(c.dataset.i)]);
    // Keep the open page in view.
    (newList.querySelector('.page-thumb.on') as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }

  /** A drag just ended: the click that follows it must not open a page. */
  private sortedAt = 0;

  /**
   * Hold a page (touch: a short press; mouse: just drag it) and move it up or down the list: it lifts and follows
   * the finger, the other pages slide aside to make room, the list scrolls by itself near its edges, and on release
   * the page glides into its new place (one undo step). Instant on classroom boards and with reduced motion.
   */
  private wireSort(panel: HTMLElement): void {
    const smooth = !document.documentElement.classList.contains('lite') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    type Drag = { list: HTMLElement; items: HTMLElement[]; from: number; to: number; tops: number[]; h: number; step: number; grab: number; grabX: number; s0: number; ghost: HTMLElement; x: number; y: number; out: boolean; raf: number };
    let d: Drag | null = null;
    let press = 0, sx = 0, sy = 0, cand: HTMLElement | null = null, pid = -1;
    const listOf = () => panel.querySelector('.pages-list') as HTMLElement;
    const begin = (t: HTMLElement, y: number, x = sx) => {
      const list = listOf();
      const items = [...list.querySelectorAll<HTMLElement>('.page-thumb')];
      const from = items.indexOf(t);
      if (from < 0 || items.length < 2) return;
      const lr = list.getBoundingClientRect();
      const rects = items.map((x) => x.getBoundingClientRect());
      const tops = rects.map((r) => r.top - lr.top + list.scrollTop);
      const r = rects[from];
      const ghost = t.cloneNode(true) as HTMLElement;
      ghost.className = 'page-thumb page-ghost';
      Object.assign(ghost.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0' });
      document.body.appendChild(ghost);
      t.classList.add('sort-hole');
      list.classList.add('sorting');
      try {
        list.setPointerCapture(pid);
      } catch {
        /* the pointer is gone */
      }
      navigator.vibrate?.(8);
      d = { list, items, from, to: from, tops, h: r.height, step: items.length > 1 ? tops[1] - tops[0] : r.height, grab: y - r.top, grabX: x - r.left, s0: list.scrollTop, ghost, x, y, out: false, raf: 0 };
      requestAnimationFrame(() => ghost.classList.add('up'));
      edge();
    };
    const place = () => {
      if (!d) return;
      const { list, items, from, tops, h, step, grab, ghost } = d;
      const lr = list.getBoundingClientRect();
      // Out of the panel, over the board: the page follows the finger freely, smaller, to be dropped on the open page.
      const out = d.x < panel.getBoundingClientRect().left - 4;
      if (out !== d.out) {
        d.out = out;
        ghost.classList.toggle('out', out);
      }
      if (out) {
        ghost.style.transform = `translate(${d.x - d.grabX - parseFloat(ghost.style.left)}px, ${d.y - grab - parseFloat(ghost.style.top)}px)`;
        if (d.to !== from) {
          d.to = from;
          items.forEach((it) => (it.style.transform = ''));
        }
        return;
      }
      ghost.style.transform = `translateY(${d.y - grab - parseFloat(ghost.style.top)}px)`;
      // the dragged page's centre, in list coordinates: count the pages whose centre is above it
      const c = d.y - grab - lr.top + list.scrollTop + h / 2;
      let to = 0;
      for (let k = 0; k < tops.length; k++) if (k !== from && tops[k] + h / 2 < c) to++;
      if (to !== d.to) {
        d.to = to;
        items.forEach((it, k) => {
          const sh = from < to && k > from && k <= to ? -step : to < from && k >= to && k < from ? step : 0;
          it.style.transform = sh ? `translateY(${sh}px)` : '';
        });
      }
    };
    // near the top or bottom of the list it scrolls by itself, faster the closer the finger is
    const edge = () => {
      if (!d) return;
      const lr = d.list.getBoundingClientRect();
      const zone = Math.min(52, lr.height / 5);
      const v = d.out ? 0 : d.y < lr.top + zone ? -(lr.top + zone - d.y) / zone : d.y > lr.bottom - zone ? (d.y - (lr.bottom - zone)) / zone : 0;
      if (v) {
        d.list.scrollTop += v * 14;
        place();
      }
      d.raf = requestAnimationFrame(edge);
    };
    const finish = (commit: boolean) => {
      if (!d) return;
      const { list, items, from, to, tops, ghost, out, x, y } = d;
      cancelAnimationFrame(d.raf);
      d = null;
      this.sortedAt = performance.now();
      const done = () => {
        ghost.remove();
        list.classList.remove('sorting');
        items.forEach((it) => {
          it.style.transform = '';
          it.classList.remove('sort-hole');
        });
        if (commit && out) this.onDropPage(from, x, y);
        else if (commit && to !== from) store.movePage(from, to);
      };
      if (!smooth) return done();
      if (commit && out) {
        // let go over the board: the copy fades where it was dropped, the content appears there
        ghost.classList.add('gone');
        setTimeout(done, 160);
        return;
      }
      // glide into the free place, then the list is drawn in its new order
      const lr = list.getBoundingClientRect();
      const slot = commit ? lr.top + tops[to] - list.scrollTop : lr.top + tops[from] - list.scrollTop;
      ghost.classList.add('drop');
      ghost.style.transform = `translateY(${slot - parseFloat(ghost.style.top)}px)`;
      setTimeout(done, 200);
    };
    panel.addEventListener('pointerdown', (e) => {
      const t = (e.target as HTMLElement).closest('.page-thumb') as HTMLElement | null;
      if (!t || e.button > 0 || d) return;
      cand = t;
      sx = e.clientX;
      sy = e.clientY;
      pid = e.pointerId;
      clearTimeout(press);
      if (e.pointerType !== 'mouse') press = window.setTimeout(() => cand && begin(cand, sy, sx), 260);
    });
    panel.addEventListener('pointermove', (e) => {
      if (d) {
        d.x = e.clientX;
        d.y = e.clientY;
        place();
        return;
      }
      if (!cand || e.pointerId !== pid) return;
      const moved = Math.hypot(e.clientX - sx, e.clientY - sy);
      if (e.pointerType === 'mouse') {
        if (moved > 6) begin(cand, sy);
        if (d) {
          (d as Drag).x = e.clientX;
          (d as Drag).y = e.clientY;
          place();
        }
      } else if (moved > 10) {
        // a swipe before the press was long enough: the list scrolls as usual
        clearTimeout(press);
        cand = null;
      }
    });
    const up = (commit: boolean) => () => {
      clearTimeout(press);
      cand = null;
      finish(commit);
    };
    panel.addEventListener('pointerup', up(true));
    panel.addEventListener('pointercancel', up(false));
    // while a page is held, the finger moves the page, not the list (and no long-press menu)
    panel.addEventListener('touchmove', (e) => d && e.cancelable && e.preventDefault(), { passive: false });
    panel.addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement).closest('.page-thumb')) e.preventDefault();
    });
  }

  private onClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest('[data-pg]') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.pg === 'go' && performance.now() - this.sortedAt < 400) return;
    const i = store.index;
    switch (b.dataset.pg) {
      case 'close':
        return this.close();
      case 'expand':
        this.close();
        return this.onExpand();
      case 'go':
        return store.goTo(Number(b.dataset.i));
      case 'up':
        return store.movePage(i, i - 1);
      case 'down':
        return store.movePage(i, i + 1);
      case 'copy':
        copied = store.page;
        this.render();
        return toast(`Page ${i + 1} copied`);
      case 'paste':
        if (!copied) return;
        store.addPage(i, { ...copied, id: uid(), els: copied.els.map((x) => ({ ...x, id: uid() })) });
        return toast(`Pasted as page ${store.index + 1}`);
      case 'delete':
        store.deletePage(i);
        return toast('Page deleted — tap Undo to bring it back');
      case 'add':
        store.addPage(store.doc.pages.length - 1);
        return;
    }
  }
}
