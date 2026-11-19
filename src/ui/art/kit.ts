// Shared helpers for the cover drawings (100 x 100, drawn in black and used as a mask).
export type Art = () => string;

export const S = (o = 0.85, w = 1.5) => `fill='none' stroke='#000' stroke-opacity='${o}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'`;
export const F = (o = 0.14) => `fill='#000' fill-opacity='${o}' stroke='none'`;
export const n1 = (n: number) => Math.round(n * 10) / 10;

export function sine(y: number, amp: number, waves: number, phase = 0, x0 = 0, x1 = 100): string {
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const x = x0 + (i / 60) * (x1 - x0);
    d += `${i ? 'L' : 'M'}${n1(x)} ${n1(y + amp * Math.sin(((x - x0) / (x1 - x0)) * waves * 2 * Math.PI + phase))}`;
  }
  return d;
}
export const poly = (pts: number[][], close = false) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('') + (close ? 'Z' : '');
export function ngon(cx: number, cy: number, r: number, n: number, rot = -90): number[][] {
  return Array.from({ length: n }, (_, i) => [n1(cx + r * Math.cos(((rot + (360 / n) * i) * Math.PI) / 180)), n1(cy + r * Math.sin(((rot + (360 / n) * i) * Math.PI) / 180))]);
}

