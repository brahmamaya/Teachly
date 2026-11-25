import type { Board } from '../board';
import { transformEl, translateEl, uid } from '../geometry';
import { isDarkColor } from '../renderer';
import { chapterById, SUBJECTS, type Chapter } from '../subjects/catalog';
import type { Comp } from '../subjects/nlm';
import { blockInfo, nearest, seat, surfaces } from '../subjects/snap';
import { store } from '../store';
import type { El, PathEl, TextEl } from '../types';
import { icon } from './icons';
import { fadeOut, toast } from './panel';

// Subject pieces, two ways to reach them:
//  - the DOCK: a small strip next to the toolbar with the most used pieces as little symbols
//    (block, wedge, spring, pulley, ground, roof, wall, rope) and a "+" button
//  - the SHEET (the "+"): a big window with every piece of the chapter
// Tap a piece to put it in the middle of the board, or drag it onto the board (mouse, finger or
// stylus). A block dropped near a surface sits on it. Pieces are ordinary lines and text, so they
// stay fully editable.

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

/** Bold one-colour symbols for the dock (a small picture of the whole piece would be too faint). */
const DOCK_ICONS: Record<string, [string, string]> = {
  b1: ['<rect x="3.5" y="7" width="17" height="11" rx="1.6"/><text x="12" y="15.2" font-size="8.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="800" font-family="system-ui">m</text>', '#2563eb'],
  w30: ['<path d="M3 19.5h18V8z"/><path d="M9.5 19.5a6.5 6.5 0 0 0-1.7-4.1"/>', '#475569'],
  sp: ['<path d="M2 12h3.2l1.6-5 3.2 10 3.2-10 3.2 10 1.6-5H22"/>', '#d97706'],
  p0: ['<path d="M7 2.5h10"/><path d="M12 2.5v4"/><circle cx="12" cy="13" r="5.5"/><circle cx="12" cy="13" r=".9" fill="currentColor"/>', '#7c3aed'],
  p1: ['<path d="M7 2.5h10"/><path d="M12 2.5v3.5"/><circle cx="12" cy="11" r="4.6"/><circle cx="12" cy="11" r=".8" fill="currentColor"/><path d="M7.4 11v10M16.6 11v10"/>', '#7c3aed'],
  ground: ['<path d="M2.5 9h19"/><path d="M5.5 9l-2.5 4.5M9.5 9l-2.5 4.5M13.5 9l-2.5 4.5M17.5 9l-2.5 4.5M21.5 9l-2.5 4.5"/>', '#0f172a'],
  ceil: ['<path d="M2.5 14.5h19"/><path d="M5.5 14.5L3 10M9.5 14.5L7 10M13.5 14.5L11 10M17.5 14.5L15 10M21.5 14.5L19 10"/>', '#0f172a'],
  wall: ['<path d="M14 3v18"/><path d="M14 6.5l5-2.5M14 11l5-2.5M14 15.5l5-2.5M14 20l5-2.5"/>', '#0f172a'],
  f: ['<path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5"/>', '#dc2626'],
  w: ['<path d="M12 4v15M6.5 13.5L12 19l5.5-5.5"/>', '#16a34a'],
  n: ['<path d="M12 20V5M6.5 10.5L12 5l5.5 5.5"/>', '#2563eb'],
  t: ['<path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5"/>', '#d97706'],
  fr: ['<path d="M20 12H5M10.5 6.5L5 12l5.5 5.5"/>', '#9333ea'],
  atw: ['<path d="M6 2.5h12"/><circle cx="12" cy="8" r="3.6"/><path d="M8.4 8v7.5M15.6 8v10"/><rect x="5.6" y="15.5" width="5.6" height="4.4" rx=".8"/><rect x="12.8" y="18" width="5.6" height="4" rx=".8"/>', '#7c3aed'],
  tab: ['<path d="M2 14.5h13.5v3"/><rect x="4" y="9.5" width="6" height="5" rx=".8"/><circle cx="17.6" cy="12.6" r="2.4"/><path d="M20 12.6v6.4"/><rect x="17.6" y="18.5" width="4.6" height="3.6" rx=".8"/>', '#7c3aed'],
  w37: ['<path d="M3 19.5h18V5.5z"/><path d="M9 19.5a6 6 0 0 0-1.6-4.2"/>', '#475569'],
  mk: ['<circle cx="12" cy="6.5" r="3.4"/><circle cx="8.4" cy="5.8" r="1.2"/><circle cx="15.6" cy="5.8" r="1.2"/><path d="M12 10v6.5M7 13.5l5-1.8 5 1.8M10 21l2-4.5 2 4.5"/>', '#a16207'],
  rope: ['<path d="M3.5 12h17"/><circle cx="3.5" cy="12" r="1.5" fill="currentColor"/><circle cx="20.5" cy="12" r="1.5" fill="currentColor"/>', '#b45309'],
};

