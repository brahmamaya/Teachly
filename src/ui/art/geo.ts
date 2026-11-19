import type { Art } from './kit';
import { S, F, n1, sine } from './kit';

const r = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const P = (cx: number, cy: number, rad: number, deg: number) => [n1(cx + rad * Math.cos((deg * Math.PI) / 180)), n1(cy + rad * Math.sin((deg * Math.PI) / 180))];
// wobbly closed contour ring around (cx,cy), radii rx/ry, smooth via quadratic curves
const ring = (cx: number, cy: number, rx: number, ry: number, k: number) => {
  const pts = r(0, 11).map((i) => { const a = (i * 30 * Math.PI) / 180; const w = 1 + 0.16 * Math.sin(3 * a + k) + 0.08 * Math.cos(2 * a + k * 2); return [n1(cx + rx * w * Math.cos(a)), n1(cy + ry * w * Math.sin(a))]; });
  const m = pts.map((p, i) => { const q = pts[(i + 1) % 12]; return [n1((p[0] + q[0]) / 2), n1((p[1] + q[1]) / 2)]; });
  return `M${m[11][0]} ${m[11][1]}` + pts.map((p, i) => `Q${p[0]} ${p[1]} ${m[i][0]} ${m[i][1]}`).join('');
};

export const GEOGRAPHY: Art[] = [
  // Globe with graticule, continents and tilted axis
  () => `<circle cx='50' cy='50' r='33' ${F(0.1)}/><path d='M50 17 A33 33 0 0 0 50 83 A15 33 0 0 1 50 17Z' ${F(0.12)}/>`
    + `<g transform='rotate(-23 50 50)'><path d='M34 30 C38 24 46 26 48 32 C46 38 40 38 42 46 C38 50 32 46 30 40Z M52 52 C58 48 66 52 64 60 C62 68 56 74 52 70 C50 64 48 58 52 52Z M56 28 C62 24 70 28 68 34 C62 36 58 34 56 28Z' ${F(0.32)}/>`
    + `<g ${S(0.9, 1.7)}><circle cx='50' cy='50' r='33'/></g><g ${S(0.55, 0.9)}><ellipse cx='50' cy='50' rx='13' ry='33'/><ellipse cx='50' cy='50' rx='25' ry='33'/><path d='M50 17 V83 M17 50 H83'/><path d='M22 33 Q50 41 78 33 M22 67 Q50 59 78 67 M31 23 Q50 28 69 23 M31 77 Q50 72 69 77'/></g>`
    + `<g ${S(0.9, 1.3)}><path d='M50 6 V16 M50 84 V94'/></g><circle cx='50' cy='6' r='1.6' ${F(0.8)}/></g>`
,
  // Mountain range with snowcaps, ridges and contours
  () => `<circle cx='78' cy='20' r='7' ${F(0.18)}/><circle cx='78' cy='20' r='7' ${S(0.7, 1.2)}/>`
    + `<path d='M6 80 L26 44 L38 58 L54 22 L74 58 L84 46 L94 80Z' ${F(0.1)}/><path d='M54 22 L74 58 L64 80 L56 58 L52 44Z' ${F(0.26)}/><path d='M26 44 L38 58 L30 80 L24 62Z' ${F(0.22)}/><path d='M84 46 L94 80 H80 L82 60Z' ${F(0.22)}/>`
    + `<path d='M54 22 L46 36 L50 34 L54 40 L58 34 L62 38 Z' ${F(0.6)}/><path d='M26 44 L21 53 L25 51 L28 54 L31 50Z' ${F(0.5)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M6 80 L26 44 L38 58 L54 22 L74 58 L84 46 L94 80'/><path d='M46 36 L50 34 L54 40 L58 34 L62 38 M21 53 L25 51 L28 54 L31 50'/></g>`
    + `<g ${S(0.5, 0.8)}><path d='M54 22 L52 44 L56 58 L52 70 M60 40 L62 52 M66 46 L64 70 M26 44 L30 62 L28 76 M84 46 L82 62'/><path d='M46 56 L40 66 M42 60 L36 70 M70 66 L76 72 M72 60 L80 66'/></g>`
    + `<path d='M6 84 H94 M10 88 H90' ${S(0.8, 1.3)}/><g ${S(0.4, 0.9)}><path d='M14 92 H86'/></g>`
    + `<g ${S(0.7, 1)}><path d='M14 28 q3 -3 6 0 q3 -3 6 0 M30 18 q2 -2 4 0 q2 -2 4 0'/></g>`
    + `<g>` + [[14, 72], [20, 74], [90, 72]].map((p) => `<path d='M${p[0]} ${p[1] + 8} L${p[0] + 3} ${p[1]} L${p[0] + 6} ${p[1] + 8}Z' ${F(0.4)}/>`).join('') + `</g>`,
  // Topographic contour map with grid, trail and pin
  () => `<rect x='10' y='10' width='80' height='80' rx='3' ${F(0.07)}/>`
    + `<g ${S(0.25, 0.6)}>` + r(1, 3).map((i) => `<path d='M${10 + i * 20} 10 V90 M10 ${10 + i * 20} H90'/>`).join('') + `</g>`
    + `<path d='${ring(44, 50, 32, 28, 0.5)}Z' ${F(0.07)}/><path d='${ring(44, 50, 22, 19, 0.7)}Z' ${F(0.1)}/><path d='${ring(44, 50, 13, 11, 0.9)}Z' ${F(0.16)}/><path d='${ring(44, 50, 5.5, 5, 1.1)}Z' ${F(0.3)}/>`
    + `<g ${S(0.85, 1.2)}><path d='${ring(44, 50, 32, 28, 0.5)}Z'/><path d='${ring(44, 50, 22, 19, 0.7)}Z' opacity='.8'/><path d='${ring(44, 50, 13, 11, 0.9)}Z'/><path d='${ring(44, 50, 5.5, 5, 1.1)}Z'/></g>`
    + `<g ${S(0.5, 0.9)}><path d='${ring(76, 72, 9, 8, 2)}Z'/><path d='${ring(76, 72, 4, 3.5, 2.2)}Z'/><path d='${ring(20, 24, 7, 6, 1)}Z'/></g>`
    + `<path d='M12 88 C30 80 36 70 48 66 S70 52 88 34' ${S(0.7, 1.1)} stroke-dasharray='3 2.2'/>`
    + `<g ${S(0.9, 1.5)}><path d='M44 40 L38 44 L50 44Z' ${F(0.8)}/></g>`
    + `<path d='M70 30 C70 20 84 20 84 30 C84 36 77 42 77 42 C77 42 70 36 70 30Z' ${F(0.4)}/><g ${S(0.9, 1.5)}><path d='M70 30 C70 20 84 20 84 30 C84 36 77 42 77 42 C77 42 70 36 70 30Z'/><circle cx='77' cy='30' r='2.6'/></g>`
    + `<g ${S(0.9, 1.8)}><rect x='10' y='10' width='80' height='80' rx='3'/></g>`,
  // River meandering to a delta and sea
  () => `<path d='M6 8 H94 V76 H6Z' ${F(0.07)}/><path d='M6 78 C30 72 70 72 94 78 V94 H6Z' ${F(0.2)}/>`
    + `<path d='M34 6 C8 20 66 24 40 38 C20 50 72 54 52 66 L52 74' ${S(0.22, 6)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M34 6 C8 20 66 24 40 38 C20 50 72 54 52 66 L52 74'/></g>`
    + `<g ${S(0.85, 1.4)}><path d='M52 68 C44 72 36 74 26 80 M52 68 C48 74 44 78 40 84 M52 68 V86 M52 68 C58 74 62 78 66 84 M52 68 C60 72 68 74 78 80'/></g>`
    + `<path d='M52 68 L26 80 H78Z' ${F(0.18)}/>`
    + `<g ${S(0.8, 1.5)}><path d='${sine(90, 1.8, 3, 0, 8, 92)}'/></g>`
    + `<g ${S(0.4, 0.9)}><path d='M10 14 L18 10 M10 24 L18 20 M70 12 L82 8 M72 24 L86 20 M72 40 L86 36 M10 40 L20 36 M70 56 L84 52 M10 60 L24 56 M10 68 H22 M80 62 L90 60'/></g>`
    + `<g>` + [[16, 32], [80, 30], [20, 52]].map((p) => `<circle cx='${p[0]}' cy='${p[1]}' r='3.5' ${F(0.2)}/><circle cx='${p[0]}' cy='${p[1]}' r='3.5' ${S(0.55, 0.9)}/>`).join('') + `</g>`,
  // Volcano cross-section with magma chamber, vent, layers, ash plume
  () => `<path d='M6 52 H94 V92 H6Z' ${F(0.1)}/><path d='M6 52 H34 L42 34 H58 L66 52 H94 V58 H6Z' ${F(0.18)}/>`
    + `<path d='M44 34 H56 L50 40Z' ${F(0.6)}/><path d='M47 40 H53 V72 H47Z' ${F(0.55)}/><path d='M30 72 C32 62 68 62 70 72 C72 84 60 88 50 88 C40 88 28 84 30 72Z' ${F(0.5)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M6 52 H34 L42 34 H58 L66 52 H94 M42 34 L50 40 L58 34 M47 40 V66 M53 40 V66 M30 72 C32 62 68 62 70 72 C72 84 60 88 50 88 C40 88 28 84 30 72Z'/></g>`
    + `<g ${S(0.5, 0.9)}><path d='M6 60 H28 M72 60 H94 M6 70 H26 M74 70 H94 M6 80 H28 M72 80 H94 M10 90 H90'/><path d='M36 46 L58 46 M30 52 H70' opacity='.5'/><path d='M34 52 L44 38 M66 52 L56 38' opacity='.5'/></g>`
    + `<g ${S(0.85, 1.4)}><path d='M50 32 C44 28 46 22 52 22 C52 14 62 12 64 18 C70 16 74 22 70 26 C74 30 68 34 62 32 C58 36 54 34 50 32Z'/></g><path d='M50 32 C44 28 46 22 52 22 C52 14 62 12 64 18 C70 16 74 22 70 26 C74 30 68 34 62 32 C58 36 54 34 50 32Z' ${F(0.2)}/>`
    + `<g ${S(0.7, 1.2)}><path d='M44 30 L40 24 M56 30 L58 24 M48 28 L46 20'/></g><g>` + [[38, 80], [58, 82], [50, 76], [62, 74]].map((p) => `<circle cx='${p[0]}' cy='${p[1]}' r='1.3' ${F(0.2)}/>`).join('') + `</g>`
    + `<path d='M56 40 C62 44 66 50 72 52' ${S(0.8, 1.2)} stroke-dasharray='2 2'/>`,
  // Water cycle: sun, cloud, rain, mountain, sea, arrows
  () => `<circle cx='80' cy='16' r='6' ${F(0.2)}/><g ${S(0.8, 1.2)}><circle cx='80' cy='16' r='6'/>` + r(0, 7).map((i) => { const a = P(80, 16, 9, i * 45); const b = P(80, 16, 12, i * 45); return `<path d='M${a[0]} ${a[1]} L${b[0]} ${b[1]}'/>`; }).join('') + `</g>`
    + `<path d='M4 74 L28 36 L40 54 L50 42 L70 74Z' ${F(0.14)}/><path d='M28 36 L40 54 L34 74 L26 52Z' ${F(0.28)}/><path d='M28 36 L24 43 L28 41 L31 44Z' ${F(0.6)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M4 74 L28 36 L40 54 L50 42 L70 74 M24 43 L28 41 L31 44'/></g>`
    + `<path d='M44 28 C38 28 36 20 42 18 C44 10 56 10 58 16 C66 14 70 22 64 26 C64 30 58 30 56 28Z' ${F(0.22)}/><g ${S(0.9, 1.5)}><path d='M44 28 C38 28 36 20 42 18 C44 10 56 10 58 16 C66 14 70 22 64 26 C64 30 58 30 56 28Z M44 28 H56'/></g>`
    + `<g ${S(0.8, 1.2)}>` + [[46, 33], [52, 33], [58, 33], [49, 40], [55, 40]].map((p) => `<path d='M${p[0]} ${p[1]} l-1.4 4'/>`).join('') + `</g>`
    + `<path d='M4 74 H96 V92 H4Z' ${F(0.2)}/><g ${S(0.85, 1.4)}><path d='${sine(76, 1.8, 6, 0, 4, 96)}'/></g><g ${S(0.4, 0.9)}><path d='${sine(84, 1.8, 5, 1, 8, 92)}'/></g>`
    + `<g ${S(0.8, 1.4)}><path d='M80 70 V46 M76 51 L80 46 L84 51 M88 70 V56 M85 60 L88 56 L91 60'/><path d='M30 80 C34 82 38 82 42 80 M38 77 L42 80 L38 83'/></g>`,
  // Compass rose with 8 points, rings and ticks
  () => {
    const t = r(0, 35).map((i) => { const a = P(50, 50, i % 3 ? 36 : 34, i * 10); const b = P(50, 50, 39, i * 10); return `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`; }).join('');
    const big = (a: number) => { const p = P(50, 50, 33, a); const l = P(50, 50, 7, a - 90); const q = P(50, 50, 7, a + 90); return `M${p[0]} ${p[1]} L${l[0]} ${l[1]} L50 50Z M${p[0]} ${p[1]} L${q[0]} ${q[1]} L50 50Z`; };
    const small = (a: number) => { const p = P(50, 50, 21, a); const l = P(50, 50, 5, a - 90); const q = P(50, 50, 5, a + 90); return `M${p[0]} ${p[1]} L${l[0]} ${l[1]} L${q[0]} ${q[1]}Z`; };
    const half = (a: number) => { const p = P(50, 50, 33, a); const l = P(50, 50, 7, a - 90); return `M${p[0]} ${p[1]} L${l[0]} ${l[1]} L50 50Z`; };
    return `<circle cx='50' cy='50' r='40' ${F(0.06)}/><g ${S(0.9, 1.6)}><circle cx='50' cy='50' r='41'/></g><g ${S(0.6, 0.8)}><circle cx='50' cy='50' r='36'/><circle cx='50' cy='50' r='15' opacity='.7'/><path d='${t}'/></g>`
      + `<path d='${[0, 90, 180, 270].map(small).join('')}' ${F(0.14)} transform='rotate(45 50 50)'/><g ${S(0.6, 0.8)}><path d='${[0, 90, 180, 270].map(small).join('')}' transform='rotate(45 50 50)'/></g>`
      + `<path d='${[-90, 0, 90, 180].map(half).join('')}' ${F(0.3)}/><g ${S(0.9, 1.4)}><path d='${[-90, 0, 90, 180].map(big).join('')}'/></g>`
      + `<circle cx='50' cy='50' r='3' ${F(0.9)}/><circle cx='50' cy='50' r='3' ${S(0.9, 1)}/><path d='M50 4 L47 10 H53Z' ${F(0.85)}/>`;
  },
  // Earth layers: crust, mantle, outer core, inner core with cutaway wedge
  () => `<circle cx='50' cy='50' r='38' ${F(0.08)}/><circle cx='50' cy='50' r='32' ${F(0.12)}/><circle cx='50' cy='50' r='17' ${F(0.28)}/><circle cx='50' cy='50' r='8' ${F(0.65)}/>`
    + `<g ${S(0.9, 1.7)}><circle cx='50' cy='50' r='38'/></g><g ${S(0.8, 1.3)}><circle cx='50' cy='50' r='32'/><circle cx='50' cy='50' r='17'/><circle cx='50' cy='50' r='8'/></g>`
    + `<path d='M50 50 L88 50 A38 38 0 0 0 50 12Z' ${S(0.9, 1.4)}/>`
    + `<g ${F(0.35)}><path d='M18 40 C22 30 30 28 34 30 C34 36 28 38 30 46 C26 50 20 48 18 40Z M16 62 C24 58 30 66 28 72 C22 72 18 68 16 62Z M40 76 C48 72 56 76 52 82 C46 84 42 82 40 76Z'/></g>`
    + `<g ${S(0.5, 0.8)}><path d='M56 44 L58 40 M62 42 L64 36 M70 44 L74 40 M78 42 L82 38 M60 22 A32 32 0 0 1 80 40 M66 24 A24 24 0 0 1 76 34 M58 30 L62 32 M66 28 L70 30'/><path d='M50 50 L66 34' opacity='.5'/></g>`
    + `<g ${S(0.5, 0.9)}><path d='M30 50 C34 56 40 58 42 62 M58 60 C62 66 60 72 56 76 M38 38 C42 42 46 44 44 48' opacity='.7'/><path d='M12 82 H20 M80 84 H88' opacity='.4'/></g>`,
];
