import { refreshAngles } from './subjects/angles';
import { fitIntoPage, regroup, uid } from './geometry';
import { setPageShape } from './page';
import type { BgPattern, Camera, Doc, El, EraserMode, Page, ShapeKind, ToolId } from './types';

/** A saved pen: kind, colour, thickness and steadiness ("My pens" in the pen menu). */
export interface PenPreset {
  style: 'pen' | 'brush' | 'calligraphy' | 'highlighter';
  color: string;
  size: number;
  smooth: number;
}

export interface Settings {
  /** Four saved pens (null = empty slot). */
  penPresets?: (PenPreset | null)[];
  penOnly: boolean;
  palmErase: boolean;
  /** Hold the pen still at the end of a line to turn it into a neat shape (off: ink stays exactly as written). */
  holdShapes: boolean;
  /** Draw the line a little ahead of the pen using the browser's predicted points (less trailing on slow boards). Off unless chosen. */
  inkPredict?: boolean;
  /** A quick scribble over writing erases it. */
  scribbleErase: boolean;
  uiSize: 'xsmall' | 'small' | 'normal' | 'large';
  /** Many students write at once: every touch draws (no pinch zoom). */
  multiWrite: boolean;
  /** Pinch / wheel zoom. Off = the page is locked in place. */
  allowZoom: boolean;
  /** Where the toolbars sit. */
  tbPos: 'bottom' | 'top' | 'left' | 'right';
  /** Toolbar buttons the teacher switched off (Menu → Edit toolbar). */
  tbHidden: string[];
  /** Extra buttons the teacher switched on (off unless chosen, e.g. Record lesson). */
  tbShown: string[];
  /** Buttons on the floating hexagon (up to 6; none = no hexagon). */
  hexItems: string[];
  /** Where the hexagon sits (centre, as fractions of the screen). */
  hexPos: { x: number; y: number } | null;
  /** Hexagon size (radius in px). */
  hexSize: number;
  /** Toolbar placed anywhere up or down: 0 = top edge, 1 = bottom edge (missing = stuck to its edge). */
  tbY?: number;
  /** Toolbar halves: together in the middle, or each in its corner. */
  tbAlign?: 'middle' | 'sides';
  /** Floating hexagon opacity, 0.2 to 1. */
  hexAlpha?: number;
  /** Chosen chapter with ready-made pieces (see subjects/catalog.ts); none = no subject. */
  subject?: string | null;
  /** Bigger toolbar buttons (about 1.5x), for classroom boards and fingers; off by default (compact). */
  bigControls?: boolean;
  /** The strip of small symbols for the chosen chapter is shown next to the toolbar. */
  subjectDock?: boolean;
  /** The simple toolbar was applied once (so a teacher's own later choice is never overwritten). */
  tbSimpleDone?: boolean;
  /** Look of My notebooks: dark (default) or light. */
  libTheme?: 'light' | 'dark';
}

export interface ToolState {
  tool: ToolId;
  penStyle: 'pen' | 'brush' | 'calligraphy' | 'highlighter';
  color: string;
  size: number;
  hlColor: string;
  hlSize: number;
  shape: ShapeKind;
  /** Style used for new shapes (remembered from the last edit). */
  shapeColor: string;
  shapeSize: number;
  shapeFill: string | null;
  eraserMode: EraserMode;
  eraserSize: number;
  fontSize: number;
  /** Paint bucket colour ('none' clears a fill). */
  fillColor: string;
  /** Paint-bucket see-through: 0.1 (faint) … 1 (solid). */
  fillOpacity: number;
  laserColor: string;
  /** Seconds the laser stays fully bright after lifting (then a 0.7 s fade). */
  laserStay: number;
  /** Line steadying while writing: 0 exact (none), 1 light, 2 strong. */
  inkSmooth: number;
  /** The laser blinks (pulses) while it is shown. */
  laserBlink: boolean;
  tapeColor: string;
  /** Slide mode (✋): the board can be slid / zoomed while writing. */
  slide: boolean;
}

type Listener = () => void;

interface Snapshot {
  pages: Page[];
  index: number;
}

const SETTINGS_KEY = 'teachly.settings';

function loadSettings(): Settings {
  const defaults: Settings = {
    penOnly: false,
    palmErase: true,
    holdShapes: false,
    scribbleErase: true,
    uiSize: 'normal',
    multiWrite: false,
    allowZoom: false,
    tbPos: 'bottom',
    tbHidden: [...SIMPLE_HIDDEN],
    tbShown: [],
    tbSimpleDone: true,
    hexItems: [],
    hexPos: null,
    hexSize: 28,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Once: a toolbar nobody changed becomes the simple one.
      if (!saved.tbSimpleDone) {
        saved.tbSimpleDone = true;
        if (!saved.tbHidden?.length) saved.tbHidden = [...SIMPLE_HIDDEN];
      }
      return { ...defaults, ...saved };
    }
  } catch {
    /* storage unavailable */
  }
  return defaults;
}

