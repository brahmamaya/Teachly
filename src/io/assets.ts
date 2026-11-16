import type { Doc, El, ImageEl, Page } from '../types';
import { get, put } from './idb';

// Pictures on a page (photos, camera shots, slides) are kept as separate
// files in the on-device database, once each, and the page only points to
// them ("asset:<time>:<hash>"). Why: every autosave used to write every
// picture again inside the notebook (megabytes each time); now a save only
// writes what changed, so it is quick and has a much better chance to
// finish before the app is closed.
//
// In memory a new picture is a normal data URL until the first save; a
// picture loaded from the device is an "asset:" reference whose object URL
// is made when it is first drawn (renderer.ts) and let go when it is not used.

export const isAsset = (src: string): boolean => src.startsWith('asset:');

/** data URL -> asset key, for pictures already stored in this session. */
const known = new Map<string, string>();

/** Decode a base64 data URL into a Blob (no network, so no CSP surprises). */
function dataToBlob(url: string): Blob {
  const comma = url.indexOf(',');
  const head = url.slice(5, comma);
  const mime = head.split(';')[0] || 'application/octet-stream';
  if (!/;base64$/i.test(head)) return new Blob([decodeURIComponent(url.slice(comma + 1))], { type: mime });
  const bin = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** A short fingerprint of the bytes (SHA-256 where the browser has it, otherwise FNV-1a). */
async function fingerprint(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  if (crypto?.subtle) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    return [...d.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811c9dc5;
  const v = new Uint8Array(buf);
  for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v[i], 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0') + v.length.toString(16);
}

/**
 * Make sure every data-URL picture in `docs` is stored; returns data URL ->
 * asset key. Everything new is written in one transaction: if it fails,
 * nothing is half stored and the caller must not save the pages.
 */
export async function storePictures(srcs: Iterable<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const fresh: [string, Blob][] = [];
  const time = Date.now().toString(36);
  for (const src of new Set(srcs)) {
    if (!src.startsWith('data:')) continue;
    const have = known.get(src);
    if (have) {
      out.set(src, have);
      continue;
    }
    const blob = dataToBlob(src);
    const key = `asset:${time}:${await fingerprint(blob)}`;
    fresh.push([key, blob]);
    out.set(src, key);
  }
  if (fresh.length) await put(fresh);
  // Remember only after the write went through.
  for (const [src, key] of out) known.set(src, key);
  return out;
}

/** The stored picture as a file (null if it is gone). */
export async function assetBlob(key: string): Promise<Blob | null> {
  try {
    return (await get<Blob>(key)) ?? null;
  } catch {
    return null;
  }
}

/** A fresh object URL for a stored picture; the caller lets it go with URL.revokeObjectURL. */
export async function assetURL(key: string): Promise<string | null> {
  const b = await assetBlob(key);
  return b ? URL.createObjectURL(b) : null;
}

function blobToDataURL(b: Blob): Promise<string> {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(b);
  });
}

/** The pages with every "asset:" picture written out as a data URL (for files, PDFs, copies to other devices). */
export async function inlinePictures(pages: Page[]): Promise<Page[]> {
  const cache = new Map<string, string>();
  const need = new Set<string>();
  for (const p of pages) for (const e of p.els) if (e.type === 'image' && isAsset(e.src)) need.add(e.src);
  for (const key of need) {
    const b = await assetBlob(key);
    if (b) cache.set(key, await blobToDataURL(b));
  }
  if (!cache.size) return pages;
  return pages.map((p) => ({
    ...p,
    els: p.els.map((e) => (e.type === 'image' && cache.has(e.src) ? ({ ...e, src: cache.get(e.src)! } as ImageEl) : e)),
  }));
}

/** The same notebook, ready to be saved: data-URL pictures replaced by their stored keys. */
export function withKeys(doc: Doc, keys: Map<string, string>): Doc {
  if (!keys.size) return doc;
  const swap = (e: El): El => (e.type === 'image' && keys.has(e.src) ? ({ ...e, src: keys.get(e.src)! } as ImageEl) : e);
  return { ...doc, pages: doc.pages.map((p) => (p.els.some((e) => e.type === 'image' && keys.has(e.src)) ? { ...p, els: p.els.map(swap) } : p)) };
}

/** Every data-URL picture on the notebook's pages. */
export function dataPictures(doc: Doc): string[] {
  const out: string[] = [];
  for (const p of doc.pages) for (const e of p.els) if (e.type === 'image' && e.src.startsWith('data:')) out.push(e.src);
  return out;
}
