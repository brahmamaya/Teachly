import { bbox } from './geometry';
import { Instruments } from './instruments';
import { PAGE } from './page';
import { drawBackground, drawEls, setAssetLoadCallback } from './renderer';
import { store } from './store';
import type { Camera, El, Rect, ToolId } from './types';

export interface Ptr {
  id: number;
  /** World coordinates */
  x: number;
  y: number;
  /** Screen (CSS px, relative to board) */
  sx: number;
  sy: number;
  p: number;
  type: string;
  width: number;
  height: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  button: number;
  /** Intermediate samples since the last event (world coords + pressure). */
  samples: [number, number, number][];
  /** Predicted future samples (for low-latency wet ink). */
  predicted: [number, number, number][];
  time: number;
}

export interface Tool {
  cursor?: string;
  down(p: Ptr): void;
  move(p: Ptr): void;
  up(p: Ptr): void;
  cancel(): void;
  hover?(p: Ptr | null): void;
  /** Draw transient UI in world space. Return true to keep animating. */
  drawOverlay?(ctx: CanvasRenderingContext2D): boolean | void;
  /** Draw transient UI in screen space. */
  drawScreen?(ctx: CanvasRenderingContext2D): boolean | void;
  /** Elements to hide on the ink layer (e.g. during transform preview). */
  hidden?(): Set<string> | null;
  /** Extra world-space drawing on the ink layer (e.g. transform preview). */
  drawInk?(ctx: CanvasRenderingContext2D): void;
  onActivate?(): void;
  onDeactivate?(): void;
}

type Layer = 'bg' | 'ink' | 'overlay';

export class Board {
  readonly el: HTMLElement;
  readonly bg: HTMLCanvasElement;
  readonly ink: HTMLCanvasElement;
  readonly overlay: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private inkCtx: CanvasRenderingContext2D;
  private ovCtx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  dpr = 1;
  tools = new Map<ToolId, Tool>();
  /** Tool temporarily overriding the active one (palm eraser, space-pan). */
  private override: Tool | null = null;
  readonly instruments: Instruments;
  /** Extra screen-space overlay painters (spotlight, etc.). */
  /** Elements hidden from the ink layer (e.g. while being edited). */
  hiddenIds = new Set<string>();
  screenPainters = new Set<(ctx: CanvasRenderingContext2D) => boolean | void>();
  private dirty = new Set<Layer>();
  private raf = 0;
  private animating = false;

  // Gesture state
  private pointers = new Map<number, Ptr>();
  private routed = new Map<number, 'tool' | 'gesture' | 'pan' | 'instrument' | 'override'>();
  private gesture: { ids: [number, number]; startDist: number; startAngle: number; cam: Camera; wx: number; wy: number } | null = null;
  private panStart: { sx: number; sy: number; cam: Camera } | null = null;
  spaceDown = false;
  private sawPen = false;
  private lastHover: Ptr | null = null;

  constructor(container: HTMLElement) {
    this.el = container;
    const mk = (cls: string, desync: boolean) => {
      const c = document.createElement('canvas');
      c.className = `layer ${cls}`;
      container.appendChild(c);
      const ctx = c.getContext('2d', desync ? { desynchronized: true } : undefined)!;
      return [c, ctx] as const;
    };
    [this.bg, this.bgCtx] = mk('bg', false);
    [this.ink, this.inkCtx] = mk('ink', false);
    [this.overlay, this.ovCtx] = mk('overlay', true);
    this.instruments = new Instruments(this);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    setAssetLoadCallback(() => {
      this.inkState = null;
      this.invalidate('ink');
    });
    this.bindEvents();

    store.on('doc', () => this.invalidate('bg', 'ink', 'overlay'));
    store.on('page', () => {
      this.cancelAll();
      this.ensureCam();
      this.invalidate('bg', 'ink', 'overlay');
    });
    store.on('doc', () => this.ensureCam());
    store.on('camera', () => this.invalidate('bg', 'ink', 'overlay'));
    store.on('selection', () => this.invalidate('overlay'));
    store.on('tool', () => {
      this.updateCursor();
      this.invalidate('overlay');
    });
  }

  get tool(): Tool {
    return this.override ?? this.tools.get(store.tool.tool)!;
  }

