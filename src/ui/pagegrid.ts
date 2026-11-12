import { bbox, similarity, transformEl, uid } from '../geometry';
import { download } from '../io/files';
import { blankNotebook, saveNotebook } from '../io/library';
import { PAGE } from '../page';
import { getImage, pageRegion, renderRegion } from '../renderer';
import { newPage, store } from '../store';
import type { El, Page } from '../types';
import { icon } from './icons';
import { askName } from './library';
import { fadeOut, toast } from './panel';

// Page grid: every page of the notebook, full screen (like a sorter).
// Tap a page to select it (the magnifier opens it, double-tap too);
// "Select" picks several. Insert, Cut, Copy, Paste, Rotate, Tag, Delete,
// Extract (to a new notebook) and Share (as PDF) act on the selected pages;
// drag a page to move it. Thumbnails are drawn only when they scroll into
// view and are kept, so even a 300-page book opens at once.

/** Copied / cut pages, kept while Teachly is open (also usable in another notebook). */
let clipboard: Page[] = [];

const thumbs = new WeakMap<Page, string>();

/** An independent copy of a page (new ids). */
function clonePage(p: Page): Page {
  return { ...p, id: uid(), els: p.els.map((e) => ({ ...e, id: uid() })) };
}

/** Wait until the pictures on a page are ready to draw (book pages are made on demand). */
async function imagesReady(p: Page): Promise<void> {
  const imgs = p.els.filter((e): e is El & { type: 'image' } => e.type === 'image').map((e) => getImage(e.src));
  const t0 = performance.now();
  while (imgs.some((i) => !(i.complete && i.naturalWidth)) && performance.now() - t0 < 12_000) await new Promise((r) => setTimeout(r, 80));
}

