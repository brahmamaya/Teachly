import type { Art } from './kit';
import { S, F, n1 } from './kit';

const rad = (a: number) => (a * Math.PI) / 180;
// A pointed petal of length l and half-width w from (0,0) along +x (used under a rotate transform).
const petal = (l: number, w: number) => `M0 0 C${n1(l * 0.3)} ${-w} ${n1(l * 0.75)} ${n1(-w * 0.8)} ${l} 0 C${n1(l * 0.75)} ${n1(w * 0.8)} ${n1(l * 0.3)} ${w} 0 0Z`;
// A petal with fill + outline, rotated by a about (x,y).
const pt = (x: number, y: number, a: number, l: number, w: number, o: number) => `<g transform='translate(${x} ${y}) rotate(${a})'><path d='${petal(l, w)}' ${F(o)}/><path d='${petal(l, w)}' ${S(0.9, 1.1)}/><path d='M2 0 H${n1(l * 0.7)}' ${S(0.35, 0.6)}/></g>`;
// A line with an arrow head at the end.
const arrow = (x1: number, y1: number, x2: number, y2: number, o = 0.9) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = (d: number) => `${n1(x2 - 4.5 * Math.cos(a + d))} ${n1(y2 - 4.5 * Math.sin(a + d))}`;
  return `<path d='M${x1} ${y1} L${x2} ${y2} M${h(0.5)} L${x2} ${y2} L${h(-0.5)}' ${S(o, 1.3)}/>`;
};