const inkFor = (): string => (isDarkColor(store.page.bg) ? '#ffffff' : '#1e293b');

/**
 * Where the bottom edge of the screen is, for things placed with `bottom:` (position fixed).
 * window.innerHeight is not always the same as that edge (iPad Safari, home-screen app, browser bars),
 * which put the dock and the pen bar half below the screen; a probe sitting at `bottom: 0` tells the truth.
 */
export function viewportBottom(): number {
  let probe = document.getElementById('vp-probe');
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'vp-probe';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:0;pointer-events:none;visibility:hidden';
    document.body.appendChild(probe);
  }
  return probe.getBoundingClientRect().bottom;
}

/**
 * Final check, done by looking at where the box really is: if its middle is not on the toolbar's middle line
 * (some iPad browsers measure the screen's bottom edge differently from the toolbar's own box), move it by the
 * difference. Both are measured the same way, so the answer is right whatever the browser's quirks are.
 */
export function alignMiddle(x: HTMLElement, wantY: number, bottomEdge: boolean): void {
  const r = x.getBoundingClientRect();
  const dy = (r.top + r.bottom) / 2 - wantY;
  if (Math.abs(dy) < 0.5) return;
  if (bottomEdge) x.style.bottom = `${parseFloat(x.style.bottom) + dy}px`;
  else x.style.top = `${parseFloat(x.style.top) - dy}px`;
}

/** Free space kept around the pieces dock on the toolbar's line (about 30 px each side), so it never looks joined to the toolbar halves. */
const GAP = 64;

export class SubjectPanel {
  private sheet: HTMLElement | null = null;
  private dock: HTMLElement | null = null;
  private count = 0;
  private picker: HTMLElement | null = null;

  constructor(
    private host: HTMLElement,
    private board: Board,
    private onChange: () => void = () => {},
  ) {
    store.on('settings', () => this.sync());
    store.on('tool', () => requestAnimationFrame(() => requestAnimationFrame(() => this.placeDock())));
    window.addEventListener('resize', () => this.placeDock());
    window.addEventListener('teachly-ui', () => requestAnimationFrame(() => this.placeDock()));
    // The two toolbar halves change width when buttons are shown or hidden: lay the dock out again each time.
    const ro = new ResizeObserver(() => this.placeDock());
    host.querySelectorAll('.toolbars .toolbar, .toolbars').forEach((el) => ro.observe(el));
    store.on('settings', () => requestAnimationFrame(() => this.placeDock()));
  }

  /** The dock is showing (what the toolbar button switches). */
  get open(): boolean {
    return !!this.dock;
  }

  /** The big window with every piece is showing. */
  get sheetOpen(): boolean {
    return !!this.sheet;
  }

  /** The toolbar button: show or hide the dock. */
  toggle(): void {
    store.setSettings({ subjectDock: this.open ? false : true });
    this.sync();
  }

  /** Make the screen match the settings: dock shown when a chapter with pieces is chosen (and not switched off). */
  sync(): void {
    const found = chapterById(store.settings.subject);
    const want = !!found?.chapter.comps && store.settings.subjectDock !== false;
    if (want && !this.dock) this.showDock();
    else if (!want && this.dock) this.hideDock();
    if (!found?.chapter.comps && this.sheet) this.closeSheet();
  }

  // ------------------------------------------------------------------ the dock

  private showDock(): void {
    const found = chapterById(store.settings.subject);
    if (!found?.chapter.comps || this.dock) return;
    const ch = found.chapter;
    const el = document.createElement('div');
    el.className = 'subj-dock';
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', 'Pieces for ' + ch.name);
    this.fillDock(el, ch);
    this.host.appendChild(el);
    this.dock = el;
    this.bind(el, ch, false);
    this.placeDock();
    window.dispatchEvent(new Event('resize')); // the colour bar moves out of its way
    this.onChange();
  }

