import { icon } from '../ui/icons';
import { beep, fadeOut, makeDraggable } from '../ui/panel';

// Class poll: a floating card with options A B C D and an optional timer.
// The teacher may type the question (or leave it empty and ask aloud /
// write it on the board). Students raise hands or come up and tap their
// letter; every tap adds one vote. Results show as bars with percentages,
// and the right answer can be marked in green. Nothing leaves the device.

const LETTERS = ['A', 'B', 'C', 'D'];
const TIMES: [number, string][] = [
  [0, 'No timer'],
  [30, '30s'],
  [60, '1m'],
  [120, '2m'],
  [300, '5m'],
];

let el: HTMLElement | null = null;

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Open the poll card (tapping the Poll button again closes it). */
export function openPoll(host: HTMLElement): void {
  if (el) {
    fadeOut(el, 180);
    el = null;
    return;
  }
  const votes = [0, 0, 0, 0];
  let correct = -1;
  let marking = false;
  let total = 60_000;
  let endAt = 0;
  let left = total;
  let state: 'ready' | 'open' | 'closed' = 'ready';
  let tick = 0;

  const card = document.createElement('section');
  card.className = 'qtimer poll';
  card.setAttribute('aria-label', 'Class poll');
  // Fixed markup only; the question the teacher types stays in the textarea.
  card.innerHTML = `
    <header class="qt-head">
      <span class="qt-title">${icon('poll', 16)} Poll</span>
      <span class="pl-time" data-t></span>
      <button class="qt-icon" data-a="mini" title="Make small" aria-label="Make small"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
      <button class="qt-icon" data-a="close" title="Close" aria-label="Close">${icon('close', 16)}</button>
    </header>
    <textarea class="pl-q" rows="2" maxlength="300" placeholder="Question (optional)" aria-label="Question (optional)"></textarea>
    <div class="pl-opts">${LETTERS.map(
      (L, i) => `<div class="pl-row" data-i="${i}">
        <button class="pl-opt" data-vote="${i}" aria-label="Vote ${L}"><b>${L}</b><span class="pl-bar"><i></i></span><span class="pl-n">0</span></button>
        <button class="pl-minus" data-minus="${i}" aria-label="One vote less for ${L}">−</button>
      </div>`,
    ).join('')}</div>
    <div class="pl-sum muted" data-sum>Tap a letter to count a vote</div>
    <div class="qt-presets pl-times">${TIMES.map(([s, n]) => `<button class="qt-chip ${s * 1000 === total ? 'on' : ''}" data-time="${s}">${n}</button>`).join('')}</div>
    <div class="pl-ctrl">
      <button class="qt-go" data-a="go"><span data-go>Start</span></button>
      <button class="qt-chip" data-a="answer">Mark answer</button>
      <button class="qt-reset" data-a="reset">Reset</button>
    </div>`;
  host.appendChild(card);
  el = card;
  card.style.left = `${Math.max(12, window.innerWidth / 2 - 170)}px`;
  card.style.top = `${Math.max(12, window.innerHeight / 2 - 290)}px`;
  makeDraggable(card, card.querySelector('.qt-head') as HTMLElement);

  const timeEl = card.querySelector('[data-t]') as HTMLElement;
  const goEl = card.querySelector('[data-go]') as HTMLElement;
  const sumEl = card.querySelector('[data-sum]') as HTMLElement;
  const rows = [...card.querySelectorAll<HTMLElement>('.pl-row')];

  const render = () => {
    if (state === 'open' && total) left = Math.max(0, endAt - performance.now());
    const all = votes.reduce((a, b) => a + b, 0);
    const top = Math.max(...votes);
    rows.forEach((r, i) => {
      const pct = all ? Math.round((votes[i] / all) * 100) : 0;
      (r.querySelector('.pl-bar i') as HTMLElement).style.transform = `scaleX(${all ? votes[i] / all : 0})`;
      (r.querySelector('.pl-n') as HTMLElement).textContent = all ? `${votes[i]} · ${pct}%` : '0';
      r.classList.toggle('lead', all > 0 && votes[i] === top);
      r.classList.toggle('right', i === correct);
    });
    timeEl.textContent = total && state !== 'ready' ? fmt(left) : total ? fmt(total) : '';
    card.classList.toggle('warn', state === 'open' && !!total && left <= 10_000);
    card.classList.toggle('closed', state === 'closed');
    card.classList.toggle('marking', marking);
    goEl.textContent = state === 'open' ? 'Stop' : state === 'closed' ? 'Again' : 'Start';
    sumEl.textContent = marking
      ? 'Tap the right answer'
      : state === 'closed'
        ? `Poll closed · ${all} vote${all === 1 ? '' : 's'}`
        : all
          ? `${all} vote${all === 1 ? '' : 's'}`
          : state === 'open'
            ? 'Voting is open: tap a letter for each vote'
            : 'Tap a letter to count a vote';
    if (state === 'open' && total && left <= 0) close(true);
  };
  const close = (ring: boolean) => {
    state = 'closed';
    clearInterval(tick);
    if (ring) beep(880, 240, 3);
    render();
  };
  const start = () => {
    state = 'open';
    left = total;
    endAt = performance.now() + total;
    clearInterval(tick);
    if (total) tick = window.setInterval(render, 250);
    render();
  };

  card.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    const d = b.dataset;
    if (d.a === 'close') {
      clearInterval(tick);
      fadeOut(card, 180);
      el = null;
      return;
    }
    if (d.a === 'mini') return void card.classList.toggle('mini');
    if (d.vote !== undefined) {
      const i = Number(d.vote);
      if (marking) {
        correct = correct === i ? -1 : i;
        marking = false;
      } else if (state !== 'closed') {
        if (state === 'ready') start();
        votes[i]++;
        b.animate?.([{ scale: '0.96' }, { scale: '1' }], { duration: 160, easing: 'ease-out' });
      }
      return render();
    }
    if (d.minus !== undefined) {
      const i = Number(d.minus);
      votes[i] = Math.max(0, votes[i] - 1);
      return render();
    }
    if (d.time !== undefined) {
      total = Number(d.time) * 1000;
      card.querySelectorAll('[data-time]').forEach((c) => c.classList.toggle('on', c === b));
      if (state === 'open') start();
      return render();
    }
    if (d.a === 'go') {
      if (state === 'open') close(false);
      else {
        if (state === 'closed') {
          votes.fill(0);
          correct = -1;
        }
        start();
      }
      return;
    }
    if (d.a === 'answer') {
      marking = !marking;
      return render();
    }
    if (d.a === 'reset') {
      votes.fill(0);
      correct = -1;
      marking = false;
      state = 'ready';
      clearInterval(tick);
      render();
    }
  });
  // Typing in the question must not reach the board's keyboard shortcuts.
  card.addEventListener('keydown', (e) => e.stopPropagation());
  render();
}