export const BOTANY: Art[] = [
  // 1. Flower cross-section: petals, sepals, stamens, pistil, ovary with ovules
  () => {
    const half = `<path d='M46 68 C20 62 10 36 20 12 C34 20 44 44 47 60Z' ${F(0.14)}/><path d='M47 60 C40 44 32 30 24 22 C36 28 44 42 47 56Z' ${F(0.2)}/><g ${S(0.9, 1.4)}><path d='M46 68 C20 62 10 36 20 12 C34 20 44 44 47 60'/></g><g ${S(0.5, 0.7)}><path d='M44 60 C34 44 26 30 22 20 M44 62 C28 52 18 40 16 28'/></g><path d='M48 74 C34 76 26 70 22 62 C32 62 42 66 48 70Z' ${F(0.3)}/><path d='M48 74 C34 76 26 70 22 62 C32 62 42 66 48 70' ${S(0.9, 1.2)}/><g ${S(0.9, 1.1)}><path d='M44 66 C38 56 36 46 38 38'/><ellipse cx='38' cy='34' rx='2.6' ry='5' transform='rotate(8 38 34)' ${F(0.6)}/><ellipse cx='38' cy='34' rx='2.6' ry='5' transform='rotate(8 38 34)'/></g><g ${F(0.7)}><circle cx='34' cy='26' r='0.9'/><circle cx='39' cy='25' r='0.9'/><circle cx='36' cy='22' r='0.9'/></g>`;
    return `<g>${half}</g><g transform='translate(100 0) scale(-1 1)'>${half}</g><path d='M47 94 C48 86 48 80 47 72 H53 C52 80 52 86 53 94Z' ${F(0.2)}/><path d='M47 94 C48 86 48 80 47 72 M53 94 C52 86 52 80 53 72' ${S(0.9, 1.3)}/><ellipse cx='50' cy='62' rx='9' ry='11' ${F(0.14)}/><path d='M44 24 C47 28 48 40 48 52 H52 C52 40 53 28 56 24Z' ${F(0.25)}/><g ${S(0.95, 1.5)}><ellipse cx='50' cy='62' rx='9' ry='11'/><path d='M48 51 C48 40 47 30 45 25 M52 51 C52 40 53 30 55 25'/><path d='M43 25 C44 20 56 20 57 25 C54 27 46 27 43 25Z' ${F(0.5)}/></g><g ${S(0.9, 0.9)}>${[[46, 58], [54, 58], [46, 64], [54, 64], [50, 61], [50, 67]].map((p) => `<ellipse cx='${p[0]}' cy='${p[1]}' rx='1.8' ry='2.3' ${F(0.5)}/>`).join('')}</g><g ${F(0.8)}><circle cx='46' cy='23' r='0.7'/><circle cx='50' cy='22' r='0.7'/><circle cx='54' cy='23' r='0.7'/></g>`;
  },
  // 2. Leaf with midrib, veins and net venation
  () => {
    let v = '', t = '';
    for (let i = 0; i < 7; i++) {
      const y = 74 - i * 9.2, w = 27 - i * 3.4;
      v += `M50 ${y} Q${n1(50 - w * 0.5)} ${n1(y - 3)} ${n1(50 - w)} ${n1(y - 14)} M50 ${y} Q${n1(50 + w * 0.5)} ${n1(y - 3)} ${n1(50 + w)} ${n1(y - 14)}`;
      for (let k = 1; k < 4; k++) t += `M${n1(50 - w * 0.25 * k)} ${n1(y - 1.5 - k * 2.6)} l${-3} ${-3} M${n1(50 + w * 0.25 * k)} ${n1(y - 1.5 - k * 2.6)} l3 -3`;
    }
    const leaf = 'M50 82 C14 78 8 44 50 6 C92 44 86 78 50 82Z';
    return `<defs><clipPath id='lf'><path d='${leaf}'/></clipPath></defs><path d='${leaf}' ${F(0.1)}/><g clip-path='url(#lf)'><path d='M50 4 H100 V90 H50Z' ${F(0.14)}/><path d='${t}' ${S(0.35, 0.7)}/></g><g ${S(0.9, 1.8)}><path d='${leaf}'/></g><g ${S(0.8, 1.2)}><path d='${v}'/></g><g ${S(0.95, 2)}><path d='M50 94 C50 88 51 84 50 78 L50 10'/></g><path d='M50 94 C46 90 38 90 34 92' ${S(0.7, 1.2)}/><circle cx='34' cy='36' r='2.6' ${F(0.12)}/><circle cx='34' cy='36' r='2.6' ${S(0.7, 0.8)}/><path d='M33 35 q1 -1 2 0' ${S(0.9, 0.7)}/><g ${F(0.5)}><circle cx='64' cy='58' r='0.8'/><circle cx='70' cy='46' r='0.8'/><circle cx='36' cy='56' r='0.8'/><circle cx='42' cy='28' r='0.8'/></g>`;
  },
  // 3. Tree with canopy, roots and growth rings
  () => {
    const cl = [[38, 20, 11], [25, 30, 10], [51, 30, 10], [38, 34, 13], [20, 44, 7], [56, 44, 7], [38, 48, 9]];
    let roots = '', rings = '';
    for (const d of ['M38 62 C32 70 24 72 16 82', 'M38 62 C38 74 36 84 34 92', 'M38 62 C46 70 54 74 58 86', 'M30 70 C26 72 24 78 20 80', 'M44 70 C50 72 52 76 56 78', 'M37 78 C32 82 30 88 28 92']) roots += d;
    for (let r = 2; r <= 13; r += 2.1) rings += `<ellipse cx='${n1(77 + (r > 8 ? 0.6 : 0)) }' cy='${n1(77 + (r % 3) * 0.3)}' rx='${r}' ry='${n1(r * 0.96)}'/>`;
    return `<path d='M4 62 H96' ${S(0.8, 1.3)}/><path d='M6 62 l2 -3 M12 62 l1 -4 M66 62 l2 -3 M72 62 l1 -4 M90 62 l2 -3' ${S(0.5, 0.8)}/><path d='M4 64 H96 V94 H4Z' ${F(0.06)}/><g ${F(0.13)}>${cl.map((c) => `<circle cx='${c[0]}' cy='${c[1]}' r='${c[2]}'/>`).join('')}</g><g ${F(0.18)}>${cl.map((c) => `<circle cx='${c[0] + 3}' cy='${c[1] + 3}' r='${n1(c[2] * 0.6)}'/>`).join('')}</g><g ${S(0.9, 1.4)}>${cl.map((c) => `<circle cx='${c[0]}' cy='${c[1]}' r='${c[2]}'/>`).join('')}</g><path d='M33 62 C35 52 35 46 34 40 H42 C41 46 41 52 43 62Z' ${F(0.35)}/><g ${S(0.95, 1.6)}><path d='M33 62 C35 52 35 46 34 40 M43 62 C41 52 41 46 42 40 M36 50 L28 40 M40 48 L48 38'/></g><path d='M38 62 H38' ${S(0.5, 1)}/><path d='M34 54 V60 M38 46 V58 M41 52 V60' ${S(0.4, 0.7)}/><g ${S(0.9, 1.5)}><path d='${roots}'/></g><g ${S(0.5, 0.7)}><path d='M16 82 l-4 2 M16 82 l-3 -3 M34 92 l-3 1 M58 86 l3 3 M58 86 l4 -1 M20 80 l-3 0 M56 78 l3 -1'/></g><circle cx='77' cy='77' r='16' ${F(0.1)}/><circle cx='77' cy='77' r='15' ${F(0.2)}/><g ${S(0.8, 0.9)}>${rings}</g><circle cx='77' cy='77' r='15' ${S(0.95, 1.8)}/><path d='M77 77 L90 70' ${S(0.5, 0.8)}/><circle cx='77' cy='77' r='1.2' ${F(0.9)}/>`;
  },
  // 4. Seed germination in four stages
  () => {
    const soil = `<path d='M4 66 C20 62 30 70 50 66 C70 62 80 70 96 66 V94 H4Z' ${F(0.1)}/><path d='M4 66 C20 62 30 70 50 66 C70 62 80 70 96 66' ${S(0.9, 1.4)}/><g ${F(0.5)}>${[[10, 80], [20, 88], [30, 78], [44, 90], [54, 82], [70, 88], [80, 80], [92, 90], [60, 74], [38, 72], [24, 72], [88, 72]].map((p) => `<circle cx='${p[0]}' cy='${p[1]}' r='1'/>`).join('')}</g>`;
    const seed = (x: number, y: number) => `<ellipse cx='${x}' cy='${y}' rx='5' ry='3.6' ${F(0.5)}/><ellipse cx='${x}' cy='${y}' rx='5' ry='3.6' ${S(0.9, 1.1)}/>`;
    return `${soil}${seed(14, 78)}<path d='M10 77 q4 -2 8 0' ${S(0.4, 0.7)}/>${seed(37, 74)}<path d='M33 77 C30 82 32 86 30 90' ${S(0.95, 1.4)}/><path d='M62 70 C60 78 60 84 62 90 M62 82 l-5 2 M62 86 l5 2 M61 76 l-3 1' ${S(0.95, 1.2)}/>${seed(62, 69)}<path d='M66 68 C70 62 68 58 64 56' ${S(0.95, 1.5)}/><g ${S(0.95, 1.6)}><path d='M86 90 C85 84 87 76 86 62 C86 52 87 46 86 40'/><path d='M86 70 l-5 2 M86 74 l5 2 M86 80 l-4 2' ${S(0.8, 1)}/></g><path d='M86 62 C76 62 72 54 74 50 C82 50 86 54 86 62Z M86 62 C96 62 98 54 94 50 C88 50 86 54 86 62Z' ${F(0.3)}/><path d='M86 62 C76 62 72 54 74 50 C82 50 86 54 86 62Z M86 62 C94 62 98 54 94 50 C88 50 86 54 86 62Z' ${S(0.9, 1.2)}/><path d='M86 42 C80 42 74 34 76 28 C83 29 87 35 86 42Z M86 42 C92 42 98 34 96 28 C89 29 85 35 86 42Z M86 40 V30' ${F(0.4)}/><path d='M86 42 C80 42 74 34 76 28 C83 29 87 35 86 42Z M86 42 C92 42 98 34 96 28 C89 29 85 35 86 42Z' ${S(0.9, 1.2)}/><g ${S(0.4, 0.8)}><path d='M26 18 Q37 10 48 18 M54 12 Q62 6 70 12' stroke-dasharray='1.4 2'/></g><path d='M18 46 C24 40 34 40 40 46' ${S(0.3, 0.8)}/>`;
  },
  // 5. Plant cell with wall, nucleus, big vacuole and chloroplasts
  () => {
    const chl = (x: number, y: number, r: number) => `<g transform='translate(${x} ${y}) rotate(${r})'><ellipse rx='8' ry='4.6' ${F(0.28)}/><ellipse rx='8' ry='4.6' ${S(0.95, 1.1)}/><g ${F(0.7)}><rect x='-5' y='-2.2' width='2.6' height='4.4' rx='.6'/><rect x='-1.3' y='-2.2' width='2.6' height='4.4' rx='.6'/><rect x='2.4' y='-2.2' width='2.6' height='4.4' rx='.6'/></g></g>`;
    return `<rect x='6' y='12' width='88' height='76' rx='12' ${F(0.1)}/><g ${S(0.95, 2)}><rect x='6' y='12' width='88' height='76' rx='12'/></g><rect x='10' y='16' width='80' height='68' rx='9' ${S(0.6, 1)}/><path d='M42 28 C60 20 82 32 80 52 C78 72 60 76 44 72 C30 68 28 54 32 42 C34 36 38 30 42 28Z' ${F(0.12)}/><path d='M42 28 C60 20 82 32 80 52 C78 72 60 76 44 72 C30 68 28 54 32 42 C34 36 38 30 42 28Z' ${S(0.8, 1.2)}/><g ${S(0.35, 0.7)}><path d='M50 36 C58 32 70 36 72 46 M48 62 C56 68 68 64 72 56'/></g><circle cx='24' cy='32' r='8.5' ${F(0.3)}/><g ${S(0.95, 1.4)}><circle cx='24' cy='32' r='8.5'/><circle cx='22' cy='30' r='3' ${F(0.7)}/></g><path d='M24 23.5 v1.5 M32.5 32 h-1.5 M24 40.5 v-1.5 M15.5 32 h1.5' ${S(0.8, 1)}/>${chl(26, 70, -20)}${chl(84, 30, 70)}${chl(66, 20, 8)}${chl(84, 66, -60)}${chl(50, 80, 0)}<g ${S(0.9, 1)}><ellipse cx='16' cy='52' rx='4' ry='2.2' ${F(0.2)}/><path d='M14 52 q1 -1 2 0 q1 1 2 0' ${S(0.7, 0.6)}/></g><g ${F(0.55)}><circle cx='14' cy='20' r='0.9'/><circle cx='34' cy='20' r='0.9'/><circle cx='38' cy='56' r='0.9'/><circle cx='20' cy='62' r='0.9'/><circle cx='88' cy='48' r='0.9'/><circle cx='36' cy='82' r='0.9'/><circle cx='72' cy='82' r='0.9'/></g>`;
  },
  // 6. Photosynthesis: sun, leaf, CO2 / O2 / water arrows
  () => {
    let rays = '';
    for (let a = 0; a < 360; a += 30) rays += `M${n1(22 + 12 * Math.cos(rad(a)))} ${n1(22 + 12 * Math.sin(rad(a)))} L${n1(22 + (a % 60 ? 16 : 19) * Math.cos(rad(a)))} ${n1(22 + (a % 60 ? 16 : 19) * Math.sin(rad(a)))}`;
    const leaf = 'M34 84 C30 56 58 36 88 38 C90 66 66 90 34 84Z';
    return `<circle cx='22' cy='22' r='9' ${F(0.35)}/><g ${S(0.95, 1.5)}><circle cx='22' cy='22' r='9'/><path d='${rays}'/></g><g stroke-dasharray='2 2'>${arrow(32, 34, 46, 48, 0.8)}${arrow(36, 26, 54, 38, 0.6)}</g><path d='${leaf}' ${F(0.12)}/><path d='M34 84 C30 56 58 36 88 38 L70 60 C58 70 46 76 34 84Z' ${F(0.2)}/><g ${S(0.95, 1.7)}><path d='${leaf}'/></g><g ${S(0.8, 1.3)}><path d='M34 84 C50 66 68 52 86 40'/></g><g ${S(0.5, 0.8)}><path d='M44 74 L42 62 M50 70 L50 58 M56 65 L60 54 M62 60 L68 52 M42 76 L56 78 M50 70 L64 72 M58 64 L72 62 M66 58 L78 54' /></g><path d='M34 84 C30 90 28 92 24 94' ${S(0.9, 1.5)}/><g ${S(0.9, 1)}><circle cx='10' cy='60' r='3' ${F(0.5)}/><circle cx='16' cy='60' r='2.2' ${F(0.2)}/><circle cx='4' cy='60' r='2.2' ${F(0.2)}/></g>${arrow(20, 62, 36, 68)}<g ${S(0.9, 1)}><circle cx='80' cy='18' r='2.6' ${F(0.2)}/><circle cx='86' cy='18' r='2.6' ${F(0.2)}/></g>${arrow(78, 36, 80, 26)}<path d='M12 84 C14 80 16 78 16 78 C16 78 20 82 18 86 C16 88 12 88 12 84Z' ${F(0.5)}/>${arrow(20, 86, 30, 86)}${arrow(84, 82, 70, 76, 0.5)}<g ${S(0.4, 0.8)}><path d='M54 94 H94 M60 90 H88' /></g>`;
  },
  // 7. Fern frond with pinnae and a young coil
  () => {
    const P = (t: number) => { const u = 1 - t; return [u ** 3 * 44 + 3 * u * u * t * 44 + 3 * u * t * t * 50 + t ** 3 * 68, u ** 3 * 94 + 3 * u * u * t * 70 + 3 * u * t * t * 36 + t ** 3 * 8]; };
    let pin = '';
    for (let i = 1; i <= 15; i++) {
      const t = 0.1 + i * 0.058, [x, y] = P(t), [x2, y2] = P(t + 0.01), a = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI, l = n1(8 + 24 * Math.pow(Math.sin(Math.PI * Math.min(t * 1.05, 1)), 0.9) * (1 - t * 0.6)), w = n1(l * 0.17);
      for (const s of [-1, 1]) {
        const ang = a + s * (60 - t * 12);
        pin += `<g transform='translate(${n1(x)} ${n1(y)}) rotate(${n1(ang)})'><path d='${petal(l, w)}' ${F(0.14 + (s > 0 ? 0.1 : 0))}/><path d='${petal(l, w)}' ${S(0.85, 0.9)}/><path d='M1 0 H${n1(l * 0.85)}' ${S(0.4, 0.6)}/></g>`;
      }
    }
    return `<g ${S(0.4, 0.8)}><path d='M10 94 H90'/></g>${pin}<g ${S(0.95, 1.8)}><path d='M44 94 C44 70 50 36 68 8'/></g><g ${S(0.95, 1.6)}><path d='M20 94 C20 76 12 60 18 46 C23 36 33 38 31 46 C29 53 22 50 24 45'/></g><path d='M18 46 C23 36 33 38 31 46 C29 53 22 50 24 45' ${S(0.35, 3)}/><g ${F(0.6)}><circle cx='14' cy='66' r='0.9'/><circle cx='26' cy='70' r='0.9'/></g>`;
  },
  // 8. Lotus flower, bud and pads on water
  () => {
    const outer = [-160, -128, -90, -52, -20].map((a) => pt(50, 62, a, 36, 8.5, 0.12)).join('');
    const mid = [-140, -108, -72, -40].map((a) => pt(50, 62, a, 30, 7.5, 0.2)).join('');
    const inn = [-112, -90, -68].map((a) => pt(50, 62, a, 24, 6.5, 0.32)).join('');
    let vn = '';
    for (let a = 0; a < 360; a += 30) vn += `M0 0 L${n1(18 * Math.cos(rad(a)))} ${n1(6 * Math.sin(rad(a)))}`;
    const pad = (x: number, y: number, k: number) => `<g transform='translate(${x} ${y}) scale(${k})'><ellipse rx='20' ry='6.5' ${F(0.18)}/><g ${S(0.9, 1.3 / k)}><ellipse rx='20' ry='6.5'/><path d='${vn}' ${S(0.5, 0.7 / k)}/></g><path d='M20 0 L8 -1 L10 2Z' fill='#fff' fill-opacity='0'/></g>`;
    return `<g ${S(0.4, 0.8)}><ellipse cx='50' cy='82' rx='44' ry='10'/><ellipse cx='50' cy='82' rx='34' ry='7' /><path d='M12 90 Q50 98 88 90'/></g>${pad(24, 84, 1)}${pad(78, 86, 0.9)}<g ${S(0.9, 1.4)}><path d='M50 80 C50 74 50 70 50 64 M82 52 C80 66 82 74 80 82'/></g>${outer}${mid}${inn}<g ${S(0.9, 1.2)}><path d='M82 52 C77 52 75 46 77 40 C80 44 82 46 82 52Z M82 52 C87 52 89 46 87 40 C84 44 82 46 82 52Z M82 52 C80 46 82 40 82 36 C84 40 84 46 82 52Z' ${F(0.35)}/></g><ellipse cx='50' cy='54' rx='6' ry='3' ${F(0.55)}/><g ${S(0.9, 1.2)}><ellipse cx='50' cy='54' rx='6' ry='3'/></g><g ${F(0.9)}><circle cx='48' cy='54' r='.7'/><circle cx='52' cy='54' r='.7'/><circle cx='50' cy='53' r='.7'/></g><g ${F(0.7)}>${[44, 47, 50, 53, 56].map((x) => `<circle cx='${x}' cy='${n1(48 + Math.abs(x - 50) * 0.4)}' r='.7'/>`).join('')}</g>`;
  },
];
