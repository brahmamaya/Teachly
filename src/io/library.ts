import { uid } from '../geometry';
import { dataPictures, storePictures, withKeys } from './assets';
import { allKeys, atomic, db, get, put, serial, STORE } from './idb';
import { migrateDoc, SCHEMA } from './migrate';
import { imagesReady, pageRegion, renderRegion } from '../renderer';
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
  /** Starred by the teacher (shows in Favorites). */
  fav?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  created: number;
}

const INDEX = 'library';
const LAST = 'teachly.lastNotebook';
const FOLDERS = 'folders';
/** Original PDF files kept for exports: key → ids of the notebooks using it. */
const SRCREFS = 'srcrefs';

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
async function coverThumb(doc: Doc): Promise<string> {
  const first = doc.pages[0];
  const known = covers.get(first);
  if (known !== undefined) return known;
  try {
    // Pictures come from the device when first drawn: wait for them, or the cover would be blank.
    const ready = await imagesReady(first, 2500);
    const img = renderRegion(first, pageRegion(first.els), 240, 135).toDataURL('image/jpeg', 0.7);
    if (ready) covers.set(first, img);
    return img;
  } catch {
    return '';
  }
}

/** Notebooks that were repaired / converted when opened and still have to be written in the new format. */
export const pendingMigration = new Set<string>();
const migrationNotes = new Map<string, string[]>();
/** What happened to an old notebook when it was opened (shown once). */
export function takeMigrationNotes(id: string): string[] {
  const n = migrationNotes.get(id) ?? [];
  migrationNotes.delete(id);
  return n;
}

/** Original notebook data of every notebook that was converted: bak:<id>:v<format>. */
const backupKey = (id: string, v: number) => `bak:${id}:v${v}`;

/**
 * One notebook write, all or nothing:
 *  1. its pictures are stored (own transaction; if that fails nothing else is touched),
 *  2. then the notebook, the library list and the list of what it uses are written in ONE
 *     transaction, and only if no newer revision of the notebook is already stored.
 * Writes run one after another, so an older save can never finish after a newer one.
 */
async function writeNotebook(input: Doc, folder?: string): Promise<{ doc: Doc; saved: boolean }> {
  const doc = input.id ? input : { ...input, id: uid() };
  const id = doc.id!;
  const keys = await storePictures(dataPictures(doc));
  const stored: Doc = { ...withKeys(doc, keys), schema: SCHEMA, rev: doc.rev ?? 0 };
  const thumb = await coverThumb(doc);
  const uses = usedKeys(stored);
  const saved = await atomic<boolean>((os, done) => {
    const gd = os.get(`nb:${id}`);
    gd.onsuccess = () => {
      const cur = gd.result as Doc | undefined;
      // A newer revision is already stored (another window, a slow older save): keep it.
      if (cur && (cur.rev ?? 0) > (stored.rev ?? 0)) return done(false);
      const gi = os.get(INDEX);
      gi.onsuccess = () => {
        const gr = os.get(SRCREFS);
        gr.onsuccess = () => {
          const list = (gi.result as NotebookMeta[] | undefined) ?? [];
          const prev = list.find((m) => m.id === id);
          const meta: NotebookMeta = { id, title: doc.title, updated: Date.now(), pages: doc.pages.length, thumb: thumb || prev?.thumb || '', folder: folder ?? prev?.folder ?? '', portrait: isPortrait(doc) };
          if (prev?.trashed) meta.trashed = prev.trashed;
          if (prev?.cover) meta.cover = prev.cover;
          if (prev?.fav) meta.fav = true;
          const refs = (gr.result as Record<string, string[]> | undefined) ?? {};
          for (const k of Object.keys(refs)) refs[k] = refs[k].filter((x) => x !== id);
          for (const k of uses) (refs[k] ??= []).push(id);
          for (const k of Object.keys(refs)) if (!refs[k].length) delete refs[k];
          os.put(stored, `nb:${id}`);
          os.put([meta, ...list.filter((m) => m.id !== id)], INDEX);
          os.put(refs, SRCREFS);
          done(true);
        };
      };
    };
  });
  if (saved) {
    pendingMigration.delete(id);
    try {
      localStorage.setItem(LAST, id);
    } catch {
      /* ignore */
    }
  }
  return { doc, saved };
}

/** Save a notebook (gives it an id first if it has none). It stays in its folder unless `folder` is given ('' = no folder). */
export async function saveNotebook(doc: Doc, folder?: string): Promise<Doc> {
  return (await serial(() => writeNotebook(doc, folder))).doc;
}

/** The same, but says whether it was written (false: a newer revision is already stored). Errors are thrown. */
export async function saveNotebookChecked(doc: Doc): Promise<boolean> {
  return (await serial(() => writeNotebook(doc))).saved;
}

