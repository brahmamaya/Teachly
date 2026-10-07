// Core document model. Elements are immutable: every edit creates a new
// object, which lets history snapshots share structure and lets render
// caches be keyed by object identity.

export type PathStyle = 'pen' | 'highlighter' | 'brush' | 'shape';

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

export interface VideoEl extends BoxBase {
  type: 'video';
  src: string;
}

export interface GraphEl extends BoxBase {
  type: 'graph';
  exprs: string[];
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface ChemEl extends BoxBase {
  type: 'chem';
  z: number;
}

export type BoxEl = TextEl | ImageEl | VideoEl | GraphEl | ChemEl;
export type El = PathEl | BoxEl;

export type BgPattern =
  | 'none'
  | 'grid'
  | 'dots'
  | 'lines'
  | 'fourline'
  | 'music'
  | 'graph'
  | 'isometric';

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

export type ToolId =
  | 'select'
  | 'pen'
  | 'eraser'
  | 'shape'
  | 'text'
  | 'laser'
  | 'pan'
  | 'compass';

export type ShapeKind =
  | 'line'
  | 'arrow'
  | 'darrow'
  | 'dashed'
  | 'rect'
  | 'square'
  | 'ellipse'
  | 'circle'
  | 'triangle'
  | 'rtriangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'parallelogram'
  | 'trapezoid'
  | 'cube'
  | 'cylinder'
  | 'cone'
  | 'sphere'
  | 'axes';

export type EraserMode = 'stroke' | 'point' | 'area';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