/** A thumbnail picture of a page (null if it could not be drawn). */
export async function makeThumb(p: Page): Promise<string | null> {
  const kept = thumbs.get(p);
  if (kept) return kept;
  // Book pages are drawn small, straight from the kept PDF (quick); the rest as they are.
  let page = p;
  if (p.els.some((e) => e.type === 'image' && e.src.startsWith('pdfp:'))) {
    const { smallPageURL } = await import('../io/pdfpages');
    const els = await Promise.all(
      p.els.map(async (e) => {
        if (e.type !== 'image' || !e.src.startsWith('pdfp:')) return e;
        const small = await smallPageURL(e.src, 420);
        return small ? { ...e, src: small } : e;
      }),
    );
    page = { ...p, els };
  }
  await imagesReady(page);
  try {
    const r = pageRegion(page.els);
    const w = 440, h = Math.max(60, Math.min(700, Math.round((w * r.h) / r.w)));
    const url = renderRegion(page, r, w, h).toDataURL('image/jpeg', 0.82);
    thumbs.set(p, url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Draw thumbnails only for pages that scroll into view (one at a time, so
 * touches and scrolling stay smooth) and keep them. `root` scrolls; each
 * element matching `cards` holds an <img>. Returns a function that stops it.
 */
export function lazyThumbs(root: HTMLElement, cards: string, pageOf: (card: HTMLElement) => Page | undefined): () => void {
  const queue: HTMLElement[] = [];
  let busy = false;
  let alive = true;
  const pump = async () => {
    if (busy) return;
    busy = true;
    while (queue.length && alive) {
      const card = queue.shift()!;
      const p = pageOf(card);
      if (!p || !card.isConnected) continue;
      const url = await makeThumb(p);
      if (url && card.isConnected) {
        (card.querySelector('img') as HTMLImageElement).src = url;
        card.classList.add('ready');
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    busy = false;
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        queue.push(en.target as HTMLElement);
      }
      void pump();
    },
    { root, rootMargin: '600px 0px' },
  );
  root.querySelectorAll<HTMLElement>(cards).forEach((c) => {
    const p = pageOf(c);
    const kept = p && thumbs.get(p);
    if (kept) {
      (c.querySelector('img') as HTMLImageElement).src = kept;
      c.classList.add('ready');
    } else io.observe(c);
  });
  return () => {
    alive = false;
    io.disconnect();
    queue.length = 0;
  };
}

/** Turn the page's content a quarter turn clockwise about the page centre; shrink it if it no longer fits. */
function rotatedPage(p: Page): Page {
  const cx = PAGE.x + PAGE.w / 2, cy = PAGE.y + PAGE.h / 2;
  const quarter = similarity(cx, cy, 1, Math.PI / 2, 0, 0);
  const turned = p.els.map((e) => transformEl(e, quarter));
  let hx = PAGE.w / 2, hy = PAGE.h / 2;
  for (const e of turned) {
    const b = bbox(e);
    hx = Math.max(hx, cx - b.x, b.x + b.w - cx);
    hy = Math.max(hy, cy - b.y, b.y + b.h - cy);
  }
  const k = Math.min(1, PAGE.w / 2 / hx, PAGE.h / 2 / hy);
  const m = similarity(cx, cy, k, Math.PI / 2, 0, 0);
  return { ...p, els: p.els.map((e) => transformEl(e, m)) };
}

export class PagesGrid {
  private el: HTMLElement | null = null;
  private unsub: (() => void) | null = null;
  private sel = new Set<string>();
  private multi = false;
  private stopThumbs: (() => void) | null = null;
  private fresh = true;

  constructor(private host: HTMLElement, private onToggle: () => void = () => {}) {}

  get open(): boolean {
    return !!this.el;
  }

  toggle(): void {
    if (this.el) this.close();
    else this.show();
  }

  close(): void {
    if (!this.el) return;
    fadeOut(this.el, 180);
    this.el = null;
    this.stopThumbs?.();
    this.stopThumbs = null;
    this.unsub?.();
    this.unsub = null;
    this.onToggle();
  }

  private show(): void {
    const el = document.createElement('section');
    el.className = 'pgs';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'All pages');
    el.tabIndex = -1;
    this.host.appendChild(el);
    this.el = el;
    this.multi = false;
    this.fresh = true;
    this.sel = new Set([store.page.id]);
    el.addEventListener('click', (e) => void this.onClick(e));
    el.addEventListener('dblclick', (e) => {
      const card = (e.target as HTMLElement).closest('.pgs-card') as HTMLElement | null;
      if (card) this.openPage(Number(card.dataset.i));
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    this.dragging(el);
    const off = store.on('doc', () => this.render());
    this.unsub = off;
    this.render();
    this.onToggle();
    el.focus({ preventScroll: true });
  }

  /** Move a page by dragging it onto another. */
  private dragging(el: HTMLElement): void {
    let from = -1;
    el.addEventListener('dragstart', (e) => {
      const it = (e.target as HTMLElement).closest('.pgs-item') as HTMLElement | null;
      if (!it || !e.dataTransfer) return;
      from = Number(it.dataset.i);
      e.dataTransfer.setData('text/plain', String(from));
      e.dataTransfer.effectAllowed = 'move';
      it.classList.add('drag');
    });
    el.addEventListener('dragover', (e) => {
      const it = (e.target as HTMLElement).closest('.pgs-item') as HTMLElement | null;
      if (from < 0 || !it) return;
      e.preventDefault();
      el.querySelectorAll('.pgs-item.over').forEach((x) => x !== it && x.classList.remove('over'));
      it.classList.add('over');
    });
    el.addEventListener('drop', (e) => {
      const it = (e.target as HTMLElement).closest('.pgs-item') as HTMLElement | null;
      if (from < 0 || !it) return;
      e.preventDefault();
      const to = Number(it.dataset.i);
      const f = from;
      from = -1;
      if (f !== to) store.movePage(f, to);
      else this.render();
    });
    el.addEventListener('dragend', () => {
      from = -1;
      el.querySelectorAll('.pgs-item.drag, .pgs-item.over').forEach((x) => x.classList.remove('drag', 'over'));
    });
  }

  // ---- drawing --------------------------------------------------------------

  private render(): void {
    const el = this.el;
    if (!el) return;
    const pages = store.doc.pages;
    // Keep only selected pages that still exist; never leave nothing selected.
    const ids = new Set(pages.map((p) => p.id));
    for (const id of [...this.sel]) if (!ids.has(id)) this.sel.delete(id);
    if (!this.sel.size) this.sel.add(store.page.id);
    const grid = el.querySelector('.pgs-grid') as HTMLElement | null;
    const scroll = grid?.scrollTop ?? 0;
    el.innerHTML = `
      <header class="pgs-top">
        <button class="pgs-round" data-pg="close" title="Close" aria-label="Close">${icon('close', 22)}</button>
        <span class="pgs-hist">
          <button class="pgs-round" data-pg="undo" title="Undo" aria-label="Undo" ${store.canUndo ? '' : 'disabled'}>${icon('undo', 20)}</button>
          <button class="pgs-round" data-pg="redo" title="Redo" aria-label="Redo" ${store.canRedo ? '' : 'disabled'}>${icon('redo', 20)}</button>
        </span>
        <h2 class="pgs-title"></h2>
        <button class="pgs-pill ${this.multi ? 'on' : ''}" data-pg="select">${this.multi ? 'Done' : 'Select'}</button>
      </header>
      <nav class="pgs-bar" aria-label="Page actions">
        ${this.act('insert', 'plus', 'Insert')}${this.act('cut', 'scissors', 'Cut')}${this.act('copy', 'copy', 'Copy')}${this.act('paste', 'paste', 'Paste')}${this.act('rotate', 'rotate', 'Rotate')}${this.act('tag', 'tag', 'Tag')}${this.act('delete', 'trash', 'Delete', true)}${this.act('extract', 'extract', 'Extract')}${this.act('share', 'share', 'Share')}
      </nav>
      <div class="pgs-grid ${this.fresh ? 'fresh' : ''}">${pages
        .map(
          (p, k) => `<div class="pgs-item" data-i="${k}" draggable="true" style="--n:${k}">
            <div class="pgs-card" role="button" tabindex="0" data-pg="card" data-i="${k}" data-id="${p.id}" aria-label="Page ${k + 1}">
              <img alt="" draggable="false">
              <button class="pgs-zoom" data-pg="open" data-i="${k}" title="Open page ${k + 1}" aria-label="Open page ${k + 1}">${icon('magnifier', 18)}</button>
              ${p.tag ? `<span class="pgs-tag"><span>${esc(p.tag)}</span><button data-pg="untag" data-i="${k}" aria-label="Remove tag">${icon('close', 12)}</button></span>` : ''}
              <i class="pgs-check">${icon('check', 14)}</i>
            </div>
            <span class="pgs-n ${p.id === store.page.id ? 'cur' : ''}">${k + 1}</span>
          </div>`,
        )
        .join('')}</div>`;
    this.fresh = false;
    const g = el.querySelector('.pgs-grid') as HTMLElement;
    g.scrollTop = scroll;
    this.stopThumbs?.();
    this.stopThumbs = lazyThumbs(g, '.pgs-card', (c) => store.doc.pages[Number(c.dataset.i)]);
    this.paint();
    if (!scroll) (g.querySelector('.pgs-card.sel') as HTMLElement | null)?.scrollIntoView({ block: 'center' });
  }

  private act(id: string, ic: string, label: string, danger = false): string {
    return `<button class="pgs-act ${danger ? 'danger' : ''}" data-pg="${id}">${icon(ic, 22)}<span>${label}</span></button>`;
  }

  /** Selection look and the buttons that need a selection (no page redraw). */
  private paint(): void {
    const el = this.el;
    if (!el) return;
    const n = this.sel.size;
    el.classList.toggle('multi', this.multi);
    el.querySelectorAll<HTMLElement>('.pgs-card').forEach((c) => {
      const on = this.sel.has(c.dataset.id ?? '');
      c.classList.toggle('sel', on);
      c.setAttribute('aria-pressed', String(on));
    });
    const doc = store.doc;
    (el.querySelector('.pgs-title') as HTMLElement).textContent = this.multi ? (n ? `${n} selected` : 'Select pages') : doc.title;
    (el.querySelector('[data-pg=paste]') as HTMLButtonElement).disabled = !clipboard.length;
    for (const a of ['cut', 'copy', 'rotate', 'tag', 'delete', 'extract', 'share']) (el.querySelector(`[data-pg=${a}]`) as HTMLButtonElement).disabled = !n;
  }

  // ---- actions ----------------------------------------------------------------

  /** Selected page indexes, in notebook order. */
  private picked(): number[] {
    return store.doc.pages.map((p, i) => (this.sel.has(p.id) ? i : -1)).filter((i) => i >= 0);
  }

  private openPage(i: number): void {
    store.goTo(i);
    this.close();
  }

  private async onClick(e: MouseEvent): Promise<void> {
    const b = (e.target as HTMLElement).closest('[data-pg]') as HTMLElement | null;
    const el = this.el;
    if (!b || !el) return;
    const pages = store.doc.pages;
    const idx = this.picked();
    const last = idx.length ? idx[idx.length - 1] : store.index;
    switch (b.dataset.pg) {
      case 'close':
        return this.close();
      case 'undo':
        return store.undo();
      case 'redo':
        return store.redo();
      case 'select':
        this.multi = !this.multi;
        if (!this.multi && this.sel.size > 1) this.sel = new Set([[...this.sel][0]]);
        el.querySelector('[data-pg=select]')!.textContent = this.multi ? 'Done' : 'Select';
        el.querySelector('[data-pg=select]')!.classList.toggle('on', this.multi);
        return this.paint();
      case 'open':
        return this.openPage(Number(b.dataset.i));
      case 'card': {
        const id = b.dataset.id ?? '';
        if (this.multi) {
          if (this.sel.has(id)) this.sel.delete(id);
          else this.sel.add(id);
        } else this.sel = new Set([id]);
        return this.paint();
      }
      case 'insert': {
        const ref = pages[last];
        const page = newPage(ref.bg, ref.pattern);
        this.sel = new Set([page.id]);
        store.addPage(last, page);
        return;
      }
      case 'copy':
        clipboard = idx.map((i) => clonePage(pages[i]));
        this.paint();
        return toast(`${idx.length} page${idx.length === 1 ? '' : 's'} copied`);
      case 'cut':
        clipboard = idx.map((i) => clonePage(pages[i]));
        this.remove(idx);
        return toast(`${idx.length} page${idx.length === 1 ? '' : 's'} cut. Tap Paste to put ${idx.length === 1 ? 'it' : 'them'} back`);
      case 'paste': {
        if (!clipboard.length) return;
        const add = clipboard.map(clonePage);
        const all = pages.slice();
        all.splice(last + 1, 0, ...add);
        this.sel = new Set(add.map((p) => p.id));
        store.clearSelection();
        store.commit(all, last + 1);
        return toast(`${add.length} page${add.length === 1 ? '' : 's'} pasted`);
      }
      case 'rotate': {
        const all = pages.slice();
        for (const i of idx) {
          all[i] = rotatedPage(all[i]);
          thumbs.delete(pages[i]);
        }
        store.clearSelection();
        store.commit(all);
        return;
      }
      case 'tag': {
        const first = pages[idx[0]];
        const name = await askName(el, 'Tag for the selected pages', first?.tag ?? '', 'Tag, for example Revise');
        if (!name) return;
        const all = pages.map((p) => (this.sel.has(p.id) ? { ...p, tag: name.slice(0, 24) } : p));
        return store.commit(all);
      }
      case 'untag': {
        const i = Number(b.dataset.i);
        const all = pages.slice();
        const { tag: _gone, ...rest } = all[i];
        all[i] = rest;
        return store.commit(all);
      }
      case 'delete':
        this.remove(idx);
        return toast(`${idx.length} page${idx.length === 1 ? '' : 's'} deleted. Tap Undo to bring ${idx.length === 1 ? 'it' : 'them'} back`);
      case 'extract': {
        const copy = idx.map((i) => clonePage(pages[i]));
        const doc = { ...blankNotebook(`${store.doc.title} (${idx.length} page${idx.length === 1 ? '' : 's'})`, '#000000', store.doc.orient), pages: copy };
        await saveNotebook(doc);
        return toast(`${idx.length} page${idx.length === 1 ? '' : 's'} saved as a new notebook in My notebooks`, 3500);
      }
      case 'share': {
        toast('Making the PDF…', 1500);
        const { makePdf } = await import('../io/pdfvector');
        const { blob } = await makePdf(idx.map((i) => pages[i]), 3);
        const name = `${store.doc.title.replace(/[^\w\- ]+/g, '').trim() || 'teachly'} ${idx.length === 1 ? `page ${idx[0] + 1}` : `${idx.length} pages`}.pdf`;
        return download(blob, name);
      }
    }
  }

  /** Take pages out of the notebook (at least one page always stays). */
  private remove(idx: number[]): void {
    const gone = new Set(idx);
    let all = store.doc.pages.filter((_, i) => !gone.has(i));
    if (!all.length) all = [newPage(store.page.bg, store.page.pattern)];
    const at = Math.min(idx[0], all.length - 1);
    this.sel = new Set([all[at].id]);
    store.clearSelection();
    store.commit(all, at);
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
