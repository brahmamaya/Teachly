import type { Art } from './kit';
import { S, F } from './kit';

export const DRAWING: Art[] = [
  () => `<g transform='rotate(-35 50 50)'><rect x='38' y='10' width='24' height='62' rx='2' ${F(0.12)}/><g ${S()}><rect x='38' y='10' width='24' height='62' rx='2'/><path d='M38 72 L50 94 L62 72 M38 22 H62 M50 84 V94'/></g></g>`,
  () => `<g ${S()}><path d='M16 88 L58 46 M66 20 L84 12 L92 28 L74 36'/><path d='M58 46 C52 38 60 28 66 20 L74 36 C68 44 64 54 58 46 Z'/><path d='M16 88 C20 80 28 78 30 70'/></g>`,
  () => `<path d='M50 14 C80 14 92 36 84 56 C78 70 64 66 62 76 C60 90 40 90 26 76 C8 58 14 14 50 14 Z' ${F(0.1)}/><g ${S()}><path d='M50 14 C80 14 92 36 84 56 C78 70 64 66 62 76 C60 90 40 90 26 76 C8 58 14 14 50 14 Z'/><circle cx='34' cy='38' r='5'/><circle cx='52' cy='28' r='5'/><circle cx='72' cy='36' r='5'/><circle cx='40' cy='62' r='5'/><circle cx='56' cy='72' r='4' /></g>`,
  () => `<g ${S()}><path d='M18 90 L36 12 H64 L82 90 M50 12 V4 M26 56 L74 56 M42 90 V76 H58 V90'/><rect x='30' y='24' width='40' height='28' rx='2'/></g><path d='M30 24 H70 V52 H30 Z' ${F(0.1)}/>`,
  () => `<g ${S()}><path d='M14 82 V24 L74 82 Z'/><path d='M14 38 H22 M14 52 H24 M14 66 H22 M26 82 V74 M40 82 V72 M54 82 V74' opacity='0.7'/><path d='M34 70 V52 L50 70 Z' opacity='0.5'/></g>`,
  () => `<g ${S()}><path d='M50 14 L84 32 V68 L50 86 L16 68 V32 Z M16 32 L50 50 L84 32 M50 50 V86'/></g><path d='M16 32 L50 50 V86 L16 68 Z' ${F(0.08)}/><g ${S(0.45, 1)}><path d='M22 42 L28 46 M22 52 L28 56 M22 62 L28 66'/></g>`,
  () => `<g transform='rotate(-30 50 50)'><rect x='8' y='38' width='84' height='24' rx='3' ${F(0.1)}/><g ${S()}><rect x='8' y='38' width='84' height='24' rx='3'/><path d='M20 38 V48 M32 38 V52 M44 38 V48 M56 38 V52 M68 38 V48 M80 38 V52'/></g></g>`,
  () => `<g transform='rotate(-24 50 50)'><rect x='20' y='36' width='60' height='28' rx='5' ${F(0.1)}/><g ${S()}><rect x='20' y='36' width='60' height='28' rx='5'/><path d='M52 36 V64'/></g></g>`,
];
