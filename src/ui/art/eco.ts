import type { Art } from './kit';
import { S, F } from './kit';

export const ECONOMICS: Art[] = [
  () => `<g ${S()}><path d='M10 86 H92 M10 86 V12'/><rect x='20' y='56' width='12' height='30'/><rect x='40' y='42' width='12' height='44'/><rect x='60' y='62' width='12' height='24'/><path d='M18 40 L40 26 L58 36 L86 14 M76 14 H86 V24'/></g>`,
  () => `<g ${S()}><ellipse cx='50' cy='74' rx='28' ry='9'/><path d='M22 74 V64 M78 74 V64'/><ellipse cx='50' cy='64' rx='28' ry='9'/><path d='M22 64 V54 M78 64 V54'/><ellipse cx='50' cy='54' rx='28' ry='9'/><path d='M22 54 V44 M78 54 V44'/><ellipse cx='50' cy='44' rx='28' ry='9'/></g>`,
  () => `<circle cx='50' cy='50' r='36' ${F(0.07)}/><g ${S()}><circle cx='50' cy='50' r='36'/><path d='M50 50 V14 M50 50 L82 66 M50 50 L22 74'/></g><path d='M50 50 L50 14 A36 36 0 0 1 82 66 Z' ${F(0.16)}/>`,
  () => `<g ${S()}><path d='M6 18 H20 L30 60 H78 L88 28 H24'/><circle cx='38' cy='76' r='6'/><circle cx='70' cy='76' r='6'/><path d='M34 40 H82 M36 50 H80' opacity='0.5'/></g>`,
  () => `<g ${S()}><path d='M50 10 L92 30 H8 Z M16 38 H84 M22 38 V72 M38 38 V72 M62 38 V72 M78 38 V72 M12 72 H88 M6 84 H94 M10 78 H90'/></g><path d='M50 10 L92 30 H8 Z' ${F(0.1)}/>`,
  () => `<g ${S(0.9, 2)}><path d='M10 80 L32 56 L46 66 L88 18'/><path d='M66 16 H90 V40'/></g><g ${S(0.4, 1)}><path d='M10 90 H92 M10 90 V10'/></g>`,
  () => `<g ${S()}><circle cx='30' cy='30' r='11'/><circle cx='70' cy='70' r='11'/><path d='M76 18 L24 82'/></g>`,
  () => `<g ${S()}><path d='M12 30 H78 V80 H12 Z M78 44 H92 V66 H78 M12 30 L60 16 L68 30'/><circle cx='80' cy='55' r='3'/></g>`,
];
