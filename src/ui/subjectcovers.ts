// Subject covers: 12 subjects x 20 covers, in the same calm style as the first covers (flat colour, one fine
// line drawing, a short rule and the name). Nothing is downloaded: every drawing is a few lines of SVG
// (drawn in black and used as a mask, so one drawing works in every ink colour).
//
// A cover is a drawing (6 per subject) in a colour pair (20 pairs). Cover number i of a subject uses
// drawing i % 6, placement floor(i / 6) (4 placements) and colour pair (i * 7 + shift) % 20: 7 and 20 share
// no factor, so the 20 colour pairs of a subject are all different, and so are drawing + placement.

export interface SubjectCover {
  id: string;
  name: string;
  bg: string;
  ink: string;
  group: string;
  /** Which drawing ("phy:3") and which colour pair (0-19). */
  drawing: string;
  pair: number;
  /** How the drawing is placed: 0 as is, 1 mirrored, 2 large and faint behind the name, 3 tilted and faint. */
  variant: number;
}

export interface CoverGroup {
  id: string;
  name: string;
}

const S = (o = 0.85, w = 1.5) => `fill='none' stroke='#000' stroke-opacity='${o}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'`;
const F = (o = 0.14) => `fill='#000' fill-opacity='${o}' stroke='none'`;
const n1 = (n: number) => Math.round(n * 10) / 10;

function sine(y: number, amp: number, waves: number, phase = 0, x0 = 0, x1 = 100): string {
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const x = x0 + (i / 60) * (x1 - x0);
    d += `${i ? 'L' : 'M'}${n1(x)} ${n1(y + amp * Math.sin(((x - x0) / (x1 - x0)) * waves * 2 * Math.PI + phase))}`;
  }
  return d;
}
const poly = (pts: number[][], close = false) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('') + (close ? 'Z' : '');
function ngon(cx: number, cy: number, r: number, n: number, rot = -90): number[][] {
  return Array.from({ length: n }, (_, i) => [n1(cx + r * Math.cos(((rot + (360 / n) * i) * Math.PI) / 180)), n1(cy + r * Math.sin(((rot + (360 / n) * i) * Math.PI) / 180))]);
}

// ---- the drawings: 100 x 100, black lines -------------------------------------------------------

type Art = () => string;

const PHYSICS: Art[] = [
  () => `<g ${S()}><ellipse cx='50' cy='50' rx='40' ry='14'/><ellipse cx='50' cy='50' rx='40' ry='14' transform='rotate(60 50 50)'/><ellipse cx='50' cy='50' rx='40' ry='14' transform='rotate(120 50 50)'/></g><circle cx='50' cy='50' r='5' ${F(0.85)}/>`,
  () => `<g ${S(0.8, 1.3)} transform='rotate(-22 50 50)'><ellipse cx='50' cy='50' rx='44' ry='16'/><ellipse cx='50' cy='50' rx='32' ry='11'/><ellipse cx='50' cy='50' rx='20' ry='7'/></g><circle cx='50' cy='50' r='6' ${F(0.85)}/><circle cx='88' cy='40' r='3.2' ${F(0.85)}/>`,
  () => `<g ${S(0.85)}><path d='${sine(30, 8, 2)}'/></g><g ${S(0.6)}><path d='${sine(46, 8, 2, 0.6)}'/></g><g ${S(0.4)}><path d='${sine(62, 8, 2, 1.2)}'/></g><g ${S(0.25)}><path d='${sine(78, 8, 2, 1.8)}'/></g>`,
  () => `<path d='M28 16 V54 A22 22 0 0 0 72 54 V16 H60 V54 A10 10 0 0 1 40 54 V16 Z' ${F(0.12)}/><g ${S()}><path d='M28 16 V54 A22 22 0 0 0 72 54 V16 H60 V54 A10 10 0 0 1 40 54 V16 Z'/><path d='M28 30 H40 M60 30 H72'/></g><g ${S(0.5, 1.1)}><path d='M14 90 Q50 66 86 90' stroke-dasharray='3 4'/></g>`,
  () => `<path d='M50 22 L80 74 H20 Z' ${F(0.1)}/><g ${S()}><path d='M50 22 L80 74 H20 Z'/><path d='M4 62 L38 52'/><path d='M66 52 L98 38 M68 58 L98 52 M70 64 L98 66' opacity='0.75'/></g>`,
  () => `<path d='M50 18 C72 34 72 66 50 82 C28 66 28 34 50 18 Z' ${F(0.1)}/><g ${S()}><path d='M50 18 C72 34 72 66 50 82 C28 66 28 34 50 18 Z'/><path d='M50 12 V88 M6 50 H94' stroke-dasharray='2 4' opacity='0.5'/><path d='M8 30 L30 42 M8 50 L28 50 M8 70 L30 58'/><path d='M70 42 L92 30 M72 50 H92 M70 58 L92 70' opacity='0.7'/></g>`,
];

