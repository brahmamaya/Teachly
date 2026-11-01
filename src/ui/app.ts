import { Board, type Tool } from '../board';
import { bbox, regroup, resizeEl, similarity, transformEl, translateEl, uid, unionRects } from '../geometry';
import {
  copySelection,
  exportPdf,
  importPdf,
  insertImages,
  insertImageSrc,
  openFile,
  pasteElements,
  pickFiles,
  readAsDataURL,
} from '../io/files';
import { isDarkColor, measureText } from '../renderer';
import { store, type ToolState } from '../store';
import { importPptx } from '../io/office';
import { blankNotebook, loadLastNotebook, saveNotebook } from '../io/library';
import { restorePlace, restoreTools, trackSession } from '../io/session';
import { startHousekeeping } from '../io/housekeeping';
import { EraserTool } from '../tools/eraser';
import { FillTool } from '../tools/fill';
import { LaserTool } from '../tools/laser';
import { TapeTool } from '../tools/tape';
import { makeTable, resizeTable, TableEditor } from '../tools/table';
import { CompassTool, ShapeTool } from '../tools/misc';
import { PenTool } from '../tools/pen';
import { SelectTool } from '../tools/select';
import { TextEditor, TextTool } from '../tools/text';
import type { BgPattern, El, PathEl, ShapeKind, TableEl, ToolId } from '../types';
import { toggleCurtain, toggleSpotlight } from '../widgets/focus';
import { openTimer } from '../widgets/timer';
import { isRecording, onRecordingChange, toggleRecording } from '../widgets/recorder';
import { openCalculator, openPicker, openScoreboard } from '../widgets/classroom';
import { openGraph } from '../widgets/graph';
import { toggleMagnifier } from '../widgets/magnifier';
import { icon } from './icons';
import { installApp, isInstalled, shareApp } from './install';
import { Library, saveNotebookDialog } from './library';
import { PAGE_DRAG, PagesPanel } from './pages';
import { fadeOut, toast } from './panel';
import { showLegal } from './legal';
import { computeUiScale, inkScale, scaleFloating, ui } from './scale';

// The owner's pen colours, exactly as chosen (row by row: red, orange,
// yellow / green, indigo, blue / teal, magenta, dark green / black, brown,
// white). Do not change these values.
const PEN_COLORS = ['#db0000', '#ed6d00', '#febf00', '#4ceb45', '#2600a2', '#174ebd', '#3c8da4', '#d500a6', '#096800', '#000000', '#726253', '#f2f2f0'];
const PEN_WHITE = '#f2f2f0';
const PEN_BLACK = '#000000';
const boardColors = (): string[] => PEN_COLORS;
/** Three pens like Note 3 (plus the highlighter). */
const PEN_TYPES: [ToolState['penStyle'], string][] = [
  ['pen', 'Pen'],
  ['brush', 'Brush'],
  ['calligraphy', 'Calligraphy'],
  ['highlighter', 'Highlighter'],
];
const HL_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6'];
const FILLS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff', '#e2e8f0', '#1e293b', '#ef4444', '#2563eb', '#22c55e'];
/** Board colours: dark boards first (default black), then light ones. */
/** Board colours: black (default), white, light green — plus “any colour”. */
const BOARDS = ['#000000', '#ffffff', '#cdebd3'];
const PATTERNS: [BgPattern, string][] = [
  ['none', 'Plain'],
  ['grid', 'Grid'],
  ['lines', 'Lines'],
  ['fourline', '4-line'],
  ['dots', 'Dots'],
  ['graph', 'Graph'],
  ['music', 'Music'],
  ['cornell', 'Cornell'],
];

const SHAPES: [ShapeKind, string, string][] = [
  ['line', 'Line', '<path d="M4 20L20 4"/>'],
  ['arrow', 'Arrow', '<path d="M4 20L20 4M12 4h8v8"/>'],
  ['dashed', 'Dashed line', '<path d="M4 20L20 4" stroke-dasharray="3 3"/>'],
  ['rect', 'Rectangle', '<rect x="3" y="6" width="18" height="12"/>'],
  ['square', 'Square', '<rect x="4" y="4" width="16" height="16"/>'],
  ['circle', 'Circle', '<circle cx="12" cy="12" r="9"/>'],
  ['arc', 'Arc (drag the dot to bend it)', '<path d="M3 18a9 9 0 0 1 18 0"/>'],
  ['ellipse', 'Oval', '<ellipse cx="12" cy="12" rx="10" ry="6.5"/>'],
  ['triangle', 'Triangle', '<path d="M12 3l9 18H3z"/>'],
  ['rtriangle', 'Right triangle', '<path d="M4 3v18h16z"/>'],
  ['diamond', 'Rhombus', '<path d="M12 2l9 10-9 10-9-10z"/>'],
  ['parallelogram', 'Parallelogram', '<path d="M7 5h14l-4 14H3z"/>'],
  ['pentagon', 'Pentagon', '<path d="M12 2l10 7.3-3.8 11.7H5.8L2 9.3z"/>'],
  ['hexagon', 'Hexagon', '<path d="M7 3h10l5 9-5 9H7l-5-9z"/>'],
  ['star', 'Star', '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/>'],
  ['cube', 'Cube', '<path d="M4 8h12v12H4zM4 8l4-4h12l-4 4M20 4v12l-4 4"/>'],
  ['cylinder', 'Cylinder', '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/>'],
  ['cone', 'Cone', '<path d="M12 2L4 19M12 2l8 17"/><ellipse cx="12" cy="19" rx="8" ry="3"/>'],
  ['sphere', 'Sphere', '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="3"/>'],
  ['axes2', 'x–y axes (graph)', '<path d="M2 12h20M12 22V2M20 10l2 2-2 2M10 4l2-2 2 2M4 10l-2 2 2 2M10 20l2 2 2-2"/>'],
  ['axes3', 'x–y–z axes (3D)', '<path d="M10 14h12M10 14V2M10 14l-7 7M20 12l2 2-2 2M8 4l2-2 2 2"/><path d="M10 14H5M10 14v5M10 14l4-4" stroke-dasharray="2 2"/>'],
];

type PropSection = 'color' | 'width' | 'fill' | null;

/** Toolbar buttons the teacher can show or hide (Menu → Edit toolbar). Menu itself always stays. */
/** Buttons that are off until the teacher ticks them in Edit toolbar. */
const TB_OPT_IN = new Set(['record']);
const TB_ITEMS: [string, string, 'left' | 'right'][] = [
  ['select', 'Select', 'left'],
  ['slide', 'Slide (move the board)', 'left'],
  ['pen', 'Pen', 'left'],
  ['eraser', 'Eraser', 'left'],
  ['shape', 'Shapes', 'left'],
  ['fill', 'Fill colour', 'left'],
  ['text', 'Text', 'left'],
  ['tape', 'Tape', 'left'],
  ['laser', 'Laser pointer', 'left'],
  ['undo', 'Undo', 'right'],
  ['redo', 'Redo', 'right'],
  ['insert', 'Insert (picture, PDF, slides…)', 'right'],
  ['tools', 'Tools (ruler, compass…)', 'right'],
  ['timer', 'Timer', 'right'],
  ['graph', 'Graph', 'right'],
  ['record', 'Record lesson', 'right'],
  ['pagenav', 'Page arrows', 'right'],
  ['pages', 'All pages', 'right'],
];

/** When this version was built (shown in the menu, to check updates arrived). */
declare const __BUILD__: string;
const BUILD_TIME = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';

const RECENT_KEY = 'teachly.recentColors';
function recentColors(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function addRecentColor(c: string): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([c, ...recentColors().filter((x) => x !== c)].slice(0, 6)));
  } catch {
    /* ignore */
  }
}

