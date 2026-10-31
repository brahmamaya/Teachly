import {
  blankNotebook,
  createFolder,
  deleteFolder,
  deleteNotebook,
  duplicateNotebook,
  type Folder,
  listFolders,
  listNotebooks,
  loadNotebook,
  moveNotebook,
  type NotebookMeta,
  renameFolder,
  renameNotebook,
  saveNotebook,
} from '../io/library';
import { store } from '../store';
import { icon } from './icons';
import { toast } from './panel';

// "My notebooks": every lesson saved on this device, as cover cards, sorted
// into folders the teacher makes. Unlimited notebooks and folders, all free.

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function when(t: number): string {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

/** A small box over everything; resolves with what the form returns (null = cancelled). */
function modal<T>(host: HTMLElement, html: string, read: (box: HTMLElement) => T | null): Promise<T | null> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'sv-back';
    back.innerHTML = `<form class="sv-box" novalidate>${html}</form>`;
    host.appendChild(back);
    const box = back.querySelector('.sv-box') as HTMLFormElement;
    const done = (v: T | null) => {
      back.remove();
      resolve(v);
    };
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) done(null);
    });
    box.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-sv]') as HTMLElement | null;
      if (b?.dataset.sv === 'cancel') done(null);
      else if (b?.dataset.sv === 'pick') done(b.dataset.v as unknown as T);
    });
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = read(box);
      if (v !== null) done(v);
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') done(null);
    });
    (box.querySelector('input') as HTMLInputElement | null)?.select();
  });
}

/** Ask for a folder name. */
function askName(host: HTMLElement, title: string, value = ''): Promise<string | null> {
  return modal(
    host,
    `<h3>${esc(title)}</h3>
     <input class="sv-input" name="n" value="${esc(value)}" maxlength="60" placeholder="Folder name" aria-label="${esc(title)}">
     <div class="sv-row"><button type="button" class="btn" data-sv="cancel">Cancel</button><button type="submit" class="btn primary">OK</button></div>`,
    (box) => (box.querySelector('input') as HTMLInputElement).value.trim() || null,
  );
}

/** Choose a folder ('' = My notebooks, no folder). New folders can be made here too. */
async function chooseFolder(host: HTMLElement, current: string): Promise<string | null> {
  const folders = await listFolders();
  const opt = (id: string, name: string, ic: string) =>
    `<button type="button" class="sv-opt ${id === current ? 'on' : ''}" data-sv="pick" data-v="${id}">${icon(ic, 20)}<span>${esc(name)}</span></button>`;
  const v = await modal<string>(
    host,
    `<h3>Move to</h3>
     <div class="sv-list">${opt('', 'My notebooks', 'notebook')}${folders.map((f) => opt(f.id, f.name, 'folder')).join('')}${opt('__new', 'New folder…', 'folderPlus')}</div>
     <div class="sv-row"><button type="button" class="btn" data-sv="cancel">Cancel</button></div>`,
    () => null,
  );
  if (v !== '__new') return v;
  const name = await askName(host, 'New folder');
  return name ? (await createFolder(name)).id : null;
}

/**
 * Menu → Save notebook: give it a name (and a folder) and it is kept in
 * My notebooks on this device.
 */
