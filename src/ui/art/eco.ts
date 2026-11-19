import type { Art } from './kit';
import { S, F, n1, poly } from './kit';

const P = (cx: number, cy: number, r: number, a: number) => [n1(cx + r * Math.cos((a * Math.PI) / 180)), n1(cy + r * Math.sin((a * Math.PI) / 180))];
const ah = (x: number, y: number, a: number, s = 3.6) => `<path ${F(0.9)} transform='translate(${x} ${y}) rotate(${a})' d='M0 0L${-s * 1.6} ${-s}V${s}Z'/>`;

// A coin (short cylinder) with milled edge: top ellipse centre (cx,cy), half width rx, thickness h.
const coin = (cx: number, cy: number, rx: number, h: number, o = 0.3) => {
  const ry = rx * 0.36;
  let t = '';
  for (let i = -3; i <= 3; i++) t += `M${n1(cx + (i * rx) / 3.4)} ${n1(cy + ry * 0.96 + 0.8)}v${h - 2}`;
  return `<path ${F(o)} d='M${cx - rx} ${cy}V${cy + h}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + h}V${cy}Z'/><path ${S(0.9, 1.3)} d='M${cx - rx} ${cy}V${cy + h}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + h}V${cy}'/><path ${S(0.4, 0.7)} d='${t}'/><ellipse cx='${cx}' cy='${cy}' rx='${rx}' ry='${ry}' ${F(o + 0.15)}/><ellipse cx='${cx}' cy='${cy}' rx='${rx}' ry='${ry}' ${S(0.9, 1.3)}/>`;
};

// Pie slice from angle a0 to a1 (degrees), shifted outward by d.
const slice = (cx: number, cy: number, r: number, a0: number, a1: number, d: number, o: number) => {
  const m = (a0 + a1) / 2, s = P(0, 0, d, m), x = cx + s[0], y = cy + s[1], p = P(x, y, r, a0), q = P(x, y, r, a1);
  const dd = `M${x} ${y}L${p[0]} ${p[1]}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${q[0]} ${q[1]}Z`;
  return `<path ${F(o)} d='${dd}'/><path ${S(0.9, 1.5)} d='${dd}'/>`;
};

// Smooth line through points (quadratic curves via midpoints).
const smooth = (p: number[][]) => {
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) d += `Q${p[i][0]} ${p[i][1]} ${n1((p[i][0] + p[i + 1][0]) / 2)} ${n1((p[i][1] + p[i + 1][1]) / 2)}`;
  return d + `L${p[p.length - 1][0]} ${p[p.length - 1][1]}`;
};

// Arc arrow around the globe from angle a to b (clockwise) with an arrowhead.
const arc = (a: number, b: number) => {
  const s = P(50, 50, 36, a), e = P(50, 50, 36, b);
  return `<path ${S(0.9, 1.9)} d='M${s[0]} ${s[1]}A36 36 0 0 1 ${e[0]} ${e[1]}'/>${ah(e[0], e[1], b + 90, 3.2)}`;
};

