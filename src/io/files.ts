import type { Board } from '../board';
import { uid } from '../geometry';
import { contentBounds, renderRegion } from '../renderer';
import { newPage, store } from '../store';
import type { Doc, El, ImageEl, Page, Rect } from '../types';

// ---------------------------------------------------------------------------
// Autosave (IndexedDB)

const DB = 'teachly';
const STORE = 'docs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocal(doc: Doc): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(doc, 'current');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadLocal(): Promise<Doc | null> {
  try {
    const db = await openDb();
    const doc = await new Promise<Doc | null>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get('current');
      req.onsuccess = () => resolve((req.result as Doc) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return doc && Array.isArray(doc.pages) && doc.pages.length ? doc : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers

export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.click();
  });
}

export function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Downscale very large images so documents stay light. */
async function normalizeImage(src: string, maxSide = 2400): Promise<{ src: string; w: number; h: number }> {
  const img = await loadImg(src);
  let w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) <= maxSide) return { src, w, h };
  const k = maxSide / Math.max(w, h);
  w = Math.round(w * k);
  h = Math.round(h * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return { src: c.toDataURL('image/jpeg', 0.9), w, h };
}

function safeName(s: string): string {
  return s.replace(/[^\w\- ]+/g, '').trim() || 'teachly';
}

// ---------------------------------------------------------------------------
// Insert media

/** Place an image centred in the current view, scaled to fit nicely. */
export async function insertImageSrc(board: Board, dataUrl: string, at?: { x: number; y: number }): Promise<ImageEl> {
  const { src, w, h } = await normalizeImage(dataUrl);
  const v = board.viewRect();
  const k = Math.min(1, (v.w * 0.6) / w, (v.h * 0.6) / h);
  const el: ImageEl = {
    id: uid(),
    type: 'image',
    src,
    w: w * k,
    h: h * k,
    x: (at?.x ?? v.x + v.w / 2) - (w * k) / 2,
    y: (at?.y ?? v.y + v.h / 2) - (h * k) / 2,
    rot: 0,
  };
  store.addEls([el]);
  return el;
}

export async function insertImages(board: Board, files?: File[]): Promise<void> {
  files ??= await pickFiles('image/*', true);
  const ids: string[] = [];
  let offset = 0;
  for (const f of files) {
    const v = board.viewRect();
    const el = await insertImageSrc(board, await readAsDataURL(f), { x: v.x + v.w / 2 + offset, y: v.y + v.h / 2 + offset });
    ids.push(el.id);
    offset += 30 / board.cam.z;
  }
  if (ids.length) {
    store.setTool({ tool: 'select' });
    store.select(ids);
  }
}

/** Import every PDF page as a new board page with the page locked as background. */
export async function importPdf(board: Board, file?: File, onProgress?: (done: number, total: number) => void): Promise<void> {
  file ??= (await pickFiles('application/pdf'))[0];
  if (!file) return;
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: Page[] = [];
  const W = 1280;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 2000 / base.width);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas } as Parameters<typeof page.render>[0]).promise;
    const h = (W * vp.height) / vp.width;
    const img: ImageEl = { id: uid(), type: 'image', src: canvas.toDataURL('image/jpeg', 0.88), x: 0, y: 0, w: W, h, rot: 0, locked: true };
    const p = newPage('#e2e8f0', 'none');
    p.els = [img];
    pages.push(p);
    onProgress?.(i, pdf.numPages);
  }
  if (!pages.length) return;
  const all = store.doc.pages.slice();
  // Replace the current page if it is empty, otherwise insert after it.
  const replace = store.page.els.length === 0;
  all.splice(replace ? store.index : store.index + 1, replace ? 1 : 0, ...pages);
  store.commit(all, replace ? store.index : store.index + 1);
  board.fitContent();
}

// ---------------------------------------------------------------------------
// Save / open lesson files

export function saveFile(): void {
  const doc = store.doc;
  const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
  download(blob, `${safeName(doc.title)}.teachly`);
}

export async function openFile(file?: File): Promise<void> {
  file ??= (await pickFiles('.teachly,.json,application/json'))[0];
  if (!file) return;
  try {
    const doc = JSON.parse(await file.text()) as Doc;
    if (!Array.isArray(doc.pages)) throw new Error('Not a Teachly file');
    store.loadDoc({ version: 1, title: doc.title || file.name.replace(/\.\w+$/, ''), pages: doc.pages.length ? doc.pages : [newPage()] });
  } catch (e) {
    alert(`Could not open file: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Export

function pageRegion(board: Board, page: Page): Rect {
  const b = contentBounds(page.els);
  const pad = 40;
  if (!b) {
    const v = board.viewRect();
    return v;
  }
  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
}

function exportCanvas(board: Board, page: Page, maxSide = 2400): HTMLCanvasElement {
  const r = pageRegion(board, page);
  const k = Math.min(3, maxSide / Math.max(r.w, r.h));
  return renderRegion(page, r, r.w * k, r.h * k);
}

export function exportPng(board: Board): void {
  const c = exportCanvas(board, store.page);
  c.toBlob((b) => b && download(b, `${safeName(store.doc.title)}-page${store.index + 1}.png`), 'image/png');
}

export async function exportPdf(board: Board): Promise<void> {
  const { jsPDF } = await import('jspdf');
  let pdf: InstanceType<typeof jsPDF> | null = null;
  for (const page of store.doc.pages) {
    const c = exportCanvas(board, page, 2000);
    const w = c.width, h = c.height;
    const orient = w >= h ? 'landscape' : 'portrait';
    if (!pdf) pdf = new jsPDF({ orientation: orient, unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
    else pdf.addPage([w, h], orient);
    pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h);
  }
  pdf?.save(`${safeName(store.doc.title)}.pdf`);
}

/** Paste handler: images from clipboard, or internal element clipboard. */
let elementClipboard: El[] = [];

export function copySelection(): void {
  elementClipboard = store.selectedEls().map((e) => structuredClone(e));
}

export function pasteElements(board: Board): boolean {
  if (!elementClipboard.length) return false;
  const off = 24 / board.cam.z;
  const els = elementClipboard.map((e) => {
    const c = structuredClone(e) as El;
    c.id = uid();
    if (c.type === 'path') c.pts = c.pts.map((v, i) => (i % 3 === 2 ? v : v + off));
    else {
      c.x += off;
      c.y += off;
    }
    return c;
  });
  elementClipboard = els.map((e) => structuredClone(e));
  store.addEls(els);
  store.setTool({ tool: 'select' });
  store.select(els.map((e) => e.id));
  return true;
}
