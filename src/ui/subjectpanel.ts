import type { Board } from '../board';
import { translateEl, uid } from '../geometry';
import { isDarkColor } from '../renderer';
import { chapterById, SUBJECTS, type Chapter } from '../subjects/catalog';
import type { Comp } from '../subjects/nlm';
import { store } from '../store';
import type { El, PathEl, TextEl } from '../types';
import { icon } from './icons';
import { fadeOut, toast } from './panel';

// Subject tray: the pieces of the chosen chapter (blocks, springs, pulleys, wedges, vectors, monkey ...)
// as small pictures. Tap one to put it in the middle of the board, or drag it onto the board (mouse,
// finger or stylus). Pieces are made of ordinary lines and text, so they stay fully editable.

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A small SVG picture of the pieces (same drawing as on the board). */
export function previewSvg(els: El[], bg: string): string {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const grow = (x: number, y: number, pad = 0) => {
    x0 = Math.min(x0, x - pad);
    y0 = Math.min(y0, y - pad);
    x1 = Math.max(x1, x + pad);
    y1 = Math.max(y1, y + pad);
  };
  for (const e of els) {
    if (e.type === 'path') for (let i = 0; i < e.pts.length; i += 3) grow(e.pts[i], e.pts[i + 1], e.size / 2 + (e.arrow ? 10 : 0));
    else if (e.type === 'text') {
      grow(e.x, e.y);
      grow(e.x + e.w, e.y + e.h);
    }
  }
  const pad = 16, w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
  const body = els
    .map((e) => {
      if (e.type === 'text') {
        const t = e as TextEl;
        return `<text x="${t.x + t.w / 2}" y="${t.y + t.h / 2}" font-size="${t.fontSize}" font-weight="700" fill="${t.color}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif">${esc(t.text)}</text>`;
      }
      if (e.type !== 'path') return '';
      const p = e as PathEl;
      const pts: string[] = [];
      for (let i = 0; i < p.pts.length; i += 3) pts.push(`${p.pts[i].toFixed(1)},${p.pts[i + 1].toFixed(1)}`);
      const stroke = `stroke="${p.color}" stroke-width="${p.size}" stroke-linecap="round" stroke-linejoin="round"${p.dash ? ' stroke-dasharray="14 10"' : ''}`;
      let out = p.closed ? `<polygon points="${pts.join(' ')}" fill="${p.fill ?? 'none'}" ${stroke}/>` : `<polyline points="${pts.join(' ')}" fill="none" ${stroke}/>`;
      if (p.arrow) {
        const n = p.pts.length;
        const ax = p.pts[n - 3], ay = p.pts[n - 2], bx = p.pts[n - 6], by = p.pts[n - 5];
        const a = Math.atan2(ay - by, ax - bx), L = 22 + p.size;
        const hp = (d: number): string => `${(ax - Math.cos(a + d) * L).toFixed(1)},${(ay - Math.sin(a + d) * L).toFixed(1)}`;
        out += `<polygon points="${ax.toFixed(1)},${ay.toFixed(1)} ${hp(0.42)} ${hp(-0.42)}" fill="${p.color}"/>`;
      }
      return out;
    })
    .join('');
  return `<svg viewBox="${x0 - pad} ${y0 - pad} ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="${x0 - pad}" y="${y0 - pad}" width="${w}" height="${h}" fill="${bg}" opacity="0"/>${body}</svg>`;
}

const inkFor = (): string => (isDarkColor(store.page.bg) ? '#ffffff' : '#1e293b');

export class SubjectPanel {
  private el: HTMLElement | null = null;
  private count = 0;
  private picker: HTMLElement | null = null;

  constructor(
    private host: HTMLElement,
    private board: Board,
    private onChange: () => void = () => {},
  ) {}

  get open(): boolean {
    return !!this.el;
  }

  toggle(): void {
    if (this.el) this.close();
    else this.show();
  }

  close(): void {
    if (!this.el) return;
    fadeOut(this.el);
    this.el = null;
    this.onChange();
  }

  /** Show the tray of the chosen chapter (if one is chosen). */
  show(): void {
    const found = chapterById(store.settings.subject);
    if (!found || !found.chapter.comps) return;
    if (this.el) return;
    const el = document.createElement('aside');
    el.className = 'subj-panel';
    el.setAttribute('aria-label', 'Pieces for ' + found.chapter.name);
    this.host.appendChild(el);
    this.el = el;
    this.render(found.subject.name, found.chapter);
    this.bind(el, found.chapter);
    this.onChange();
  }