  private hideDock(): void {
    if (!this.dock) return;
    fadeOut(this.dock, 160);
    this.dock = null;
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 220); // once it has faded away
    this.onChange();
  }

  private fillDock(el: HTMLElement, ch: Chapter): void {
    const found = chapterById(store.settings.subject);
    if (!found) return;
    const ink = inkFor();
    const bg = store.page.bg;
    const tiles = (ch.quick ?? [])
      .map((id) => ch.comps?.find((c) => c.id === id))
      .filter((c): c is Comp => !!c)
      .map((c) => {
        const di = DOCK_ICONS[c.id];
        const face = di ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${di[0]}</svg>` : `<span class="sp-prev" style="background:${bg}">${previewSvg(c.make(ink), bg)}</span>`;
        return `<button class="sp-tile sd-tile" data-comp="${c.id}" title="${esc(c.name)}" aria-label="${esc(c.name)}" style="color:${di ? di[1] : 'inherit'}">${face}</button>`;
      })
      .join('');
    // The subject's name sits with its pieces (not in the toolbar); tapping it hides the dock, and the toolbar then shows the button to bring it back.
    const name = `<button class="sd-name" data-sp="hide" title="${esc(found.subject.name)}: ${esc(ch.name)}. Tap to hide these pieces" aria-label="${esc(found.subject.name)}: ${esc(ch.name)}, hide the pieces">${esc(ch.short)}</button>`;
    el.innerHTML = `${name}${tiles}<button class="sd-more" data-sp="more" title="All pieces" aria-label="All pieces">${icon('plus', 22)}</button>`;
  }

  /** Redraw the dock's little pictures (the board colour changed). */
  refresh(): void {
    const found = chapterById(store.settings.subject);
    if (this.dock && found?.chapter.comps) this.fillDock(this.dock, found.chapter);
    if (this.sheet && found?.chapter.comps) this.renderSheet(found.subject.name, found.chapter);
  }

  /**
   * Sit on the toolbar's own line between its two halves and FILL the free space: the fewer buttons the toolbar has,
   * the more pieces the dock shows and the more colours the pen bar shows (small bar with an arrow, then 7 colours,
   * then the whole bar with its slider). When even the smallest mix does not fit, they sit just above the toolbar.
   */
  /** How many pieces the dock may show (lowered by the final overlap check below), and how often that check ran. */
  private cap = Infinity;
  private tries = 0;

  private placeDock(retry = false): void {
    if (!retry) {
      this.cap = Infinity;
      this.tries = 0;
    }
    const el = this.dock;
    if (!el) return;
    const app = this.host;
    // While the toolbar glides (Read only on / off) the dock is hidden and waits: placing it against a moving toolbar
    // made it jump about. It is placed once the toolbar has settled.
    if (app.classList.contains('tb-morphing')) {
      window.setTimeout(() => this.placeDock(), 150);
      return;
    }
    const l = app.querySelector('.tb-left')?.getBoundingClientRect();
    const r = app.querySelector('.tb-right')?.getBoundingClientRect();
    const qb = app.querySelector<HTMLElement>('.quickbar:not([hidden])');
    const popup = !!qb && qb.classList.contains('open'); // opened with its arrow: the whole bar above
    const edge = app.dataset.tb;
    const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
    const tiles = [...el.querySelectorAll<HTMLElement>('.sd-tile')];
    const clear = (x: HTMLElement) => {
      x.classList.remove('inline');
      for (const p of ['left', 'top', 'bottom']) x.style.removeProperty(p);
    };
    const showN = (n: number) => {
      tiles.forEach((t, i) => (t.hidden = i >= n));
      el.classList.toggle('compact', n <= 4); // small steps when there are few pieces and little room
    };
    const setQb = (size: 'full' | 'mid' | 'mini') => {
      if (!qb) return;
      qb.dataset.qs = size;
      qb.classList.toggle('mini', size === 'mini');
      qb.classList.toggle('mid', size === 'mid');
      qb.classList.toggle('noarrow', size === 'full');
    };
    clear(el);
    if (qb) clear(qb);
    if (!l || !r) return;
    const roomy = this.cap >= 0 && l.right < r.left && !app.classList.contains('tb-stacked') && (edge === 'bottom' || edge === 'top') && app.dataset.tbalign !== 'middle';
    const gap = r.left - l.right;
    const W = (x: HTMLElement) => x.offsetWidth * k;
    const total = Math.min(tiles.length, this.cap);
    const MIN = 3;
    // The richest mix that fits: score = dock pieces + what the pen bar shows.
    let best: { size: 'full' | 'mid' | 'mini' | null; n: number; score: number } | null = null;
    if (roomy) {
      const sizes: ('full' | 'mid' | 'mini' | null)[] = qb && !popup ? ['full', 'mid', 'mini'] : [null];
      for (const size of sizes) {
        if (size) setQb(size);
        for (let n = total; n >= MIN; n--) {
          showN(n);
          if (gap >= W(el) + (size && qb ? 10 + W(qb) : 0) + GAP) {
            const score = n + (size === 'full' ? 8 : size === 'mid' ? 4 : 0);
            if (!best || score > best.score) best = { size, n, score };
            break;
          }
        }
      }
    }
    let beside = !!best?.size;
    if (!best && roomy) {
      // Not even the smallest pair fits: the dock alone on the line, the small pen bar just above it.
      if (qb && !popup) setQb('mini');
      for (let n = total; n >= MIN && !best; n--) {
        showN(n);
        if (gap >= W(el) + GAP) best = { size: null, n, score: n };
      }
    }
    const c = (l.top + l.bottom) / 2;
    const put = (x: HTMLElement, centreX: number, centreY: number) => {
      x.style.left = `${centreX}px`;
      const half = x.offsetHeight / 2; // the box is scaled around its middle
      if (edge === 'bottom') {
        x.style.top = 'auto';
        x.style.bottom = `${viewportBottom() - centreY - half}px`;
      } else {
        x.style.bottom = 'auto';
        x.style.top = `${centreY - half}px`;
      }
      alignMiddle(x, centreY, edge === 'bottom');
    };
    if (!best && this.cap >= 0 && !app.classList.contains('tb-stacked') && (edge === 'bottom' || edge === 'top')) {
      // The toolbar is one bar in the middle (no room between its halves): the dock sits on the SAME line, beside the
      // bar, in the free space on one side (at the top the left side, away from the clock in the right corner).
      const L = Math.min(l.left, r.left), R = Math.max(l.right, r.right);
      const sides = edge === 'top' ? (['left', 'right'] as const) : L >= window.innerWidth - R ? (['left', 'right'] as const) : (['right', 'left'] as const);
      if (qb && !popup) setQb('mini');
      for (const side of sides) {
        const room = side === 'left' ? L : window.innerWidth - R;
        for (let n = total; n >= MIN; n--) {
          showN(n);
          if (room >= W(el) + GAP) {
            el.classList.add('inline');
            const x = side === 'left' ? L / 2 : R + room / 2;
            put(el, x, c);
            if (qb && !popup) {
              // the small pen bar just above (or below, at the top) the dock
              const box = el.getBoundingClientRect();
              qb.classList.add('inline');
              put(qb, x, edge === 'top' ? box.bottom + 10 + qb.getBoundingClientRect().height / 2 : box.top - 10 - qb.getBoundingClientRect().height / 2);
            }
            return;
          }
        }
      }
    }
    if (!best) {
      // No room on the toolbar's line: just above the toolbar (below it at the top), and above the pen bar when that shows.
      showN(Math.min(tiles.length, 6));
      if (qb && !popup) setQb('mini');
      const top = Math.min(l.top, r.top);
      const lift = qb ? qb.getBoundingClientRect().height + 10 : 0;
      // (only one of top / bottom: with both set the dock was stretched into a tall white pill)
      if (edge === 'top') {
        el.style.top = `${Math.max(l.bottom, r.bottom) + 12 + lift}px`;
        el.style.bottom = 'auto';
      } else {
        el.style.bottom = `${viewportBottom() - top + 12 + lift}px`;
        el.style.top = 'auto';
      }
      el.style.left = '50%';
      return;
    }
    if (best.size) setQb(best.size);
    showN(best.n);
    el.classList.add('inline');
    const mid = (l.right + r.left) / 2;
    if (beside && qb) {
      const dW = W(el), qW = W(qb), start = mid - (dW + 10 + qW) / 2;
      put(el, start + dW / 2, c);
      qb.classList.add('inline');
      put(qb, start + dW + 10 + qW / 2, c);
    } else {
      put(el, mid, c);
      if (qb && !popup) {
        // The small pen bar sits just above the dock.
        const above = el.getBoundingClientRect();
        qb.classList.add('inline');
        put(qb, mid, edge === 'top' ? above.bottom + 10 + qb.getBoundingClientRect().height / 2 : above.top - 10 - qb.getBoundingClientRect().height / 2);
      }
    }
    // Last check, with what is really on the screen: the dock (and the pen bar beside it) must not touch either toolbar
    // half. If they do (the sizes were measured before the buttons reached their final size), show one piece less and
    // look again; when even the smallest dock does not fit it goes above the toolbar.
    const L2 = app.querySelector('.tb-left')?.getBoundingClientRect();
    const R2 = app.querySelector('.tb-right')?.getBoundingClientRect();
    if (L2 && R2 && this.tries < 24) {
      const boxes = [el, ...(beside && qb ? [qb] : [])].map((x) => x.getBoundingClientRect());
      const left = Math.min(...boxes.map((b) => b.left)), right = Math.max(...boxes.map((b) => b.right));
      if (left < L2.right + 8 || right > R2.left - 8) {
        this.tries++;
        this.cap = best.n > MIN ? best.n - 1 : -1;
        this.placeDock(true);
      }
    }
  }

  // ------------------------------------------------------------------ the big window

  /** The big window: every piece of the chapter. */
  openSheet(): void {
    const found = chapterById(store.settings.subject);
    if (!found?.chapter.comps || this.sheet) return;
    store.clearSelection(); // the selection bar would show through the window
    const el = document.createElement('aside');
    el.className = 'subj-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'All pieces: ' + found.chapter.name);
    this.host.appendChild(el);
    this.sheet = el;
    this.host.classList.add('sheet-open');
    this.renderSheet(found.subject.name, found.chapter);
    this.bind(el, found.chapter, true);
    this.onChange();
  }

  closeSheet(): void {
    if (!this.sheet) return;
    fadeOut(this.sheet);
    this.sheet = null;
    this.host.classList.remove('sheet-open');
    this.onChange();
  }

  private renderSheet(subject: string, ch: Chapter): void {
    const el = this.sheet!;
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
      <p class="sp-hint">Tap a piece to put it on the board, or drag it where you want it. Double-tap a label to change it.</p>
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

  // ------------------------------------------------------------------ putting pieces on the board

  /** Put a piece on the board with its middle at (wx, wy), grouped, selected. */
  private place(c: Comp, wx: number, wy: number, dropped = false): void {
    const els = c.make(inkFor());
    const g = uid();
    let placed = els.map((e) => ({ ...translateEl(e, wx, wy), ...(els.length > 1 ? { group: g } : {}) }) as El);
    // A block put near a surface (ground, table, a wedge's slope, another block), by drop or by tap, lies along it and sits on it.
    if (c.snap) {
      const rect = placed.find((e) => e.type === 'path' && e.snap) as PathEl | undefined;
      const info = rect && blockInfo(rect);
      const hit = info && nearest(surfaces(store.page.els), wx, wy, dropped ? 130 : 220);
      if (info && hit) {
        const m = seat(info, hit.s, hit.t);
        placed = placed.map((e) => transformEl(e, m));
      }
    }
    store.addEls(placed);
    store.setTool({ tool: 'select' });
    store.select(placed.map((e) => e.id));
  }

  /**
   * Tap or drag on the pieces inside `el` (the dock or the sheet). `sheet`: the window hides itself
   * while a piece is carried and closes once it is placed.
   */
  private bind(el: HTMLElement, ch: Chapter, sheet: boolean): void {
    const comp = (id: string | undefined) => ch.comps?.find((c) => c.id === id);
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sp]');
      if (b?.dataset.sp === 'close') this.closeSheet();
      if (b?.dataset.sp === 'change') this.openPicker();
      if (b?.dataset.sp === 'hide') this.toggle();
      if (b?.dataset.sp === 'more') this.sheet ? this.closeSheet() : this.openSheet();
    });
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
        // In the scrolling sheet a finger moving mostly up or down is scrolling; the dock never scrolls.
        const go = drag.touch && sheet ? Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.1 : Math.hypot(dx, dy) > 6;
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
        // Let go on the dock itself = changed your mind. (The big window steps aside while carrying, so anywhere counts.)
        const r = el.getBoundingClientRect();
        if (!sheet && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
        const b = this.board.el.getBoundingClientRect();
        const [wx, wy] = this.board.toWorld(e.clientX - b.left, e.clientY - b.top);
        this.place(d.c, wx, wy, true);
        if (sheet) this.closeSheet();
      } else if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) {
        const v = this.board.viewRect();
        const k = (this.count++ % 5) * 26; // each tap a little off, so pieces do not hide each other
        this.place(d.c, v.x + v.w / 2 + k, v.y + v.h / 2 + k);
        if (sheet) this.closeSheet();
      }
    };
    el.addEventListener('pointerup', (e) => end(e, false));
    el.addEventListener('pointercancel', (e) => end(e, true));
    if (sheet) {
      // Escape while carrying a piece out of the window: nothing is placed.
      window.addEventListener('keydown', (e) => e.key === 'Escape' && (drag ? cleanup() : this.closeSheet()));
    }
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
        this.sync();
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
        this.hideDock();
        this.closeSheet();
        store.setSettings({ subject: b.dataset.ch, subjectDock: true });
        close();
        if (found) toast(`${found.subject.name} · ${found.chapter.short} is on the toolbar now`, 2600);
        this.sync();
      }
    });
    draw();
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
  }
}
