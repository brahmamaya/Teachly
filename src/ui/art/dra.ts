import type { Art } from './kit';
import { S, F, n1, poly } from './kit';

// A tapered wooden limb segment (quad from joint a to joint b, half-widths w1/w2).
const limb = (x1: number, y1: number, x2: number, y2: number, w1: number, w2: number) => {
  const l = Math.hypot(x2 - x1, y2 - y1), px = (-(y2 - y1) / l), py = (x2 - x1) / l;
  return poly([[n1(x1 + px * w1), n1(y1 + py * w1)], [n1(x2 + px * w2), n1(y2 + py * w2)], [n1(x2 - px * w2), n1(y2 - py * w2)], [n1(x1 - px * w1), n1(y1 - py * w1)]], true);
};
// A flower head: petal circles around a centre (still-life bouquet).
const bloom = (cx: number, cy: number, r: number) => {
  let p = '';
  for (let a = 0; a < 360; a += 60) p += `<circle cx='${n1(cx + r * Math.cos((a * Math.PI) / 180))}' cy='${n1(cy + r * Math.sin((a * Math.PI) / 180))}' r='${n1(r * 0.8)}'/>`;
  return `<g ${F(0.14)}>${p}</g><g ${S(0.85, 1)}>${p}<circle cx='${cx}' cy='${cy}' r='${n1(r * 0.5)}' ${F(0.5)}/></g>`;
};