const CHEMISTRY: Art[] = [
  () => `<path d='M30 62 H70 L77 79 Q78 83 74 83 H26 Q22 83 23 79 Z' ${F(0.16)}/><g ${S()}><path d='M41 14 H59 M44 14 V38 L22 80 Q19 87 27 87 H73 Q81 87 78 80 L56 38 V14 M30 62 H70'/><circle cx='46' cy='72' r='2.6'/><circle cx='56' cy='68' r='1.8'/></g>`,
  () => `<g ${S()}><path d='M50 22 L72.5 35 V61 L50 74 L27.5 61 V35 Z'/><path d='M72.5 35 L88 26 M27.5 61 L12 70 M50 22 V10'/></g><g ${S()}><circle cx='90' cy='24' r='5'/><circle cx='10' cy='72' r='5'/><circle cx='50' cy='7' r='5'/></g><circle cx='50' cy='48' r='15' ${S(0.4, 1.2)}/>`,
  () => `<path d='M24 40 H76 V82 Q76 88 70 88 H30 Q24 88 24 82 Z' ${F(0.12)}/><g ${S()}><path d='M20 16 H80 M22 16 V82 Q22 90 30 90 H70 Q78 90 78 82 V16'/><path d='M24 40 H76'/><path d='M22 32 H32 M22 48 H32 M22 64 H32 M22 80 H32'/><circle cx='42' cy='64' r='3'/><circle cx='58' cy='56' r='2'/><circle cx='52' cy='74' r='2.4'/></g>`,
  () => `<g ${S()}><path d='M22 14 V76 Q22 88 30 88 Q38 88 38 76 V14 M18 14 H42'/><path d='M44 14 V76 Q44 88 52 88 Q60 88 60 76 V14 M40 14 H64'/><path d='M66 14 V76 Q66 88 74 88 Q82 88 82 76 V14 M62 14 H86'/><path d='M22 52 H38 M44 44 H60 M66 58 H82' opacity='0.6'/></g><path d='M22 52 H38 V76 Q38 88 30 88 Q22 88 22 76 Z' ${F(0.16)}/><path d='M66 58 H82 V76 Q82 88 74 88 Q66 88 66 76 Z' ${F(0.16)}/>`,
  () => `<g ${S()}><path d='${poly(ngon(50, 50, 32, 6), true)}'/><path d='${poly(ngon(50, 50, 20, 6), true)}' opacity='0.5'/></g><g ${S(0.6, 1.2)}><path d='M50 18 V8 M77.7 34 L86 29 M77.7 66 L86 71 M50 82 V92 M22.3 66 L14 71 M22.3 34 L14 29'/></g>`,
  () => `<g ${S()}><path d='M38 88 H62 M50 88 V58 M42 58 H58 L56 44 H44 Z'/><path d='M44 44 V34 M56 44 V34'/></g><path d='M50 8 C60 20 64 28 58 34 C54 38 46 38 42 34 C36 28 42 20 50 8 Z' ${F(0.2)}/><path d='M50 8 C60 20 64 28 58 34 C54 38 46 38 42 34 C36 28 42 20 50 8 Z' ${S(0.8, 1.3)}/>`,
];

