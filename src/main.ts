import './polyfills';
import './styles.css';
import './ui/tokens.css';
import { App } from './ui/app';
import * as autosave from './io/autosave';
import { showUpdatePill } from './ui/updatepill';
import * as library from './io/library';
import * as page from './page';
import { store } from './store';
import { toast } from './ui/panel';
import { liteDevice } from './board';
import './ui/install';

// Big classroom boards have slow graphics chips: drop costly glass blur there.
if (liteDevice()) document.documentElement.classList.add('lite');

const root = document.getElementById('app')!;
if (document.getElementById('splash')) root.classList.add('starting');
const app = new App(root);

// Keep the opening screen up for 1.5 seconds from page start, then fade it out softly.
const splash = document.getElementById('splash');
// After an automatic refresh, skip the opening screen: straight back to work.
let quick = false;
try {
  quick = sessionStorage.getItem('teachly.quickStart') === '1';
  sessionStorage.removeItem('teachly.quickStart');
  if (sessionStorage.getItem('teachly.afterUpdate') === '1') {
    sessionStorage.removeItem('teachly.afterUpdate');
    window.setTimeout(() => toast('Physica Notes is up to date. Please open the file again.', 5000), 400);
  }
} catch {
  /* ignore */
}
if (splash) {
  window.setTimeout(
    () => {
      // Start the fade on a fresh frame (never in the middle of the app's own start-up work), then remove it.
      requestAnimationFrame(() => requestAnimationFrame(() => splash.classList.add('hide')));
      window.setTimeout(() => {
        splash.remove();
        // The small "Physica Notes" in the corner appears only now, so the
        // name never seems to jump from the middle to the corner.
        root.classList.remove('starting');
      }, 650);
    },
    quick ? 0 : Math.max(0, 1500 - performance.now()),
  );
}
(window as unknown as { teachly: App }).teachly = app;
// A small handle for the browser checks in e2e/ (they must see the app's own objects, not new copies).
(window as unknown as { __teachly: object }).__teachly = { store, autosave, library, page, showUpdatePill };

// No service worker for the single-file version opened from a pen drive (file://).
// (Nor inside the Android app, which carries its own files.)
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http') && !('TeachlyAndroid' in window)) {
  window.addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Look for a new version whenever the app comes back to the screen.
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update());
        // A board that is never put away still looks for a new version now and then.
        window.setInterval(() => void reg.update().catch(() => {}), 30 * 60 * 1000);
      })
      .catch(() => {
        /* offline support unavailable */
      });
    // A new version took over. Right after opening, reload at once; in the
    // middle of a lesson, wait until the teacher comes back to the app
    // (the board is autosaved by then) so nothing is interrupted.
    let pending = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || pending) return;
      pending = true;
      if (performance.now() < 10_000) window.location.reload();
      else showUpdatePill();
    });
    document.addEventListener('visibilitychange', () => {
      if (pending && document.visibilityState === 'visible') window.location.reload();
    });
  });
}

// Prevent browser gestures (pinch-zoom of the page, pull-to-refresh) on touch boards.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  if ((e.target as HTMLElement).closest('.board')) e.preventDefault();
}, { passive: false });
