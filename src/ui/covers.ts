// Notebook covers: optional looks for a notebook in My notebooks.
// Teachly's own style: a full-bleed cover with a physics-flavoured design
// (orbits, atom, waves…), a fine inner frame, the notebook's name in big
// letters, a small "Teachly" mark and a bookmark ribbon. A tall notebook
// gets a tall cover, a wide one a wide cover. Drawn with CSS and tiny
// inline pictures only: nothing is downloaded or sent.

export interface Cover {
  id: string;
  name: string;
  /** CSS background of the cover (layers allowed). */
  bg: string;
  /** Colour of the writing on it. */
  ink: string;
  /** Colour of the bookmark ribbon. */
  band: string;
  /** Colour of the fine frame. */
  frame: string;
  /** Pale cover with dark writing: no dark shade under the name. */
  pale?: boolean;
}

/** A small picture as a CSS background layer (scales to cover the whole cover). */
const svg = (body: string): string => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid slice'>${body}</svg>`).replace(/'/g, '%27')}")`;

const lines = (color: string, w = 0.5) => `fill='none' stroke='${color}' stroke-width='${w}'`;

export const COVERS: Cover[] = [
  {
    id: 'orbit',
    name: 'Orbit',
    bg: `${svg(`<g ${lines('rgba(255,255,255,0.4)')}><ellipse cx='50' cy='64' rx='52' ry='19' transform='rotate(-22 50 64)'/><ellipse cx='50' cy='64' rx='38' ry='13' transform='rotate(-22 50 64)'/><ellipse cx='50' cy='64' rx='24' ry='8' transform='rotate(-22 50 64)'/></g><circle cx='80' cy='47' r='2.4' fill='#fff'/><circle cx='28' cy='78' r='1.5' fill='#9fb4ff'/><circle cx='50' cy='64' r='5' fill='#ffd166'/>`)}, radial-gradient(circle at 50% 64%, rgba(255,209,102,0.35), transparent 38%), linear-gradient(165deg, #121c46, #060914)`,
    ink: '#ffffff',
    band: '#ffd166',
    frame: 'rgba(255,255,255,0.3)',
  },
  {
    id: 'atom',
    name: 'Atom',
    bg: `${svg(`<g ${lines('rgba(255,255,255,0.5)', 0.6)}><ellipse cx='50' cy='60' rx='40' ry='14'/><ellipse cx='50' cy='60' rx='40' ry='14' transform='rotate(60 50 60)'/><ellipse cx='50' cy='60' rx='40' ry='14' transform='rotate(120 50 60)'/></g><circle cx='50' cy='60' r='4.2' fill='#fff'/><circle cx='90' cy='60' r='2' fill='#ffd1f3'/><circle cx='30' cy='95' r='2' fill='#ffd1f3'/><circle cx='30' cy='25' r='2' fill='#ffd1f3'/>`)}, linear-gradient(160deg, #8a4bff, #3416a8)`,
    ink: '#ffffff',
    band: '#ff8bd8',
    frame: 'rgba(255,255,255,0.32)',
  },
  {
    id: 'wave',
    name: 'Wave',
    bg: `${svg(`<g ${lines('rgba(255,255,255,0.55)', 0.7)}><path d='M-5 62 Q 10 44 25 62 T 55 62 T 85 62 T 115 62'/><path d='M-5 70 Q 10 52 25 70 T 55 70 T 85 70 T 115 70' opacity='0.7'/><path d='M-5 78 Q 10 60 25 78 T 55 78 T 85 78 T 115 78' opacity='0.45'/><path d='M-5 86 Q 10 68 25 86 T 55 86 T 85 86 T 115 86' opacity='0.25'/></g>`)}, linear-gradient(160deg, #20d8c4, #0b6fbd)`,
    ink: '#ffffff',
    band: '#073b78',
    frame: 'rgba(255,255,255,0.35)',
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    bg: `${svg(`<g ${lines('rgba(255,255,255,0.5)', 0.5)}><path d='M0 78 H100M0 84 H100M0 90 H100M0 96 H100'/></g>`)}, radial-gradient(circle at 50% 76%, #fff3b8 0 11%, #ffd36b 12% 17%, rgba(255,211,107,0) 18%), linear-gradient(180deg, #ff9d5c, #ff4f87 62%, #6f2cff)`,
    ink: '#ffffff',
    band: '#6f2cff',
    frame: 'rgba(255,255,255,0.4)',
  },
  {
    id: 'topo',
    name: 'Terrain',
    bg: `${svg(`<g ${lines('rgba(255,255,255,0.28)', 0.5)}><path d='M-5 30 C 20 10 40 40 62 24 S 100 28 105 18'/><path d='M-5 40 C 22 22 42 50 62 34 S 100 38 105 28'/><path d='M-5 50 C 24 34 44 60 62 44 S 100 48 105 38'/><path d='M-5 60 C 26 46 46 70 62 54 S 100 58 105 48'/><path d='M-5 70 C 28 58 48 80 62 64 S 100 68 105 58'/><path d='M-5 80 C 30 70 50 90 62 74 S 100 78 105 68'/></g>`)}, linear-gradient(160deg, #1b8f62, #0a3b2c)`,
    ink: '#ffffff',
    band: '#f2c14e',
    frame: 'rgba(255,255,255,0.3)',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    bg: `${svg(`<g ${lines('rgba(255,255,255,0.22)', 0.3)}><path d='M10 0V100M20 0V100M30 0V100M40 0V100M50 0V100M60 0V100M70 0V100M80 0V100M90 0V100M0 10H100M0 20H100M0 30H100M0 40H100M0 50H100M0 60H100M0 70H100M0 80H100M0 90H100'/></g><g ${lines('rgba(255,255,255,0.6)', 0.6)}><circle cx='68' cy='62' r='20'/><circle cx='68' cy='62' r='12'/><path d='M48 62H88M68 42V82'/></g>`)}, linear-gradient(160deg, #1a63d6, #0a2d73)`,
    ink: '#ffffff',
    band: '#ffd24a',
    frame: 'rgba(255,255,255,0.4)',
  },
  {
    id: 'ink',
    name: 'Ink',
    bg: `radial-gradient(circle at 80% 8%, rgba(217,173,79,0.22), transparent 45%), linear-gradient(165deg, #1a1a20, #050506)`,
    ink: '#f3e2b3',
    band: '#d9ad4f',
    frame: 'rgba(217,173,79,0.6)',
  },
  {
    id: 'paper',
    name: 'Paper',
    bg: 'radial-gradient(rgba(70, 45, 10, 0.28) 1px, transparent 1.3px) 0 0 / 11px 11px, linear-gradient(165deg, #f6ebd2, #e4cfa5)',
    ink: '#4a3414',
    band: '#c0392b',
    frame: 'rgba(74,52,20,0.4)',
    pale: true,
  },
  {
    id: 'rose',
    name: 'Rose',
    bg: 'radial-gradient(circle at 20% 15%, #ffe0ea, transparent 50%), radial-gradient(circle at 85% 80%, #c9a7ff, transparent 55%), linear-gradient(160deg, #ffb3c8, #f27fa5)',
    ink: '#4a1030',
    band: '#a8326a',
    frame: 'rgba(74,16,48,0.3)',
    pale: true,
  },
  {
    id: 'neon',
    name: 'Neon',
    bg: `${svg(`<g ${lines('rgba(255,122,208,0.75)', 0.35)}><path d='M0 66H100M0 72H100M0 80H100M0 90H100M50 60L-30 100M50 60L10 100M50 60L50 100M50 60L90 100M50 60L130 100'/></g><circle cx='50' cy='48' r='13' fill='#ff3d9a' opacity='0.85'/>`)}, linear-gradient(180deg, #1a0b3a, #3a0f5f 60%, #ff3d9a)`,
    ink: '#ffffff',
    band: '#2ee6d6',
    frame: 'rgba(255,255,255,0.3)',
  },
  {
    id: 'mint',
    name: 'Mint',
    bg: `${svg(`<g ${lines('rgba(255,255,255,0.7)', 0.8)}><circle cx='86' cy='82' r='30'/><circle cx='86' cy='82' r='20'/><circle cx='86' cy='82' r='10'/></g>`)}, linear-gradient(160deg, #bff7e8, #45c3a1)`,
    ink: '#07382d',
    band: '#0d7a60',
    frame: 'rgba(7,56,45,0.3)',
    pale: true,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    bg: 'radial-gradient(circle at 15% 20%, #00e0ff, transparent 50%), radial-gradient(circle at 85% 35%, #ff5ec4, transparent 52%), radial-gradient(circle at 50% 95%, #7b5cff, transparent 60%), #1a1250',
    ink: '#ffffff',
    band: '#00e0ff',
    frame: 'rgba(255,255,255,0.35)',
  },
];

