import './styles.css';
import { App } from './ui/app';

const root = document.getElementById('app')!;
const app = new App(root);
(window as unknown as { teachly: App }).teachly = app;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support unavailable */
    });
  });
}

// Prevent browser gestures (pinch-zoom of the page, pull-to-refresh) on touch boards.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  if ((e.target as HTMLElement).closest('.board')) e.preventDefault();
}, { passive: false });
