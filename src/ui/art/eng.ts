import type { Art } from './kit';
import { S, F, poly, ngon, n1 } from './kit';

// Text lines drawn as soft bars (stand-in for writing): n lines of width w from (x,y), step dy.
const bars = (x: number, y: number, w: number, n: number, dy: number, o = 0.5, sw = 1.1) =>
  `<path ${S(o, sw)} d='${Array.from({ length: n }, (_, i) => `M${x} ${n1(y + i * dy)}h${i % 4 === 3 ? w * 0.6 : w}`).join('')}'/>`;

// Quill: feather barbs computed along the shaft.
const feather = () => {
  const L: number[][] = [], R: number[][] = [];
  let b = '';
  for (let i = 0; i <= 13; i++) {
    const t = 0.02 + (i / 13) * 0.8, px = 86 - 40 * t, py = 8 + 54 * t, w = 3 + 9 * Math.sin((Math.PI * (t - 0.02)) / 0.84);
    const l = [n1(px - 0.8 * w + 1.8), n1(py - 0.6 * w - 2.4)], r = [n1(px + 0.8 * w + 1.8), n1(py + 0.6 * w - 2.4)];
    L.push(l); R.push(r);
    b += `M${n1(px)} ${n1(py)}L${l[0]} ${l[1]}M${n1(px)} ${n1(py)}L${r[0]} ${r[1]}`;
  }
  return `<path ${F(0.16)} d='${poly([[86, 8], ...L, ...R.reverse()], true)}'/><path ${S(0.5, 0.8)} d='${b}'/><path ${S(0.9, 1.6)} d='M86 8L47 62'/>`;
};

// Bookshelf row: spines of given widths/heights standing on shelf line y.
const row = (y: number, hs: number[], ws: number[], lean = -1) => {
  let x = 15, s = '';
  hs.forEach((h, i) => {
    const w = ws[i], tr = i === lean ? ` transform='rotate(14 ${x + w} ${y})'` : '';
    s += `<g${tr}><rect x='${x}' y='${y - h}' width='${w}' height='${h}' rx='1' ${F([0.12, 0.3, 0.5][i % 3])}/><rect x='${x}' y='${y - h}' width='${w}' height='${h}' rx='1' ${S(0.85, 1.1)}/><path ${S(0.6, 0.8)} d='M${x} ${y - h + 4}h${w}M${x} ${y - 5}h${w}'/><path ${S(0.7, 1)} d='M${n1(x + w / 2)} ${y - h + 9}v${n1(h * 0.35)}'/></g>`;
    x += w + (i === lean - 1 ? 7 : 1.2);
  });
  return s;
};

const stackBook = (x: number, y: number, w: number, o: number) =>
  `<rect x='${x}' y='${y}' width='${w}' height='15' rx='2' ${F(o)}/><rect x='${x}' y='${y}' width='${w}' height='15' rx='2' ${S(0.9, 1.4)}/><path ${S(0.55, 0.8)} d='M${x + w - 8} ${y + 2}v11M${x + w - 8} ${y + 5}h8M${x + w - 8} ${y + 8}h8M${x + w - 8} ${y + 11}h8M${x + 5} ${y}v15M${x + 8} ${y}v15'/><rect x='${x + 12}' y='${y + 5}' width='14' height='5' rx='1' ${F(0.5)}/>`;

