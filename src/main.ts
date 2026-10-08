import './styles.css';
import { App } from './ui/app';

const root = document.getElementById('app')!;
const app = new App(root);

// Keep the opening screen up for about two seconds from page start, then fade it out.
const splash = document.getElementById('splash');
if (splash) {
  window.setTimeout(() => {
    splash.classList.add('hide');
    window.setTimeout(() => splash.remove(), 600);
  }, Math.max(0, 2000 - performance.now()));
}
(window as unknown as { teachly: App }).teachly = app;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Look for a new version whenever the app comes back to the screen.
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update());
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
