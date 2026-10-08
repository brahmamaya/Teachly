import type { Board } from '../board';
import { uid } from '../geometry';
import { compile, fmtNum } from '../mathexpr';
import { isDarkColor, measureText } from '../renderer';
import { store } from '../store';
import type { TextEl } from '../types';
import { beep, floatingPanel, toast } from '../ui/panel';

// Classroom tools: random student picker, team scoreboard and calculator.

function loadJSON<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : def;
  } catch {
    return def;
  }
}
function saveJSON(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// ---------------------------------------------------------------------------
// Random picker

export function openPicker(host: HTMLElement): void {
  const body = floatingPanel(host, { id: 'picker', title: 'Random picker', iconName: 'dice', width: 360 });
  if (!body) return;
  const st = loadJSON('teachly.picker', { names: '', mode: 'numbers' as 'numbers' | 'names', max: 40, norepeat: true });
  let used = new Set<string>();
  body.innerHTML = `
    <div class="seg"><button data-mode="numbers">Roll numbers</button><button data-mode="names">Student names</button></div>
    <div data-numbers class="row gap center">From 1 to <input type="number" class="pk-max" min="2" max="999" value="${st.max}"></div>
    <textarea data-names class="pk-names" rows="5" placeholder="One name per line">${esc(st.names)}</textarea>
    <div class="pk-show" data-show>?</div>
    <label class="check"><input type="checkbox" data-norepeat ${st.norepeat ? 'checked' : ''}> Don't pick the same one twice</label>
    <button class="btn primary wide" data-pick>Pick</button>
    <div class="muted small center" data-left></div>`;
  const show = body.querySelector('[data-show]') as HTMLElement;
  const left = body.querySelector('[data-left]') as HTMLElement;
  const pool = (): string[] => {
    if (st.mode === 'numbers') return Array.from({ length: Math.max(2, Math.min(999, st.max)) }, (_, i) => String(i + 1));
    return st.names.split('\n').map((s) => s.trim()).filter(Boolean);
  };
  const sync = () => {
    body.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === st.mode));
    (body.querySelector('[data-numbers]') as HTMLElement).hidden = st.mode !== 'numbers';
    (body.querySelector('[data-names]') as HTMLElement).hidden = st.mode !== 'names';
    const all = pool();
    left.textContent = st.norepeat && used.size ? `${all.filter((x) => !used.has(x)).length} of ${all.length} left` : '';
    saveJSON('teachly.picker', st);
  };
  let busy = false;
  body.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.classList.contains('pk-max')) st.max = Number(el.value) || 40;
    if (el.classList.contains('pk-names')) st.names = el.value;
    if (el.dataset.norepeat !== undefined) st.norepeat = el.checked;
    used = new Set();
    sync();
  });
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.mode) {
      st.mode = b.dataset.mode as 'names';
      used = new Set();
      show.textContent = '?';
      sync();
    } else if (b.dataset.pick !== undefined && !busy) {
      const all = pool();
      if (!all.length) return toast('Type the names first, one per line');
      let choices = st.norepeat ? all.filter((x) => !used.has(x)) : all;
      if (!choices.length) {
        used = new Set();
        choices = all;
        toast('Everyone has had a turn — starting again');
      }
      const pick = choices[Math.floor(Math.random() * choices.length)];
      busy = true;
      show.classList.remove('done');
      // Shuffle through names, slowing down, then land on the pick.
      let i = 0;
      const steps = 16;
      const tick = () => {
        if (i < steps) {
          show.textContent = all[Math.floor(Math.random() * all.length)];
          beep(500 + i * 20, 25, 1);
          i++;
          window.setTimeout(tick, 40 + i * i * 1.4);
        } else {
          show.textContent = pick;
          show.classList.add('done');
          beep(880, 180, 2);
          used.add(pick);
          busy = false;
          sync();
        }
      };
      tick();
    }
  });
  sync();
}

// ---------------------------------------------------------------------------
// Scoreboard

interface Team {
  name: string;
  score: number;
}

