// Core document model. Elements are immutable: every edit creates a new
// object, which lets history snapshots share structure and lets render
// caches be keyed by object identity.

export type PathStyle = 'pen' | 'highlighter' | 'shape';

export interface PathEl {
  id: string;
  type: 'path';
  /** Flat list of x, y, pressure triples in world coordinates. */
  pts: number[];
  style: PathStyle;
  color: string;
  size: number;
  opacity: number;
  closed?: boolean;
  fill?: string | null;
  dash?: boolean;
  /** 0 = none, 1 = end, 2 = both ends */
  arrow?: 0 | 1 | 2;
  /** Pressure was simulated (mouse / touch). */
  sim?: boolean;
  locked?: boolean;
}

export interface BoxBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in radians around the box centre. */
  rot: number;
  locked?: boolean;
}

export interface TextEl extends BoxBase {
  type: 'text';
  text: string;
  color: string;
  fontSize: number;
  bold?: boolean;
  bg?: string | null;
}

export interface ImageEl extends BoxBase {
  type: 'image';
  src: string;
}

export type BoxEl = TextEl | ImageEl;
export type El = PathEl | BoxEl;

export type BgPattern = 'none' | 'grid' | 'lines' | 'fourline';

export interface Page {
  id: string;
  bg: string;
  pattern: BgPattern;
  els: El[];
}

export interface Doc {
  version: 1;
  title: string;
  pages: Page[];
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export type ToolId = 'select' | 'pen' | 'eraser' | 'shape' | 'text' | 'compass';

export type ShapeKind =
  | 'line'
  | 'arrow'
  | 'dashed'
  | 'rect'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'rtriangle'
  | 'diamond'
  | 'parallelogram'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'cube'
  | 'cylinder'
  | 'cone'
  | 'sphere';

export type EraserMode = 'stroke' | 'point';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
