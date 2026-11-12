import { uid } from '../geometry';
import { pageRegion, renderRegion } from '../renderer';
import { PAGE } from '../page';
import { newPage } from '../store';
import type { Doc, ImageEl } from '../types';

// On-device notebook library (IndexedDB). Unlimited notebooks, each saved
// on its own, plus a small index with titles and cover pictures so the
// library opens instantly even with hundreds of notebooks.

export interface NotebookMeta {
  id: string;
  title: string;
  updated: number;
  pages: number;
  /** Small JPEG of the first page. */
  thumb: string;
  /** Folder id ('' or missing = not in a folder). */
  folder?: string;
  /** When it was put in the trash (missing = not in the trash). */
  trashed?: number;
  /** Chosen notebook cover (see ui/covers.ts); missing = show the first page. */
  cover?: string;
  /** A tall (vertical) notebook? Decides the shape of its cover. Missing = wide. */
  portrait?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  created: number;
}

const DB = 'teachly';
const STORE = 'docs';
const INDEX = 'library';
const LAST = 'teachly.lastNotebook';
const FOLDERS = 'folders';
/** Original PDF files kept for exports: key → ids of the notebooks using it. */
const SRCREFS = 'srcrefs';

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbp = null;
      reject(req.error);
    };
  });
  return dbp;
}

async function get<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function put(entries: [string, unknown][], remove: string[] = []): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    for (const [k, v] of entries) os.put(v, k);
    for (const k of remove) os.delete(k);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Notebooks, newest first. Ones in the trash only when asked for. */
export async function listNotebooks(withTrash = false): Promise<NotebookMeta[]> {
  try {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    return list.filter((m) => withTrash || !m.trashed).sort((a, b) => b.updated - a.updated);
  } catch {
    return [];
  }
}

// Covers are only redrawn when the first page actually changed.
const covers = new WeakMap<object, string>();
function cover(doc: Doc): string {
  const first = doc.pages[0];
  const known = covers.get(first);
  if (known !== undefined) return known;
  try {
    const img = renderRegion(first, pageRegion(first.els), 240, 135).toDataURL('image/jpeg', 0.7);
    covers.set(first, img);
    return img;
  } catch {
    return '';
  }
}

/**
 * Save a notebook (gives it an id first if it has none). It stays in its
 * folder unless `folder` is given ('' = no folder).
 */
export async function saveNotebook(doc: Doc, folder?: string): Promise<Doc> {
  if (!doc.id) doc = { ...doc, id: uid() };
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  const prev = list.find((m) => m.id === doc.id);
  const meta: NotebookMeta = { id: doc.id!, title: doc.title, updated: Date.now(), pages: doc.pages.length, thumb: cover(doc), folder: folder ?? prev?.folder ?? '', portrait: isPortrait(doc) };
  if (prev?.trashed) meta.trashed = prev.trashed;
  if (prev?.cover) meta.cover = prev.cover;
  const next = [meta, ...list.filter((m) => m.id !== doc.id)];
  await put([[`nb:${doc.id}`, doc], [INDEX, next]]);
  await noteSources(doc);
  try {
    localStorage.setItem(LAST, doc.id!);
  } catch {
    /* ignore */
  }
  return doc;
}

export async function loadNotebook(id: string): Promise<Doc | null> {
  try {
    const doc = await get<Doc>(`nb:${id}`);
    return doc && Array.isArray(doc.pages) && doc.pages.length ? { ...doc, id } : null;
  } catch {
    return null;
  }
}

/** The notebook that was open last time (moves an old single autosave into the library). */
export async function loadLastNotebook(): Promise<Doc | null> {
  try {
    let id: string | null = null;
    try {
      id = localStorage.getItem(LAST);
    } catch {
      /* ignore */
    }
    if (id && (await listNotebooks()).some((m) => m.id === id)) {
      const doc = await loadNotebook(id);
      if (doc) return doc;
    }
    const old = await get<Doc>('current');
    if (old && Array.isArray(old.pages) && old.pages.length) {
      const doc = await saveNotebook({ ...old, title: old.title || 'My first notebook' });
      await put([], ['current']);
      return doc;
    }
    const list = await listNotebooks();
    return list.length ? loadNotebook(list[0].id) : null;
  } catch {
    return null;
  }
}

/** Delete = move to the trash (nothing is lost until the trash is emptied). */
export async function trashNotebook(id: string): Promise<void> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  await put([[INDEX, list.map((m) => (m.id === id ? { ...m, trashed: Date.now() } : m))]]);
}

