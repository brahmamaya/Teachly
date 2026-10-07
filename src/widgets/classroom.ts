import { evaluate, formatNumber } from '../mathexpr';
import { beep, esc, floatingPanel } from '../ui/panel';

const two = (n: number) => String(Math.floor(n)).padStart(2, '0');

function fmt(ms: number, tenths = false): string {
  const s = Math.max(0, ms) / 1000;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  const base = `${h ? `${h}:` : ''}${two(m)}:${two(sec)}`;
  return tenths ? `${base}.${Math.floor((s * 10) % 10)}` : base;
}

// ---------------------------------------------------------------------------
// Timer: countdown + stopwatch

export function openTimer(host: HTMLElement): void {
  let raf = 0;
  const body = floatingPanel(host, { id: 'timer', title: 'Timer', iconName: 'timer', width: 340, onClose: () => cancelAnimationFrame(raf) });
  if (!body) return;
  body.innerHTML = `
    <div class="seg"><button class="on" data-m="down">Countdown</button><button data-m="up">Stopwatch</button></div>
    <div class="timer-display" data-d>05:00</div>
    <div class="timer-presets" data-presets>
      ${[1, 2, 3, 5, 10, 15, 30].map((m) => `<button class="chip" data-p="${m}">${m}m</button>`).join('')}
      <button class="chip" data-p="+30s">+30s</button>
    </div>
    <div class="row gap"><button class="btn primary grow" data-a="start">Start</button><button class="btn grow" data-a="reset">Reset</button><button class="btn" data-a="big" title="Show big">⛶</button></div>
    <div class="laps" data-laps></div>`;
  const disp = body.querySelector('[data-d]') as HTMLElement;
  const startBtn = body.querySelector('[data-a=start]') as HTMLButtonElement;
  const presets = body.querySelector('[data-presets]') as HTMLElement;
  const laps = body.querySelector('[data-laps]') as HTMLElement;
  let mode: 'down' | 'up' = 'down';
  let total = 5 * 60_000;
  let elapsed = 0;
  let started = 0;
  let running = false;
  let alarmed = false;

  const value = () => elapsed + (running ? performance.now() - started : 0);
  const render = () => {
    const v = value();
    if (mode === 'down') {
      const left = total - v;
      disp.textContent = fmt(Math.ceil(left / 1000) * 1000);
      disp.classList.toggle('warn', left < 10_000 && left > 0);
      if (left <= 0 && running) {
        running = false;
        elapsed = total;
        startBtn.textContent = 'Start';
        disp.textContent = "Time's up!";
        disp.classList.add('done');
        if (!alarmed) {
          alarmed = true;
          beep(880, 260, 4);
        }
      }
    } else disp.textContent = fmt(v, true);
    if (running) raf = requestAnimationFrame(render);
  };
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.m) {
      mode = b.dataset.m as 'down' | 'up';
      body.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b));
      presets.style.display = mode === 'down' ? '' : 'none';
      running = false;
      elapsed = 0;
      laps.innerHTML = '';
      startBtn.textContent = 'Start';
      disp.classList.remove('done', 'warn');
      render();
    }
    if (b.dataset.p) {
      if (b.dataset.p === '+30s') total += 30_000;
      else {
        total = Number(b.dataset.p) * 60_000;
        elapsed = 0;
      }
      alarmed = false;
      disp.classList.remove('done');
      render();
    }
    if (b.dataset.a === 'start') {
      if (running) {
        elapsed = value();
        running = false;
        startBtn.textContent = 'Resume';
        if (mode === 'up') laps.insertAdjacentHTML('afterbegin', `<div>Lap ${laps.children.length + 1}: ${fmt(elapsed, true)}</div>`);
      } else {
        if (mode === 'down' && value() >= total) elapsed = 0;
        alarmed = false;
        disp.classList.remove('done');
        started = performance.now();
        running = true;
        startBtn.textContent = 'Pause';
        render();
      }
    }
    if (b.dataset.a === 'reset') {
      running = false;
      elapsed = 0;
      laps.innerHTML = '';
      startBtn.textContent = 'Start';
      disp.classList.remove('done', 'warn');
      render();
    }
    if (b.dataset.a === 'big') body.closest('.panel')!.classList.toggle('big');
  });
  // Tap the display to type a custom time, e.g. "7:30".
  disp.addEventListener('dblclick', () => {
    if (mode !== 'down') return;
    const v = prompt('Set countdown (mm:ss or minutes)', fmt(total));
    if (!v) return;
    const parts = v.split(':').map(Number);
    const ms = parts.length > 1 ? (parts[0] * 60 + parts[1]) * 1000 : parts[0] * 60_000;
    if (ms > 0) {
      total = ms;
      elapsed = 0;
      render();
    }
  });
  render();
}

