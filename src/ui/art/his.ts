import type { Art } from './kit';
import { S, F, n1, sine } from './kit';

const r = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const HISTORY: Art[] = [
  // Greek temple: pediment, fluted columns, stepped base
  () => {
    const cols = [20, 31, 42, 53, 64, 75];
    return `<path d='M12 36 L50 14 L88 36 Z' ${F(0.12)}/><path d='M50 14 L88 36 H50 Z' ${F(0.1)}/><rect x='14' y='36' width='72' height='6' ${F(0.2)}/>`
      + `<path d='M20 70 H80 V82 H20Z' ${F(0.08)}/>`
      + cols.map((x) => `<rect x='${x - 3}' y='42' width='6' height='38' ${F(0.1)}/>`).join('')
      + `<g ${S(0.9, 1.6)}><path d='M10 36 L50 13 L90 36 Z M13 36 H87 M13 42 H87'/>`
      + cols.map((x) => `<path d='M${x - 3} 42 V80 M${x + 3} 42 V80'/>`).join('') + `</g>`
      + `<g ${S(0.45, 0.9)}>` + cols.map((x) => `<path d='M${x} 44 V78'/>`).join('') + `<path d='M50 22 L72 34 M50 28 L64 35 M50 22 L28 34'/></g>`
      + `<circle cx='50' cy='28' r='3.5' ${S(0.8, 1.2)}/>`
      + `<g ${S(0.9, 1.6)}><path d='M16 80 H84 V85 H16 Z M11 85 H89 V91 H11 Z'/></g><path d='M16 80 H84 V85 H16 Z' ${F(0.18)}/>`
      + `<g ${S(0.5, 0.8)}><path d='M14 38 H20 M80 38 H86 M16 83 H30 M60 88 H80'/></g>`
      + [24, 36, 48, 60, 72, 84].map((x) => `<circle cx='${x}' cy='39' r='0.9' ${F(0.7)}/>`).join('');
  },
  // Great pyramids of Giza with sun and dunes
  () => `<circle cx='76' cy='24' r='9' ${F(0.18)}/><g ${S(0.8, 1.3)}><circle cx='76' cy='24' r='9'/>`
    + r(0, 7).map((i) => { const a = (i * 45 * Math.PI) / 180; return `<path d='M${n1(76 + 12 * Math.cos(a))} ${n1(24 + 12 * Math.sin(a))} L${n1(76 + 16 * Math.cos(a))} ${n1(24 + 16 * Math.sin(a))}'/>`; }).join('') + `</g>`
    + `<path d='M8 78 L38 22 L62 78 Z' ${F(0.1)}/><path d='M38 22 L62 78 L48 78 Z' ${F(0.32)}/><path d='M54 78 L72 48 L92 78 Z' ${F(0.14)}/><path d='M72 48 L92 78 H80 Z' ${F(0.32)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M8 78 L38 22 L62 78 M38 22 L48 78 M54 78 L72 48 L92 78'/></g>`
    + `<g ${S(0.5, 0.8)}>` + [34, 44, 54, 64, 72].map((y) => `<path d='M${n1(38 - (y - 22) * 0.54 + 2)} ${y} H${n1(38 + (y - 22) * 0.4)}'/>`).join('') + `<path d='M66 58 H86 M69 52 H80 M62 68 H90'/></g>`
    + `<g ${S(0.85, 1.4)}><path d='${sine(84, 2.2, 2.5, 0, 6, 94)}'/></g><g ${S(0.4, 0.9)}><path d='${sine(90, 1.6, 3, 1.5, 14, 86)}'/></g>`
    + `<path d='${sine(84, 2.2, 2.5, 0, 6, 94)}L94 94 L6 94Z' ${F(0.12)}/>`,
  // Indian fort (Red-Fort style): crenellated wall, cusped arches, chhatris
  () => {
    const arch = (cx: number, w: number, top: number) => `M${cx - w} 86 V${top + 8} A${w} ${w} 0 0 1 ${cx + w} ${top + 8} V86`;
    return `<rect x='8' y='36' width='84' height='50' ${F(0.1)}/><rect x='8' y='36' width='84' height='7' ${F(0.2)}/>`
      + `<g ${S(0.9, 1.6)}><path d='M8 86 V36 H92 V86 Z M6 86 H94'/><path d='M8 36 V30 H14 V36 M20 36 V30 H26 V36 M74 36 V30 H80 V36 M86 36 V30 H92 V36 M32 36 V30 H38 V36 M62 36 V30 H68 V36'/><path d='M8 43 H92'/>`
      + `<path d='${arch(50, 13, 50)}'/><path d='${arch(24, 7, 58)}'/><path d='${arch(76, 7, 58)}'/></g>`
      + `<path d='${arch(50, 13, 50)}Z' ${F(0.32)}/><path d='${arch(24, 7, 58)}Z' ${F(0.24)}/><path d='${arch(76, 7, 58)}Z' ${F(0.24)}/>`
      + `<g ${S(0.6, 1)}><path d='M42 86 V74 A8 8 0 0 1 58 74 V86 M50 56 L47 60 H53Z'/></g>`
      + `<g ${S(0.9, 1.4)}><path d='M44 30 H56 V36 H44Z M46 30 A4 5 0 0 1 54 30 M50 20 V25'/><path d='M50 14 V20'/></g><path d='M50 14 L60 17 L50 20Z' ${F(0.55)}/>`
      + `<path d='M46 30 A4 5 0 0 1 54 30Z' ${F(0.4)}/>`
      + `<g ${S(0.4, 0.8)}>` + r(0, 5).map((i) => `<path d='M${12 + i * 3} 46 V50'/>`).join('') + r(0, 5).map((i) => `<path d='M${70 + i * 3} 46 V50'/>`).join('') + `<path d='M12 72 H36 M64 72 H88 M12 78 H36 M64 78 H88'/></g>`;
  },
  // Ashoka pillar: lion capital (profile), abacus, lotus bell, shaft
  () => `<path d='M44 52 H56 L58 88 H42Z' ${F(0.12)}/><path d='M51 52 H56 L58 88 H51Z' ${F(0.2)}/>`
    + `<path d='M30 30 C30 24 34 22 40 22 H62 C68 22 70 26 68 32 V38 H30Z' ${F(0.16)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M44 52 L42 88 M56 52 L58 88 M34 88 H66 V93 H34Z'/>`
    + `<path d='M30 38 V28 C30 22 34 20 40 20 H60 C67 20 70 24 68 30 L69 38 M30 38 H69 M26 38 H74 V44 H26Z'/>`
    + `<path d='M32 44 H68 M36 44 C36 50 40 52 44 52 H56 C60 52 64 50 64 44'/>`
    + `<path d='M69 26 C74 24 76 18 72 14 C74 20 72 22 68 22 M42 38 V32 M60 38 V32'/></g>`
    + `<g ${S(0.8, 1.3)}><circle cx='38' cy='18' r='9' /><path d='M33 17 H36 M31 22 C34 24 38 24 40 22'/></g>`
    + `<circle cx='38' cy='18' r='9' ${F(0.1)}/>`
    + `<path d='M26 44 H74 V38 H26Z' ${F(0.3)}/>`
    + `<g ${S(0.55, 0.9)}><path d='M47 26 C50 24 56 24 60 27 M46 31 C50 29 56 29 62 32 M30 41 H70'/><path d='M46 58 L50 62 L54 58 M46 66 L50 70 L54 66 M46 74 L50 78 L54 74'/></g>`
    + `<circle cx='16' cy='72' r='9' ${S(0.7, 1.1)}/><circle cx='84' cy='72' r='9' ${S(0.7, 1.1)}/>`
    + `<g ${S(0.5, 0.8)}>` + r(0, 5).map((i) => { const a = (i * 60 * Math.PI) / 180; return `<path d='M16 72 L${n1(16 + 9 * Math.cos(a))} ${n1(72 + 9 * Math.sin(a))} M84 72 L${n1(84 + 9 * Math.cos(a))} ${n1(72 + 9 * Math.sin(a))}'/>`; }).join('') + `</g>`,
  // Scroll with quill
  () => `<path d='M24 22 H72 V74 H24Z' ${F(0.1)}/><path d='M24 22 H72 V30 H24Z' ${F(0.14)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M24 22 H72 V74 H24'/><rect x='18' y='16' width='6' height='64' rx='3'/><rect x='72' y='16' width='6' height='64' rx='3'/>`
    + `<path d='M24 22 C24 16 18 16 18 19 M24 74 C24 80 18 80 18 77'/></g>`
    + `<g ${S(0.5, 1)}>` + r(0, 5).map((i) => `<path d='M31 ${34 + i * 7} H${58 + (i % 3) * 5}'/>`).join('') + `</g>`
    + `<g ${S(0.4, 0.8)}><path d='M31 31 H66'/><path d='M60 66 C64 64 68 66 70 68'/></g>`
    + `<path d='M60 40 L74 28 L82 22 C88 18 92 20 90 26 C84 36 76 46 66 56 L58 60 L56 56Z' ${F(0.18)}/>`
    + `<g ${S(0.9, 1.4)}><path d='M56 56 L58 60 L66 56 M58 60 L52 70 L56 66 M82 22 C86 22 90 20 90 26 C84 36 76 46 66 56'/><path d='M80 26 L66 42 M84 28 L70 46 M76 24 L62 38' opacity='.5'/></g>`
    + `<circle cx='52' cy='72' r='2.6' ${F(0.6)}/><path d='M40 84 C46 80 54 86 60 82' ${S(0.3, 1)}/>`,
  // Sailing ship (caravel) with sails, flags, waves
  () => `<path d='M48 12 C30 22 28 44 30 56 H48Z' ${F(0.12)}/><path d='M52 22 C70 30 74 46 72 56 H52Z' ${F(0.2)}/><path d='M50 62 C50 62 70 62 74 56 H26 Z' ${F(0.1)}/>`
    + `<g ${S(0.9, 1.6)}><path d='M50 8 V70 M48 12 C30 22 28 44 30 56 H48 M52 22 C70 30 74 46 72 56 H52 M30 56 H72'/>`
    + `<path d='M12 62 H88 C84 74 76 80 66 80 H34 C24 80 16 74 12 62Z'/><path d='M12 62 L8 56 M88 62 L94 58 M50 8 L60 11 L50 14'/></g>`
    + `<path d='M50 8 L60 11 L50 14Z' ${F(0.6)}/><path d='M12 62 H88 C84 74 76 80 66 80 H34 C24 80 16 74 12 62Z' ${F(0.2)}/>`
    + `<g ${S(0.5, 0.8)}><path d='M38 28 C36 36 36 44 38 52 M44 26 C42 36 42 44 44 54 M58 34 C62 40 62 48 62 54 M66 40 C68 46 68 50 68 54'/><path d='M20 66 H80 M24 71 H76'/></g>`
    + `<g ${S(0.7, 1)}>` + [30, 42, 54, 66].map((x) => `<circle cx='${x}' cy='71' r='1.5'/>`).join('') + `</g>`
    + `<g ${S(0.85, 1.4)}><path d='${sine(86, 2.4, 3, 0, 6, 94)}'/></g><g ${S(0.4, 1)}><path d='${sine(92, 1.8, 3.5, 1, 14, 86)}'/></g>`,
  // Medieval castle: towers, battlements, flags, gate
  () => {
    const tower = (x: number, w: number, top: number) => `<rect x='${x}' y='${top}' width='${w}' height='${88 - top}' ${F(0.12)}/><g ${S(0.9, 1.5)}><path d='M${x} 88 V${top + 6} H${x - 2} V${top} H${x + 2} V${top + 3} H${x + w / 2 - 1.5} V${top} H${x + w / 2 + 1.5} V${top + 3} H${x + w - 2} V${top} H${x + w + 2} V${top + 6} H${x + w} V88'/></g>`;
    return tower(10, 18, 40) + tower(72, 18, 40) + tower(38, 24, 26)
      + `<rect x='28' y='54' width='44' height='34' ${F(0.1)}/><g ${S(0.9, 1.5)}><path d='M28 54 V48 H32 V52 H38 M62 52 H68 V48 H72 V54 M28 88 H72'/><path d='M43 88 V74 A7 7 0 0 1 57 74 V88'/></g>`
      + `<path d='M43 88 V74 A7 7 0 0 1 57 74 V88Z' ${F(0.4)}/><g ${S(0.5, 0.8)}><path d='M46 88 V70 M50 88 V68 M54 88 V70 M43 78 H57'/></g>`
      + `<g ${S(0.8, 1.2)}><path d='M50 26 V10 M16 40 V28 M81 40 V28'/><path d='M49 15 H56'/></g><path d='M50 10 L62 14 L50 18Z M16 28 L26 31 L16 34Z M81 28 L91 31 L81 34Z' ${F(0.6)}/>`
      + `<g ${S(0.8, 1.2)}><path d='M46 40 V34 M54 40 V34 M16 56 V50 M81 56 V50' /><path d='M12 56 H20 M12 62 H20 M77 56 H85 M77 62 H85' opacity='.5'/></g>`
      + `<g ${S(0.45, 0.8)}>` + r(0, 5).map((i) => `<path d='M${31 + i * 6} 64 H${34 + i * 6} M${31 + i * 6} 78 H${34 + i * 6}'/>`).join('') + `</g><path d='M6 88 H94 M10 92 H90' ${S(0.8, 1.3)}/>`;
  },
  // Taj-Mahal style: central dome, flanking domes, four minarets
  () => {
    const minar = (x: number) => `<g ${S(0.9, 1.4)}><path d='M${x - 3} 84 L${x - 2} 40 M${x + 3} 84 L${x + 2} 40 M${x - 4} 84 H${x + 4} M${x - 3} 56 H${x + 3} M${x - 3} 68 H${x + 3} M${x - 3} 40 H${x + 3} M${x - 2} 40 A2 3 0 0 1 ${x + 2} 40 M${x} 32 V36'/></g><path d='M${x - 3} 84 L${x - 2} 40 H${x + 2} L${x + 3} 84Z' ${F(0.14)}/>`;
    return minar(10) + minar(90)
      + `<path d='M24 84 V58 H76 V84Z' ${F(0.1)}/><path d='M50 22 C32 30 30 46 34 56 H66 C70 46 68 30 50 22Z' ${F(0.14)}/><path d='M50 22 C68 30 70 46 66 56 H50Z' ${F(0.14)}/>`
      + `<g ${S(0.9, 1.6)}><path d='M24 84 V58 H76 V84 M20 84 H80 M18 88 H82 M50 22 C32 30 30 46 34 56 M50 22 C68 30 70 46 66 56 M34 56 H66 M50 22 V14 M47 17 H53'/>`
      + `<path d='M24 58 V50 A4 5 0 0 1 32 50 V58 M68 58 V50 A4 5 0 0 1 76 50 V58'/><path d='M42 84 V68 A8 9 0 0 1 58 68 V84'/></g>`
      + `<path d='M42 84 V68 A8 9 0 0 1 58 68 V84Z' ${F(0.4)}/><g ${S(0.45, 0.8)}><path d='M50 26 C44 34 42 44 44 56 M50 26 C56 34 58 44 56 56 M50 26 V56'/><path d='M28 64 V78 M72 64 V78 M34 62 V82 M66 62 V82'/></g>`
      + `<g ${S(0.9, 1.3)}><path d='M26 58 V54 A2 3 0 0 1 30 54 V58'/><path d='M70 58 V54 A2 3 0 0 1 74 54 V58'/></g><path d='M10 92 H90' ${S(0.7, 1.3)}/>`
      + `<g ${S(0.4, 0.9)}><path d='M26 94 H74'/><path d='M30 90 H70'/></g>`;
  },
];