const MATHS: Art[] = [
  () => `<g ${S(0.9, 3)}><path d='M18 32 Q50 24 82 32'/><path d='M36 31 C36 52 32 70 26 80'/><path d='M64 31 V70 Q64 80 74 80 Q80 80 84 76'/></g>`,
  () => `<g ${S(0.5, 1)}><path d='M10 50 H92 M50 8 V92'/><path d='M88 46 L94 50 L88 54 M46 14 L50 8 L54 14'/></g><g ${S(0.9, 1.7)}><path d='M20 12 Q50 130 80 12' /></g>`,
  () => `<path d='M50 14 L88 78 H12 Z' ${F(0.08)}/><g ${S()}><path d='M50 14 L88 78 H12 Z'/><circle cx='50' cy='60' r='19' opacity='0.7'/></g><g ${S(0.55, 1.2)}><path d='M12 78 H88' /><path d='M22 78 A10 10 0 0 0 18 69'/></g>`,
  () => `<g ${S()}><path d='M26 38 L56 26 L84 38 L84 72 L54 86 L26 72 Z'/><path d='M26 38 L54 52 L84 38 M54 52 V86'/></g><path d='M26 38 L54 52 L54 86 L26 72 Z' ${F(0.1)}/>`,
  () => `<g ${S(0.5, 1)}><path d='M8 50 H94 M50 12 V90'/></g><g ${S(0.9, 1.7)}><path d='${sine(50, 22, 1.5, 0, 10, 92)}'/></g>`,
  () => `<g ${S(0.9, 2.4)}><path d='M50 50 C50 30 26 24 20 38 C14 54 34 66 50 50 C66 34 86 46 80 62 C74 76 50 70 50 50 Z'/></g><path d='M50 50 C50 30 26 24 20 38 C14 54 34 66 50 50 Z' ${F(0.1)}/>`,
];

const HISTORY: Art[] = [
  () => `<path d='M30 24 H70 V30 H30 Z' ${F(0.14)}/><g ${S()}><path d='M26 24 H74 V32 H26 Z M32 32 V80 M42 32 V80 M58 32 V80 M68 32 V80 M26 80 H74 V88 H26 Z M22 88 H78'/><path d='M50 32 V80' opacity='0.5'/></g>`,
  () => `<path d='M14 40 H86 V88 H14 Z' ${F(0.1)}/><g ${S()}><path d='M14 88 V34 H24 V26 H32 V34 H42 V26 H50 V34 H58 V26 H66 V34 H76 V26 H86 V34 V88 Z M42 88 V68 A8 8 0 0 1 58 68 V88'/><path d='M14 52 H86' opacity='0.4'/></g>`,
  () => `<g ${S()}><path d='M22 20 H78 A6 6 0 0 1 78 32 H26 A6 6 0 0 0 26 20 M26 32 V80 A6 6 0 0 0 38 80 V68 M26 80 H78 A6 6 0 0 0 78 68 V32'/><path d='M38 40 H66 M38 50 H66 M38 60 H58' opacity='0.6'/></g>`,
  () => `<g ${S()}><path d='M8 82 L40 30 L56 56 L64 44 L92 82 Z'/><path d='M40 30 L48 56 L40 82 M64 44 L60 82' opacity='0.5'/></g><circle cx='76' cy='20' r='7' ${S(0.6, 1.3)}/>`,
  () => `<g ${S()}><path d='M26 14 H74 M26 86 H74 M30 14 C30 40 46 44 50 50 C46 56 30 60 30 86 M70 14 C70 40 54 44 50 50 C54 56 70 60 70 86'/></g><path d='M38 78 H62 C58 66 54 62 50 60 C46 62 42 66 38 78 Z' ${F(0.2)}/><path d='M42 28 H58 L50 44 Z' ${F(0.14)}/>`,
  () => `<path d='M18 72 L16 36 L34 52 L50 28 L66 52 L84 36 L82 72 Z' ${F(0.12)}/><g ${S()}><path d='M18 72 L16 36 L34 52 L50 28 L66 52 L84 36 L82 72 Z M18 80 H82'/><circle cx='16' cy='33' r='3'/><circle cx='50' cy='25' r='3'/><circle cx='84' cy='33' r='3'/></g>`,
];