/** Take a notebook out of the trash (back into its folder if that still exists). */
export async function restoreNotebook(id: string): Promise<void> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  const folders = new Set(((await get<Folder[]>(FOLDERS)) ?? []).map((f) => f.id));
  await put([
    [
      INDEX,
      list.map((m) => {
        if (m.id !== id) return m;
        const { trashed: _t, ...rest } = m;
        return { ...rest, folder: m.folder && folders.has(m.folder) ? m.folder : '' };
      }),
    ],
  ]);
}

/** Remove a notebook for good. */
export async function deleteNotebook(id: string): Promise<void> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  await put([[INDEX, list.filter((m) => m.id !== id)]], [`nb:${id}`]);
  await dropSources([id]);
}

/** Empty the trash: every notebook in it is removed for good. */
export async function emptyTrash(): Promise<number> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  const gone = list.filter((m) => m.trashed);
  await put([[INDEX, list.filter((m) => !m.trashed)]], gone.map((m) => `nb:${m.id}`));
  await dropSources(gone.map((m) => m.id));
  return gone.length;
}

export async function renameNotebook(id: string, title: string): Promise<void> {
  const doc = await loadNotebook(id);
  if (doc) await saveNotebook({ ...doc, title });
}

export async function duplicateNotebook(id: string): Promise<void> {
  const doc = await loadNotebook(id);
  const folder = (await listNotebooks()).find((m) => m.id === id)?.folder ?? '';
  if (!doc) return;
  const copy = await saveNotebook({ ...doc, id: uid(), title: `${doc.title} (copy)` }, folder);
  const cover = (await listNotebooks()).find((m) => m.id === id)?.cover;
  if (cover) await setCover(copy.id!, cover);
}

/** Put a notebook into a folder ('' = out of every folder). Its pages are not touched. */
/** A vertical notebook: its first page is a tall book page, or the screen is held upright. */
export function isPortrait(doc: Doc): boolean {
  if (doc.orient === 'portrait') return true;
  const first = doc.pages[0];
  const book = first?.els.find((e): e is ImageEl => e.type === 'image' && !!e.locked);
  if (book) return book.h > book.w * 1.1;
  return PAGE.h > PAGE.w * 1.1;
}

/** Remember whether a notebook is vertical (for notebooks saved before this was known). */
export async function setPortrait(id: string, portrait: boolean): Promise<void> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  await put([[INDEX, list.map((m) => (m.id === id ? { ...m, portrait } : m))]]);
}

/** Choose a notebook's cover ('' = none: the first page is shown). */
export async function setCover(id: string, cover: string): Promise<void> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  await put([[INDEX, list.map((m) => (m.id === id ? { ...m, cover: cover || undefined } : m))]]);
}

export async function moveNotebook(id: string, folder: string): Promise<void> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  await put([[INDEX, list.map((m) => (m.id === id ? { ...m, folder } : m))]]);
}

// ---- folders -------------------------------------------------------------