export const ENGLISH: Art[] = [
  // Open book with curved pages, picture, text lines and ribbon
  () => {
    let t = '';
    for (let i = 0; i < 6; i++) {
      const y = 41 + i * 6;
      t += `M14 ${y}Q28 ${y - 3} 44 ${y + 3}`;
    }
    for (let i = 0; i < 3; i++) t += `M57 ${57 + i * 6}Q71 ${51 + i * 6} 86 ${54 + i * 6}`;
    return `<path d='M50 33C38 24 22 24 8 29V75C22 70 38 71 50 80C62 71 78 70 92 75V29C78 24 62 24 50 33Z' ${F(0.1)}/><path ${S(0.4, 1)} d='M4 30V80C20 75 38 76 50 87C62 76 80 75 96 80V30'/><path ${S(0.5, 1)} d='M8 79C22 74 38 75 50 84C62 75 78 74 92 79M8 82C22 77 38 78 50 87C62 78 78 77 92 82'/><g ${S(0.9, 1.7)}><path d='M50 33C38 24 22 24 8 29V75C22 70 38 71 50 80C62 71 78 70 92 75V29C78 24 62 24 50 33ZM50 33V80'/></g><path ${S(0.9, 2.2)} d='M14 35Q22 33 30 35'/><path ${S(0.5, 1)} d='${t}'/><path ${F(0.3)} d='M58 36Q71 31 86 34V50Q71 47 58 52Z'/><path ${S(0.7, 1)} d='M58 36Q71 31 86 34V50Q71 47 58 52ZM60 50L68 42L73 47L77 43L85 49'/><circle cx='78' cy='39' r='2' ${F(0.7)}/><path ${F(0.7)} d='M54 80V93L57 90L60 93V82Z'/>`;
  },
  // Quill and inkwell
  () =>
    `${feather()}<path ${S(0.9, 1.4)} d='M47 62L45 66'/><ellipse cx='49' cy='60' rx='11' ry='3' ${F(0.15)}/><path ${S(0.9, 1.5)} d='M38 60V66M60 60V66M38 60A11 3 0 0 0 60 60'/><path d='M26 74C26 68 30 66 36 66H62C68 66 72 68 72 74V82C72 88 68 91 62 91H36C30 91 26 88 26 82Z' ${F(0.22)}/><path ${S(0.9, 1.6)} d='M26 74C26 68 30 66 36 66H62C68 66 72 68 72 74V82C72 88 68 91 62 91H36C30 91 26 88 26 82Z'/><path ${S(0.5, 1)} d='M26 79H72M31 71V76M31 83V87'/><path d='M62 80V90C68 90 72 87 72 82V80Z' ${F(0.25)}/><circle cx='81' cy='88' r='2' ${F(0.7)}/><circle cx='86' cy='83' r='1.2' ${F(0.6)}/><circle cx='12' cy='20' r='1' ${F(0.5)}/><path ${S(0.4, 0.8)} d='M10 12v6M7 15h6M20 90h-8'/>`,
  // Speech bubbles with quotation marks
  () => {
    const q = (x: number, y: number) => `<circle cx='${x}' cy='${y}' r='3.6' ${F(0.85)}/><path ${S(0.85, 2.2)} d='M${x - 3.4} ${y + 0.5}Q${x - 3.4} ${y + 7} ${x - 8} ${y + 9.5}'/>`;
    return `<path d='M12 12H64Q72 12 72 20V42Q72 50 64 50H36L22 64V50H20Q12 50 12 42V20Q12 12 20 12Z' ${F(0.12)}/><path ${S(0.9, 1.7)} d='M12 12H64Q72 12 72 20V42Q72 50 64 50H36L22 64V50H20Q12 50 12 42V20Q12 12 20 12Z'/>${q(36, 24)}${q(52, 24)}<path ${S(0.45, 1.1)} d='M24 43h24M52 43h10'/><path d='M44 58H82Q90 58 90 66V78Q90 86 82 86H80V95L68 86H52Q44 86 44 78V66Q44 58 52 58Z' ${F(0.3)}/><path ${S(0.9, 1.7)} d='M44 58H82Q90 58 90 66V78Q90 86 82 86H80V95L68 86H52Q44 86 44 78V66Q44 58 52 58Z'/><circle cx='55' cy='72' r='2.3' ${F(0.8)}/><circle cx='67' cy='72' r='2.3' ${F(0.8)}/><circle cx='79' cy='72' r='2.3' ${F(0.8)}/><circle cx='84' cy='26' r='8' ${F(0.14)}/><circle cx='84' cy='26' r='8' ${S(0.7, 1.3)}/><path ${S(0.7, 1.1)} d='M79 24h10M79 29h6M78 33L74 38'/>`;
  },
  // Typewriter with paper
  () => {
    let k = '';
    for (let i = 0; i < 7; i++) k += `<circle cx='${22 + i * 9.3}' cy='57' r='2.8' ${S(0.8, 1.1)}/>`;
    for (let i = 0; i < 6; i++) k += `<circle cx='${26.6 + i * 9.3}' cy='66' r='2.8' ${S(0.8, 1.1)}/>`;
    return `<path d='M30 8H70V34H30Z' ${F(0.1)}/><path ${S(0.8, 1.4)} d='M30 34V8H70V34'/>${bars(36, 14, 28, 4, 5, 0.55, 1.2)}<path ${S(0.7, 1.3)} d='M26 28Q50 38 74 28'/><rect x='20' y='32' width='60' height='9' rx='4.5' ${F(0.3)}/><rect x='20' y='32' width='60' height='9' rx='4.5' ${S(0.9, 1.5)}/><circle cx='14' cy='36.5' r='4' ${F(0.4)}/><circle cx='86' cy='36.5' r='4' ${F(0.4)}/><path d='M16 46H84L92 74V86H8V74Z' ${F(0.15)}/><path ${S(0.9, 1.7)} d='M16 46H84L92 74V86H8V74ZM8 74H92'/>${k}<rect x='30' y='76' width='40' height='5' rx='2.5' ${F(0.5)}/><path ${S(0.4, 0.9)} d='M20 49H80'/>`;
  },
  // Pencil on ruled notebook
  () => {
    let r = '', h = '';
    for (let i = 0; i < 8; i++) r += `M26 ${24 + i * 8}H72`;
    for (let i = 0; i < 6; i++) h += `<circle cx='14' cy='${18 + i * 13}' r='2.2' ${S(0.8, 1)}/>`;
    return `<rect x='14' y='8' width='62' height='84' rx='4' ${F(0.12)}/><rect x='14' y='8' width='62' height='84' rx='4' ${S(0.85, 1.6)}/>${h}<path ${S(0.35, 0.9)} d='${r}'/><path ${S(0.55, 1)} d='M24 8V92'/><path ${S(0.9, 1.5)} d='M30 18Q36 12 40 18T50 18T60 18'/><g transform='translate(40 82) rotate(-45)'><path d='M-13 0L0 -4V4Z' ${F(0.2)}/><path d='M-13 0L-8 -1.6V1.6Z' ${F(0.9)}/><rect x='0' y='-4' width='44' height='8' ${F(0.28)}/><rect x='0' y='0' width='44' height='4' ${F(0.2)}/><path ${S(0.9, 1.5)} d='M-13 0L0 -4H44V4H0ZM0 -4V4M44 -4V4M44 -4h5v8h-5M49 -4h6Q58 0 55 4h-6'/><path ${S(0.5, 0.8)} d='M3 0H44M20 -4V4M24 -4V4'/><path ${S(0.9, 1)} d='M44 -4L49 -4M44 4h5'/></g><path ${S(0.7, 1.2)} d='M20 90Q26 86 32 90T44 90'/>`;
  },
  // Bookshelf full of spines
  () =>
    `<path ${S(0.9, 1.7)} d='M10 8H90V92H10ZM10 8V92'/><path ${S(0.9, 1.7)} d='M90 8V92'/><rect x='10' y='46' width='80' height='3.5' ${F(0.5)}/><rect x='10' y='86' width='80' height='3.5' ${F(0.5)}/><path ${S(0.4, 0.8)} d='M10 8H90'/>${row(46, [28, 21, 31, 24, 27, 22, 30], [9, 11, 8, 10, 9, 11, 8])}<g transform='translate(0 0)'>${row(86, [26, 33, 22, 29, 24, 28], [11, 8, 10, 9, 11, 8], 5)}</g>`,
  // Stack of books with a cup
  () =>
    `${stackBook(8, 72, 84, 0.45)}${stackBook(14, 56, 70, 0.22)}${stackBook(10, 40, 62, 0.35)}<path ${F(0.15)} d='M52 24H72L70 38H54Z'/><path ${S(0.9, 1.6)} d='M52 24H72L70 36Q70 38 67 38H57Q54 38 54 36ZM72 27H76Q80 27 80 31Q80 35 75 35H71M48 38H76'/><path ${S(0.6, 1.1)} d='M54 28H70'/><path ${S(0.5, 1.1)} d='M58 20Q55 16 58 12Q61 8 58 4M66 20Q63 16 66 12Q69 8 66 4'/><path ${S(0.6, 1)} d='M30 88v7l2.5-2 2.5 2v-7'/>`,
  // Serif letter A in a letterpress medallion
  () => {
    const dots = ngon(50, 50, 42, 32).map((p) => `<circle cx='${p[0]}' cy='${p[1]}' r='0.9' ${F(0.7)}/>`).join('');
    return `<circle cx='50' cy='50' r='45' ${S(0.9, 1.4)}/><circle cx='50' cy='50' r='39' ${S(0.5, 0.8)}/>${dots}<circle cx='50' cy='50' r='34' ${F(0.1)}/><path fill-rule='evenodd' fill='#000' fill-opacity='0.85' d='M46 20H54L72 70H78V74H60V70H65L60 58H40L35 70H40V74H22V70H28ZM50 29L43 52H57Z'/><path ${S(0.7, 1)} d='M32 77H68'/><path ${S(0.5, 0.9)} d='M30 82Q50 90 70 82'/>`;
  },
];
