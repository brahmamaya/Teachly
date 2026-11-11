import { uid } from '../geometry';
import { pageRegion, renderRegion } from '../renderer';
import { newPage } from '../store';
import type { Doc } from '../types';

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
  const meta: NotebookMeta = { id: doc.id!, title: doc.title, updated: Date.now(), pages: doc.pages.length, thumb: cover(doc), folder: folder ?? prev?.folder ?? '' };
  if (prev?.trashed) meta.trashed = prev.trashed;
  const next = [meta, ...list.filter((m) => m.id !== doc.id)];
  await put([[`nb:${doc.id}`, doc], [INDEX, next]]);
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
}

/** Empty the trash: every notebook in it is removed for good. */
export async function emptyTrash(): Promise<number> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  const gone = list.filter((m) => m.trashed);
  await put([[INDEX, list.filter((m) => !m.trashed)]], gone.map((m) => `nb:${m.id}`));
  return gone.length;
}

export async function renameNotebook(id: string, title: string): Promise<void> {
  const doc = await loadNotebook(id);
  if (doc) await saveNotebook({ ...doc, title });
}

export async function duplicateNotebook(id: string): Promise<void> {
  const doc = await loadNotebook(id);
  const folder = (await listNotebooks()).find((m) => m.id === id)?.folder ?? '';
  if (doc) await saveNotebook({ ...doc, id: uid(), title: `${doc.title} (copy)` }, folder);
}

/** Put a notebook into a folder ('' = out of every folder). Its pages are not touched. */
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

export function blankNotebook(title: string, bg = '#000000'): Doc {
  return { version: 1, id: uid(), title, pages: [newPage(bg)] };
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