const GEOGRAPHY: Art[] = [
  () => `<circle cx='50' cy='50' r='40' ${F(0.08)}/><g ${S()}><circle cx='50' cy='50' r='40'/><ellipse cx='50' cy='50' rx='16' ry='40'/><ellipse cx='50' cy='50' rx='32' ry='40' opacity='0.5'/><path d='M10 50 H90 M14 30 Q50 38 86 30 M14 70 Q50 62 86 70'/></g>`,
  () => `<g ${S()}><path d='M6 84 L32 38 L46 62 L62 30 L94 84 Z'/><path d='M23 52 L32 60 L38 52 M54 44 L62 52 L70 44' opacity='0.6'/></g><circle cx='80' cy='18' r='7' ${S(0.6, 1.3)}/>`,
  () => `<g ${S()}><circle cx='50' cy='50' r='34'/><circle cx='50' cy='50' r='28' opacity='0.4'/><path d='M50 8 L58 42 L92 50 L58 58 L50 92 L42 58 L8 50 L42 42 Z'/></g><path d='M50 8 L58 42 L50 50 Z M50 92 L42 58 L50 50 Z' ${F(0.2)}/>`,
  () => `<g ${S()}><path d='M8 30 Q30 18 44 34 T70 44 T94 30'/><path d='M8 46 Q30 34 44 50 T70 60 T94 46' opacity='0.6'/><path d='M8 62 Q30 50 44 66 T70 76 T94 62' opacity='0.4'/><path d='M62 12 Q54 28 64 38 Q74 48 66 62 Q60 74 72 88'/></g>`,
  () => `<path d='M14 88 L38 44 H62 L86 88 Z' ${F(0.1)}/><g ${S()}><path d='M14 88 L38 44 H62 L86 88 Z M38 44 L44 36 H56 L62 44 M4 88 H96'/><path d='M46 36 C42 26 50 22 48 12 M54 36 C58 24 52 20 56 10' opacity='0.6'/></g>`,
  () => `<g ${S()}><path d='M50 18 C72 18 82 38 74 56 C66 74 38 80 26 64 C14 48 28 18 50 18 Z'/><path d='M50 28 C66 28 72 42 66 54 C60 66 42 70 34 60 C26 48 36 28 50 28 Z' opacity='0.7'/><path d='M50 38 C58 38 60 46 56 52 C52 58 44 58 42 52 C40 46 44 38 50 38 Z' opacity='0.5'/></g>`,
];

const SOCIAL: Art[] = [
  () => `<g ${S()}><path d='M50 18 V80 M22 28 H78 M14 28 L22 28 L8 54 H36 Z M78 28 L64 54 H92 Z M32 86 H68 M14 54 A14 8 0 0 0 36 54 M64 54 A14 8 0 0 0 86 54'/><circle cx='50' cy='16' r='3'/></g>`,
  () => `<g ${S()}><path d='M26 46 A24 24 0 0 1 74 46 M50 12 V22 M18 46 H82 M24 46 V74 M40 46 V74 M60 46 V74 M76 46 V74 M14 74 H86 M8 86 H92 M12 80 H88'/></g><path d='M26 46 A24 24 0 0 1 74 46 Z' ${F(0.1)}/>`,
  () => `<g ${S()}><circle cx='50' cy='32' r='10'/><circle cx='24' cy='42' r='8'/><circle cx='76' cy='42' r='8'/><path d='M32 82 A18 18 0 0 1 68 82 Z M8 82 A16 16 0 0 1 36 66 M64 66 A16 16 0 0 1 92 82'/></g>`,
  () => `<g ${S()}><path d='M26 10 V92'/><path d='M26 14 H80 L68 30 L80 46 H26'/></g><path d='M26 14 H80 L68 30 L80 46 H26 Z' ${F(0.14)}/>`,
  () => `<path d='M20 52 H80 V86 H20 Z' ${F(0.1)}/><g ${S()}><path d='M20 52 H80 V86 H20 Z M32 52 H68 M38 52 V47 H62 V52'/><path d='M38 26 L50 14 L62 26 V42 H38 Z M44 26 H56'/></g>`,
  () => `<g ${S()}><path d='M8 88 H92 M14 88 V46 H30 V88 M30 88 V28 H48 V88 M48 88 V56 H62 V88 M62 88 V36 H80 V88 M80 88 V62 H92 V88'/><path d='M36 38 H42 M36 50 H42 M68 46 H74 M68 58 H74' opacity='0.6'/></g>`,
];