// ---------------------------------------------------------------------------
// Clock

export function openClock(host: HTMLElement): void {
  let timer = 0;
  const body = floatingPanel(host, { id: 'clock', title: 'Clock', iconName: 'clock', width: 280, onClose: () => clearInterval(timer) });
  if (!body) return;
  body.innerHTML = `<canvas width="480" height="480" class="clock-face"></canvas><div class="clock-digital"></div><div class="clock-date"></div>`;
  const c = body.querySelector('canvas')!;
  const ctx = c.getContext('2d')!;
  const dig = body.querySelector('.clock-digital') as HTMLElement;
  const date = body.querySelector('.clock-date') as HTMLElement;
  const draw = () => {
    const d = new Date();
    const r = 220;
    ctx.setTransform(1, 0, 0, 1, 240, 240);
    ctx.clearRect(-240, -240, 480, 480);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const len = i % 5 ? 10 : 24;
      ctx.lineWidth = i % 5 ? 3 : 7;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (r - 14), -Math.cos(a) * (r - 14));
      ctx.lineTo(Math.sin(a) * (r - 14 - len), -Math.cos(a) * (r - 14 - len));
      ctx.stroke();
    }
    ctx.fillStyle = '#1e293b';
    ctx.font = '600 34px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let n = 1; n <= 12; n++) {
      const a = (n / 12) * Math.PI * 2;
      ctx.fillText(String(n), Math.sin(a) * (r - 66), -Math.cos(a) * (r - 66));
    }
    const hand = (a: number, len: number, w: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-Math.sin(a) * 20, Math.cos(a) * 20);
      ctx.lineTo(Math.sin(a) * len, -Math.cos(a) * len);
      ctx.stroke();
    };
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const h = (d.getHours() % 12) + m / 60;
    hand((h / 12) * Math.PI * 2, r * 0.5, 14, '#1e293b');
    hand((m / 60) * Math.PI * 2, r * 0.75, 9, '#334155');
    hand((Math.floor(s) / 60) * Math.PI * 2, r * 0.82, 4, '#ef4444');
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    dig.textContent = d.toLocaleTimeString();
    date.textContent = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };
  draw();
  timer = window.setInterval(draw, 250);
}

// ---------------------------------------------------------------------------
// Random picker: names, numbers, dice, coin

const PICKER_KEY = 'teachly.picker.names';

