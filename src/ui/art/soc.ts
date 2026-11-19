import type { Art } from './kit';
import { S, F } from './kit';

export const SOCIAL: Art[] = [
  () => `<g ${S()}><path d='M50 18 V80 M22 28 H78 M14 28 L22 28 L8 54 H36 Z M78 28 L64 54 H92 Z M32 86 H68 M14 54 A14 8 0 0 0 36 54 M64 54 A14 8 0 0 0 86 54'/><circle cx='50' cy='16' r='3'/></g>`,
  () => `<g ${S()}><path d='M26 46 A24 24 0 0 1 74 46 M50 12 V22 M18 46 H82 M24 46 V74 M40 46 V74 M60 46 V74 M76 46 V74 M14 74 H86 M8 86 H92 M12 80 H88'/></g><path d='M26 46 A24 24 0 0 1 74 46 Z' ${F(0.1)}/>`,
  () => `<g ${S()}><circle cx='50' cy='32' r='10'/><circle cx='24' cy='42' r='8'/><circle cx='76' cy='42' r='8'/><path d='M32 82 A18 18 0 0 1 68 82 Z M8 82 A16 16 0 0 1 36 66 M64 66 A16 16 0 0 1 92 82'/></g>`,
  () => `<g ${S()}><path d='M26 10 V92'/><path d='M26 14 H80 L68 30 L80 46 H26'/></g><path d='M26 14 H80 L68 30 L80 46 H26 Z' ${F(0.14)}/>`,
  () => `<path d='M20 52 H80 V86 H20 Z' ${F(0.1)}/><g ${S()}><path d='M20 52 H80 V86 H20 Z M32 52 H68 M38 52 V47 H62 V52'/><path d='M38 26 L50 14 L62 26 V42 H38 Z M44 26 H56'/></g>`,
  () => `<g ${S()}><path d='M8 88 H92 M14 88 V46 H30 V88 M30 88 V28 H48 V88 M48 88 V56 H62 V88 M62 88 V36 H80 V88 M80 88 V62 H92 V88'/><path d='M36 38 H42 M36 50 H42 M68 46 H74 M68 58 H74' opacity='0.6'/></g>`,
  () => `<g ${S()}><circle cx='50' cy='50' r='38'/><path d='M34 32 H66 M34 46 H66 M42 32 C66 32 66 56 42 56 L64 76'/></g>`,
  () => `<g ${S()}><path d='M22 14 H72 V80 H22 Z M22 80 V86 H72 M30 28 H64 M30 40 H64 M30 52 H52'/><path d='M60 66 L66 74 L76 62' opacity='0.8'/></g>`,
];
