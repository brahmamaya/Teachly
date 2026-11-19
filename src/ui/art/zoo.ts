import type { Art } from './kit';
import { S, F } from './kit';

export const ZOOLOGY: Art[] = [
  () => `<g ${S()}><path d='M50 28 V74 M50 28 C40 12 22 12 14 24 C8 36 24 48 50 46 C28 50 14 62 22 76 C32 90 46 78 50 66 C54 78 68 90 78 76 C86 62 72 50 50 46 C76 48 92 36 86 24 C78 12 60 12 50 28 Z M50 28 L44 14 M50 28 L56 14'/><circle cx='28' cy='30' r='6' opacity='0.5'/><circle cx='72' cy='30' r='6' opacity='0.5'/></g>`,
  () => `<path d='M16 50 C34 22 68 22 78 50 C68 78 34 78 16 50 Z' ${F(0.1)}/><g ${S()}><path d='M16 50 C34 22 68 22 78 50 C68 78 34 78 16 50 Z M78 50 L94 34 V66 Z'/><circle cx='34' cy='44' r='3.6'/><path d='M50 30 C56 42 56 58 50 70 M60 30 C66 42 66 58 60 70' opacity='0.5'/></g>`,
  () => `<g ${S()}><path d='M16 52 C16 34 34 24 52 28 C60 18 72 20 72 28 L88 34 L72 38 C72 60 58 78 38 76 C24 74 16 64 16 52 Z M34 46 C42 44 52 50 54 62'/><circle cx='64' cy='28' r='2.4'/><path d='M36 76 V88 M46 76 V88 M30 88 H52'/></g>`,
  () => `<g ${S()}><ellipse cx='50' cy='64' rx='20' ry='16'/><ellipse cx='22' cy='46' rx='7' ry='10' transform='rotate(-20 22 46)'/><ellipse cx='40' cy='28' rx='7' ry='10' transform='rotate(-6 40 28)'/><ellipse cx='60' cy='28' rx='7' ry='10' transform='rotate(6 60 28)'/><ellipse cx='78' cy='46' rx='7' ry='10' transform='rotate(20 78 46)'/></g>`,
  () => `<g ${S()}><path d='M50 50 m0 0 C50 44 56 42 60 46 C66 52 60 62 50 62 C38 62 32 50 38 40 C46 28 66 30 72 44 C78 60 66 78 48 78 C28 78 14 62 18 44 C22 24 44 14 64 20'/><path d='M14 80 H86' opacity='0.5'/></g>`,
  () => `<g ${S()}><path d='M22 90 C26 60 44 28 78 10 C80 40 66 74 30 86 M22 90 C34 66 52 40 78 10'/><path d='M34 70 L22 68 M42 58 L28 52 M52 46 L40 38 M60 36 L52 26 M40 70 L50 78 M50 58 L62 66 M60 46 L72 52' opacity='0.6'/></g>`,
  () => `<g ${S()}><ellipse cx='50' cy='58' rx='18' ry='22'/><path d='M32 54 H68 M33 66 H67'/><ellipse cx='30' cy='30' rx='14' ry='9' transform='rotate(-30 30 30)'/><ellipse cx='70' cy='30' rx='14' ry='9' transform='rotate(30 70 30)'/><path d='M44 38 Q40 24 32 18 M56 38 Q60 24 68 18'/></g>`,
  () => `<g ${S()}><circle cx='50' cy='54' r='30'/><path d='M24 40 L22 14 L42 28 M76 40 L78 14 L58 28'/><circle cx='39' cy='50' r='3.4'/><circle cx='61' cy='50' r='3.4'/><path d='M47 62 L50 65 L53 62 M50 65 V70 M40 70 Q50 76 60 70 M8 56 L30 60 M8 68 L30 64 M92 56 L70 60 M92 68 L70 64' opacity='0.85'/></g>`,
];
