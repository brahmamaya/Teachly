import { describe, expect, it } from 'vitest';
import { bbox, hitTest, insideLasso, pathFromPoints, similarity, transformEl } from '../src/geometry';
import { compile, evaluate, formatNumber } from '../src/mathexpr';
import { buildShape, recognize } from '../src/shapes';
import { splitPath } from '../src/tools/eraser';
import type { PathEl } from '../src/types';
import { ELEMENTS } from '../src/widgets/elements-data';

const path = (pts: [number, number][], extra: Partial<PathEl> = {}): PathEl => ({
  id: 'p',
  type: 'path',
  style: 'pen',
  pts: pathFromPoints(pts, false),
  color: '#000',
  size: 4,
  opacity: 1,
  ...extra,
});

describe('math expressions', () => {
  it('evaluates arithmetic with precedence', () => {
    expect(evaluate('2+3*4')).toBe(14);
    expect(evaluate('2^3^2')).toBe(512);
    expect(evaluate('-2^2')).toBe(-4);
    expect(evaluate('(1+2)(3+4)')).toBe(21);
    expect(evaluate('5!')).toBe(120);
  });
  it('supports functions, constants and implicit multiplication', () => {
    expect(evaluate('sin(pi/2)')).toBeCloseTo(1);
    expect(evaluate('2pi')).toBeCloseTo(Math.PI * 2);
    expect(evaluate('sqrt 16')).toBe(4);
    expect(compile('2x+1')({ x: 3 })).toBe(7);
    expect(compile('y = x^2')({ x: -3 })).toBe(9);
    expect(compile('x sin x')({ x: Math.PI / 2 })).toBeCloseTo(Math.PI / 2);
  });
  it('rejects invalid input', () => {
    expect(() => compile('2+')).toThrow();
    // Unknown names are treated as variables, never executed.
    expect(() => compile('alert(1)')({ x: 1 })).toThrow(/Unknown variable/);
  });
  it('formats numbers', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1 / 0)).toBe('∞');
  });
});

describe('shape recognition', () => {
  it('recognises a straight line', () => {
    const pts: number[] = [];
    for (let i = 0; i <= 20; i++) pts.push(i * 10, 100 + (i % 2) * 1.5, 0.5);
    expect(recognize(pts)?.pts.length).toBe(2);
  });
  it('recognises a circle', () => {
    const pts: number[] = [];
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      pts.push(100 + Math.cos(a) * 50 + Math.sin(i) * 1.5, 100 + Math.sin(a) * 50, 0.5);
    }
    const r = recognize(pts)!;
    expect(r.closed).toBe(true);
    expect(r.pts.length).toBeGreaterThan(30);
  });
  it('recognises a triangle', () => {
    const pts: number[] = [];
    const corners = [[100, 0], [200, 180], [0, 180], [100, 2]];
    for (let k = 0; k < 3; k++) {
      const [ax, ay] = corners[k], [bx, by] = corners[k + 1];
      for (let i = 0; i < 20; i++) pts.push(ax + ((bx - ax) * i) / 20, ay + ((by - ay) * i) / 20, 0.5);
    }
    pts.push(100, 2, 0.5);
    const r = recognize(pts)!;
    expect(r.closed).toBe(true);
    expect(r.pts.length).toBe(3);
  });
  it('builds every shape kind', () => {
    for (const kind of ['line', 'rect', 'circle', 'star', 'cube', 'cylinder', 'cone', 'sphere', 'axes'] as const) {
      expect(buildShape(kind, 0, 0, 200, 150, { color: '#000', size: 3, fill: null }).length).toBeGreaterThan(0);
    }
  });
});

describe('geometry', () => {
  it('hit tests paths and boxes', () => {
    const p = path([[0, 0], [100, 0]]);
    expect(hitTest(p, 50, 1, 2)).toBe(true);
    expect(hitTest(p, 50, 30, 2)).toBe(false);
    const box = { id: 'b', type: 'image' as const, src: '', x: 0, y: 0, w: 100, h: 50, rot: Math.PI / 2 };
    expect(hitTest(box, 50, 60, 0)).toBe(true); // rotated: now tall
    expect(hitTest(box, 5, 25, 0)).toBe(false);
  });
  it('transforms elements with a similarity matrix', () => {
    const p = path([[0, 0], [10, 0]]);
    const t = transformEl(p, similarity(0, 0, 2, 0, 5, 5));
    expect(t.pts.slice(0, 2)).toEqual([5, 5]);
    expect(t.pts.slice(3, 5)).toEqual([25, 5]);
    expect(t.size).toBe(8);
  });
  it('lasso selection', () => {
    const p = path([[10, 10], [20, 20]]);
    expect(insideLasso(p, [0, 0, 50, 0, 50, 50, 0, 50])).toBe(true);
    expect(insideLasso(p, [100, 100, 150, 100, 150, 150])).toBe(false);
  });
  it('computes bounding boxes', () => {
    const b = bbox(path([[0, 0], [100, 50]]));
    expect(b.w).toBeCloseTo(104);
  });
});

describe('partial eraser', () => {
  it('splits a stroke where the eraser passes', () => {
    const p = path([[0, 0], [200, 0]], { style: 'shape' });
    const pieces = splitPath(p, 100, -50, 100, 50, 10)!;
    expect(pieces).toHaveLength(2);
    expect(Math.max(...pieces[0].pts.filter((_, i) => i % 3 === 0))).toBeLessThan(100);
  });
  it('returns null when nothing is erased', () => {
    expect(splitPath(path([[0, 0], [200, 0]]), 100, 100, 100, 200, 10)).toBeNull();
  });
});

describe('periodic table data', () => {
  it('has 118 unique positioned elements', () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(ELEMENTS[25].sym).toBe('Fe');
    const pos = new Set(ELEMENTS.map((e) => `${e.col},${e.row}`));
    expect(pos.size).toBe(118);
    expect(ELEMENTS.every((e) => e.col >= 1 && e.col <= 18)).toBe(true);
  });
});
