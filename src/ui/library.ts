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
  isPortrait,
  setCover,
  setPortrait,
  trashNotebook,
} from '../io/library';
import { liteDevice } from '../board';
import { COVERS, coverById, coverHTML } from './covers';
import { askPdfRange } from './pdfrange';
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
export function askName(host: HTMLElement, title: string, value = '', placeholder = 'Folder name'): Promise<string | null> {
  return modal(
    host,
    `<h3>${esc(title)}</h3>
     <input class="sv-input" name="n" value="${esc(value)}" maxlength="60" placeholder="${esc(placeholder)}" aria-label="${esc(title)}">
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

/** Choose a notebook cover. '' = none (the first page is shown); null = cancelled. */
async function chooseCover(host: HTMLElement, m: NotebookMeta): Promise<string | null> {
  // Older notebooks do not know yet whether they are vertical: look once.
  let portrait = m.portrait;
  if (portrait === undefined) {
    const doc = await loadNotebook(m.id);
    portrait = doc ? isPortrait(doc) : false;
    await setPortrait(m.id, portrait);
  }
  const cur = coverById(m.cover)?.id ?? '';
  return modal<string>(
    host,
    `<h3>Notebook cover</h3>
     <div class="cv-grid ${portrait ? 'tall' : 'wide'}">
       <button type="button" class="cv-opt ${cur === '' ? 'on' : ''}" data-sv="pick" data-v="">
         <span class="cv-none" data-o="${portrait ? 'p' : 'l'}">${m.thumb ? `<img src="${m.thumb}" alt="">` : ''}</span><span class="cv-name">First page</span></button>
       ${COVERS.map((c) => `<button type="button" class="cv-opt ${cur === c.id ? 'on' : ''}" data-sv="pick" data-v="${c.id}">${coverHTML(c, m.title, portrait)}<span class="cv-name">${c.name}</span></button>`).join('')}
     </div>
     <div class="sv-row"><button type="button" class="btn" data-sv="cancel">Cancel</button></div>`,
    () => null,
  );
}

/** Ask before deleting notebooks for good: shows their covers. */
async function confirmForever(host: HTMLElement, items: NotebookMeta[]): Promise<boolean> {
  const n = items.length;
  const covers = items
    .slice(0, 4)
    .map((m, i) => `<span class="cf-cover" style="--i:${i}">${m.thumb ? `<img src="${m.thumb}" alt="">` : ''}</span>`)
    .join('');
  const v = await modal<string>(
    host,
    `<div class="cf-covers" aria-hidden="true">${covers}</div>
     <h3>${n === 1 ? `Delete "${esc(items[0].title)}" for good?` : `Delete ${n} notebooks for good?`}</h3>
     <p class="sv-note">${n === 1 ? 'It' : 'They'} will be removed from this device and cannot be brought back.</p>
     <div class="sv-row"><button type="button" class="btn" data-sv="cancel">Cancel</button><button type="button" class="btn danger-solid" data-sv="pick" data-v="yes">${icon('trash', 18)} Delete forever</button></div>`,
    () => null,
  );
  return v === 'yes';
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
  /** The notebook whose ⋯ menu is open. */
  private menuFor = '';

  constructor(private host: HTMLElement) {}

  get open(): boolean {
    return !!this.el;
  }

  /** Light or dark look (the sun / moon switch at the top). */
  private applyTheme(el: HTMLElement): void {
    const light = store.settings.libTheme === 'light';
    el.dataset.theme = light ? 'light' : 'dark';
    el.querySelector('.lib-theme')?.setAttribute('aria-checked', String(!light));
  }

  async show(): Promise<void> {
    if (this.el) return;
    // Save what is on the board first so its cover is up to date.
    store.doc = await saveNotebook(store.doc);
    const el = document.createElement('section');
    el.className = 'library';
    this.applyTheme(el);
    el.setAttribute('aria-label', 'My notebooks');
    el.innerHTML = `
      <nav class="lib-side" aria-label="Notebook lists"></nav>
      <div class="lib-main">
        <header class="lib-head">
          <h2 class="lib-title"></h2>
          <button class="lib-theme" data-lib="theme" role="switch" aria-label="Light or dark look" title="Light / Dark">
            <svg class="lt-sun" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="4.4" fill="#fbbf24"/><g stroke="#f59e0b" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/></g></svg>
            <svg class="lt-moon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2z" fill="#c7d2fe"/><circle cx="16.5" cy="6" r="1" fill="#e0e7ff"/><circle cx="19.2" cy="9.2" r="0.7" fill="#e0e7ff"/></svg>
            <i class="lt-thumb"></i>
          </button>
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
    // Notebooks with a cover that do not know yet if they are vertical (saved
    // before): look once, then show the cover in the right shape.
    const unknown = this.list.filter((m) => m.cover && m.portrait === undefined);
    if (unknown.length) {
      for (const m of unknown) {
        const doc = await loadNotebook(m.id);
        await setPortrait(m.id, doc ? isPortrait(doc) : false);
      }
      this.list = await listNotebooks(true);
      this.render();
    }
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
    // Cards glide in only when the list is opened or another list is chosen
    // (not after every rename or move).
    const grid = el.querySelector('.lib-grid') as HTMLElement;
    grid.classList.toggle('fresh', grid.dataset.shown !== this.view);
    grid.dataset.shown = this.view;

    // The bar under the title: folder tools, or the trash tools.
    const bar = el.querySelector('.lib-bar') as HTMLElement;
    if (this.view === 'trash')
      bar.innerHTML = trash.length
        ? `<p>Deleted notebooks wait here. Restore them, or empty the trash to remove them for good.</p><button class="trash-btn" data-lib="empty">${icon('trash', 20)}<span>Empty trash</span><b class="trash-n">${trash.length}</b></button>`
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
        .map((m, n) => {
          const where = this.folders.find((f) => f.id === this.folderOf(m))?.name;
          // The card's buttons stay tucked behind ⋯ until it is tapped.
          const act = (a: string, ic: string, label: string) => `<button class="nb-act" data-lib="${a}">${icon(ic, 17)}<span>${label}</span></button>`;
          const actions = inTrash
            ? act('restore', 'undo', 'Restore') + act('purge', 'trash', 'Delete for good')
            : act('rename', 'text', 'Rename') + act('cover', 'palette', 'Cover') + act('move', 'folder', 'Move to folder') + act('copy', 'copy', 'Make a copy') + act('download', 'download', 'Download') + act('delete', 'trash', 'Move to trash');
          return `
        <div class="nb-card ${m.id === store.doc.id && !inTrash ? 'current' : ''} ${this.menuFor === m.id ? 'menu' : ''} ${coverById(m.cover) ? 'has-cv' : ''}" data-id="${m.id}" style="--n:${n + 1}">
          <button class="nb-cover" data-lib="${inTrash ? 'restore' : 'open'}" aria-label="${inTrash ? 'Restore' : 'Open'} ${esc(m.title)}">${coverById(m.cover) ? coverHTML(coverById(m.cover)!, m.title, !!m.portrait) : m.thumb ? `<img src="${m.thumb}" alt="">` : ''}<span class="nb-age">${m.pages}p</span></button>
          <span class="nb-row">
            <span class="nb-text">
              <span class="nb-title">${esc(m.title)}</span>
              <span class="nb-meta">${inTrash ? `Deleted ${when(m.trashed!)}` : when(m.updated)}${where && this.view === 'all' ? ` · ${esc(where)}` : ''}</span>
            </span>
            <button class="nb-more" data-lib="more" title="More" aria-label="More for ${esc(m.title)}" aria-expanded="${this.menuFor === m.id}">${icon('more', 18)}</button>
          </span>
          ${this.menuFor === m.id ? `<span class="nb-menu" role="menu">${actions}</span>` : ''}
        </div>`;
        })
        .join('');
  }

  /** Cards shrink and fade away one after another before the list changes. */
  private animateOut(ids: string[]): Promise<void> {
    if (!this.el || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    let i = 0;
    for (const id of ids) {
      const card = this.el.querySelector(`.nb-card[data-id="${id}"]`) as HTMLElement | null;
      if (!card) continue;
      card.style.animationDelay = `${Math.min(i++, 8) * 45}ms`;
      card.classList.add('nb-out');
    }
    return new Promise((r) => window.setTimeout(r, 260 + Math.min(i, 8) * 45));
  }

  private async onClick(e: MouseEvent): Promise<void> {
    const b = (e.target as HTMLElement).closest('[data-lib]') as HTMLElement | null;
    // Any tap closes an open ⋯ menu (a tap on ⋯ itself toggles it below).
    const hadMenu = this.menuFor;
    this.menuFor = '';
    if (!b || !this.el) {
      if (hadMenu && this.el) this.render();
      return;
    }
    const id = (b.closest('[data-id]') as HTMLElement | null)?.dataset.id ?? '';
    const folderId = this.view.startsWith('f:') ? this.view.slice(2) : '';
    const act = b.dataset.lib;
    const wasArmed = this.armed;
    this.armed = '';
    if (hadMenu && act !== 'more') this.render();
    switch (act) {
      case 'more':
        this.menuFor = hadMenu === id ? '' : id;
        return this.render();
      case 'close':
        return this.close();
      case 'theme':
        store.setSettings({ libTheme: store.settings.libTheme === 'light' ? 'dark' : 'light' });
        return this.applyTheme(this.el);
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
      case 'download': {
        const m = this.list.find((x) => x.id === id);
        const doc = m ? await loadNotebook(id) : null;
        if (!m || !doc) return toast('Could not open that notebook');
        const total = doc.pages.length;
        const r = await askPdfRange(this.el, { total, current: id === store.doc.id ? Math.min(total, store.index + 1) : 0, title: m.title });
        if (!r) return;
        toast('Making the PDF…', 2500);
        try {
          const [{ makePdf }, { download }] = await Promise.all([import('../io/pdfvector'), import('../io/files')]);
          const { blob } = await makePdf(doc.pages.slice(r.from - 1, r.to), liteDevice() ? 2.25 : 3);
          const base = m.title.replace(/[^\w\- ]+/g, '').trim() || 'teachly';
          download(blob, r.from === 1 && r.to === total ? `${base}.pdf` : `${base} pages ${r.from}-${r.to}.pdf`);
        } catch {
          toast('Could not make the PDF');
        }
        return;
      }
      case 'cover': {
        const m = this.list.find((x) => x.id === id);
        if (!m) return;
        const v = await chooseCover(this.el, m);
        if (v === null) return;
        await setCover(id, v);
        toast(v ? 'Cover changed' : 'Showing the first page again');
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
        await this.animateOut([id]);
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
        await this.animateOut([id]);
        await restoreNotebook(id);
        toast('Notebook restored');
        return this.refresh();
      case 'purge': {
        const m = this.list.find((x) => x.id === id);
        if (!m || !(await confirmForever(this.el, [m]))) return;
        await this.animateOut([id]);
        await deleteNotebook(id);
        toast('Deleted for good');
        return this.refresh();
      }
      case 'empty': {
        const trash = this.list.filter((m) => m.trashed);
        if (!trash.length || !(await confirmForever(this.el, trash))) return;
        await this.animateOut(trash.map((m) => m.id));
        const n = await emptyTrash();
        toast(`${n} notebook${n === 1 ? '' : 's'} removed for good`);
        return this.refresh();
      }
    }
  }
}
