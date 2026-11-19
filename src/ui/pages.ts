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
    fadeOut(this.el);
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

  private onClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest('[data-pg]') as HTMLElement | null;
    if (!b) return;
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