  /** Rebuild after the board colour changed. */
  refresh(): void {
    const found = chapterById(store.settings.subject);
    if (this.el && found?.chapter.comps) this.render(found.subject.name, found.chapter);
  }

  private render(subject: string, ch: Chapter): void {
    const el = this.el!;
    const ink = inkFor();
    const bg = store.page.bg;
    const cls = SUBJECTS.flatMap((s) => s.classes).find((c) => c.chapters.includes(ch));
    const by = new Map<string, Comp[]>();
    for (const c of ch.comps ?? []) (by.get(c.cat) ?? by.set(c.cat, []).get(c.cat)!).push(c);
    const scroll = (el.querySelector('.sp-body') as HTMLElement | null)?.scrollTop ?? 0;
    el.innerHTML = `
      <header class="sp-head">
        <div class="sp-title"><b>${esc(subject)} · ${esc(ch.short)}</b><small>${esc(cls?.name ?? '')} · ${esc(ch.name)}</small></div>
        <button class="icon-btn small" data-sp="change" aria-label="Change subject" title="Change subject">${icon('settings', 18)}</button>
        <button class="icon-btn small" data-sp="close" aria-label="Close">${icon('close', 20)}</button>
      </header>
      <p class="sp-hint">Tap a piece, or drag it onto the board. Double-tap a label to change it.</p>
      <div class="sp-body">${(ch.cats ?? [...by.keys()])
        .filter((c) => by.has(c))
        .map(
          (cat) => `<h3>${esc(cat)}</h3><div class="sp-grid">${by
            .get(cat)!
            .map((c) => `<button class="sp-tile" data-comp="${c.id}" aria-label="${esc(c.name)}"><span class="sp-prev" style="background:${bg}">${previewSvg(c.make(ink), bg)}</span><span class="sp-name">${esc(c.name)}</span></button>`)
            .join('')}</div>`,
        )
        .join('')}</div>`;
    (el.querySelector('.sp-body') as HTMLElement).scrollTop = scroll;
  }

  /** Put a piece on the board with its middle at (wx, wy), grouped, selected. */
  private place(c: Comp, wx: number, wy: number): void {
    const els = c.make(inkFor());
    const g = uid();
    const placed = els.map((e) => ({ ...translateEl(e, wx, wy), ...(els.length > 1 ? { group: g } : {}) }) as El);
    store.addEls(placed);
    store.setTool({ tool: 'select' });
    store.select(placed.map((e) => e.id));
  }

