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
}

const DB = 'teachly';
const STORE = 'docs';
const INDEX = 'library';
const LAST = 'teachly.lastNotebook';

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

export async function listNotebooks(): Promise<NotebookMeta[]> {
  try {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    return list.slice().sort((a, b) => b.updated - a.updated);
  } catch {
    return [];
  }
}

function cover(doc: Doc): string {
  try {
    return renderRegion(doc.pages[0], pageRegion(doc.pages[0].els), 240, 135).toDataURL('image/jpeg', 0.7);
  } catch {
    return '';
  }
}

/** Save a notebook (gives it an id first if it has none). */
export async function saveNotebook(doc: Doc): Promise<Doc> {
  if (!doc.id) doc = { ...doc, id: uid() };
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  const meta: NotebookMeta = { id: doc.id!, title: doc.title, updated: Date.now(), pages: doc.pages.length, thumb: cover(doc) };
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
    if (id) {
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

export async function deleteNotebook(id: string): Promise<void> {
  const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
  await put([[INDEX, list.filter((m) => m.id !== id)]], [`nb:${id}`]);
}

export async function renameNotebook(id: string, title: string): Promise<void> {
  const doc = await loadNotebook(id);
  if (doc) await saveNotebook({ ...doc, title });
}

export async function duplicateNotebook(id: string): Promise<void> {
  const doc = await loadNotebook(id);
  if (doc) await saveNotebook({ ...doc, id: uid(), title: `${doc.title} (copy)` });
}

export function blankNotebook(title: string, bg = '#000000'): Doc {
  return { version: 1, id: uid(), title, pages: [newPage(bg)] };
}
