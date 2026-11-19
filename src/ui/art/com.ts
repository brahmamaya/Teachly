import type { Art } from './kit';
import { S, F, poly } from './kit';

// Small filled arrowhead at (x,y) pointing in direction angle a (degrees).
const ah = (x: number, y: number, a: number, s = 3.6) => `<path ${F(0.9)} transform='translate(${x} ${y}) rotate(${a})' d='M0 0L${-s * 1.6} ${-s}V${s}Z'/>`;
const node = (x: number, y: number, r: number, hot = false) => `<circle cx='${x}' cy='${y}' r='${r}' ${F(hot ? 0.75 : 0.2)}/><circle cx='${x}' cy='${y}' r='${r}' ${S(0.9, hot ? 1.8 : 1.4)}/>${hot ? '' : `<circle cx='${x}' cy='${y}' r='1.5' ${F(0.7)}/>`}`;
const bar = (x: number, y: number, w: number, o: number) => `<rect x='${x}' y='${y}' width='${w}' height='2.6' rx='1.3' ${F(o)}/>`;

// One side of the CPU: 5 pins and fanned-out traces ending in pads (rotated 4 times).
const side = () => {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const y = 38 + i * 6, y2 = 50 + (y - 50) * 1.7;
    s += `<path ${S(0.9, 1.7)} d='M22 ${y}H30'/><path ${S(0.6, 1.1)} d='${poly([[22, y], [17, y], [12, y2]])}'/><circle cx='10' cy='${y2}' r='1.9' ${S(0.8, 1.1)}/>`;
  }
  return s;
};

