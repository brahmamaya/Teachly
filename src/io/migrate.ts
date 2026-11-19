import { uid } from '../geometry';
import type { Doc, El, Page } from '../types';

// Older notebooks are brought up to the current format when they are opened,
// without ever destroying the original:
//  - the untouched saved copy is kept (bak:<id>:v<old>) before anything is rewritten
//  - nothing is dropped: unknown fields stay
//  - only what is certainly wrong is repaired (missing or repeated ids,
//    missing rotation / opacity)
// Format history:  1 = pictures inside the pages, no revision counter
//                  2 = pictures stored as assets, revision counter, unique ids

export const SCHEMA = 2;

export interface Migration {
  doc: Doc;
  /** Anything differs from what is saved (format, repaired ids…): worth saving again. */
  changed: boolean;
  /** Format the notebook was saved in. */
  from: number;
  /** Pages that are only one flat picture (older versions): their writing cannot be separated again. */
  flat: number;
  notes: string[];
}

/** A page that is nothing but one big locked picture (a book page / slide from an older version). */
function isFlatPicture(p: Page): boolean {
  return p.els.length === 1 && p.els[0].type === 'image' && !!p.els[0].locked && !p.els[0].pdf;
}

export function migrateDoc(raw: Doc): Migration {
  const from = raw.schema ?? 1;
  const notes: string[] = [];
  let changed = from < SCHEMA;
  const seenPage = new Set<string>();
  const seenEl = new Set<string>();
  let repaired = 0;

  const pages = raw.pages.map((p0) => {
    let p = p0;
    if (!p.id || seenPage.has(p.id)) {
      p = { ...p, id: uid() };
      repaired++;
    }
    seenPage.add(p.id);
    if (!Array.isArray(p.els)) {
      p = { ...p, els: [] };
      repaired++;
    }
    let touched = false;
    const els = p.els.map((e0): El => {
      let e = e0;
      if (!e.id || seenEl.has(e.id)) {
        e = { ...e, id: uid() } as El;
        touched = true;
      }
      seenEl.add(e.id);
      // Boxes always know their rotation, lines their opacity.
      if (e.type !== 'path' && typeof e.rot !== 'number') {
        e = { ...e, rot: 0 } as El;
        touched = true;
      } else if (e.type === 'path' && typeof e.opacity !== 'number') {
        e = { ...e, opacity: 1 } as El;
        touched = true;
      }
      return e;
    });
    if (touched) {
      repaired++;
      p = { ...p, els };
    }
    return p;
  });

  if (repaired) {
    changed = true;
    notes.push(`${repaired} page${repaired === 1 ? '' : 's'} had missing or repeated ids; they were repaired.`);
  }
  const flat = pages.filter(isFlatPicture).length;
  if (flat && from < SCHEMA)
    notes.push(`${flat} page${flat === 1 ? ' is' : 's are'} a flat picture saved by an older version. Its original pieces cannot be rebuilt, so it stays a picture (anything written on top is still editable).`);

  const doc: Doc = { ...raw, pages, schema: SCHEMA, rev: raw.rev ?? 0 };
  return { doc, changed, from, flat, notes };
}
