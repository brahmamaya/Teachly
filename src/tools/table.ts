import type { Board } from '../board';
import { uid } from '../geometry';
import { isDarkColor, textFont } from '../renderer';
import { store } from '../store';
import type { TableEl } from '../types';
import { inkScale } from '../ui/scale';

/** A new table centred in view, styled for the current board colour. */
export function makeTable(board: Board, rows: number, cols: number): TableEl {
  const k = inkScale();
  const dark = isDarkColor(store.page.bg);
  const w = cols * 170 * k, h = rows * 58 * k;
  const v = board.viewRect();
  return {
    id: uid(),
    type: 'table',
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    header: true,
    color: dark ? '#e5e7eb' : '#1e293b',
    fill: null,
    headerFill: dark ? 'rgba(96,165,250,0.28)' : 'rgba(37,99,235,0.14)',
    fontSize: 22 * k,
    x: v.x + v.w / 2 - w / 2,
    y: v.y + v.h / 2 - h / 2,
    w,
    h,
    rot: 0,
  };
}

/** Add or remove a row / column, keeping the cell size the same. */
export function resizeTable(t: TableEl, dRows: number, dCols: number): TableEl {
  const rows = Math.max(1, Math.min(30, t.rows + dRows));
  const cols = Math.max(1, Math.min(15, t.cols + dCols));
  const cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => t.cells[r]?.[c] ?? ''));
  return { ...t, rows, cols, cells, w: (t.w / t.cols) * cols, h: (t.h / t.rows) * rows };
}

/** Which cell of a (non-rotated) table is under a world point? */
export function cellAt(t: TableEl, x: number, y: number): [number, number] | null {
  const c = Math.floor(((x - t.x) / t.w) * t.cols);
  const r = Math.floor(((y - t.y) / t.h) * t.rows);
  return r >= 0 && r < t.rows && c >= 0 && c < t.cols ? [r, c] : null;
}

/**
 * Typing into a table cell: a textarea sits over the cell. Enter / Tab move
 * to the next cell, Escape or tapping elsewhere finishes.
 */
export class TableEditor {
  private ta: HTMLTextAreaElement | null = null;
  private id = '';
  private r = 0;
  private c = 0;

  constructor(private board: Board) {
    store.on('camera', () => this.position());
    store.on('page', () => this.close());
  }

  get active(): boolean {
    return !!this.ta;
  }

  private table(): TableEl | null {
    const t = store.page.els.find((e) => e.id === this.id);
    return t?.type === 'table' ? t : null;
  }

  open(t: TableEl, r: number, c: number): void {
    this.close();
    this.id = t.id;
    this.r = r;
    this.c = c;
    const ta = document.createElement('textarea');
    ta.className = 'cell-editor';
    ta.value = t.cells[r][c];
    ta.addEventListener('pointerdown', (e) => e.stopPropagation());
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        this.step(e.shiftKey ? -1 : 1);
      }
    });
    ta.addEventListener('blur', () => setTimeout(() => this.ta === ta && this.close(), 0));
    this.board.el.appendChild(ta);
    this.ta = ta;
    this.position();
    ta.focus();
    ta.select();
  }

  private save(): void {
    const ta = this.ta, t = this.table();
    if (!ta || !t) return;
    const text = ta.value.trim();
    if (text === t.cells[this.r][this.c]) return;
    const cells = t.cells.map((row) => row.slice());
    cells[this.r][this.c] = text;
    store.mapEls(new Set([t.id]), () => ({ ...t, cells }));
  }

  private step(d: number): void {
    const t = this.table();
    if (!t) return this.close();
    this.save();
    let i = this.r * t.cols + this.c + d;
    if (i >= t.rows * t.cols) i = 0;
    if (i < 0) i = t.rows * t.cols - 1;
    const next = this.table()!;
    this.open(next, Math.floor(i / t.cols), i % t.cols);
  }

  close(): void {
    if (!this.ta) return;
    this.save();
    this.ta.remove();
    this.ta = null;
  }

  private position(): void {
    const ta = this.ta, t = this.table();
    if (!ta || !t) return;
    const z = this.board.cam.z;
    const cw = t.w / t.cols, rh = t.h / t.rows;
    const [sx, sy] = this.board.toScreen(t.x + this.c * cw, t.y + this.r * rh);
    Object.assign(ta.style, {
      left: `${sx}px`,
      top: `${sy}px`,
      width: `${cw * z}px`,
      height: `${rh * z}px`,
      font: textFont({ fontSize: t.fontSize * z, bold: t.header && this.r === 0 }),
      color: t.color,
    });
  }
}