/** Names used by the first version of the covers, so earlier choices still show. */
const LEGACY: Record<string, string> = { ocean: 'wave', sunset: 'sunrise', royal: 'atom', forest: 'topo', ruby: 'neon', midnight: 'ink', graphite: 'ink', galaxy: 'orbit' };

export function coverById(id: string | undefined): Cover | undefined {
  if (!id) return undefined;
  const k = LEGACY[id] ?? id;
  return COVERS.find((c) => c.id === k);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

// The looks live in the stylesheet (one rule per cover), added once.
if (typeof document !== 'undefined' && !document.getElementById('teachly-covers')) {
  const st = document.createElement('style');
  st.id = 'teachly-covers';
  st.textContent = COVERS.map((c) => `.nbc[data-c="${c.id}"]{--cv:${c.bg};--ci:${c.ink};--cb:${c.band};--cf:${c.frame};--cs:${c.pale ? 'transparent' : 'rgba(0,0,0,0.42)'}}`).join('\n');
  document.head.appendChild(st);
}

/** The cover as HTML. `portrait`: a tall notebook (tall cover) or a wide one (wide cover). */
export function coverHTML(c: Cover, title: string, portrait: boolean): string {
  return `<span class="nbc" data-c="${c.id}" data-o="${portrait ? 'p' : 'l'}"><span class="nbc-brand">Teachly</span><span class="nbc-t">${esc(title)}</span><i class="nbc-rib"></i></span>`;
}