export async function saveNotebookDialog(host: HTMLElement): Promise<void> {
  const folders = await listFolders();
  const metas = await listNotebooks();
  const inFolder = metas.find((m) => m.id === store.doc.id)?.folder ?? '';
  const res = await modal<{ title: string; folder: string }>(
    host,
    `<h3>Save notebook</h3>
     <label class="sv-label">Name<input class="sv-input" name="t" value="${esc(store.doc.title)}" maxlength="80" placeholder="Notebook name"></label>
     <label class="sv-label">Folder<select class="sv-input" name="f">
       <option value="">My notebooks</option>
       ${folders.map((f) => `<option value="${f.id}" ${f.id === inFolder ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
       <option value="__new">+ New folder…</option>
     </select></label>
     <div class="sv-row"><button type="button" class="btn" data-sv="cancel">Cancel</button><button type="submit" class="btn primary">Save</button></div>`,
    (box) => {
      const title = (box.querySelector('[name=t]') as HTMLInputElement).value.trim();
      if (!title) {
        toast('Give the notebook a name');
        return null;
      }
      return { title, folder: (box.querySelector('[name=f]') as HTMLSelectElement).value };
    },
  );
  if (!res) return;
  let folder = res.folder;
  let where = 'My notebooks';
  if (folder === '__new') {
    const name = await askName(host, 'New folder');
    if (!name) return;
    folder = (await createFolder(name)).id;
    where = name;
  } else if (folder) where = folders.find((f) => f.id === folder)?.name ?? where;
  store.doc = await saveNotebook({ ...store.doc, title: res.title }, folder);
  store.emit('doc');
  toast(`Saved in ${where}`);
}

export class Library {
  private el: HTMLElement | null = null;
  private list: NotebookMeta[] = [];
  private folders: Folder[] = [];
  /** Folder being looked at ('' = the top of My notebooks). */
  private folder = '';
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
        <button class="icon-btn" data-lib="new-folder" title="New folder" aria-label="New folder">${icon('folderPlus', 24)}</button>
        <button class="icon-btn" data-lib="close" title="Back to board" aria-label="Back to board">${icon('close', 22)}</button>
      </header>
      <div class="lib-path"></div>
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
    [this.list, this.folders] = await Promise.all([listNotebooks(), listFolders()]);
    if (this.folder && !this.folders.some((f) => f.id === this.folder)) this.folder = '';
    this.render();
  }

  private render(): void {
    const grid = this.el?.querySelector('.lib-grid');
    const path = this.el?.querySelector('.lib-path') as HTMLElement | null;
    if (!grid || !path) return;
    const q = this.query;
    const known = new Set(this.folders.map((f) => f.id));
    const folderOf = (m: NotebookMeta) => (m.folder && known.has(m.folder) ? m.folder : '');
    // Search looks in every folder; otherwise show the open folder only.
    const items = q ? this.list.filter((m) => m.title.toLowerCase().includes(q)) : this.list.filter((m) => folderOf(m) === this.folder);
    const here = this.folders.find((f) => f.id === this.folder);
    path.hidden = !here || !!q;
    path.innerHTML = here
      ? `<button class="lib-up" data-lib="up">${icon('prev', 20)}<span>My notebooks</span></button><span class="lib-here">${icon('folder', 20)}${esc(here.name)}</span>`
      : '';
    const folderCards =
      this.folder || q
        ? ''
        : this.folders
            .map((f) => {
              const n = this.list.filter((m) => m.folder === f.id).length;
              return `
        <div class="nb-card nb-folder" data-fid="${f.id}">
          <button class="nb-cover" data-lib="open-folder" aria-label="Open folder ${esc(f.name)}">${icon('folder', 56)}</button>
          <span class="nb-title">${esc(f.name)}</span>
          <span class="nb-meta">${n} notebook${n === 1 ? '' : 's'}</span>
          <span class="nb-actions">
            <button class="icon-btn" data-lib="rename-folder" title="Rename folder" aria-label="Rename folder">${icon('text', 18)}</button>
            <button class="icon-btn ${this.armedDelete === f.id ? 'armed' : ''}" data-lib="delete-folder" title="Delete folder (notebooks are kept)" aria-label="Delete folder">${icon('trash', 18)}</button>
          </span>
        </div>`;
            })
            .join('');
    grid.innerHTML = `
      ${folderCards}
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
            <button class="icon-btn" data-lib="move" title="Move to a folder" aria-label="Move to a folder">${icon('folder', 18)}</button>
            <button class="icon-btn" data-lib="copy" title="Make a copy" aria-label="Make a copy">${icon('copy', 18)}</button>
            <button class="icon-btn ${this.armedDelete === m.id ? 'armed' : ''}" data-lib="delete" title="Delete" aria-label="Delete">${icon('trash', 18)}</button>
          </span>
        </div>`,
        )
        .join('')}`;
  }

  private async onClick(e: MouseEvent): Promise<void> {
    const b = (e.target as HTMLElement).closest('[data-lib]') as HTMLElement | null;
    if (!b || !this.el) return;
    const id = (b.closest('[data-id]') as HTMLElement | null)?.dataset.id ?? '';
    const fid = (b.closest('[data-fid]') as HTMLElement | null)?.dataset.fid ?? '';
    const act = b.dataset.lib;
    if (act !== 'delete' && act !== 'delete-folder') this.armedDelete = '';
    switch (act) {
      case 'close':
        return this.close();
      case 'new-folder': {
        const name = await askName(this.el, 'New folder');
        if (!name) return;
        await createFolder(name);
        toast(`Folder "${name}" made`);
        return this.refresh();
      }
      case 'open-folder':
        this.folder = fid;
        return this.render();
      case 'up':
        this.folder = '';
        return this.render();
      case 'rename-folder': {
        const f = this.folders.find((x) => x.id === fid);
        const name = await askName(this.el, 'Rename folder', f?.name ?? '');
        if (!name) return;
        await renameFolder(fid, name);
        return this.refresh();
      }
      case 'delete-folder':
        if (this.armedDelete !== fid) {
          this.armedDelete = fid;
          this.render();
          return toast('Tap delete again to remove the folder (its notebooks are kept)', 3000);
        }
        this.armedDelete = '';
        await deleteFolder(fid);
        return this.refresh();
      case 'new': {
        const doc = blankNotebook(`Notebook ${this.list.length + 1}`, store.page.bg);
        store.loadDoc(await saveNotebook(doc, this.folder));
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
      case 'move': {
        const m = this.list.find((x) => x.id === id);
        const to = await chooseFolder(this.el, m?.folder ?? '');
        if (to === null) return;
        await moveNotebook(id, to);
        toast(`Moved to ${to ? ((await listFolders()).find((f) => f.id === to)?.name ?? 'folder') : 'My notebooks'}`);
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