export async function listFolders(): Promise<Folder[]> {
  try {
    return ((await get<Folder[]>(FOLDERS)) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function createFolder(name: string): Promise<Folder> {
  const f: Folder = { id: uid(), name, created: Date.now() };
  await put([[FOLDERS, [...((await get<Folder[]>(FOLDERS)) ?? []), f]]]);
  return f;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const all = (await get<Folder[]>(FOLDERS)) ?? [];
  await put([[FOLDERS, all.map((f) => (f.id === id ? { ...f, name } : f))]]);
}

/** Remove a folder. Its notebooks are kept: they go back to My notebooks. */
export async function deleteFolder(id: string): Promise<void> {
  const all = (await get<Folder[]>(FOLDERS)) ?? [];
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  await put([
    [FOLDERS, all.filter((f) => f.id !== id)],
    [INDEX, list.map((m) => (m.folder === id ? { ...m, folder: '' } : m))],
  ]);
}

export function blankNotebook(title: string, bg = '#000000', orient?: 'portrait'): Doc {
  return { version: 1, id: uid(), title, pages: [newPage(bg)], ...(orient ? { orient } : {}) };
}

/**
 * Never lose a notebook: any saved notebook that is missing from the library
 * list (for example if the list itself was damaged) is put back into it.
 * Nothing is ever deleted here.
 */
export async function recoverOrphans(): Promise<number> {
  try {
    const d = await db();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const req = d.transaction(STORE).objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    const known = new Set(list.map((m) => `nb:${m.id}`));
    const back: NotebookMeta[] = [];
    for (const k of keys.map(String)) {
      if (!k.startsWith('nb:') || known.has(k)) continue;
      const doc = await get<Doc>(k);
      if (!doc || !Array.isArray(doc.pages) || !doc.pages.length) continue;
      const pages = doc.pages.length;
      back.push({ id: k.slice(3), title: doc.title || 'Recovered notebook', updated: Date.now(), pages, thumb: cover(doc), folder: '' });
    }
    if (back.length) await put([[INDEX, [...back, ...list]]]);
    return back.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Original PDF files (so a saved PDF reuses the real pages: small and sharp)

/** Keep a copy of an opened PDF file on the device; returns its key. */
export async function saveSource(file: Blob): Promise<string> {
  const key = `src:${Date.now().toString(36)}:${uid()}`;
  // Stored as a file (no copy in memory), so even very big PDFs fit.
  await put([[key, file]]);
  return key;
}

/** The kept original as a file (older notebooks kept it as bytes). */
export async function loadSourceBlob(key: string): Promise<Blob | null> {
  try {
    const v = await get<Blob | ArrayBuffer>(key);
    if (!v) return null;
    return v instanceof Blob ? v : new Blob([v], { type: 'application/pdf' });
  } catch {
    return null;
  }
}

export async function loadSource(key: string): Promise<ArrayBuffer | null> {
  return (await loadSourceBlob(key))?.arrayBuffer() ?? null;
}

/** A page of a kept PDF, drawn once and stored (`pimg:<source>:<page>`). */
export async function getPagePicture(key: string): Promise<Blob | null> {
  try {
    return (await get<Blob>(key)) ?? null;
  } catch {
    return null;
  }
}

export async function putPagePicture(key: string, pic: Blob): Promise<void> {
  await put([[key, pic]]);
}

async function allKeys(): Promise<string[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result.map(String));
    req.onerror = () => reject(req.error);
  });
}

/** The source key a stored page picture belongs to. */
function pictureSource(k: string): string {
  return k.slice(5, k.lastIndexOf(':'));
}

function sourcesOf(doc: Doc): string[] {
  const keys = new Set<string>();
  for (const p of doc.pages) for (const e of p.els) if (e.type === 'image' && e.pdf) keys.add(e.pdf.src);
  return [...keys].sort();
}

// Last list written per notebook, so the usual autosave writes nothing extra.
const noted = new Map<string, string>();
/** Remember which original PDFs this notebook uses. */
async function noteSources(doc: Doc): Promise<void> {
  const mine = sourcesOf(doc);
  const sig = mine.join('|');
  if (noted.get(doc.id!) === sig) return;
  const refs = (await get<Record<string, string[]>>(SRCREFS)) ?? {};
  for (const k of Object.keys(refs)) refs[k] = refs[k].filter((id) => id !== doc.id);
  for (const k of mine) (refs[k] ??= []).push(doc.id!);
  for (const k of Object.keys(refs)) if (!refs[k].length) delete refs[k];
  await put([[SRCREFS, refs]]);
  noted.set(doc.id!, sig);
}

/** Notebooks deleted for good: their original PDFs go too, unless another notebook uses them. */
async function dropSources(ids: string[]): Promise<void> {
  try {
    const refs = (await get<Record<string, string[]>>(SRCREFS)) ?? {};
    const gone: string[] = [];
    for (const k of Object.keys(refs)) {
      refs[k] = refs[k].filter((id) => !ids.includes(id));
      if (!refs[k].length) {
        delete refs[k];
        gone.push(k);
      }
    }
    for (const id of ids) noted.delete(id);
    // The pages drawn from those files go too.
    const pics = gone.length ? (await allKeys()).filter((k) => k.startsWith('pimg:') && gone.includes(pictureSource(k))) : [];
    await put([[SRCREFS, refs]], [...gone, ...pics]);
  } catch {
    /* tidied up at the next start */
  }
}

/** At start: remove kept PDFs that no notebook uses (older than a day, so a fresh one is never touched). */
export async function dropUnusedSources(): Promise<void> {
  try {
    const keys = await allKeys();
    const refs = (await get<Record<string, string[]>>(SRCREFS)) ?? {};
    const dayAgo = Date.now() - 86_400_000;
    const old = (src: string) => !refs[src] && parseInt(src.split(':')[1], 36) < dayAgo;
    const unused = keys.filter((k) => (k.startsWith('src:') && old(k)) || (k.startsWith('pimg:') && old(pictureSource(k))));
    if (unused.length) await put([], unused);
  } catch {
    /* try again next start */
  }
}