export function openPicker(host: HTMLElement): void {
  const body = floatingPanel(host, { id: 'picker', title: 'Random Picker', iconName: 'picker', width: 380 });
  if (!body) return;
  let saved = '';
  try {
    saved = localStorage.getItem(PICKER_KEY) ?? '';
  } catch {
    /* ignore */
  }
  body.innerHTML = `
    <div class="seg"><button class="on" data-m="names">Names</button><button data-m="number">Number</button><button data-m="dice">Dice</button><button data-m="coin">Coin</button></div>
    <div class="picker-result" data-r>?</div>
    <div data-pane="names">
      <textarea data-names rows="4" placeholder="One name per line (or comma separated)">${esc(saved || 'Aarav\nDiya\nIshaan\nMeera\nRohan\nSara')}</textarea>
      <label class="check"><input type="checkbox" data-noRepeat checked> Don't repeat until everyone is picked</label>
      <div class="muted small" data-left></div>
    </div>
    <div data-pane="number" hidden><div class="row gap">From <input type="number" data-min value="1" class="num"> to <input type="number" data-max value="50" class="num"></div></div>
    <div data-pane="dice" hidden><div class="row gap">Dice: <input type="number" data-dice value="2" min="1" max="6" class="num"></div></div>
    <button class="btn primary wide" data-a="go">🎲 Pick!</button>`;
  const res = body.querySelector('[data-r]') as HTMLElement;
  const names = body.querySelector('[data-names]') as HTMLTextAreaElement;
  const noRepeat = body.querySelector('[data-noRepeat]') as HTMLInputElement;
  const left = body.querySelector('[data-left]') as HTMLElement;
  let mode = 'names';
  let used = new Set<string>();
  const list = () => names.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const updateLeft = () => {
    const l = list();
    left.textContent = noRepeat.checked ? `${l.filter((n) => !used.has(n)).length} of ${l.length} left` : `${l.length} names`;
  };
  names.addEventListener('input', () => {
    used = new Set();
    updateLeft();
    try {
      localStorage.setItem(PICKER_KEY, names.value);
    } catch {
      /* ignore */
    }
  });
  noRepeat.addEventListener('change', updateLeft);
  updateLeft();
  const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const rnd = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  };
  const spin = (gen: () => string, final: string) => {
    let i = 0;
    res.classList.remove('pop');
    const t = setInterval(() => {
      res.textContent = gen();
      beep(500 + rnd(400), 30);
      if (++i > 14) {
        clearInterval(t);
        res.textContent = final;
        res.classList.add('pop');
        beep(1046, 200, 2);
      }
    }, 70);
  };
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.m) {
      mode = b.dataset.m;
      body.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b));
      body.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== mode));
      res.textContent = '?';
    }
    if (b.dataset.a === 'go') {
      if (mode === 'names') {
        const l = list();
        if (!l.length) return;
        let pool = noRepeat.checked ? l.filter((n) => !used.has(n)) : l;
        if (!pool.length) {
          used = new Set();
          pool = l;
        }
        const pick = pool[rnd(pool.length)];
        used.add(pick);
        updateLeft();
        spin(() => l[rnd(l.length)], pick);
      } else if (mode === 'number') {
        const a = Number((body.querySelector('[data-min]') as HTMLInputElement).value);
        const z = Number((body.querySelector('[data-max]') as HTMLInputElement).value);
        const lo = Math.min(a, z), hi = Math.max(a, z);
        const g = () => String(lo + rnd(hi - lo + 1));
        spin(g, g());
      } else if (mode === 'dice') {
        const n = Math.max(1, Math.min(6, Number((body.querySelector('[data-dice]') as HTMLInputElement).value) || 1));
        const g = () => Array.from({ length: n }, () => DICE[rnd(6)]).join(' ');
        const final = Array.from({ length: n }, () => rnd(6));
        spin(g, `${final.map((d) => DICE[d]).join(' ')}  = ${final.reduce((s, d) => s + d + 1, 0)}`);
      } else {
        spin(() => (rnd(2) ? 'Heads' : 'Tails'), rnd(2) ? '🪙 Heads' : '🪙 Tails');
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Scoreboard

export function openScoreboard(host: HTMLElement): void {
  const body = floatingPanel(host, { id: 'score', title: 'Scoreboard', iconName: 'score', width: 420 });
  if (!body) return;
  const teams = [
    { name: 'Team A', score: 0, color: '#3b82f6' },
    { name: 'Team B', score: 0, color: '#ef4444' },
  ];
  const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
  const render = () => {
    const max = Math.max(...teams.map((t) => t.score));
    body.innerHTML = `<div class="teams">${teams
      .map(
        (t, i) => `<div class="team ${t.score === max && max > 0 ? 'lead' : ''}" style="--c:${t.color}">
        <input value="${esc(t.name)}" data-name="${i}">
        <div class="team-score">${t.score}</div>
        <div class="row gap center"><button class="btn" data-d="${i}" data-v="-1">−1</button><button class="btn primary" data-d="${i}" data-v="1">+1</button><button class="btn" data-d="${i}" data-v="5">+5</button></div>
      </div>`,
      )
      .join('')}</div>
      <div class="row gap"><button class="btn grow" data-a="add" ${teams.length >= 6 ? 'disabled' : ''}>+ Team</button><button class="btn grow" data-a="remove" ${teams.length <= 1 ? 'disabled' : ''}>− Team</button><button class="btn grow" data-a="reset">Reset</button></div>`;
  };
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.d) {
      const t = teams[Number(b.dataset.d)];
      t.score = Math.max(0, t.score + Number(b.dataset.v));
      if (Number(b.dataset.v) > 0) beep(660 + t.score * 10, 90);
    }
    if (b.dataset.a === 'add') teams.push({ name: `Team ${String.fromCharCode(65 + teams.length)}`, score: 0, color: COLORS[teams.length % COLORS.length] });
    if (b.dataset.a === 'remove') teams.pop();
    if (b.dataset.a === 'reset') teams.forEach((t) => (t.score = 0));
    render();
  });
  body.addEventListener('input', (e) => {
    const i = (e.target as HTMLElement).dataset.name;
    if (i !== undefined) teams[Number(i)].name = (e.target as HTMLInputElement).value;
  });
  render();
}

