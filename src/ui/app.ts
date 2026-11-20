import { askPdfPlace } from './pdfrange';
import { colorWheelSvg, PEN_DEFS, penSvg } from './pentray';
import { Board, type Tool } from '../board';
import { bbox, regroup, resizeEl, similarity, transformEl, translateEl, uid, unionRects } from '../geometry';
import {
  copySelection,
  clipboardCount,
  hasClipboard,
  onClipboardChange,
  exportPdf,
  exportPng,
  exportScreenshot,
  importPdf,
  insertImages,
  insertImageSrc,
  openFile,
  pasteElements,
  pickFiles,
  readAsDataURL,
} from '../io/files';
import { isDarkColor, measureText } from '../renderer';
import { nameControls, syncToolbarState } from './a11y';
import { QuickBar } from './quickbar';
import { openCrop } from './cropper';
import { SubjectPanel } from './subjectpanel';
import { blockInfo, nearest, seat, surfaces } from '../subjects/snap';
import { chapterById } from '../subjects/catalog';
import { SIMPLE_HIDDEN, store, type ToolState } from '../store';
import { importPptx } from '../io/office';
import { saveNow, startAutosave } from '../io/autosave';
import { blankNotebook, loadLastNotebook, saveNotebook, takeMigrationNotes } from '../io/library';
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
import type { PenKind } from '../types';
import type { BgPattern, El, PathEl, ShapeKind, TableEl, TextEl, ToolId } from '../types';
import { closeSpotlight, toggleCurtain, toggleSpotlight } from '../widgets/focus';
import { openPoll } from '../widgets/poll';
import { openTimer } from '../widgets/timer';
import { isRecording, onRecordingChange, toggleRecording } from '../widgets/recorder';
import { openCalculator, openPicker, openScoreboard } from '../widgets/classroom';
import { openGraph } from '../widgets/graph';
import { closeMagnifier, toggleMagnifier } from '../widgets/magnifier';
import { icon } from './icons';
import { installApp, isInstalled, shareApp } from './install';
import { Library, saveNotebookDialog } from './library';
import { newNotebookFlow } from './newnotebook';
import { PagesGrid } from './pagegrid';
import { SaveBadge } from './savebadge';
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
  ['pencil', 'Pencil'],
  ['fineliner', 'Fine liner'],
  ['pen', 'Ball pen'],
  ['crayon', 'Crayon'],
  ['fountain', 'Fountain'],
  ['marker', 'Marker'],
  ['watercolor', 'Watercolour'],
  ['brush', 'Brush'],
  ['calligraphy', 'Calligraphy'],
  ['highlighter', 'Highlighter'],
];
/** The six circles of the pen bar (iPad set; white instead of black because the bar and board are dark). */
const BAR_COLORS = ['#f2f2f0', '#1a7cf5', '#4cd463', '#fdd130', '#fb2d48'];
const HL_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6', '#fb923c'];
const FILLS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff', '#e2e8f0', '#1e293b', '#ef4444', '#2563eb', '#22c55e'];
/** Board colours: dark boards first (default black), then light ones. */
/** Board colours: black (default), white, light green — plus “any colour”. */
const BOARDS = ['#000000', '#ffffff', '#cdebd3'];
/** Small sketches of each board pattern (menu). */
const pat = (inner: string) => `<svg viewBox="0 0 28 20" width="28" height="20" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="26" height="18" rx="3" stroke-width="1.4"/>${inner}</svg>`;
const PATTERN_ICONS: Record<BgPattern, string> = {
  none: pat(''),
  grid: pat('<path d="M8 1v18M14 1v18M20 1v18M1 7h26M1 13h26" opacity=".7"/>'),
  lines: pat('<path d="M4 6h20M4 10h20M4 14h20" opacity=".8"/>'),
  fourline: pat('<path d="M4 5h20M4 8h20M4 11h20M4 14h20" opacity=".8"/><path d="M4 8h20M4 11h20" stroke-width="1.8" opacity=".5"/>'),
  dots: pat('<path d="M7 6h0M14 6h0M21 6h0M7 10h0M14 10h0M21 10h0M7 14h0M14 14h0M21 14h0" stroke-width="2"/>'),
  graph: pat('<path d="M4 1v18M7 1v18M10 1v18M13 1v18M16 1v18M19 1v18M22 1v18M1 4h26M1 7h26M1 10h26M1 13h26M1 16h26" stroke-width=".6" opacity=".7"/>'),
  music: pat('<path d="M4 5h20M4 7h20M4 9h20M4 11h20M4 13h20" stroke-width=".8"/>'),
  cornell: pat('<path d="M9 1v14M1 15h26" opacity=".8"/>'),
};
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
  ['slide', 'Slide mode', 'left'],
  ['pen', 'Pen', 'left'],
  ['eraser', 'Eraser', 'left'],
  ['shape', 'Shapes', 'left'],
  ['fill', 'Fill colour', 'left'],
  ['text', 'Text', 'left'],
  ['tape', 'Tape', 'left'],
  ['laser', 'Laser', 'left'],
  ['undo', 'Undo', 'right'],
  ['redo', 'Redo', 'right'],
  ['insert', 'Insert', 'right'],
  ['tools', 'Tools', 'right'],
  ['shot', 'Screenshot', 'right'],
  ['timer', 'Timer', 'right'],
  ['poll', 'Poll', 'right'],
  ['graph', 'Graph', 'right'],
  ['record', 'Record', 'right'],
  ['pagenav', 'Page arrows', 'right'],
  ['pages', 'All pages', 'right'],
];

/** Buttons that can sit on the floating hexagon: html + whether it is active. */
type HexBtn = (t: ToolState, app: App) => [string, boolean];
const hb = (attr: string, ic: string, title: string, extra = '') => `<button class="hx-btn" ${attr} title="${title}" aria-label="${title}">${icon(ic, 26)}${extra}</button>`;
const HEX_BUTTONS: Record<string, HexBtn> = {
  select: (t) => [hb('data-tool="select"', 'select', 'Select'), t.tool === 'select'],
  pen: (t) => [hb('data-tool="pen"', 'pk_' + t.penStyle, 'Pen', `<i class="hx-dot" style="background:${t.penStyle === 'highlighter' ? t.hlColor : t.color}"></i>`), t.tool === 'pen'],
  eraser: (t) => [hb('data-tool="eraser"', 'eraser', 'Eraser'), t.tool === 'eraser'],
  shape: (t) => [hb('data-tool="shape"', 'shapes', 'Shapes'), t.tool === 'shape'],
  fill: (t) => [hb('data-tool="fill"', 'bucket', 'Fill colour'), t.tool === 'fill'],
  text: (t) => [hb('data-tool="text"', 'text', 'Text'), t.tool === 'text'],
  tape: (t) => [hb('data-tool="tape"', 'tape', 'Tape'), t.tool === 'tape'],
  laser: (t) => [hb('data-tool="laser"', 'laser', 'Laser'), t.tool === 'laser'],
  slide: (t) => [hb('data-act="slide"', 'pan', 'Slide mode'), !!t.slide],
  undo: () => [hb('data-act="undo"', 'undo', 'Undo'), false],
  redo: () => [hb('data-act="redo"', 'redo', 'Redo'), false],
  insert: () => [hb('data-pop="insert"', 'plus', 'Insert'), false],
  tools: () => [hb('data-pop="tools"', 'ruler', 'Tools'), false],
  timer: () => [hb('data-act="timer"', 'timer', 'Timer'), false],
  poll: () => [hb('data-act="poll"', 'poll', 'Poll'), false],
  graph: () => [hb('data-act="graph"', 'graph', 'Graph'), false],
  record: () => [hb('data-act="record"', 'rec', isRecording() ? 'Stop recording' : 'Record lesson'), isRecording()],
  next: () => [hb('data-act="next"', 'next', 'Next page'), false],
  prev: () => [hb('data-act="prev"', 'prev', 'Previous page'), false],
  pages: () => [hb('data-act="pages"', 'pages', 'All pages'), false],
};
const HEX_NAMES: Record<string, string> = {
  select: 'Select', pen: 'Pen', eraser: 'Eraser', shape: 'Shapes', fill: 'Fill colour', text: 'Text', tape: 'Tape', laser: 'Laser',
  slide: 'Slide mode', undo: 'Undo', redo: 'Redo', insert: 'Insert', tools: 'Tools', timer: 'Timer', poll: 'Poll', graph: 'Graph',
  record: 'Record', next: 'Next page', prev: 'Previous page', pages: 'All pages',
};

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

/** The edge the toolbar touches: bottom (default) or top. */
function tbEdge(): 'bottom' | 'top' {
  // Placed freely: the nearer half decides which way menus open.
  if (tbFree()) return (store.settings.tbY as number) < 0.5 ? 'top' : 'bottom';
  return store.settings.tbPos === 'top' ? 'top' : 'bottom';
}

/** Is the toolbar placed anywhere with the Height slider (not stuck to an edge)? */
function tbFree(): boolean {
  const y = store.settings.tbY;
  return typeof y === 'number' && y >= 0 && y <= 1;
}

/** Toolbar halves together in the middle? (Edit toolbar > Buttons; default: middle on top, sides at the bottom.) */
function tbMiddle(): boolean {
  const a = store.settings.tbAlign;
  return a ? a === 'middle' : tbEdge() === 'top';
}