const DRAWING: Art[] = [
  () => `<g transform='rotate(-35 50 50)'><rect x='38' y='10' width='24' height='62' rx='2' ${F(0.12)}/><g ${S()}><rect x='38' y='10' width='24' height='62' rx='2'/><path d='M38 72 L50 94 L62 72 M38 22 H62 M50 84 V94'/></g></g>`,
  () => `<g ${S()}><path d='M16 88 L58 46 M66 20 L84 12 L92 28 L74 36'/><path d='M58 46 C52 38 60 28 66 20 L74 36 C68 44 64 54 58 46 Z'/><path d='M16 88 C20 80 28 78 30 70'/></g>`,
  () => `<path d='M50 14 C80 14 92 36 84 56 C78 70 64 66 62 76 C60 90 40 90 26 76 C8 58 14 14 50 14 Z' ${F(0.1)}/><g ${S()}><path d='M50 14 C80 14 92 36 84 56 C78 70 64 66 62 76 C60 90 40 90 26 76 C8 58 14 14 50 14 Z'/><circle cx='34' cy='38' r='5'/><circle cx='52' cy='28' r='5'/><circle cx='72' cy='36' r='5'/><circle cx='40' cy='62' r='5'/><circle cx='56' cy='72' r='4' /></g>`,
  () => `<g ${S()}><path d='M18 90 L36 12 H64 L82 90 M50 12 V4 M26 56 L74 56 M42 90 V76 H58 V90'/><rect x='30' y='24' width='40' height='28' rx='2'/></g><path d='M30 24 H70 V52 H30 Z' ${F(0.1)}/>`,
  () => `<g ${S()}><path d='M14 82 V24 L74 82 Z'/><path d='M14 38 H22 M14 52 H24 M14 66 H22 M26 82 V74 M40 82 V72 M54 82 V74' opacity='0.7'/><path d='M34 70 V52 L50 70 Z' opacity='0.5'/></g>`,
  () => `<g ${S()}><path d='M50 14 L84 32 V68 L50 86 L16 68 V32 Z M16 32 L50 50 L84 32 M50 50 V86'/></g><path d='M16 32 L50 50 V86 L16 68 Z' ${F(0.08)}/><g ${S(0.45, 1)}><path d='M22 42 L28 46 M22 52 L28 56 M22 62 L28 66'/></g>`,
];

const ZOOLOGY: Art[] = [
  () => `<g ${S()}><path d='M50 28 V74 M50 28 C40 12 22 12 14 24 C8 36 24 48 50 46 C28 50 14 62 22 76 C32 90 46 78 50 66 C54 78 68 90 78 76 C86 62 72 50 50 46 C76 48 92 36 86 24 C78 12 60 12 50 28 Z M50 28 L44 14 M50 28 L56 14'/><circle cx='28' cy='30' r='6' opacity='0.5'/><circle cx='72' cy='30' r='6' opacity='0.5'/></g>`,
  () => `<path d='M16 50 C34 22 68 22 78 50 C68 78 34 78 16 50 Z' ${F(0.1)}/><g ${S()}><path d='M16 50 C34 22 68 22 78 50 C68 78 34 78 16 50 Z M78 50 L94 34 V66 Z'/><circle cx='34' cy='44' r='3.6'/><path d='M50 30 C56 42 56 58 50 70 M60 30 C66 42 66 58 60 70' opacity='0.5'/></g>`,
  () => `<g ${S()}><path d='M16 52 C16 34 34 24 52 28 C60 18 72 20 72 28 L88 34 L72 38 C72 60 58 78 38 76 C24 74 16 64 16 52 Z M34 46 C42 44 52 50 54 62'/><circle cx='64' cy='28' r='2.4'/><path d='M36 76 V88 M46 76 V88 M30 88 H52'/></g>`,
  () => `<g ${S()}><ellipse cx='50' cy='64' rx='20' ry='16'/><ellipse cx='22' cy='46' rx='7' ry='10' transform='rotate(-20 22 46)'/><ellipse cx='40' cy='28' rx='7' ry='10' transform='rotate(-6 40 28)'/><ellipse cx='60' cy='28' rx='7' ry='10' transform='rotate(6 60 28)'/><ellipse cx='78' cy='46' rx='7' ry='10' transform='rotate(20 78 46)'/></g>`,
  () => `<g ${S()}><path d='M50 50 m0 0 C50 44 56 42 60 46 C66 52 60 62 50 62 C38 62 32 50 38 40 C46 28 66 30 72 44 C78 60 66 78 48 78 C28 78 14 62 18 44 C22 24 44 14 64 20'/><path d='M14 80 H86' opacity='0.5'/></g>`,
  () => `<g ${S()}><path d='M22 90 C26 60 44 28 78 10 C80 40 66 74 30 86 M22 90 C34 66 52 40 78 10'/><path d='M34 70 L22 68 M42 58 L28 52 M52 46 L40 38 M60 36 L52 26 M40 70 L50 78 M50 58 L62 66 M60 46 L72 52' opacity='0.6'/></g>`,
];

