// Notebook covers: optional looks for a notebook in My notebooks.
// Calm and simple: a flat colour, one fine line drawing (science, flowers)
// in semi-transparent lines, a short rule and the name. No gradients, no
// frames, nothing busy. A tall notebook gets a tall cover, a wide one a
// wide cover. Made of CSS and tiny inline drawings: nothing is downloaded.

export interface Cover {
  id: string;
  name: string;
  /** Flat cover colour. */
  bg: string;
  /** Colour of the name and the small mark. */
  ink: string;
  /** The line drawing, as an inline picture. */
  art: string;
}

// ---- tiny drawing helpers (picture is 100 x 100, lines only) -------------------

const line = (c: string, w = 1.1, o = 0.7) => `fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'`;
const soft = (c: string, o = 0.08) => `fill='${c}' fill-opacity='${o}' stroke='none'`;
const num = (n: number) => Math.round(n * 10) / 10;

/** A drawing as a CSS background picture. */
const pic = (body: string): string => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>${body}</svg>`).replace(/'/g, '%27')}")`;

/** A sine line across the picture. */
function sine(y: number, amp: number, waves: number, phase = 0): string {
  let d = '';
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * 100;
    d += `${i ? 'L' : 'M'}${num(x)} ${num(y + amp * Math.sin((x / 100) * waves * 2 * Math.PI + phase))}`;
  }
  return d;
}

function atom(c: string): string {
  return pic(
    `<circle cx='50' cy='50' r='42' ${soft(c, 0.06)}/><g ${line(c, 1.1, 0.7)}><ellipse cx='50' cy='50' rx='42' ry='15'/><ellipse cx='50' cy='50' rx='42' ry='15' transform='rotate(60 50 50)'/><ellipse cx='50' cy='50' rx='42' ry='15' transform='rotate(120 50 50)'/></g><circle cx='50' cy='50' r='4.5' fill='${c}' fill-opacity='0.9'/><g fill='${c}' fill-opacity='0.85'><circle cx='92' cy='50' r='2.4'/><circle cx='71' cy='86.4' r='2.4'/><circle cx='29' cy='86.4' r='2.4'/></g>`,
  );
}

function flask(c: string): string {
  return pic(
    `<path d='M30 62 H70 L77 79 Q78 83 74 83 H26 Q22 83 23 79 Z' ${soft(c, 0.16)}/><g ${line(c, 1.2, 0.75)}><path d='M41 14 H59'/><path d='M44 14 V38 L22 80 Q19 87 27 87 H73 Q81 87 78 80 L56 38 V14'/><path d='M30 62 H70' opacity='0.6'/></g><g ${line(c, 1, 0.6)}><circle cx='46' cy='50' r='2.2'/><circle cx='53' cy='44' r='1.6'/><circle cx='50' cy='33' r='1.2'/><circle cx='44' cy='70' r='1.8'/><circle cx='58' cy='72' r='2.4'/></g>`,
  );
}

function dna(c: string): string {
  const n = 64;
  let a = '', b = '', rungs = '';
  for (let i = 0; i <= n; i++) {
    const y = 8 + (i / n) * 84;
    const s = Math.sin((i / n) * 4 * Math.PI);
    const x1 = 50 + 22 * s, x2 = 50 - 22 * s;
    a += `${i ? 'L' : 'M'}${num(x1)} ${num(y)}`;
    b += `${i ? 'L' : 'M'}${num(x2)} ${num(y)}`;
    if (i % 4 === 2) rungs += `M${num(x1)} ${num(y)}L${num(x2)} ${num(y)}`;
  }
  return pic(`<g ${line(c, 1.3, 0.8)}><path d='${a}'/><path d='${b}'/></g><path d='${rungs}' ${line(c, 0.9, 0.45)}/>`);
}

function orbit(c: string): string {
  return pic(
    `<g ${line(c, 0.9, 0.7)} transform='rotate(-22 50 50)'><ellipse cx='50' cy='50' rx='46' ry='17'/><ellipse cx='50' cy='50' rx='34' ry='12'/><ellipse cx='50' cy='50' rx='22' ry='7.5'/></g><circle cx='50' cy='50' r='5' fill='${c}' fill-opacity='0.9'/><g fill='${c}' fill-opacity='0.85'><circle cx='91' cy='34' r='2.6'/><circle cx='16' cy='66' r='2'/><circle cx='70' cy='56' r='1.6'/></g>`,
  );
}

