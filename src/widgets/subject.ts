import type { Board } from '../board';
import { uid } from '../geometry';
import { compile } from '../mathexpr';
import { drawEl } from '../renderer';
import { store } from '../store';
import type { ChemEl, GraphEl, ImageEl } from '../types';
import { esc, floatingPanel, toast } from '../ui/panel';
import { CATEGORY_COLORS, CATEGORY_NAMES, type ChemCategory, ELEMENTS } from './elements-data';

function centerOfView(board: Board): [number, number] {
  const v = board.viewRect();
  return [v.x + v.w / 2, v.y + v.h / 2];
}

function selectNew(ids: string[]): void {
  store.setTool({ tool: 'select' });
  store.select(ids);
}

// ---------------------------------------------------------------------------
// Function grapher

export function openGrapher(host: HTMLElement, board: Board, edit?: GraphEl): void {
  const body = floatingPanel(host, { id: 'grapher', title: 'Function Graph', iconName: 'graph', width: 380 }, false);
  if (!body) return;
  const exprs = edit?.exprs ?? ['sin(x)', 'x^2/4 - 2'];
  body.innerHTML = `
    <div class="muted small">Type functions of x — e.g. <code>2x+1</code>, <code>x^2</code>, <code>sin x</code>, <code>sqrt(x)</code>, <code>abs(x)</code></div>
    <div data-list></div>
    <button class="btn small" data-a="add">+ Add function</button>
    <div class="grid4">
      <label>x min<input type="number" data-r="xmin" value="${edit?.xmin ?? -10}"></label>
      <label>x max<input type="number" data-r="xmax" value="${edit?.xmax ?? 10}"></label>
      <label>y min<input type="number" data-r="ymin" value="${edit?.ymin ?? -6}"></label>
      <label>y max<input type="number" data-r="ymax" value="${edit?.ymax ?? 6}"></label>
    </div>
    <canvas class="graph-preview" width="680" height="420"></canvas>
    <button class="btn primary wide" data-a="insert">${edit ? 'Update graph' : 'Insert on board'}</button>`;
  const list = body.querySelector('[data-list]') as HTMLElement;
  const preview = body.querySelector('canvas')!;
  const addRow = (v: string) => {
    const row = document.createElement('div');
    row.className = 'row gap expr-row';
    row.innerHTML = `<span>y =</span><input class="grow" value="${esc(v)}"><button class="icon-btn small" title="Remove">×</button>`;
    row.querySelector('button')!.onclick = () => {
      row.remove();
      update();
    };
    row.querySelector('input')!.addEventListener('input', update);
    row.querySelector('input')!.addEventListener('keydown', (e) => e.stopPropagation());
    list.appendChild(row);
  };
  const read = (): GraphEl => {
    const num = (k: string) => Number((body.querySelector(`[data-r=${k}]`) as HTMLInputElement).value);
    let xmin = num('xmin'), xmax = num('xmax'), ymin = num('ymin'), ymax = num('ymax');
    if (!(xmax > xmin)) [xmin, xmax] = [-10, 10];
    if (!(ymax > ymin)) [ymin, ymax] = [-6, 6];
    const ex = [...list.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
    return { id: edit?.id ?? uid(), type: 'graph', exprs: ex, xmin, xmax, ymin, ymax, x: edit?.x ?? 0, y: edit?.y ?? 0, w: edit?.w ?? 680, h: edit?.h ?? 420, rot: edit?.rot ?? 0 };
  };
  const update = () => {
    const g = read();
    list.querySelectorAll('input').forEach((i) => {
      try {
        if (i.value.trim()) compile(i.value);
        i.classList.remove('bad');
      } catch {
        i.classList.add('bad');
      }
    });
    const ctx = preview.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, preview.width, preview.height);
    drawEl(ctx, { ...g, x: 0, y: 0, w: preview.width, h: preview.height, rot: 0 });
  };
  exprs.forEach(addRow);
  body.querySelectorAll('[data-r]').forEach((i) => i.addEventListener('input', update));
  body.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (a === 'add') {
      addRow('');
      update();
    }
    if (a === 'insert') {
      const g = read();
      if (!g.exprs.length) return toast('Add at least one function');
      if (edit && store.page.els.some((x) => x.id === edit.id)) {
        store.mapEls(new Set([edit.id]), () => g);
      } else {
        const [cx, cy] = centerOfView(board);
        g.x = cx - g.w / 2;
        g.y = cy - g.h / 2;
        store.addEls([g]);
        selectNew([g.id]);
      }
    }
  });
  update();
}

// ---------------------------------------------------------------------------
// Periodic table

