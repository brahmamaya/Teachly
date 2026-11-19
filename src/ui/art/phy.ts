import type { Art } from './kit';
import { S, F, sine } from './kit';

export const PHYSICS: Art[] = [
  () => `<g ${S()}><ellipse cx='50' cy='50' rx='40' ry='14'/><ellipse cx='50' cy='50' rx='40' ry='14' transform='rotate(60 50 50)'/><ellipse cx='50' cy='50' rx='40' ry='14' transform='rotate(120 50 50)'/></g><circle cx='50' cy='50' r='5' ${F(0.85)}/>`,
  () => `<g ${S(0.8, 1.3)} transform='rotate(-22 50 50)'><ellipse cx='50' cy='50' rx='44' ry='16'/><ellipse cx='50' cy='50' rx='32' ry='11'/><ellipse cx='50' cy='50' rx='20' ry='7'/></g><circle cx='50' cy='50' r='6' ${F(0.85)}/><circle cx='88' cy='40' r='3.2' ${F(0.85)}/>`,
  () => `<g ${S(0.85)}><path d='${sine(30, 8, 2)}'/></g><g ${S(0.6)}><path d='${sine(46, 8, 2, 0.6)}'/></g><g ${S(0.4)}><path d='${sine(62, 8, 2, 1.2)}'/></g><g ${S(0.25)}><path d='${sine(78, 8, 2, 1.8)}'/></g>`,
  () => `<path d='M28 16 V54 A22 22 0 0 0 72 54 V16 H60 V54 A10 10 0 0 1 40 54 V16 Z' ${F(0.12)}/><g ${S()}><path d='M28 16 V54 A22 22 0 0 0 72 54 V16 H60 V54 A10 10 0 0 1 40 54 V16 Z'/><path d='M28 30 H40 M60 30 H72'/></g><g ${S(0.5, 1.1)}><path d='M14 90 Q50 66 86 90' stroke-dasharray='3 4'/></g>`,
  () => `<path d='M50 22 L80 74 H20 Z' ${F(0.1)}/><g ${S()}><path d='M50 22 L80 74 H20 Z'/><path d='M4 62 L38 52'/><path d='M66 52 L98 38 M68 58 L98 52 M70 64 L98 66' opacity='0.75'/></g>`,
  () => `<path d='M50 18 C72 34 72 66 50 82 C28 66 28 34 50 18 Z' ${F(0.1)}/><g ${S()}><path d='M50 18 C72 34 72 66 50 82 C28 66 28 34 50 18 Z'/><path d='M50 12 V88 M6 50 H94' stroke-dasharray='2 4' opacity='0.5'/><path d='M8 30 L30 42 M8 50 L28 50 M8 70 L30 58'/><path d='M70 42 L92 30 M72 50 H92 M70 58 L92 70' opacity='0.7'/></g>`,
  () => `<g ${S()}><path d='M26 10 H74 M50 10 V60'/><circle cx='50' cy='72' r='11'/></g><g ${S(0.5, 1.2)}><path d='M22 66 Q50 98 78 66' stroke-dasharray='3 4'/></g><circle cx='50' cy='72' r='11' ${F(0.16)}/>`,
  () => `<g ${S()}><path d='M20 70 V30 H36 L40 20 L48 40 L56 20 L64 40 L68 30 H80 V70 H56 M44 70 H20'/><path d='M44 60 V80 M56 64 V76'/></g>`,
];