/** Buttons the simple toolbar leaves off (all of them stay reachable from the Tools menu and Edit toolbar). */
export const SIMPLE_HIDDEN = ['fill', 'tape', 'laser', 'timer', 'poll', 'graph'];

export function newPage(bg = '#000000', pattern: BgPattern = 'none'): Page {
  return { id: uid(), bg, pattern, els: [] };
}

export class Store {
  doc: Doc = { version: 1, id: uid(), title: 'My notebook', pages: [newPage()] };
  index = 0;
  cameras = new Map<string, Camera>();
  selection = new Set<string>();
  settings: Settings = loadSettings();
  tool: ToolState = {
    tool: 'pen',
    penStyle: 'pen',
    color: '#f2f2f0',
    size: 4,
    hlColor: '#facc15',
    hlSize: 22,
    shape: 'rect',
    shapeColor: '#f2f2f0',
    shapeSize: 4,
    shapeFill: null,
    eraserMode: 'point',
    eraserSize: 30,
    fontSize: 22,
    fillColor: '#3b82f6',
    fillOpacity: 1,
    laserColor: '#ef4444',
    laserStay: 0.8,
    inkSmooth: 0,
    laserBlink: false,
    tapeColor: '#f59e0b',
    slide: false,
  };

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private listeners = new Map<string, Set<Listener>>();

  on(evt: 'doc' | 'page' | 'leave' | 'nav' | 'tool' | 'selection' | 'settings' | 'camera', fn: Listener): () => void {
    let set = this.listeners.get(evt);
    if (!set) this.listeners.set(evt, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(evt: string): void {
    this.listeners.get(evt)?.forEach((fn) => fn());
  }

  get page(): Page {
    return this.doc.pages[this.index];
  }

  get camera(): Camera {
    // A page never shown yet has no camera; the board gives it the fitted
    // view (ensureCam). Reading it must not invent one for that page.
    return this.cameras.get(this.page.id) ?? { x: 0, y: 0, z: 1 };
  }

  setCamera(c: Camera): void {
    this.cameras.set(this.page.id, c);
    this.emit('camera');
  }

  private snapshot(): Snapshot {
    return { pages: this.doc.pages, index: this.index };
  }

  /** Record current state for undo, then apply a change to pages. */
  commit(pages: Page[], index = this.index): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 150) this.undoStack.shift();
    this.redoStack = [];
    const pageChanged = index !== this.index;
    // Angle marks follow a stretched wedge (only on pages that changed).
    const fixed = pages.map((p, i) => {
      if (p === this.doc.pages[i]) return p;
      const els = refreshAngles(p.els);
      return els === p.els ? p : { ...p, els };
    });
    this.doc = { ...this.doc, pages: fixed, rev: (this.doc.rev ?? 0) + 1 };
    this.index = Math.max(0, Math.min(index, pages.length - 1));
    this.pruneSelection();
    this.emit('doc');
    if (pageChanged) this.emit('page');
  }

  /** Replace the element list on the current page (undoable). */
  setEls(els: El[]): void {
    const pages = this.doc.pages.slice();
    pages[this.index] = { ...this.page, els };
    this.commit(pages);
  }

  addEls(els: El[]): void {
    if (els.length) this.setEls([...this.page.els, ...els]);
  }

  replaceEls(removeIds: Set<string>, add: El[]): void {
    this.setEls([...this.page.els.filter((e) => !removeIds.has(e.id)), ...add]);
  }

  /** Update elements in place (keeping z-order) via a mapping function. */
  mapEls(ids: Set<string>, fn: (e: El) => El): void {
    this.setEls(this.page.els.map((e) => (ids.has(e.id) ? fn(e) : e)));
  }

  updatePage(patch: Partial<Page>): void {
    const pages = this.doc.pages.slice();
    pages[this.index] = { ...this.page, ...patch };
    this.commit(pages);
  }

  /** Rename the open notebook (saved like any other change). */
  setTitle(title: string): void {
    if (title === this.doc.title) return;
    this.doc = { ...this.doc, title, rev: (this.doc.rev ?? 0) + 1 };
    this.emit('doc');
  }

  /** Keep only the most recent undo steps (memory housekeeping). */
  trimHistory(keep: number): void {
    if (this.undoStack.length > keep) this.undoStack.splice(0, this.undoStack.length - keep);
    if (this.redoStack.length > keep) this.redoStack.splice(0, this.redoStack.length - keep);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(this.snapshot());
    this.restore(s);
  }

  redo(): void {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(this.snapshot());
    this.restore(s);
  }

  private restore(s: Snapshot): void {
    const pageChanged = s.index !== this.index || s.pages[s.index]?.id !== this.page.id;
    // Undo / redo is a change too: it gets a newer revision, so it is saved as the latest state.
    this.doc = { ...this.doc, pages: s.pages, rev: (this.doc.rev ?? 0) + 1 };
    this.index = Math.min(s.index, s.pages.length - 1);
    this.pruneSelection();
    this.emit('doc');
    if (pageChanged) this.emit('page');
  }

