// Core document model. Elements are immutable: every edit creates a new
// object, which lets history snapshots share structure and lets render
// caches be keyed by object identity.

/** pen: smooth ink · brush: soft tapered strokes · calligraphy: flat slanted nib. */
export type PathStyle = 'pen' | 'brush' | 'calligraphy' | 'highlighter' | 'shape';

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

export interface TableEl extends BoxBase {
  type: 'table';
  rows: number;
  cols: number;
  /** cells[row][col] */
  cells: string[][];
  /** First row drawn as a header. */
  header: boolean;
  /** Line and text colour. */
  color: string;
  /** Cell background (null = transparent). */
  fill: string | null;
  headerFill: string;
  fontSize: number;
}

/** Tape strip that hides part of the page; tap it to reveal (and hide again). */
export interface TapeEl extends BoxBase {
  type: 'tape';
  color: string;
  /** Revealed: only a faint outline is drawn. */
  open?: boolean;
}

export type BoxEl = TextEl | ImageEl | TableEl | TapeEl;
export type El = PathEl | BoxEl;

export type BgPattern = 'none' | 'grid' | 'lines' | 'fourline' | 'dots' | 'graph' | 'music' | 'cornell';

export interface Page {
  id: string;
  bg: string;
  pattern: BgPattern;
  els: El[];
}

export interface Doc {
  version: 1;
  /** Notebook id in the on-device library. */
  id?: string;
  title: string;
  pages: Page[];
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export type ToolId = 'select' | 'pen' | 'eraser' | 'shape' | 'fill' | 'text' | 'compass' | 'laser' | 'tape';

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
