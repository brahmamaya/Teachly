import { store } from '../store';

// Quick bar: while a pen (or shape) is chosen, a small pill floats next to the toolbar with a
// few colours and three line sizes, so changing colour or thickness is ONE tap (the full menu
// stays on a second tap of the pen button). Reacts on finger-down; only a few class changes
// per tool change, nothing is redrawn while writing.

const COLORS = ['#f2f2f0', '#db0000', '#ed6d00', '#febf00', '#4ceb45', '#174ebd', '#d500a6'];
const HL_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6'];
const SIZES = [3, 7, 14];
const HL_SIZES = [14, 26, 42];

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
      if (b.dataset.qs) {
        const v = Number(b.dataset.qs);
        store.setTool(t.tool === 'shape' ? { shapeSize: v } : hl ? { hlSize: v } : { size: v });
      }
    });
    store.on('tool', () => this.update());
    this.update();
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
    const sizes = hl ? HL_SIZES : SIZES;
    const key = `${hl}|${colors.join()}`;
    if (key !== this.key) {
      this.key = key;
      this.el.innerHTML =
        colors.map((c) => `<button class="qb-c" data-qc="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('') +
        '<i class="qb-sep" aria-hidden="true"></i>' +
        sizes.map((s, i) => `<button class="qb-s" data-qs="${s}" aria-label="Line size ${i + 1}"><b style="--d:${6 + i * 5}px"></b></button>`).join('');
    }
    // The current choice: nearest size, exact colour.
    const near = sizes.reduce((a, b) => (Math.abs(b - size) < Math.abs(a - size) ? b : a), sizes[0]);
    this.el.querySelectorAll<HTMLElement>('[data-qc]').forEach((b) => b.classList.toggle('on', b.dataset.qc!.toLowerCase() === color.toLowerCase()));
    this.el.querySelectorAll<HTMLElement>('[data-qs]').forEach((b) => b.classList.toggle('on', Number(b.dataset.qs) === near));
    this.el.style.setProperty('--cur', color);
  }
}