// ---------------------------------------------------------------------------
// Scientific calculator

export function openCalculator(host: HTMLElement): void {
  const body = floatingPanel(host, { id: 'calc', title: 'Calculator', iconName: 'calc', width: 340 });
  if (!body) return;
  const keys = [
    ['sin(', 'cos(', 'tan(', 'π', 'e'],
    ['√(', '^', 'ln(', 'log(', '!'],
    ['7', '8', '9', '(', ')'],
    ['4', '5', '6', '×', '÷'],
    ['1', '2', '3', '+', '−'],
    ['0', '.', 'Ans', 'C', '='],
  ];
  body.innerHTML = `<div class="calc-screen"><div class="calc-expr" data-hist></div><input class="calc-input" data-in placeholder="0" inputmode="decimal"></div>
  <div class="row gap small muted"><label class="check"><input type="radio" name="ang" value="rad" checked> Rad</label><label class="check"><input type="radio" name="ang" value="deg"> Deg</label><button class="btn small" data-k="⌫" style="margin-left:auto">⌫</button></div>
  <div class="calc-keys">${keys.flat().map((k) => `<button class="key ${k === '=' ? 'eq' : /[0-9.]/.test(k) ? 'num' : ''}" data-k="${k}">${k}</button>`).join('')}</div>`;
  const input = body.querySelector('[data-in]') as HTMLInputElement;
  const hist = body.querySelector('[data-hist]') as HTMLElement;
  let ans = 0;
  const calc = () => {
    try {
      let src = input.value.replace(/Ans/g, `(${ans})`).replace(/π/g, 'pi');
      if ((body.querySelector('input[name=ang]:checked') as HTMLInputElement).value === 'deg') {
        src = src.replace(/\b(sin|cos|tan)\(/g, '$1(pi/180*');
      }
      // Auto-close parentheses.
      const open = (src.match(/\(/g) ?? []).length - (src.match(/\)/g) ?? []).length;
      src += ')'.repeat(Math.max(0, open));
      const v = evaluate(src);
      hist.textContent = `${input.value} =`;
      ans = v;
      input.value = formatNumber(v);
    } catch {
      hist.textContent = 'Error';
    }
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') calc();
  });
  body.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest('button')?.dataset.k;
    if (!k) return;
    if (k === '=') calc();
    else if (k === 'C') {
      input.value = '';
      hist.textContent = '';
    } else if (k === '⌫') input.value = input.value.slice(0, -1);
    else input.value += k;
  });
}
