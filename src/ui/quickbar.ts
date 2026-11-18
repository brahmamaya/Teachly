import { store } from '../store';

// Quick bar: while a pen (or shape) is chosen, a small pill floats next to the toolbar with a
// few colours and three line sizes, so changing colour or thickness is ONE tap (the full menu
// stays on a second tap of the pen button). Reacts on finger-down; only a few class changes
// per tool change, nothing is redrawn while writing.

const COLORS = ['#f2f2f0', '#db0000', '#ed6d00', '#febf00', '#4ceb45', '#174ebd', '#d500a6'];
const HL_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6'];

export class QuickBar {
  private el: HTMLElement;
  private key = '';

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
    // The subject dock owns the toolbar's line; the colour bar then sits just above it.
    if (document.querySelector('.subj-dock')) return reset();
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
      el.style.bottom = `${window.innerHeight - c - half}px`;
    } else {
      el.style.bottom = 'auto';
      el.style.top = `${c - half}px`;
    }
  }

  private update(): void {
    const t = store.tool;
    const show = t.tool === 'pen' || t.tool === 'shape';
    this.el.hidden = !show;
    if (!show) return;
    const hl = t.tool === 'pen' && t.penStyle === 'highlighter';
    const color = t.tool === 'shape' ? t.shapeColor : hl ? t.hlColor : t.color;
    const size = t.tool === 'shape' ? t.shapeSize : hl ? t.hlSize : t.size;
    const colors = hl ? HL_COLORS : COLORS;
    const key = `${hl}|${colors.join()}`;
    if (key !== this.key) {
      this.key = key;
      this.el.innerHTML =
        colors.map((c) => `<button class="qb-c" data-qc="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('') +
        '<i class="qb-sep" aria-hidden="true"></i>' +
        `<input class="qb-range" type="range" min="1" max="${hl ? 60 : 40}" step="1" aria-label="Line thickness"><span class="qb-prev" aria-hidden="true"><b></b></span>`;
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
