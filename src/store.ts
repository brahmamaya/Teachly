import { uid } from './geometry';
import type { BgPattern, Camera, Doc, El, EraserMode, Page, ShapeKind, ToolId } from './types';

export interface Settings {
  penOnly: boolean;
  palmErase: boolean;
  uiSize: 'small' | 'normal' | 'large';
  /** Many students write at once: every touch draws (no pinch zoom). */
  multiWrite: boolean;
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
  laserColor: string;
  tapeColor: string;
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
    uiSize: 'normal',
    multiWrite: false,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return defaults;
}

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
    color: '#ffffff',
    size: 4,
    hlColor: '#facc15',
    hlSize: 22,
    shape: 'rect',
    shapeColor: '#ffffff',
    shapeSize: 4,
    shapeFill: null,
    eraserMode: 'point',
    eraserSize: 30,
    fontSize: 32,
    fillColor: '#3b82f6',
    laserColor: '#ef4444',
    tapeColor: '#f59e0b',
  };

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private listeners = new Map<string, Set<Listener>>();

  on(evt: 'doc' | 'page' | 'tool' | 'selection' | 'settings' | 'camera', fn: Listener): () => void {
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
    let c = this.cameras.get(this.page.id);
    if (!c) this.cameras.set(this.page.id, (c = { x: 0, y: 0, z: 1 }));
    return c;
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
    if (this.undoStack.length > 300) this.undoStack.shift();
    this.redoStack = [];
    const pageChanged = index !== this.index;
    this.doc = { ...this.doc, pages };
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
    this.doc = { ...this.doc, pages: s.pages };
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

  goTo(index: number): void {
    index = Math.max(0, Math.min(index, this.doc.pages.length - 1));
    if (index === this.index) return;
    this.index = index;
    this.clearSelection();
    this.emit('page');
    this.emit('doc');
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

  movePage(from: number, to: number): void {
    if (to < 0 || to >= this.doc.pages.length) return;
    const pages = this.doc.pages.slice();
    const [p] = pages.splice(from, 1);
    pages.splice(to, 0, p);
    this.commit(pages, from === this.index ? to : this.index);
  }

  loadDoc(doc: Doc): void {
    this.doc = doc.id ? doc : { ...doc, id: uid() };
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
    this.selection = new Set(ids);
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