export class App {
  board: Board;
  editor: TextEditor;
  private root: HTMLElement;
  private toolbar: HTMLElement;
  private props: HTMLElement;
  private popover: HTMLElement | null = null;
  private popFor = '';
  private propSection: PropSection = null;
  private selectTool: SelectTool;
  private pages: PagesPanel;
  private library: Library;
  private tableEditor: TableEditor;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="board" id="board"></div>
      <div class="corner" aria-hidden="true">
        <div class="clock"><b data-time></b></div>
        <div class="brand"><b>Teachly</b> <small>by Physica</small></div>
      </div>
      <button class="zoom-pill" data-act="zoom-reset" title="Reset zoom" hidden></button>
      <div class="toolbars"><nav class="toolbar tb-left" aria-label="Drawing tools"></nav><nav class="toolbar tb-right" aria-label="Actions"></nav></div>
      <div class="props" hidden></div>
      <div class="drop-hint" hidden>Drop images or a PDF here</div>`;

    this.board = new Board(root.querySelector('#board') as HTMLElement);
    this.editor = new TextEditor(this.board);
    this.selectTool = new SelectTool(this.board, this.editor);
    this.tableEditor = new TableEditor(this.board);
    this.selectTool.tableEditor = this.tableEditor;
    const tools: [ToolId, Tool][] = [
      ['select', this.selectTool],
      ['pen', new PenTool(this.board)],
      ['eraser', new EraserTool(this.board)],
      ['shape', new ShapeTool(this.board, this.selectTool)],
      ['fill', new FillTool(this.board)],
      ['text', new TextTool(this.board, this.editor)],
      ['compass', new CompassTool(this.board)],
      ['laser', new LaserTool(this.board)],
      ['tape', new TapeTool(this.board)],
    ];
    for (const [id, t] of tools) this.board.tools.set(id, t);
    this.board.updateCursor();

    this.toolbar = root.querySelector('.toolbars') as HTMLElement;
    this.pages = new PagesPanel(root, () => this.renderToolbar());
    this.library = new Library(root);
    this.props = root.querySelector('.props') as HTMLElement;
    this.renderToolbar();
    this.bindChrome();
    this.bindKeys();
    this.bindDrop();

    store.on('tool', () => this.renderToolbar());
    store.on('doc', () => {
      this.updatePageLabel();
      this.updateBoardTone();
      this.renderProps();
      this.updateUndo();
      this.scheduleSave();
    });
    store.on('page', () => {
      this.updatePageLabel();
      this.updateZoom();
      this.updateBoardTone();
    });
    store.on('camera', () => {
      this.updateZoom();
      this.positionProps();
    });
    store.on('selection', () => {
      this.propSection = null;
      this.renderProps();
    });
    this.updatePageLabel();
    this.updateZoom();
    this.updateBoardTone();
    this.startClock();
    this.applyScale();
    // Re-fit the toolbars whenever the screen size really changes. iPad
    // Safari reports the new size late (split view, rotation, tab bar), so
    // also check again a moment later and watch the app's own box.
    let lastSize = '';
    let t = 0;
    const relayout = () => {
      cancelAnimationFrame(t);
      t = requestAnimationFrame(() => {
        const size = `${window.innerWidth}x${window.innerHeight}`;
        if (size === lastSize) return;
        lastSize = size;
        this.applyScale();
      });
    };
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', () => {
      relayout();
      window.setTimeout(relayout, 350);
      window.setTimeout(relayout, 900);
    });
    new ResizeObserver(relayout).observe(root);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && window.setTimeout(relayout, 200));
    window.setTimeout(relayout, 600);
    // Only a new button size needs a re-layout (other settings keep the menu open).
    const tbKey = () => `${store.settings.tbHidden.join()}|${(store.settings.tbShown ?? []).join()}`;
    let layout = tbKey();
    store.on('settings', () => {
      const now = tbKey();
      if (now === layout) return;
      layout = now;
      this.renderToolbar();
      this.applyScale(true);
    });
    // The Record button shows when a recording runs (it turns red and pulses).
    onRecordingChange(() => this.renderToolbar());
    // Never lose work when the app is closed or hidden.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(this.saveTimer);
        void saveNotebook(store.doc).catch(() => {});
      }
    });
    // Back exactly where the lesson stopped: notebook, page, spot, pen.
    restoreTools();
    void loadLastNotebook().then((doc) => {
      if (doc) store.loadDoc(doc);
      requestAnimationFrame(() => restorePlace(this.board));
      trackSession(this.board);
    });
    startHousekeeping(this.board);
  }

  // ---------------------------------------------------------------------------
  // Bottom toolbar

  private renderToolbar(): void {
    const t = store.tool;
    const dot = t.penStyle === 'highlighter' ? t.hlColor : t.color;
    const tool = (id: ToolId, ic: string, label: string, extra = '') =>
      `<button class="tb-btn ${t.tool === id ? 'active' : ''}" data-tool="${id}" title="${label}">${icon(ic, 22)}${extra}</button>`;
    const left = this.toolbar.querySelector('.tb-left') as HTMLElement;
    const right = this.toolbar.querySelector('.tb-right') as HTMLElement;
    const hide = new Set(store.settings.tbHidden);
    const on = new Set(store.settings.tbShown ?? []);
    const show = (k: string, html: string) => ((TB_OPT_IN.has(k) ? !on.has(k) : hide.has(k)) ? '' : html);
    left.innerHTML = `<span class="tb-ind" aria-hidden="true"></span>
      ${show('select', tool('select', 'select', 'Select'))}
      ${show('slide', `<button class="tb-btn tb-toggle ${t.slide ? 'on' : ''}" data-act="slide" title="Slide mode — move the board while you write" aria-pressed="${t.slide}">${icon('pan', 22)}</button>`)}
      ${show('pen', tool('pen', t.penStyle, 'Pen', `<span class="swatch-dot" style="background:${dot}"></span>`))}
      ${show('eraser', tool('eraser', 'eraser', 'Eraser'))}
      ${show('shape', tool('shape', 'shapes', 'Shapes'))}
      ${show('fill', tool('fill', 'bucket', 'Fill colour', `<span class="swatch-dot" style="background:${t.fillColor === 'none' ? 'transparent' : t.fillColor}"></span>`))}
      ${show('text', tool('text', 'text', 'Text'))}
      ${hide.has('tape') && hide.has('laser') ? '' : '<i class="tb-sep" aria-hidden="true"></i>'}
      ${show('tape', tool('tape', 'tape', 'Tape — hide answers, tap to show', `<span class="swatch-dot" style="background:${t.tapeColor}"></span>`))}
      ${show('laser', tool('laser', 'laser', 'Laser pointer'))}`;
    right.innerHTML = `
      ${show('undo', `<button class="tb-btn" data-act="undo" title="Undo">${icon('undo', 22)}</button>`)}
      ${show('redo', `<button class="tb-btn" data-act="redo" title="Redo">${icon('redo', 22)}</button>`)}
      ${show('insert', `<button class="tb-btn ${this.popFor === 'insert' ? 'open' : ''}" data-pop="insert" title="Insert">${icon('plus', 22)}</button>`)}
      ${show('tools', `<button class="tb-btn ${this.popFor === 'tools' ? 'open' : ''}" data-pop="tools" title="Tools">${icon('ruler', 22)}</button>`)}
      ${show('timer', `<button class="tb-btn" data-act="timer" title="Timer for a question">${icon('timer', 22)}</button>`)}
      ${show('graph', `<button class="tb-btn" data-act="graph" title="Graph from an equation (y = …)">${icon('graph', 22)}</button>`)}
      ${show('record', `<button class="tb-btn tb-rec ${isRecording() ? 'recording' : ''}" data-act="record" title="${isRecording() ? 'Stop recording' : 'Record lesson'}" aria-pressed="${isRecording()}">${icon('rec', 22)}<i class="tb-rec-ring" aria-hidden="true"></i></button>`)}
      ${show('pagenav', `<div class="tb-pagenav">
        <button class="icon-btn" data-act="prev" title="Previous page" aria-label="Previous page">${icon('prev')}</button>
        <span class="page-label">${store.index + 1} / ${store.doc.pages.length}</span>
        <button class="icon-btn" data-act="next" title="Next page" aria-label="Next page">${icon('next')}</button>
      </div>`)}
      ${show('pages', `<button class="tb-btn ${this.pages.open ? 'open' : ''}" data-act="pages" title="All pages">${icon('pages', 22)}</button>`)}
      <button class="tb-btn ${this.popFor === 'menu' || this.popFor === 'tbedit' ? 'open' : ''}" data-pop="menu" title="Menu">${icon('menu', 22)}</button>`;
    this.updateUndo();
    this.moveIndicator(left);
    if (this.popover) {
      const anchor = this.toolbar.querySelector(`[data-tool="${this.popFor}"],[data-pop="${this.popFor}"]`) as HTMLElement | null;
      if (anchor) this.positionPopover(anchor);
    }
  }

  /** Last place of the sliding highlight, so it can glide to the new tool. */
  private indAt: { x: number; y: number; w: number; h: number } | null = null;

  /** The highlight slides smoothly from the old tool to the new one. */
  private moveIndicator(bar: HTMLElement): void {
    const ind = bar.querySelector('.tb-ind') as HTMLElement;
    const btn = bar.querySelector('.tb-btn.active') as HTMLElement | null;
    if (!btn) {
      ind.style.opacity = '0';
      return;
    }
    const to = { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight };
    const from = this.indAt ?? to;
    const place = (r: typeof to) => {
      ind.style.width = `${r.w}px`;
      ind.style.height = `${r.h}px`;
      ind.style.transform = `translate(${r.x}px, ${r.y}px)`;
    };
    ind.style.transition = 'none';
    place(from);
    void ind.offsetWidth;
    ind.style.transition = '';
    place(to);
    this.indAt = to;
  }

  private updateUndo(): void {
    this.toolbar.querySelector('[data-act=undo]')?.toggleAttribute('disabled', !store.canUndo);
    this.toolbar.querySelector('[data-act=redo]')?.toggleAttribute('disabled', !store.canRedo);
  }

  private onToolbarClick(b: HTMLElement): void {
    if (b.dataset.tool) {
      const id = b.dataset.tool as ToolId;
      const hasOptions = id === 'pen' || id === 'eraser' || id === 'shape' || id === 'fill' || id === 'tape' || id === 'laser';
      if (store.tool.tool === id && hasOptions) this.togglePopover(id, b);
      else {
        this.closePopover();
        store.setTool({ tool: id });
        // Shapes: show the picker right away, a shape must be chosen first.
        if (id === 'shape') this.togglePopover('shape', this.toolbar.querySelector('[data-tool=shape]') as HTMLElement);
      }
    } else if (b.dataset.pop) this.togglePopover(b.dataset.pop, b);
    else if (b.dataset.act) this.action(b.dataset.act);
  }

  // ---------------------------------------------------------------------------
  // Popovers

  private closePopover(): void {
    if (!this.popover) return;
    fadeOut(this.popover);
    this.popover = null;
    this.popFor = '';
    this.toolbar.querySelectorAll('.open').forEach((x) => x.classList.remove('open'));
  }

  private togglePopover(kind: string, anchor: HTMLElement): void {
    if (this.popFor === kind) return this.closePopover();
    this.closePopover();
    const pop = document.createElement('div');
    pop.className = 'popover';
    this.root.appendChild(pop);
    this.popover = pop;
    this.popFor = kind;
    anchor.classList.add('open');
    pop.addEventListener('click', (e) => this.onPopoverClick(e));
    pop.addEventListener('input', (e) => this.onPopoverInput(e));
    pop.addEventListener('change', (e) => this.onCustomColor(e));
    this.fillPopover();
    this.positionPopover(anchor);
  }

  /** Top of the bottom bars under the span x1..x2 (phones stack two bars). */
  private barsTop(x1: number, x2: number, top: number): number {
    for (const b of this.root.querySelectorAll<HTMLElement>('.toolbar')) {
      const r = b.getBoundingClientRect();
      if (r.right > x1 && r.left < x2) top = Math.min(top, r.top);
    }
    return top;
  }

  private positionPopover(anchor: HTMLElement): void {
    const pop = this.popover!;
    scaleFloating(pop);
    const k = ui();
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth * k, ph = pop.offsetHeight * k;
    const W = window.innerWidth, H = window.innerHeight, gap = 12 * k;
    const cx = Math.max(8, Math.min(W - pw - 8, r.left + r.width / 2 - pw / 2));
    const cy = Math.max(8, Math.min(H - ph - 8, r.top + r.height / 2 - ph / 2));
    // Open away from the edge the toolbar sits on.
    const [left, top] = {
      bottom: [cx, Math.max(8, this.barsTop(cx, cx + pw, r.top) - ph - gap)],
      top: [cx, Math.min(H - ph - 8, r.bottom + gap)],
      left: [Math.min(W - pw - 8, r.right + gap), cy],
      right: [Math.max(8, r.left - pw - gap), cy],
    }[store.settings.tbPos];
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  /** Colour buttons, the teacher's own recent colours, and a picker for any colour. */
  private swatches(colors: string[], current: string | null, attr: string, pre = ''): string {
    const all = [...colors, ...recentColors().filter((c) => !colors.includes(c))];
    const pick = current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#ff6699';
    return `<div class="swatches">${pre}${all.map((c) => `<button class="swatch ${c === current ? 'on' : ''}" style="background:${c}" data-${attr}="${c}" aria-label="${c}"></button>`).join('')}<label class="swatch custom" title="Any colour"><input type="color" value="${pick}" data-custom="${attr}" aria-label="Pick any colour"></label></div>`;
  }

  /** A colour from the picker acts exactly like tapping a colour button. */
  private onCustomColor(e: Event): void {
    const el = e.target as HTMLInputElement;
    const attr = el.dataset.custom;
    if (!attr) return;
    addRecentColor(el.value);
    const b = document.createElement('button');
    b.hidden = true;
    b.dataset[attr] = el.value;
    el.closest('.swatches')!.appendChild(b);
    b.click();
    b.remove();
  }

  private fillPopover(): void {
    const pop = this.popover;
    if (!pop) return;
    const t = store.tool;
    switch (this.popFor) {
      case 'pen': {
        const hl = t.penStyle === 'highlighter';
        const color = hl ? t.hlColor : t.color;
        const size = hl ? t.hlSize : t.size;
        // Compact: pen kinds as small icons, colours, one thin size slider.
        pop.className = 'popover pop-pen';
        pop.innerHTML = `
          <div class="pen-icons">${PEN_TYPES.map(([k, n]) => `<button class="pen-ico ${t.penStyle === k ? 'on' : ''}" data-style="${k}" title="${n}" aria-label="${n}">${icon(k, 22)}</button>`).join('')}</div>
          ${this.swatches(hl ? HL_COLORS : boardColors(), color, 'color')}
          <div class="pen-size">
            <input type="range" id="pen-size" min="1" max="${hl ? 60 : 40}" value="${size}" data-pensize aria-label="Size">
            <span class="pen-prev"><i data-penprev style="width:${Math.min(26, size + 2)}px;height:${Math.min(26, size + 2)}px;background:${color};opacity:${hl ? 0.45 : 1}"></i></span>
          </div>`;
        break;
      }
      case 'fill':
        pop.innerHTML = `<div class="pop-title">Fill colour</div>
          ${this.swatches([...FILLS, '#3b82f6', '#eab308', '#a855f7', '#ffffff'].filter((c, i, a) => a.indexOf(c) === i), t.fillColor, 'fillc', `<button class="swatch none ${t.fillColor === 'none' ? 'on' : ''}" data-fillc="none" aria-label="Remove fill"></button>`)}
          <div class="slider-row">
            <span class="slider-label">Transparency</span>
            <input type="range" id="fill-opacity" min="0" max="90" step="5" value="${Math.round((1 - t.fillOpacity) * 100)}" data-fillop aria-label="Fill transparency in percent">
            <span class="slider-preview"><b data-fillopv>${Math.round((1 - t.fillOpacity) * 100)}%</b></span>
          </div>
          <div class="muted small center">Tap inside any closed area to colour just that area.<br>Tap a coloured area again to change it.</div>`;
        break;
      case 'tape':
        pop.innerHTML = `<div class="pop-title">Tape</div>
          ${this.swatches(['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#64748b'], t.tapeColor, 'tapec')}
          <div class="muted small center">Drag over an answer to hide it.<br>Tap the tape to show it, tap again to hide.</div>`;
        break;
      case 'laser':
        pop.innerHTML = `<div class="pop-title">Laser pointer</div>
          ${this.swatches(['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ec4899'], t.laserColor, 'laserc')}
          <div class="muted small center">Draw to point things out — it fades away 1.5 seconds after you lift.</div>`;
        break;
      case 'eraser':
        pop.innerHTML = `
          <div class="seg"><button class="${t.eraserMode === 'point' ? 'on' : ''}" data-emode="point" title="Rub out just a part">Part</button><button class="${t.eraserMode === 'stroke' ? 'on' : ''}" data-emode="stroke" title="Touch any object (line, shape, text, graph) to erase all of it">Object</button><button class="${t.eraserMode === 'area' ? 'on' : ''}" data-emode="area" title="Draw a loop: everything inside is erased">Area</button></div>
          <div class="slider-row">
            <span class="slider-label">Size</span>
            <input type="range" id="eraser-size" min="10" max="160" value="${t.eraserSize}" data-erasersize>
            <span class="slider-preview"><i data-eraserprev class="eraser-prev" style="width:${Math.min(44, t.eraserSize / 3.5 + 6)}px;height:${Math.min(44, t.eraserSize / 3.5 + 6)}px"></i></span>
          </div>
          <button class="btn danger wide" data-act="clear">${icon('trash', 20)} Clear page</button>`;
        break;
      case 'shape':
        pop.innerHTML = `<div class="shape-grid">${SHAPES.map(([k, n, svg]) => `<button class="shape-btn ${t.shape === k ? 'on' : ''}" data-shape="${k}" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${svg}</svg></button>`).join('')}</div>
          <button class="btn wide" data-act="graph">${icon('graph', 20)} Graph from an equation (y = …)</button>
          <div class="muted small center">Draw it on the board, then tap it to change colour, size or fill.</div>`;
        break;
      case 'insert':
        pop.innerHTML = `<div class="grid-btns">
          ${this.gridBtn('image', 'image', 'Picture')}
          ${this.gridBtn('pdf', 'pdf', 'PDF / Book')}
          ${this.gridBtn('pptx', 'slides', 'PowerPoint')}
          ${this.gridBtn('table', 'table', 'Table')}
          ${this.gridBtn('graph', 'graph', 'Graph y = f(x)')}
          ${this.gridBtn('page', 'pages', 'New page')}</div>`;
        break;
      case 'table':
        // Word-style picker: slide over the grid to choose rows × columns.
        pop.innerHTML = `<div class="pop-title">Table <span data-tsize>3 × 3</span></div>
          <div class="table-picker">${Array.from({ length: 8 * 10 }, (_, i) => `<button data-tr="${Math.floor(i / 10) + 1}" data-tc="${(i % 10) + 1}" aria-label="${Math.floor(i / 10) + 1} by ${(i % 10) + 1}"></button>`).join('')}</div>
          <div class="muted small center">Tap to insert. Double-tap a cell later to type.</div>`;
        pop.onpointerover = (e) => {
          const b = (e.target as HTMLElement).closest('[data-tr]') as HTMLElement | null;
          if (!b) return;
          const r = Number(b.dataset.tr), c = Number(b.dataset.tc);
          (pop.querySelector('[data-tsize]') as HTMLElement).textContent = `${r} × ${c}`;
          pop.querySelectorAll<HTMLElement>('[data-tr]').forEach((x) => x.classList.toggle('on', Number(x.dataset.tr) <= r && Number(x.dataset.tc) <= c));
        };
        break;
      case 'tools': {
        const ins = this.board.instruments;
        pop.innerHTML = `<div class="grid-btns tools-grid">
          ${this.gridBtn('ruler', 'ruler', 'Ruler', ins.has('ruler'))}
          ${this.gridBtn('protractor', 'protractor', 'Protractor', ins.has('protractor'))}
          ${this.gridBtn('compass', 'compass', 'Compass', t.tool === 'compass')}
          ${this.gridBtn('timer', 'timer', 'Timer')}
          ${this.gridBtn('spotlight', 'spotlight', 'Spotlight')}
          ${this.gridBtn('curtain', 'curtain', 'Screen cover')}
          ${this.gridBtn('magnifier', 'magnifier', 'Magnifier')}
          ${this.gridBtn('graph', 'graph', 'Graph y = f(x)')}
          ${this.gridBtn('calc', 'calc', 'Calculator')}
          ${this.gridBtn('picker', 'dice', 'Random picker')}
          ${this.gridBtn('score', 'score', 'Scoreboard')}
          ${this.gridBtn('multi', 'pen', 'Group writing', store.settings.multiWrite)}</div>`;
        break;
      }
      case 'tbedit': {
        const hide = new Set(store.settings.tbHidden);
        const group = (side: 'left' | 'right') =>
          TB_ITEMS.filter(([, , sd]) => sd === side)
            .map(([k, n]) => {
              const shown = TB_OPT_IN.has(k) ? (store.settings.tbShown ?? []).includes(k) : !hide.has(k);
              return `<label class="check tbe-item"><input type="checkbox" data-tbitem="${k}" ${shown ? 'checked' : ''}> ${n}</label>`;
            })
            .join('');
        pop.innerHTML = `<div class="pop-title">Edit toolbar</div>
          <div class="muted small">Tick the buttons you want on the toolbar.</div>
          <div class="tbe-cols"><div><div class="pop-title">Left</div>${group('left')}</div><div><div class="pop-title">Right</div>${group('right')}</div></div>
          <button class="btn wide" data-tbreset>Show all buttons</button>`;
        pop.onchange = (e) => {
          const el = e.target as HTMLInputElement;
          const k = el.dataset.tbitem;
          if (!k) return;
          if (TB_OPT_IN.has(k)) {
            const shown = new Set(store.settings.tbShown ?? []);
            if (el.checked) shown.add(k);
            else shown.delete(k);
            store.setSettings({ tbShown: [...shown] });
          } else {
            const next = new Set(store.settings.tbHidden);
            if (el.checked) next.delete(k);
            else next.add(k);
            store.setSettings({ tbHidden: [...next] });
          }
        };
        break;
      }
      case 'menu': {
        const p = store.page;
        const s = store.settings;
        pop.innerHTML = `
          <div class="pop-title">Board</div>
          <div class="board-palette">${BOARDS.map((c) => `<button class="swatch ${p.bg === c ? 'on' : ''}" style="background:${c}" data-bg="${c}" aria-label="Board colour ${c}"></button>`).join('')}
            <label class="swatch custom" title="Any colour"><input type="color" id="board-color" value="${p.bg}" data-bgpick aria-label="Pick any board colour"></label></div>
          <div class="seg seg-wrap">${PATTERNS.map(([k, n]) => `<button class="${p.pattern === k ? 'on' : ''}" data-pattern="${k}">${n}</button>`).join('')}</div>
          <div class="pop-title">Notebook</div>
          <div class="menu-list">
            <button class="menu-item" data-act="library">${icon('notebook', 20)}My notebooks</button>
            <button class="menu-item" data-act="new">${icon('new', 20)}New notebook</button>
            <button class="menu-item" data-act="open-pdf">${icon('pdf', 20)}Open PDF</button>
            <button class="menu-item" data-act="open-pptx">${icon('slides', 20)}Open PowerPoint</button>
            <button class="menu-item" data-act="record">${icon('record', 20)}Record lesson (video)</button>
            <button class="menu-item" data-act="open">${icon('open', 20)}Open file</button>
            <button class="menu-item" data-act="save">${icon('save', 20)}Save notebook</button>
            <button class="menu-item" data-act="export">${icon('download', 20)}Save as PDF</button>
            <button class="menu-item" data-act="delete-page">${icon('trash', 20)}Delete this page</button>
            <button class="menu-item" data-act="fullscreen">${icon('fullscreen', 20)}Full screen</button>
            ${isInstalled() ? '' : `<button class="menu-item" data-act="install">${icon('download', 20)}Install app</button>`}
            <button class="menu-item" data-act="share-app">${icon('share', 20)}Share Teachly</button>
            <button class="menu-item" data-act="privacy">${icon('shield', 20)}Privacy policy</button>
            <button class="menu-item" data-act="terms">${icon('terms', 20)}Terms of use</button>
          </div>
          <button class="menu-item wide-item" data-act="tbedit">${icon('settings', 20)}Edit toolbar — choose its buttons</button>
          <label class="check"><input type="checkbox" id="opt-penonly" data-set="penOnly" ${s.penOnly ? 'checked' : ''}> Write with stylus only (fingers and palm don't draw)</label>
          <label class="check"><input type="checkbox" id="opt-palm" data-set="palmErase" ${s.palmErase ? 'checked' : ''}> Erase with palm</label>
          <label class="check"><input type="checkbox" id="opt-holdshape" data-set="holdShapes" ${s.holdShapes ? 'checked' : ''}> Hold pen to make a shape</label>
          <div class="app-version">Version ${BUILD_TIME}</div>`;
        pop.onchange = (e) => {
          const el = e.target as HTMLInputElement;
          if (el.dataset.set) store.setSettings({ [el.dataset.set]: el.checked });
          if (el.dataset.bgpick !== undefined) {
            this.setBoard({ bg: el.value });
            this.fillPopover();
          }
        };
        break;
      }
    }
  }

  private gridBtn(act: string, ic: string, label: string, on = false): string {
    return `<button class="grid-btn ${on ? 'on' : ''}" data-act="${act}">${icon(ic, 30)}<span>${label}</span></button>`;
  }

  private onPopoverClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    const d = b.dataset;
    const t = store.tool;
    if (d.style) store.setTool({ penStyle: d.style as 'pen' });
    else if (d.color) store.setTool(t.penStyle === 'highlighter' ? { hlColor: d.color } : { color: d.color });
    else if (d.emode) store.setTool({ eraserMode: d.emode as 'point' });
    else if (d.fillc) store.setTool({ fillColor: d.fillc });
    else if (d.tapec) store.setTool({ tapeColor: d.tapec });
    else if (d.laserc) store.setTool({ laserColor: d.laserc });
    else if (d.shape) {
      store.setTool({ shape: d.shape as ShapeKind, tool: 'shape' });
      this.closePopover();
      return;
    } else if (d.tr) {
      const tbl = makeTable(this.board, Number(d.tr), Number(d.tc));
      this.closePopover();
      store.addEls([tbl]);
      store.setTool({ tool: 'select' });
      store.select([tbl.id]);
      this.tableEditor.open(tbl, 0, 0);
      return;
    } else if (d.tbreset !== undefined) {
      store.setSettings({ tbHidden: [], tbShown: [...TB_OPT_IN] });
      this.fillPopover();
      return;
    } else if (d.tbpos) {
      this.closePopover();
      this.setToolbarPos(d.tbpos as 'bottom');
      return;
    } else if (d.bg) this.setBoard({ bg: d.bg });
    else if (d.pattern) this.setBoard({ pattern: d.pattern as BgPattern });
    else if (d.act) {
      this.closePopover();
      this.action(d.act);
      return;
    }
    this.fillPopover();
  }

  /** Sliders update live without rebuilding the popover (so the drag is not interrupted). */
  private onPopoverInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    const v = Number(el.value);
    // Write straight into the tool state: no toolbar rebuild on every tick.
    if (el.dataset.pensize !== undefined) {
      Object.assign(store.tool, store.tool.penStyle === 'highlighter' ? { hlSize: v } : { size: v });
      const prev = this.popover?.querySelector('[data-penprev]') as HTMLElement | null;
      if (prev) prev.style.width = prev.style.height = `${Math.min(26, v + 2)}px`;
    } else if (el.dataset.fillop !== undefined) {
      store.tool.fillOpacity = 1 - v / 100;
      const out = this.popover?.querySelector('[data-fillopv]') as HTMLElement | null;
      if (out) out.textContent = `${v}%`;
    } else if (el.dataset.erasersize !== undefined) {
      store.tool.eraserSize = v;
      const prev = this.popover?.querySelector('[data-eraserprev]') as HTMLElement | null;
      if (prev) prev.style.width = prev.style.height = `${Math.min(44, v / 3.5 + 6)}px`;
    }
  }

  private setBoard(patch: { bg?: string; pattern?: BgPattern }): void {
    store.updatePage(patch);
    if (patch.bg) {
      // Keep the pen readable: white ink on a dark board, black on a light one.
      // (Ink already on the board keeps its colour.)
      const dark = isDarkColor(patch.bg);
      const whites = [PEN_WHITE, '#ffffff'], blacks = [PEN_BLACK, '#1a1a1a', '#1e293b'];
      const swap = (c: string): string | null => {
        const x = c.toLowerCase();
        if (dark && blacks.includes(x)) return PEN_WHITE;
        if (!dark && whites.includes(x)) return PEN_BLACK;
        return null;
      };
      const c = swap(store.tool.color), sc = swap(store.tool.shapeColor);
      if (c || sc) store.setTool({ ...(c ? { color: c } : {}), ...(sc ? { shapeColor: sc } : {}) });
    }
  }

  // ---------------------------------------------------------------------------
  // Actions

  action(act: string): void {
    const b = this.board;
    switch (act) {
      case 'undo':
        return store.undo();
      case 'redo':
        return store.redo();
      case 'pages':
        this.closePopover();
        this.pages.toggle();
        return;
      case 'slide': {
        const on = !store.tool.slide;
        store.setTool({ slide: on });
        if (on && store.tool.tool !== 'pen' && store.tool.tool !== 'eraser') store.setTool({ tool: 'pen' });
        return toast(
          on
            ? store.settings.penOnly
              ? 'Slide ON — pen writes, finger slides the board · pinch to zoom'
              : 'Slide ON — one finger writes, two fingers slide · mouse: right-drag or scroll slides'
            : 'Slide OFF — board fixed',
          3500,
        );
      }
      case 'zoom-reset':
        return b.fitPage();
      case 'prev':
        return store.goTo(store.index - 1);
      case 'next':
        if (store.index === store.doc.pages.length - 1) {
          store.addPage();
          toast(`Page ${store.index + 1}`);
        } else store.goTo(store.index + 1);
        return;
      case 'page':
        store.addPage();
        return toast(`Page ${store.index + 1}`);
      case 'clear':
        if (store.page.els.some((e) => !e.locked)) {
          store.setEls(store.page.els.filter((e) => e.locked));
          toast('Page cleared — tap Undo to bring it back');
        }
        return;
      case 'delete-page':
        store.deletePage();
        return toast('Page deleted — tap Undo to bring it back');
      case 'image':
        void insertImages(b);
        return;
      case 'pdf':
        void this.withProgress('Opening PDF', (p) => importPdf(b, undefined, p));
        return;
      case 'pptx':
        void pickFiles('.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation').then((f) => f[0] && this.openSlides(f[0]));
        return;
      case 'table':
        return this.togglePopover('table', this.toolbar.querySelector('[data-pop=insert]') as HTMLElement);
      case 'ruler':
      case 'protractor':
        b.instruments.toggle(act);
        if (store.tool.tool !== 'pen' && store.tool.tool !== 'shape') store.setTool({ tool: 'pen' });
        return;
      case 'compass':
        store.setTool({ tool: 'compass' });
        return toast('Drag from the centre to set the size, then drag around to draw');
      case 'timer':
        return openTimer(this.root);
      case 'spotlight':
        return toggleSpotlight(this.root);
      case 'curtain':
        return toggleCurtain(this.root.querySelector('#board') as HTMLElement);
      case 'magnifier':
        return toggleMagnifier(this.root, b);
      case 'graph':
        return openGraph(this.root, b);
      case 'calc':
        return openCalculator(this.root, b);
      case 'picker':
        return openPicker(this.root);
      case 'score':
        return openScoreboard(this.root);
      case 'multi': {
        const on = !store.settings.multiWrite;
        store.setSettings({ multiWrite: on });
        if (on && store.tool.tool !== 'pen') store.setTool({ tool: 'pen' });
        return toast(on ? 'Group writing on — many students can write at the same time (pinch zoom is off)' : 'Group writing off', 4000);
      }
      case 'new':
        // The current notebook stays in My notebooks, so nothing is lost.
        void saveNotebook(store.doc).then(async () => {
          store.loadDoc(await saveNotebook(blankNotebook('Notebook', store.page.bg)));
          toast('New notebook — the old one is in My notebooks');
        });
        return;
      case 'open-pdf':
      case 'open-pptx': {
        const pdf = act === 'open-pdf';
        void pickFiles(pdf ? 'application/pdf,.pdf' : '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation').then(async (files) => {
          const f = files[0];
          if (!f) return;
          // Open it as its own notebook; the current one stays in My notebooks.
          await saveNotebook(store.doc);
          store.loadDoc(await saveNotebook(blankNotebook(f.name.replace(/\.\w+$/, ''), store.page.bg)));
          if (pdf) await this.withProgress('Opening PDF', (p) => importPdf(b, f, p));
          else await this.openSlides(f);
        });
        return;
      }
      case 'library':
        this.closePopover();
        if (this.pages.open) this.pages.toggle();
        void this.library.show();
        return;
      case 'tbedit':
        return this.togglePopover('tbedit', this.toolbar.querySelector('[data-pop=menu]') as HTMLElement);
      case 'record':
        void toggleRecording(this.board, this.root);
        return;
      case 'open':
        void openFile();
        return;
      case 'save':
        // Name it (and pick a folder): kept in My notebooks on this device.
        void saveNotebookDialog(this.root);
        return;
      case 'export':
        void this.withProgress('Making PDF', () => exportPdf(b));
        return;
      case 'privacy':
      case 'terms':
        this.closePopover();
        showLegal(this.root, act);
        return;
      case 'share-app':
        void shareApp();
        return;
      case 'install':
        void installApp(this.root);
        return;
      case 'fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => toast('Full screen is not available here'));
        return;
    }
  }

  private openSlides(f: File): Promise<void> {
    if (/\.ppt$/i.test(f.name)) {
      toast('Old .ppt files are not supported — save it as .pptx or PDF in PowerPoint', 5000);
      return Promise.resolve();
    }
    return this.withProgress('Opening slides', (p) => importPptx(this.board, f, p));
  }

  private async withProgress(label: string, fn: (p: (d: number, t: number) => void) => Promise<void>): Promise<void> {
    const el = document.createElement('div');
    el.className = 'progress-toast';
    el.textContent = `${label}…`;
    this.root.appendChild(el);
    try {
      await fn((d, t) => (el.textContent = `${label}… ${d}/${t}`));
    } catch (e) {
      // Teachly was updated while this page stayed open: the part that opens
      // PDF / PowerPoint / files is a newer file now. Save, reload once (the
      // lesson comes back as it was), then ask to open the file again.
      if (isStaleCode(e) && reloadForUpdate()) return;
      toast(`Could not finish: ${(e as Error).message}`, 4000);
    } finally {
      el.remove();
    }
  }

  // ---------------------------------------------------------------------------
  // Properties bar for the selected item(s)

  private renderProps(): void {
    const bar = this.props;
    if (this.widthPreview) return this.positionProps();
    const els = store.selectedEls();
    const tool = store.tool.tool;
    if (!els.length || (tool !== 'select' && tool !== 'shape')) {
      bar.hidden = true;
      return;
    }
    const paths = els.filter((e): e is PathEl => e.type === 'path');
    const texts = els.filter((e) => e.type === 'text');
    const tables = els.filter((e): e is TableEl => e.type === 'table');
    const table = els.length === 1 ? tables[0] : undefined;
    const tapes = els.filter((e) => e.type === 'tape');
    const colorable = paths.length + texts.length + tables.length + tapes.length > 0;
    // Shapes, tables and any hand-drawn line (its loop is filled) can be filled.
    const canFill = (p: PathEl) => p.closed || (p.style !== 'shape' && p.style !== 'highlighter' && p.pts.length >= 9);
    const fillable = paths.some(canFill) || tables.length > 0;
    const first = (paths[0] ?? texts[0] ?? tables[0] ?? tapes[0]) as { color: string } | undefined;
    const color = first?.color ?? null;
    // Thickness is shown in the same units as the pen slider.
    const width = (paths[0]?.size ?? 0) / inkScale();
    const fill = paths.find(canFill)?.fill ?? tables[0]?.fill ?? null;
    const sec = this.propSection;

    let panel = '';
    if (sec === 'color') panel = this.swatches(boardColors(), color, 'pcolor');
    if (sec === 'width')
      panel = `<div class="width-row"><input type="range" id="prop-width" min="1" max="30" value="${Math.round(width)}" data-pwidth><span class="width-val">${Math.round(width)}</span></div>
        <div class="sizes">${[2, 4, 8, 14].map((s) => `<button class="size ${Math.round(width) === s ? 'on' : ''}" data-pw="${s}"><span style="width:${s + 3}px;height:${s + 3}px;background:var(--text)"></span></button>`).join('')}</div>`;
    if (sec === 'fill')
      panel = this.swatches(FILLS, fill, 'pfill', `<button class="swatch none ${!fill ? 'on' : ''}" data-pfill="none" aria-label="No fill"></button>`);

    const btn = (s: PropSection, label: string, preview: string) =>
      `<button class="prop-btn ${sec === s ? 'on' : ''}" data-sec="${s}">${preview}<span>${label}</span></button>`;
    bar.innerHTML = `
      <div class="props-row">
        ${colorable ? btn('color', 'Colour', `<i class="prop-color" style="background:${color}"></i>`) : ''}
        ${paths.length ? btn('width', 'Thickness', `<i class="prop-width"><b style="height:${Math.max(2, Math.min(12, width))}px"></b></i>`) : ''}
        ${fillable ? btn('fill', 'Fill', `<i class="prop-color ${fill ? '' : 'empty'}" style="background:${fill ?? 'transparent'}"></i>`) : ''}
        ${
          table
            ? `<div class="prop-size"><button class="icon-btn" data-trows="-1" aria-label="Remove row">−</button><span>Rows ${table.rows}</span><button class="icon-btn" data-trows="1" aria-label="Add row">+</button></div>
        <div class="prop-size"><button class="icon-btn" data-tcols="-1" aria-label="Remove column">−</button><span>Cols ${table.cols}</span><button class="icon-btn" data-tcols="1" aria-label="Add column">+</button></div>
        <button class="prop-btn ${table.header ? 'on' : ''}" data-pact="header">${icon('table', 20)}<span>Header</span></button>`
            : ''
        }
        <div class="prop-size"><button class="icon-btn" data-scale="0.85" aria-label="Smaller">−</button><span>Size</span><button class="icon-btn" data-scale="1.18" aria-label="Bigger">+</button></div>
        ${els.some((e) => e.group) ? `<button class="prop-btn" data-pact="ungroup">${icon('shapes', 20)}<span>Ungroup</span></button>` : ''}
        <button class="prop-btn" data-pact="dup">${icon('copy', 20)}<span>Copy</span></button>
        <button class="prop-btn danger" data-pact="delete">${icon('trash', 20)}<span>Delete</span></button>
      </div>
      ${panel ? `<div class="props-panel">${panel}</div>` : ''}`;
    bar.hidden = false;
    bar.onclick = (e) => this.onPropsClick(e);
    bar.oninput = (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.pwidth !== undefined) this.setWidth(Number(el.value) * inkScale(), false);
    };
    bar.onchange = (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.custom) return this.onCustomColor(e);
      if (el.dataset.pwidth !== undefined) this.setWidth(Number(el.value) * inkScale(), true);
    };
    this.positionProps();
  }

  private onPropsClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    const d = b.dataset;
    if (d.sec) {
      this.propSection = this.propSection === d.sec ? null : (d.sec as PropSection);
      this.renderProps();
    } else if (d.pcolor) {
      const c = d.pcolor;
      store.mapEls(store.selection, (el) => (el.type === 'path' || el.type === 'text' || el.type === 'table' || el.type === 'tape' ? ({ ...el, color: c } as El) : el));
      if (store.selectedEls().some((x) => x.type === 'path' && x.style === 'shape')) store.setTool({ shapeColor: c });
    } else if (d.pw) this.setWidth(Number(d.pw) * inkScale(), true);
    else if (d.pfill) {
      const f = d.pfill === 'none' ? null : d.pfill;
      store.mapEls(store.selection, (el) =>
        (el.type === 'path' && (el.closed || (el.style !== 'shape' && el.style !== 'highlighter'))) || el.type === 'table' ? { ...el, fill: f } : el,
      );
      store.setTool({ shapeFill: f });
    } else if (d.trows || d.tcols) {
      store.mapEls(store.selection, (el) => (el.type === 'table' ? resizeTable(el, Number(d.trows ?? 0), Number(d.tcols ?? 0)) : el));
    } else if (d.pact === 'header') {
      store.mapEls(store.selection, (el) => (el.type === 'table' ? { ...el, header: !el.header } : el));
    } else if (d.scale) this.scaleSelection(Number(d.scale));
    else if (d.pact === 'ungroup') {
      // Split into separate pieces (e.g. to change one label of a graph).
      const ids = new Set(store.selection);
      store.mapEls(ids, (e) => ({ ...e, group: undefined }) as El);
      store.clearSelection();
    } else if (d.pact === 'dup') this.duplicate();
    else if (d.pact === 'delete') this.deleteSelection();
  }

  /** Change line thickness; live updates replace the last history step. */
  private widthPreview: { ids: Set<string>; base: El[] } | null = null;

  private setWidth(w: number, commit: boolean): void {
    const ids = store.selection;
    if (!this.widthPreview) {
      this.widthPreview = { ids: new Set(ids), base: store.page.els };
      store.mapEls(ids, (el) => (el.type === 'path' ? { ...el, size: w } : el));
    } else {
      // Rewrite the in-progress step instead of stacking one per slider tick.
      store.undo();
      store.mapEls(ids, (el) => (el.type === 'path' ? { ...el, size: w } : el));
    }
    if (commit) {
      this.widthPreview = null;
      if (store.selectedEls().some((x) => x.type === 'path' && x.style === 'shape')) store.setTool({ shapeSize: w / inkScale() });
    }
    const val = this.props.querySelector('.width-val');
    if (val) val.textContent = String(Math.round(w / inkScale()));
  }

  private scaleSelection(k: number): void {
    const r = this.board.selectionBounds();
    if (!r) return;
    const m = similarity(r.x + r.w / 2, r.y + r.h / 2, k, 0, 0, 0);
    store.mapEls(store.selection, (el) => {
      const t = transformEl(el, m);
      // Size buttons change the shape, not the line thickness.
      return t.type === 'path' && el.type === 'path' ? { ...t, size: el.size } : t;
    });
  }

  private duplicate(): void {
    const off = 30 / this.board.cam.z;
    const copies = regroup(store.selectedEls().map((e) => ({ ...translateEl(e, off, off), id: uid() }) as El));
    store.addEls(copies);
    store.select(copies.map((c) => c.id));
  }

  private deleteSelection(): void {
    if (!store.selection.size) return;
    store.replaceEls(new Set(store.selection), []);
    store.clearSelection();
  }

  private positionProps(): void {
    const bar = this.props;
    if (bar.hidden) return;
    const r = this.board.selectionBounds();
    if (!r) return;
    const [x1, y1] = this.board.toScreen(r.x, r.y);
    const [x2, y2] = this.board.toScreen(r.x + r.w, r.y + r.h);
    scaleFloating(bar);
    const k = ui();
    const bw = bar.offsetWidth * k, bh = bar.offsetHeight * k;
    // Keep clear of the toolbar edge.
    const pos = store.settings.tbPos;
    const minT = pos === 'top' ? 100 * k : 12, maxB = pos === 'bottom' ? 100 * k : 12;
    const minL = pos === 'left' ? 90 * k : 8, maxR = pos === 'right' ? 90 * k : 8;
    let top = y1 - bh - 56 * k;
    if (top < minT) top = y2 + 24;
    top = Math.max(minT, Math.min(this.board.h - bh - maxB, top));
    const left = Math.max(minL, Math.min(this.board.w - bw - maxR, (x1 + x2) / 2 - bw / 2));
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  }

  // ---------------------------------------------------------------------------
  // Chrome, keyboard, drag & drop, autosave

  private bindChrome(): void {
    this.toolbar.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
      if (b) this.onToolbarClick(b);
    });
    this.root.querySelector('.zoom-pill')!.addEventListener('click', () => this.action('zoom-reset'));
    this.board.el.addEventListener('pointerdown', () => this.closePopover(), true);
  }

  private updatePageLabel(): void {
    const label = this.root.querySelector('.page-label') as HTMLElement | null;
    if (label) label.textContent = `${store.index + 1} / ${store.doc.pages.length}`;
  }

  /** Size the toolbar and panels for this screen (phone → 86" panel). */
  private applyScale(keepPopover = false): void {
    // The toolbar always sits at the bottom.
    const pos: string = 'bottom';
    this.root.dataset.tb = pos;
    const vertical = pos === 'left' || pos === 'right';
    const left = this.toolbar.querySelector('.tb-left') as HTMLElement;
    const right = this.toolbar.querySelector('.tb-right') as HTMLElement;
    // Sizes are unaffected by the CSS scale transform.
    const L = vertical ? left.offsetHeight : left.offsetWidth;
    const R = vertical ? right.offsetHeight : right.offsetWidth;
    const avail = vertical ? window.innerHeight : window.innerWidth;
    // One line when both halves fit at a comfortable size; otherwise the
    // action bar moves into a second row (or column) beside the tools.
    const one = L + R + 40;
    const stacked = avail / one < 0.85;
    this.root.classList.toggle('tb-stacked', stacked);
    // Buttons are always the small size (big boards still scale them up).
    computeUiScale('small', stacked ? Math.max(L, R) + 20 : one, avail);
    // The page fills the whole screen; the toolbars float on top of it.
    this.board.insets = { top: 0, right: 0, bottom: 0, left: 0 };
    this.board.resize();
    if (!keepPopover) this.closePopover();
    else if (this.popover) {
      const anchor = this.toolbar.querySelector('[data-pop=menu]') as HTMLElement | null;
      if (anchor) this.positionPopover(anchor);
    }
    this.indAt = null;
    this.moveIndicator(left);
    this.positionProps();
  }

  /** Put the toolbars on another edge (they glide in there). */
  private setToolbarPos(pos: 'bottom' | 'top' | 'left' | 'right'): void {
    if (pos === store.settings.tbPos) return;
    store.setSettings({ tbPos: pos });
    for (const bar of this.toolbar.querySelectorAll<HTMLElement>('.toolbar')) {
      bar.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    }
  }

  /** Logo and clock switch to light text on green / black boards. */
  private updateBoardTone(): void {
    this.root.dataset.board = isDarkColor(store.page.bg) ? 'dark' : 'light';
  }

  private startClock(): void {
    const time = this.root.querySelector('[data-time]') as HTMLElement;
    // Just the time, e.g. "9:05" — no date, no AM/PM.
    const tick = () => {
      const d = new Date();
      time.textContent = `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    window.setInterval(tick, 5_000);
  }