  get cam(): Camera {
    return store.camera;
  }

  // ---- coordinates ---------------------------------------------------------

  toWorld(sx: number, sy: number): [number, number] {
    const c = this.cam;
    return [sx / c.z + c.x, sy / c.z + c.y];
  }

  toScreen(x: number, y: number): [number, number] {
    const c = this.cam;
    return [(x - c.x) * c.z, (y - c.y) * c.z];
  }

  viewRect(): Rect {
    const c = this.cam;
    return { x: c.x, y: c.y, w: this.w / c.z, h: this.h / c.z };
  }

  /** World units per screen pixel. */
  get px(): number {
    return 1 / this.cam.z;
  }

  // ---- camera ----------------------------------------------------------------

  /** Screen space kept free around the page (toolbars, clock). Set by the app. */
  insets = { top: 12, right: 12, bottom: 12, left: 12 };

  /** Zoom at which the whole page just fits on screen. */
  get fitZ(): number {
    const i = this.insets;
    return Math.max(0.05, Math.min((this.w - i.left - i.right) / PAGE.w, (this.h - i.top - i.bottom) / PAGE.h));
  }

  /** Camera showing the whole page, centred in the free area. */
  private fitCam(): Camera {
    const z = this.fitZ, i = this.insets;
    const cx = i.left + (this.w - i.left - i.right) / 2;
    const cy = i.top + (this.h - i.top - i.bottom) / 2;
    return { x: PAGE.x + PAGE.w / 2 - cx / z, y: PAGE.y + PAGE.h / 2 - cy / z, z };
  }

  get isFit(): boolean {
    return Math.abs(this.cam.z - this.fitZ) < 1e-3;
  }

  /**
   * The board never drifts: you cannot zoom out past the page, and when
   * zoomed in you can only move around inside it.
   */
  setCam(c: Camera): void {
    const fit = this.fitCam();
    // Locked page (the default): it never moves or zooms when touched.
    if (!store.settings.allowZoom) {
      if (!this.isFit || store.camera.x !== fit.x || store.camera.y !== fit.y) store.setCamera(fit);
      return;
    }
    const z = Math.max(fit.z, Math.min(fit.z * 6, c.z));
    if (z - fit.z < 1e-3) {
      store.setCamera(fit);
      return;
    }
    const vw = this.w / z, vh = this.h / z;
    const x = Math.max(PAGE.x - 40 / z, Math.min(PAGE.x + PAGE.w - vw + 40 / z, c.x));
    const y = Math.max(PAGE.y - 40 / z, Math.min(PAGE.y + PAGE.h - vh + 40 / z, c.y));
    store.setCamera({ x, y, z });
  }

  /** Give a page that has never been shown the fitted view. */
  ensureCam(): void {
    if (!store.cameras.has(store.page.id) || store.camera.z < this.fitZ - 1e-3 || (!store.settings.allowZoom && !this.isFit)) store.setCamera(this.fitCam());
  }

  panBy(dsx: number, dsy: number): void {
    const c = this.cam;
    this.setCam({ x: c.x - dsx / c.z, y: c.y - dsy / c.z, z: c.z });
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const c = this.cam;
    const z = c.z * factor;
    const [wx, wy] = this.toWorld(sx, sy);
    this.setCam({ x: wx - sx / z, y: wy - sy / z, z });
  }

  /** Back to the whole page. */
  fitPage(): void {
    store.setCamera(this.fitCam());
  }

  centerOn(r: Rect): void {
    const c = this.cam;
    this.setCam({ x: r.x + r.w / 2 - this.w / 2 / c.z, y: r.y + r.h / 2 - this.h / 2 / c.z, z: c.z });
  }

  // ---- rendering -------------------------------------------------------------