export async function loadNotebook(id: string): Promise<Doc | null> {
  try {
    const raw = await get<Doc>(`nb:${id}`);
    if (!raw || !Array.isArray(raw.pages) || !raw.pages.length) return null;
    const m = migrateDoc(raw);
    const notes = [...m.notes];
    // An older format: keep the untouched original before anything is rewritten.
    if (m.from < SCHEMA) {
      try {
        await serial(async () => {
          if (!(await get(backupKey(id, m.from)))) await put([[backupKey(id, m.from), raw]]);
        });
      } catch {
        notes.push('A copy of the original could not be kept (the device storage is nearly full).');
      }
    }
    if (m.changed) pendingMigration.add(id);
    if (notes.length) migrationNotes.set(id, notes);
    return { ...m.doc, id };
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
  return serial(async () => {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    await put([[INDEX, list.map((m) => (m.id === id ? { ...m, trashed: Date.now() } : m))]]);
  });
}

/** Take a notebook out of the trash (back into its folder if that still exists). */
export async function restoreNotebook(id: string): Promise<void> {
  return serial(async () => {
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
  });
}

/** Remove a notebook for good. */
export async function deleteNotebook(id: string): Promise<void> {
  return serial(async () => {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    await put([[INDEX, list.filter((m) => m.id !== id)]], [`nb:${id}`]);
    await dropSources([id]);
  });
}

/** Empty the trash: every notebook in it is removed for good. */
export async function emptyTrash(): Promise<number> {
  return serial(async () => {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    const gone = list.filter((m) => m.trashed);
    await put([[INDEX, list.filter((m) => !m.trashed)]], gone.map((m) => `nb:${m.id}`));
    await dropSources(gone.map((m) => m.id));
    return gone.length;
  });
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
  return serial(async () => {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    await put([[INDEX, list.map((m) => (m.id === id ? { ...m, portrait } : m))]]);
  });
}

/** Choose a notebook's cover ('' = none: the first page is shown). */
export async function setCover(id: string, cover: string): Promise<void> {
  return serial(async () => {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    await put([[INDEX, list.map((m) => (m.id === id ? { ...m, cover: cover || undefined } : m))]]);
  });
}

/** Star / un-star a notebook. */
export async function setFavorite(id: string, fav: boolean): Promise<void> {
  return serial(async () => {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    await put([[INDEX, list.map((m) => (m.id === id ? { ...m, fav: fav || undefined } : m))]]);
  });
}

export async function moveNotebook(id: string, folder: string): Promise<void> {
  return serial(async () => {
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    await put([[INDEX, list.map((m) => (m.id === id ? { ...m, folder } : m))]]);
  });
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
  return serial(async () => {
    const f: Folder = { id: uid(), name, created: Date.now() };
    await put([[FOLDERS, [...((await get<Folder[]>(FOLDERS)) ?? []), f]]]);
    return f;
  });
}

export async function renameFolder(id: string, name: string): Promise<void> {
  return serial(async () => {
    const all = (await get<Folder[]>(FOLDERS)) ?? [];
    await put([[FOLDERS, all.map((f) => (f.id === id ? { ...f, name } : f))]]);
  });
}

/** Remove a folder. Its notebooks are kept: they go back to My notebooks. */
export async function deleteFolder(id: string): Promise<void> {
  return serial(async () => {
    const all = (await get<Folder[]>(FOLDERS)) ?? [];
    const list = (await get<NotebookMeta[]>(INDEX)) ?? [];
    await put([
      [FOLDERS, all.filter((f) => f.id !== id)],
      [INDEX, list.map((m) => (m.folder === id ? { ...m, folder: '' } : m))],
    ]);
  });
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
  return serial(async () => {
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
        back.push({ id: k.slice(3), title: doc.title || 'Recovered notebook', updated: Date.now(), pages, thumb: '', folder: '' });
      }
      if (back.length) await put([[INDEX, [...back, ...list]]]);
      return back.length;
    } catch {
      return 0;
    }
  });
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

/** The source key a stored page picture belongs to. */
function pictureSource(k: string): string {
  return k.slice(5, k.lastIndexOf(':'));
}


function sourcesOf(doc: Doc): string[] {
  const keys = new Set<string>();
  for (const p of doc.pages) for (const e of p.els) if (e.type === 'image' && e.pdf) keys.add(e.pdf.src);
  return [...keys].sort();
}

/** Everything stored apart from the notebook that it uses: opened PDFs and picture assets. */
function usedKeys(doc: Doc): string[] {
  const keys = new Set(sourcesOf(doc));
  for (const p of doc.pages) for (const e of p.els) if (e.type === 'image' && e.src.startsWith('asset:')) keys.add(e.src);
  return [...keys];
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
    // The pages drawn from those files go too. Picture assets stay until the next
    // start-up tidy (a copied element may still point at one); the kept original
    // copies of converted notebooks go with their notebook.
    const keys = gone.length || ids.length ? await allKeys() : [];
    const pics = keys.filter((k) => k.startsWith('pimg:') && gone.includes(pictureSource(k)));
    const baks = keys.filter((k) => ids.some((id) => k.startsWith(`bak:${id}:`)));
    await put([[SRCREFS, refs]], [...gone.filter((k) => !k.startsWith('asset:')), ...pics, ...baks]);
  } catch {
    /* tidied up at the next start */
  }
}

/** At start: remove kept PDFs that no notebook uses (older than a day, so a fresh one is never touched). */
export async function dropUnusedSources(): Promise<void> {
  return serial(async () => {
    try {
      const keys = await allKeys();
      const refs = (await get<Record<string, string[]>>(SRCREFS)) ?? {};
      const dayAgo = Date.now() - 86_400_000;
      const old = (src: string) => !refs[src] && parseInt(src.split(':')[1], 36) < dayAgo;
      const unused = keys.filter((k) => ((k.startsWith('src:') || k.startsWith('asset:')) && old(k)) || (k.startsWith('pimg:') && old(pictureSource(k))));
      if (unused.length) await put([], unused);
    } catch {
      /* try again next start */
    }
  });
}
