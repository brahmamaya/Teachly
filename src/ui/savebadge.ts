import { onSaveState, retrySave, type SaveState } from '../io/autosave';

// A small, quiet note under the clock: Saving… while a save runs (only if it
// takes a moment), Saved for a second and a half, and a clear red note with
// Retry / Backup when a save fails. Nothing is shown while all is well.

export class SaveBadge {
  private el: HTMLElement;
  private hide = 0;
  private slow = 0;
  private saving = false;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'save-pill';
    this.el.hidden = true;
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    host.parentElement!.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-sv]') as HTMLElement | null;
      if (b?.dataset.sv === 'retry') retrySave();
      else if (b?.dataset.sv === 'backup') void import('../io/files').then((m) => m.saveFile());
      else if (b?.dataset.sv === 'reload') location.reload();
    });
    onSaveState((s) => this.show(s));
  }

  private show(s: SaveState): void {
    clearTimeout(this.hide);
    clearTimeout(this.slow);
    const el = this.el;
    if (s.status === 'saving') {
      // A quick save is not announced as "Saving…" (only as Saved).
      this.saving = true;
      this.slow = window.setTimeout(() => this.paint('saving', 'Saving…'), 500);
      return;
    }
    if (s.status === 'saved') {
      // Only after a save we announced or ran: a quiet "Saved" for a moment.
      if (this.saving || el.dataset.state === 'error' || el.dataset.state === 'conflict') {
        this.paint('saved', 'Saved');
        this.hide = window.setTimeout(() => this.fade(), 1500);
      }
      this.saving = false;
      return;
    }
    if (s.status === 'conflict') {
      this.paint('conflict', 'Not saved: a newer version exists', `<button data-sv="reload">Reload</button>`);
      return;
    }
    this.paint('error', `Not saved. ${s.message}`, `<button data-sv="retry">Retry</button><button data-sv="backup">Save a copy</button>`);
  }

  private paint(state: string, text: string, actions = ''): void {
    const el = this.el;
    el.dataset.state = state;
    el.hidden = false;
    el.classList.remove('fading');
    el.innerHTML = `<i class="sp-dot"></i><span>${text}</span>${actions}`;
  }

  private fade(): void {
    this.el.classList.add('fading');
    this.hide = window.setTimeout(() => {
      this.el.hidden = true;
      this.el.dataset.state = '';
    }, 400);
  }
}