export const ECONOMICS: Art[] = [
  // Supply and demand with equilibrium and shaded surplus
  () => {
    let h = '', g = '';
    for (let y = 22; y < 50; y += 4.5) h += `M16 ${y}H${n1(16 + (y - 18) / 0.94)}`;
    for (let y = 54; y < 82; y += 4.5) h += `M16 ${y}H${n1(16 + (82 - y) / 0.94)}`;
    for (let y = 18; y <= 82; y += 16) g += `M14 ${y}h3`;
    return `<path ${F(0.3)} d='M16 18L50 50H16Z'/><path ${F(0.16)} d='M16 82L50 50H16Z'/><path ${S(0.35, 0.8)} d='${h}'/><path ${S(0.9, 1.8)} d='M16 8V86H92'/><path ${S(0.5, 1)} d='${g}'/>${ah(16, 6, -90, 2.4)}${ah(94, 86, 0, 2.4)}<path ${S(0.95, 2)} d='M16 18Q40 28 50 50T84 82'/><path ${S(0.95, 2)} d='M16 82Q40 72 50 50T84 18'/><path ${S(0.7, 1.1)} d='M16 50H50V86' stroke-dasharray='2.5 2.5'/><circle cx='50' cy='50' r='5.5' ${F(0.2)}/><circle cx='50' cy='50' r='3' ${F(0.95)}/><circle cx='84' cy='18' r='1.6' ${F(0.8)}/><circle cx='84' cy='82' r='1.6' ${F(0.8)}/>`;
  },
  // Rising bar chart with trend arrow
  () => {
    const hs = [14, 22, 20, 34, 44, 56];
    let b = '', g = '', pts: number[][] = [];
    hs.forEach((h, i) => {
      const x = 18 + i * 12.4, y = 84 - h;
      b += `<rect x='${x}' y='${y}' width='9' height='${h}' ${F(0.14 + i * 0.1)}/><path ${F(0.55)} d='M${x + 9} ${y}L${x + 11.5} ${y - 2}V${82 - h + 0}L${x + 9} 84Z'/><path ${S(0.9, 1.4)} d='M${x} 84V${y}H${x + 9}V84M${x} ${y}L${x + 2.5} ${y - 2}H${x + 11.5}L${x + 9} ${y}'/>`;
      pts.push([x + 4.5, y - 7]);
    });
    for (let y = 24; y < 84; y += 12) g += `M14 ${y}H92`;
    return `<path ${S(0.3, 0.8)} d='${g}' stroke-dasharray='1.5 3'/><path ${S(0.9, 1.8)} d='M14 8V84H94'/>${b}<path ${S(0.95, 2)} d='${poly(pts)}'/>${pts.map((p) => `<circle cx='${p[0]}' cy='${p[1]}' r='2' ${F(0.95)}/>`).join('')}<path ${S(0.95, 2)} d='M${pts[5][0]} ${pts[5][1]}L88 10'/>${ah(90, 9, -50, 3.2)}`;
  },
  // Coin stacks with a falling coin
  () => {
    let a = '', b = '';
    for (let i = 0; i < 7; i++) a += coin(32, 78 - i * 8, 17, 7, 0.22 + (i % 2) * 0.1);
    for (let i = 0; i < 4; i++) b += coin(72, 78 - i * 8, 15, 7, 0.22 + (i % 2) * 0.1);
    return `<ellipse cx='50' cy='90' rx='42' ry='4' ${F(0.15)}/>${a}${b}<ellipse cx='32' cy='28' rx='11' ry='3.6' ${S(0.7, 1)}/><path ${S(0.8, 1.2)} d='M32 24.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6L32 30.4l-2.4 1.3.5-2.6-1.9-1.8 2.6-.4Z'/><g transform='rotate(-20 72 22)'><ellipse cx='72' cy='22' rx='6' ry='10' ${F(0.5)}/><ellipse cx='72' cy='22' rx='6' ry='10' ${S(0.95, 1.5)}/><ellipse cx='72' cy='22' rx='3' ry='6' ${S(0.7, 1)}/></g><path ${S(0.5, 1)} d='M84 8l3-3M89 14h4M60 6l-2-3'/>`;
  },
  // Pie chart with exploded slice and label leaders
  () =>
    `${slice(42, 56, 30, -90, 36, 8, 0.55)}${slice(42, 56, 30, 36, 108, 0, 0.18)}${slice(42, 56, 30, 108, 180, 0, 0.35)}${slice(42, 56, 30, 180, 238, 0, 0.1)}${slice(42, 56, 30, 238, 270, 0, 0.45)}<path ${S(0.5, 0.8)} d='M42 56L${P(42, 56, 30, 144).join(' ')}M${P(42, 56, 30, 270).join(' ')}L42 56'/><path ${S(0.85, 1.3)} d='M72 31L86 26H94'/><circle cx='72' cy='31' r='1.6' ${F(0.9)}/><rect x='68' y='64' width='6' height='6' rx='1' ${F(0.55)}/><rect x='68' y='74' width='6' height='6' rx='1' ${F(0.18)}/><rect x='68' y='84' width='6' height='6' rx='1' ${F(0.35)}/><path ${S(0.7, 1.3)} d='M78 67H92M78 77H90M78 87H88'/>`,
  // Balance scale with coins vs goods
  () =>
    `<path ${F(0.3)} d='M30 90H70L64 82H36Z'/><path ${S(0.9, 1.6)} d='M30 90H70L64 82H36ZM50 22V82'/><path ${S(0.9, 2.2)} d='M20.3 26.2L79.7 17.8'/><circle cx='50' cy='22' r='4' ${F(0.5)}/><circle cx='50' cy='22' r='4' ${S(0.95, 1.5)}/><circle cx='50' cy='13' r='2.4' ${F(0.9)}/><path ${S(0.7, 1.1)} d='M20.3 26.2L8 50M20.3 26.2L33 50M79.7 17.8L67.5 38M79.7 17.8L91.5 38'/><path ${F(0.3)} d='M7 50H34Q33 61 20.5 61Q8 61 7 50Z'/><path ${S(0.9, 1.6)} d='M7 50H34Q33 61 20.5 61Q8 61 7 50Z'/><path ${F(0.3)} d='M66 38H93Q92 49 79.5 49Q67 49 66 38Z'/><path ${S(0.9, 1.6)} d='M66 38H93Q92 49 79.5 49Q67 49 66 38Z'/>${coin(20.5, 41, 8, 3, 0.3)}${coin(20.5, 44.8, 8, 3, 0.45)}${coin(20.5, 36.5, 8, 3, 0.3)}<path ${S(0.7, 1)} d='M80 24l0 0'/><rect x='73' y='27' width='13' height='11' ${F(0.28)}/><rect x='73' y='27' width='13' height='11' ${S(0.9, 1.4)}/><path ${S(0.7, 1)} d='M73 32H86M79.5 27V38'/><path ${S(0.6, 1)} d='M16 80h-6M84 80h6M12 14v5M9.5 16.5h5'/>`,
  // Globe with trade arrows
  () =>
    `<circle cx='50' cy='50' r='24' ${F(0.15)}/><path ${F(0.28)} d='M36 40C40 36 44 38 44 42C42 48 46 52 42 58C40 62 36 60 36 54C34 48 32 44 36 40ZM54 40C60 38 66 42 64 48C68 52 64 60 58 62C54 56 56 50 52 46Z'/><path ${F(0.25)} d='M${P(50, 50, 24, -50).join(' ')}A24 24 0 0 1 ${P(50, 50, 24, 130).join(' ')}A27 27 0 0 0 ${P(50, 50, 24, -50).join(' ')}Z'/><circle cx='50' cy='50' r='24' ${S(0.95, 1.8)}/><ellipse cx='50' cy='50' rx='10' ry='24' ${S(0.55, 0.9)}/><path ${S(0.55, 0.9)} d='M26 50H74M30 38Q50 43 70 38M30 62Q50 57 70 62M50 26V74'/>${arc(205, 255)}${arc(285, 335)}${arc(25, 75)}${arc(105, 155)}<rect x='45.5' y='11' width='9' height='7' rx='1' ${F(0.5)}/><rect x='45.5' y='11' width='9' height='7' rx='1' ${S(0.9, 1.1)}/><rect x='45.5' y='82' width='9' height='7' rx='1' ${F(0.5)}/><rect x='45.5' y='82' width='9' height='7' rx='1' ${S(0.9, 1.1)}/>`,
  // GDP line graph with grid, recession band and tooltip
  () => {
    const p = [[16, 70], [26, 62], [36, 66], [46, 50], [56, 54], [64, 40], [72, 58], [80, 62], [90, 36]];
    const d = smooth(p);
    let g = '';
    for (let y = 22; y < 80; y += 12) g += `M14 ${y}H92`;
    for (let x = 28; x < 90; x += 14) g += `M${x} 10V84`;
    return `<rect x='68' y='10' width='14' height='74' ${F(0.12)}/><path ${S(0.3, 0.8)} d='${g}' stroke-dasharray='1.5 2.5'/><path ${F(0.18)} d='${d}V84H16Z'/><path ${S(0.9, 1.8)} d='M14 8V84H94'/><path ${S(0.98, 2)} d='${d}'/>${p.map((q) => `<circle cx='${q[0]}' cy='${q[1]}' r='1.8' ${F(0.95)}/>`).join('')}<path ${S(0.6, 1)} d='M46 50V84' stroke-dasharray='2 2'/><circle cx='46' cy='50' r='4.5' ${S(0.9, 1.3)}/><rect x='35' y='24' width='22' height='12' rx='2.5' ${F(0.3)}/><rect x='35' y='24' width='22' height='12' rx='2.5' ${S(0.9, 1.3)}/><path ${S(0.8, 1.1)} d='M46 36V45.5M39 28.5H53M39 32.5H48'/>${ah(94, 86, 0, 2.4)}${ah(14, 6, -90, 2.4)}`;
  },
  // Piggy bank with falling coin
  () =>
    `<ellipse cx='48' cy='92' rx='34' ry='2.6' ${F(0.15)}/><path d='M26 76H38V90H26ZM56 78H68V90H56Z' ${F(0.35)}/><path ${S(0.9, 1.5)} d='M26 76V90H38V78M56 78V90H68V76'/><ellipse cx='46' cy='58' rx='34' ry='25' ${F(0.2)}/><path ${F(0.25)} d='M16 66Q44 92 76 74Q50 82 16 66Z'/><ellipse cx='46' cy='58' rx='34' ry='25' ${S(0.95, 1.8)}/><path ${F(0.3)} d='M64 38L72 26L82 44Z'/><path ${S(0.9, 1.5)} d='M64 38L72 26L82 44'/><ellipse cx='84' cy='60' rx='8' ry='9.5' ${F(0.3)}/><ellipse cx='84' cy='60' rx='8' ry='9.5' ${S(0.9, 1.6)}/><ellipse cx='82' cy='57' rx='1.3' ry='2.2' ${F(0.9)}/><ellipse cx='86.5' cy='57' rx='1.3' ry='2.2' ${F(0.9)}/><circle cx='73' cy='50' r='2.2' ${F(0.95)}/><path ${S(0.95, 2.6)} d='M36 34H56'/><path ${S(0.9, 1.4)} d='M12 54Q3 51 7 45Q11 41 6 37'/><path ${S(0.4, 1)} d='M24 50Q29 40 40 36M28 70L32 74M33 72L37 76M38 74L42 78'/><ellipse cx='46' cy='15' rx='5' ry='9' ${F(0.5)}/><ellipse cx='46' cy='15' rx='5' ry='9' ${S(0.95, 1.5)}/><ellipse cx='46' cy='15' rx='2.4' ry='5' ${S(0.7, 1)}/><path ${S(0.5, 1)} d='M36 8L33 5M57 8L60 5M36 22L33 25M72 14h5'/>`,
];