export function openScoreboard(host: HTMLElement): void {
  const body = floatingPanel(host, { id: 'score', title: 'Scoreboard', iconName: 'score', width: 420 });
  if (!body) return;
  const teams = loadJSON<Team[]>('teachly.score', [
    { name: 'Team A', score: 0 },
    { name: 'Team B', score: 0 },
  ]);
  const colors = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#a78bfa', '#fb923c'];
  const render = () => {
    const top = Math.max(...teams.map((t) => t.score));
    body.innerHTML = `
      <div class="sb-teams">${teams
        .map(
          (t, i) => `<div class="sb-team ${t.score === top && top > 0 ? 'lead' : ''}" style="--c:${colors[i % colors.length]}">
          <input class="sb-name" data-i="${i}" value="${esc(t.name)}" aria-label="Team name">
          <div class="sb-score">${t.score}</div>
          <div class="sb-btns"><button class="btn" data-i="${i}" data-d="-1">−1</button><button class="btn primary" data-i="${i}" data-d="1">+1</button><button class="btn" data-i="${i}" data-d="5">+5</button></div>
        </div>`,
        )
        .join('')}</div>
      <div class="row gap"><button class="btn grow" data-add ${teams.length >= 6 ? 'disabled' : ''}>+ Team</button><button class="btn grow" data-remove ${teams.length <= 2 ? 'disabled' : ''}>− Team</button><button class="btn grow" data-reset>Reset</button></div>`;
    saveJSON('teachly.score', teams);
  };
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.d) {
      const t = teams[Number(b.dataset.i)];
      t.score = Math.max(0, t.score + Number(b.dataset.d));
      if (Number(b.dataset.d) > 0) beep(660, 90, 1);
    } else if (b.dataset.add !== undefined) teams.push({ name: `Team ${String.fromCharCode(65 + teams.length)}`, score: 0 });
    else if (b.dataset.remove !== undefined) teams.pop();
    else if (b.dataset.reset !== undefined) teams.forEach((t) => (t.score = 0));
    render();
  });
  body.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.classList.contains('sb-name')) {
      teams[Number(el.dataset.i)].name = el.value.trim() || 'Team';
      saveJSON('teachly.score', teams);
    }
  });
  render();
}

// ---------------------------------------------------------------------------
// Calculator

const KEYS = [
  ['sin', 'cos', 'tan', 'deg'],
  ['(', ')', '^', '√'],
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', 'π', '+'],
  ['C', '⌫', 'Ans', '='],
];

export function openCalculator(host: HTMLElement, board: Board): void {
  const body = floatingPanel(host, { id: 'calc', title: 'Calculator', iconName: 'calc', width: 340 });
  if (!body) return;
  let deg = true;
  let ans = 0;
  body.innerHTML = `
    <input class="calc-expr" inputmode="decimal" placeholder="0" aria-label="Expression" autocomplete="off" spellcheck="false">
    <div class="calc-result" data-res>&nbsp;</div>
    <div class="calc-keys">${KEYS.flat().map((k) => `<button class="calc-k ${'=÷×−+'.includes(k) ? 'op' : ''} ${k === '=' ? 'eq' : ''}" data-k="${k}">${k}</button>`).join('')}</div>
    <button class="btn wide" data-board>Write answer on board</button>`;
  const input = body.querySelector('.calc-expr') as HTMLInputElement;
  const res = body.querySelector('[data-res]') as HTMLElement;
  const degBtn = body.querySelector('[data-k=deg]') as HTMLElement;
  const eval_ = (final: boolean) => {
    const src = input.value.replace(/Ans/g, `(${ans})`);
    if (!src.trim()) {
      res.innerHTML = '&nbsp;';
      return null;
    }
    try {
      const v = compile(src, { deg })(0);
      res.textContent = `= ${fmtNum(v)}`;
      res.classList.remove('err');
      if (final) ans = v;
      return v;
    } catch (e) {
      if (final) {
        res.textContent = (e as Error).message;
        res.classList.add('err');
      }
      return null;
    }
  };
  const insert = (t: string) => {
    const a = input.selectionStart ?? input.value.length, b = input.selectionEnd ?? a;
    input.value = input.value.slice(0, a) + t + input.value.slice(b);
    input.setSelectionRange(a + t.length, a + t.length);
  };
  const syncDeg = () => {
    degBtn.textContent = deg ? 'DEG' : 'RAD';
    degBtn.classList.toggle('on', deg);
  };
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    const k = b.dataset.k;
    if (b.dataset.board !== undefined) {
      const v = eval_(true);
      if (v === null) return;
      const text = `${input.value} = ${fmtNum(v)}`;
      const fontSize = 40;
      const m = measureText(text, fontSize, false, 1400, false);
      const r = board.viewRect();
      const el: TextEl = { id: uid(), type: 'text', text, color: isDarkColor(store.page.bg) ? '#ffffff' : '#1e293b', fontSize, x: r.x + r.w / 2 - m.w / 2, y: r.y + r.h / 2 - m.h / 2, w: m.w, h: m.h, rot: 0 };
      store.addEls([el]);
      return;
    }
    if (!k) return;
    if (k === 'C') input.value = '';
    else if (k === '⌫') input.value = input.value.slice(0, -1);
    else if (k === 'deg') {
      deg = !deg;
      syncDeg();
    } else if (k === '=') {
      const v = eval_(true);
      if (v !== null) {
        input.value = fmtNum(v);
        return;
      }
      return;
    } else if (['sin', 'cos', 'tan', '√'].includes(k)) insert(`${k === '√' ? 'sqrt' : k}(`);
    else insert(k);
    eval_(false);
  });
  input.addEventListener('input', () => eval_(false));
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') (body.querySelector('[data-k="="]') as HTMLElement).click();
  });
  syncDeg();
}
