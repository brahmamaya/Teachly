import { saveNow } from '../io/autosave';

// "New version ready": shown when a new version of Physica Notes was installed in the background while the app stayed open
// (a classroom board is often never put away). It never reloads by itself in the middle of a lesson: the teacher
// taps it, the notebook is written first, and only when that worked does the page reload.

export function showUpdatePill(): void {
  if (document.querySelector('.update-pill')) return;
  const b = document.createElement('button');
  b.className = 'update-pill';
  b.type = 'button';
  b.textContent = 'New version ready · tap to update';
  b.addEventListener('click', async () => {
    b.disabled = true;
    b.textContent = 'Saving your notebook…';
    let ok = false;
    try {
      ok = await saveNow();
    } catch {
      ok = false;
    }
    if (!ok) {
      b.disabled = false;
      b.textContent = 'Could not save, so not updating. Tap to try again';
      return;
    }
    window.location.reload();
  });
  document.body.appendChild(b);
}
