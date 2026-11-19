import { store } from '../store';
import { viewportBottom } from './subjectpanel';

// Quick bar: while a pen (or shape) is chosen, a small pill floats next to the toolbar with a
// few colours and three line sizes, so changing colour or thickness is ONE tap (the full menu
// stays on a second tap of the pen button). Reacts on finger-down; only a few class changes
// per tool change, nothing is redrawn while writing.

const COLORS = ['#f2f2f0', '#db0000', '#ed6d00', '#febf00', '#4ceb45', '#174ebd', '#d500a6'];
const HL_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6'];
/** The few colours shown while the subject dock shares the line (white, yellow, green, blue). */
const KEEP = new Set(['#f2f2f0', '#febf00', '#4ceb45', '#174ebd', ...HL_COLORS]);

export class QuickBar {
  private el: HTMLElement;
  private key = '';
  /** With the subject dock open the bar shows only a few colours; the little arrow opens the whole bar. */
  private expanded = false;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'quickbar';
    this.el.hidden = true;
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'Colour and size');
    host.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
      if (!b) return;
      e.preventDefault(); // the board keeps the focus; no text selection
      if (b.dataset.qa) {
        this.expanded = !this.expanded;
        this.syncMode();
        window.dispatchEvent(new Event('resize')); // the dock lays both out again
        return;
      }
      const t = store.tool;
      const hl = t.tool === 'pen' && t.penStyle === 'highlighter';
      if (b.dataset.qc) store.setTool(t.tool === 'shape' ? { shapeColor: b.dataset.qc } : hl ? { hlColor: b.dataset.qc } : { color: b.dataset.qc });
    });
    store.on('tool', () => {
      this.update();
      this.place();
    });
    store.on('settings', () => this.place());
    window.addEventListener('resize', () => this.place());
    // The toolbar may be rebuilt or moved: follow it.
    const bars = document.querySelector('.toolbars');
    if (bars) new ResizeObserver(() => this.place()).observe(bars);
    this.update();
    this.place();
  }

  /**
   * Sit on the same line as the toolbar, in the free space between its two halves.
   * Where there is no such space (phones, bars together in the middle, bars on a side) it stays just above the toolbar (CSS).
   */
  private place(): void {
    const el = this.el;
    const app = el.parentElement as HTMLElement;
    const reset = () => {
      delete el.dataset.fit;
      el.classList.remove('inline');
      el.style.removeProperty('left');
      el.style.removeProperty('top');
      el.style.removeProperty('bottom');
    };
    if (el.hidden) return;
    // While the subject dock is open it lays out the line (this bar beside it, or the whole bar above it).
    if (this.syncMode()) return void delete el.dataset.fit;
    const edge = app.dataset.tb;
    const l = app.querySelector('.tb-left')?.getBoundingClientRect();
    const r = app.querySelector('.tb-right')?.getBoundingClientRect();
    if (!l || !r || app.classList.contains('tb-stacked') || (edge !== 'bottom' && edge !== 'top') || app.dataset.tbalign === 'middle' || l.right > r.left) return reset();
    // Make the pill only as wide as the free space allows (fewer colours, a shorter slider), before giving up.
    const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
    let fit = -1;
    for (let level = 0; level <= 2 && fit < 0; level++) {
      el.dataset.fit = String(level);
      if (r.left - l.right >= el.offsetWidth * k + 24) fit = level;
    }
    if (fit < 0) {
      delete el.dataset.fit;
      return reset();
    }
    el.classList.add('inline');
    // (The box is scaled around its middle, so line up the middles.)
    const c = (l.top + l.bottom) / 2, half = el.offsetHeight / 2;
    el.style.left = `${(l.right + r.left) / 2}px`;
    if (edge === 'bottom') {
      el.style.top = 'auto';
      el.style.bottom = `${viewportBottom() - c - half}px`;
    } else {
      el.style.bottom = 'auto';
      el.style.top = `${c - half}px`;
    }
  }

  /** Small (a few colours and an arrow) while the subject dock is open and the bar is not opened up. Returns whether the dock is open. */
  private syncMode(): boolean {
    const dock = !!document.querySelector('.subj-dock');
    // With the dock the bar takes the size the free space on the line allows (the dock decides: mini, mid or full);
    // opened with its arrow it is the whole bar above the dock.
    const qs = this.el.dataset.qs;
    const size = !dock || this.expanded ? 'full' : qs === 'full' || qs === 'mid' ? qs : 'mini';
    this.el.classList.toggle('withdock', dock);
    this.el.classList.toggle('mini', size === 'mini');
    this.el.classList.toggle('mid', size === 'mid');
    this.el.classList.toggle('open', dock && this.expanded);
    this.el.classList.toggle('noarrow', dock && !this.expanded && size === 'full');
    return dock;
  }

  private update(): void {
    const t = store.tool;
    const show = t.tool === 'pen' || t.tool === 'shape';
    this.el.hidden = !show;
    this.syncMode();
    if (!show) return;
    const hl = t.tool === 'pen' && t.penStyle === 'highlighter';
    const color = t.tool === 'shape' ? t.shapeColor : hl ? t.hlColor : t.color;
    const size = t.tool === 'shape' ? t.shapeSize : hl ? t.hlSize : t.size;
    const colors = hl ? HL_COLORS : COLORS;
    const key = `${hl}|${colors.join()}`;
    if (key !== this.key) {
      this.key = key;
      this.el.innerHTML =
        colors.map((c) => `<button class="qb-c${KEEP.has(c) ? ' qb-keep' : ''}" data-qc="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('') +
        '<i class="qb-sep" aria-hidden="true"></i>' +
        `<input class="qb-range" type="range" min="1" max="${hl ? 60 : 40}" step="1" aria-label="Line thickness"><span class="qb-prev" aria-hidden="true"><b></b></span>` +
        '<button class="qb-arrow" data-qa="1" aria-label="More colours and thickness" title="More"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>';
      (this.el.querySelector('.qb-range') as HTMLInputElement).addEventListener('input', (e) => {
        const v = Number((e.target as HTMLInputElement).value);
        const t = store.tool;
        const h = t.tool === 'pen' && t.penStyle === 'highlighter';
        store.setTool(t.tool === 'shape' ? { shapeSize: v } : h ? { hlSize: v } : { size: v });
      });
    }
    // The current choice: nearest size, exact colour.
    this.el.querySelectorAll<HTMLElement>('[data-qc]').forEach((b) => b.classList.toggle('on', b.dataset.qc!.toLowerCase() === color.toLowerCase()));
    const range = this.el.querySelector('.qb-range') as HTMLInputElement;
    if (Number(range.value) !== size) range.value = String(size);
    this.el.style.setProperty('--d', `${Math.max(3, Math.min(26, size + 2))}px`);
    this.el.style.setProperty('--cur', color);
  }
}
