import { store } from '../store';
import { pendingMigration, saveNotebookChecked } from './library';

// Autosave. Rules:
//  - a change is saved about half a second after it is made (and never while a
//    pen or finger is writing), not only when the app is closed
//  - only one save runs at a time and it always saves the NEWEST document, so
//    an older state can never be written after a newer one
//  - a save that fails keeps the edits in memory, says so, and is tried again
//    (2 s, 4 s, 8 s … 30 s) until it works; a save that cannot go through
//    because a newer revision is stored offers to reload instead of overwriting
//  - the app being hidden or closed starts a save at once

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';
export interface SaveState {
  status: SaveStatus;
  /** What went wrong, in words for the teacher. */
  message: string;
  /** Failures in a row (0 when the last save worked). */
  failures: number;
}

type Listener = (s: SaveState) => void;
const listeners = new Set<Listener>();
let state: SaveState = { status: 'saved', message: '', failures: 0 };
function set(status: SaveStatus, message = '', failures = state.failures): void {
  state = { status, message, failures };
  for (const l of listeners) l(state);
}

export function onSaveState(fn: Listener): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}
export const saveState = (): SaveState => state;

let busy: () => boolean = () => false;
/** Revision of each notebook that is known to be on the device. */
const confirmed = new Map<string, number>();
let timer = 0;
let waited = 0;
let running: Promise<void> | null = null;
let failures = 0;

const dirty = (): boolean => {
  const id = store.doc.id;
  return !!id && (pendingMigration.has(id) || (store.doc.rev ?? 0) > (confirmed.get(id) ?? -1));
};

/** The open notebook was just opened (or written by whoever made it): what is on the device is current. */
function adopt(): void {
  if (store.doc.id) confirmed.set(store.doc.id, store.doc.rev ?? 0);
}

function describe(e: unknown): string {
  const name = (e as DOMException)?.name ?? '';
  if (name === 'QuotaExceededError') return 'The device storage is full.';
  if (name === 'InvalidStateError' || name === 'SecurityError') return 'The browser would not open its storage (private window?).';
  return 'The notebook could not be written to the device.';
}

async function run(): Promise<void> {
  if (running) return running;
  running = (async () => {
    while (dirty()) {
      const doc = store.doc; // the newest state at this moment
      set('saving');
      try {
        const written = await saveNotebookChecked(doc);
        if (!written) {
          set('conflict', 'A newer version of this notebook is already saved (another window?). Reload to see it.');
          return;
        }
        confirmed.set(doc.id!, Math.max(confirmed.get(doc.id!) ?? 0, doc.rev ?? 0));
        failures = 0;
      } catch (e) {
        failures++;
        set('error', describe(e), failures);
        retryLater();
        return;
      }
    }
    set('saved');
  })().finally(() => {
    running = null;
  });
  return running;
}

function retryLater(): void {
  clearTimeout(timer);
  timer = window.setTimeout(() => void run(), Math.min(30_000, 2000 * 2 ** Math.min(failures, 4)));
}

/** Save soon (and again a bit later if a pen is down). */
function schedule(ms = 450): void {
  clearTimeout(timer);
  timer = window.setTimeout(function kick() {
    if (busy() && waited < 4000) {
      waited += 300;
      timer = window.setTimeout(kick, 300);
      return;
    }
    waited = 0;
    void run();
  }, ms);
}

/** Write now (the app is going away, or the teacher asked). Resolves when everything is on the device. */
export async function saveNow(): Promise<boolean> {
  clearTimeout(timer);
  await run();
  return state.status === 'saved';
}

/** Try again after a failure (the pill's Retry). */
export function retrySave(): void {
  failures = Math.max(0, failures - 1);
  void saveNow();
}

/** Start watching the notebook. `isBusy`: a pen or finger is on the board. */
export function startAutosave(isBusy: () => boolean): void {
  busy = isBusy;
  adopt();
  store.on('doc', () => {
    // A notebook seen for the first time was just opened: it is what is on the device.
    if (store.doc.id && !confirmed.has(store.doc.id)) adopt();
    if (dirty()) schedule();
  });
  // Another notebook is about to open: write what is unsaved first (it starts with the current document).
  store.on('leave', () => {
    if (dirty()) void run();
  });
  // When the app is hidden or closed: write right now (a tablet may stop the page any moment after).
  const flush = () => {
    if (dirty()) void run();
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);
  window.addEventListener('freeze', flush);
  // A converted old notebook is written once as soon as it is open.
  if (dirty()) schedule(1500);
}

/** For tests: the revision of the open notebook that is confirmed on the device. */
export const confirmedRev = (): number => confirmed.get(store.doc.id ?? '') ?? -1;