function wave(c: string): string {
  return pic(`<g ${line(c, 1.2, 0.8)}><path d='${sine(34, 9, 2)}'/></g><g ${line(c, 1.2, 0.6)}><path d='${sine(46, 9, 2, 0.5)}'/></g><g ${line(c, 1.2, 0.45)}><path d='${sine(58, 9, 2, 1)}'/></g><g ${line(c, 1.2, 0.3)}><path d='${sine(70, 9, 2, 1.5)}'/></g>`);
}

function bloom(c: string): string {
  let petals = '';
  for (let a = 0; a < 360; a += 45) petals += `<ellipse cx='50' cy='27' rx='7.5' ry='15' transform='rotate(${a} 50 44)'/>`;
  return pic(
    `<circle cx='50' cy='44' r='30' ${soft(c, 0.06)}/><g ${line(c, 1.1, 0.75)}>${petals}<circle cx='50' cy='44' r='5.5'/><path d='M50 66 C50 78 46 86 48 96'/><path d='M49 82 C38 78 30 82 28 88 C38 92 46 90 49 82 Z'/><path d='M49 76 C60 72 68 76 70 82 C60 86 52 84 49 76 Z'/></g>`,
  );
}

function lotus(c: string): string {
  const petal = (rot: number, o: number) => `<path d='M50 80 C35 63 37 38 50 20 C63 38 65 63 50 80 Z' transform='rotate(${rot} 50 80)' stroke-opacity='${o}'/>`;
  return pic(
    `<g ${line(c, 1.1, 0.8)}>${petal(-56, 0.5)}${petal(56, 0.5)}${petal(-28, 0.7)}${petal(28, 0.7)}${petal(0, 0.9)}</g><g ${line(c, 1, 0.5)}><path d='M14 86 Q32 79 50 86 T86 86'/><path d='M26 93 Q40 88 54 93 T82 93' opacity='0.6'/></g>`,
  );
}

function leaf(c: string): string {
  const almond = (y: number, side: 1 | -1, k: number) =>
    `<path d='M0 0 C6 -8 18 -8 25 0 C18 8 6 8 0 0 Z' transform='translate(50 ${y}) ${side === 1 ? 'rotate(-34)' : 'rotate(214)'} scale(${k})'/>`;
  return pic(
    `<g ${line(c, 1.1, 0.8)}><path d='M50 96 C46 72 54 46 50 6'/>${almond(78, 1, 1.15)}${almond(70, -1, 1.15)}${almond(58, 1, 1)}${almond(50, -1, 1)}${almond(38, 1, 0.85)}${almond(30, -1, 0.85)}${almond(18, 1, 0.65)}${almond(12, -1, 0.6)}</g>`,
  );
}

function magnet(c: string): string {
  return pic(
    `<path d='M28 18 V54 A22 22 0 0 0 72 54 V18 H60 V54 A10 10 0 0 1 40 54 V18 Z' ${soft(c, 0.1)}/><g ${line(c, 1.2, 0.8)}><path d='M28 18 V54 A22 22 0 0 0 72 54 V18 H60 V54 A10 10 0 0 1 40 54 V18 Z'/><path d='M28 30 H40 M60 30 H72'/></g><g ${line(c, 1, 0.4)}><path d='M34 12 C34 -2 66 -2 66 12'/><path d='M30 8 C30 -10 70 -10 70 8' opacity='0.6'/></g>`,
  );
}

function molecule(c: string): string {
  return pic(
    `<g ${line(c, 1.2, 0.8)}><path d='M50 22 L72.5 35 V61 L50 74 L27.5 61 V35 Z'/><circle cx='50' cy='48' r='15' opacity='0.5'/><path d='M72.5 35 L88 26 M27.5 61 L12 70 M50 22 V10'/></g><g ${line(c, 1.1, 0.8)}><circle cx='90' cy='25' r='4'/><circle cx='10' cy='71' r='4'/><circle cx='50' cy='8' r='3'/></g>`,
  );
}