  private pruneSelection(): void {
    if (!this.selection.size) return;
    const ids = new Set(this.page.els.map((e) => e.id));
    let changed = false;
    for (const id of this.selection) {
      if (!ids.has(id)) {
        this.selection.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit('selection');
  }

  /**
   * Show another page. 'leave' goes out first, while the old page is still
   * the current one, so anything being typed is put on the page it was
   * typed on. Changing the page does not change the document: nothing to save.
   */
  goTo(index: number): void {
    index = Math.max(0, Math.min(index, this.doc.pages.length - 1));
    if (index === this.index) return;
    this.emit('leave');
    this.index = index;
    this.clearSelection();
    this.emit('page');
    this.emit('nav');
  }

  addPage(after = this.index, page?: Page): void {
    const p = page ?? newPage(this.page.bg, this.page.pattern);
    const pages = this.doc.pages.slice();
    pages.splice(after + 1, 0, p);
    this.clearSelection();
    this.commit(pages, after + 1);
  }

  duplicatePage(i = this.index): void {
    const src = this.doc.pages[i];
    this.addPage(i, { ...src, id: uid(), els: src.els.map((e) => ({ ...e, id: uid() })) });
  }

  deletePage(i = this.index): void {
    let pages = this.doc.pages.filter((_, k) => k !== i);
    if (!pages.length) pages = [newPage()];
    this.clearSelection();
    this.commit(pages, Math.min(i, pages.length - 1));
  }

  /**
   * Move elements from the current page onto another page (one undo step:
   * undo puts them back on the first page). Their ids, look, grouping and
   * pictures stay as they are; the whole group lands inside the new page.
   * Returns how many were moved.
   */
  moveElsToPage(ids: string[], to: number): number {
    const from = this.index;
    // `to` equal to the number of pages means "a new page at the end" (one undo step for both).
    if (to === from || to < 0 || to > this.doc.pages.length) return 0;
    const want = new Set(ids);
    const moving = this.page.els.filter((e) => want.has(e.id) && !e.locked);
    if (!moving.length) return 0;
    const placed = fitIntoPage(moving);
    const pages = this.doc.pages.slice();
    if (to === pages.length) pages.push(newPage(pages[from].bg, pages[from].pattern));
    pages[from] = { ...pages[from], els: pages[from].els.filter((e) => !want.has(e.id) || e.locked) };
    pages[to] = { ...pages[to], els: [...pages[to].els, ...placed] };
    this.selection.clear();
    this.emit('selection');
    this.commit(pages, from);
    return moving.length;
  }

  /**
   * Copy things to another page (`to` = number of pages: a new page at the end). The originals stay; the copies
   * are new things (new ids, own groups) in the same place, kept inside the page. One undo step. Returns how many.
   */
  copyElsToPage(ids: string[], to: number): number {
    const from = this.index;
    if (to === from || to < 0 || to > this.doc.pages.length) return 0;
    const want = new Set(ids);
    const src = this.page.els.filter((e) => want.has(e.id));
    if (!src.length) return 0;
    const copies = fitIntoPage(regroup(src.map((e) => ({ ...structuredClone(e), id: uid() }) as El)));
    const pages = this.doc.pages.slice();
    if (to === pages.length) pages.push(newPage(pages[from].bg, pages[from].pattern));
    pages[to] = { ...pages[to], els: [...pages[to].els, ...copies] };
    this.commit(pages, from);
    return copies.length;
  }

  movePage(from: number, to: number): void {
    if (to < 0 || to >= this.doc.pages.length) return;
    const pages = this.doc.pages.slice();
    const [p] = pages.splice(from, 1);
    pages.splice(to, 0, p);
    this.commit(pages, from === this.index ? to : this.index);
  }

  loadDoc(doc: Doc): void {
    this.emit('leave');
    this.doc = doc.id ? doc : { ...doc, id: uid() };
    setPageShape(doc.orient === 'portrait' ? 4 / 3 : null);
    this.index = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.cameras.clear();
    this.selection.clear();
    this.emit('doc');
    this.emit('page');
    this.emit('selection');
  }

  select(ids: Iterable<string>): void {
    // A piece of a group (a graph, a 3-D shape) brings the whole group.
    const set = new Set(ids);
    const groups = new Set<string>();
    for (const e of this.page.els) if (e.group && set.has(e.id)) groups.add(e.group);
    if (groups.size) for (const e of this.page.els) if (e.group && groups.has(e.group)) set.add(e.id);
    this.selection = set;
    this.emit('selection');
  }

  clearSelection(): void {
    if (!this.selection.size) return;
    this.selection.clear();
    this.emit('selection');
  }

  selectedEls(): El[] {
    return this.page.els.filter((e) => this.selection.has(e.id));
  }

  setTool(patch: Partial<ToolState>): void {
    if (patch.tool && patch.tool !== this.tool.tool && patch.tool !== 'select') this.clearSelection();
    Object.assign(this.tool, patch);
    this.emit('tool');
  }

  setSettings(patch: Partial<Settings>): void {
    Object.assign(this.settings, patch);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
    this.emit('settings');
  }
}

export const store = new Store();
