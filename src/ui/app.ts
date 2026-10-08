import { Board, type Tool } from '../board';
import { similarity, transformEl, translateEl, uid } from '../geometry';
import {
  copySelection,
  exportPdf,
  importPdf,
  insertImages,
  insertImageSrc,
  loadLocal,
  openFile,
  pasteElements,
  pickFiles,
  readAsDataURL,
  saveFile,
  saveLocal,
} from '../io/files';
import { isDarkColor, measureText } from '../renderer';
import { newPage, store } from '../store';
import { importPptx } from '../io/office';
import { EraserTool } from '../tools/eraser';
import { makeTable, resizeTable, TableEditor } from '../tools/table';
import { CompassTool, ShapeTool } from '../tools/misc';
import { PenTool } from '../tools/pen';
import { SelectTool } from '../tools/select';
import { TextEditor, TextTool } from '../tools/text';
import type { BgPattern, El, PathEl, ShapeKind, TableEl, ToolId } from '../types';
import { toggleCurtain, toggleSpotlight } from '../widgets/focus';
import { openTimer } from '../widgets/timer';
import { icon } from './icons';
import { PagesPanel } from './pages';
import { toast } from './panel';
import { computeUiScale, inkScale, scaleFloating, ui, type UiSize } from './scale';

const COLORS = ['#1e293b', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#2563eb', '#a855f7'];
const HL_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6'];
const FILLS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff', '#e2e8f0', '#1e293b', '#ef4444', '#2563eb', '#22c55e'];
/** Board colours: dark boards first (default black), then light ones. */
const BOARDS = ['#111418', '#1f2937', '#0f1e3d', '#123524', '#14532d', '#3b0d14', '#2e1065', '#ffffff', '#fdf6e3', '#e5e7eb', '#dbeafe', '#dcfce7'];
const PATTERNS: [BgPattern, string][] = [
  ['none', 'Plain'],
  ['grid', 'Grid'],
  ['lines', 'Lines'],
  ['fourline', '4-line'],
];

const SHAPES: [ShapeKind, string, string][] = [
  ['line', 'Line', '<path d="M4 20L20 4"/>'],
  ['arrow', 'Arrow', '<path d="M4 20L20 4M12 4h8v8"/>'],
  ['dashed', 'Dashed line', '<path d="M4 20L20 4" stroke-dasharray="3 3"/>'],
  ['rect', 'Rectangle', '<rect x="3" y="6" width="18" height="12"/>'],
  ['square', 'Square', '<rect x="4" y="4" width="16" height="16"/>'],
  ['circle', 'Circle', '<circle cx="12" cy="12" r="9"/>'],
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
];

type PropSection = 'color' | 'width' | 'fill' | null;

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
  private tableEditor: TableEditor;
  private newArmed = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="board" id="board"></div>
      <div class="clock" aria-live="off"><b data-time></b></div>
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
      ['text', new TextTool(this.board, this.editor)],
      ['compass', new CompassTool(this.board)],
    ];
    for (const [id, t] of tools) this.board.tools.set(id, t);
    this.board.updateCursor();

    this.toolbar = root.querySelector('.toolbars') as HTMLElement;
    this.pages = new PagesPanel(root, () => this.renderToolbar());
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
    window.addEventListener('resize', () => this.applyScale());
    store.on('settings', () => this.applyScale());
    void loadLocal().then((doc) => doc && store.loadDoc(doc));
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
    left.innerHTML = `
      ${tool('select', 'select', 'Select')}
      ${tool('pen', t.penStyle === 'highlighter' ? 'highlighter' : 'pen', 'Pen', `<span class="swatch-dot" style="background:${dot}"></span>`)}
      ${tool('eraser', 'eraser', 'Eraser')}
      ${tool('shape', 'shapes', 'Shapes')}
      ${tool('text', 'text', 'Text')}`;
    right.innerHTML = `
      <button class="tb-btn" data-act="undo" title="Undo">${icon('undo', 22)}</button>
      <button class="tb-btn" data-act="redo" title="Redo">${icon('redo', 22)}</button>
      <button class="tb-btn ${this.popFor === 'insert' ? 'open' : ''}" data-pop="insert" title="Insert">${icon('plus', 22)}</button>
      <button class="tb-btn ${this.popFor === 'tools' ? 'open' : ''}" data-pop="tools" title="Tools">${icon('ruler', 22)}</button>
      <div class="tb-pagenav">
        <button class="icon-btn" data-act="prev" title="Previous page" aria-label="Previous page">${icon('prev')}</button>
        <span class="page-label">${store.index + 1} / ${store.doc.pages.length}</span>
        <button class="icon-btn" data-act="next" title="Next page" aria-label="Next page">${icon('next')}</button>
      </div>
      <button class="tb-btn ${this.pages.open ? 'open' : ''}" data-act="pages" title="All pages">${icon('pages', 22)}</button>
      <button class="tb-btn ${this.popFor === 'menu' ? 'open' : ''}" data-pop="menu" title="Menu">${icon('menu', 22)}</button>`;
    this.updateUndo();
    if (this.popover) {
      const anchor = this.toolbar.querySelector(`[data-tool="${this.popFor}"],[data-pop="${this.popFor}"]`) as HTMLElement | null;
      if (anchor) this.positionPopover(anchor);
    }
  }

  private updateUndo(): void {
    this.toolbar.querySelector('[data-act=undo]')?.toggleAttribute('disabled', !store.canUndo);
    this.toolbar.querySelector('[data-act=redo]')?.toggleAttribute('disabled', !store.canRedo);
  }

  private onToolbarClick(b: HTMLElement): void {
    if (b.dataset.tool) {
      const id = b.dataset.tool as ToolId;
      const hasOptions = id === 'pen' || id === 'eraser' || id === 'shape';
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
    this.popover.remove();
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
    this.fillPopover();
    this.positionPopover(anchor);
  }

  private positionPopover(anchor: HTMLElement): void {
    const pop = this.popover!;
    scaleFloating(pop);
    const k = ui();
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth * k, ph = pop.offsetHeight * k;
    const left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left + r.width / 2 - pw / 2));
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(8, r.top - ph - 12 * k)}px`;
  }

  private swatches(colors: string[], current: string | null, attr: string): string {
    return `<div class="swatches">${colors.map((c) => `<button class="swatch ${c === current ? 'on' : ''}" style="background:${c}" data-${attr}="${c}" aria-label="${c}"></button>`).join('')}</div>`;
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
        pop.innerHTML = `
          <div class="seg"><button class="${!hl ? 'on' : ''}" data-style="pen">${icon('pen', 20)} Pen</button><button class="${hl ? 'on' : ''}" data-style="highlighter">${icon('highlighter', 20)} Highlighter</button></div>
          ${this.swatches(hl ? HL_COLORS : COLORS, color, 'color')}
          <div class="slider-row">
            <span class="slider-label">Size</span>
            <input type="range" id="pen-size" min="1" max="${hl ? 60 : 40}" value="${size}" data-pensize>
            <span class="slider-preview"><i data-penprev style="width:${Math.min(44, size + 2)}px;height:${Math.min(44, size + 2)}px;background:${color};opacity:${hl ? 0.45 : 1}"></i></span>
          </div>`;
        break;
      }
      case 'eraser':
        pop.innerHTML = `
          <div class="seg"><button class="${t.eraserMode === 'point' ? 'on' : ''}" data-emode="point">Erase part</button><button class="${t.eraserMode === 'stroke' ? 'on' : ''}" data-emode="stroke">Erase whole line</button></div>
          <div class="slider-row">
            <span class="slider-label">Size</span>
            <input type="range" id="eraser-size" min="10" max="160" value="${t.eraserSize}" data-erasersize>
            <span class="slider-preview"><i data-eraserprev class="eraser-prev" style="width:${Math.min(44, t.eraserSize / 3.5 + 6)}px;height:${Math.min(44, t.eraserSize / 3.5 + 6)}px"></i></span>
          </div>
          <button class="btn danger wide" data-act="clear">${icon('trash', 20)} Clear page</button>`;
        break;
      case 'shape':
        pop.innerHTML = `<div class="shape-grid">${SHAPES.map(([k, n, svg]) => `<button class="shape-btn ${t.shape === k ? 'on' : ''}" data-shape="${k}" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${svg}</svg></button>`).join('')}</div>
          <div class="muted small center">Draw it on the board, then tap it to change colour, size or fill.</div>`;
        break;
      case 'insert':
        pop.innerHTML = `<div class="grid-btns">
          ${this.gridBtn('image', 'image', 'Picture')}
          ${this.gridBtn('pdf', 'pdf', 'PDF / Book')}
          ${this.gridBtn('pptx', 'slides', 'PowerPoint')}
          ${this.gridBtn('table', 'table', 'Table')}
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
        pop.innerHTML = `<div class="grid-btns">
          ${this.gridBtn('ruler', 'ruler', 'Ruler', ins.has('ruler'))}
          ${this.gridBtn('protractor', 'protractor', 'Protractor', ins.has('protractor'))}
          ${this.gridBtn('compass', 'compass', 'Compass', t.tool === 'compass')}
          ${this.gridBtn('timer', 'timer', 'Timer')}
          ${this.gridBtn('spotlight', 'spotlight', 'Spotlight')}
          ${this.gridBtn('curtain', 'curtain', 'Screen cover')}</div>`;
        break;
      }
      case 'menu': {
        const p = store.page;
        const s = store.settings;
        pop.innerHTML = `
          <div class="pop-title">Board</div>
          <div class="board-palette">${BOARDS.map((c) => `<button class="swatch ${p.bg === c ? 'on' : ''}" style="background:${c}" data-bg="${c}" aria-label="Board colour ${c}"></button>`).join('')}
            <label class="swatch custom" title="Any colour"><input type="color" id="board-color" value="${p.bg}" data-bgpick aria-label="Pick any board colour"></label></div>
          <div class="seg">${PATTERNS.map(([k, n]) => `<button class="${p.pattern === k ? 'on' : ''}" data-pattern="${k}">${n}</button>`).join('')}</div>
          <div class="pop-title">Lesson</div>
          <div class="menu-list">
            <button class="menu-item" data-act="new">${icon('new', 20)}New lesson</button>
            <button class="menu-item" data-act="open">${icon('open', 20)}Open lesson</button>
            <button class="menu-item" data-act="save">${icon('save', 20)}Save lesson</button>
            <button class="menu-item" data-act="export">${icon('download', 20)}Save as PDF</button>
            <button class="menu-item" data-act="delete-page">${icon('trash', 20)}Delete this page</button>
            <button class="menu-item" data-act="fullscreen">${icon('fullscreen', 20)}Full screen</button>
          </div>
          <div class="pop-title">Button size</div>
          <div class="seg">${(['small', 'normal', 'large'] as UiSize[]).map((z) => `<button class="${s.uiSize === z ? 'on' : ''}" data-uisize="${z}">${z[0].toUpperCase() + z.slice(1)}</button>`).join('')}</div>
          <label class="check"><input type="checkbox" id="opt-penonly" data-set="penOnly" ${s.penOnly ? 'checked' : ''}> Write with stylus only (fingers move the board)</label>
          <label class="check"><input type="checkbox" id="opt-palm" data-set="palmErase" ${s.palmErase ? 'checked' : ''}> Erase with palm</label>`;
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
    } else if (d.uisize) {
      store.setSettings({ uiSize: d.uisize as UiSize });
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
      if (prev) prev.style.width = prev.style.height = `${Math.min(44, v + 2)}px`;
    } else if (el.dataset.erasersize !== undefined) {
      store.tool.eraserSize = v;
      const prev = this.popover?.querySelector('[data-eraserprev]') as HTMLElement | null;
      if (prev) prev.style.width = prev.style.height = `${Math.min(44, v / 3.5 + 6)}px`;
    }
  }

  private setBoard(patch: { bg?: string; pattern?: BgPattern }): void {
    store.updatePage(patch);
    if (patch.bg) {
      // Keep the pen readable on dark boards.
      const dark = isDarkColor(patch.bg);
      if (dark && store.tool.color === '#1e293b') store.setTool({ color: '#ffffff', shapeColor: '#60a5fa' });
      if (!dark && store.tool.color === '#ffffff') store.setTool({ color: '#1e293b', shapeColor: '#2563eb' });
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
      case 'zoom-reset':
        return b.zoomTo(1);
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
      case 'new':
        // Ask for a second tap instead of a blocking dialog.
        if (Date.now() - this.newArmed > 4000) {
          this.newArmed = Date.now();
          return toast('Tap “New lesson” again to clear the board and start fresh (save first if needed)', 4000);
        }
        this.newArmed = 0;
        store.loadDoc({ version: 1, title: 'Lesson', pages: [newPage()] });
        return toast('New lesson started');
      case 'open':
        void openFile();
        return;
      case 'save':
        saveFile();
        return toast('Lesson saved to Downloads');
      case 'export':
        void this.withProgress('Making PDF', () => exportPdf(b));
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
    const colorable = paths.length + texts.length + tables.length > 0;
    const fillable = paths.some((p) => p.closed) || tables.length > 0;
    const first = (paths[0] ?? texts[0] ?? tables[0]) as { color: string } | undefined;
    const color = first?.color ?? null;
    // Thickness is shown in the same units as the pen slider.
    const width = (paths[0]?.size ?? 0) / inkScale();
    const fill = paths.find((p) => p.closed)?.fill ?? tables[0]?.fill ?? null;
    const sec = this.propSection;

    let panel = '';
    if (sec === 'color') panel = this.swatches(COLORS, color, 'pcolor');
    if (sec === 'width')
      panel = `<div class="width-row"><input type="range" id="prop-width" min="1" max="30" value="${Math.round(width)}" data-pwidth><span class="width-val">${Math.round(width)}</span></div>
        <div class="sizes">${[2, 4, 8, 14].map((s) => `<button class="size ${Math.round(width) === s ? 'on' : ''}" data-pw="${s}"><span style="width:${s + 3}px;height:${s + 3}px;background:var(--text)"></span></button>`).join('')}</div>`;
    if (sec === 'fill')
      panel = `<div class="swatches"><button class="swatch none ${!fill ? 'on' : ''}" data-pfill="none" aria-label="No fill"></button>${FILLS.map((c) => `<button class="swatch ${fill === c ? 'on' : ''}" style="background:${c}" data-pfill="${c}" aria-label="${c}"></button>`).join('')}</div>`;

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
      store.mapEls(store.selection, (el) => (el.type === 'path' || el.type === 'text' || el.type === 'table' ? ({ ...el, color: c } as El) : el));
      if (store.selectedEls().some((x) => x.type === 'path' && x.style === 'shape')) store.setTool({ shapeColor: c });
    } else if (d.pw) this.setWidth(Number(d.pw) * inkScale(), true);
    else if (d.pfill) {
      const f = d.pfill === 'none' ? null : d.pfill;
      store.mapEls(store.selection, (el) => ((el.type === 'path' && el.closed) || el.type === 'table' ? { ...el, fill: f } : el));
      store.setTool({ shapeFill: f });
    } else if (d.trows || d.tcols) {
      store.mapEls(store.selection, (el) => (el.type === 'table' ? resizeTable(el, Number(d.trows ?? 0), Number(d.tcols ?? 0)) : el));
    } else if (d.pact === 'header') {
      store.mapEls(store.selection, (el) => (el.type === 'table' ? { ...el, header: !el.header } : el));
    } else if (d.scale) this.scaleSelection(Number(d.scale));
    else if (d.pact === 'dup') this.duplicate();
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
    const copies = store.selectedEls().map((e) => ({ ...translateEl(e, off, off), id: uid() }) as El);
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
    let top = y1 - bh - 56 * k;
    if (top < 12) top = y2 + 24;
    top = Math.max(12, Math.min(this.board.h - bh - 100 * k, top));
    const left = Math.max(8, Math.min(this.board.w - bw - 8, (x1 + x2) / 2 - bw / 2));
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
    // While writing, the toolbars fade back so the board is fully visible.
    this.board.el.addEventListener('pointerdown', () => this.root.classList.add('drawing'));
    const done = () => this.root.classList.remove('drawing');
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  }

  private updatePageLabel(): void {
    const label = this.root.querySelector('.page-label') as HTMLElement | null;
    if (label) label.textContent = `${store.index + 1} / ${store.doc.pages.length}`;
  }

  /** Size the toolbar and panels for this screen (phone → 86" panel). */
  private applyScale(): void {
    // Widths are unaffected by the CSS scale transform.
    const L = (this.toolbar.querySelector('.tb-left') as HTMLElement).offsetWidth;
    const R = (this.toolbar.querySelector('.tb-right') as HTMLElement).offsetWidth;
    // One row when both halves fit at a comfortable size; on phones the
    // action bar moves up into a second row above the drawing tools.
    const oneRow = L + R + 40;
    const stacked = window.innerWidth / oneRow < 0.85;
    this.root.classList.toggle('tb-stacked', stacked);
    computeUiScale(store.settings.uiSize, stacked ? Math.max(L, R) + 20 : oneRow);
    this.closePopover();
    this.positionProps();
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
    const z = Math.round(store.camera.z * 100);
    pill.hidden = z === 100;
    pill.textContent = `${z}%  ·  Reset`;
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
      else if (ctrl && k === 's') saveFile();
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

  private saveTimer = 0;

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(saveLocalSafe, 700);
  }
}

function saveLocalSafe(): void {
  saveLocal(store.doc).catch(() => {
    /* storage full or unavailable */
  });
}