/** How solid the floating hexagon is (1 = solid; Edit toolbar > Transparency). */
function hexAlpha(): number {
  const a = store.settings.hexAlpha;
  return typeof a === 'number' && a >= 0.2 && a <= 1 ? a : 1;
}

export class App {
  board: Board;
  editor: TextEditor;
  private root: HTMLElement;
  private toolbar: HTMLElement;
  private props: HTMLElement;
  private popover: HTMLElement | null = null;
  private popFor = '';
  /** The open menu belongs to a button on the floating hexagon. */
  private popFromHex = false;
  private propSection: PropSection = null;
  /** Move or Copy chosen in the "to page" picker (remembered while the app is open). */
  private pickMode: 'move' | 'copy' = 'move';
  /** Delete page asks twice (this is when the first tap happened). */
  private deleteArmedAt = 0;
  private selectTool: SelectTool;
  private pages: PagesPanel;
  private subject: SubjectPanel;
  private grid: PagesGrid;
  private library: Library;
  private tableEditor: TableEditor;

  constructor(root: HTMLElement) {
    this.root = root;
    // The whole teaching surface is one landmark (the canvas has no text for a screen reader; see docs/redesign/DESIGN-SPEC.md).
    root.setAttribute('role', 'main');
    root.setAttribute('aria-label', 'Teachly whiteboard');
    root.innerHTML = `
      <div class="board" id="board"></div>
      <div class="corner" aria-hidden="true">
        <div class="clock"><b data-time></b></div>
        <div class="brand"><b>Teachly</b> <small>by Physica</small></div>
      </div>
      <button class="zoom-pill" data-act="zoom-reset" title="Reset zoom" hidden></button>
      <div class="toolbars"><nav class="toolbar tb-left" aria-label="Drawing tools"></nav><nav class="toolbar tb-right" aria-label="Actions"></nav><div class="hexdock" hidden></div></div>
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
    this.grid = new PagesGrid(root, () => this.renderToolbar());
    this.pages = new PagesPanel(root, () => { this.renderToolbar(); requestAnimationFrame(() => this.positionProps()); }, () => this.grid.toggle());
    this.subject = new SubjectPanel(root, this.board, () => this.renderToolbar());
    this.library = new Library(root);
    new QuickBar(root);
    this.pasteChip();
    this.props = root.querySelector('.props') as HTMLElement;
    this.renderToolbar();
    this.subject.sync();
    this.bindChrome();
    this.bindKeys();
    this.bindDrop();

    store.on('tool', () => this.renderToolbar());
    store.on('doc', () => {
      this.updatePageLabel();
      this.updateBoardTone();
      this.renderProps();
      this.updateUndo();
    });
    store.on('page', () => {
      this.subject.refresh();
      this.updatePageLabel();
      this.updateZoom(false);
      this.updateBoardTone();
    });
    store.on('camera', () => {
      this.updateZoom(true);
      this.positionProps();
    });
    store.on('selection', () => {
      this.propSection = null;
      this.renderProps();
    });
    this.updatePageLabel();
    this.updateZoom(false);
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
    const tbKey = () => `${store.settings.tbHidden.join()}|${(store.settings.tbShown ?? []).join()}|${store.settings.subject ?? ''}|${store.settings.bigControls ? 'big' : ''}`;
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
    // Autosave (io/autosave.ts): shortly after each change, at once when the app is hidden or closed.
    startAutosave(() => this.board.busyInput);
    new SaveBadge(this.root.querySelector('.corner') as HTMLElement);
    // Back exactly where the lesson stopped: notebook, page, spot, pen.
    restoreTools();
    void loadLastNotebook().then((doc) => {
      if (doc) {
        store.loadDoc(doc);
        // An older notebook that had to be converted or repaired: say so once.
        const notes = takeMigrationNotes(doc.id!);
        if (notes.length) toast(`This notebook was saved by an older version and updated safely (the original is kept). ${notes.join(' ')}`, 9000);
      }
      requestAnimationFrame(() => restorePlace(this.board));
      trackSession(this.board);
    });
    startHousekeeping(this.board);
  }

  // ---------------------------------------------------------------------------
  // Bottom toolbar

  /** Names and selected state of the toolbar controls for assistive technology. */
  private syncA11y(): void {
    nameControls(this.toolbar);
    syncToolbarState(this.toolbar, store.tool.tool, this.popFor, this.pages.open);
  }

  /** What the toolbar's markup depends on; when only the active tool changed, the buttons are just re-marked. */
  private tbKey = '';

  private toolbarKey(): string {
    const t = store.tool;
    return JSON.stringify([store.settings.tbHidden, store.settings.tbShown, store.settings.hexItems, t.penStyle, t.color, t.hlColor, t.fillColor, t.tapeColor, isRecording(), this.popFor, this.pages.open, store.index, store.doc.pages.length, store.settings.subject, this.subject.open]);
  }

  /** Quick path: only mark the active tool and the slide switch (no markup rebuild, a few class changes). */
  private markActive(): void {
    const t = store.tool;
    const left = this.toolbar.querySelector('.tb-left') as HTMLElement;
    left.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t.tool));
    const sl = left.querySelector<HTMLElement>('[data-act=slide]');
    if (sl) {
      sl.classList.toggle('on', !!t.slide);
      sl.setAttribute('aria-pressed', String(!!t.slide));
    }
    this.moveIndicator(left);
    this.toolbar.querySelectorAll('.hexdock .hx').forEach((h) => h.classList.remove('active'));
    this.renderHex();
    this.syncA11y();
  }

  private renderToolbar(): void {
    const key = this.toolbarKey();
    if (key === this.tbKey && this.toolbar.querySelector('.tb-left .tb-ind')) return this.markActive();
    this.tbKey = key;
    const t = store.tool;
    const dot = t.penStyle === 'highlighter' ? t.hlColor : t.color;
    this.toolbar.style.setProperty('--tip', dot); // the pen icon's tip shows the pen colour
    const tool = (id: ToolId, ic: string, label: string, extra = '') =>
      `<button class="tb-btn ${t.tool === id ? 'active' : ''}" data-tool="${id}" title="${label}">${icon(ic, 22)}${extra}</button>`;
    const left = this.toolbar.querySelector('.tb-left') as HTMLElement;
    const right = this.toolbar.querySelector('.tb-right') as HTMLElement;
    const hide = new Set(store.settings.tbHidden);
    const on = new Set(store.settings.tbShown ?? []);
    const sub = chapterById(store.settings.subject);
    const subjectBtn = sub && !this.subject.open ? `<button class="tb-btn tb-subject ${this.subject.open ? 'open' : ''}" data-act="subject-tray" title="${sub.subject.name}: ${sub.chapter.name}">${sub.subject.name} · ${sub.chapter.short}</button>` : '';
    const show = (k: string, html: string) => ((TB_OPT_IN.has(k) ? !on.has(k) : hide.has(k)) ? '' : html);
    left.innerHTML = `<span class="tb-ind" aria-hidden="true"></span>
      ${show('select', tool('select', 'select', 'Select'))}
      ${show('slide', `<button class="tb-btn tb-toggle ${t.slide ? 'on' : ''}" data-act="slide" title="Slide mode — move the board while you write" aria-pressed="${t.slide}">${icon('pan', 22)}</button>`)}
      ${show('pen', tool('pen', 'pk_' + t.penStyle, 'Pen', `<span class="swatch-dot" style="background:${dot}"></span>`))}
      ${show('eraser', tool('eraser', 'eraser', 'Eraser'))}
      ${show('shape', tool('shape', 'shapes', 'Shapes'))}
      ${show('fill', tool('fill', 'bucket', 'Fill colour', `<span class="swatch-dot" style="background:${t.fillColor === 'none' ? 'transparent' : t.fillColor}"></span>`))}
      ${show('text', tool('text', 'text', 'Text'))}
      ${hide.has('tape') && hide.has('laser') ? '' : '<i class="tb-sep" aria-hidden="true"></i>'}
      ${show('tape', tool('tape', 'tape', 'Tape — hide answers, tap to show', `<span class="swatch-dot" style="background:${t.tapeColor}"></span>`))}
      ${show('laser', tool('laser', 'laser', 'Laser pointer'))}`;
    right.innerHTML = `
      ${subjectBtn}
      ${show('undo', `<button class="tb-btn" data-act="undo" title="Undo">${icon('undo', 22)}</button>`)}
      ${show('redo', `<button class="tb-btn" data-act="redo" title="Redo">${icon('redo', 22)}</button>`)}
      ${show('insert', `<button class="tb-btn ${this.popFor === 'insert' ? 'open' : ''}" data-pop="insert" title="Insert">${icon('plus', 22)}</button>`)}
      ${show('tools', `<button class="tb-btn ${this.popFor === 'tools' ? 'open' : ''}" data-pop="tools" title="Tools">${icon('ruler', 22)}</button>`)}
      ${show('shot', `<button class="tb-btn" data-act="shot" title="Screenshot: save a picture of what is on the screen">${icon('shot', 22)}</button>`)}
      ${show('timer', `<button class="tb-btn" data-act="timer" title="Timer for a question">${icon('timer', 22)}</button>`)}
      ${show('poll', `<button class="tb-btn" data-act="poll" title="Poll: A B C D with a timer">${icon('poll', 22)}</button>`)}
      ${show('graph', `<button class="tb-btn" data-act="graph" title="Graph from an equation (y = …)">${icon('graph', 22)}</button>`)}
      ${show('record', `<button class="tb-btn tb-rec ${isRecording() ? 'recording' : ''}" data-act="record" title="${isRecording() ? 'Stop recording' : 'Record lesson'}" aria-pressed="${isRecording()}">${icon('rec', 22)}<i class="tb-rec-ring" aria-hidden="true"></i></button>`)}
      ${show('pagenav', `<div class="tb-pagenav">
        <button class="icon-btn" data-act="prev" title="Previous page" aria-label="Previous page">${icon('prev')}</button>
        <span class="page-label">${store.index + 1} / ${store.doc.pages.length}</span>
        <button class="icon-btn" data-act="next" title="Next page" aria-label="Next page">${icon('next')}</button>
      </div>`)}
      ${show('pages', `<button class="tb-btn ${this.pages.open ? 'open' : ''}" data-act="pages" title="All pages">${icon('pages', 22)}</button>`)}
      <button class="tb-btn ${this.popFor === 'menu' || this.popFor === 'tbedit' ? 'open' : ''}" data-pop="menu" title="Menu">${icon('menu', 22)}</button>`;
    this.renderHex();
    this.updateUndo();
    this.moveIndicator(left);
    this.syncA11y();
    if (this.popover) {
      const anchor = this.toolbar.querySelector(`${this.popFromHex ? '.hexdock ' : ''}[data-tool="${this.popFor}"],${this.popFromHex ? '.hexdock ' : ''}[data-pop="${this.popFor}"]`) as HTMLElement | null;
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

  /**
   * The floating hexagon: "Move" in the middle (drag it anywhere), up to six
   * chosen buttons around it. The same buttons stay on the toolbar too.
   */
  private renderHex(): void {
    const dock = this.toolbar.querySelector('.hexdock') as HTMLElement;
    const items = (store.settings.hexItems ?? []).filter((k) => HEX_BUTTONS[k]).slice(0, 6);
    dock.hidden = !items.length;
    if (!items.length) return;
    const t = store.tool;
    // Around a pointy-top hexagon: right, lower right, lower left, left, upper left, upper right.
    const cells = items
      .map((k, i) => {
        const [html, active] = HEX_BUTTONS[k](t, this);
        return `<div class="hx hx-${i}${active ? ' active' : ''}">${html}</div>`;
      })
      .join('');
    dock.innerHTML = `<div class="hx hx-move" data-hexmove title="Drag to move"><span>Move</span></div>${cells}`;
    // While Edit toolbar is open (it covers the right side), the hexagon
    // waits on the left, in the middle, so the choices can be seen.
    const editing = this.popFor === 'tbedit' || this.popFor === 'menu';
    const pos = editing ? { x: 0.16, y: 0.45 } : (store.settings.hexPos ?? { x: 0.88, y: 0.42 });
    dock.style.left = `${pos.x * 100}%`;
    dock.style.top = `${pos.y * 100}%`;
    dock.style.setProperty('--R', `${store.settings.hexSize ?? 28}px`);
    dock.style.setProperty('--hexa', String(hexAlpha()));
    if (!dock.dataset.bound) {
      dock.dataset.bound = '1';
      let drag: { id: number; dx: number; dy: number } | null = null;
      dock.addEventListener('pointerdown', (e) => {
        if (!(e.target as HTMLElement).closest('[data-hexmove]')) return;
        e.preventDefault();
        const r = dock.getBoundingClientRect();
        drag = { id: e.pointerId, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
        dock.setPointerCapture(e.pointerId);
        dock.classList.add('dragging');
      });
      dock.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const W = window.innerWidth, H = window.innerHeight;
        const x = Math.max(70, Math.min(W - 70, e.clientX - drag.dx)), y = Math.max(70, Math.min(H - 120, e.clientY - drag.dy));
        dock.style.left = `${x}px`;
        dock.style.top = `${y}px`;
      });
      const end = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        dock.classList.remove('dragging');
        const r = dock.getBoundingClientRect();
        store.settings.hexPos = { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
        store.setSettings({ hexPos: store.settings.hexPos });
      };
      dock.addEventListener('pointerup', end);
      dock.addEventListener('pointercancel', end);
    }
  }

  private updateUndo(): void {
    this.toolbar.querySelectorAll('[data-act=undo]').forEach((b) => b.toggleAttribute('disabled', !store.canUndo));
    this.toolbar.querySelectorAll('[data-act=redo]').forEach((b) => b.toggleAttribute('disabled', !store.canRedo));
  }

  private onToolbarClick(b: HTMLElement): void {
    if (b.dataset.tool) {
      const id = b.dataset.tool as ToolId;
      // Back to writing / erasing: the spotlight and magnifier go away by themselves.
      closeSpotlight();
      closeMagnifier();
      const hasOptions = id === 'pen' || id === 'eraser' || id === 'shape' || id === 'fill' || id === 'tape' || id === 'laser';
      if (store.tool.tool === id && hasOptions) this.togglePopover(id, b);
      else {
        this.closePopover();
        store.setTool({ tool: id });
        // Shapes: show the picker right away, a shape must be chosen first.
        if (id === 'shape') this.togglePopover('shape', b);
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
    this.root.classList.remove('pop-open');
    if (this.popArrow) fadeOut(this.popArrow);
    this.popArrow = null;
    const wasEdit = this.popFor === 'tbedit' || this.popFor === 'menu';
    this.popFor = '';
    if (wasEdit) this.renderHex();
    this.toolbar.querySelectorAll('.open').forEach((x) => x.classList.remove('open'));
  }

  private togglePopover(kind: string, anchor: HTMLElement): void {
    if (this.popFor === kind) return this.closePopover();
    this.closePopover();
    // (A hexagon button may already be redrawn, and so detached, when we get here: its class tells.)
    this.popFromHex = !!anchor.closest('.hexdock') || anchor.classList.contains('hx-btn');
    if (kind === 'tbedit' || kind === 'menu') queueMicrotask(() => this.renderHex());
    const pop = document.createElement('div');
    pop.className = 'popover';
    this.root.appendChild(pop);
    this.popover = pop;
    this.root.classList.add('pop-open'); // the quick bar steps aside
    this.popFor = kind;
    anchor.classList.add('open');
    pop.addEventListener('click', (e) => this.onPopoverClick(e));
    pop.addEventListener('input', (e) => this.onPopoverInput(e));
    pop.addEventListener('change', (e) => this.onCustomColor(e));
    this.fillPopover();
    pop.querySelectorAll('.pm-list').forEach((l) => l.setAttribute('role', 'menu'));
    nameControls(pop);
    this.positionPopover(anchor);
    this.syncA11y();
  }

  /** Top of the bottom bars under the span x1..x2 (phones stack two bars). */
  private barsTop(x1: number, x2: number, top: number): number {
    for (const b of this.root.querySelectorAll<HTMLElement>('.toolbar')) {
      const r = b.getBoundingClientRect();
      if (r.right > x1 && r.left < x2) top = Math.min(top, r.top);
    }
    return top;
  }

  /** Bottom of the top bars under the span x1..x2 (toolbar on top). */
  private barsBottom(x1: number, x2: number, bottom: number): number {
    for (const b of this.root.querySelectorAll<HTMLElement>('.toolbar')) {
      const r = b.getBoundingClientRect();
      if (r.right > x1 && r.left < x2) bottom = Math.max(bottom, r.bottom);
    }
    return bottom;
  }

  private positionPopover(anchor0: HTMLElement): void {
    let anchor = anchor0;
    // From the floating hexagon the menu still opens at the toolbar (always the same place, never up at the hexagon).
    // (The hexagon may have been redrawn meanwhile, so go by what was opened, not by the old button.)
    if (this.popFromHex || anchor.closest('.hexdock')) {
      const twin = this.toolbar.querySelector(`.tb-left [data-tool="${this.popFor}"], .tb-right [data-tool="${this.popFor}"], .tb-left [data-pop="${this.popFor}"], .tb-right [data-pop="${this.popFor}"]`) as HTMLElement | null;
      anchor = twin ?? (this.toolbar.querySelector('.tb-left') as HTMLElement);
    }
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
      top: [cx, Math.min(H - ph - 8, this.barsBottom(cx, cx + pw, r.bottom) + gap)],
      left: [Math.min(W - pw - 8, r.right + gap), cy],
      right: [Math.max(8, r.left - pw - gap), cy],
    }[tbEdge()];
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    // A small arrow from the menu to the button it belongs to.
    const edge = tbEdge();
    const arrow = (this.popArrow ??= (() => {
      const a = document.createElement('i');
      a.className = 'pop-arrow';
      this.root.appendChild(a);
      return a;
    })());
    const s = 14 * k;
    const ax = Math.max(left + 22 * k, Math.min(left + pw - 22 * k, r.left + r.width / 2));
    arrow.style.width = arrow.style.height = `${s}px`;
    arrow.style.left = `${ax - s / 2}px`;
    arrow.style.top = `${edge === 'bottom' ? top + ph - s / 2 - 1 : top - s / 2 + 1}px`;
    arrow.dataset.dir = edge === 'bottom' ? 'down' : 'up';
  }

  private popArrow: HTMLElement | null = null;

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
        // iPad-style pen bar: pens standing in a row (tops only), six colour circles on the right.
        // The size and colour sliders sit below the bar.
        const keepScroll = (pop.querySelector('.pt-pens') as HTMLElement | null)?.scrollLeft ?? null;
        const cols = hl ? HL_COLORS : BAR_COLORS;
        pop.className = `popover pop-n3 pop-tray${this.penOpts ? ' opts' : ''}${this.penWheel ? ' wheel' : ''}`;
        pop.innerHTML = `
          <i class="pt-grab" aria-hidden="true"></i>
          <div class="pt-bar">
            <div class="pt-pens" role="listbox" aria-label="Pen type">${PEN_DEFS}${this.trayPens()}</div>
            <div class="swatches pt-cols">${cols.map((c) => `<button class="pt-col ${c === color ? 'on' : ''}" style="--c:${c}" data-color="${c}" aria-label="${c}"></button>`).join('')}<button class="pt-col pt-wheel${cols.includes(color) || this.penWheel ? '' : ' on'}${this.penWheel ? ' open' : ''}" data-wheel aria-expanded="${this.penWheel}" aria-label="More colours"></button></div>
          </div>
          ${this.penWheel ? `<div class="pt-wheelbox">${colorWheelSvg(color)}<div class="pt-loupe" hidden><i></i><b></b></div></div>` : ''}
          ${this.penOpts ? `<div class="pt-opts">
            <div class="n3-size">
              <input type="range" id="pen-size" min="1" max="${hl ? 60 : 40}" value="${size}" data-pensize aria-label="Size">
              <span class="pen-prev"><i data-penprev style="width:${Math.min(26, size + 2)}px;height:${Math.min(26, size + 2)}px;background:${color};opacity:${hl ? 0.45 : 1}"></i></span>
            </div>
          </div>` : ''}`;
        const pens = pop.querySelector('.pt-pens') as HTMLElement;
        if (keepScroll !== null) pens.scrollLeft = keepScroll;
        else (pens.querySelector('.pt-pen.on') as HTMLElement | null)?.scrollIntoView({ inline: 'center', block: 'nearest' });
        this.penLift = '';
        if (this.penWheel) this.wireFlower(pop.querySelector('.pt-wheelbox') as HTMLElement);
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
          <div class="seg"><button class="${t.laserBlink ? '' : 'on'}" data-lblink="0">Steady</button><button class="${t.laserBlink ? 'on' : ''}" data-lblink="1">Blink</button></div>
          <div class="slider-row">
            <span class="slider-label">Stays for</span>
            <input type="range" min="0.5" max="10" step="0.5" value="${t.laserStay ?? 0.8}" data-lstay aria-label="Seconds the laser stays after lifting">
            <span class="slider-preview"><b data-lstayv>${(t.laserStay ?? 0.8).toFixed(1)} s</b></span>
          </div>
          <div class="muted small center">Draw to point things out. It stays, then fades away smoothly.</div>`;
        break;
      case 'eraser':
        // Note 3 style: three erasers as icons, size (for Part), slide to clear.
        pop.className = 'popover pop-eraser';
        pop.innerHTML = `
          <div class="er-modes">
            <button class="er-mode ${t.eraserMode === 'point' ? 'on' : ''}" data-emode="point" title="Part: rub out just a part" aria-label="Erase a part">${icon('erPart', 26)}</button>
            <button class="er-mode ${t.eraserMode === 'stroke' ? 'on' : ''}" data-emode="stroke" title="Object: touch anything to erase all of it" aria-label="Erase whole objects">${icon('erObject', 26)}</button>
            <button class="er-mode ${t.eraserMode === 'area' ? 'on' : ''}" data-emode="area" title="Area: draw a loop, everything inside goes" aria-label="Erase an area">${icon('erArea', 26)}</button>
            <label class="er-clear" title="Slide to clear the page"><input type="range" min="0" max="100" value="0" data-sclear aria-label="Slide to clear the page"><span>Slide to clear page »</span></label>
          </div>
          ${
            t.eraserMode === 'point'
              ? `<div class="slider-row">
            <input type="range" id="eraser-size" min="10" max="160" value="${t.eraserSize}" data-erasersize aria-label="Eraser size">
            <span class="slider-preview"><i data-eraserprev class="eraser-prev" style="width:${Math.min(44, t.eraserSize / 3.5 + 6)}px;height:${Math.min(44, t.eraserSize / 3.5 + 6)}px"></i></span>
          </div>`
              : ''
          }`;
        pop.onchange = (e) => {
          const el = e.target as HTMLInputElement;
          if (el.dataset.sclear === undefined) return;
          if (Number(el.value) >= 92) {
            this.closePopover();
            this.action('clear');
          } else el.value = '0';
        };
        break;
      case 'shape':
        // Note 3 style: line size on top, shapes below, colours on the right.
        pop.className = 'popover pop-n3';
        pop.innerHTML = `
          <div class="n3-left">
            <div class="n3-size">
              <input type="range" min="1" max="16" value="${t.shapeSize}" data-shapesize aria-label="Line size">
              <span class="pen-prev"><i data-shapeprev style="width:${Math.min(20, t.shapeSize + 3)}px;height:${Math.min(20, t.shapeSize + 3)}px;background:${t.shapeColor}"></i></span>
            </div>
            <div class="shape-grid">${SHAPES.map(([k, n, svg]) => `<button class="shape-btn ${t.shape === k ? 'on' : ''}" data-shape="${k}" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${svg}</svg></button>`).join('')}</div>
          </div>
          <div class="n3-colors">${this.swatches(boardColors(), t.shapeColor, 'scolor')}</div>`;
        break;
      case 'insert':
        // A tidy list with a title.
        pop.className = 'popover pop-list';
        pop.innerHTML = `<div class="pm-title">Insert</div>
          <div class="pm-list">
            ${this.menuItem('image', 'image', 'Picture')}
            ${this.menuItem('pdf', 'pdf', 'PDF / Book')}
            ${this.menuItem('pptx', 'slides', 'PowerPoint')}
            ${this.menuItem('table', 'table', 'Table')}
            ${this.menuItem('graph', 'graph', 'Graph y = f(x)')}
            ${this.menuItem('page', 'pages', 'New page')}
            ${hasClipboard() ? this.menuItem('paste', 'paste', 'Paste copied items') : ''}
          </div>`;
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
        pop.className = 'popover pop-list pop-list-2';
        pop.innerHTML = `<div class="pm-title">Tools</div>
          <div class="pm-list pm-cols">
          ${this.menuItem('ruler', 'ruler', 'Ruler', ins.has('ruler'))}
          ${this.menuItem('protractor', 'protractor', 'Protractor', ins.has('protractor'))}
          ${this.menuItem('compass', 'compass', 'Compass', t.tool === 'compass')}
          ${this.menuItem('timer', 'timer', 'Timer')}
          ${this.menuItem('spotlight', 'spotlight', 'Spotlight')}
          ${this.menuItem('curtain', 'curtain', 'Screen cover')}
          ${this.menuItem('magnifier', 'magnifier', 'Magnifier')}
          ${this.menuItem('graph', 'graph', 'Graph y = f(x)')}
          ${this.menuItem('calc', 'calc', 'Calculator')}
          ${this.menuItem('picker', 'dice', 'Random picker')}
          ${this.menuItem('score', 'score', 'Scoreboard')}
          ${this.menuItem('poll', 'poll', 'Poll A B C D')}
          ${this.menuItem('tool-laser', 'laser', 'Laser pointer', t.tool === 'laser')}
          ${this.menuItem('tool-tape', 'tape', 'Tape (hide answers)', t.tool === 'tape')}
          ${this.menuItem('tool-fill', 'bucket', 'Fill colour', t.tool === 'fill')}
          ${this.menuItem('multi', 'pen', 'Group writing', store.settings.multiWrite)}</div>`;
        break;
      }
      case 'tbedit': {
        const hide = new Set(store.settings.tbHidden);
        const group = () =>
          TB_ITEMS.map(([k, n]) => {
              const shown = TB_OPT_IN.has(k) ? (store.settings.tbShown ?? []).includes(k) : !hide.has(k);
              return `<label class="check tbe-item"><input type="checkbox" data-tbitem="${k}" ${shown ? 'checked' : ''}> ${n}</label>`;
            })
            .join('');
        pop.className = 'popover pop-tbedit';
        pop.innerHTML = `<div class="pop-title">Edit toolbar</div>
          <div class="seg tbe-pos"><span>Toolbar at</span>${(['bottom', 'top'] as const).map((k) => `<button class="${tbEdge() === k ? 'on' : ''}" data-tbpos="${k}">${k === 'bottom' ? 'Bottom' : 'Top'}</button>`).join('')}</div>
          <div class="seg tbe-pos"><span>Buttons</span>${(['middle', 'sides'] as const).map((k) => `<button class="${tbMiddle() === (k === 'middle') ? 'on' : ''}" data-tbalign="${k}">${k === 'middle' ? 'Middle' : 'Sides'}</button>`).join('')}</div>
          <div class="slider-row">
            <span class="slider-label">Height</span>
            <input type="range" min="0" max="100" step="1" value="${Math.round((store.settings.tbY ?? (tbEdge() === 'top' ? 0 : 1)) * 100)}" data-tby aria-label="Toolbar height: top to bottom">
          </div>
          <button class="btn wide" data-tbstick ${tbFree() ? '' : 'disabled'}>Stick to the ${tbEdge()} edge</button>
          <label class="check tbe-item tbe-qb"><input type="checkbox" data-quickbar ${store.settings.quickBar === true ? 'checked' : ''}> Pen colour bar (colours and thickness next to the toolbar)</label>
          <div class="muted small">Tick the buttons you want on the toolbar.</div>
          <div class="tbe-grid">${group()}</div>
          <div class="seg tbe-pos"><button data-tbsimple>Simple toolbar</button><button data-tbreset>Show all buttons</button></div>
          <div class="pop-title">Floating hexagon</div>
          <div class="muted small">Pick up to 6 buttons for a hexagon you can drag anywhere ("Move" in the middle). None = no hexagon.</div>
          <div class="slider-row">
            <span class="slider-label">Size</span>
            <input type="range" min="20" max="44" step="1" value="${store.settings.hexSize ?? 28}" data-hexsize aria-label="Hexagon size">
          </div>
          <div class="slider-row">
            <span class="slider-label">Transparency</span>
            <input type="range" min="0" max="80" step="5" value="${Math.round((1 - hexAlpha()) * 100)}" data-hexop aria-label="Hexagon transparency in percent">
            <span class="slider-preview"><b data-hexopv>${Math.round((1 - hexAlpha()) * 100)}%</b></span>
          </div>
          <div class="tbe-grid">${Object.keys(HEX_BUTTONS)
            .map((k) => {
              const on = (store.settings.hexItems ?? []).includes(k);
              const full = (store.settings.hexItems ?? []).length >= 6;
              return `<label class="check tbe-item"><input type="checkbox" data-hexitem="${k}" ${on ? 'checked' : ''} ${!on && full ? 'disabled' : ''}> ${HEX_NAMES[k]}</label>`;
            })
            .join('')}</div>`;
        pop.onchange = (e) => {
          const el = e.target as HTMLInputElement;
          if (el.dataset.tby !== undefined) {
            this.applyScale(true);
            this.fillPopover();
            return;
          }
          if (el.dataset.quickbar !== undefined) {
            store.setSettings({ quickBar: el.checked });
            return;
          }
          if (el.dataset.hexitem) {
            const cur = (store.settings.hexItems ?? []).filter((x) => x !== el.dataset.hexitem);
            if (el.checked && cur.length < 6) cur.push(el.dataset.hexitem);
            store.setSettings({ hexItems: cur });
            this.renderHex();
            this.fillPopover();
            return;
          }
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
        // Compact: board colour + pattern sketches, actions as icon tiles,
        // switches tucked under Settings, legal links small at the bottom.
        const tile = (act: string, ic: string, label: string, extra = '') => `<button class="mt-tile" data-act="${act}" title="${label}">${icon(ic, 22)}<span>${label}</span>${extra}</button>`;
        const sw = (key: keyof typeof s, label: string, on: boolean) => `<label class="mt-switch"><span>${label}</span><input type="checkbox" data-set="${key}" ${on ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
        pop.className = 'popover pop-menu';
        pop.innerHTML = `
          <div class="mt-row">
            <div class="board-palette">${BOARDS.map((c) => `<button class="swatch ${p.bg === c ? 'on' : ''}" style="background:${c}" data-bg="${c}" aria-label="Board colour ${c}"></button>`).join('')}
              <label class="swatch custom" title="Any colour"><input type="color" id="board-color" value="${p.bg}" data-bgpick aria-label="Pick any board colour"></label></div>
          </div>
          <div class="mt-patterns">${PATTERNS.map(([k, n]) => `<button class="mt-pat ${p.pattern === k ? 'on' : ''}" data-pattern="${k}" title="${n}" aria-label="${n}">${PATTERN_ICONS[k]}</button>`).join('')}</div>
          <div class="mt-grid">
            ${tile('library', 'notebook', 'Notebooks')}
            ${tile('new', 'new', 'New')}
            ${tile('save', 'save', 'Save notebook')}
            ${tile('open', 'open', 'Open file')}
            ${tile('open-pdf', 'pdf', 'PDF')}
            ${tile('open-pptx', 'slides', 'PowerPoint')}
            ${tile('export', 'download', 'Save PDF')}
            ${tile('export-png', 'image', 'Save picture')}
            ${tile('record', 'record', 'Record')}
            ${tile('delete-page', 'trash', 'Delete page')}
            ${tile('fullscreen', 'fullscreen', 'Full screen')}
            ${tile('share-app', 'share', 'Share')}
            ${isInstalled() ? tile('tbedit', 'settings', 'Toolbar') : tile('install', 'download', 'Install')}
          </div>
          <button class="mt-wide" data-act="subject">${icon('atom', 18)} Subject: ${(() => { const s = chapterById(store.settings.subject); return s ? `${s.subject.name} · ${s.chapter.short}` : 'none'; })()}</button>
          ${isInstalled() ? '' : `<button class="mt-wide" data-act="tbedit">${icon('settings', 18)} Edit toolbar</button>`}
          <details class="mt-settings" data-resize>
            <summary>${icon('settings', 18)} Settings</summary>
            ${sw('penOnly', 'Stylus only (fingers do not draw)', s.penOnly)}
            ${sw('palmErase', 'Erase with palm', s.palmErase)}
            ${sw('scribbleErase', 'Scribble to erase', s.scribbleErase !== false)}
            ${sw('holdShapes', 'Hold pen to make a shape', s.holdShapes)}
            ${sw('inkPredict', 'Ink ahead of the pen (try on slow boards)', !!s.inkPredict)}
            ${sw('bigControls', 'Large buttons (classroom boards, fingers)', !!s.bigControls)}
          </details>
          <div class="mt-foot"><button data-act="privacy">Privacy</button>·<button data-act="terms">Terms</button><span>v ${BUILD_TIME}</span></div>`;
        pop.querySelector('[data-resize]')?.addEventListener('toggle', () => {
          const a = this.toolbar.querySelector('[data-pop=menu]') as HTMLElement | null;
          if (a && this.popover === pop) this.positionPopover(a);
        });
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

  /** One row of a list menu: icon and name (highlighted when `on`). */
  private menuItem(act: string, ic: string, label: string, on = false): string {
    return `<button class="pm-item ${on ? 'on' : ''}" data-act="${act}" role="menuitem">${icon(ic, 22)}<span>${label}</span></button>`;
  }


  private flowerPickedAt = 0;
  /**
   * Colour flower: while the finger (or mouse) moves over it, a big bubble above the finger shows the colour under it,
   * live; lifting the finger on a colour picks it. Mouse hover shows the bubble without picking. Only runs while open.
   */
  private wireFlower(box: HTMLElement): void {
    const svg = box.querySelector('.pt-flower') as SVGSVGElement;
    const loupe = box.querySelector('.pt-loupe') as HTMLElement;
    let hov: Element | null = null, down = false;
    const at = (e: PointerEvent): string | null => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const p = el && svg.contains(el) ? (el.closest('[data-wc]') as SVGElement | null) : null;
      if (p !== hov) {
        hov?.classList.remove('hov');
        p?.classList.add('hov');
        hov = p;
      }
      if (!p) {
        loupe.hidden = true;
        return null;
      }
      const c = p.dataset.wc!;
      const r = box.getBoundingClientRect();
      loupe.hidden = false;
      loupe.style.setProperty('--c', c);
      loupe.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
      (loupe.querySelector('b') as HTMLElement).textContent = c.toUpperCase();
      return c;
    };
    svg.addEventListener('pointerdown', (e) => {
      down = true;
      svg.setPointerCapture?.(e.pointerId);
      at(e);
    });
    svg.addEventListener('pointermove', (e) => {
      if (down || e.pointerType === 'mouse') at(e);
    });
    const end = (e: PointerEvent, pick: boolean) => {
      if (!down) return;
      down = false;
      const c = pick ? at(e) : null;
      loupe.hidden = true;
      if (!c) return;
      this.flowerPickedAt = performance.now();
      store.setTool(store.tool.penStyle === 'highlighter' ? { hlColor: c } : { color: c });
      this.penWheel = false;
      this.fillPopover();
      this.placePenPop();
    };
    svg.addEventListener('pointerup', (e) => end(e, true));
    svg.addEventListener('pointercancel', (e) => end(e, false));
    svg.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !down) {
        hov?.classList.remove('hov');
        hov = null;
        loupe.hidden = true;
      }
    });
  }

  /** The pen menu grew or shrank (colour flower opened or closed): keep it on the toolbar and on screen. */
  private placePenPop(): void {
    const a = this.toolbar.querySelector(`${this.popFromHex ? '.hexdock ' : ''}[data-tool="pen"],${this.popFromHex ? '.hexdock ' : ''}[data-pop="pen"]`) as HTMLElement | null;
    if (a) this.positionPopover(a);
  }

  /** Tray state: sliders open; the pen just picked (it rises with a short animation, only on that render). */
  private penOpts = true; // size and colour sliders always show under the pens (owner, 2026-11-20)
  private penLift = '';
  private penWheel = false;

  /** All pens stand in a row, tip up; only the top part shows. The pen in use stands higher and shows its size. */
  private trayPens(): string {
    const t = store.tool;
    return PEN_TYPES.map(([k, n]) => {
      const on = t.penStyle === k;
      const col = k === 'highlighter' ? t.hlColor : on ? t.color : t.penColors[k as PenKind] ?? '#f2f2f0';
      const num = on ? String(k === 'highlighter' ? t.hlSize : t.size) : '';
      return `<button class="pt-pen${on ? ' on' : ''}${this.penLift === k ? ' rise' : ''}" data-style="${k}" title="${n}" aria-label="${n}" role="option" aria-selected="${on}">${penSvg(k as PenKind, col, num)}</button>`;
    }).join('');
  }

  private onPopoverClick(e: MouseEvent): void {
    if (performance.now() - this.flowerPickedAt < 450) return; // the finger just picked on the flower
    const petal = (e.target as Element).closest('[data-wc]') as SVGElement | null;
    if (petal) {
      const c = petal.dataset.wc!;
      store.setTool(store.tool.penStyle === 'highlighter' ? { hlColor: c } : { color: c });
      this.penWheel = false;
      this.fillPopover();
      this.placePenPop();
      return;
    }
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    const d = b.dataset;
    const t = store.tool;
    if (d.wheel !== undefined) {
      this.penWheel = !this.penWheel;
      this.fillPopover();
      this.placePenPop();
      return;
    }
    if (d.style) {
      if (d.style === t.penStyle) return;
      else {
        this.penLift = d.style;
        store.setTool({ penStyle: d.style as ToolState['penStyle'] });
      }
      this.fillPopover();
      this.placePenPop();
      return;
    }
    else if (d.color) store.setTool(t.penStyle === 'highlighter' ? { hlColor: d.color } : { color: d.color });
    else if (d.scolor) store.setTool({ shapeColor: d.scolor });
    else if (d.emode) store.setTool({ eraserMode: d.emode as 'point' });
    else if (d.fillc) store.setTool({ fillColor: d.fillc });
    else if (d.tapec) store.setTool({ tapeColor: d.tapec });
    else if (d.laserc) store.setTool({ laserColor: d.laserc });
    else if (d.lblink) store.setTool({ laserBlink: d.lblink === '1' });
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
    } else if (d.tbsimple !== undefined) {
      store.setSettings({ tbHidden: [...SIMPLE_HIDDEN], tbShown: [] });
      this.fillPopover();
      return;
    } else if (d.tbreset !== undefined) {
      store.setSettings({ tbHidden: [], tbShown: [...TB_OPT_IN] });
      this.fillPopover();
      return;
    } else if (d.tbstick !== undefined) {
      // Back onto the edge the bar is nearest to.
      store.setSettings({ tbPos: tbEdge(), tbY: undefined });
      this.applyScale(true);
      this.fillPopover();
      return;
    } else if (d.tbalign) {
      store.setSettings({ tbAlign: d.tbalign as 'middle' | 'sides' });
      this.applyScale(true);
      this.fillPopover();
      return;
    } else if (d.tbpos) {
      this.setToolbarPos(d.tbpos as 'bottom' | 'top');
      this.fillPopover();
      return;
    } else if (d.bg) this.setBoard({ bg: d.bg });
    else if (d.pattern) this.setBoard({ pattern: d.pattern as BgPattern });
    else if (d.act) {
      // The first tap on Delete page only asks: the menu stays open for the second tap.
      const arming = d.act === 'delete-page' && performance.now() - this.deleteArmedAt > 4000;
      if (!arming) this.closePopover();
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
    } else if (el.dataset.hexsize !== undefined) {
      store.settings.hexSize = v;
      (this.toolbar.querySelector('.hexdock') as HTMLElement).style.setProperty('--R', `${v}px`);
      store.setSettings({ hexSize: v });
    } else if (el.dataset.tby !== undefined) {
      // The bar follows the slider live; menus and the page are laid out again on release.
      store.settings.tbY = v / 100;
      this.root.setAttribute('data-tbfree', '');
      this.placeBars(this.toolbar.querySelector('.tb-left') as HTMLElement, this.toolbar.querySelector('.tb-right') as HTMLElement, this.root.classList.contains('tb-stacked'));
      store.setSettings({ tbY: v / 100 });
    } else if (el.dataset.hexop !== undefined) {
      const a = 1 - v / 100;
      (this.toolbar.querySelector('.hexdock') as HTMLElement).style.setProperty('--hexa', String(a));
      const out = this.popover?.querySelector('[data-hexopv]') as HTMLElement | null;
      if (out) out.textContent = `${v}%`;
      store.setSettings({ hexAlpha: a });
    } else if (el.dataset.shapesize !== undefined) {
      store.tool.shapeSize = v;
      const prev = this.popover?.querySelector('[data-shapeprev]') as HTMLElement | null;
      if (prev) prev.style.width = prev.style.height = `${Math.min(20, v + 3)}px`;
    } else if (el.dataset.lstay !== undefined) {
      store.tool.laserStay = v;
      const out = this.popover?.querySelector('[data-lstayv]') as HTMLElement | null;
      if (out) out.textContent = `${v.toFixed(1)} s`;
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
      case 'delete-page': {
        // Deleting a page sits next to everyday buttons, so it asks for a second tap (it can still be undone).
        const now = performance.now();
        const tile = this.root.querySelector<HTMLElement>('.mt-tile[data-act=delete-page]');
        if (now - this.deleteArmedAt > 4000) {
          this.deleteArmedAt = now;
          if (tile) {
            tile.classList.add('armed');
            (tile.querySelector('span') as HTMLElement).textContent = 'Tap again to delete';
            window.setTimeout(() => {
              if (tile.isConnected && performance.now() - this.deleteArmedAt >= 3900) {
                tile.classList.remove('armed');
                (tile.querySelector('span') as HTMLElement).textContent = 'Delete page';
              }
            }, 4000);
          }
          return toast(`Tap "Delete page" again to delete page ${store.index + 1}`, 2500);
        }
        this.deleteArmedAt = 0;
        store.deletePage();
        return toast('Page deleted — tap Undo to bring it back');
      }
      case 'subject':
        this.closePopover();
        this.subject.openPicker();
        return;
      case 'subject-tray':
        if (!store.settings.subject) return this.subject.openPicker();
        this.subject.toggle();
        return;
      case 'tool-laser':
      case 'tool-tape':
      case 'tool-fill':
        this.closePopover();
        return store.setTool({ tool: act.slice(5) as ToolId });
      case 'paste':
        this.closePopover();
        if (!pasteElements(this.board)) toast('Nothing copied yet — select something and tap Copy');
        return;
      case 'image':
        void insertImages(b);
        return;
      case 'pdf':
        void pickFiles('application/pdf,.pdf').then(async (files) => {
          const f = files[0];
          if (!f) return;
          const at = await this.pdfPlace(f);
          if (at !== null) await this.withProgress('Opening PDF', (p) => importPdf(b, f, p, at));
        });
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
      case 'poll':
        return openPoll(this.root);
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
        void saveNow().then(async () => {
          const doc = await newNotebookFlow(this.root, { name: 'Notebook', bg: store.page.bg });
          if (!doc) return;
          store.loadDoc(doc);
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
          await saveNow();
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
      case 'shot':
        void exportScreenshot(b).then(() => toast('Screenshot saved'));
        return;
      case 'export-png':
        void exportPng(b).then(() => toast(`Picture of page ${store.index + 1} saved`));
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

  /**
   * Where a PDF added to this notebook goes: a notebook with pages asks (at the end, after this page, or at the start);
   * an empty notebook just takes it. Undefined = the usual place, null = cancelled.
   */
  private async pdfPlace(f: File): Promise<number | null | undefined> {
    const pages = store.doc.pages;
    if (pages.length === 1 && pages[0].els.length === 0) return undefined;
    return askPdfPlace(this.root, { current: store.index + 1, total: pages.length, name: f.name.replace(/\.pdf$/i, '') });
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

    // A slim vertical bar of icons beside the selection; its options open
    // to the side.
    const btn = (s: PropSection, label: string, preview: string) =>
      `<button class="pv-btn ${sec === s ? 'on' : ''}" data-sec="${s}" title="${label}" aria-label="${label}">${preview}</button>`;
    const act = (attr: string, ic: string, label: string, cls = '') => `<button class="pv-btn ${cls}" ${attr} title="${label}" aria-label="${label}">${icon(ic, 22)}</button>`;
    bar.classList.add('props-v');
    bar.innerHTML = `
      <div class="props-row">
        ${act('data-pact="delete"', 'trash', 'Delete', 'danger')}
        ${colorable ? btn('color', 'Colour', `${icon('palette', 22)}<i class="pv-dot" style="background:${color}"></i>`) : ''}
        ${paths.length ? btn('width', 'Thickness', icon('thick', 22)) : ''}
        ${fillable ? btn('fill', 'Fill', `${icon('bucket', 22)}<i class="pv-dot ${fill ? '' : 'empty'}" style="background:${fill ?? 'transparent'}"></i>`) : ''}
        ${texts.length === 1 && paths.length ? act('data-pact="edittext"', 'text', 'Edit the label (mass, name …)') : ''}
        ${this.autoSetBlock() ? act('data-pact="autoset"', 'magic', 'Auto set: lie along the nearest surface and sit on it') : ''}
        ${els.length && els.every((e) => e.type === 'path') ? `${act('data-pact="flipx"', 'flipH', 'Flip left-right')}${act('data-pact="flipy"', 'flipV', 'Flip up-down')}` : ''}
        ${els.length === 1 && els[0].type === 'image' && !els[0].locked && !els[0].pdf ? act('data-pact="crop"', 'crop', 'Crop the picture') : ''}
        ${act('data-scale="1.18"', 'bigger', 'Bigger')}
        ${act('data-scale="0.85"', 'smaller', 'Smaller')}
        ${act('data-pact="copy"', 'copy', 'Copy (then Insert > Paste, on any page)')}
        ${act('data-pact="dup"', 'plus', 'Duplicate')}
        ${act('data-pact="moveto"', 'pages', 'Move to page')}
        ${els.some((e) => e.group) ? act('data-pact="ungroup"', 'shapes', 'Ungroup') : ''}
        ${
          table
            ? `${act('data-trows="1"', 'plus', 'Add row')}${act('data-tcols="1"', 'next', 'Add column')}${act('data-trows="-1"', 'up', 'Remove row')}${act('data-tcols="-1"', 'prev', 'Remove column')}<button class="pv-btn ${table.header ? 'on' : ''}" data-pact="header" title="Header row" aria-label="Header row">${icon('table', 22)}</button>`
            : ''
        }
      </div>
      ${panel ? `<div class="props-panel">${panel}</div>` : ''}`;
    bar.hidden = false;
    nameControls(bar);
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
    } else if (d.pact === 'crop') {
      const one = store.selectedEls()[0];
      if (one?.type === 'image') openCrop(this.root, this.board, one);
    } else if (d.pact === 'header') {
      store.mapEls(store.selection, (el) => (el.type === 'table' ? { ...el, header: !el.header } : el));
    } else if (d.scale) this.scaleSelection(Number(d.scale));
    else if (d.pact === 'ungroup') {
      // Split into separate pieces (e.g. to change one label of a graph).
      const ids = new Set(store.selection);
      store.mapEls(ids, (e) => ({ ...e, group: undefined }) as El);
      store.clearSelection();
    } else if (d.pact === 'copy') {
      const n = copySelection();
      toast(`${n} copied. Go to any page and tap the Paste button.`, 3500);
    } else if (d.pact === 'autoset') this.autoSet();
    else if (d.pact === 'edittext') {
      const t = store.selectedEls().find((e) => e.type === 'text') as TextEl | undefined;
      if (t) {
        store.clearSelection();
        this.editor.open(t, false);
      }
    }
    else if (d.pact === 'flipx' || d.pact === 'flipy') this.flip(d.pact === 'flipx');
    else if (d.pact === 'moveto') this.movePicker(e.target as HTMLElement);
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

  /** "Move to page": a small grid of page numbers (and a new page) next to the selection bar. */
  private movePicker(anchor: HTMLElement): void {
    this.root.querySelector('.move-picker')?.remove();
    const box = document.createElement('div');
    box.className = 'move-picker';
    const pages = store.doc.pages.length;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Move or copy to a page');
    const seg = (m: 'move' | 'copy', label: string) => `<button data-mode="${m}" aria-pressed="${this.pickMode === m}" class="${this.pickMode === m ? 'on' : ''}">${label}</button>`;
    box.innerHTML = `<div class="mp-seg" role="group" aria-label="Move or copy">${seg('move', 'Move')}${seg('copy', 'Copy')}</div><div class="mp-title"></div><div class="mp-grid">${Array.from({ length: pages }, (_, i) => `<button data-to="${i}" ${i === store.index ? 'disabled' : ''}>${i + 1}</button>`).join('')}<button data-to="${pages}" class="mp-new" aria-label="New page">+ New</button></div>`;
    this.root.appendChild(box);
    const r = anchor.closest('button')!.getBoundingClientRect();
    box.style.left = `${Math.max(8, Math.min(window.innerWidth - 8 - box.offsetWidth, r.left - box.offsetWidth / 2 + r.width / 2))}px`;
    box.style.top = `${Math.max(8, r.top - box.offsetHeight - 10)}px`;
    const title = box.querySelector('.mp-title') as HTMLElement;
    const sync = () => {
      title.textContent = this.pickMode === 'move' ? 'Move to page (the things leave this page)' : 'Copy to page (the things stay here too)';
      box.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => {
        b.classList.toggle('on', b.dataset.mode === this.pickMode);
        b.setAttribute('aria-pressed', String(b.dataset.mode === this.pickMode));
      });
    };
    sync();
    const close = () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc, true);
      fadeOut(box);
    };
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', esc, true);
    const away = (ev: Event) => {
      if (!box.contains(ev.target as Node)) close();
    };
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
    box.addEventListener('click', (ev) => {
      const m = (ev.target as HTMLElement).closest<HTMLElement>('[data-mode]');
      if (m) {
        this.pickMode = m.dataset.mode as 'move' | 'copy';
        return sync();
      }
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-to]');
      if (!b || b.hasAttribute('disabled')) return;
      const to = Number(b.dataset.to);
      const copy = this.pickMode === 'copy';
      const n = copy ? store.copyElsToPage([...store.selection], to) : store.moveElsToPage([...store.selection], to);
      close();
      const where = to === pages ? 'a new page' : `page ${to + 1}`;
      if (n) toast(`${copy ? 'Copied' : 'Moved'} ${n} ${n === 1 ? 'item' : 'items'} to ${where}. Undo ${copy ? 'removes the copies' : 'brings them back'}.`);
    });
  }

  /** After Copy: a "Paste" button floats at the top of the board until it is used or closed. */
  private pasteChip(): void {
    const chip = document.createElement('div');
    chip.className = 'paste-chip';
    chip.hidden = true;
    chip.innerHTML = `<button class="pc-go" data-pc="go">${icon('paste', 20)}<span></span></button><button class="pc-x" data-pc="x" aria-label="Close">${icon('close', 16)}</button>`;
    this.root.appendChild(chip);
    let timer = 0;
    const hide = () => {
      chip.hidden = true;
      clearTimeout(timer);
    };
    onClipboardChange(() => {
      (chip.querySelector('.pc-go span') as HTMLElement).textContent = `Paste ${clipboardCount()} ${clipboardCount() === 1 ? 'item' : 'items'} here`;
      chip.hidden = false;
      chip.classList.remove('pc-in');
      void chip.offsetWidth;
      chip.classList.add('pc-in');
      clearTimeout(timer);
      timer = window.setTimeout(hide, 120_000);
    });
    chip.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pc]');
      if (!b) return;
      if (b.dataset.pc === 'x') return hide();
      if (pasteElements(this.board)) toast('Pasted', 1500);
    });
  }

  /** The one block (with its label) that Auto set can seat, when exactly that is selected. */
  private autoSetBlock(): PathEl | null {
    const els = store.selectedEls();
    const blocks = els.filter((e): e is PathEl => e.type === 'path' && e.snap === 'block');
    return blocks.length === 1 && els.every((e) => e === blocks[0] || e.type === 'text') ? blocks[0] : null;
  }

  /** Auto set: the selected block turns to lie along the nearest surface and sits on it. */
  private autoSet(): void {
    const blk = this.autoSetBlock();
    const info = blk && blockInfo(blk);
    if (!blk || !info) return;
    const hit = nearest(surfaces(store.page.els, store.selection), info.cx, info.cy, 260);
    if (!hit) return void toast('No surface close by (ground, table, wedge or another block)', 2600);
    const m = seat(info, hit.s, hit.t);
    store.mapEls(store.selection, (e) => transformEl(e, m));
  }

  /** Mirror the selected shapes / lines around the middle of the selection (left-right or up-down). */
  private flip(horizontal: boolean): void {
    const r = this.board.selectionBounds();
    if (!r) return;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const m: [number, number, number, number, number, number] = horizontal ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy];
    store.mapEls(store.selection, (e) => (e.type === 'path' ? transformEl(e, m) : e));
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
    const [x2] = this.board.toScreen(r.x + r.w, r.y + r.h);
    scaleFloating(bar);
    const k = ui();
    const bw = bar.offsetWidth * k, bh = bar.offsetHeight * k;
    // The open Pages panel covers the right edge: keep the bar clear of it.
    const pp = this.root.querySelector('.pages-panel') as HTMLElement | null;
    const W = pp ? Math.min(this.board.w, pp.getBoundingClientRect().left - 8) : this.board.w, H = this.board.h, gap = 26 * k;
    // Beside the selection: right if there is room, else left, else inside.
    let left = x2 + gap;
    if (left + bw > W - 8) left = x1 - gap - bw;
    if (left < 8) left = Math.max(8, Math.min(W - bw - 8, x2 - bw - 8));
    const top = Math.max(12, Math.min(H - bh - 90 * k, y1));
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
    // Options open towards the free side.
    bar.classList.toggle('pv-left', left < x1);
  }


  // ---------------------------------------------------------------------------
  // Chrome, keyboard, drag & drop, autosave

  private bindChrome(): void {
    // A toolbar button reacts the moment the finger lands (not after it lifts), once.
    // A board that drops the browser's click still works; a real click (keyboard,
    // mouse without pointer events) is the fallback and is ignored when already handled.
    // (Matched by what the button DOES, not by the element: the toolbar may be rebuilt in between.)
    let done: { k: string; t: number } | null = null;
    const keyOf = (b: HTMLElement): string => b.dataset.tool ?? b.dataset.pop ?? b.dataset.act ?? '';
    const handled = (b: HTMLElement): boolean => !!done && done.k === keyOf(b) && performance.now() - done.t < 900;
    const buttonOf = (e: Event) => (e.target as HTMLElement).closest('button') as HTMLElement | null;
    this.toolbar.addEventListener('pointerdown', (e) => {
      const b = buttonOf(e);
      if (!b || b.hasAttribute('disabled') || e.button > 0) return;
      done = null;
      b.classList.add('pressed');
      const release = () => {
        b.classList.remove('pressed');
        window.removeEventListener('pointerup', release, true);
        window.removeEventListener('pointercancel', release, true);
      };
      window.addEventListener('pointerup', release, true);
      window.addEventListener('pointercancel', release, true);
      // Choosing another tool is instant; opening menus and the rest wait for the lift.
      if (b.dataset.tool && b.dataset.tool !== store.tool.tool) {
        done = { k: keyOf(b), t: performance.now() };
        this.onToolbarClick(b);
      }
    });
    this.toolbar.addEventListener('pointerup', (e) => {
      const b = buttonOf(e);
      if (!b || b.hasAttribute('disabled') || e.button > 0 || handled(b)) return;
      done = { k: keyOf(b), t: performance.now() };
      this.onToolbarClick(b);
    });
    this.toolbar.addEventListener('click', (e) => {
      const b = buttonOf(e);
      if (b && !handled(b)) this.onToolbarClick(b);
      done = null;
    });
    this.root.querySelector('.zoom-pill')!.addEventListener('click', () => this.action('zoom-reset'));
    this.board.el.addEventListener('pointerdown', () => this.closePopover(), true);
    // A tap anywhere on the board closes the Pages panel (a drag, e.g. carrying things to a page, keeps it).
    let tapAt: { x: number; y: number; t: number } | null = null;
    this.board.el.addEventListener('pointerdown', (e) => (tapAt = { x: e.clientX, y: e.clientY, t: performance.now() }), true);
    this.board.el.addEventListener(
      'pointerup',
      (e) => {
        const tap = tapAt && Math.hypot(e.clientX - tapAt.x, e.clientY - tapAt.y) < 10 && performance.now() - tapAt.t < 600;
        // (Tapping a thing to select it keeps the panel, so it can be carried to a page.)
        if (tap && this.pages.open) setTimeout(() => !store.selection.size && this.pages.open && this.pages.close(), 0);
        tapAt = null;
      },
      true,
    );
  }

  private updatePageLabel(): void {
    const label = this.root.querySelector('.page-label') as HTMLElement | null;
    if (label) label.textContent = `${store.index + 1} / ${store.doc.pages.length}`;
  }

  /** Size the toolbar and panels for this screen (phone → 86" panel). */
  private applyScale(keepPopover = false): void {
    // The toolbar touches the bottom edge, or the top edge if chosen in Edit toolbar.
    const pos: string = tbEdge();
    this.root.dataset.tb = pos;
    const vertical = pos === 'left' || pos === 'right';
    const left = this.toolbar.querySelector('.tb-left') as HTMLElement;
    const right = this.toolbar.querySelector('.tb-right') as HTMLElement;
    // Measure the halves as they are on ONE line: in two-row mode each half is stretched to the whole screen width, so
    // measuring them then always said "too wide" and the toolbar stayed stuck in two rows (huge buttons) after the
    // screen had been narrow once, e.g. for a moment at start-up or while rotating an iPad.
    const wasStacked = this.root.classList.contains('tb-stacked');
    if (wasStacked) this.root.classList.remove('tb-stacked');
    // Sizes are unaffected by the CSS scale transform.
    const L = vertical ? left.offsetHeight : left.offsetWidth;
    const R = vertical ? right.offsetHeight : right.offsetWidth;
    const avail = vertical ? window.innerHeight : window.innerWidth;
    // One line when both halves fit at a comfortable size; otherwise the
    // action bar moves into a second row (or column) beside the tools.
    const one = L + R + 40;
    const stacked = avail / one < 0.85;
    this.root.classList.toggle('tb-stacked', stacked);
    // Buttons stay the compact size everywhere (big boards still scale them up); "Large buttons" in Settings makes them bigger.
    computeUiScale(store.settings.bigControls ? 'large' : 'small', stacked ? Math.max(L, R) + 20 : one, avail);
    // "Middle": both halves together in the middle as one bar (two centred
    // rows on narrow screens). "Sides": each half in its corner.
    const mid = tbMiddle();
    this.root.dataset.tbalign = mid ? 'middle' : 'sides';
    if (mid) {
      const k = ui(), W = window.innerWidth;
      const lx = stacked ? (W - L * k) / 2 : (W - (L + R) * k) / 2;
      left.style.left = `${Math.max(0, lx)}px`;
      right.style.left = `${Math.max(0, stacked ? (W - R * k) / 2 : lx + L * k)}px`;
      right.style.right = 'auto';
    } else {
      left.style.left = right.style.left = right.style.right = '';
    }
    // Placed freely with the Height slider: the bars float over the board at
    // that height (no strip is reserved for them).
    const free = tbFree();
    this.root.toggleAttribute('data-tbfree', free);
    if (free) this.placeBars(left, right, stacked);
    else for (const bar of [left, right]) bar.style.top = bar.style.bottom = '';
    // Toolbar at the bottom: the page fills the whole screen and the bars
    // float over it. Toolbar on top: the page starts just below the bar (it
    // is never covered), and "Teachly by Physica" stays in the top right,
    // moving under the bar only when the bar reaches that corner.
    let barBottom = 0;
    if (pos === 'top' && !free) {
      // The bar touches the top edge when it stays clear of the status bar's
      // time (left) and battery (right) on iPad / iPhone; otherwise it sits
      // just below the status bar.
      const W = window.innerWidth, clear = 190;
      const clearOfStatus = mid && !stacked && left.getBoundingClientRect().left >= clear && W - right.getBoundingClientRect().right >= clear;
      this.root.toggleAttribute('data-tbflush', clearOfStatus);
      for (const bar of [left, right]) barBottom = Math.max(barBottom, bar.getBoundingClientRect().bottom);
      const corner = this.root.querySelector('.corner') as HTMLElement | null;
      const cw = (corner?.offsetWidth ?? 120) * ui() + 24;
      const reaches = Math.max(left.getBoundingClientRect().right, right.getBoundingClientRect().right) > window.innerWidth - cw;
      this.root.style.setProperty('--corner-top', reaches ? `${Math.round(barBottom + 6)}px` : '');
      this.root.style.setProperty('--bar-end', `${Math.round(barBottom)}px`);
      this.root.style.setProperty('--board-top', `${Math.round(barBottom)}px`);
    } else {
      this.root.removeAttribute('data-tbflush');
      this.root.style.removeProperty('--corner-top');
      this.root.style.removeProperty('--bar-end');
      this.root.style.removeProperty('--board-top');
    }
    this.board.setInsets({ top: Math.round(barBottom), right: 0, bottom: 0, left: 0 });
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

  /** Height of the free toolbar: 0 = top edge, 1 = bottom edge of the screen. */
  private placeBars(left: HTMLElement, right: HTMLElement, stacked: boolean): void {
    const k = ui(), H = window.innerHeight;
    const lh = left.offsetHeight * k, rh = right.offsetHeight * k;
    const total = stacked ? lh + rh : Math.max(lh, rh);
    const y = Math.round((store.settings.tbY ?? 0) * Math.max(0, H - total));
    left.style.bottom = right.style.bottom = 'auto';
    left.style.top = `${y}px`;
    right.style.top = `${stacked ? y + lh : y}px`;
  }

  /** Put the toolbars on another edge (they glide in there). */
  private setToolbarPos(pos: 'bottom' | 'top' | 'left' | 'right'): void {
    if (pos === tbEdge() && !tbFree()) return;
    store.setSettings({ tbPos: pos, tbY: undefined });
    this.applyScale(true);
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

  private zoomShown = '';
  private zoomTimer = 0;

  /**
   * The zoom label appears while the board is being zoomed or moved and
   * fades away 2 seconds after the last change (it stays out of the way
   * while writing). `show` is false for a page change or start-up.
   */
  private updateZoom(show: boolean): void {
    const pill = this.root.querySelector('.zoom-pill') as HTMLElement;
    const z = Math.round((store.camera.z / this.board.fitZ) * 100);
    pill.hidden = this.board.isHome;
    pill.textContent = z === 100 ? '⟲  Back to page' : `${z}%  ·  Whole page`;
    // Only a real zoom / move shows it again (not a page change or re-fit).
    const key = `${store.page.id}:${store.camera.z.toFixed(3)}:${Math.round(store.camera.x)}:${Math.round(store.camera.y)}`;
    const changed = key !== this.zoomShown;
    this.zoomShown = key;
    if (!show || !changed || pill.hidden) {
      if (!show) pill.classList.remove('show');
      return;
    }
    pill.classList.add('show');
    clearTimeout(this.zoomTimer);
    this.zoomTimer = window.setTimeout(() => pill.classList.remove('show'), 2000);
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
        // One layer at a time: an open menu, then the Pages panel (when nothing is selected), then the selection.
        if (this.popover) this.closePopover();
        else if (this.pages.open && !store.selection.size) this.pages.close();
        else store.clearSelection();
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
        if (f.type === 'application/pdf') {
          const at = await this.pdfPlace(f);
          if (at !== null) await this.withProgress('Opening PDF', (p) => importPdf(this.board, f, p, at));
        }
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
  void saveNow()
    .catch(() => {
      /* storage full or unavailable: the session copy still restores the lesson */
    })
    .finally(() => location.reload());
  return true;
}

