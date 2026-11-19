import type { Art } from './kit';
import { S, F } from './kit';

export const COMPUTER: Art[] = [
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
  () => `<g ${S()}><rect x='12' y='18' width='76' height='50' rx='4'/><path d='M40 82 H60 M50 68 V82'/><path d='M22 30 H46 M22 40 H38' opacity='0.6'/></g>`,
  () => `<g ${S()}><rect x='30' y='12' width='40' height='72' rx='20'/><path d='M30 42 H70 M50 12 V42'/><path d='M50 22 V32' opacity='0.7'/></g>`,
];
