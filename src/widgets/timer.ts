import { icon } from '../ui/icons';
import { beep, makeDraggable } from '../ui/panel';

// Question timer: a floating "liquid glass" card with a big ring countdown.
// Pick a time (or nudge it), Start, and let the class watch the ring run
// down. It can shrink to a small pill while students work, and it rings
// and glows when time is up.

const PRESETS: [number, string][] = [
  [30, '30s'],
  [60, '1m'],
  [120, '2m'],
  [180, '3m'],
  [300, '5m'],
  [600, '10m'],
];
const R = 92;
const C = 2 * Math.PI * R;

let el: HTMLElement | null = null;

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function openTimer(host: HTMLElement): void {
  if (el) {
    el.remove();
    el = null;
    return;
  }
  let total = 60_000;
  let left = total;
  let endAt = 0;
  let running = false;
  let done = false;
  let tick = 0;

  const card = document.createElement('section');
  card.className = 'qtimer';
  card.setAttribute('aria-label', 'Question timer');
  card.innerHTML = `
    <header class="qt-head">
      <span class="qt-title">${icon('timer', 16)} Timer</span>
      <button class="qt-icon" data-a="mini" title="Make small" aria-label="Make small"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
      <button class="qt-icon" data-a="close" title="Close" aria-label="Close">${icon('close', 16)}</button>
    </header>
    <div class="qt-ring" data-a="expand">
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle class="qt-track" cx="110" cy="110" r="${R}"/>
        <circle class="qt-prog" cx="110" cy="110" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 110 110)"/>
      </svg>
      <div class="qt-time" data-t>1:00</div>
      <div class="qt-sub" data-s>Ready</div>
    </div>
    <div class="qt-presets">${PRESETS.map(([s, n]) => `<button class="qt-chip" data-p="${s}">${n}</button>`).join('')}</div>
    <div class="qt-ctrl">
      <button class="qt-round" data-adj="-30" aria-label="30 seconds less">−30s</button>
      <button class="qt-go" data-a="go" aria-label="Start"><span data-go>Start</span></button>
      <button class="qt-round" data-adj="30" aria-label="30 seconds more">+30s</button>
    </div>
    <button class="qt-reset" data-a="reset">Reset</button>`;
  host.appendChild(card);
  el = card;
  card.style.left = `${Math.max(12, window.innerWidth / 2 - 150)}px`;
  card.style.top = `${Math.max(12, window.innerHeight / 2 - 260)}px`;
  makeDraggable(card, card.querySelector('.qt-head') as HTMLElement);
  makeDraggable(card, card.querySelector('.qt-ring') as HTMLElement);

  const timeEl = card.querySelector('[data-t]') as HTMLElement;
  const subEl = card.querySelector('[data-s]') as HTMLElement;
  const prog = card.querySelector('.qt-prog') as SVGCircleElement;
  const goEl = card.querySelector('[data-go]') as HTMLElement;

  const render = () => {
    if (running) left = Math.max(0, endAt - performance.now());
    timeEl.textContent = fmt(left);
    const f = total ? left / total : 0;
    prog.style.strokeDashoffset = String(C * (1 - f));
    card.classList.toggle('warn', running && left <= 10_000 && left > 0);
    card.classList.toggle('done', done);
    card.classList.toggle('running', running);
    subEl.textContent = done ? "Time's up!" : running ? 'Answer now' : left < total ? 'Paused' : 'Ready';
    goEl.textContent = running ? 'Pause' : left < total && !done ? 'Resume' : 'Start';
    if (running && left <= 0) {
      running = false;
      done = true;
      clearInterval(tick);
      render();
      beep(880, 240, 4);
    }
  };
  const stop = () => {
    running = false;
    clearInterval(tick);
  };
  const setTotal = (ms: number) => {
    stop();
    done = false;
    total = left = Math.max(5_000, Math.min(99 * 60_000, ms));
    render();
  };

  // Dragging the ring must not count as a tap on it.
  let downAt: [number, number] = [0, 0];
  card.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  card.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-a],[data-p],[data-adj]') as HTMLElement | null;
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'close') {
      stop();
      card.remove();
      el = null;
      return;
    }
    if (a === 'mini') return void card.classList.add('mini');
    if (a === 'expand') {
      if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) card.classList.remove('mini');
      return;
    }
    if (b.dataset.p) return setTotal(Number(b.dataset.p) * 1000);
    if (b.dataset.adj) {
      const d = Number(b.dataset.adj) * 1000;
      if (running) {
        endAt = Math.max(performance.now() + 1000, endAt + d);
        total = Math.max(total + d, endAt - performance.now());
      } else setTotal(left + d);
      return render();
    }
    if (a === 'reset') return setTotal(total);
    if (a === 'go') {
      if (running) stop();
      else {
        if (done || left <= 0) {
          done = false;
          left = total;
        }
        endAt = performance.now() + left;
        running = true;
        clearInterval(tick);
        tick = window.setInterval(render, 200);
      }
      render();
    }
  });
  render();
}
