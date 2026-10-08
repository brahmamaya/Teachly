import { uid } from '../geometry';
import { contentBounds, renderRegion } from '../renderer';
import { store } from '../store';
import type { Page } from '../types';
import { icon } from './icons';
import { toast } from './panel';

// Page sorter (like Note 3): a side panel with every page as a thumbnail.
// Tap a page to open it; the buttons below act on the open page.

const thumbs = new WeakMap<Page, string>();
let copied: Page | null = null;

function thumb(p: Page): string {
  let src = thumbs.get(p);
  if (!src) {
    const b = contentBounds(p.els) ?? { x: 0, y: 0, w: 1280, h: 720 };
    const pad = 30;
    let w = b.w + pad * 2, h = b.h + pad * 2;
    // Keep a 16:9 frame around the content.
    if (w / h > 16 / 9) h = (w * 9) / 16;
    else w = (h * 16) / 9;
    const region = { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
    src = renderRegion(p, region, 320, 180).toDataURL('image/jpeg', 0.75);
    thumbs.set(p, src);
  }
  return src;
}

export class PagesPanel {
  private el: HTMLElement | null = null;
  private unsub: (() => void) | null = null;

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
    this.el.remove();
    this.el = null;
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
      <header class="pages-head"><b>Pages</b><span>${pages.length}</span><button class="icon-btn small" data-pg="close" aria-label="Close">${icon('close', 20)}</button></header>
      <div class="pages-list">${pages
        .map(
          (p, k) => `<button class="page-thumb ${k === i ? 'on' : ''}" data-pg="go" data-i="${k}" aria-label="Page ${k + 1}">
            <img src="${thumb(p)}" alt=""><span>${k + 1}</span></button>`,
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