const BOTANY: Art[] = [
  () => {
    let p = '';
    for (let a = 0; a < 360; a += 45) p += `<ellipse cx='50' cy='28' rx='7.5' ry='15' transform='rotate(${a} 50 44)'/>`;
    return `<circle cx='50' cy='44' r='30' ${F(0.07)}/><g ${S()}>${p}<circle cx='50' cy='44' r='5.5'/><path d='M50 66 C50 78 46 86 48 96 M49 82 C38 78 30 82 28 88 C38 92 46 90 49 82 Z'/></g>`;
  },
  () => {
    const petal = (rot: number, o: number) => `<path d='M50 80 C35 63 37 38 50 20 C63 38 65 63 50 80 Z' transform='rotate(${rot} 50 80)' stroke-opacity='${o}'/>`;
    return `<g ${S()}>${petal(-56, 0.5)}${petal(56, 0.5)}${petal(-28, 0.7)}${petal(28, 0.7)}${petal(0, 0.95)}</g><g ${S(0.5, 1.2)}><path d='M14 88 Q32 81 50 88 T86 88'/></g>`;
  },
  () => `<g ${S()}><path d='M50 94 C46 72 54 46 50 6 M50 78 C40 74 30 64 28 52 C40 54 48 64 50 78 M50 62 C60 58 70 48 72 36 C60 38 52 48 50 62 M50 44 C42 40 36 32 36 22 C44 24 50 32 50 44'/></g>`,
  () => `<g ${S()}><path d='M50 88 V50 M50 62 C36 62 28 52 28 40 C42 40 50 48 50 62 M50 54 C62 54 72 46 72 32 C58 32 50 42 50 54'/><path d='M16 88 H84 M24 94 H76' opacity='0.5'/></g>`,
  () => `<path d='M50 14 C66 12 78 24 76 38 C86 42 84 60 72 62 C68 72 54 72 50 64 C46 72 32 72 28 62 C16 60 14 42 24 38 C22 24 34 12 50 14 Z' ${F(0.12)}/><g ${S()}><path d='M50 14 C66 12 78 24 76 38 C86 42 84 60 72 62 C68 72 54 72 50 64 C46 72 32 72 28 62 C16 60 14 42 24 38 C22 24 34 12 50 14 Z M50 64 V92 M50 78 L40 70 M50 72 L60 62'/></g>`,
  () => `<g ${S()}><path d='M38 90 V32 A12 12 0 0 1 62 32 V90 Z M38 60 H26 A8 8 0 0 1 18 52 V38 A5 5 0 0 1 28 38 V50 H38 M62 50 H72 V30 A5 5 0 0 1 82 30 V54 A8 8 0 0 1 74 62 H62'/><path d='M12 90 H88' opacity='0.5'/></g>`,
];

