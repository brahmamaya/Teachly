import { type Board, liteDevice } from '../board';
import { regroup, uid } from '../geometry';
import { fitInPage, PAGE } from '../page';
import { pageRegion, renderRegion } from '../renderer';
import { newPage, store } from '../store';
import type { Doc, El, ImageEl, Page, Rect } from '../types';
import { isAppleTouch } from '../ui/install';

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

/** The Teachly Android app (APK) passes files to the device through this bridge. */
interface AndroidBridge {
  saveFile(base64: string, name: string, mime: string): void;
}
export function androidApp(): AndroidBridge | null {
  return (window as unknown as { TeachlyAndroid?: AndroidBridge }).TeachlyAndroid ?? null;
}

export function download(blob: Blob, name: string): void {
  const app = androidApp();
  if (app) {
    // In the Android app: save straight into Downloads/Teachly.
    const r = new FileReader();
    r.onload = () => app.saveFile(String(r.result).split(',')[1] ?? '', name, blob.type || 'application/octet-stream');
    r.readAsDataURL(blob);
    return;
  }
  // iPad / iPhone: the share sheet (Save to Files, AirDrop, WhatsApp…)
  // instead of Safari's download page.
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (isAppleTouch() && nav.share && nav.canShare) {
    const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
    if (nav.canShare({ files: [file] })) {
      nav.share({ files: [file] } as ShareData).catch((e: Error) => {
        if (e.name !== 'AbortError') saveWithLink(blob, name);
      });
      return;
    }
  }
  saveWithLink(blob, name);
}

function saveWithLink(blob: Blob, name: string): void {
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
  // Never bigger than ~70% of the page.
  const k = Math.min(1, (Math.min(v.w, PAGE.w) * 0.7) / w, (Math.min(v.h, PAGE.h) * 0.7) / h);
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
  // The legacy build carries polyfills, so PDFs open on older tablets and boards too.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (import.meta.env.MODE === 'single') {
    // Single-file offline build: the worker travels inside the page as text.
    const code = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  } else {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  }
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: Page[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    // Each PDF page sits exactly on the board page (whole page visible).
    const rect = fitInPage(base.width, base.height);
    // Crisp when zoomed in (3x the page; classroom boards 2.2x to save
    // memory), at most ~12 million pixels per page.
    const want = (rect.w * (liteDevice() ? 2.2 : 3)) / base.width;
    const scale = Math.min(5, want, Math.sqrt(12_000_000 / (base.width * base.height)));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas } as Parameters<typeof page.render>[0]).promise;
    const img: ImageEl = { id: uid(), type: 'image', src: canvas.toDataURL('image/jpeg', 0.92), ...rect, rot: 0, locked: true };
    const p = newPage(store.page.bg, 'none');
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
  board.fitPage();
}

// ---------------------------------------------------------------------------
// Save / open lesson files

export function saveFile(): void {
  const doc = store.doc;
  const blob = new Blob([JSON.stringify(doc)], { type: 'application/octet-stream' });
  download(blob, `${safeName(doc.title)}.teachly`);
}

export async function openFile(file?: File): Promise<void> {
  // iPad / iPhone do not know the .teachly type and would grey the file out.
  file ??= (await pickFiles(isAppleTouch() ? '' : '.teachly,.json,application/json'))[0];
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

function exportCanvas(_board: Board, page: Page, maxSide = 4800): HTMLCanvasElement {
  // Exports show the page plus anything written beyond it, sharp (up to 3x).
  const r: Rect = pageRegion(page.els);
  const k = Math.min(3, maxSide / Math.max(r.w, r.h), Math.sqrt(14_000_000 / (r.w * r.h)));
  return renderRegion(page, r, r.w * k, r.h * k);
}

export function exportPng(board: Board): void {
  const c = exportCanvas(board, store.page);
  c.toBlob((b) => b && download(b, `${safeName(store.doc.title)}-page${store.index + 1}.png`), 'image/png');
}

/**
 * PDF of every page, sharp enough to zoom into and print: each page is drawn
 * at about 3x the board's own size (lighter on classroom boards), kept at the
 * page's real proportions, one page at a time so the app never freezes.
 */
export async function exportPdf(_board: Board): Promise<void> {
  const { jsPDF } = await import('jspdf');
  let pdf: InstanceType<typeof jsPDF> | null = null;
  const canvas = document.createElement('canvas');
  for (const page of store.doc.pages) {
    const r: Rect = pageRegion(page.els);
    // ~4800 px wide for a normal page; never more than ~14 million pixels
    // (the limit iPads allow for one picture).
    const k = Math.min(liteDevice() ? 2.25 : 3, Math.sqrt(14_000_000 / (r.w * r.h)));
    const c = renderRegion(page, r, r.w * k, r.h * k, canvas);
    const orient = r.w >= r.h ? 'landscape' : 'portrait';
    if (!pdf) pdf = new jsPDF({ orientation: orient, unit: 'px', format: [r.w, r.h], hotfixes: ['px_scaling'], compress: true });
    else pdf.addPage([r.w, r.h], orient);
    pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, r.w, r.h, undefined, 'NONE');
    await new Promise((ok) => setTimeout(ok, 0)); // let the screen breathe between pages
  }
  canvas.width = canvas.height = 1;
  if (pdf) download(pdf.output('blob'), `${safeName(store.doc.title)}.pdf`);
}

/** Paste handler: images from clipboard, or internal element clipboard. */
let elementClipboard: El[] = [];

export function copySelection(): void {
  elementClipboard = store.selectedEls().map((e) => structuredClone(e));
}

export function pasteElements(board: Board): boolean {
  if (!elementClipboard.length) return false;
  const off = 24 / board.cam.z;
  const els = regroup(elementClipboard).map((e) => {
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