function prism(c: string): string {
  return pic(
    `<path d='M50 22 L80 74 H20 Z' ${soft(c, 0.1)}/><g ${line(c, 1.2, 0.8)}><path d='M50 22 L80 74 H20 Z'/><path d='M4 62 L38 52'/></g><g ${line(c, 1.1, 0.8)}><path d='M64 50 L98 36'/></g><g ${line(c, 1.1, 0.6)}><path d='M64 50 L98 46'/></g><g ${line(c, 1.1, 0.45)}><path d='M64 50 L98 56'/></g><g ${line(c, 1.1, 0.3)}><path d='M64 50 L98 66'/></g>`,
  );
}

function pencil(c: string): string {
  return pic(
    `<g transform='rotate(-35 50 50)'><rect x='38' y='10' width='24' height='62' rx='2' ${soft(c, 0.08)}/><g ${line(c, 1.2, 0.8)}><rect x='38' y='10' width='24' height='62' rx='2'/><path d='M38 72 L50 94 L62 72'/><path d='M38 24 H62'/><path d='M46 10 V72 M54 10 V72' opacity='0.35'/></g></g>`,
  );
}

const WHITE = '#ffffff';

export const COVERS: Cover[] = [
  { id: 'atom', name: 'Atom', bg: '#17233f', ink: WHITE, art: atom(WHITE) },
  { id: 'flask', name: 'Flask', bg: '#0e6b63', ink: WHITE, art: flask(WHITE) },
  { id: 'dna', name: 'DNA', bg: '#4a2c6d', ink: WHITE, art: dna(WHITE) },
  { id: 'orbit', name: 'Orbit', bg: '#101014', ink: '#f1e6c8', art: orbit('#d9ad4f') },
  { id: 'wave', name: 'Wave', bg: '#1e4fb8', ink: WHITE, art: wave(WHITE) },
  { id: 'bloom', name: 'Bloom', bg: '#46705a', ink: '#f6f3e8', art: bloom('#f6f3e8') },
  { id: 'lotus', name: 'Lotus', bg: '#b8506b', ink: WHITE, art: lotus(WHITE) },
  { id: 'leaf', name: 'Leaf', bg: '#1b4a30', ink: '#f1f4e6', art: leaf('#f1f4e6') },
  { id: 'magnet', name: 'Magnet', bg: '#a52a22', ink: WHITE, art: magnet(WHITE) },
  { id: 'molecule', name: 'Molecule', bg: '#2c313c', ink: WHITE, art: molecule(WHITE) },
  { id: 'prism', name: 'Prism', bg: '#34308f', ink: WHITE, art: prism(WHITE) },
  { id: 'paper', name: 'Pencil', bg: '#eee5d0', ink: '#3a2e1a', art: pencil('#3a2e1a') },
];

/** Names used by earlier versions of the covers, so earlier choices still show. */
const LEGACY: Record<string, string> = {
  ocean: 'wave', sunset: 'lotus', royal: 'atom', forest: 'leaf', ruby: 'magnet', midnight: 'orbit', graphite: 'molecule', galaxy: 'orbit',
  sunrise: 'lotus', topo: 'leaf', blueprint: 'prism', ink: 'orbit', rose: 'bloom', neon: 'dna', mint: 'flask', aurora: 'molecule',
};

export function coverById(id: string | undefined): Cover | undefined {
  if (!id) return undefined;
  const k = LEGACY[id] ?? id;
  return COVERS.find((c) => c.id === k);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

// The looks live in the stylesheet (one rule per cover), added once.
if (typeof document !== 'undefined') {
  document.getElementById('teachly-covers')?.remove();
  const st = document.createElement('style');
  st.id = 'teachly-covers';
  st.textContent = COVERS.map((c) => `.nbc[data-c="${c.id}"]{--cv:${c.bg};--ci:${c.ink};--ca:${c.art}}`).join('\n');
  document.head.appendChild(st);
}

/** The cover as HTML. `portrait`: a tall notebook (tall cover) or a wide one (wide cover). */
export function coverHTML(c: Cover, title: string, portrait: boolean): string {
  return `<span class="nbc" data-c="${c.id}" data-o="${portrait ? 'p' : 'l'}"><span class="nbc-art"></span><span class="nbc-brand">Teachly</span><span class="nbc-tw"><i class="nbc-rule"></i><span class="nbc-t">${esc(title)}</span></span></span>`;
}