export const COMPUTER: Art[] = [
  // Laptop showing code with angle brackets
  () => {
    const lines = [[28, 47, 14, 0.8], [33, 47, 22, 0.5], [33, 51.5, 12, 0.7], [28, 56, 26, 0.5]].map((l) => bar(l[0], l[1], l[2], l[3])).join('') + bar(60, 47, 14, 0.4) + bar(60, 56, 10, 0.4);
    return `<rect x='14' y='14' width='72' height='50' rx='4' ${F(0.2)}/><rect x='14' y='14' width='72' height='50' rx='4' ${S(0.9, 1.7)}/><rect x='19' y='19' width='62' height='40' rx='1.5' ${F(0.14)}/><rect x='19' y='19' width='62' height='40' rx='1.5' ${S(0.5, 0.9)}/><path ${S(0.95, 2)} d='M41 25L33 33L41 41M59 25L67 33L59 41M54 24L46 42'/><path ${S(0.4, 0.8)} d='M19 44H81'/><g ${S(0.5, 1)}><path d='M23 47v0M23 51.5v0M23 56v0'/></g>${lines}<path d='M8 68H92L87 79Q86 81 83 81H17Q14 81 13 79Z' ${F(0.35)}/><path ${S(0.9, 1.6)} d='M8 68H92L87 79Q86 81 83 81H17Q14 81 13 79ZM42 68Q50 72 58 68'/><path ${S(0.25, 3)} d='M20 88H80'/><path ${S(0.5, 0.9)} d='M8 10v6M5 13h6M92 8v5M89.5 10.5h5'/>`;
  },
  // Binary tree, highlighted search path
  () => {
    const e = [[50, 16, 28, 40], [50, 16, 72, 40], [28, 40, 16, 64], [28, 40, 40, 64], [72, 40, 60, 64], [72, 40, 84, 64], [16, 64, 10, 86], [16, 64, 24, 86]];
    const edges = e.map((a) => `M${a[0]} ${a[1]}L${a[2]} ${a[3]}`).join('');
    return `<path ${S(0.55, 1.2)} d='${edges}'/><path ${S(0.95, 2.4)} d='M50 16L28 40L40 64'/>${node(50, 16, 8, true)}${node(28, 40, 7, true)}${node(72, 40, 7)}${node(16, 64, 6)}${node(40, 64, 6, true)}${node(60, 64, 6)}${node(84, 64, 6)}${node(10, 86, 4)}${node(24, 86, 4)}<path ${S(0.5, 1)} d='M33 84H92M33 90H92' stroke-dasharray='1 3'/>`;
  },
  // CPU chip with pins and traces
  () => {
    let g = '';
    for (const a of [0, 90, 180, 270]) g += `<g transform='rotate(${a} 50 50)'>${side()}</g>`;
    return `${g}<rect x='30' y='30' width='40' height='40' rx='3' ${F(0.2)}/><rect x='30' y='30' width='40' height='40' rx='3' ${S(0.95, 1.9)}/><rect x='36' y='36' width='28' height='28' rx='2' ${S(0.5, 0.9)}/><rect x='40' y='40' width='20' height='20' rx='1.5' ${F(0.45)}/><rect x='40' y='40' width='20' height='20' rx='1.5' ${S(0.9, 1.3)}/><path ${S(0.55, 0.8)} d='M46.7 40V60M53.3 40V60M40 46.7H60M40 53.3H60'/><circle cx='34' cy='34' r='1.6' ${F(0.8)}/>`;
  },
  // Flowchart with decision diamond and loop
  () =>
    `<rect x='22' y='6' width='32' height='11' rx='5.5' ${F(0.35)}/><rect x='22' y='6' width='32' height='11' rx='5.5' ${S(0.9, 1.5)}/><rect x='20' y='24' width='36' height='13' rx='2' ${F(0.15)}/><rect x='20' y='24' width='36' height='13' rx='2' ${S(0.9, 1.5)}/>${bar(26, 28.7, 20, 0.5)}<path d='M38 42L56 54L38 66L20 54Z' ${F(0.28)}/><path ${S(0.9, 1.6)} d='M38 42L56 54L38 66L20 54Z'/><circle cx='38' cy='54' r='2' ${F(0.7)}/><rect x='22' y='74' width='32' height='11' rx='5.5' ${F(0.35)}/><rect x='22' y='74' width='32' height='11' rx='5.5' ${S(0.9, 1.5)}/><rect x='68' y='46' width='24' height='16' rx='2' ${F(0.15)}/><rect x='68' y='46' width='24' height='16' rx='2' ${S(0.9, 1.5)}/>${bar(72, 51, 16, 0.5)}${bar(72, 56, 10, 0.4)}<path ${S(0.85, 1.4)} d='M38 17V23M38 37V41M38 66V73M56 54H67M80 46V30.5H57'/>${ah(38, 24, 90, 2.6)}${ah(38, 42, 90, 2.6)}${ah(38, 74, 90, 2.6)}${ah(68, 54, 0, 2.6)}${ah(56.5, 30.5, 180, 2.6)}<circle cx='62' cy='50' r='1.3' ${F(0.8)}/><circle cx='43' cy='70' r='1.3' ${F(0.8)}/>`,
  // Circuit board with IC, resistor, capacitor, vias
  () => {
    const t = [[[43, 40], [43, 30], [30, 30], [24, 24], [24, 17]], [[50, 40], [50, 15]], [[57, 40], [57, 30], [70, 30], [76, 24], [76, 17]], [[43, 60], [43, 70], [30, 70], [24, 76], [24, 83]], [[50, 60], [50, 85]], [[57, 60], [57, 70], [70, 70], [76, 76], [76, 83]], [[38, 46], [24, 46], [18, 52], [18, 60]], [[62, 54], [70, 54]]];
    const pads = [[24, 15], [50, 13], [76, 15], [24, 85], [50, 87], [76, 85], [18, 62]];
    return `<rect x='8' y='8' width='84' height='84' rx='7' ${F(0.1)}/><rect x='8' y='8' width='84' height='84' rx='7' ${S(0.8, 1.6)}/><path ${S(0.85, 1.4)} d='${t.map((p) => poly(p)).join('')}'/>${pads.map((p) => `<circle cx='${p[0]}' cy='${p[1]}' r='2' ${F(0.2)}/><circle cx='${p[0]}' cy='${p[1]}' r='2' ${S(0.9, 1.1)}/>`).join('')}<rect x='38' y='40' width='24' height='20' rx='2' ${F(0.5)}/><rect x='38' y='40' width='24' height='20' rx='2' ${S(0.95, 1.6)}/><circle cx='42' cy='44' r='1.4' ${F(0.9)}/><path ${S(0.9, 1.2)} d='M70 54H73L74.5 50L77 58L79.5 50L82 58L83.5 54H86'/><path ${S(0.9, 1.5)} d='M18 62V66M14 66H22M14 70H22M18 70V76'/><circle cx='13' cy='13' r='3' ${S(0.6, 1)}/><circle cx='87' cy='13' r='3' ${S(0.6, 1)}/><circle cx='13' cy='87' r='3' ${S(0.6, 1)}/><circle cx='87' cy='87' r='3' ${S(0.6, 1)}/><circle cx='82' cy='34' r='2.4' ${S(0.7, 1)}/><circle cx='82' cy='34' r='0.8' ${F(0.8)}/>`;
  },
  // Network of connected devices
  () =>
    `<path ${S(0.6, 1.2)} d='M42 44L24 26M58 44L76 26M42 56L24 74M58 56L76 74' stroke-dasharray='3 2.5'/><circle cx='33' cy='35' r='1.6' ${F(0.9)}/><circle cx='67' cy='35' r='1.6' ${F(0.9)}/><circle cx='33' cy='65' r='1.6' ${F(0.9)}/><circle cx='67' cy='65' r='1.6' ${F(0.9)}/><circle cx='50' cy='50' r='12' ${F(0.35)}/><circle cx='50' cy='50' r='12' ${S(0.95, 1.8)}/><ellipse cx='50' cy='50' rx='5' ry='12' ${S(0.6, 1)}/><path ${S(0.6, 1)} d='M38 50H62M40 43H60M40 57H60'/><rect x='8' y='8' width='26' height='17' rx='2' ${F(0.2)}/><rect x='8' y='8' width='26' height='17' rx='2' ${S(0.9, 1.5)}/><path ${S(0.9, 1.5)} d='M21 25V30M15 30H27'/>${bar(12, 12, 12, 0.5)}${bar(12, 17, 8, 0.4)}<rect x='66' y='8' width='26' height='20' rx='2' ${F(0.25)}/><rect x='66' y='8' width='26' height='20' rx='2' ${S(0.9, 1.5)}/><path ${S(0.7, 1)} d='M66 15H92M66 21.5H92'/><circle cx='71' cy='11.5' r='1.1' ${F(0.9)}/><circle cx='71' cy='18.2' r='1.1' ${F(0.9)}/><circle cx='71' cy='24.8' r='1.1' ${F(0.9)}/><rect x='8' y='74' width='26' height='15' rx='2' ${F(0.2)}/><rect x='8' y='74' width='26' height='15' rx='2' ${S(0.9, 1.5)}/><path ${S(0.9, 1.5)} d='M4 89H38L36 92H6Z'/><rect x='72' y='68' width='14' height='24' rx='3' ${F(0.25)}/><rect x='72' y='68' width='14' height='24' rx='3' ${S(0.9, 1.5)}/><path ${S(0.7, 1)} d='M76 72H82M77 88H81'/><path ${S(0.5, 1)} d='M89 74Q93 80 89 86M92 71Q98 80 92 89'/><path ${S(0.6, 1)} d='M42 33Q50 27 58 33M45 37Q50 33 55 37'/>`,
  // Database cylinders with table and query arrow
  () => {
    let c = '';
    for (const y of [40, 60]) c += `<path ${S(0.8, 1.3)} d='M14 ${y}A20 6 0 0 0 54 ${y}'/>`;
    const dots = [0, 1, 2].map((i) => `<circle cx='22' cy='${[32, 52, 72][i]}' r='1.7' ${F(0.8)}/>${bar(28, [30.7, 50.7, 70.7][i], 14, 0.5)}`).join('');
    let tb = '';
    for (let r = 0; r < 4; r++) tb += `M64 ${34 + r * 9}H92`;
    return `<path d='M14 20V80A20 6 0 0 0 54 80V20Z' ${F(0.2)}/><path ${S(0.95, 1.8)} d='M14 20V80A20 6 0 0 0 54 80V20'/>${c}<ellipse cx='34' cy='20' rx='20' ry='6' ${F(0.4)}/><ellipse cx='34' cy='20' rx='20' ry='6' ${S(0.95, 1.8)}/>${dots}<rect x='64' y='25' width='28' height='9' rx='1.5' ${F(0.45)}/><rect x='64' y='43' width='28' height='9' ${F(0.2)}/><rect x='64' y='25' width='28' height='45' rx='1.5' ${S(0.9, 1.5)}/><path ${S(0.6, 1)} d='${tb}M78 25V70M71 25V70'/><path ${S(0.9, 1.6)} d='M56 46H61'/>${ah(63, 46, 0, 2.6)}<path ${S(0.5, 1)} d='M66 80H90M66 86H82'/>`;
  },
  // Cloud with upload / download arrows
  () => {
    const dat = Array.from({ length: 7 }, (_, i) => (i % 3 === 1 ? `<path ${S(0.7, 1.4)} d='M${30 + i * 6.5} 34v7'/>` : `<circle cx='${30 + i * 6.5}' cy='37.5' r='3' ${S(0.7, 1.3)}/>`)).join('');
    return `<path d='M28 58C12 58 8 42 18 36C18 24 32 20 40 27C44 12 66 12 70 26C84 22 94 34 88 44C94 52 90 58 80 58Z' ${F(0.18)}/><path ${S(0.95, 1.8)} d='M28 58C12 58 8 42 18 36C18 24 32 20 40 27C44 12 66 12 70 26C84 22 94 34 88 44C94 52 90 58 80 58Z'/><path ${S(0.4, 1)} d='M24 50C30 53 38 54 46 53'/>${dat}<path d='M8 70H34V94H8Z' ${F(0.2)}/><path ${S(0.9, 1.5)} d='M8 70H26L34 78V94H8ZM26 70V78H34'/>${bar(13, 83, 16, 0.5)}${bar(13, 88, 10, 0.4)}<path d='M64 76H72L75 72H92V94H64Z' ${F(0.3)}/><path ${S(0.9, 1.5)} d='M64 76H72L75 72H92V94H64ZM64 80H92'/><path ${S(0.9, 2)} d='M21 68V62M44 78V70M40 74L44 69L48 74'/>${ah(21, 60, -90, 2.6)}<path ${S(0.9, 2)} d='M64 62V70M60 66L64 71L68 66'/>`;
  },
];