const ENGLISH: Art[] = [
  () => `<g ${S()}><path d='M50 30 C38 22 22 22 10 28 V78 C22 72 38 72 50 80 C62 72 78 72 90 78 V28 C78 22 62 22 50 30 Z M50 30 V80'/><path d='M18 40 C26 38 34 38 42 42 M18 52 C26 50 34 50 42 54 M58 42 C66 38 74 38 82 40 M58 54 C66 50 74 50 82 52' opacity='0.55'/></g>`,
  () => `<g ${S()}><path d='M84 8 C54 14 34 38 28 70 L38 62 L34 78 L44 70 L40 82 C70 70 84 40 84 8 Z M28 70 L14 92 M52 34 L40 62' /></g>`,
  () => `<path d='M14 16 H86 V62 H48 L28 82 V62 H14 Z' ${F(0.1)}/><g ${S()}><path d='M14 16 H86 V62 H48 L28 82 V62 H14 Z M26 32 H74 M26 44 H62'/></g>`,
  () => `<g ${S()}><rect x='12' y='24' width='76' height='54' rx='4'/><path d='M12 28 L50 58 L88 28 M12 74 L38 50 M88 74 L62 50'/></g>`,
  () => `<g ${S()}><path d='M28 12 H72 V88 L50 70 L28 88 Z M38 28 H62 M38 40 H62'/></g><path d='M28 12 H72 V88 L50 70 L28 88 Z' ${F(0.1)}/>`,
  () => `<g ${S(0.9, 2)}><path d='M10 80 L28 24 L46 80 M17 60 H39'/><circle cx='70' cy='62' r='13'/><path d='M83 50 V80'/></g>`,
];

const COMPUTER: Art[] = [
  () => `<g ${S()}><rect x='20' y='22' width='60' height='42' rx='3'/><path d='M10 76 H90 L84 64 H16 Z M42 70 H58'/><path d='M30 34 L38 42 L30 50 M44 50 H58' opacity='0.7'/></g>`,
  () => `<g ${S()}><rect x='28' y='28' width='44' height='44' rx='4'/><rect x='38' y='38' width='24' height='24' rx='2' opacity='0.6'/><path d='M36 28 V16 M50 28 V16 M64 28 V16 M36 72 V84 M50 72 V84 M64 72 V84 M28 36 H16 M28 50 H16 M28 64 H16 M72 36 H84 M72 50 H84 M72 64 H84'/></g>`,
  () => `<g ${S(0.9, 2.4)}><path d='M34 28 L12 50 L34 72 M66 28 L88 50 L66 72 M58 22 L42 78'/></g>`,
  () => `<path d='M30 12 L30 76 L44 62 L54 86 L64 82 L54 58 L74 58 Z' ${F(0.14)}/><g ${S()}><path d='M30 12 L30 76 L44 62 L54 86 L64 82 L54 58 L74 58 Z'/></g>`,
  () => {
    let t = '';
    for (let i = 0; i < 8; i++) t += `<rect x='44' y='8' width='12' height='14' rx='2' transform='rotate(${i * 45} 50 50)'/>`;
    return `<g ${S()}><circle cx='50' cy='50' r='26'/><circle cx='50' cy='50' r='11'/>${t}</g>`;
  },
  () => `<g ${S()}><path d='M12 38 A54 54 0 0 1 88 38 M24 52 A36 36 0 0 1 76 52 M36 66 A18 18 0 0 1 64 66'/></g><circle cx='50' cy='78' r='4.5' ${F(0.85)}/>`,
];

const ECONOMICS: Art[] = [
  () => `<g ${S()}><path d='M10 86 H92 M10 86 V12'/><rect x='20' y='56' width='12' height='30'/><rect x='40' y='42' width='12' height='44'/><rect x='60' y='62' width='12' height='24'/><path d='M18 40 L40 26 L58 36 L86 14 M76 14 H86 V24'/></g>`,
  () => `<g ${S()}><ellipse cx='50' cy='74' rx='28' ry='9'/><path d='M22 74 V64 M78 74 V64'/><ellipse cx='50' cy='64' rx='28' ry='9'/><path d='M22 64 V54 M78 64 V54'/><ellipse cx='50' cy='54' rx='28' ry='9'/><path d='M22 54 V44 M78 54 V44'/><ellipse cx='50' cy='44' rx='28' ry='9'/></g>`,
  () => `<circle cx='50' cy='50' r='36' ${F(0.07)}/><g ${S()}><circle cx='50' cy='50' r='36'/><path d='M50 50 V14 M50 50 L82 66 M50 50 L22 74'/></g><path d='M50 50 L50 14 A36 36 0 0 1 82 66 Z' ${F(0.16)}/>`,
  () => `<g ${S()}><path d='M6 18 H20 L30 60 H78 L88 28 H24'/><circle cx='38' cy='76' r='6'/><circle cx='70' cy='76' r='6'/><path d='M34 40 H82 M36 50 H80' opacity='0.5'/></g>`,
  () => `<g ${S()}><path d='M50 10 L92 30 H8 Z M16 38 H84 M22 38 V72 M38 38 V72 M62 38 V72 M78 38 V72 M12 72 H88 M6 84 H94 M10 78 H90'/></g><path d='M50 10 L92 30 H8 Z' ${F(0.1)}/>`,
  () => `<g ${S(0.9, 2)}><path d='M10 80 L32 56 L46 66 L88 18'/><path d='M66 16 H90 V40'/></g><g ${S(0.4, 1)}><path d='M10 90 H92 M10 90 V10'/></g>`,
];

