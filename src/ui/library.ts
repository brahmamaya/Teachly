import {
  blankNotebook,
  createFolder,
  deleteFolder,
  deleteNotebook,
  emptyTrash,
  duplicateNotebook,
  type Folder,
  listFolders,
  listNotebooks,
  loadNotebook,
  moveNotebook,
  type NotebookMeta,
  renameFolder,
  renameNotebook,
  restoreNotebook,
  saveNotebook,
  trashNotebook,
} from '../io/library';
import { store } from '../store';
import { icon } from './icons';
import { fadeOut, toast } from './panel';

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
      fadeOut(back);
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

/** Which list is shown: every notebook, the ones in no folder, one folder, or the trash. */
type View = 'all' | 'unfiled' | 'trash' | `f:${string}`;

export class Library {
  private el: HTMLElement | null = null;
  /** Every notebook, the trashed ones too. */
  private list: NotebookMeta[] = [];
  private folders: Folder[] = [];
  private view: View = 'all';
  private query = '';
  private armed = '';

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
      <nav class="lib-side" aria-label="Notebook lists"></nav>
      <div class="lib-main">
        <header class="lib-head">
          <h2 class="lib-title"></h2>
          <input class="lib-search" type="search" placeholder="Search" aria-label="Search notebooks">
          <button class="icon-btn" data-lib="new-folder" title="New folder" aria-label="New folder">${icon('folderPlus', 24)}</button>
          <button class="icon-btn" data-lib="close" title="Back to board" aria-label="Back to board">${icon('close', 22)}</button>
        </header>
        <div class="lib-bar"></div>
        <div class="lib-grid"></div>
      </div>`;
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
    if (this.el) fadeOut(this.el, 180);
    this.el = null;
  }

  private async refresh(): Promise<void> {
    [this.list, this.folders] = await Promise.all([listNotebooks(true), listFolders()]);
    if (this.view.startsWith('f:') && !this.folders.some((f) => `f:${f.id}` === this.view)) this.view = 'all';
    this.render();
  }

  private folderOf(m: NotebookMeta): string {
    return m.folder && this.folders.some((f) => f.id === m.folder) ? m.folder : '';
  }

  private render(): void {
    const el = this.el;
    if (!el) return;
    const live = this.list.filter((m) => !m.trashed);
    const trash = this.list.filter((m) => m.trashed);
    const count = (n: number) => `<span class="ls-n">${n}</span>`;
    const item = (v: View, ic: string, label: string, n: number) =>
      `<button class="ls-item ${this.view === v ? 'on' : ''}" data-lib="view" data-v="${esc(v)}">${icon(ic, 20)}<span class="ls-l">${esc(label)}</span>${count(n)}</button>`;
    (el.querySelector('.lib-side') as HTMLElement).innerHTML = `
      ${item('all', 'notebook', 'All notebooks', live.length)}
      ${item('unfiled', 'open', 'Not in a folder', live.filter((m) => !this.folderOf(m)).length)}
      <div class="ls-head"><span>Folders</span><button class="icon-btn" data-lib="new-folder" title="New folder" aria-label="New folder">${icon('plus', 18)}</button></div>
      ${this.folders.map((f) => item(`f:${f.id}`, 'folder', f.name, live.filter((m) => m.folder === f.id).length)).join('') || '<p class="ls-empty">No folders yet</p>'}
      <div class="ls-sep"></div>
      ${item('trash', 'trash', 'Trash', trash.length)}`;

    const folder = this.view.startsWith('f:') ? this.folders.find((f) => `f:${f.id}` === this.view) : undefined;
    const title = this.view === 'all' ? 'All notebooks' : this.view === 'unfiled' ? 'Not in a folder' : this.view === 'trash' ? 'Trash' : (folder?.name ?? '');
    (el.querySelector('.lib-title') as HTMLElement).textContent = title;

    // The bar under the title: folder tools, or the trash tools.
    const bar = el.querySelector('.lib-bar') as HTMLElement;
    if (this.view === 'trash')
      bar.innerHTML = trash.length
        ? `<p>Deleted notebooks wait here. Restore them, or empty the trash to remove them for good.</p><button class="lib-chip danger ${this.armed === 'empty' ? 'armed' : ''}" data-lib="empty">${icon('trash', 18)}Empty trash</button>`
        : '<p>The trash is empty.</p>';
    else if (folder)
      bar.innerHTML = `<button class="lib-chip" data-lib="rename-folder">${icon('text', 18)}Rename folder</button><button class="lib-chip ${this.armed === folder.id ? 'armed' : ''}" data-lib="delete-folder">${icon('trash', 18)}Delete folder</button>`;
    else bar.innerHTML = '';

    const q = this.query;
    const pool = this.view === 'trash' ? trash : live;
    const items = pool.filter((m) => {
      if (q) return m.title.toLowerCase().includes(q);
      if (this.view === 'unfiled') return !this.folderOf(m);
      if (folder) return m.folder === folder.id;
      return true;
    });
    const inTrash = this.view === 'trash';
    const newCard = inTrash ? '' : `<button class="nb-card nb-new" data-lib="new"><span class="nb-cover">${icon('plus', 34)}</span><span class="nb-title">New notebook</span></button>`;
    (el.querySelector('.lib-grid') as HTMLElement).innerHTML =
      newCard +
      items
        .map((m) => {
          const where = this.folders.find((f) => f.id === this.folderOf(m))?.name;
          const actions = inTrash
            ? `<button class="icon-btn" data-lib="restore" title="Restore" aria-label="Restore">${icon('undo', 17)}</button>
               <button class="icon-btn ${this.armed === m.id ? 'armed' : ''}" data-lib="purge" title="Delete for good" aria-label="Delete for good">${icon('trash', 17)}</button>`
            : `<button class="icon-btn" data-lib="rename" title="Rename" aria-label="Rename">${icon('text', 17)}</button>
               <button class="icon-btn" data-lib="move" title="Move to a folder" aria-label="Move to a folder">${icon('folder', 17)}</button>
               <button class="icon-btn" data-lib="copy" title="Make a copy" aria-label="Make a copy">${icon('copy', 17)}</button>
               <button class="icon-btn" data-lib="delete" title="Move to trash" aria-label="Move to trash">${icon('trash', 17)}</button>`;
          return `
        <div class="nb-card ${m.id === store.doc.id && !inTrash ? 'current' : ''}" data-id="${m.id}">
          <button class="nb-cover" data-lib="${inTrash ? 'restore' : 'open'}" aria-label="${inTrash ? 'Restore' : 'Open'} ${esc(m.title)}">${m.thumb ? `<img src="${m.thumb}" alt="">` : ''}<span class="nb-age">${m.pages}p</span></button>
          <span class="nb-title">${esc(m.title)}</span>
          <span class="nb-meta">${inTrash ? `Deleted ${when(m.trashed!)}` : when(m.updated)}${where && this.view === 'all' ? ` · ${esc(where)}` : ''}</span>
          <span class="nb-actions">${actions}</span>
        </div>`;
        })
        .join('');
  }

  private async onClick(e: MouseEvent): Promise<void> {
    const b = (e.target as HTMLElement).closest('[data-lib]') as HTMLElement | null;
    if (!b || !this.el) return;
    const id = (b.closest('[data-id]') as HTMLElement | null)?.dataset.id ?? '';
    const folderId = this.view.startsWith('f:') ? this.view.slice(2) : '';
    const act = b.dataset.lib;
    const wasArmed = this.armed;
    this.armed = '';
    switch (act) {
      case 'close':
        return this.close();
      case 'view':
        this.view = (b.dataset.v ?? 'all') as View;
        this.query = '';
        (this.el.querySelector('.lib-search') as HTMLInputElement).value = '';
        return this.render();
      case 'new-folder': {
        const name = await askName(this.el, 'New folder');
        if (!name) return;
        const f = await createFolder(name);
        this.view = `f:${f.id}`;
        toast(`Folder "${name}" made`);
        return this.refresh();
      }
      case 'rename-folder': {
        const f = this.folders.find((x) => x.id === folderId);
        const name = await askName(this.el, 'Rename folder', f?.name ?? '');
        if (!name) return;
        await renameFolder(folderId, name);
        return this.refresh();
      }
      case 'delete-folder':
        if (wasArmed !== folderId) {
          this.armed = folderId;
          this.render();
          return toast('Tap again to delete the folder (its notebooks are kept)', 3000);
        }
        await deleteFolder(folderId);
        this.view = 'all';
        return this.refresh();
      case 'new': {
        const doc = blankNotebook(`Notebook ${this.list.length + 1}`, store.page.bg);
        store.loadDoc(await saveNotebook(doc, folderId));
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
        toast(`Moved to ${to ? ((await listFolders()).find((f) => f.id === to)?.name ?? 'folder') : 'Not in a folder'}`);
        return this.refresh();
      }
      case 'copy':
        await duplicateNotebook(id);
        return this.refresh();
      case 'delete': {
        await trashNotebook(id);
        if (id === store.doc.id) {
          // The open notebook went to the trash: open the newest other one.
          const rest = await listNotebooks();
          const next = rest.length ? await loadNotebook(rest[0].id) : null;
          store.loadDoc(next ?? (await saveNotebook(blankNotebook('Notebook 1', store.page.bg))));
        }
        toast('Moved to Trash');
        return this.refresh();
      }
      case 'restore':
        await restoreNotebook(id);
        toast('Notebook restored');
        return this.refresh();
      case 'purge':
        if (wasArmed !== id) {
          this.armed = id;
          this.render();
          return toast('Tap again to delete this notebook for good', 3000);
        }
        await deleteNotebook(id);
        return this.refresh();
      case 'empty': {
        if (wasArmed !== 'empty') {
          this.armed = 'empty';
          this.render();
          return toast('Tap Empty trash again to remove these notebooks for good', 3000);
        }
        const n = await emptyTrash();
        toast(`${n} notebook${n === 1 ? '' : 's'} removed for good`);
        return this.refresh();
      }
    }
  }
}