  private updateZoom(): void {
    const pill = this.root.querySelector('.zoom-pill') as HTMLElement;
    // Shown only after moving / zooming the board; tap to go back to the whole page.
    const z = Math.round((store.camera.z / this.board.fitZ) * 100);
    pill.hidden = this.board.isHome;
    pill.textContent = z === 100 ? '⟲  Back to page' : `${z}%  ·  Whole page`;
  }

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === ' ' && !this.board.spaceDown) {
        this.board.spaceDown = true;
        this.board.updateCursor();
      } else if (ctrl && k === 'z' && !e.shiftKey) store.undo();
      else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) store.redo();
      else if (ctrl && k === 's') void saveNotebookDialog(this.root);
      else if (ctrl && k === 'c') copySelection();
      else if (ctrl && k === 'v') return; // handled by the paste event
      else if (ctrl && k === 'd') this.duplicate();
      else if (!ctrl && (e.key === 'Delete' || e.key === 'Backspace')) this.deleteSelection();
      else if (e.key === 'Escape') {
        this.closePopover();
        store.clearSelection();
      } else if (e.key === 'PageDown') this.action('next');
      else if (e.key === 'PageUp') this.action('prev');
      else if (!ctrl && ({ v: 'select', p: 'pen', e: 'eraser', s: 'shape', t: 'text' } as Record<string, ToolId>)[k]) {
        store.setTool({ tool: ({ v: 'select', p: 'pen', e: 'eraser', s: 'shape', t: 'text' } as Record<string, ToolId>)[k] });
      } else return;
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') {
        this.board.spaceDown = false;
        this.board.updateCursor();
      }
    });
    window.addEventListener('paste', async (e) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      const img = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const file = img?.getAsFile();
      if (file) {
        e.preventDefault();
        const el = await insertImageSrc(this.board, await readAsDataURL(file));
        store.setTool({ tool: 'select' });
        store.select([el.id]);
        return;
      }
      if (pasteElements(this.board)) {
        e.preventDefault();
        return;
      }
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        e.preventDefault();
        const v = this.board.viewRect();
        const fs = store.tool.fontSize * inkScale();
        const sz = measureText(text, fs, false, 900, false);
        const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
        const el: El = { id: uid(), type: 'text', text, x: cx - sz.w / 2, y: cy - sz.h / 2, w: sz.w, h: sz.h, rot: 0, color: store.tool.color, fontSize: fs };
        store.addEls([el]);
        store.setTool({ tool: 'select' });
        store.select([el.id]);
      }
    });
  }

  private bindDrop(): void {
    const hint = this.root.querySelector('.drop-hint') as HTMLElement;
    let depth = 0;
    window.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth++;
      hint.hidden = false;
    });
    window.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) hint.hidden = true;
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      depth = 0;
      hint.hidden = true;
      const pg = e.dataTransfer?.getData(PAGE_DRAG);
      if (pg) return this.dropPage(Number(pg), e.clientX, e.clientY);
      const files = [...(e.dataTransfer?.files ?? [])];
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length) await insertImages(this.board, images);
      for (const f of files) {
        if (f.type === 'application/pdf') await this.withProgress('Opening PDF', (p) => importPdf(this.board, f, p));
        else if (/\.pptx?$/i.test(f.name)) await this.openSlides(f);
        else if (/\.(teachly|json)$/i.test(f.name)) await openFile(f);
      }
    });
  }

  /** A page dragged from the page sorter: its writing is copied at full quality. */
  private dropPage(i: number, cx: number, cy: number): void {
    const page = store.doc.pages[i];
    const src = page?.els ?? [];
    if (!src.length) return toast('That page is empty');
    const b = unionRects(src.map(bbox));
    if (!b) return;
    const v = this.board.viewRect();
    const k = Math.min(1, (v.w * 0.5) / Math.max(1, b.w), (v.h * 0.5) / Math.max(1, b.h));
    const r = this.board.el.getBoundingClientRect();
    const [wx, wy] = this.board.toWorld(cx - r.left, cy - r.top);
    const dx = wx - (b.x + (b.w * k) / 2), dy = wy - (b.y + (b.h * k) / 2);
    const group = uid();
    const els = src.map((e) => {
      const out = translateEl(resizeEl({ ...e, id: uid(), group, locked: false } as El, b.x, b.y, k, k), dx, dy);
      // Lines shrink with the page, so the copy looks exactly like the page.
      return out.type === 'path' ? { ...out, size: Math.max(0.6, out.size * k) } : out;
    });
    store.addEls(els);
    store.setTool({ tool: 'select' });
    store.select(els.map((e) => e.id));
  }

  private saveTimer = 0;

  private scheduleSave(): void {
    // Save once the teacher pauses (and never while a finger or pen is
    // on the board), so saving never interrupts writing on slow boards.
    clearTimeout(this.saveTimer);
    const attempt = () => {
      if (this.board.busyInput) {
        this.saveTimer = window.setTimeout(attempt, 1200);
        return;
      }
      saveLocalSafe();
    };
    // Short pause: if the power goes, at most the last second is lost.
    this.saveTimer = window.setTimeout(attempt, 1200);
  }
}

/** A lazily loaded part of the app could not be loaded (an older version is still open). */
function isStaleCode(e: unknown): boolean {
  return /Importing a module script failed|dynamically imported module|Unable to preload|module script|Loading chunk/i.test(String((e as Error)?.message ?? e));
}

/** Save, then reload once to get the current version. False if that was just tried. */
function reloadForUpdate(): boolean {
  try {
    const last = Number(sessionStorage.getItem('teachly.updateReload') || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem('teachly.updateReload', String(Date.now()));
    sessionStorage.setItem('teachly.quickStart', '1');
    sessionStorage.setItem('teachly.afterUpdate', '1');
  } catch {
    return false;
  }
  toast('Teachly was updated: reloading…', 3000);
  // Save first (not on idle), then reload.
  void saveNotebook(store.doc)
    .catch(() => {
      /* storage full or unavailable: the session copy still restores the lesson */
    })
    .finally(() => location.reload());
  return true;
}

function saveLocalSafe(): void {
  const run = () =>
    saveNotebook(store.doc).catch(() => {
      /* storage full or unavailable */
    });
  // Save when the device is idle so it never interrupts writing.
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(run, { timeout: 2000 });
  else run();
}
