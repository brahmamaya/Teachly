import { Board } from '../board';
import { translateEl, uid } from '../geometry';
import { cameraCapture, isRecording, recordingElapsed, snapshotScreen, startRecording, stopRecording } from '../io/capture';
import {
  copySelection,
  exportPdf,
  exportPng,
  importPdf,
  insertImages,
  insertImageSrc,
  insertVideo,
  loadLocal,
  openFile,
  pasteElements,
  readAsDataURL,
  saveFile,
  saveLocal,
} from '../io/files';
import { contentBounds, drawEls, getVideo, isDarkColor, measureText, pauseAllVideos, renderRegion } from '../renderer';
import { newPage, store } from '../store';
import { EraserTool } from '../tools/eraser';
import { CompassTool, LaserTool, PanTool, ShapeTool } from '../tools/misc';
import { PenTool } from '../tools/pen';
import { SelectTool } from '../tools/select';
import { TextEditor, TextTool } from '../tools/text';
import type { BgPattern, El, GraphEl, ShapeKind, ToolId } from '../types';
import { openCalculator, openClock, openPicker, openScoreboard, openTimer } from '../widgets/classroom';
import { toggleCurtain, toggleMagnifier, toggleSpotlight } from '../widgets/focus';
import { openGrapher, openPeriodicTable, openStamps } from '../widgets/subject';
import { icon } from './icons';
import { esc, floatingPanel, toast } from './panel';

