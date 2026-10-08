import type { Board, Ptr, Tool } from '../board';
import { hitTest, uid } from '../geometry';
import { measureText, textFont } from '../renderer';
import { store } from '../store';
import { inkScale } from '../ui/scale';
import type { TextEl } from '../types';

const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'];

/** In-place text editing using a textarea positioned over the board. */
export class TextEditor {
  private ta: HTMLTextAreaElement | null = null;
  private editing: TextEl | null = null;
  private isNew = false;

  constructor(private board: Board) {
    store.on('camera', () => this.position());
    store.on('page', () => this.commit());
  }

  get active(): boolean {
    return !!this.ta;
  }

  open(el: TextEl, isNew: boolean): void {
    this.commit();
    this.editing = el;
    this.isNew = isNew;
    const ta = document.createElement('textarea');
    ta.className = 'text-editor';
    ta.value = el.text;
    ta.spellcheck = true;
    ta.addEventListener('input', () => this.autosize());
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        this.commit();
      }
    });
    ta.addEventListener('blur', () => setTimeout(() => this.commit(), 0));
    ta.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.board.el.appendChild(ta);
    this.ta = ta;
    if (!isNew) {
      this.board.hiddenIds.add(el.id);
      this.board.invalidate('ink');
    }
    this.position();
    this.autosize();
    ta.focus();
    if (!isNew) ta.select();
  }

  private position(): void {
    const ta = this.ta, el = this.editing;
    if (!ta || !el) return;
    const z = this.board.cam.z;
    const [sx, sy] = this.board.toScreen(el.x, el.y);
    const pad = el.bg ? el.fontSize * 0.5 * z : 0;
    Object.assign(ta.style, {
      left: `${sx}px`,
      top: `${sy}px`,
      font: textFont({ fontSize: el.fontSize * z, bold: el.bold }),
      lineHeight: '1.3',
      color: el.color,
      padding: `${pad}px`,
      background: el.bg ?? 'transparent',
      minWidth: `${Math.max(el.w, 160) * z}px`,
      transform: el.rot ? `rotate(${el.rot}rad)` : '',
      transformOrigin: 'top left',
    });
    this.autosize();
  }

  private autosize(): void {
    const ta = this.ta;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.width = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
    ta.style.width = `${Math.min(this.board.w * 0.9, Math.max(ta.scrollWidth + 4, parseFloat(ta.style.minWidth) || 0))}px`;
  }

  commit(): void {
    const ta = this.ta, el = this.editing;
    if (!ta || !el) return;
    this.ta = null;
    this.editing = null;
    const text = ta.value.replace(/\s+$/, '');
    ta.remove();
    this.board.hiddenIds.delete(el.id);
    this.board.invalidate('ink');
    const page = store.page;
    if (!text) {
      if (!this.isNew) store.replaceEls(new Set([el.id]), []);
      return;
    }
    const size = measureText(text, el.fontSize, !!el.bold, Math.max(el.w, 1200), !!el.bg);
    const next: TextEl = { ...el, text, w: el.bg ? Math.max(size.w, el.w) : size.w, h: el.bg ? Math.max(size.h, el.h) : size.h };
    if (this.isNew) store.addEls([next]);
    else if (page.els.some((e) => e.id === el.id)) store.mapEls(new Set([el.id]), () => next);
  }
}

export class TextTool implements Tool {
  cursor = 'text';
  sticky = false;
  private stickyIndex = 0;

  constructor(private board: Board, private editor: TextEditor) {}

  down(p: Ptr): void {
    if (this.editor.active) {
      this.editor.commit();
      return;
    }
    const hit = [...store.page.els].reverse().find((e) => e.type === 'text' && !e.locked && hitTest(e, p.x, p.y, 4 * this.board.px)) as TextEl | undefined;
    if (hit) {
      this.editor.open(hit, false);
      return;
    }
    const fs = store.tool.fontSize * inkScale();
    const sticky = this.sticky;
    const el: TextEl = {
      id: uid(),
      type: 'text',
      x: p.x,
      y: p.y - fs * 0.65,
      w: sticky ? 260 : 10,
      h: sticky ? 200 : fs * 1.3,
      rot: 0,
      text: '',
      color: sticky ? '#1e293b' : store.tool.color,
      fontSize: sticky ? Math.min(fs, 28) : fs,
      bg: sticky ? STICKY_COLORS[this.stickyIndex++ % STICKY_COLORS.length] : null,
    };
    this.editor.open(el, true);
  }

  move(): void {}
  up(): void {}
  cancel(): void {}
}
