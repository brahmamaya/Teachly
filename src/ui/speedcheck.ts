import type { Board } from '../board';
import { liteDevice } from '../board';
import { fadeOut } from './panel';

// Settings > Check writing speed: the teacher writes for a few seconds and the card shows how smooth it was on this
// device, with the facts that decide it (screen, drawing size, browser version, cores). Nothing is sent anywhere: the
// teacher can show the card (or a photo of it) when asking for help with a slow board.

const SECONDS = 6;

/** Measure while the teacher writes, then show the result. */
export function speedCheck(host: HTMLElement, board: Board): void {
  document.querySelector('.speed-card')?.remove();
  const card = document.createElement('div');
  card.className = 'speed-card';
  card.setAttribute('role', 'status');
  host.appendChild(card);
  const say = (html: string) => (card.innerHTML = html);
  say(`<b>Write on the board now</b><span>Measuring for ${SECONDS} seconds…</span>`);

  const gaps: number[] = [];
  let moves = 0, longTasks = 0, longest = 0;
  let last = performance.now();
  const t0 = last;
  let raf = 0;
  const tick = (t: number) => {
    gaps.push(t - last);
    last = t;
    if (t - t0 < SECONDS * 1000) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const onMove = () => moves++;
  const ov = board.overlay;
  const raw = 'onpointerrawupdate' in window;
  ov.addEventListener(raw ? ('pointerrawupdate' as 'pointermove') : 'pointermove', onMove);
  let po: PerformanceObserver | null = null;
  try {
    po = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        longTasks++;
        longest = Math.max(longest, e.duration);
      }
    });
    po.observe({ entryTypes: ['longtask'] });
  } catch {
    po = null;
  }
  window.setTimeout(() => {
    cancelAnimationFrame(raf);
    ov.removeEventListener(raw ? ('pointerrawupdate' as 'pointermove') : 'pointermove', onMove);
    po?.disconnect();
    const g = gaps.slice(2).sort((a, b) => a - b);
    const pct = (q: number) => (g.length ? g[Math.min(g.length - 1, Math.floor(g.length * q))] : 0);
    const worst = g.length ? g[g.length - 1] : 0;
    const slow = g.filter((x) => x > 50).length;
    const fps = g.length ? 1000 / pct(0.5) : 0;
    const verdict = worst < 60 && slow <= 2 ? ['Smooth', '#14b8a6'] : worst < 150 && slow <= 10 ? ['A little uneven', '#f59e0b'] : ['Slow', '#ef4444'];
    const nav = navigator as Navigator & { deviceMemory?: number };
    const chrome = /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1];
    const safari = /Version\/(\d+)[^ ]* (Mobile\/\S+ )?Safari/.exec(navigator.userAgent)?.[1];
    const row = (k: string, v: string) => `<div><span>${k}</span><b>${v}</b></div>`;
    say(`<b style="color:${verdict[1]}">${verdict[0]}</b>
      <div class="sp-rows">
        ${row('Frames', `${Math.round(fps)} per second · worst ${Math.round(worst)} ms · ${slow} slow`)}
        ${row('Busy moments', po ? `${longTasks}${longTasks ? ` (longest ${Math.round(longest)} ms)` : ''}` : 'not measured here')}
        ${row('Pen / touch samples', `${Math.round(moves / SECONDS)} per second`)}
        ${row('Screen', `${innerWidth} × ${innerHeight} · pixel ratio ${devicePixelRatio}`)}
        ${row('Drawing size', `${board.ink.width} × ${board.ink.height} (${board.dpr.toFixed(2)}×)`)}
        ${row('Browser', chrome ? `Chrome ${chrome}` : safari ? `Safari ${safari}` : 'other')}
        ${row('Device', `${navigator.hardwareConcurrency || '?'} cores${nav.deviceMemory ? ` · ${nav.deviceMemory} GB` : ''} · ${liteDevice() ? 'board mode' : 'normal mode'}${'TeachlyAndroid' in window ? ' · Android app' : ''}`)}
      </div>
      <span>Nothing is sent: show this card when asking for help.</span>
      <button type="button" class="btn" data-sp-close>Close</button>`);
    card.querySelector('[data-sp-close]')?.addEventListener('click', () => fadeOut(card, 180));
  }, SECONDS * 1000 + 50);
}
