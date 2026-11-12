import { liteDevice } from '../board';
import { fitInPage } from '../page';
import { getPagePicture, loadSourceBlob, putPagePicture } from './library';

// Pages of an opened PDF, drawn only when they are needed.
// The original file stays on the device; a page picture is made the first
// time the page is shown (sharp for its size on the board), stored, and
// reused after that. So even a book of hundreds of MB opens in seconds,
// and the notebook itself stays small (fast autosave while writing).
// Picture names: `pdfp:<source key>:<page index>`.

type PdfLib = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDoc = Awaited<ReturnType<PdfLib['getDocument']>['promise']>;

let lib: Promise<PdfLib> | null = null;
/** pdf.js (the legacy build carries polyfills, so older tablets and boards work too). */
export function pdfjs(): Promise<PdfLib> {
  lib ??= (async () => {
    const m = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (import.meta.env.MODE === 'single') {
      // Single-file offline build: the worker travels inside the page as text.
      const code = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw')).default;
      m.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    } else {
      m.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    }
    return m;
  })();
  return lib;
}

const docs = new Map<string, Promise<PdfDoc>>();
/**
 * Open a kept PDF. Only the parts a page needs are read from the file, so
 * a huge book never has to fit in memory at once.
 */
export function openSource(key: string, file?: Blob): Promise<PdfDoc> {
  let d = docs.get(key);
  if (!d) {
    d = (async () => {
      const blob = file ?? (await loadSourceBlob(key));
      if (!blob) throw new Error('PDF not on this device');
      const m = await pdfjs();
      const range = new m.PDFDataRangeTransport(blob.size, null);
      range.requestDataRange = (begin: number, end: number) => {
        void blob
          .slice(begin, end)
          .arrayBuffer()
          .then((buf) => range.onDataRange(begin, new Uint8Array(buf)));
      };
      return m.getDocument({ range, disableAutoFetch: true, disableStream: true }).promise;
    })();
    docs.set(key, d);
    d.catch(() => docs.delete(key));
  }
  return d;
}

/** Picture name for page `page` (0-based) of kept file `key`. */
export function pageSrc(key: string, page: number): string {
  return `pdfp:${key}:${page}`;
}

function parse(src: string): { key: string; page: number } | null {
  const m = /^pdfp:(.+):(\d+)$/.exec(src);
  return m ? { key: m[1], page: Number(m[2]) } : null;
}

/** Draw one page as a JPEG: 3x its size on the board (2.2x on classroom boards), at most ~12 MP. */
async function draw(key: string, page: number): Promise<Blob> {
  const doc = await openSource(key);
  const p = await doc.getPage(page + 1);
  try {
    const base = p.getViewport({ scale: 1 });
    const rect = fitInPage(base.width, base.height);
    const want = (rect.w * (liteDevice() ? 2.2 : 3)) / base.width;
    const scale = Math.min(5, want, Math.sqrt(12_000_000 / (base.width * base.height)));
    const vp = p.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await p.render({ canvasContext: ctx, viewport: vp, canvas } as Parameters<typeof p.render>[0]).promise;
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.92));
    canvas.width = canvas.height = 1;
    if (!blob) throw new Error('could not draw the page');
    return blob;
  } finally {
    p.cleanup();
  }
}

// One page is drawn at a time; the newest request first (that is the page
// the teacher is looking at), so flipping fast never waits for old pages.
const waiting: { src: string; done: (b: Blob | null) => void; ahead?: boolean }[] = [];
let busy = false;
async function pump(): Promise<void> {
  if (busy) return;
  busy = true;
  while (waiting.length) {
    const job = waiting.pop()!;
    const at = parse(job.src)!;
    let blob: Blob | null = null;
    try {
      blob = await draw(at.key, at.page);
      await putPagePicture(`pimg:${at.key}:${at.page}`, blob).catch(() => {});
    } catch {
      blob = null;
    }
    job.done(blob);
    // Get the next page ready too (at the back of the queue), so turning the page is instant.
    if (blob && !job.ahead) void prepare(pageSrc(at.key, at.page + 1));
    await new Promise((ok) => setTimeout(ok, 0)); // let writing go first
  }
  busy = false;
}

/** The picture of a PDF page (stored, or drawn now). */
export async function pagePicture(src: string): Promise<Blob | null> {
  const at = parse(src);
  if (!at) return null;
  const kept = await getPagePicture(`pimg:${at.key}:${at.page}`);
  if (kept) return kept;
  return new Promise((done) => {
    waiting.push({ src, done });
    void pump();
  });
}

/** Draw a page in advance, if it exists and is not stored yet. */
async function prepare(src: string): Promise<void> {
  const at = parse(src)!;
  const doc = await openSource(at.key).catch(() => null);
  if (!doc || at.page >= doc.numPages || waiting.some((w) => w.src === src)) return;
  if (await getPagePicture(`pimg:${at.key}:${at.page}`)) return;
  waiting.unshift({ src, done: () => {}, ahead: true });
  void pump();
}

const smalls = new Map<string, string>();

/** A small picture of a book page (for the page grid): drawn directly at thumbnail size, quick even for scanned books. */
export async function smallPageURL(src: string, width = 360): Promise<string | null> {
  const kept = smalls.get(src);
  if (kept) return kept;
  const at = parse(src);
  if (!at) return null;
  try {
    const doc = await openSource(at.key);
    const p = await doc.getPage(at.page + 1);
    try {
      const base = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: width / base.width });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: ctx, viewport: vp, canvas: c } as Parameters<typeof p.render>[0]).promise;
      const url = c.toDataURL('image/jpeg', 0.8);
      c.width = c.height = 1;
      smalls.set(src, url);
      if (smalls.size > 400) smalls.delete(smalls.keys().next().value as string);
      return url;
    } finally {
      p.cleanup();
    }
  } catch {
    return null;
  }
}

/** For the board: a picture address for a PDF page, or null. */
export async function pageURL(src: string): Promise<string | null> {
  const b = await pagePicture(src);
  return b ? URL.createObjectURL(b) : null;
}

/** The page as a data URL (for a .teachly file that travels to other devices). */
export async function pageDataURL(src: string): Promise<string | null> {
  const b = await pagePicture(src);
  if (!b) return null;
  return new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => ok(null);
    r.readAsDataURL(b);
  });
}
