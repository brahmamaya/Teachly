import { blankNotebook, saveNotebook, setCover } from '../io/library';
import type { Doc } from '../types';
import { COVERS, coverHTML } from './covers';
import { icon } from './icons';
import { fadeOut } from './panel';

// New notebook: its name, its shape (horizontal or vertical page) and,
// if wanted, a cover. Everything is optional: "Create" alone makes a plain
// horizontal notebook like before.

export interface NewNotebook {
  title: string;
  portrait: boolean;
  /** Cover id, '' = none (the first page is shown). */
  cover: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** The sheet. Resolves with the choices, or null if cancelled. */
export function askNewNotebook(host: HTMLElement, o: { name: string }): Promise<NewNotebook | null> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'sv-back dl-back';
    let portrait = false;
    let cover = '';
    const shapeBtn = (p: boolean, label: string) =>
      `<button type="button" class="nn-shape" data-shape="${p ? 'p' : 'l'}"><i class="nn-ico ${p ? 'tall' : 'wide'}"></i><span>${label}</span></button>`;
    back.innerHTML = `
      <form class="dl-box nn-box" role="dialog" aria-label="New notebook" novalidate>
        <header class="dl-head">
          <button type="button" class="dl-back-btn" data-n="cancel" aria-label="Back">${icon('prev', 22)}</button>
          <h3>New notebook</h3>
          <span class="dl-sp"></span>
        </header>
        <div class="nn-body">
          <label class="nn-label">Name<input class="sv-input" name="t" value="${esc(o.name)}" maxlength="60" placeholder="Notebook name" autocomplete="off"></label>
          <div class="nn-label">Page shape</div>
          <div class="nn-shapes">${shapeBtn(false, 'Horizontal')}${shapeBtn(true, 'Vertical')}</div>
          <div class="nn-label">Cover <small>(optional)</small></div>
          <div class="cv-grid wide" data-grid></div>
        </div>
        <button type="submit" class="dl-go">${icon('plus', 20)}<span>Create</span></button>
      </form>`;
    host.appendChild(back);
    const box = back.querySelector('.nn-box') as HTMLFormElement;
    const grid = box.querySelector('[data-grid]') as HTMLElement;
    const input = box.querySelector('input') as HTMLInputElement;

    // The covers are drawn for the chosen shape and carry the name being typed.
    const paint = () => {
      const title = input.value.trim() || o.name;
      box.querySelectorAll<HTMLElement>('.nn-shape').forEach((b) => b.classList.toggle('on', (b.dataset.shape === 'p') === portrait));
      grid.className = `cv-grid ${portrait ? 'tall' : 'wide'}`;
      grid.innerHTML = `<button type="button" class="cv-opt ${cover === '' ? 'on' : ''}" data-cv="">
          <span class="cv-none" data-o="${portrait ? 'p' : 'l'}"><span class="cv-blank">Plain</span></span><span class="cv-name">No cover</span></button>
        ${COVERS.map((c) => `<button type="button" class="cv-opt ${cover === c.id ? 'on' : ''}" data-cv="${c.id}">${coverHTML(c, title, portrait)}<span class="cv-name">${c.name}</span></button>`).join('')}`;
    };
    paint();

    const done = (v: NewNotebook | null) => {
      fadeOut(back, 180);
      resolve(v);
    };
    box.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const shape = (t.closest('[data-shape]') as HTMLElement | null)?.dataset.shape;
      if (shape) {
        portrait = shape === 'p';
        return paint();
      }
      const cv = t.closest('[data-cv]') as HTMLElement | null;
      if (cv) {
        cover = cv.dataset.cv ?? '';
        return paint();
      }
      if ((t.closest('[data-n]') as HTMLElement | null)?.dataset.n === 'cancel') done(null);
    });
    input.addEventListener('input', () => {
      // Only the names on the covers change (the chosen look stays).
      const title = input.value.trim() || o.name;
      grid.querySelectorAll('.nbc-t').forEach((n) => (n.textContent = title));
    });
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      done({ title: input.value.trim() || o.name, portrait, cover });
    });
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) done(null);
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') done(null);
    });
    input.select();
  });
}

/** Ask, then make and save the notebook (in `folder`). Null if cancelled. */
export async function newNotebookFlow(host: HTMLElement, o: { name: string; bg: string; folder?: string }): Promise<Doc | null> {
  const r = await askNewNotebook(host, { name: o.name });
  if (!r) return null;
  const doc = await saveNotebook(blankNotebook(r.title, o.bg, r.portrait ? 'portrait' : undefined), o.folder ?? '');
  if (r.cover) await setCover(doc.id!, r.cover);
  return doc;
}
