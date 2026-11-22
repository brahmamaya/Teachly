import type { TableEl } from '../types';

/** How the lines of a table are drawn: every line, only the outside frame, only between rows, or none. */
export type TableLines = 'all' | 'outer' | 'rows' | 'none';

/** A ready-made table look. Colours of null follow the board (light writing on a dark board, dark on a light one). */
export interface TableTheme {
  id: string;
  name: string;
  /** Text colour (null: from the board). */
  text: string | null;
  /** Line colour (null: the text colour). */
  line: string | null;
  headerFill: string | null;
  headerText: string | null;
  fill: string | null;
  stripe: string | null;
  colFill: string | null;
  lines: TableLines;
  round: boolean;
}

const solid = (id: string, name: string, head: string, stripe: string, line: string, text: string, extra: Partial<TableTheme> = {}): TableTheme => ({
  id,
  name,
  text,
  line,
  headerFill: head,
  headerText: '#ffffff',
  fill: '#ffffff',
  stripe,
  colFill: null,
  lines: 'all',
  round: true,
  ...extra,
});

/** The looks offered for tables (plain ones for work, bright ones for young learners, calm ones for notes). */
export const TABLE_THEMES: TableTheme[] = [
  { id: 'classic', name: 'Classic', text: null, line: null, headerFill: null, headerText: null, fill: null, stripe: null, colFill: null, lines: 'all', round: false },
  { id: 'clean', name: 'Clean', text: null, line: null, headerFill: 'transparent', headerText: null, fill: null, stripe: null, colFill: null, lines: 'rows', round: false },
  solid('ocean', 'Ocean', '#0d9488', '#e6f6f4', '#b9e3de', '#0f2f2c'),
  solid('sunshine', 'Sunshine', '#f59e0b', '#fff3d6', '#f7d58b', '#4a3200', { fill: '#fffdf5' }),
  solid('blossom', 'Blossom', '#ec4899', '#fde7f1', '#f9c6dd', '#4a1230'),
  solid('mint', 'Mint', '#16a34a', '#e8f7ee', '#bfe6cc', '#12361f'),
  solid('grape', 'Grape', '#7c3aed', '#f1eafe', '#d9c8fb', '#2a1452'),
  solid('sky', 'Sky', '#2563eb', '#e8f1ff', '#c7dbfb', '#0f2350'),
  solid('slate', 'Slate', '#1e293b', '#f1f5f9', '#cbd5e1', '#0f172a', { lines: 'rows', round: false, colFill: '#f8fafc' }),
  solid('notebook', 'Notebook', 'transparent', '#fffef8', '#93c5fd', '#1e3a8a', { headerText: '#1e3a8a', fill: '#fffef8', stripe: null, lines: 'rows', round: false }),
  { id: 'chalk', name: 'Chalk', text: '#f8fafc', line: 'rgba(248,250,252,0.7)', headerFill: 'rgba(248,250,252,0.14)', headerText: '#f8fafc', fill: null, stripe: 'rgba(248,250,252,0.06)', colFill: null, lines: 'all', round: true },
];

export function themeById(id: string | undefined): TableTheme {
  return TABLE_THEMES.find((t) => t.id === id) ?? TABLE_THEMES[0];
}

/** A table dressed in a theme (its cells and size stay). `dark`: the board is dark. */
export function applyTheme(t: TableEl, id: string, dark: boolean): TableEl {
  const th = themeById(id);
  const ink = th.text ?? (dark ? '#e5e7eb' : '#1e293b');
  return {
    ...t,
    theme: th.id,
    color: ink,
    lineColor: th.line ?? undefined,
    headerFill: th.headerFill ?? (dark ? 'rgba(96,165,250,0.28)' : 'rgba(37,99,235,0.14)'),
    headerText: th.headerText ?? undefined,
    fill: th.fill,
    stripe: th.stripe ?? undefined,
    stripes: !!th.stripe,
    colFill: th.colFill ?? undefined,
    firstCol: !!th.colFill,
    lines: th.lines,
    round: th.round,
  };
}

/** Colours used for a theme's small preview in the menu. */
export function previewColors(th: TableTheme, dark: boolean): { head: string; body: string; stripe: string; line: string; text: string } {
  const ink = th.text ?? (dark ? '#e5e7eb' : '#1e293b');
  return {
    head: th.headerFill && th.headerFill !== 'transparent' ? th.headerFill : th.headerFill === 'transparent' ? 'transparent' : dark ? 'rgba(96,165,250,0.28)' : 'rgba(37,99,235,0.14)',
    // a look made for dark boards is previewed on a dark board
    body: th.fill ?? (th.id === 'chalk' ? '#1f2937' : 'transparent'),
    stripe: th.id === 'chalk' ? '#2b3645' : (th.stripe ?? th.fill ?? 'transparent'),
    line: th.line ?? ink,
    text: th.headerText ?? ink,
  };
}
