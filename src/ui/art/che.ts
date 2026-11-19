import type { Art } from './kit';
import { S, F, poly, ngon } from './kit';

export const CHEMISTRY: Art[] = [
  () => `<path d='M30 62 H70 L77 79 Q78 83 74 83 H26 Q22 83 23 79 Z' ${F(0.16)}/><g ${S()}><path d='M41 14 H59 M44 14 V38 L22 80 Q19 87 27 87 H73 Q81 87 78 80 L56 38 V14 M30 62 H70'/><circle cx='46' cy='72' r='2.6'/><circle cx='56' cy='68' r='1.8'/></g>`,
  () => `<g ${S()}><path d='M50 22 L72.5 35 V61 L50 74 L27.5 61 V35 Z'/><path d='M72.5 35 L88 26 M27.5 61 L12 70 M50 22 V10'/></g><g ${S()}><circle cx='90' cy='24' r='5'/><circle cx='10' cy='72' r='5'/><circle cx='50' cy='7' r='5'/></g><circle cx='50' cy='48' r='15' ${S(0.4, 1.2)}/>`,
  () => `<path d='M24 40 H76 V82 Q76 88 70 88 H30 Q24 88 24 82 Z' ${F(0.12)}/><g ${S()}><path d='M20 16 H80 M22 16 V82 Q22 90 30 90 H70 Q78 90 78 82 V16'/><path d='M24 40 H76'/><path d='M22 32 H32 M22 48 H32 M22 64 H32 M22 80 H32'/><circle cx='42' cy='64' r='3'/><circle cx='58' cy='56' r='2'/><circle cx='52' cy='74' r='2.4'/></g>`,
  () => `<g ${S()}><path d='M22 14 V76 Q22 88 30 88 Q38 88 38 76 V14 M18 14 H42'/><path d='M44 14 V76 Q44 88 52 88 Q60 88 60 76 V14 M40 14 H64'/><path d='M66 14 V76 Q66 88 74 88 Q82 88 82 76 V14 M62 14 H86'/><path d='M22 52 H38 M44 44 H60 M66 58 H82' opacity='0.6'/></g><path d='M22 52 H38 V76 Q38 88 30 88 Q22 88 22 76 Z' ${F(0.16)}/><path d='M66 58 H82 V76 Q82 88 74 88 Q66 88 66 76 Z' ${F(0.16)}/>`,
  () => `<g ${S()}><path d='${poly(ngon(50, 50, 32, 6), true)}'/><path d='${poly(ngon(50, 50, 20, 6), true)}' opacity='0.5'/></g><g ${S(0.6, 1.2)}><path d='M50 18 V8 M77.7 34 L86 29 M77.7 66 L86 71 M50 82 V92 M22.3 66 L14 71 M22.3 34 L14 29'/></g>`,
  () => `<g ${S()}><path d='M38 88 H62 M50 88 V58 M42 58 H58 L56 44 H44 Z'/><path d='M44 44 V34 M56 44 V34'/></g><path d='M50 8 C60 20 64 28 58 34 C54 38 46 38 42 34 C36 28 42 20 50 8 Z' ${F(0.2)}/><path d='M50 8 C60 20 64 28 58 34 C54 38 46 38 42 34 C36 28 42 20 50 8 Z' ${S(0.8, 1.3)}/>`,
  () => `<rect x='24' y='14' width='52' height='72' rx='6' ${F(0.1)}/><g ${S()}><rect x='24' y='14' width='52' height='72' rx='6'/><path d='M33 28 H44 M60 28 H67 M34 76 H66'/><circle cx='50' cy='52' r='14'/></g>`,
  () => `<g ${S()}><path d='${poly(ngon(34, 50, 19, 6, -90), true)}'/><path d='${poly(ngon(67, 50, 19, 6, -90), true)}'/></g><g ${S(0.5, 1.2)}><path d='${poly(ngon(34, 50, 11, 6, -90), true)}'/></g>`,
];
