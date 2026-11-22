// Core document model. Elements are immutable: every edit creates a new
// object, which lets history snapshots share structure and lets render
// caches be keyed by object identity.

/** pen: smooth ink · brush: soft tapered strokes · calligraphy: flat slanted nib. */
export type PenKind = 'pen' | 'fineliner' | 'pencil' | 'crayon' | 'marker' | 'fountain' | 'watercolor' | 'brush' | 'calligraphy' | 'highlighter';
export type PathStyle = PenKind | 'shape';

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
  /** Pieces with the same group id are selected and moved together. */
  group?: string;
  /** An arc shape: its bend can be changed with the handle at its middle. */
  arc?: boolean;
  /** Pressure was simulated (mouse / touch). */
  sim?: boolean;
  /**
   * A paint-bucket fill: `pts` is the outline of the area and `rings` the
   * other edges (holes inside it), filled with `fill` (even-odd) and no line.
   */
  region?: boolean;
  rings?: number[][];
  locked?: boolean;
  /** Other things (a block) can sit on this edge / outline (ground, table, wedge slope, top of a block). */
  surf?: boolean;
  /** A block that seats itself on the nearest surface (Auto set). */
  snap?: 'block';
  /** A spring: rebuilt from its two ends when stretched or squeezed, so the coils keep their size. */
  spring?: { coils: number; amp: number; lead: number };
  /** An angle mark (the arc): redrawn when the triangle in its group is stretched, so it always shows the real angle at corner `v`. */
  ang?: { v: number };
}

export interface BoxBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in radians around the box centre. */
  rot: number;
  /** Pieces with the same group id are selected and moved together. */
  group?: string;
  locked?: boolean;
}

export interface TextEl extends BoxBase {
  type: 'text';
  text: string;
  color: string;
  fontSize: number;
  bold?: boolean;
  /** Typeface: default (Inter), 'orbitron' (numbers, futuristic) or 'exo' (Exo 2). */
  font?: 'orbitron' | 'exo';
  bg?: string | null;
  /** An angle value (like 30°): kept equal to the real angle at corner `v` of the triangle in its group. */
  ang?: { v: number };
}

export interface ImageEl extends BoxBase {
  type: 'image';
  src: string;
  /**
   * A page of an opened PDF: the original file is kept on the device
   * (library key) so a saved PDF can reuse the real page, small and sharp.
   */
  pdf?: { src: string; page: number };
  /** The part of the picture that is shown (fractions of the whole picture); none = all of it. Set by Crop. */
  crop?: { x: number; y: number; w: number; h: number };
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
  /** The look it was given (Table style); the fields below can then be changed one by one. */
  theme?: string;
  /** Line colour (missing: the text colour). */
  lineColor?: string;
  /** Header text colour (missing: the text colour). */
  headerText?: string;
  /** Every other row tinted. */
  stripes?: boolean;
  stripe?: string;
  /** First column tinted and bold. */
  firstCol?: boolean;
  colFill?: string;
  /** Which lines are drawn (missing: all). */
  lines?: 'all' | 'outer' | 'rows' | 'none';
  /** Rounded outer corners. */
  round?: boolean;
  /** Text in the cells (missing: centred). */
  align?: 'left' | 'center';
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
  /** A short label put on the page in the page grid (Tag). */
  tag?: string;
}

export interface Doc {
  version: 1;
  /** Notebook id in the on-device library. */
  id?: string;
  title: string;
  pages: Page[];
  /** A vertical notebook: its pages are tall (3:4). Missing = the pages follow the screen. */
  orient?: 'portrait';
  /** Page shape (height / width) taken from an imported file (PDF, picture): the pages match the file exactly. */
  shape?: number;
  /** Format of the saved document (2 = pictures kept as separate assets). Older ones are migrated on load. */
  schema?: number;
  /** Counts every change; a save never replaces a newer revision with an older one. */
  rev?: number;
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
  | 'sphere'
  | 'axes2'
  | 'axes3'
  | 'arc';

/** point: erase part · stroke: the whole object touched · area: everything inside a loop */
export type EraserMode = 'stroke' | 'point' | 'area';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