const PEN_COLORS = ['#1e293b', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78350f'];
const HL_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6', '#fb923c', '#a78bfa'];
const PEN_SIZES = [2, 4, 7, 12, 20];
const BG_COLORS: [string, string][] = [
  ['#ffffff', 'White'],
  ['#fffbeb', 'Paper'],
  ['#f1f5f9', 'Light grey'],
  ['#14532d', 'Chalk green'],
  ['#1e293b', 'Slate'],
  ['#0b1020', 'Black'],
  ['#1e3a8a', 'Blue'],
];
const PATTERNS: [BgPattern, string][] = [
  ['none', 'Plain'],
  ['grid', 'Grid'],
  ['dots', 'Dots'],
  ['lines', 'Ruled'],
  ['fourline', '4-line (English)'],
  ['graph', 'Graph paper'],
  ['music', 'Music staff'],
  ['isometric', 'Isometric'],
];
const SHAPES: [ShapeKind, string][] = [
  ['line', 'Line'],
  ['arrow', 'Arrow'],
  ['darrow', 'Double arrow'],
  ['dashed', 'Dashed line'],
  ['rect', 'Rectangle'],
  ['square', 'Square'],
  ['ellipse', 'Ellipse'],
  ['circle', 'Circle'],
  ['triangle', 'Triangle'],
  ['rtriangle', 'Right triangle'],
  ['diamond', 'Rhombus'],
  ['parallelogram', 'Parallelogram'],
  ['trapezoid', 'Trapezium'],
  ['pentagon', 'Pentagon'],
  ['hexagon', 'Hexagon'],
  ['star', 'Star'],
  ['cube', 'Cube'],
  ['cylinder', 'Cylinder'],
  ['cone', 'Cone'],
  ['sphere', 'Sphere'],
  ['axes', 'XY axes'],
];

/** Tiny SVG previews for the shape picker. */
const SHAPE_SVG: Record<ShapeKind, string> = {
  line: '<path d="M4 20L20 4"/>',
  arrow: '<path d="M4 20L20 4M12 4h8v8"/>',
  darrow: '<path d="M4 20L20 4M12 4h8v8M12 20H4v-8"/>',
  dashed: '<path d="M4 20L20 4" stroke-dasharray="3 3"/>',
  rect: '<rect x="3" y="6" width="18" height="12"/>',
  square: '<rect x="4" y="4" width="16" height="16"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="10" ry="6.5"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  triangle: '<path d="M12 3l9 18H3z"/>',
  rtriangle: '<path d="M4 3v18h16z"/>',
  diamond: '<path d="M12 2l9 10-9 10-9-10z"/>',
  parallelogram: '<path d="M7 5h14l-4 14H3z"/>',
  trapezoid: '<path d="M7 5h10l4 14H3z"/>',
  pentagon: '<path d="M12 2l10 7.3-3.8 11.7H5.8L2 9.3z"/>',
  hexagon: '<path d="M7 3h10l5 9-5 9H7l-5-9z"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/>',
  cube: '<path d="M4 8h12v12H4zM4 8l4-4h12l-4 4M20 4v12l-4 4"/>',
  cylinder: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/>',
  cone: '<path d="M12 2L4 19M12 2l8 17"/><ellipse cx="12" cy="19" rx="8" ry="3"/>',
  sphere: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="3"/>',
  axes: '<path d="M2 12h20M12 2v20M19 9l3 3-3 3M9 5l3-3 3 3"/>',
};

export class App {
  board: Board;
  editor: TextEditor;
  private root: HTMLElement;
  private popover: HTMLElement | null = null;
  private popFor = '';
  private toolbar!: HTMLElement;
  private selbar!: HTMLElement;
  private minimap!: HTMLCanvasElement;
  private pagesPanel: HTMLElement | null = null;
  private recTimer = 0;
  private textTool!: TextTool;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="board" id="board"></div>
      <header class="topbar">
        <div class="brand"><span class="logo">T</span><span class="brand-name">Teachly</span><input class="doc-title" value="" spellcheck="false" aria-label="Lesson title"></div>
        <div class="top-actions">
          <div class="rec-pill" hidden><span class="dot"></span><span data-rec>00:00</span><button class="chip" data-act="rec-stop">Stop</button></div>
          <div class="zoom-ctl">
            <button class="icon-btn" data-act="zoom-out" title="Zoom out (−)">${icon('zoomout')}</button>
            <button class="zoom-label" data-act="zoom-reset" title="Reset zoom (0)">100%</button>
            <button class="icon-btn" data-act="zoom-in" title="Zoom in (+)">${icon('zoomin')}</button>
            <button class="icon-btn" data-act="fit" title="Fit content">${icon('fit')}</button>
          </div>
          <button class="icon-btn" data-act="fullscreen" title="Full screen (F)">${icon('fullscreen')}</button>
          <button class="icon-btn" data-act="menu" title="Menu">${icon('menu')}</button>
        </div>
      </header>
      <nav class="toolbar" aria-label="Tools"></nav>
      <div class="pagebar">
        <button class="icon-btn" data-act="prev" title="Previous page (PageUp)">${icon('prev')}</button>
        <button class="page-label" data-act="pages" title="All pages"></button>
        <button class="icon-btn" data-act="next" title="Next page (PageDown)">${icon('next')}</button>
        <button class="icon-btn" data-act="add-page" title="New page">${icon('plus')}</button>
      </div>
      <canvas class="minimap" width="220" height="140" title="Navigation map — drag to move around"></canvas>
      <div class="selbar" hidden></div>
      <div class="drop-hint" hidden>Drop images, PDF, video or .teachly files</div>`;

    this.board = new Board(root.querySelector('#board') as HTMLElement);
    this.editor = new TextEditor(this.board);
    this.registerTools();
    this.toolbar = root.querySelector('.toolbar') as HTMLElement;
    this.selbar = root.querySelector('.selbar') as HTMLElement;
    this.minimap = root.querySelector('.minimap') as HTMLCanvasElement;
    this.renderToolbar();
    this.bindTopbar();
    this.bindMinimap();
    this.bindKeys();
    this.bindDrop();
    this.applySettings();

    store.on('tool', () => this.renderToolbar());
    store.on('settings', () => this.applySettings());
    store.on('doc', () => {
      this.updatePageLabel();
      this.updateSelbar();
      this.scheduleMinimap();
      this.scheduleSave();
      this.refreshPagesPanel();
      this.updateUndo();
    });
    store.on('page', () => {
      pauseAllVideos();
      this.updatePageLabel();
      this.updateThemeForBg();
    });
    store.on('camera', () => {
      this.updateZoomLabel();
      this.updateSelbar();
      this.scheduleMinimap();
    });
    store.on('selection', () => this.updateSelbar());
    this.updatePageLabel();
    this.updateZoomLabel();
    this.updateThemeForBg();
    this.scheduleMinimap();
    void this.restore();
  }

  private registerTools(): void {
    const b = this.board;
    this.textTool = new TextTool(b, this.editor);
    const tools: [ToolId, import('../board').Tool][] = [
      ['select', new SelectTool(b, this.editor)],
      ['pen', new PenTool(b)],
      ['eraser', new EraserTool(b)],
      ['shape', new ShapeTool(b)],
      ['text', this.textTool],
      ['laser', new LaserTool(b)],
      ['pan', new PanTool()],
      ['compass', new CompassTool(b)],
    ];
    for (const [id, t] of tools) b.tools.set(id, t);
    b.updateCursor();
  }

  private async restore(): Promise<void> {
    const doc = await loadLocal();
    if (doc) {
      store.loadDoc(doc);
      this.updateTitle();
    } else this.updateTitle();
  }

  // ---------------------------------------------------------------------------
  // Toolbar

  private renderToolbar(): void {
    const t = store.tool;
    const penIcon = t.penStyle === 'highlighter' ? 'highlighter' : t.penStyle === 'brush' ? 'brush' : t.penStyle === 'magic' ? 'magic' : 'pen';
    const curColor = t.penStyle === 'highlighter' ? t.hlColor : t.color;
    const btn = (id: string, ic: string, title: string, active = false, extra = '') =>
      `<button class="tb-btn ${active ? 'active' : ''}" data-tool="${id}" title="${title}" ${extra}>${icon(ic, 24)}</button>`;
    this.toolbar.innerHTML = `
      ${btn('select', 'select', 'Select (V)', t.tool === 'select')}
      <button class="tb-btn ${t.tool === 'pen' ? 'active' : ''}" data-tool="pen" title="Pen (P) — tap again for options">${icon(penIcon, 24)}<span class="swatch-dot" style="background:${curColor}"></span></button>
      ${btn('eraser', 'eraser', 'Eraser (E) — tap again for options', t.tool === 'eraser')}
      ${btn('shape', 'shapes', 'Shapes (S)', t.tool === 'shape')}
      ${btn('text', 'text', 'Text & sticky notes (T)', t.tool === 'text')}
      ${btn('laser', 'laser', 'Laser pointer (L)', t.tool === 'laser')}
      ${btn('pan', 'pan', 'Pan / move board (H or hold Space)', t.tool === 'pan')}
      <span class="tb-sep"></span>
      <button class="tb-btn" data-act="undo" title="Undo (Ctrl+Z)">${icon('undo', 24)}</button>
      <button class="tb-btn" data-act="redo" title="Redo (Ctrl+Y)">${icon('redo', 24)}</button>
      <span class="tb-sep"></span>
      <button class="tb-btn" data-pop="insert" title="Insert">${icon('plus', 24)}</button>
      <button class="tb-btn" data-pop="tools" title="Teaching & subject tools">${icon('tools', 24)}</button>
      <button class="tb-btn" data-pop="background" title="Background">${icon('background', 24)}</button>`;
    this.toolbar.querySelectorAll('[data-tool]').forEach((el) =>
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.tool as ToolId;
        if (store.tool.tool === id && ['pen', 'eraser', 'shape', 'text'].includes(id)) this.togglePopover(id, el as HTMLElement);
        else {
          this.closePopover();
          store.setTool({ tool: id });
          if (id === 'shape') this.togglePopover('shape', this.toolbar.querySelector('[data-tool=shape]') as HTMLElement);
        }
      }),
    );
    this.toolbar.querySelectorAll('[data-pop]').forEach((el) =>
      el.addEventListener('click', () => this.togglePopover((el as HTMLElement).dataset.pop!, el as HTMLElement)),
    );
    this.toolbar.querySelector('[data-act=undo]')!.addEventListener('click', () => store.undo());
    this.toolbar.querySelector('[data-act=redo]')!.addEventListener('click', () => store.redo());
    this.updateUndo();
    if (this.popover && this.popFor) {
      // Keep popover anchored to the re-rendered button.
      const anchor = this.toolbar.querySelector(`[data-tool="${this.popFor}"],[data-pop="${this.popFor}"]`) as HTMLElement | null;
      if (anchor) this.positionPopover(anchor);
    }
  }

  private updateUndo(): void {
    this.toolbar.querySelector('[data-act=undo]')?.toggleAttribute('disabled', !store.canUndo);
    this.toolbar.querySelector('[data-act=redo]')?.toggleAttribute('disabled', !store.canRedo);
  }

  private closePopover(): void {
    this.popover?.remove();
    this.popover = null;
    this.popFor = '';
  }

  private togglePopover(kind: string, anchor: HTMLElement): void {
    if (this.popFor === kind) return this.closePopover();
    this.closePopover();
    const pop = document.createElement('div');
    pop.className = 'popover';
    pop.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.appendChild(pop);
    this.popover = pop;
    this.popFor = kind;
    this.fillPopover(kind, pop);
    this.positionPopover(anchor);
  }

  private positionPopover(anchor: HTMLElement): void {
    const pop = this.popover;
    if (!pop) return;
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(8, Math.min(window.innerWidth - pw - 8, left));
    const top = Math.max(8, r.top - ph - 12);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  private fillPopover(kind: string, pop: HTMLElement): void {
    const t = store.tool;
    const rerender = () => {
      this.fillPopover(kind, pop);
    };
    const colorRow = (colors: string[], current: string, key: 'color' | 'hlColor') =>
      `<div class="swatches">${colors.map((c) => `<button class="swatch ${c === current ? 'on' : ''}" style="background:${c}" data-color="${c}" data-key="${key}" title="${c}"></button>`).join('')}<label class="swatch custom" title="Custom colour"><input type="color" value="${current}" data-key="${key}"></label></div>`;
    switch (kind) {
      case 'pen': {
        const hl = t.penStyle === 'highlighter';
        const sizes = hl ? [12, 22, 34, 48] : PEN_SIZES;
        const size = hl ? t.hlSize : t.size;
        pop.innerHTML = `
          <div class="pop-title">Pen</div>
          <div class="seg">${(['pen', 'brush', 'highlighter', 'magic'] as const).map((s) => `<button class="${t.penStyle === s ? 'on' : ''}" data-style="${s}">${icon(s === 'magic' ? 'magic' : s, 18)} ${s === 'magic' ? 'Magic ink' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
          ${colorRow(hl ? HL_COLORS : PEN_COLORS, hl ? t.hlColor : t.color, hl ? 'hlColor' : 'color')}
          <div class="sizes">${sizes.map((s) => `<button class="size ${s === size ? 'on' : ''}" data-size="${s}" title="${s}px"><span style="width:${Math.min(28, s + 2)}px;height:${Math.min(28, s + 2)}px;background:${hl ? t.hlColor : t.color}"></span></button>`).join('')}
            <input type="range" min="1" max="${hl ? 60 : 40}" value="${size}" data-range></div>
          <label class="check"><input type="checkbox" data-set="autoShape" ${store.settings.autoShape ? 'checked' : ''}> Smart shapes — auto-straighten drawn shapes</label>
          <div class="muted small">Tip: hold the pen still at the end of a stroke to snap it into a perfect shape.</div>`;
        break;
      }
      case 'eraser':
        pop.innerHTML = `
          <div class="pop-title">Eraser</div>
          <div class="seg">
            <button class="${t.eraserMode === 'stroke' ? 'on' : ''}" data-emode="stroke">Stroke</button>
            <button class="${t.eraserMode === 'point' ? 'on' : ''}" data-emode="point">Partial</button>
            <button class="${t.eraserMode === 'area' ? 'on' : ''}" data-emode="area">Lasso area</button>
          </div>
          <div class="row gap">Size <input type="range" min="8" max="120" value="${t.eraserSize}" data-esize class="grow"></div>
          <label class="check"><input type="checkbox" data-set="palmErase" ${store.settings.palmErase ? 'checked' : ''}> Palm eraser — rub with your palm/fist to erase</label>
          <button class="btn danger wide" data-act="clear-page">${icon('trash', 18)} Clear page</button>`;
        break;
      case 'shape':
        pop.innerHTML = `
          <div class="pop-title">Shapes</div>
          <div class="shape-grid">${SHAPES.map(([k, n]) => `<button class="shape-btn ${t.shape === k ? 'on' : ''}" data-shape="${k}" title="${n}"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${SHAPE_SVG[k]}</svg></button>`).join('')}</div>
          ${colorRow(PEN_COLORS, t.color, 'color')}
          <div class="row gap"><label class="check"><input type="checkbox" data-fill ${t.shapeFill ? 'checked' : ''}> Fill shape</label><span class="grow"></span>Line <input type="range" min="1" max="20" value="${t.size}" data-range></div>
          <div class="muted small">Hold Shift for perfect squares, circles and 45° lines.</div>`;
        break;
      case 'text':
        pop.innerHTML = `
          <div class="pop-title">Text</div>
          <div class="seg"><button class="${!this.textTool.sticky ? 'on' : ''}" data-sticky="0">${icon('text', 18)} Text</button><button class="${this.textTool.sticky ? 'on' : ''}" data-sticky="1">${icon('sticky', 18)} Sticky note</button></div>
          ${colorRow(PEN_COLORS, t.color, 'color')}
          <div class="sizes">${[20, 28, 36, 48, 72].map((s) => `<button class="size text-size ${s === t.fontSize ? 'on' : ''}" data-fsize="${s}">${s}</button>`).join('')}</div>
          <div class="muted small">Tap on the board to type. Double-tap text with Select to edit.</div>`;
        break;
      case 'insert':
        pop.innerHTML = `
          <div class="pop-title">Insert</div>
          <div class="grid-btns">
            ${this.gridBtn('ins-image', 'image', 'Image')}
            ${this.gridBtn('ins-pdf', 'pdf', 'PDF / Book')}
            ${this.gridBtn('ins-video', 'video', 'Video')}
            ${this.gridBtn('ins-sticky', 'sticky', 'Sticky note')}
            ${this.gridBtn('ins-camera', 'camera', 'Camera')}
            ${this.gridBtn('ins-screen', 'screen', 'Screenshot')}
            ${this.gridBtn('ins-graph', 'graph', 'Graph')}
            ${this.gridBtn('ins-page', 'pages', 'New page')}
          </div>`;
        break;
      case 'tools':
        pop.innerHTML = `
          <div class="pop-title">Classroom</div>
          <div class="grid-btns">
            ${this.gridBtn('w-timer', 'timer', 'Timer')}
            ${this.gridBtn('w-clock', 'clock', 'Clock')}
            ${this.gridBtn('w-picker', 'picker', 'Random picker')}
            ${this.gridBtn('w-score', 'score', 'Scoreboard')}
            ${this.gridBtn('w-spot', 'spotlight', 'Spotlight')}
            ${this.gridBtn('w-curtain', 'curtain', 'Screen cover')}
            ${this.gridBtn('w-mag', 'magnifier', 'Magnifier')}
            ${this.gridBtn('w-rec', 'record', isRecording() ? 'Stop recording' : 'Record lesson')}
          </div>
          <div class="pop-title">Maths & geometry</div>
          <div class="grid-btns">
            ${this.gridBtn('i-ruler', 'ruler', 'Ruler', this.board.instruments.has('ruler'))}
            ${this.gridBtn('i-setsquare', 'setsquare', 'Set square 30/60', this.board.instruments.has('setsquare'))}
            ${this.gridBtn('i-setsquare45', 'setsquare', 'Set square 45', this.board.instruments.has('setsquare45'))}
            ${this.gridBtn('i-protractor', 'protractor', 'Protractor', this.board.instruments.has('protractor'))}
            ${this.gridBtn('t-compass', 'compass', 'Compass', store.tool.tool === 'compass')}
            ${this.gridBtn('ins-graph', 'graph', 'Function graph')}
            ${this.gridBtn('w-calc', 'calc', 'Calculator')}
            ${this.gridBtn('s-Maths', 'shapes', 'Maths library')}
          </div>
          <div class="pop-title">Science & languages</div>
          <div class="grid-btns">
            ${this.gridBtn('w-ptable', 'atom', 'Periodic table')}
            ${this.gridBtn('s-Chemistry', 'flask', 'Chemistry lab')}
            ${this.gridBtn('s-Physics', 'bolt', 'Physics circuits')}
            ${this.gridBtn('s-Biology', 'sticky', 'Biology')}
            ${this.gridBtn('bg-fourline', 'abc', 'English 4-line')}
            ${this.gridBtn('bg-music', 'menu', 'Music staff')}
          </div>`;
        break;
      case 'background': {
        const p = store.page;
        pop.innerHTML = `
          <div class="pop-title">Board colour</div>
          <div class="swatches">${BG_COLORS.map(([c, n]) => `<button class="swatch big ${p.bg === c ? 'on' : ''}" style="background:${c}" data-bg="${c}" title="${n}"></button>`).join('')}<label class="swatch big custom" title="Custom"><input type="color" value="${p.bg}" data-bgc></label></div>
          <div class="pop-title">Pattern</div>
          <div class="pattern-grid">${PATTERNS.map(([k, n]) => `<button class="chip ${p.pattern === k ? 'on' : ''}" data-pattern="${k}">${n}</button>`).join('')}</div>
          <label class="check"><input type="checkbox" data-allpages> Apply to all pages</label>
          <button class="btn wide" data-act="unlock-all">${icon('unlock', 18)} Unlock all locked items on this page</button>`;
        break;
      }
    }
    this.wirePopover(kind, pop, rerender);
  }

  private gridBtn(act: string, ic: string, label: string, on = false): string {
    return `<button class="grid-btn ${on ? 'on' : ''}" data-act="${act}">${icon(ic, 26)}<span>${label}</span></button>`;
  }

  private wirePopover(kind: string, pop: HTMLElement, rerender: () => void): void {
    pop.onclick = (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
      if (!b) return;
      const d = b.dataset;
      if (d.style) {
        store.setTool({ penStyle: d.style as typeof store.tool.penStyle, tool: 'pen' });
        rerender();
      } else if (d.color) {
        store.setTool({ [d.key as 'color']: d.color });
        this.recolorSelection(d.color);
        rerender();
      } else if (d.size) {
        if (store.tool.penStyle === 'highlighter') store.setTool({ hlSize: Number(d.size) });
        else store.setTool({ size: Number(d.size) });
        rerender();
      } else if (d.emode) {
        store.setTool({ eraserMode: d.emode as 'stroke' });
        rerender();
      } else if (d.shape) {
        store.setTool({ shape: d.shape as ShapeKind, tool: 'shape' });
        this.closePopover();
      } else if (d.sticky !== undefined) {
        this.textTool.sticky = d.sticky === '1';
        store.setTool({ tool: 'text' });
        rerender();
      } else if (d.fsize) {
        store.setTool({ fontSize: Number(d.fsize) });
        rerender();
      } else if (d.bg) {
        this.setBackground({ bg: d.bg }, pop);
        rerender();
      } else if (d.pattern) {
        this.setBackground({ pattern: d.pattern as BgPattern }, pop);
        rerender();
      } else if (d.act) {
        this.action(d.act);
        if (!['clear-page'].includes(d.act) && kind !== 'background') this.closePopover();
      }
    };
    pop.oninput = (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.range !== undefined) {
        if (kind === 'pen' && store.tool.penStyle === 'highlighter') store.setTool({ hlSize: Number(el.value) });
        else store.setTool({ size: Number(el.value) });
      }
      if (el.dataset.esize !== undefined) store.setTool({ eraserSize: Number(el.value) });
      if (el.type === 'color' && el.dataset.key) {
        store.setTool({ [el.dataset.key as 'color']: el.value });
        this.recolorSelection(el.value);
      }
      if (el.dataset.bgc !== undefined) this.setBackground({ bg: el.value }, pop);
    };
    pop.onchange = (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.set) store.setSettings({ [el.dataset.set]: el.checked });
      if (el.dataset.fill !== undefined) store.setTool({ shapeFill: el.checked });
      if (kind === 'pen' || kind === 'shape') this.renderToolbar();
    };
  }

  private setBackground(patch: { bg?: string; pattern?: BgPattern }, pop: HTMLElement): void {
    const all = (pop.querySelector('[data-allpages]') as HTMLInputElement | null)?.checked;
    if (all) store.commit(store.doc.pages.map((p) => ({ ...p, ...patch })));
    else store.updatePage(patch);
    this.updateThemeForBg();
    // Pick a readable default pen colour on dark boards.
    if (patch.bg) {
      const dark = isDarkColor(patch.bg);
      if (dark && store.tool.color === '#1e293b') store.setTool({ color: '#ffffff' });
      if (!dark && store.tool.color === '#ffffff') store.setTool({ color: '#1e293b' });
    }
  }

  private recolorSelection(color: string): void {
    if (!store.selection.size) return;
    store.mapEls(store.selection, (e) => {
      if (e.type === 'path') return { ...e, color, fill: e.fill ? color + '38' : e.fill };
      if (e.type === 'text') return e.bg ? e : { ...e, color };
      return e;
    });
  }

  private updateThemeForBg(): void {
    this.root.dataset.board = isDarkColor(store.page.bg) ? 'dark' : 'light';
  }

  // ---------------------------------------------------------------------------
  // Actions

  action(act: string): void {
    const b = this.board;
    const host = this.root;
    switch (act) {
      case 'undo':
        return store.undo();
      case 'redo':
        return store.redo();
      case 'zoom-in':
        return b.zoomAt(b.w / 2, b.h / 2, 1.25);
      case 'zoom-out':
        return b.zoomAt(b.w / 2, b.h / 2, 0.8);
      case 'zoom-reset':
        return b.zoomTo(1);
      case 'fit':
        return b.fitContent();
      case 'fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => toast('Full screen not available'));
        return;
      case 'menu':
        return this.openMenu();
      case 'prev':
        return store.goTo(store.index - 1);
      case 'next':
        if (store.index === store.doc.pages.length - 1) store.addPage();
        else store.goTo(store.index + 1);
        return;
      case 'add-page':
      case 'ins-page':
        store.addPage();
        return toast(`Page ${store.index + 1} added`);
      case 'pages':
        return this.togglePagesPanel();
      case 'clear-page':
        if (store.page.els.length && confirm('Clear everything on this page? (You can undo.)')) store.setEls(store.page.els.filter((e) => e.locked));
        return;
      case 'unlock-all':
        store.setEls(store.page.els.map((e) => (e.locked ? { ...e, locked: false } : e)));
        return toast('Unlocked');
      case 'ins-image':
        void insertImages(b);
        return;
      case 'ins-pdf':
        void this.withProgress('Importing PDF', (p) => importPdf(b, undefined, p));
        return;
      case 'ins-video':
        void insertVideo(b);
        return;
      case 'ins-sticky':
        this.textTool.sticky = true;
        store.setTool({ tool: 'text' });
        return toast('Tap on the board to place a sticky note');
      case 'ins-camera':
        void cameraCapture(b, host);
        return;
      case 'ins-screen':
        void snapshotScreen(b).catch(() => {});
        return;
      case 'ins-graph':
        return openGrapher(host, b);
      case 'w-timer':
        return openTimer(host);
      case 'w-clock':
        return openClock(host);
      case 'w-picker':
        return openPicker(host);
      case 'w-score':
        return openScoreboard(host);
      case 'w-calc':
        return openCalculator(host);
      case 'w-spot':
        return toggleSpotlight(host);
      case 'w-curtain':
        return toggleCurtain(host.querySelector('#board') as HTMLElement);
      case 'w-mag':
        return toggleMagnifier(host, b);
      case 'w-ptable':
        return openPeriodicTable(host, b);
      case 'w-rec':
        if (isRecording()) stopRecording();
        else void this.startRec();
        return;
      case 'rec-stop':
        return stopRecording();
      case 'i-ruler':
      case 'i-setsquare':
      case 'i-setsquare45':
      case 'i-protractor':
        b.instruments.toggle(act.slice(2) as 'ruler');
        if (store.tool.tool !== 'pen' && store.tool.tool !== 'shape') store.setTool({ tool: 'pen' });
        return;
      case 't-compass':
        store.setTool({ tool: 'compass' });
        return toast('Drag from the centre to set the radius, then drag around to draw');
      case 'bg-fourline':
      case 'bg-music':
        store.updatePage({ pattern: act.slice(3) as BgPattern });
        return;
      case 'new':
        if (confirm('Start a new lesson? Save the current one first if you need it.')) {
          store.loadDoc({ version: 1, title: 'Untitled lesson', pages: [newPage()] });
          this.updateTitle();
        }
        return;
      case 'open':
        void openFile().then(() => this.updateTitle());
        return;
      case 'save':
        saveFile();
        return toast('Lesson saved as .teachly file');
      case 'export-pdf':
        void this.withProgress('Exporting PDF', () => exportPdf(b));
        return;
      case 'export-png':
        return exportPng(b);
      case 'help':
        return this.openHelp();
    }
    if (act.startsWith('s-')) openStamps(host, b, act.slice(2));
  }

  private async withProgress(label: string, fn: (p: (d: number, t: number) => void) => Promise<void>): Promise<void> {
    const el = document.createElement('div');
    el.className = 'progress-toast';
    el.textContent = `${label}…`;
    this.root.appendChild(el);
    try {
      await fn((d, t) => (el.textContent = `${label}… ${d}/${t}`));
    } catch (e) {
      toast(`${label} failed: ${(e as Error).message}`, 4000);
    } finally {
      el.remove();
    }
  }

  private async startRec(): Promise<void> {
    const pill = this.root.querySelector('.rec-pill') as HTMLElement;
    try {
      await startRecording(true, () => {
        pill.hidden = true;
        clearInterval(this.recTimer);
        toast('Recording saved to your downloads');
      });
    } catch {
      return;
    }
    pill.hidden = false;
    const label = pill.querySelector('[data-rec]') as HTMLElement;
    this.recTimer = window.setInterval(() => {
      const s = Math.floor(recordingElapsed() / 1000);
      label.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Top bar, menu, help

  private bindTopbar(): void {
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!b || b.closest('.popover') || b.closest('.toolbar')) return;
      if (b.closest('.topbar') || b.closest('.pagebar') || b.closest('.rec-pill')) this.action(b.dataset.act!);
    });
    const title = this.root.querySelector('.doc-title') as HTMLInputElement;
    title.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') title.blur();
    });
    title.addEventListener('change', () => {
      store.doc = { ...store.doc, title: title.value.trim() || 'Untitled lesson' };
      this.scheduleSave();
    });
    // Close popovers when interacting with the board.
    this.board.el.addEventListener('pointerdown', () => this.closePopover(), true);
    document.addEventListener('fullscreenchange', () => this.root.classList.toggle('is-fullscreen', !!document.fullscreenElement));
  }

  private updateTitle(): void {
    (this.root.querySelector('.doc-title') as HTMLInputElement).value = store.doc.title;
  }

  private updatePageLabel(): void {
    (this.root.querySelector('.page-label') as HTMLElement).textContent = `${store.index + 1} / ${store.doc.pages.length}`;
  }

  private updateZoomLabel(): void {
    (this.root.querySelector('.zoom-label') as HTMLElement).textContent = `${Math.round(store.camera.z * 100)}%`;
  }

  private openMenu(): void {
    const body = floatingPanel(this.root, { id: 'menu', title: 'Teachly', iconName: 'menu', width: 360, x: window.innerWidth - 380, y: 64 });
    if (!body) return;
    const s = store.settings;
    const item = (act: string, ic: string, label: string, kbd = '') => `<button class="menu-item" data-act="${act}">${icon(ic, 20)}<span>${label}</span>${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`;
    const check = (key: keyof typeof s, label: string, hint: string) =>
      `<label class="check menu-check"><input type="checkbox" data-set="${key}" ${s[key] ? 'checked' : ''}><span><b>${label}</b><small>${hint}</small></span></label>`;
    body.innerHTML = `
      <div class="menu-group">
        ${item('new', 'new', 'New lesson')}
        ${item('open', 'open', 'Open lesson (.teachly)', 'Ctrl+O')}
        ${item('save', 'save', 'Save lesson file', 'Ctrl+S')}
        ${item('ins-pdf', 'pdf', 'Import PDF / book pages')}
        ${item('export-pdf', 'download', 'Export all pages as PDF')}
        ${item('export-png', 'image', 'Export this page as PNG')}
        ${item('w-rec', 'record', isRecording() ? 'Stop recording' : 'Record lesson (screen + mic)')}
      </div>
      <div class="pop-title">Writing</div>
      ${check('penOnly', 'Stylus-only writing', 'Fingers pan & zoom, stylus writes (great for smart panels)')}
      ${check('multiWrite', 'Multi-touch writing', 'Several students can write at the same time')}
      ${check('palmErase', 'Palm eraser', 'Rub with palm or fist to erase')}
      ${check('pressure', 'Pen pressure', 'Use stylus pressure for line width')}
      ${check('autoShape', 'Smart shapes', 'Automatically clean up drawn shapes')}
      ${check('minimap', 'Navigation map', 'Show the mini map of the board')}
      <div class="pop-title">Toolbar position</div>
      <div class="seg">${(['left', 'center', 'right'] as const).map((p) => `<button class="${s.toolbarPos === p ? 'on' : ''}" data-tbpos="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div>
      <div class="pop-title">Appearance</div>
      <div class="seg"><button class="${s.uiTheme === 'light' ? 'on' : ''}" data-theme="light">Light</button><button class="${s.uiTheme === 'dark' ? 'on' : ''}" data-theme="dark">Dark</button></div>
      <div class="menu-group">${item('help', 'help', 'Keyboard shortcuts & tips', '?')}</div>
      <div class="muted small center">Teachly — works offline, saves automatically.</div>`;
    body.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.act) this.action(b.dataset.act);
      if (b.dataset.tbpos) store.setSettings({ toolbarPos: b.dataset.tbpos as 'left' });
      if (b.dataset.theme) store.setSettings({ uiTheme: b.dataset.theme as 'light' });
      body.querySelectorAll('[data-tbpos]').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.tbpos === store.settings.toolbarPos));
      body.querySelectorAll('[data-theme]').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.theme === store.settings.uiTheme));
    });
    body.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.set) store.setSettings({ [el.dataset.set]: el.checked });
    });
  }

  private openHelp(): void {
    const body = floatingPanel(this.root, { id: 'help', title: 'Shortcuts & tips', iconName: 'help', width: 460 });
    if (!body) return;
    const rows: [string, string][] = [
      ['V / P / E / S / T / L / H', 'Select / Pen / Eraser / Shapes / Text / Laser / Pan'],
      ['Space + drag, middle mouse', 'Move the board'],
      ['Two fingers', 'Pinch to zoom, drag to pan'],
      ['Ctrl + wheel, + / −, 0', 'Zoom, reset zoom'],
      ['Ctrl+Z / Ctrl+Y', 'Undo / redo'],
      ['Ctrl+C / Ctrl+V / Ctrl+D', 'Copy / paste / duplicate'],
      ['Delete', 'Delete selection'],
      ['PageUp / PageDown', 'Previous / next page'],
      ['Ctrl+S / Ctrl+O', 'Save / open lesson'],
      ['F', 'Full screen'],
      ['Hold pen still', 'Snap a drawing into a perfect shape'],
      ['Palm / fist on screen', 'Erase'],
    ];
    body.innerHTML = `<table class="kbd-table">${rows.map(([k, v]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`).join('')}</table>`;
  }

  private applySettings(): void {
    const s = store.settings;
    this.root.dataset.tbpos = s.toolbarPos;
    document.documentElement.dataset.theme = s.uiTheme;
    this.minimap.hidden = !s.minimap;
    this.scheduleMinimap();
  }

  // ---------------------------------------------------------------------------
  // Selection context bar

  private updateSelbar(): void {
    const bar = this.selbar;
    const els = store.selectedEls();
    if (!els.length || store.tool.tool !== 'select') {
      bar.hidden = true;
      return;
    }
    const r = this.board.selectionBounds()!;
    const [x1, y1] = this.board.toScreen(r.x, r.y);
    const [x2, y2] = this.board.toScreen(r.x + r.w, r.y + r.h);
    const single = els.length === 1 ? els[0] : null;
    const key = `${els.length}:${single?.type ?? ''}`;
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = `
        <button class="icon-btn" data-sel="dup" title="Duplicate (Ctrl+D)">${icon('copy', 20)}</button>
        <button class="icon-btn" data-sel="front" title="Bring to front">${icon('front', 20)}</button>
        <button class="icon-btn" data-sel="back" title="Send to back">${icon('back', 20)}</button>
        <button class="icon-btn" data-sel="lock" title="Lock (pin in place)">${icon('lock', 20)}</button>
        ${single?.type === 'graph' ? `<button class="icon-btn" data-sel="edit-graph" title="Edit graph">${icon('graph', 20)}</button>` : ''}
        ${single?.type === 'video' ? `<button class="icon-btn" data-sel="play" title="Play / pause">${icon('play', 20)}</button>` : ''}
        ${single?.type === 'text' ? `<button class="icon-btn" data-sel="edit-text" title="Edit text">${icon('text', 20)}</button>` : ''}
        <span class="tb-sep"></span>
        ${PEN_COLORS.slice(0, 8).map((c) => `<button class="swatch small" style="background:${c}" data-sel-color="${c}"></button>`).join('')}
        <span class="tb-sep"></span>
        <button class="icon-btn danger" data-sel="delete" title="Delete (Del)">${icon('trash', 20)}</button>`;
      bar.onclick = (e) => {
        const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
        if (!b) return;
        if (b.dataset.selColor) this.recolorSelection(b.dataset.selColor);
        else this.selAction(b.dataset.sel!);
      };
    }
    bar.hidden = false;
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    let left = (x1 + x2) / 2 - bw / 2;
    let top = y1 - bh - 48;
    if (top < 64) top = Math.min(this.board.h - bh - 90, y2 + 20);
    left = Math.max(8, Math.min(this.board.w - bw - 8, left));
    bar.style.left = `${left}px`;
    bar.style.top = `${Math.max(64, top)}px`;
  }

  selAction(a: string): void {
    const sel = store.selection;
    if (!sel.size) return;
    const els = store.page.els;
    switch (a) {
      case 'delete':
        store.replaceEls(new Set(sel), []);
        store.clearSelection();
        break;
      case 'dup': {
        const off = 24 / this.board.cam.z;
        const copies = store.selectedEls().map((e) => ({ ...translateEl(e, off, off), id: uid() }) as El);
        store.addEls(copies);
        store.select(copies.map((c) => c.id));
        break;
      }
      case 'front':
        store.setEls([...els.filter((e) => !sel.has(e.id)), ...els.filter((e) => sel.has(e.id))]);
        break;
      case 'back':
        store.setEls([...els.filter((e) => sel.has(e.id)), ...els.filter((e) => !sel.has(e.id))]);
        break;
      case 'lock':
        store.mapEls(new Set(sel), (e) => ({ ...e, locked: true }));
        store.clearSelection();
        toast('Locked. Unlock from the Background menu.');
        break;
      case 'edit-graph':
        openGrapher(this.root, this.board, store.selectedEls()[0] as GraphEl);
        break;
      case 'edit-text': {
        const t = store.selectedEls()[0];
        if (t.type === 'text') {
          store.clearSelection();
          this.editor.open(t, false);
        }
        break;
      }
      case 'play': {
        const v = store.selectedEls()[0];
        if (v.type === 'video') {
          const vid = getVideo(v.id, v.src);
          if (vid.paused) void vid.play();
          else vid.pause();
          this.board.invalidate('ink');
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Minimap (navigation map)

  private minimapPending = false;
  private mmView = { x: 0, y: 0, k: 1 };

  private scheduleMinimap(): void {
    if (this.minimapPending || !store.settings.minimap) return;
    this.minimapPending = true;
    setTimeout(() => {
      this.minimapPending = false;
      this.drawMinimap();
    }, 60);
  }

  private drawMinimap(): void {
    const c = this.minimap;
    const dpr = window.devicePixelRatio || 1;
    const W = 220, H = 140;
    if (c.width !== W * dpr) {
      c.width = W * dpr;
      c.height = H * dpr;
    }
    const ctx = c.getContext('2d')!;
    const view = this.board.viewRect();
    const content = contentBounds(store.page.els);
    let x1 = view.x, y1 = view.y, x2 = view.x + view.w, y2 = view.y + view.h;
    if (content) {
      x1 = Math.min(x1, content.x);
      y1 = Math.min(y1, content.y);
      x2 = Math.max(x2, content.x + content.w);
      y2 = Math.max(y2, content.y + content.h);
    }
    const pad = Math.max(x2 - x1, y2 - y1) * 0.08;
    x1 -= pad;
    y1 -= pad;
    x2 += pad;
    y2 += pad;
    const k = Math.min(W / (x2 - x1), H / (y2 - y1));
    const ox = (W - (x2 - x1) * k) / 2 - x1 * k, oy = (H - (y2 - y1) * k) / 2 - y1 * k;
    this.mmView = { x: ox, y: oy, k };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = store.page.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, ox * dpr, oy * dpr);
    drawEls(ctx, store.page.els, null);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(59,130,246,0.12)';
    ctx.fillRect(view.x * k + ox, view.y * k + oy, view.w * k, view.h * k);
    ctx.strokeRect(view.x * k + ox, view.y * k + oy, view.w * k, view.h * k);
  }

  private bindMinimap(): void {
    const c = this.minimap;
    c.style.touchAction = 'none';
    const go = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const m = this.mmView;
      const wx = (mx - m.x) / m.k, wy = (my - m.y) / m.k;
      const v = this.board.viewRect();
      this.board.setCam({ x: wx - v.w / 2, y: wy - v.h / 2, z: this.board.cam.z });
    };
    let dragging = false;
    c.addEventListener('pointerdown', (e) => {
      dragging = true;
      c.setPointerCapture(e.pointerId);
      go(e);
    });
    c.addEventListener('pointermove', (e) => dragging && go(e));
    c.addEventListener('pointerup', () => {
      dragging = false;
      this.drawMinimap();
    });
  }

  // ---------------------------------------------------------------------------
  // Pages panel

  private togglePagesPanel(): void {
    if (this.pagesPanel) {
      this.pagesPanel.remove();
      this.pagesPanel = null;
      return;
    }
    const el = document.createElement('aside');
    el.className = 'pages-panel';
    this.root.appendChild(el);
    this.pagesPanel = el;
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-pg]') as HTMLElement | null;
      if (!b) return;
      const i = Number(b.dataset.i);
      switch (b.dataset.pg) {
        case 'go':
          store.goTo(i);
          break;
        case 'dup':
          store.duplicatePage(i);
          break;
        case 'del':
          if (store.doc.pages[i].els.length === 0 || confirm(`Delete page ${i + 1}?`)) store.deletePage(i);
          break;
        case 'up':
          store.movePage(i, i - 1);
          break;
        case 'down':
          store.movePage(i, i + 1);
          break;
        case 'add':
          store.addPage(store.doc.pages.length - 1);
          break;
        case 'close':
          this.togglePagesPanel();
          return;
      }
      this.refreshPagesPanel();
    });
    this.refreshPagesPanel();
  }

  private thumbCache = new WeakMap<object, string>();

  private refreshPagesPanel(): void {
    const el = this.pagesPanel;
    if (!el) return;
    const thumbs = store.doc.pages.map((p, i) => {
      let src = this.thumbCache.get(p);
      if (!src) {
        const b = contentBounds(p.els) ?? { x: 0, y: 0, w: 1280, h: 720 };
        const pad = 30;
        const region = { x: b.x - pad, y: b.y - pad, w: Math.max(b.w + pad * 2, ((b.h + pad * 2) * 16) / 9), h: Math.max(b.h + pad * 2, ((b.w + pad * 2) * 9) / 16) };
        src = renderRegion(p, region, 240, 135).toDataURL('image/jpeg', 0.7);
        this.thumbCache.set(p, src);
      }
      return `<div class="thumb ${i === store.index ? 'on' : ''}">
        <button class="thumb-img" data-pg="go" data-i="${i}"><img src="${src}" alt="Page ${i + 1}"><span>${i + 1}</span></button>
        <div class="thumb-actions">
          <button class="icon-btn small" data-pg="up" data-i="${i}" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn small" data-pg="down" data-i="${i}" title="Move down" ${i === store.doc.pages.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn small" data-pg="dup" data-i="${i}" title="Duplicate">${icon('copy', 16)}</button>
          <button class="icon-btn small danger" data-pg="del" data-i="${i}" title="Delete">${icon('trash', 16)}</button>
        </div></div>`;
    });
    el.innerHTML = `<header class="panel-head"><span>Pages (${store.doc.pages.length})</span><button class="icon-btn small" data-pg="close">${icon('close', 18)}</button></header>
      <div class="thumbs">${thumbs.join('')}</div>
      <button class="btn wide" data-pg="add">${icon('plus', 18)} Add page</button>`;
  }

  // ---------------------------------------------------------------------------
  // Keyboard, clipboard, drag & drop

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable]')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === ' ' && !this.board.spaceDown) {
        this.board.spaceDown = true;
        this.board.updateCursor();
        e.preventDefault();
        return;
      }
      if (ctrl) {
        if (k === 'z' && !e.shiftKey) store.undo();
        else if (k === 'y' || (k === 'z' && e.shiftKey)) store.redo();
        else if (k === 's') saveFile();
        else if (k === 'o') this.action('open');
        else if (k === 'c') copySelection();
        else if (k === 'x') {
          copySelection();
          this.selAction('delete');
        } else if (k === 'd') this.selAction('dup');
        else if (k === 'a') {
          store.setTool({ tool: 'select' });
          store.select(store.page.els.filter((x) => !x.locked).map((x) => x.id));
        } else if (k === '=' || k === '+') this.action('zoom-in');
        else if (k === '-') this.action('zoom-out');
        else if (k === '0') this.action('zoom-reset');
        else return;
        e.preventDefault();
        return;
      }
      const map: Record<string, ToolId> = { v: 'select', p: 'pen', e: 'eraser', s: 'shape', t: 'text', l: 'laser', h: 'pan', c: 'compass' };
      if (map[k]) store.setTool({ tool: map[k] });
      else if (e.key === 'Delete' || e.key === 'Backspace') this.selAction('delete');
      else if (e.key === 'Escape') {
        this.closePopover();
        store.clearSelection();
      } else if (e.key === 'PageDown' || e.key === 'ArrowRight' && e.altKey) this.action('next');
      else if (e.key === 'PageUp' || e.key === 'ArrowLeft' && e.altKey) this.action('prev');
      else if (k === 'f') this.action('fullscreen');
      else if (k === '+' || k === '=') this.action('zoom-in');
      else if (k === '-') this.action('zoom-out');
      else if (k === '0') this.action('zoom-reset');
      else if (k === '?') this.action('help');
      else if (e.key.startsWith('Arrow') && store.selection.size) {
        const step = (e.shiftKey ? 20 : 2) / this.board.cam.z;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        store.mapEls(store.selection, (el) => translateEl(el, dx, dy));
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
      const items = [...(e.clipboardData?.items ?? [])];
      const img = items.find((i) => i.type.startsWith('image/'));
      if (img) {
        e.preventDefault();
        const f = img.getAsFile();
        if (f) {
          const el = await insertImageSrc(this.board, await readAsDataURL(f));
          store.setTool({ tool: 'select' });
          store.select([el.id]);
        }
        return;
      }
      const text = e.clipboardData?.getData('text/plain');
      if (pasteElements(this.board)) {
        e.preventDefault();
        return;
      }
      if (text) {
        e.preventDefault();
        const v = this.board.viewRect();
        const fs = store.tool.fontSize;
        const sz = measureText(text, fs, false, 900, false);
        const el: El = { id: uid(), type: 'text', text, x: v.x + v.w / 2 - sz.w / 2, y: v.y + v.h / 2 - sz.h / 2, w: sz.w, h: sz.h, rot: 0, color: store.tool.color, fontSize: fs };
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
      const files = [...(e.dataTransfer?.files ?? [])];
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length) await insertImages(this.board, images);
      for (const f of files) {
        if (f.type === 'application/pdf') await this.withProgress('Importing PDF', (p) => importPdf(this.board, f, p));
        else if (f.type.startsWith('video/')) await insertVideo(this.board, [f]);
        else if (/\.(teachly|json)$/i.test(f.name)) {
          await openFile(f);
          this.updateTitle();
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Autosave

  private saveTimer = 0;

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      saveLocal(store.doc).catch(() => {
        /* storage full or unavailable */
      });
    }, 700);
  }
}