export const DRAWING: Art[] = [
  // 1. Artist's wooden mannequin
  () => {
    const parts = [
      limb(37, 31, 29, 48, 3, 2.6), limb(29, 49, 24, 66, 2.6, 2), limb(63, 31, 72, 46, 3, 2.6), limb(72, 47, 79, 64, 2.6, 2),
      limb(44, 68, 42, 80, 4, 3), limb(42, 81, 43, 90, 3, 2), limb(56, 68, 58, 80, 4, 3), limb(58, 81, 57, 90, 3, 2), limb(50, 22, 50, 29, 2.5, 3),
    ];
    const ball = [[37, 31, 3.4], [63, 31, 3.4], [29, 49, 2.8], [72, 47, 2.8], [50, 53, 3.2], [44, 68, 3.4], [56, 68, 3.4], [42, 81, 3.1], [58, 81, 3.1]];
    const torso = 'M38 29 Q50 24 62 29 Q65 44 57 50 L43 50 Q35 44 38 29Z';
    const pel = 'M41 57 Q50 61 59 57 L58 67 Q50 71 42 67Z';
    let hatch = '';
    for (let i = 0; i < 5; i++) hatch += `M${57 + i * 1.2} ${31 + i * 3} L${63 - i * 0.6} ${35 + i * 3} `;
    return `<ellipse cx='50' cy='94' rx='26' ry='2.2' ${F(0.18)}/><g ${F(0.12)}><path d='${parts.join('')}${torso}${pel}'/><ellipse cx='50' cy='13' rx='7' ry='9'/><ellipse cx='23' cy='71' rx='2.8' ry='4.2'/><ellipse cx='80' cy='69' rx='2.8' ry='4.2'/><ellipse cx='39' cy='92.5' rx='5.5' ry='2'/><ellipse cx='61' cy='92.5' rx='5.5' ry='2'/></g><path d='M50 4 C58 6 58 22 50 22 C54 18 54 8 50 4Z M59 33 Q63 42 58 49 L63 49 Q66 40 62 31Z M54 58 L58 66 L59 58Z' ${F(0.28)}/><g ${S(0.9, 1.3)}><path d='${parts.join('')}'/><path d='${torso}${pel}'/><ellipse cx='50' cy='13' rx='7' ry='9'/><ellipse cx='23' cy='71' rx='2.8' ry='4.2'/><ellipse cx='80' cy='69' rx='2.8' ry='4.2'/><ellipse cx='39' cy='92.5' rx='5.5' ry='2'/><ellipse cx='61' cy='92.5' rx='5.5' ry='2'/></g><g ${S(0.9, 1)}>${ball.map((b) => `<circle cx='${b[0]}' cy='${b[1]}' r='${b[2]}' fill='#fff' fill-opacity='0'/>`).join('')}</g><g ${S(0.4, 0.7)}><path d='M50 29 V50 M50 57 V69 M47 13 Q50 15 53 13 M50 4 V22 ${hatch}'/></g>`;
  },
  // 2. Pencil, ruler and set square
  () => {
    let t = '';
    for (let i = 0; i <= 20; i++) t += `M${10 + i * 4} 8 v${i % 5 ? 3 : 6}`;
    return `<rect x='8' y='8' width='84' height='15' rx='1.5' ${F(0.1)}/><path d='M8 8 H92 V12 H8Z' ${F(0.12)}/><g ${S(0.9, 1.3)}><rect x='8' y='8' width='84' height='15' rx='1.5'/></g><g ${S(0.7, 0.8)}><path d='${t}'/></g><path d='M8 92 L8 34 L66 92Z' ${F(0.1)}/><path d='M18 82 L18 52 L48 82Z' fill='#000' fill-opacity='0'/><g ${S(0.9, 1.4)}><path d='M8 92 L8 34 L66 92Z M18 82 V52 L48 82Z'/></g><g ${S(0.55, 0.8)}><path d='M8 44 h4 M8 54 h3 M8 64 h4 M8 74 h3 M8 84 h4 M20 92 v-4 M30 92 v-3 M40 92 v-4 M50 92 v-3'/><path d='M13 90 L62 90' stroke-dasharray='1 2.4'/></g><g transform='translate(40 82) rotate(-40)'><path d='M12 -4.5 H46 V4.5 H12Z' ${F(0.1)}/><path d='M12 0 H46 V4.5 H12Z' ${F(0.2)}/><path d='M46 -4.5 H52 V4.5 H46Z' ${F(0.35)}/><path d='M0 0 L12 -4.5 V4.5Z' ${F(0.1)}/><path d='M0 0 L3.6 -1.7 V1.7Z' ${F(0.9)}/><g ${S(0.9, 1.3)}><path d='M12 -4.5 H46 V4.5 H12Z M46 -4.5 H52 V4.5 H46Z M0 0 L12 -4.5 M0 0 L12 4.5 M52 -4.5 Q58 -4.5 58 0 Q58 4.5 52 4.5'/><path d='M12 0 H46' opacity='0.5'/><path d='M48 -4.5 V4.5 M50 -4.5 V4.5' opacity='0.6'/></g></g><path d='M10 94 H92' ${S(0.35, 0.8)}/>`;
  },
  // 3. Paint palette with brush
  () => {
    const pal = 'M44 14 C20 12 6 32 10 52 C14 74 36 86 56 80 C68 76 64 66 72 62 C84 58 94 50 90 36 C86 22 66 14 44 14Z';
    const dabs = [[24, 38, 5.5, 0.55], [36, 25, 5.5, 0.85], [53, 22, 5, 0.35], [70, 28, 5.5, 0.7], [81, 44, 5, 0.5]];
    return `<path d='${pal}' ${F(0.1)}/><path d='${pal}' transform='translate(1.2 1.6)' ${F(0.1)}/><g ${S(0.9, 1.5)}><path d='${pal}'/><ellipse cx='26' cy='66' rx='5.5' ry='3.6' transform='rotate(-30 26 66)'/></g><g ${S(0.4, 0.8)}><path d='M16 42 C14 58 22 72 38 76 M20 30 C28 18 42 16 50 16'/></g>${dabs.map((d) => `<ellipse cx='${d[0]}' cy='${d[1]}' rx='${d[2] + 1}' ry='${d[2]}' ${F(d[3])}/><ellipse cx='${d[0]}' cy='${d[1]}' rx='${d[2] + 1}' ry='${d[2]}' ${S(0.6, 0.9)}/>`).join('')}<path d='M42 52 q6 -6 12 0 q4 6 -2 9 q-8 2 -10 -9Z M58 58 q5 -3 8 1 q-1 5 -7 4Z' ${F(0.4)}/><g transform='translate(40 90) rotate(-45)'><path d='M0 0 C3 -2 6 -3.5 18 -4 V4 C6 3.5 3 2 0 0Z' ${F(0.55)}/><path d='M18 -4 H26 V4 H18Z' ${F(0.3)}/><path d='M26 -3 L72 -1.5 V1.5 L26 3Z' ${F(0.14)}/><g ${S(0.9, 1.3)}><path d='M0 0 C3 -2 6 -3.5 18 -4 V4 C6 3.5 3 2 0 0Z M18 -4 H26 V4 H18Z M26 -3 L72 -1.6 Q74 0 72 1.6 L26 3Z'/><path d='M20 -4 V4 M22 -4 V4 M24 -4 V4' ${S(0.5, 0.6)}/><path d='M26 0.8 L70 0.6' ${S(0.4, 0.7)}/></g></g>`;
  },
  // 4. Shaded sphere, cylinder and cube with cast shadows
  () => {
    const hs = (x: number, y0: number, y1: number, n: number, dx: number) => Array.from({ length: n }, (_, i) => `M${n1(x + i * dx)} ${y0} L${n1(x + i * dx - 5)} ${y1}`).join('');
    return `<defs><clipPath id='sp'><circle cx='32' cy='38' r='20'/></clipPath><clipPath id='cy'><path d='M60 24 V62 A12 5 0 0 0 84 62 V24Z'/></clipPath></defs><ellipse cx='50' cy='60' rx='24' ry='4' ${F(0.22)}/><path d='M72 66 L94 72 L88 77 L66 69Z' ${F(0.22)}/><path d='M52 84 L52 70 L90 80 L92 88 L60 92Z' ${F(0.2)}/><circle cx='32' cy='38' r='20' ${F(0.1)}/><g clip-path='url(#sp)'><circle cx='42' cy='46' r='22' ${F(0.2)}/><circle cx='47' cy='51' r='19' ${F(0.2)}/><path d='${hs(26, 30, 62, 9, 3.4)}' ${S(0.5, 0.7)}/></g><circle cx='25' cy='30' r='4' fill='none' stroke='#000' stroke-opacity='0.25' stroke-width='1.2'/><path d='M60 24 V62 A12 5 0 0 0 84 62 V24Z' ${F(0.1)}/><g clip-path='url(#cy)'><path d='M74 24 H84 V68 H74Z' ${F(0.25)}/><path d='${hs(77, 26, 66, 3, 2.8)}' ${S(0.5, 0.7)}/></g><ellipse cx='72' cy='24' rx='12' ry='5' ${F(0.06)}/><path d='M36 62 L52 70 L36 78 L20 70Z' ${F(0.05)}/><path d='M20 70 L36 78 V92 L20 84Z' ${F(0.14)}/><path d='M36 78 L52 70 V84 L36 92Z' ${F(0.32)}/><g ${S(0.9, 1.4)}><circle cx='32' cy='38' r='20'/><path d='M60 24 V62 A12 5 0 0 0 84 62 V24'/><ellipse cx='72' cy='24' rx='12' ry='5'/><path d='M36 62 L52 70 L36 78 L20 70Z M20 70 V84 L36 92 L52 84 V70 M36 78 V92'/></g><path d='M10 94 H92' ${S(0.3, 0.7)}/>`;
  },
  // 5. Two-point perspective cube with vanishing lines and horizon
  () => `<g ${S(0.4, 0.7)} stroke-dasharray='1.6 2.2'><path d='M4 56 L50 36 L96 56 M4 56 L50 80 M96 56 L50 80 M4 56 L30 45.6 M96 56 L70 45.6 M4 56 L30 70.3 M96 56 L70 70.3 M4 56 L30 66 M96 56 L70 66'/></g><path d='M3 56 H97' ${S(0.9, 1.3)}/><path d='M30 45.6 L50 40 V80 L30 70.3Z' ${F(0.14)}/><path d='M50 40 L70 45.6 V70.3 L50 80Z' ${F(0.34)}/><g ${S(0.9, 1.5)}><path d='M30 45.6 L50 40 L70 45.6 V70.3 L50 80 L30 70.3Z M50 40 V80'/></g><g ${S(0.45, 0.8)}><path d='M30 45.6 L50 51.2 L70 45.6 M50 51.2 V80' stroke-dasharray='2 2'/><path d='M54 42 V78 M58 43 V76 M62 44 V74 M66 45 V72' /></g><g ${S(0.9, 1)}><circle cx='4' cy='56' r='2' ${F(0.5)}/><circle cx='96' cy='56' r='2' ${F(0.5)}/></g><path d='M50 84 L86 78 L94 84 L58 92Z' ${F(0.15)}/>`,
  // 6. Easel with canvas and landscape
  () => {
    const cv = 'M24 16 H76 V66 H24Z';
    return `<g ${S(0.9, 1.8)}><path d='M50 5 V9 M47 5 H53 M30 74 L22 94 M70 74 L78 94 M50 74 V94' /></g><g ${S(0.9, 1.2)}><rect x='39' y='9' width='22' height='6' rx='1.5' ${F(0.3)}/><rect x='20' y='68' width='60' height='6' rx='1.5' ${F(0.28)}/><path d='M26 84 H74' ${S(0.8, 1.6)}/></g><path d='${cv}' ${F(0.08)}/><g ${S(0.9, 1.5)}><path d='${cv}'/></g><path d='M26 18 H74 V64 H26Z' ${S(0.35, 0.8)}/><path d='M26 52 L38 36 L46 46 L58 28 L74 50 V64 H26Z' ${F(0.35)}/><path d='M26 56 C38 50 52 62 74 54 V64 H26Z' ${F(0.2)}/><circle cx='62' cy='28' r='5' ${F(0.5)}/><g ${S(0.9, 1)}><path d='M26 52 L38 36 L46 46 L58 28 L74 50'/><path d='M26 56 C38 50 52 62 74 54'/><path d='M50 28 q3 -3 6 0 M30 26 q3 -3 7 0' ${S(0.6, 0.8)}/><path d='M58 28 l5 8 M64 38 l5 7' ${S(0.5, 0.7)}/></g><g ${S(0.4, 0.7)}><path d='M32 62 l5 -5 M38 62 l5 -5 M44 62 l5 -5 M50 62 l5 -5'/></g><path d='M32 86 h4 M64 86 h4 M14 94 H86' ${S(0.35, 0.8)}/>`;
  },
  // 7. Still life: vase with flowers and an apple
  () => {
    const vase = 'M42 46 C42 56 44 58 36 64 C26 72 28 84 38 88 H62 C72 84 74 72 64 64 C56 58 58 56 58 46';
    return `<g transform='translate(-10 0)'><ellipse cx='50' cy='90' rx='30' ry='3' ${F(0.2)}/><g ${S(0.9, 1.2)}><path d='M50 46 C48 34 36 30 32 22 M50 46 C50 36 52 24 50 15 M50 46 C54 36 64 32 68 24 M49 40 C40 38 38 34 36 38 M51 38 C60 38 62 34 64 38'/></g><path d='M40 40 C44 34 46 38 49 40 C46 42 42 44 40 40Z M52 38 C56 34 62 34 64 40 C58 42 54 42 52 38Z' ${F(0.35)}/>${bloom(32, 22, 4.2)}${bloom(50, 14, 4.2)}${bloom(68, 24, 4.2)}<path d='${vase}' ${F(0.1)}/><path d='M42 46 C42 56 44 58 36 64 C26 72 28 84 38 88 H62 C72 84 74 72 64 64 C56 58 58 56 58 46 Z' ${F(0.05)}/><path d='M58 46 C58 56 56 58 64 64 C74 72 72 84 62 88 H54 C66 82 64 70 54 62 C52 58 52 54 52 46Z' ${F(0.3)}/><g ${S(0.9, 1.5)}><path d='${vase}'/><ellipse cx='50' cy='46' rx='8' ry='2.5' ${F(0.2)}/></g><g ${S(0.7, 0.9)}><path d='M29 70 Q50 80 71 70 M30 76 Q50 86 70 76'/></g><g ${F(0.7)}>${[34, 41, 48, 55, 62].map((x) => `<circle cx='${x}' cy='${n1(76 + 2.6 - Math.abs(x - 48) * 0.05)}' r='1.2'/>`).join('')}</g></g><circle cx='76' cy='81' r='9' ${F(0.12)}/><path d='M80 74 A9 9 0 0 1 68 84 A12 12 0 0 0 82 88 Z' ${F(0.3)}/><g ${S(0.9, 1.3)}><path d='M76 73 C70 70 66 76 67 82 C68 90 74 92 76 90 C78 92 85 90 85 82 C86 76 82 70 76 73Z M76 73 C76 70 77 68 79 66 M79 67 C83 64 87 66 87 66 C84 70 80 70 79 67Z'/><path d='M71 77 q2 -2 4 -1' ${S(0.5, 0.8)}/></g>`;
  },
  // 8. Face construction: circle, centre lines, eyes, nose, mouth
  () => {
    const eye = (cx: number) => `<path d='M${cx - 9} 46 Q${cx} 38 ${cx + 9} 46 Q${cx} 52 ${cx - 9} 46Z' ${F(0.08)}/><circle cx='${cx}' cy='45.5' r='4.2' ${F(0.55)}/><circle cx='${cx - 1.4}' cy='44' r='1.1' fill='#fff' fill-opacity='0'/><g ${S(0.9, 1.3)}><path d='M${cx - 9} 46 Q${cx} 38 ${cx + 9} 46 Q${cx} 52 ${cx - 9} 46Z'/><circle cx='${cx}' cy='45.5' r='4.2'/><path d='M${cx - 10} 36 Q${cx} 30 ${cx + 10} 36'/><path d='M${cx - 7} 50 q7 3 14 0' ${S(0.4, 0.7)}/></g>`;
    return `<path d='M20 40 C20 6 80 6 80 40 C80 60 66 88 50 92 C34 88 20 60 20 40Z' ${F(0.07)}/><path d='M66 20 C74 30 80 44 80 56 C74 74 62 88 50 92 C62 78 70 52 66 20Z' ${F(0.14)}/><g ${S(0.9, 1.5)}><path d='M20 40 C20 6 80 6 80 40 C80 60 66 88 50 92 C34 88 20 60 20 40Z'/></g><g ${S(0.4, 0.8)}><circle cx='50' cy='40' r='30' stroke-dasharray='2 2.4'/><path d='M50 8 V94 M14 46 H86 M20 66 H80 M24 78 H76 M20 26 H80' stroke-dasharray='1.4 2.4'/></g>${eye(35)}${eye(65)}<g ${S(0.9, 1.2)}><path d='M50 48 C49 58 46 62 43 65 C46 68 54 68 57 65 C54 62 51 58 50 48' ${S(0.8, 1)}/><path d='M42 76 Q50 72 58 76 Q50 82 42 76Z' ${F(0.4)}/><path d='M42 76 Q50 77 58 76'/><path d='M44 86 Q50 88 56 86' ${S(0.5, 0.8)}/></g><g ${S(0.8, 1.2)}><path d='M20 44 C14 44 12 54 18 58 C20 56 20 50 20 44Z M80 44 C86 44 88 54 82 58 C80 56 80 50 80 44Z'/></g>`;
  },
];
