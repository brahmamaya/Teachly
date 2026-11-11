import type { Board } from '../board';
import { trimImageCache } from '../renderer';
import { store } from '../store';
import { dropUnusedSources, recoverOrphans, saveNotebook } from './library';
import { saveSession } from './session';

// Housekeeping, so Teachly stays light and fast however many days it runs:
// - asks the device to keep the notebooks (never cleared on its own)
// - puts back into the library any saved notebook missing from its list
//   (never deletes a notebook), and removes old website caches
// - while the board is quiet: frees pictures no page uses any more and
//   trims a very long undo history
// - after a long time in the background (or a very long day), refreshes
//   itself once — invisibly, landing back on the same page and spot.

const QUIET_MS = 60_000; // only when nobody has touched the board for a minute
const LONG_AWAY_MS = 3 * 3600_000; // refresh when coming back after 3 h
const LONG_RUN_MS = 10 * 3600_000; // or after 10 h of running, when idle 5 min
const started = performance.now();

function imagesInUse(): Set<string> {
  const keep = new Set<string>();
  store.doc.pages.forEach((p, i) => {
    for (const e of p.els) {
      if (e.type !== 'image') continue;
      // Book pages (drawn on demand) are kept only around the page in use.
      if (e.src.startsWith('pdfp:') && Math.abs(i - store.index) > 2) continue;
      keep.add(e.src);
    }
  });
  return keep;
}

async function refresh(board: Board): Promise<void> {
  try {
    await saveNotebook(store.doc);
  } catch {
    /* keep going: the regular autosave has the latest anyway */
  }
  saveSession(board);
  try {
    sessionStorage.setItem('teachly.quickStart', '1');
  } catch {
    /* ignore */
  }
  location.reload();
}

export function startHousekeeping(board: Board): void {
  // 1. Keep notebooks safe from automatic browser clean-ups.
  void (navigator.storage as StorageManager | undefined)?.persist?.().catch(() => {});

  // 2. Start-up tidy (a little later, never during start).
  window.setTimeout(() => {
    void recoverOrphans().then(() => dropUnusedSources());
    // Old website caches from earlier versions (the current one is kept by the service worker).
    void (async () => {
      try {
        for (const k of await caches.keys()) if (!k.startsWith('teachly-v')) await caches.delete(k);
      } catch {
        /* no cache storage */
      }
    })();
  }, 8000);

  // 3. Quiet-time memory tidy, every 5 minutes.
  window.setInterval(() => {
    const quiet = performance.now() - board.lastInput > QUIET_MS && !board.busyInput;
    if (!quiet) return;
    trimImageCache(imagesInUse());
    store.trimHistory(80);
    // A board left on all day: refresh once when idle (lands on the same spot).
    if (performance.now() - started > LONG_RUN_MS && performance.now() - board.lastInput > 5 * 60_000) void refresh(board);
  }, 5 * 60_000);

  // 4. Back after a long time away: start fresh, right where we were.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > LONG_AWAY_MS) void refresh(board);
  });
}
