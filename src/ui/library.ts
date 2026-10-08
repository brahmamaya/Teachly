import { blankNotebook, deleteNotebook, duplicateNotebook, listNotebooks, loadNotebook, type NotebookMeta, renameNotebook, saveNotebook } from '../io/library';
import { store } from '../store';
import { icon } from './icons';
import { toast } from './panel';

// "My notebooks": every lesson saved on this device, as cover cards.
// Unlimited notebooks, all free. Tap a cover to open it.

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function when(t: number): string {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export class Library {
  private el: HTMLElement | null = null;
  private list: NotebookMeta[] = [];
  private query = '';
  private armedDelete = '';

  constructor(private host: HTMLElement) {}

  get open(): boolean {
    return !!this.el;
  }

  async show(): Promise<void> {
    if (this.el) return;
    // Save what is on the board first so its cover is up to date.
    store.doc = await saveNotebook(store.doc);
    const el = document.createElement('section');
    el.className = 'library';
    el.setAttribute('aria-label', 'My notebooks');
    el.innerHTML = `
      <header class="lib-head">
        <h2>My notebooks</h2>
        <input class="lib-search" type="search" placeholder="Search" aria-label="Search notebooks">
        <button class="icon-btn" data-lib="close" title="Back to board" aria-label="Back to board">${icon('close', 22)}</button>
      </header>
      <div class="lib-grid"></div>`;
    this.host.appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => void this.onClick(e));
    (el.querySelector('.lib-search') as HTMLInputElement).addEventListener('input', (e) => {
      this.query = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.render();
    });
    await this.refresh();
  }

  close(): void {
    this.el?.remove();
    this.el = null;
  }

  private async refresh(): Promise<void> {
    this.list = await listNotebooks();
    this.render();
  }

  private render(): void {
    const grid = this.el?.querySelector('.lib-grid');
    if (!grid) return;
    const items = this.list.filter((m) => !this.query || m.title.toLowerCase().includes(this.query));
    grid.innerHTML = `
      <button class="nb-card nb-new" data-lib="new">
        <span class="nb-cover">${icon('plus', 40)}</span>
        <span class="nb-title">New notebook</span>
      </button>
      ${items
        .map(
          (m) => `
        <div class="nb-card ${m.id === store.doc.id ? 'current' : ''}" data-id="${m.id}">
          <button class="nb-cover" data-lib="open" aria-label="Open ${esc(m.title)}">${m.thumb ? `<img src="${m.thumb}" alt="">` : ''}</button>
          <span class="nb-title">${esc(m.title)}</span>
          <span class="nb-meta">${m.pages} page${m.pages === 1 ? '' : 's'} · ${when(m.updated)}</span>
          <span class="nb-actions">
            <button class="icon-btn" data-lib="rename" title="Rename" aria-label="Rename">${icon('text', 18)}</button>
            <button class="icon-btn" data-lib="copy" title="Make a copy" aria-label="Make a copy">${icon('copy', 18)}</button>
            <button class="icon-btn ${this.armedDelete === m.id ? 'armed' : ''}" data-lib="delete" title="Delete" aria-label="Delete">${icon('trash', 18)}</button>
          </span>
        </div>`,
        )
        .join('')}`;
  }

  private async onClick(e: MouseEvent): Promise<void> {
    const b = (e.target as HTMLElement).closest('[data-lib]') as HTMLElement | null;
    if (!b) return;
    const id = (b.closest('[data-id]') as HTMLElement | null)?.dataset.id ?? '';
    const act = b.dataset.lib;
    if (act !== 'delete') this.armedDelete = '';
    switch (act) {
      case 'close':
        return this.close();
      case 'new': {
        const doc = blankNotebook(`Notebook ${this.list.length + 1}`, store.page.bg);
        store.loadDoc(await saveNotebook(doc));
        this.close();
        return toast('New notebook');
      }
      case 'open': {
        if (id !== store.doc.id) {
          const doc = await loadNotebook(id);
          if (!doc) return toast('Could not open this notebook');
          store.loadDoc(doc);
        }
        return this.close();
      }
      case 'rename': {
        const m = this.list.find((x) => x.id === id);
        const title = window.prompt('Notebook name', m?.title ?? '')?.trim();
        if (!title) return;
        if (id === store.doc.id) store.doc = await saveNotebook({ ...store.doc, title });
        else await renameNotebook(id, title);
        return this.refresh();
      }
      case 'copy':
        await duplicateNotebook(id);
        return this.refresh();
      case 'delete':
        if (this.armedDelete !== id) {
          this.armedDelete = id;
          this.render();
          return toast('Tap delete again to remove this notebook', 3000);
        }
        this.armedDelete = '';
        await deleteNotebook(id);
        if (id === store.doc.id) {
          const rest = await listNotebooks();
          const next = rest.length ? await loadNotebook(rest[0].id) : null;
          store.loadDoc(next ?? (await saveNotebook(blankNotebook('Notebook 1', store.page.bg))));
        }
        return this.refresh();
    }
  }
}
