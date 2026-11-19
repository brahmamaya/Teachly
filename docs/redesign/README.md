# Teachly interface redesign: where things stand

Date: 19 Nov 2026. Nothing was pushed or deployed. All changes are local files in the working copy.

**Read this first: the redesign is not finished.** Stages 1 and 2 (audit, baseline, design specification) are complete. Stages 3–5 (the new interface shell, tools, pages and documents) were done in part: the changes below are real and tested, but the bigger reorganisation (a separate Document menu, a rebuilt Pages panel, moving the old stylesheet onto the design tokens) is only *proposed* in `DESIGN-SPEC.md`. Stages 6–7 are done only for what can be tested in a container; every check on real tablets, styluses and classroom boards is **pending**.

## Files in this folder

| File | What it is |
|---|---|
| `FEATURE-MATRIX.md` | Every feature found, where it lives, how to reach it before and now, how it was checked |
| `DESIGN-SPEC.md` | Audit findings, the six responsibility groups placed on screen, rules, tokens, responsive plan, accessibility, decisions for the owner |
| `ISSUES-AND-PERFORMANCE.md` | The seven reported problems, what was found, local performance numbers |
| `TEST-LOG.md` | Commands run, the twelve user tasks (pass / fail / not tested), accessibility scan, what is pending |
| `before/`, `after/` | 40 screenshots each: 5 viewports × 8 states |
| `axe-after.json`, `axe-after-light.json` | raw accessibility scan results |

## What changed in the app (this pass)

| File | Change |
|---|---|
| `src/ui/tokens.css` (new) | design tokens, one focus ring, name button, Move/Copy switch, armed Delete tile, update button, contrast fix |
| `src/ui/a11y.ts` (new) | accessible names for icon buttons, `aria-pressed` / `aria-expanded` |
| `src/ui/updatepill.ts` (new) | "New version ready · tap to update" button (saves first) |
| `src/ui/app.ts` | notebook name button; Move / Copy to page picker; Delete page asks twice; Escape closes one layer at a time; Save picture; Large buttons setting; landmark and menu roles |
| `src/store.ts` | `copyElsToPage` (one undo step), `bigControls` setting |
| `src/main.ts` | update button when a new version waits, look for a new version every 30 minutes |
| `e2e/redesign-shots.cjs`, `perf-baseline.cjs`, `axe-scan.cjs`, `redesign.cjs` (new) | screenshots, local performance table, accessibility scan, 24 checks of the new behaviour |

Earlier in this session (also local or already published by the owner's earlier approvals, listed so the picture is complete): autosave with real Saved / Not saved states, picture assets and old-notebook migration, pen / finger input fixes, toolbar reacting on touch-down, page panel drag-and-drop, quick colour bar, subject helper. These are covered by `FEATURE-MATRIX.md`.

## The new organisation in plain words

* **Top left:** the name of your notebook. Tap it to see all your notebooks.
* **Top right:** the time and a small pill that says **Saved** only when it really is saved.
* **Bottom left:** the writing tools (select, hand, pen, eraser, shapes, text). **Bottom right:** undo, redo, the `+` for adding things, the ruler menu for classroom tools, page arrows, all pages, and the ☰ menu.
* **Above the toolbar:** the pen's colours and thickness, only while a pen or shape is chosen.
* **Next to something you selected:** the buttons for that thing (colour, flip, copy, **move or copy to another page**, delete).
* **☰ Menu:** your files (notebooks, save, open, PDF, PowerPoint, **save picture**), board colour, and settings. Deleting a page now asks twice.
* **Escape** closes things one layer at a time. **Large buttons** (Menu ▸ Settings) is for boards and fingers.

## Rollback

Everything is plain files in git. The work is committed locally on the working branch and **not pushed**.

* See the changes: `git status`, `git diff`.
* Undo all of them and keep your earlier work: `git restore src/main.ts src/store.ts src/ui/app.ts` and delete the new files listed above (`src/ui/tokens.css`, `a11y.ts`, `updatepill.ts`, `e2e/` scripts, `docs/redesign/`).
* Or, if the changes were committed locally: `git revert <commit>` (the commit message starts with "Redesign").
* Stored notebooks need no rollback: this pass changed no storage format. The new `bigControls` setting is only a saved preference.

## Things the owner must decide

See section 6 of `DESIGN-SPEC.md`: button size default (compact vs 44–48 px), a separate Document menu, labels under toolbar icons.