export function openPeriodicTable(host: HTMLElement, board: Board): void {
  const body = floatingPanel(host, { id: 'ptable', title: 'Periodic Table — tap an element to place it', iconName: 'atom', width: Math.min(window.innerWidth - 24, 980), className: 'wide-panel' });
  if (!body) return;
  const cells = ELEMENTS.map(
    (e) =>
      `<button class="pt-cell" style="grid-column:${e.col};grid-row:${e.row};background:${CATEGORY_COLORS[e.cat]}" data-z="${e.z}" title="${e.name} (${e.mass})"><small>${e.z}</small><b>${e.sym}</b><i>${e.name}</i></button>`,
  ).join('');
  const legend = (Object.keys(CATEGORY_NAMES) as ChemCategory[]).map((k) => `<span><i style="background:${CATEGORY_COLORS[k]}"></i>${CATEGORY_NAMES[k]}</span>`).join('');
  body.innerHTML = `<div class="pt-grid">${cells}<div class="pt-gap" style="grid-column:3;grid-row:6">57–71</div><div class="pt-gap" style="grid-column:3;grid-row:7">89–103</div><div class="pt-spacer" style="grid-row:8"></div></div><div class="pt-legend">${legend}</div>
  <div class="pt-info muted small" data-info>Hover or tap an element for details.</div>`;
  const info = body.querySelector('[data-info]') as HTMLElement;
  body.addEventListener('pointerover', (e) => {
    const z = (e.target as HTMLElement).closest('[data-z]') as HTMLElement | null;
    if (!z) return;
    const el = ELEMENTS[Number(z.dataset.z) - 1];
    info.innerHTML = `<b>${el.name}</b> (${el.sym}) — Atomic number ${el.z}, atomic mass ${el.mass}, ${CATEGORY_NAMES[el.cat]}`;
  });
  let n = 0;
  body.addEventListener('click', (e) => {
    const z = (e.target as HTMLElement).closest('[data-z]') as HTMLElement | null;
    if (!z) return;
    const [cx, cy] = centerOfView(board);
    const off = (n++ % 6) * 30;
    const el: ChemEl = { id: uid(), type: 'chem', z: Number(z.dataset.z), x: cx - 80 + off, y: cy - 90 + off, w: 160, h: 180, rot: 0 };
    store.addEls([el]);
    selectNew([el.id]);
  });
}

// ---------------------------------------------------------------------------
// Subject stamp library (physics circuits, chemistry apparatus, maths)

