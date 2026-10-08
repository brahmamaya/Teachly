import { describe, expect, it } from 'vitest';
import { bbox, hitTest, insideLasso, pathFromPoints, similarity, transformEl } from '../src/geometry';
import { buildShape, recognize } from '../src/shapes';
import { splitPath } from '../src/tools/eraser';
import type { PathEl } from '../src/types';

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
    for (const kind of ['line', 'rect', 'circle', 'star', 'cube', 'cylinder', 'cone', 'sphere'] as const) {
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

describe('tables', () => {
  const base = {
    id: 't',
    type: 'table' as const,
    rows: 2,
    cols: 3,
    cells: [
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ],
    header: true,
    color: '#000',
    fill: null,
    headerFill: '#eee',
    fontSize: 20,
    x: 0,
    y: 0,
    w: 300,
    h: 100,
    rot: 0,
  };
  it('adds and removes rows and columns keeping text and cell size', async () => {
    const { resizeTable } = await import('../src/tools/table');
    const t = resizeTable(base, 1, -1);
    expect([t.rows, t.cols, t.w, t.h]).toEqual([3, 2, 200, 150]);
    expect(t.cells).toEqual([
      ['a', 'b'],
      ['d', 'e'],
      ['', ''],
    ]);
  });
  it('finds the cell under a point', async () => {
    const { cellAt } = await import('../src/tools/table');
    expect(cellAt(base, 250, 75)).toEqual([1, 2]);
    expect(cellAt(base, 400, 10)).toBeNull();
  });
});