  resize(): void {
    const r = this.el.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    // Sharp on retina phones, but cap the pixel count so 4K / 86" panels
    // (three full-screen layers) stay fast.
    const area = Math.max(1, r.width * r.height);
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5, Math.sqrt(9_000_000 / area)));
    for (const c of [this.bg, this.ink, this.overlay]) {
      c.width = Math.round(r.width * this.dpr);
      c.height = Math.round(r.height * this.dpr);
      c.style.width = `${r.width}px`;
      c.style.height = `${r.height}px`;
    }
    // Resizing a canvas wipes it: draw every layer from scratch.
    this.inkState = null;
    this.bgKey = '';
    // New screen size: every page goes back to its fitted view.
    store.cameras.clear();
    if (this.w && this.h) this.ensureCam();
    this.invalidate('bg', 'ink', 'overlay');
  }

  invalidate(...layers: Layer[]): void {
    for (const l of layers) this.dirty.add(l);
    if (!this.raf) this.raf = requestAnimationFrame(() => this.frame());
  }

  /** Render immediately (used for low-latency wet ink). */
  flushOverlay(): void {
    this.renderOverlay();
    this.dirty.delete('overlay');
  }

  private frame(): void {
    this.raf = 0;
    if (this.dirty.has('bg')) this.renderBg();
    if (this.dirty.has('ink')) this.renderInk();
    if (this.dirty.has('overlay') || this.animating) this.renderOverlay();
    this.dirty.clear();
    if (this.animating) this.invalidate('overlay');
  }

  private worldTransform(ctx: CanvasRenderingContext2D): void {
    const c = this.cam, d = this.dpr;
    ctx.setTransform(d * c.z, 0, 0, d * c.z, -c.x * c.z * d, -c.y * c.z * d);
  }

  private bgKey = '';
  /** What the ink layer currently shows, so new strokes can be added on top. */
  private inkState: { els: El[]; cam: Camera; w: number; h: number; dpr: number } | null = null;

  private renderBg(): void {
    const p = store.page, c = this.cam;
    // The background only changes with colour, pattern, view or size:
    // skip the redraw (and its shadow blur) after every stroke.
    const key = `${p.bg}|${p.pattern}|${c.x}|${c.y}|${c.z}|${this.w}|${this.h}|${this.dpr}`;
    if (key === this.bgKey) return;
    this.bgKey = key;
    const ctx = this.bgCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackground(ctx, p.bg, p.pattern, c, this.w, this.h, PAGE);
  }

  renderInk(): void {
    const ctx = this.inkCtx;
    const tool = this.tool;
    const hidden = tool.hidden?.() ?? null;
    const skip = this.hiddenIds.size ? new Set([...(hidden ?? []), ...this.hiddenIds]) : hidden ?? undefined;
    const els = store.page.els;
    const cam = this.cam;
    // Fast path: when strokes were only added (the usual case while writing),
    // draw just the new ones on top instead of the whole page again.
    const prev = this.inkState;
    let from = 0;
    if (!skip && prev && prev.cam === cam && prev.w === this.ink.width && prev.h === this.ink.height && prev.dpr === this.dpr && els.length >= prev.els.length) {
      from = prev.els.length;
      for (let i = 0; i < from; i++) {
        if (els[i] !== prev.els[i]) {
          from = 0;
          break;
        }
      }
      if (from === 0 && prev.els.length) from = -1;
    } else from = -1;
    if (from <= 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.ink.width, this.ink.height);
      from = 0;
    }
    this.worldTransform(ctx);
    // Everything lives on the page: clip to its rectangle.
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAGE.x, PAGE.y, PAGE.w, PAGE.h);
    ctx.clip();
    drawEls(ctx, from ? els.slice(from) : els, this.viewRect(), skip);
    tool.drawInk?.(ctx);
    ctx.restore();
    this.inkState = skip ? null : { els, cam, w: this.ink.width, h: this.ink.height, dpr: this.dpr };
  }

  private renderOverlay(): void {
    const ctx = this.ovCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    let anim = false;
    this.worldTransform(ctx);
    if (this.instruments.draw(ctx)) anim = true;
    for (const t of new Set([...this.tools.values(), this.tool])) {
      if (t.drawOverlay?.(ctx)) anim = true;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const t of new Set([...this.tools.values(), this.tool])) {
      if (t.drawScreen?.(ctx)) anim = true;
    }
    for (const painter of this.screenPainters) if (painter(ctx)) anim = true;
    this.animating = anim;
  }

  // ---- input -----------------------------------------------------------------

  private makePtr(e: PointerEvent): Ptr {
    const r = this.el.getBoundingClientRect();
    const conv = (ev: PointerEvent): [number, number, number] => {
      const [x, y] = this.toWorld(ev.clientX - r.left, ev.clientY - r.top);
      return [x, y, this.pressure(ev)];
    };
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const [x, y] = this.toWorld(sx, sy);
    const co = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const pr = typeof e.getPredictedEvents === 'function' ? e.getPredictedEvents() : [];
    return {
      id: e.pointerId,
      x,
      y,
      sx,
      sy,
      p: this.pressure(e),
      type: e.pointerType,
      width: e.width,
      height: e.height,
      shift: e.shiftKey,
      alt: e.altKey,
      ctrl: e.ctrlKey || e.metaKey,
      button: e.button,
      samples: co.length ? co.map(conv) : [[x, y, this.pressure(e)]],
      predicted: pr.map(conv),
      time: e.timeStamp,
    };
  }

  private pressure(e: PointerEvent): number {
    if (e.pointerType === 'pen') return e.pressure || 0.5;
    return 0.5;
  }

  private isPalm(p: Ptr): boolean {
    return store.settings.palmErase && p.type === 'touch' && Math.max(p.width, p.height) >= 45;
  }

  private bindEvents(): void {
    const el = this.overlay;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    // pointerrawupdate delivers pen samples as soon as they arrive instead of
    // once per frame, which takes a few milliseconds off the ink latency.
    const raw = 'onpointerrawupdate' in window;
    el.addEventListener('pointermove', (e) => {
      if (raw && this.routed.has(e.pointerId)) return;
      this.onMove(e);
    });
    if (raw) {
      el.addEventListener('pointerrawupdate' as 'pointermove', (e) => {
        if (this.routed.has(e.pointerId)) this.onMove(e);
      });
    }
    el.addEventListener('pointerup', (e) => this.onUp(e, false));
    el.addEventListener('pointercancel', (e) => this.onUp(e, true));
    el.addEventListener('pointerleave', () => {
      this.lastHover = null;
      this.tool.hover?.(null);
      this.invalidate('overlay');
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = this.el.getBoundingClientRect();
        const sx = e.clientX - r.left, sy = e.clientY - r.top;
        if (e.ctrlKey || e.metaKey) {
          this.zoomAt(sx, sy, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0025)));
        } else {
          const k = e.deltaMode ? 30 : 1;
          this.panBy(-(e.shiftKey ? e.deltaY : e.deltaX) * k, -(e.shiftKey ? 0 : e.deltaY) * k);
        }
      },
      { passive: false },
    );
  }

  private touchCount(): number {
    let n = 0;
    for (const p of this.pointers.values()) if (p.type === 'touch') n++;
    return n;
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    this.overlay.setPointerCapture(e.pointerId);
    const p = this.makePtr(e);
    this.pointers.set(p.id, p);

    // Two-finger gesture (pinch / pan / rotate-free zoom).
    // (Off in "many writers" mode: every finger draws, like Note 3's group writing.)
    const multi = store.settings.multiWrite;
    if (!multi && p.type === 'touch' && this.touchCount() === 2) {
      const ids = [...this.pointers.values()].filter((q) => q.type === 'touch').map((q) => q.id) as [number, number];
      for (const id of ids) {
        const r = this.routed.get(id);
        if (r === 'tool' || r === 'override') this.cancelTool();
        this.routed.set(id, 'gesture');
      }
      this.startGesture(ids);
      return;
    }
    if (this.gesture && p.type === 'touch') {
      this.routed.set(p.id, 'gesture');
      return;
    }

    // Middle button, space+drag, or finger when pen-only → pan.
    // Once a stylus has been used, fingers and palms only move the board
    // (palm rejection, like a real tablet).
    if (p.type === 'pen') this.sawPen = true;
    if (p.button === 1 || this.spaceDown || (!multi && (store.settings.penOnly || this.sawPen) && p.type === 'touch')) {
      this.routed.set(p.id, 'pan');
      this.panStart = { sx: p.sx, sy: p.sy, cam: { ...this.cam } };
      this.el.classList.add('panning');
      return;
    }

    if (this.instruments.down(p)) {
      this.routed.set(p.id, 'instrument');
      return;
    }

    if (this.isPalm(p) && store.tool.tool !== 'eraser') {
      this.override = this.tools.get('eraser')!;
      (this.override as unknown as { palm: boolean }).palm = true;
      this.routed.set(p.id, 'override');
      this.override.down(p);
      return;
    }
    // Pen eraser end / barrel button → eraser.
    if (p.type === 'pen' && (e.button === 5 || e.buttons === 32)) {
      this.override = this.tools.get('eraser')!;
      this.routed.set(p.id, 'override');
      this.override.down(p);
      return;
    }

    this.routed.set(p.id, 'tool');
    this.tool.down(p);
    this.invalidate('overlay');
  }

  private onMove(e: PointerEvent): void {
    const p = this.makePtr(e);
    const route = this.routed.get(p.id);
    if (!route) {
      this.lastHover = p;
      this.instruments.hover(p);
      this.tool.hover?.(p);
      this.invalidate('overlay');
      return;
    }
    this.pointers.set(p.id, p);
    switch (route) {
      case 'gesture':
        this.updateGesture();
        break;
      case 'pan':
        if (this.panStart) {
          const c = this.panStart.cam;
          this.setCam({ x: c.x - (p.sx - this.panStart.sx) / c.z, y: c.y - (p.sy - this.panStart.sy) / c.z, z: c.z });
        }
        break;
      case 'instrument':
        this.instruments.move(p);
        break;
      default:
        this.tool.move(p);
    }
  }

  private onUp(e: PointerEvent, cancelled: boolean): void {
    const p = this.makePtr(e);
    const route = this.routed.get(p.id);
    this.pointers.delete(p.id);
    this.routed.delete(p.id);
    switch (route) {
      case 'gesture':
        this.gesture = null;
        break;
      case 'pan':
        this.panStart = null;
        this.el.classList.remove('panning');
        break;
      case 'instrument':
        this.instruments.up(p);
        break;
      case 'tool':
      case 'override':
        if (cancelled) this.tool.cancel();
        else this.tool.up(p);
        if (route === 'override' && ![...this.routed.values()].includes('override')) {
          (this.override as unknown as { palm?: boolean }).palm = false;
          this.override = null;
        }
        break;
    }
    this.invalidate('overlay');
  }

  private startGesture(ids: [number, number]): void {
    const a = this.pointers.get(ids[0])!, b = this.pointers.get(ids[1])!;
    const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2;
    const [wx, wy] = this.toWorld(mx, my);
    this.gesture = {
      ids,
      startDist: Math.hypot(b.sx - a.sx, b.sy - a.sy) || 1,
      startAngle: Math.atan2(b.sy - a.sy, b.sx - a.sx),
      cam: { ...this.cam },
      wx,
      wy,
    };
  }

  private updateGesture(): void {
    const g = this.gesture;
    if (!g) return;
    const a = this.pointers.get(g.ids[0]), b = this.pointers.get(g.ids[1]);
    if (!a || !b) return;
    const d = Math.hypot(b.sx - a.sx, b.sy - a.sy) || 1;
    const z = Math.max(0.1, Math.min(8, g.cam.z * (d / g.startDist)));
    const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2;
    this.setCam({ x: g.wx - mx / z, y: g.wy - my / z, z });
  }

  private cancelTool(): void {
    this.tool.cancel();
    if (this.override) {
      (this.override as unknown as { palm?: boolean }).palm = false;
      this.override = null;
    }
  }

  cancelAll(): void {
    this.cancelTool();
    this.pointers.clear();
    this.routed.clear();
    this.gesture = null;
    this.panStart = null;
  }

  updateCursor(): void {
    const t = store.tool.tool;
    this.el.dataset.activeTool = t;
    this.overlay.style.cursor = this.spaceDown ? 'grab' : this.tool.cursor ?? 'crosshair';
  }

  get hoverPtr(): Ptr | null {
    return this.lastHover;
  }

  /** World-space selection bounds of the current selection. */
  selectionBounds(): Rect | null {
    const els = store.selectedEls();
    if (!els.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const e of els) {
      const b = bbox(e);
      x1 = Math.min(x1, b.x);
      y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w);
      y2 = Math.max(y2, b.y + b.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
}