const S = (inner: string, w = 120, h = 120) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const STAMPS: Record<string, { name: string; svg: string }[]> = {
  Physics: [
    { name: 'Cell', svg: S('<path d="M10 60h40M70 60h40M50 40v40M70 50v20" />', 120, 120) },
    { name: 'Battery', svg: S('<path d="M5 60h25M115 60H90M30 40v40M42 50v20M78 40v40M90 50v20"/><path d="M50 60h20" stroke-dasharray="4 5"/>') },
    { name: 'Resistor', svg: S('<path d="M5 60h25M95 60h20"/><rect x="30" y="48" width="65" height="24"/>') },
    { name: 'Variable resistor', svg: S('<path d="M5 60h25M95 60h20"/><rect x="30" y="48" width="65" height="24"/><path d="M30 95L95 25M85 25h10v10"/>') },
    { name: 'Bulb', svg: S('<path d="M5 60h30M85 60h30"/><circle cx="60" cy="60" r="25"/><path d="M42 42l36 36M78 42L42 78"/>') },
    { name: 'Switch (open)', svg: S('<path d="M5 70h30M85 70h30M35 70l45-25"/><circle cx="35" cy="70" r="3" fill="#0f172a"/><circle cx="85" cy="70" r="3" fill="#0f172a"/>') },
    { name: 'Switch (closed)', svg: S('<path d="M5 70h110"/><circle cx="35" cy="70" r="3" fill="#0f172a"/><circle cx="85" cy="70" r="3" fill="#0f172a"/>') },
    { name: 'Ammeter', svg: S('<path d="M5 60h30M85 60h30"/><circle cx="60" cy="60" r="25"/><text x="60" y="70" font-size="28" text-anchor="middle" fill="#0f172a" stroke="none" font-family="sans-serif" font-weight="700">A</text>') },
    { name: 'Voltmeter', svg: S('<path d="M5 60h30M85 60h30"/><circle cx="60" cy="60" r="25"/><text x="60" y="70" font-size="28" text-anchor="middle" fill="#0f172a" stroke="none" font-family="sans-serif" font-weight="700">V</text>') },
    { name: 'Diode', svg: S('<path d="M5 60h35M80 60h35M40 38v44l40-22zM80 38v44"/>') },
    { name: 'Capacitor', svg: S('<path d="M5 60h47M68 60h47M52 35v50M68 35v50"/>') },
    { name: 'Earth', svg: S('<path d="M60 10v50M30 60h60M40 75h40M50 90h20"/>') },
    { name: 'Convex lens', svg: S('<path d="M60 10c22 25 22 75 0 100c-22-25-22-75 0-100z"/>') },
    { name: 'Concave lens', svg: S('<path d="M40 10h40c-14 30-14 70 0 100H40c14-30 14-70 0-100z"/>') },
    { name: 'Magnet', svg: S('<rect x="10" y="40" width="50" height="40" fill="#ef4444"/><rect x="60" y="40" width="50" height="40" fill="#3b82f6"/><text x="35" y="68" font-size="22" text-anchor="middle" fill="#fff" stroke="none" font-family="sans-serif" font-weight="700">N</text><text x="85" y="68" font-size="22" text-anchor="middle" fill="#fff" stroke="none" font-family="sans-serif" font-weight="700">S</text>') },
    { name: 'Pulley', svg: S('<circle cx="60" cy="40" r="25"/><circle cx="60" cy="40" r="4" fill="#0f172a"/><path d="M60 5v10M35 40v60M85 40v40"/><rect x="72" y="80" width="26" height="26"/>') },
  ],
  Chemistry: [
    { name: 'Beaker', svg: S('<path d="M25 15h70M30 15v85a8 8 0 0 0 8 8h44a8 8 0 0 0 8-8V15"/><path d="M30 60h60" stroke="#3b82f6"/><path d="M31 61h58v39a7 7 0 0 1-7 7H38a7 7 0 0 1-7-7z" fill="#93c5fd" stroke="none" opacity=".6"/><path d="M80 30h10M80 45h10M80 75h10M80 90h10"/>') },
    { name: 'Conical flask', svg: S('<path d="M48 10h24M50 10v35L20 100a6 6 0 0 0 5 9h70a6 6 0 0 0 5-9L70 45V10"/><path d="M33 78h54l11 21a5 5 0 0 1-4 8H26a5 5 0 0 1-4-8z" fill="#86efac" stroke="none" opacity=".7"/>') },
    { name: 'Round flask', svg: S('<path d="M50 8h20M52 8v40a32 32 0 1 0 16 0V8"/><path d="M32 80a28 28 0 0 0 56 0z" fill="#fca5a5" stroke="none" opacity=".7"/>') },
    { name: 'Test tube', svg: S('<path d="M45 8h30M50 8v90a10 10 0 0 0 20 0V8"/><path d="M51 60h18v38a9 9 0 0 1-18 0z" fill="#c4b5fd" stroke="none" opacity=".8"/>') },
    { name: 'Measuring cylinder', svg: S('<path d="M40 8v100h40V8M30 108h60M40 8h40"/><path d="M41 50h38v57H41z" fill="#93c5fd" stroke="none" opacity=".6"/><path d="M40 25h10M40 40h15M40 55h10M40 70h15M40 85h10"/>') },
    { name: 'Funnel', svg: S('<path d="M15 15h90L68 60v50H52V60z"/>') },
    { name: 'Burner', svg: S('<path d="M45 110h30M50 110V60h20v50M35 110h50"/><path d="M60 55c-12-10-6-25 0-40c6 15 12 30 0 40z" fill="#fb923c" stroke="#ea580c"/>') },
    { name: 'Tripod stand', svg: S('<path d="M15 40h90M25 40l-12 70M95 40l12 70M60 40v70"/>') },
    { name: 'Burette', svg: S('<path d="M52 5h16v80l-4 6v10h-8V91l-4-6z"/><path d="M45 90h30"/><path d="M52 15h6M52 30h6M52 45h6M52 60h6M52 75h6"/>') },
    { name: 'Benzene ring', svg: S('<path d="M60 15l39 22.5v45L60 105 21 82.5v-45z"/><circle cx="60" cy="60" r="24"/>') },
    { name: 'Water (H₂O)', svg: S('<circle cx="60" cy="55" r="22" fill="#ef4444" stroke="none"/><circle cx="28" cy="85" r="14" fill="#e2e8f0"/><circle cx="92" cy="85" r="14" fill="#e2e8f0"/><path d="M45 70l-8 6M75 70l8 6"/><text x="60" y="62" font-size="20" text-anchor="middle" fill="#fff" stroke="none" font-family="sans-serif" font-weight="700">O</text>') },
    { name: 'Atom model', svg: S('<circle cx="60" cy="60" r="10" fill="#ef4444" stroke="none"/><ellipse cx="60" cy="60" rx="50" ry="18"/><ellipse cx="60" cy="60" rx="50" ry="18" transform="rotate(60 60 60)"/><ellipse cx="60" cy="60" rx="50" ry="18" transform="rotate(120 60 60)"/><circle cx="110" cy="60" r="5" fill="#3b82f6" stroke="none"/>') },
  ],
  Biology: [
    { name: 'Cell', svg: S('<ellipse cx="60" cy="60" rx="52" ry="40" fill="#dcfce7"/><circle cx="62" cy="58" r="15" fill="#a78bfa"/><circle cx="62" cy="58" r="5" fill="#4c1d95" stroke="none"/><ellipse cx="30" cy="70" rx="8" ry="4"/><ellipse cx="90" cy="45" rx="8" ry="4"/>') },
    { name: 'Leaf', svg: S('<path d="M15 105C15 45 55 15 105 15c0 50-30 90-90 90z" fill="#86efac"/><path d="M15 105L80 40M45 75l-2-18M60 60l-1-16M45 75l18 1M60 60l17 1"/>') },
    { name: 'Heart', svg: S('<path d="M60 105S12 75 12 42a24 24 0 0 1 48-6 24 24 0 0 1 48 6c0 33-48 63-48 63z" fill="#fca5a5"/>') },
    { name: 'Eye', svg: S('<path d="M8 60s20-35 52-35 52 35 52 35-20 35-52 35S8 60 8 60z"/><circle cx="60" cy="60" r="18" fill="#93c5fd"/><circle cx="60" cy="60" r="7" fill="#0f172a"/>') },
  ],
  Maths: [
    { name: 'Number line', svg: S('<path d="M5 60h230M225 52l10 8-10 8M15 52l-10 8 10 8"/>' + Array.from({ length: 11 }, (_, i) => `<path d="M${20 + i * 20} 52v16"/><text x="${20 + i * 20}" y="88" font-size="13" text-anchor="middle" fill="#0f172a" stroke="none" font-family="sans-serif">${i - 5}</text>`).join(''), 240, 100) },
    { name: 'Fraction ½', svg: S('<circle cx="60" cy="60" r="48"/><path d="M60 12a48 48 0 0 1 0 96z" fill="#fde68a"/><path d="M60 12v96"/>') },
    { name: 'Fraction ¼', svg: S('<circle cx="60" cy="60" r="48"/><path d="M60 60V12a48 48 0 0 1 48 48z" fill="#fde68a"/><path d="M60 12v96M12 60h96"/>') },
    { name: 'Clock face', svg: S('<circle cx="60" cy="60" r="50"/>' + Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return `<text x="${60 + Math.sin(a) * 38}" y="${65 - Math.cos(a) * 38}" font-size="12" text-anchor="middle" fill="#0f172a" stroke="none" font-family="sans-serif">${i || 12}</text>`; }).join('') + '<circle cx="60" cy="60" r="3" fill="#0f172a"/>') },
    { name: 'Coordinate grid', svg: S(Array.from({ length: 11 }, (_, i) => `<path d="M${10 + i * 10} 10v100M10 ${10 + i * 10}h100" stroke="#cbd5e1" stroke-width="1"/>`).join('') + '<path d="M60 5v110M5 60h110" />') },
    { name: 'Tally marks', svg: S('<path d="M20 25v70M35 25v70M50 25v70M65 25v70M10 80l70-40"/>') },
  ],
};