// ---- colours: 20 pairs (cover colour, ink) --------------------------------------------------

const PAIRS: [string, string][] = [
  ['#17233f', '#ffffff'], ['#0e6b63', '#ffffff'], ['#4a2c6d', '#ffffff'], ['#101014', '#e9c46a'], ['#1e4fb8', '#ffffff'],
  ['#46705a', '#f6f3e8'], ['#b8506b', '#ffffff'], ['#1b4a30', '#f1f4e6'], ['#a52a22', '#ffffff'], ['#2c313c', '#ffffff'],
  ['#34308f', '#ffffff'], ['#eee5d0', '#3a2e1a'], ['#f2b84b', '#2b2110'], ['#8fd3c8', '#0d3b36'], ['#e76f51', '#ffffff'],
  ['#cdb4f6', '#2d1b4e'], ['#d8cfa8', '#37341a'], ['#0b0b0d', '#ffffff'], ['#7a1f3d', '#ffe3ec'], ['#2a7fba', '#ffffff'],
];

const GROUPS: { id: string; name: string; art: Art[]; shift: number }[] = [
  { id: 'phy', name: 'Physics', art: PHYSICS, shift: 0 },
  { id: 'che', name: 'Chemistry', art: CHEMISTRY, shift: 3 },
  { id: 'mat', name: 'Maths', art: MATHS, shift: 6 },
  { id: 'his', name: 'History', art: HISTORY, shift: 9 },
  { id: 'geo', name: 'Geography', art: GEOGRAPHY, shift: 12 },
  { id: 'soc', name: 'Social science', art: SOCIAL, shift: 15 },
  { id: 'dra', name: 'Drawing', art: DRAWING, shift: 18 },
  { id: 'zoo', name: 'Zoology', art: ZOOLOGY, shift: 1 },
  { id: 'bot', name: 'Botany', art: BOTANY, shift: 4 },
  { id: 'eng', name: 'English', art: ENGLISH, shift: 7 },
  { id: 'com', name: 'Computer', art: COMPUTER, shift: 10 },
  { id: 'eco', name: 'Economics', art: ECONOMICS, shift: 13 },
];

export const SUBJECT_GROUPS: CoverGroup[] = GROUPS.map((g) => ({ id: g.id, name: g.name }));

const pic = (body: string): string => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>${body}</svg>`).replace(/'/g, '%27')}")`;

/** The picture of one drawing, e.g. key "phy:3" (built when first needed). */
const drawn = new Map<string, string>();
export function drawingUrl(key: string): string {
  let a = drawn.get(key);
  if (!a) {
    const [gid, k] = key.split(':');
    a = pic(GROUPS.find((g) => g.id === gid)!.art[Number(k)]());
    drawn.set(key, a);
  }
  return a;
}

/** All 240 covers. */
export const SUBJECT_COVERS: SubjectCover[] = GROUPS.flatMap((g) =>
  Array.from({ length: 20 }, (_, i) => {
    const pair = (i * 7 + g.shift) % 20;
    return { id: `${g.id}-${String(i + 1).padStart(2, '0')}`, name: `${g.name} ${i + 1}`, group: g.id, drawing: `${g.id}:${i % g.art.length}`, variant: Math.floor(i / g.art.length) % 4, pair, bg: PAIRS[pair][0], ink: PAIRS[pair][1] };
  }),
);

export const COVER_PAIRS = PAIRS;

export function subjectCoverById(id: string | undefined): SubjectCover | undefined {
  return id ? SUBJECT_COVERS.find((c) => c.id === id) : undefined;
}
