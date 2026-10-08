import { beep, floatingPanel } from '../ui/panel';

const two = (n: number) => String(Math.floor(n)).padStart(2, '0');

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${two(s / 60)}:${two(s % 60)}`;
}

/** Simple classroom countdown timer with quick presets and an alarm. */
export function openTimer(host: HTMLElement): void {
  let raf = 0;
  const body = floatingPanel(host, { id: 'timer', title: 'Timer', iconName: 'timer', width: 320, onClose: () => cancelAnimationFrame(raf) });
  if (!body) return;
  body.innerHTML = `
    <div class="timer-display" data-d>05:00</div>
    <div class="row gap center">
      <button class="btn" data-adj="-60">− 1 min</button>
      <button class="btn" data-adj="60">+ 1 min</button>
    </div>
    <div class="timer-presets">${[1, 2, 5, 10, 15].map((m) => `<button class="chip" data-p="${m}">${m} min</button>`).join('')}</div>
    <div class="row gap"><button class="btn primary grow" data-a="start">Start</button><button class="btn grow" data-a="reset">Reset</button></div>`;
  const disp = body.querySelector('[data-d]') as HTMLElement;
  const startBtn = body.querySelector('[data-a=start]') as HTMLButtonElement;
  let total = 5 * 60_000;
  let left = total;
  let endAt = 0;
  let running = false;

  const render = () => {
    if (running) left = endAt - performance.now();
    disp.textContent = fmt(left);
    disp.classList.toggle('warn', running && left < 10_000);
    if (running && left <= 0) {
      running = false;
      left = 0;
      startBtn.textContent = 'Start';
      disp.textContent = "Time's up!";
      disp.classList.add('done');
      beep(880, 260, 4);
    }
    if (running) raf = requestAnimationFrame(render);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
    startBtn.textContent = 'Start';
    disp.classList.remove('done', 'warn');
  };
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.p) {
      stop();
      total = left = Number(b.dataset.p) * 60_000;
    } else if (b.dataset.adj) {
      const d = Number(b.dataset.adj) * 1000;
      if (running) endAt = Math.max(performance.now(), endAt + d);
      else {
        disp.classList.remove('done');
        total = left = Math.max(60_000, left + d);
      }
    } else if (b.dataset.a === 'start') {
      if (running) {
        stop();
        startBtn.textContent = 'Resume';
      } else {
        if (left <= 0) left = total;
        disp.classList.remove('done');
        endAt = performance.now() + left;
        running = true;
        startBtn.textContent = 'Pause';
      }
    } else if (b.dataset.a === 'reset') {
      stop();
      left = total;
    }
    render();
  });
  render();
}