export function openStamps(host: HTMLElement, board: Board, initial = 'Physics'): void {
  const body = floatingPanel(host, { id: 'stamps', title: 'Subject Library', iconName: 'flask', width: 460 }, false);
  if (!body) return;
  const tabs = Object.keys(STAMPS);
  const render = (tab: string) => {
    body.innerHTML = `<div class="seg">${tabs.map((t) => `<button class="${t === tab ? 'on' : ''}" data-tab="${t}">${t}</button>`).join('')}</div>
      <div class="stamp-grid">${STAMPS[tab].map((s, i) => `<button class="stamp" data-i="${i}" title="${esc(s.name)}"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg)}" alt=""><span>${esc(s.name)}</span></button>`).join('')}</div>`;
    body.dataset.tab = tab;
  };
  render(tabs.includes(initial) ? initial : tabs[0]);
  let n = 0;
  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.tab) render(b.dataset.tab);
    if (b.dataset.i) {
      const s = STAMPS[body.dataset.tab!][Number(b.dataset.i)];
      const m = /viewBox="0 0 (\d+) (\d+)"/.exec(s.svg)!;
      const w = Number(m[1]) * 1.6, h = Number(m[2]) * 1.6;
      const [cx, cy] = centerOfView(board);
      const off = (n++ % 6) * 24;
      const el: ImageEl = { id: uid(), type: 'image', src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg)}`, x: cx - w / 2 + off, y: cy - h / 2 + off, w, h, rot: 0 };
      store.addEls([el]);
      selectNew([el.id]);
    }
  });
}
