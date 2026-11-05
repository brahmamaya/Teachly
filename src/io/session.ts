import type { Board } from '../board';
import { store, type ToolState } from '../store';

// Resume exactly where the lesson stopped — after a power cut, closing the
// app, or days later: same notebook, same page, same place on the board,
// same pen and colours.

const KEY = 'teachly.session';

interface Session {
  nb: string;
  page: string;
  index: number;
  cam: { x: number; y: number; z: number } | null;
  /** The same view, relative to the whole page (works on any screen size). */
  view?: { rel: number; u: number; v: number } | null;
  size: string;
  tool: Partial<ToolState>;
  at: number;
}

const TOOL_KEYS: (keyof ToolState)[] = ['tool', 'penStyle', 'color', 'size', 'hlColor', 'hlSize', 'shape', 'shapeColor', 'shapeSize', 'shapeFill', 'eraserMode', 'eraserSize', 'fontSize', 'fillColor', 'laserColor', 'laserStay', 'laserBlink', 'inkSmooth', 'tapeColor'];

function read(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
    return s && typeof s.nb === 'string' ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(board: Board): void {
  try {
    const tool: Partial<ToolState> = {};
    for (const k of TOOL_KEYS) (tool as Record<string, unknown>)[k] = store.tool[k];
    // Tools that need a panel open are reopened as the pen.
    if (tool.tool === 'compass') tool.tool = 'pen';
    const s: Session = {
      nb: store.doc.id ?? '',
      page: store.page.id,
      index: store.index,
      cam: board.isHome ? null : { ...store.camera },
      view: board.isHome ? null : board.viewOf(store.camera),
      size: `${Math.round(board.w)}x${Math.round(board.h)}`,
      tool,
      at: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

/** Pen, colours and sizes as they were last time (before any notebook loads). */
export function restoreTools(): void {
  const s = read();
  if (s?.tool) store.setTool(s.tool);
}

/** Go back to the page and board position of the last session (same notebook only). */
export function restorePlace(board: Board): void {
  const s = read();
  if (!s || s.nb !== store.doc.id) return;
  let i = store.doc.pages.findIndex((p) => p.id === s.page);
  if (i < 0) i = Math.min(s.index, store.doc.pages.length - 1);
  if (i !== store.index) store.goTo(i);
  // The same spot and zoom as when the app was closed.
  if (s.cam && s.size === `${Math.round(board.w)}x${Math.round(board.h)}`) store.setCamera(s.cam);
  // Another screen size (e.g. full screen kicked in): the same part, same zoom.
  else if (s.view) store.setCamera(board.camOf(s.view));
}

/** Keep the session note up to date (cheap: a small note in local storage). */
export function trackSession(board: Board): void {
  let t = 0;
  const later = () => {
    clearTimeout(t);
    t = window.setTimeout(() => saveSession(board), 400);
  };
  for (const ev of ['page', 'camera', 'tool', 'doc'] as const) store.on(ev, later);
  const now = () => {
    clearTimeout(t);
    saveSession(board);
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && now());
  window.addEventListener('pagehide', now);
}