  private bind(el: HTMLElement, ch: Chapter): void {
    const comp = (id: string | undefined) => ch.comps?.find((c) => c.id === id);
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sp]');
      if (b?.dataset.sp === 'close') this.close();
      if (b?.dataset.sp === 'change') this.openPicker();
    });
    // Drag a piece out of the tray (or tap it to drop it in the middle of the board).
    let drag: { c: Comp; id: number; x: number; y: number; started: boolean; ghost: HTMLElement | null; touch: boolean } | null = null;
    const cleanup = () => {
      drag?.ghost?.remove();
      drag = null;
      el.classList.remove('sp-dragging');
    };
    el.addEventListener('pointerdown', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('.sp-tile');
      const c = comp(t?.dataset.comp);
      if (!t || !c || e.button > 0) return;
      drag = { c, id: e.pointerId, x: e.clientX, y: e.clientY, started: false, ghost: null, touch: e.pointerType === 'touch' };
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.started) {
        // A finger moving mostly up or down is scrolling the tray; sideways (out of the tray) is a drag.
        const go = drag.touch ? Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.1 : Math.hypot(dx, dy) > 6;
        if (!go) return;
        drag.started = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        const ghost = document.createElement('div');
        ghost.className = 'sp-ghost';
        ghost.innerHTML = previewSvg(drag.c.make(inkFor()), store.page.bg);
        ghost.style.background = store.page.bg;
        document.body.appendChild(ghost);
        drag.ghost = ghost;
        el.classList.add('sp-dragging');
      }
      e.preventDefault();
      if (drag.ghost) drag.ghost.style.transform = `translate(${e.clientX - 80}px, ${e.clientY - 60}px)`;
    });
    const end = (e: PointerEvent, cancel: boolean) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      cleanup();
      if (cancel) return;
      if (d.started) {
        const r = el.getBoundingClientRect();
        // Let go over the tray itself = changed your mind.
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
        const b = this.board.el.getBoundingClientRect();
        const [wx, wy] = this.board.toWorld(e.clientX - b.left, e.clientY - b.top);
        this.place(d.c, wx, wy);
      } else if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) {
        const v = this.board.viewRect();
        const k = (this.count++ % 5) * 26; // each tap a little off, so pieces do not hide each other
        this.place(d.c, v.x + v.w / 2 + k, v.y + v.h / 2 + k);
      }
    };
    el.addEventListener('pointerup', (e) => end(e, false));
    el.addEventListener('pointercancel', (e) => end(e, true));
  }

  // ------------------------------------------------------------------ choosing the subject

  /** Subject > Class > Chapter, one step at a time. Optional: "No subject" removes the toolbar button. */
  openPicker(): void {
    this.picker?.remove();
    const box = document.createElement('div');
    box.className = 'subj-picker';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Subject');
    this.host.appendChild(box);
    this.picker = box;
    let step: { k: 'subject' } | { k: 'class'; s: string } | { k: 'chapter'; s: string; c: string } = { k: 'subject' };
    const current = store.settings.subject;
    const close = () => {
      document.removeEventListener('pointerdown', away, true);
      fadeOut(box);
      if (this.picker === box) this.picker = null;
    };
    const away = (ev: Event) => {
      if (!box.contains(ev.target as Node) && !(ev.target as HTMLElement).closest?.('[data-act=subject]')) close();
    };
    const draw = () => {
      let html = '';
      if (step.k === 'subject') {
        html = `<div class="spk-title">Subject <small>(optional)</small></div>
          <button class="spk-item ${current ? '' : 'on'}" data-s="none">No subject</button>
          ${SUBJECTS.map((s) => `<button class="spk-item" data-s="${s.id}">${esc(s.name)}<i>›</i></button>`).join('')}`;
      } else if (step.k === 'class') {
        const s = SUBJECTS.find((x) => x.id === (step as { s: string }).s)!;
        html = `<div class="spk-title"><button class="spk-back" data-back="1" aria-label="Back">‹</button>${esc(s.name)}</div>
          ${s.classes.map((c) => `<button class="spk-item" data-c="${c.id}">${esc(c.name)}<i>›</i></button>`).join('')}`;
      } else {
        const st = step;
        const s = SUBJECTS.find((x) => x.id === st.s)!;
        const c = s.classes.find((x) => x.id === st.c)!;
        html = `<div class="spk-title"><button class="spk-back" data-back="1" aria-label="Back">‹</button>${esc(s.name)} · ${esc(c.name)}</div>
          <div class="spk-list">${c.chapters
            .map((ch, i) => `<button class="spk-item ${ch.comps ? 'ready' : ''} ${current === ch.id ? 'on' : ''}" data-ch="${ch.id}" ${ch.comps ? '' : 'disabled'}><span>${i + 1}. ${esc(ch.name)}</span>${ch.comps ? '<i>Pieces ready</i>' : '<i>Soon</i>'}</button>`)
            .join('')}</div>`;
      }
      box.innerHTML = html + `<button class="spk-close" data-close="1">Close</button>`;
    };
    box.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b || b.hasAttribute('disabled')) return;
      if (b.dataset.close) return close();
      if (b.dataset.back) {
        step = step.k === 'chapter' ? { k: 'class', s: step.s } : { k: 'subject' };
        return draw();
      }
      if (b.dataset.s === 'none') {
        store.setSettings({ subject: null });
        this.el && this.close();
        close();
        toast('Subject removed from the toolbar');
        return;
      }
      if (b.dataset.s) {
        step = { k: 'class', s: b.dataset.s };
        return draw();
      }
      if (b.dataset.c && step.k === 'class') {
        step = { k: 'chapter', s: step.s, c: b.dataset.c };
        return draw();
      }
      if (b.dataset.ch) {
        const found = chapterById(b.dataset.ch);
        store.setSettings({ subject: b.dataset.ch });
        close();
        if (this.el) {
          this.close();
        }
        if (found) toast(`${found.subject.name} · ${found.chapter.short} is on the toolbar now`, 2600);
        this.show();
      }
    });
    draw();
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
  }
}
