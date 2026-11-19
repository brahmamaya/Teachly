import type { Art } from './kit';
import { S, F, n1, poly, ngon } from './kit';

const rad = (a: number) => (a * Math.PI) / 180;
// A leaf/feather shape of length l drawn from (0,0) along +x (used under a rotate transform).
const blade = (l: number, w: number) => `M0 0 Q${n1(l * 0.5)} ${-w} ${l} 0 Q${n1(l * 0.5)} ${w} 0 0Z`;

export const ZOOLOGY: Art[] = [
  // 1. Butterfly with patterned symmetric wings
  () => {
    const wing = `<path d='M52 44 C60 22 82 8 92 14 C96 28 88 44 56 52Z' ${F(0.12)}/><path d='M52 54 C76 50 92 60 85 74 C78 88 62 84 54 62Z' ${F(0.12)}/><path d='M76 14 C92 16 94 26 90 34 C82 24 76 20 66 22Z' ${F(0.4)}/><path d='M70 62 C84 62 86 70 82 78 C76 74 70 72 62 70Z' ${F(0.4)}/><g ${S(0.9, 1.4)}><path d='M52 44 C60 22 82 8 92 14 C96 28 88 44 56 52 M52 54 C76 50 92 60 85 74 C78 88 62 84 54 62'/></g><g ${S(0.55, 0.8)}><path d='M54 46 L88 18 M55 48 L92 30 M55 50 L90 40 M55 56 L82 64 M54 58 L72 78 M54 60 L62 80'/><path d='M62 36 C70 28 78 28 86 30' /></g><g ${F(0.75)}><circle cx='80' cy='25' r='3'/><circle cx='86' cy='38' r='2.2'/><circle cx='76' cy='70' r='3'/><circle cx='70' cy='78' r='2'/></g><g ${F(0.5)}>${[0, 1, 2, 3, 4].map((i) => `<circle cx='${n1(86 - i * 1.2)}' cy='${n1(18 + i * 5)}' r='0.9'/>`).join('')}</g><circle cx='80' cy='25' r='1.2' fill='#fff' fill-opacity='0'/>`;
    return `<g>${wing}</g><g transform='translate(100 0) scale(-1 1)'>${wing}</g><ellipse cx='50' cy='42' rx='3.4' ry='7' ${F(0.5)}/><ellipse cx='50' cy='62' rx='2.6' ry='15' ${F(0.35)}/><g ${S(0.9, 1.3)}><ellipse cx='50' cy='42' rx='3.4' ry='7'/><ellipse cx='50' cy='62' rx='2.6' ry='15'/><circle cx='50' cy='32' r='3.2'/><path d='M49 29 C46 20 40 14 34 12 M51 29 C54 20 60 14 66 12'/><path d='M52 54 h-5 M52 60 h-5 M52 66 h-5' ${S(0.5, 0.7)}/></g><g ${F(0.8)}><circle cx='34' cy='12' r='1.8'/><circle cx='66' cy='12' r='1.8'/></g>`;
  },
  // 2. Fish with scales and fins
  () => {
    const body = 'M8 50 C20 30 50 26 74 42 L94 28 C90 40 90 60 94 72 L74 58 C50 74 20 70 8 50Z';
    let sc = '';
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) sc += `M${22 + c * 7 + (r % 2) * 3.5} ${32 + r * 3.8} a3.5 3.5 0 0 0 7 0 `;
    let rays = '';
    for (let i = 0; i < 6; i++) rays += `M${36 + i * 5.4} 33 L${40 + i * 4.6} ${27 - Math.sin(i / 1.9) * 4} `;
    return `<defs><clipPath id='fb'><path d='${body}'/></clipPath></defs><path d='M32 34 C40 18 58 18 66 38Z' ${F(0.2)}/><path d='M42 62 C44 74 54 82 62 80 C58 74 56 68 56 64Z' ${F(0.2)}/><path d='${body}' ${F(0.12)}/><path d='M8 50 C20 70 50 74 74 58 C54 62 24 58 8 50Z' ${F(0.2)}/><g clip-path='url(#fb)'><path d='M22 30 H100 V72 H22Z' ${F(0.05)}/><path d='${sc}' ${S(0.55, 0.8)}/><path d='M66 20 H100 V80 H66Z' ${F(0.12)}/></g><g ${S(0.9, 1.5)}><path d='${body}'/><path d='M32 34 C40 18 58 18 66 38 M42 62 C44 74 54 82 62 80 C58 74 56 68 56 64'/><path d='M28 38 C22 46 22 54 28 62'/><path d='M12 50 H70' ${S(0.4, 0.8)} stroke-dasharray='2 1.6'/></g><g ${S(0.5, 0.7)}><path d='${rays}M80 40 L90 36 M80 50 L92 50 M80 60 L90 64 M46 64 L52 76 M50 64 L58 78'/><path d='M30 42 C26 48 26 52 30 58 M33 41 C29 48 29 52 33 59' /></g><circle cx='19' cy='46' r='3.4' ${F(0.8)}/><circle cx='19' cy='46' r='3.4' ${S(0.9, 1)}/><path d='M8 52 q3 2 6 0' ${S(0.8, 1)}/>`;
  },
  // 3. Bird in flight with layered feathers
  () => {
    let w = '';
    for (let i = 0; i < 8; i++) w += `<g transform='translate(55 50) rotate(${-62 + i * 9})'><path d='${blade(n1(42 - Math.abs(i - 2) * 1.5), 3.6)}' ${F(0.12 + i * 0.015)}/><path d='${blade(n1(42 - Math.abs(i - 2) * 1.5), 3.6)}' ${S(0.85, 1)}/><path d='M6 0 H30' ${S(0.4, 0.6)}/></g>`;
    let cv = '';
    for (let i = 0; i < 6; i++) cv += `<g transform='translate(55 48) rotate(${-50 + i * 10})'><path d='${blade(20, 3)}' ${F(0.3)}/><path d='${blade(20, 3)}' ${S(0.8, 0.9)}/></g>`;
    let tl = '';
    for (let i = -2; i <= 2; i++) tl += `<g transform='translate(50 70) rotate(${90 + i * 11})'><path d='${blade(24 - Math.abs(i) * 2, 3)}' ${F(0.2)}/><path d='${blade(24 - Math.abs(i) * 2, 3)}' ${S(0.85, 1)}/></g>`;
    return `<g>${w}${cv}</g><g transform='translate(100 0) scale(-1 1)'>${w}${cv}</g>${tl}<path d='M45 38 C44 56 46 68 50 74 C54 68 56 56 55 38 C52 32 48 32 45 38Z' ${F(0.35)}/><g ${S(0.95, 1.5)}><path d='M45 38 C44 56 46 68 50 74 C54 68 56 56 55 38 C52 32 48 32 45 38Z'/><circle cx='50' cy='30' r='5' ${F(0.2)}/><path d='M48 26 L50 21 L52 26' /></g><path d='M48 44 C50 50 50 58 50 66' ${S(0.4, 0.7)}/><g ${F(0.9)}><circle cx='47.8' cy='29' r='1'/><circle cx='52.2' cy='29' r='1'/></g>`;
  },
  // 4. Frog life cycle ring
  () => {
    const arc = (a0: number, a1: number) => {
      const p = (a: number) => [n1(50 + 34 * Math.cos(rad(a))), n1(50 + 34 * Math.sin(rad(a)))];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      const t = rad(a1 + 90), hx = x1 - 0, hy = y1;
      const h = (d: number) => `${n1(hx - 5 * Math.cos(t + d))} ${n1(hy - 5 * Math.sin(t + d))}`;
      return `M${x0} ${y0} A34 34 0 0 1 ${x1} ${y1} M${h(0.45)} L${x1} ${y1} L${h(-0.45)}`;
    };
    let eggs = '';
    for (const [x, y] of [[44, 13], [51, 11], [57, 14], [47, 19], [54, 19], [41, 18], [60, 20]]) eggs += `<circle cx='${x}' cy='${y}' r='3.4' ${F(0.2)}/><circle cx='${x}' cy='${y}' r='3.4'/><circle cx='${x}' cy='${y}' r='1.2' ${F(0.8)}/>`;
    const frog = (x: number, y: number, k: number, tail: boolean) => `<g transform='translate(${x} ${y}) scale(${k})'><g ${F(0.3)}><ellipse cy='3' rx='7' ry='9'/><ellipse cy='-8' rx='6' ry='4.5'/></g><g ${S(0.95, 1.4 / k)}><ellipse cy='3' rx='7' ry='9'/><ellipse cy='-8' rx='6' ry='4.5'/><path d='M-6 -2 L-12 2 L-14 7 M6 -2 L12 2 L14 7 M-6 9 Q-16 8 -13 17 L-7 17 M6 9 Q16 8 13 17 L7 17'/>${tail ? "<path d='M0 12 q2 3 0 7'/>" : ''}</g><circle cx='-4' cy='-11.5' r='2' ${F(0.9)}/><circle cx='4' cy='-11.5' r='2' ${F(0.9)}/></g>`;
    return `<g ${S(0.9, 1.4)}><path d='${arc(-70, -25)}${arc(20, 65)}${arc(110, 155)}${arc(200, 245)}'/></g><g ${S(0.3, 0.8)}><ellipse cx='50' cy='50' rx='14' ry='6'/><ellipse cx='50' cy='50' rx='9' ry='3.6'/><ellipse cx='50' cy='50' rx='4' ry='1.6'/></g><g ${S(0.9, 1)}>${eggs}</g><g transform='translate(0 0)'><ellipse cx='77' cy='50' rx='7' ry='5' ${F(0.35)}/><g ${S(0.95, 1.3)}><ellipse cx='77' cy='50' rx='7' ry='5'/><path d='M83 50 q3 -4 6 0 t6 0 M84 48 l8 -4 M84 52 l8 4' ${S(0.9, 1.2)}/></g><circle cx='74' cy='48' r='1.1' ${F(0.9)}/></g>${frog(50, 84, 0.65, true)}${frog(19, 50, 0.8, false)}`;
  },
  // 5. Honeybee on honeycomb
  () => {
    let hx = '', fl = '';
    let k = 0;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) {
      const cx = 8 + c * 17.3 + (r % 2) * 8.65, cy = 10 + r * 15;
      const pts = poly(ngon(cx, cy, 10, 6, -90).map((p) => [n1(p[0]), n1(p[1])]), true);
      hx += pts;
      if ((k++ * 7) % 5 < 2) fl += pts;
    }
    return `<defs><mask id='hm'><rect width='100' height='100' fill='#fff'/><ellipse cx='50' cy='50' rx='33' ry='27' fill='#000'/></mask><clipPath id='hc'><circle cx='50' cy='50' r='45'/></clipPath></defs><circle cx='50' cy='50' r='45' ${S(0.8, 1.4)}/><g mask='url(#hm)' clip-path='url(#hc)'><path d='${fl}' ${F(0.28)}/><path d='${hx}' ${S(0.6, 1)}/></g><g transform='translate(50 50) scale(1.15) rotate(-22) translate(-50 -50)'><ellipse cx='42' cy='36' rx='14' ry='8' transform='rotate(-24 42 36)' ${F(0.12)}/><ellipse cx='60' cy='36' rx='14' ry='8' transform='rotate(24 60 36)' ${F(0.12)}/><g ${S(0.8, 1)}><ellipse cx='42' cy='36' rx='14' ry='8' transform='rotate(-24 42 36)'/><ellipse cx='60' cy='36' rx='14' ry='8' transform='rotate(24 60 36)'/><path d='M34 34 L48 38 M62 38 L68 34' ${S(0.4, 0.6)}/></g><ellipse cx='51' cy='58' rx='14' ry='17' ${F(0.22)}/><path d='M38 54 Q51 50 64 54 L65 62 Q51 58 37 62Z M40 68 Q51 64 62 68 L60 74 Q51 70 42 74Z' ${F(0.7)}/><g ${S(0.95, 1.5)}><ellipse cx='51' cy='58' rx='14' ry='17'/><path d='M38 48 Q51 44 64 48 M37 62 Q51 58 65 62 M42 74 Q51 70 60 74 M51 75 V82'/><circle cx='51' cy='38' r='6.5' ${F(0.35)}/><ellipse cx='51' cy='47' rx='9' ry='4'/><path d='M47 33 C44 26 40 24 37 25 M55 33 C58 26 62 24 65 25'/></g><g ${S(0.8, 1)}><path d='M42 50 L32 48 L28 54 M60 50 L70 48 L74 54 M41 62 L30 66 L28 74 M61 62 L72 66 L74 74'/></g><g ${F(0.9)}><circle cx='47.5' cy='37' r='1.4'/><circle cx='54.5' cy='37' r='1.4'/></g></g>`;
  },
  // 6. Snail with logarithmic spiral shell
  () => {
    let sp = '', rad2 = '';
    const cx = 58, cy = 42;
    for (let i = 0; i <= 90; i++) {
      const th = i * 0.17, r = 1.6 * Math.exp(0.19 * th);
      if (r > 29) break;
      sp += `${i ? 'L' : 'M'}${n1(cx + r * Math.cos(th))} ${n1(cy + r * Math.sin(th))}`;
    }
    for (let a = 0; a < 360; a += 30) rad2 += `M${n1(cx + 10 * Math.cos(rad(a)))} ${n1(cy + 10 * Math.sin(rad(a)))} L${n1(cx + 28 * Math.cos(rad(a)))} ${n1(cy + 28 * Math.sin(rad(a)))}`;
    const body = 'M8 84 C6 74 14 70 18 60 C18 54 14 48 10 44 M20 56 C28 64 46 70 70 70 C84 70 94 76 90 84 C86 90 40 90 8 84';
    return `<defs><clipPath id='sh'><circle cx='${cx}' cy='${cy}' r='29'/></clipPath></defs><path d='M8 84 C6 74 14 70 18 60 C20 52 24 56 30 64 C44 70 66 70 76 68 C90 72 96 80 90 86 C84 90 40 90 8 84Z' ${F(0.14)}/><path d='M14 86 C40 90 82 90 90 85 C86 88 50 90 14 86Z' ${F(0.3)}/><circle cx='${cx}' cy='${cy}' r='29' ${F(0.1)}/><g clip-path='url(#sh)'><path d='${rad2}' ${S(0.45, 0.8)}/><path d='M${cx} ${cy - 29} A29 29 0 0 1 ${cx + 29} ${cy} L${cx} ${cy}Z M${cx + 12} ${cy + 20} A24 24 0 0 0 ${cx + 28} ${cy + 6} L${cx + 12} ${cy + 20}Z' ${F(0.2)}/></g><g ${S(0.95, 1.5)}><circle cx='${cx}' cy='${cy}' r='29'/><path d='${sp}'/></g><g ${S(0.9, 1.4)}><path d='${body}'/><path d='M10 44 C6 36 6 32 8 28 M14 46 C14 38 18 34 22 32'/></g><circle cx='8' cy='27' r='2' ${F(0.8)}/><circle cx='22' cy='31' r='2' ${F(0.8)}/><g ${S(0.4, 0.8)}><path d='M14 62 q3 3 6 1 M20 68 q4 2 8 0 M32 72 q4 1 8 0'/><path d='M4 94 H96' stroke-dasharray='1 2.6'/></g>`;
  },
  // 7. Animal cell with organelles
  () => {
    const mito = (x: number, y: number, r: number) => `<g transform='translate(${x} ${y}) rotate(${r})'><ellipse rx='7' ry='3.6' ${F(0.2)}/><ellipse rx='7' ry='3.6' ${S(0.9, 1)}/><path d='M-4 -2.6 Q-3 0 -4 2.6 M-1 -3.4 Q0 0 -1 3.4 M2 -3.4 Q3 0 2 3.4 M5 -2.4 Q4 0 5 2.4' ${S(0.6, 0.7)}/></g>`;
    let er = '', dots = '';
    for (let i = 0; i < 4; i++) { er += `M${60 + i * 2.5} ${60 + i * 3} C${68 + i * 2} ${54 + i * 3} ${76 + i} ${68 + i * 2} ${82} ${58 + i * 3} `; }
    for (let i = 0; i < 12; i++) dots += `<circle cx='${n1(30 + ((i * 17) % 34))}' cy='${n1(70 + ((i * 11) % 14))}' r='0.9'/>`;
    return `<path d='M50 6 C78 4 94 26 92 52 C92 78 74 94 48 93 C22 94 6 76 8 50 C8 24 24 6 50 6Z' ${F(0.1)}/><g ${S(0.9, 1.6)}><path d='M50 6 C78 4 94 26 92 52 C92 78 74 94 48 93 C22 94 6 76 8 50 C8 24 24 6 50 6Z'/></g><path d='M50 10 C76 8 90 28 88 52 C88 76 72 90 48 89 C26 90 12 74 12 50 C12 28 26 10 50 10Z' ${S(0.35, 0.8)}/><circle cx='42' cy='40' r='15' ${F(0.28)}/><g ${S(0.95, 1.4)}><circle cx='42' cy='40' r='15'/><circle cx='40' cy='38' r='5' ${F(0.55)}/></g><g ${S(0.5, 0.8)}><circle cx='42' cy='40' r='12' stroke-dasharray='2 3.4'/></g><g ${S(0.9, 1)}><path d='${er}'/></g><g ${F(0.7)}>${dots}</g>${mito(72, 30, -30)}${mito(26, 66, 20)}${mito(76, 78, 40)}<g ${S(0.9, 1.1)}><path d='M64 40 Q72 42 76 46 M63 44 Q71 46 75 50 M62 48 Q70 50 74 54' ${S(0.9, 1.4)}/></g><g ${F(0.35)}><circle cx='22' cy='30' r='3'/><circle cx='28' cy='20' r='2'/><circle cx='20' cy='42' r='2.2'/></g><g ${S(0.9, 0.9)}><circle cx='22' cy='30' r='3'/><circle cx='28' cy='20' r='2'/><circle cx='20' cy='42' r='2.2'/></g><g ${S(0.9, 1.2)}><rect x='56' y='20' width='4' height='9' rx='1.5' transform='rotate(30 58 24)'/><rect x='61' y='19' width='4' height='9' rx='1.5' transform='rotate(-40 63 23)'/></g>`;
  },
  // 8. Elephant, simplified side view
  () => {
    const body = 'M34 26 C46 14 74 14 84 30 C92 42 92 62 88 74 L86 90 H76 L74 76 C66 78 56 78 50 76 L48 90 H38 L38 74 C34 70 32 62 30 56 C26 62 24 70 22 78 C21 84 18 90 13 90 C9 90 9 84 13 82 C16 76 14 66 14 56 C14 40 22 30 34 26Z';
    let w = '';
    for (let i = 0; i < 6; i++) w += `M${15 + (i % 2)} ${60 + i * 5} q4 2 8 0 `;
    return `<ellipse cx='52' cy='92' rx='40' ry='2.4' ${F(0.2)}/><path d='${body}' ${F(0.14)}/><path d='M60 20 C84 22 92 50 88 74 L86 90 H80 L82 74 C86 54 80 32 60 20Z M56 76 L58 82 L50 90 H48Z' ${F(0.22)}/><path d='M40 34 C58 28 62 54 46 62 C36 60 32 44 40 34Z' ${F(0.35)}/><g ${S(0.9, 1.6)}><path d='${body}'/><path d='M40 34 C58 28 62 54 46 62 C36 60 32 44 40 34Z'/><path d='M42 40 C52 38 54 50 46 56' ${S(0.5, 0.8)}/><path d='M88 38 C96 42 97 54 93 62' ${S(0.9, 1.2)}/></g><path d='M24 58 C16 66 17 74 23 78 C24 72 24 66 28 60Z' ${F(0.75)}/><g ${S(0.9, 1.2)}><path d='M24 58 C16 66 17 74 23 78'/></g><g ${S(0.5, 0.8)}><path d='${w}'/><path d='M82 48 q4 2 6 0 M78 56 q4 2 6 0 M64 70 q4 1 8 0'/><path d='M40 86 h6 M78 86 h6' /></g><circle cx='29' cy='40' r='2.2' ${F(0.9)}/><path d='M26 34 q3 -3 7 -2' ${S(0.8, 1)}/><path d='M93 62 q3 3 0 6' ${S(0.9, 2.2)}/>`;
  },
];
