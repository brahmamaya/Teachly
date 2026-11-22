import { fadeOut, toast } from './panel';

// The first-open tour: a teal ring goes around one real button at a time, with a small card beside it saying what
// the button does ("Write · 2 of 4"). Back / Next / End tour; Esc ends it, the arrow keys step. Steps whose button is
// hidden (Edit toolbar) are left out. The ring and the card glide from button to button (only moves and fades).

interface Step {
  sec: string;
  sel: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  { sec: 'Write', sel: '.tb-left [data-tool=pen]', title: 'Pen', text: 'Write and draw. Tap the pen again for pen types, colours and size.' },
  { sec: 'Write', sel: '.tb-left [data-tool=eraser]', title: 'Eraser', text: 'Rub out what you wrote. Tap it again to erase whole lines or just a part.' },
  { sec: 'Write', sel: '.tb-left [data-tool=shape]', title: 'Shapes', text: 'Neat lines, arrows, circles, boxes and more.' },
  { sec: 'Write', sel: '.tb-left [data-tool=text]', title: 'Text', text: 'Tap the page and type.' },
  { sec: 'Move', sel: '.tb-left [data-tool=select]', title: 'Select', text: 'Draw around writing to move it, make it bigger, colour it or copy it.' },
  { sec: 'Move', sel: '.tb-left [data-act=slide]', title: 'Slide', text: 'Move and zoom the page. Pinch to zoom, double tap to see the whole page.' },
  { sec: 'Move', sel: '.tb-left [data-act=readonly]', title: 'Read only', text: 'Show your notes without changing them by mistake. Tap again to write.' },
  { sec: 'Add', sel: '.tb-right [data-pop=insert]', title: 'Insert', text: 'Add a picture, PDF, PowerPoint, table, graph or a new page.' },
  { sec: 'Add', sel: '.tb-right [data-act=undo]', title: 'Undo', text: 'Made a mistake? Step back. Redo is right next to it.' },
  { sec: 'Pages', sel: '.tb-right [data-act=pages]', title: 'Pages', text: 'See every page. Hold one to move it, or drag it onto the board to copy it.' },
  { sec: 'Pages', sel: '.tb-right [data-pop=menu]', title: 'Menu', text: 'Your notebooks, page background, saving, recording and settings. The ⓘ at the top opens the full guide.' },
];

let running: (() => void) | null = null;

/** Start the tour (if one is already running it starts again). `done` runs when it ends, however it ends. */
export function startTour(host: HTMLElement, done?: () => void): void {
  running?.();
  const steps = STEPS.filter((s) => {
    const el = host.querySelector<HTMLElement>(s.sel);
    return !!el && el.offsetWidth > 0;
  });
  if (!steps.length) {
    done?.();
    return;
  }
  const ring = document.createElement('div');
  ring.className = 'tour-ring';
  ring.setAttribute('aria-hidden', 'true');
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `<div class="tc-top"><span class="tc-sec"></span><span class="tc-dots">${steps.map(() => '<i></i>').join('')}</span></div>
    <h3></h3><p></p>
    <div class="tc-btns"><button class="tc-end" data-tour="end">End tour</button><span></span><button class="tc-back" data-tour="back">Back</button><button class="tc-next" data-tour="next">Next</button></div>`;
  host.append(ring, card);
  let i = 0;
  let first = true;

  const place = () => {
    const s = steps[i];
    const t = host.querySelector<HTMLElement>(s.sel);
    if (!t) return;
    const r = t.getBoundingClientRect();
    const pad = 5;
    ring.style.width = `${r.width + pad * 2}px`;
    ring.style.height = `${r.height + pad * 2}px`;
    ring.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
    // The card sits beside the button, on the side with room (above a bottom toolbar, below a top one).
    const W = window.innerWidth, H = window.innerHeight;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const x = Math.max(12, Math.min(W - cw - 12, r.left + r.width / 2 - cw / 2));
    const below = r.top + r.height / 2 < H / 2;
    const y = below ? Math.min(H - ch - 12, r.bottom + 18) : Math.max(12, r.top - ch - 18);
    card.style.transform = `translate(${x}px, ${y}px)`;
    if (first) {
      // appear in place (no glide from the corner), then glide from here on
      first = false;
      ring.classList.add('no-glide');
      card.classList.add('no-glide');
      void card.offsetWidth;
      ring.classList.remove('no-glide');
      card.classList.remove('no-glide');
    }
  };

  const paint = () => {
    const s = steps[i];
    const inSec = steps.filter((x) => x.sec === s.sec);
    (card.querySelector('.tc-sec') as HTMLElement).textContent = `${s.sec} · ${inSec.indexOf(s) + 1} of ${inSec.length}`;
    (card.querySelector('h3') as HTMLElement).textContent = s.title;
    (card.querySelector('p') as HTMLElement).textContent = s.text;
    card.setAttribute('aria-label', `${s.title}: ${s.text}`);
    card.querySelectorAll('.tc-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    (card.querySelector('[data-tour=back]') as HTMLElement).hidden = i === 0;
    (card.querySelector('[data-tour=next]') as HTMLElement).textContent = i === steps.length - 1 ? 'Done' : 'Next';
    card.classList.remove('turn');
    void card.offsetWidth;
    card.classList.add('turn');
    place();
  };

  const end = (finished: boolean) => {
    if (running !== stop) return;
    running = null;
    window.removeEventListener('resize', place);
    document.removeEventListener('keydown', onKey, true);
    fadeOut(ring, 200);
    fadeOut(card, 200);
    if (finished) toast('You are ready! Menu ▸ ⓘ shows everything again, any time.', 4000);
    done?.();
  };
  const stop = () => end(false);
  running = stop;

  const go = (d: number) => {
    const n = i + d;
    if (n < 0) return;
    if (n >= steps.length) return end(true);
    i = n;
    paint();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') end(false);
    else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  card.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-tour]') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.tour === 'end') end(false);
    else go(b.dataset.tour === 'back' ? -1 : 1);
  });
  window.addEventListener('resize', place);
  document.addEventListener('keydown', onKey, true);
  paint();
}
