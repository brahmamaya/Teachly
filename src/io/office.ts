import type { Board } from '../board';
import { uid } from '../geometry';
import { fitInPage } from '../page';
import { newPage, store } from '../store';
import type { ImageEl, Page } from '../types';

// PowerPoint (.pptx) import: every slide becomes a board page with the slide
// as a locked picture, so the teacher can write on top of it (like PDFs).

const SLIDE_W = 1280;

export async function importPptx(board: Board, file: File, onProgress?: (done: number, total: number) => void): Promise<void> {
  const [{ init }, { default: html2canvas }] = await Promise.all([import('pptx-preview'), import('html2canvas')]);
  // Render the deck off-screen in list mode (all slides stacked).
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${SLIDE_W}px;pointer-events:none;`;
  document.body.appendChild(host);
  try {
    const previewer = init(host, { width: SLIDE_W, mode: 'list' });
    await previewer.preview(await file.arrayBuffer());
    // Give fonts and pictures a moment to load.
    await new Promise((r) => setTimeout(r, 300));
    const slides = findSlides(host);
    if (!slides.length) throw new Error('No slides found in this file');
    const pages: Page[] = [];
    for (let i = 0; i < slides.length; i++) {
      const el = slides[i];
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
      // Each slide fills the board page (16:9 slides fit it exactly).
      const rect = fitInPage(canvas.width, canvas.height);
      const img: ImageEl = { id: uid(), type: 'image', src: canvas.toDataURL('image/jpeg', 0.9), ...rect, rot: 0, locked: true };
      const p = newPage(store.page.bg, 'none');
      p.els = [img];
      pages.push(p);
      onProgress?.(i + 1, slides.length);
    }
    previewer.destroy();
    addPages(pages);
    board.fitPage();
  } finally {
    host.remove();
  }
}

/** The previewer wraps each slide in its own element; pick the slide boxes. */
function findSlides(host: HTMLElement): HTMLElement[] {
  const named = host.querySelectorAll<HTMLElement>('.pptx-preview-slide-wrapper');
  if (named.length) return [...named];
  // Fallback: the largest repeated child boxes.
  const all = [...host.querySelectorAll<HTMLElement>('div')].filter((d) => d.offsetWidth >= SLIDE_W * 0.9 && d.offsetHeight >= 200);
  return all.filter((d) => !all.some((o) => o !== d && o.contains(d) && o.offsetHeight < d.offsetHeight * 1.2 && o !== host));
}

/** Insert pages after the current one (or replace it when it is empty). */
export function addPages(pages: Page[]): void {
  const all = store.doc.pages.slice();
  const replace = store.page.els.length === 0;
  all.splice(replace ? store.index : store.index + 1, replace ? 1 : 0, ...pages);
  store.commit(all, replace ? store.index : store.index + 1);
}
