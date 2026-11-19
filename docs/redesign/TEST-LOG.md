# Redesign test log

Run on 19 Nov 2026 in the development container: headless Chromium driven by Playwright, dev server (`vite`) on port 5173. **Everything is emulation. No real iPad, Android tablet, stylus or classroom board was used.** `docs/redesign/after/` holds the screenshots after the changes, `docs/redesign/before/` the ones before, at 390×844, 768×1024, 1024×768, 1366×768 and 1920×1080 in eight states each (writing, pen menu, Insert, Tools, Menu, selection, Pages, My notebooks).

## Commands that were run

```
npx tsc --noEmit -p .            # type check: clean
npx vitest run                    # 15 unit tests: passed
node e2e/<name>.cjs               # browser checks, 22 scripts: all passed (final full run, nothing edited while it ran)
node e2e/perf-baseline.cjs        # local performance table (ISSUES-AND-PERFORMANCE.md)
AXE=<axe.min.js> node e2e/axe-scan.cjs   # automated accessibility scan
```

A first full run showed one failing check in `persistence.cjs`. It was run while a source file was being edited (the dev server reloaded the page under the test). Running it alone passed, and the final full run, with no edits during it, passed. This is reported rather than hidden: if `persistence.cjs` ever fails on its own, treat it as real.

## The twelve user tasks of the brief

| # | Task | Expected | Observed | Script | Environment | Result |
|---|---|---|---|---|---|---|
| 1 | Start writing from the initial workspace | pen is active, a stroke appears | stroke created with the first tool | `quickbar.cjs`, `perf-baseline.cjs` | Chromium, mouse | pass |
| 2 | Change pen colour and thickness | one tap / one slide, next stroke uses it, tool and selection unchanged | colour tap and slider set the pen; next stroke has the colour and size | `quickbar.cjs` (desktop, iPad and phone sizes) | Chromium, mouse and emulated touch | pass |
| 3 | Erase, then return to the previous writing tool | tool switches and switches back, settings kept | tool changes both ways; pen keeps colour and size | `quickbar.cjs` (eraser hides the bar, pen brings it back) | Chromium | pass |
| 4 | Undo and redo | one step each, copies and moves are one step | undo/redo restore moves, copies, new page, Auto set, stretched wedge | `move-pages.cjs`, `redesign.cjs`, `block-magnet.cjs`, `wedge-angle.cjs` | Chromium | pass |
| 5 | Insert and edit supported content | pictures, text, pieces can be added and edited | photo insert, text edit, label edit, piece insert pass; PDF and PowerPoint import were not run | `persistence.cjs`, `edit-mass.cjs`, `subject-nlm.cjs` | Chromium | pass (PDF / PowerPoint: **not tested**) |
| 6 | Select and transform an existing object | move, resize, rotate | done on photos and shapes | `persistence.cjs` | Chromium, mouse | pass |
| 7 | Add and switch pages | right page, content and label | 60 switches, 40 rapid taps, strokes land on the shown page | `navigation.cjs` | Chromium, emulated touch | pass |
| 8 | Reorder a page | Up / Down buttons | buttons exist (`data-pg=up/down`); **no script moves a page** | — | — | **not tested** |
| 9 | Move / copy supported content to another page | target shown, Move vs Copy distinct, undo, no loss or duplicates | drag (mouse, touch, pen), picker with Move / Copy, undo, reopen | `move-pages.cjs`, `pen-drag-page.cjs`, `redesign.cjs` | Chromium | pass |
| 10 | Save, close, reopen, continue editing | everything editable | 3-page notebook, close/reopen, old v1 notebook, failed save + Retry | `persistence.cjs` | Chromium | pass |
| 11 | Export using existing formats | file is made | **PNG** download starts (now reachable); PDF maker covered by unit tests; no script saved a PDF or opened it | `redesign.cjs` | Chromium | PNG pass; PDF **not tested end to end** |
| 12 | Recover from a supported error without losing work | message, retry, nothing lost | simulated full disk: pill says Not saved, Retry works, the edit is kept; update button saves first and does not reload if saving fails (the failure path itself was not forced) | `persistence.cjs`, `redesign.cjs` | Chromium | pass (update-failure path **not tested**) |

## New or changed behaviour in this pass (`e2e/redesign.cjs`, 24 checks)

Accessible names for every toolbar and menu button; `aria-pressed` on the active tool only; `aria-expanded` on an open menu; Escape closes one layer at a time (menu, then Pages panel, then selection); notebook name top left opens My notebooks; Copy to page (new ids, same place, still text, one undo) and Move to page; Delete page needs a second tap and can be undone; Save picture downloads a PNG; "New version ready" button saves then reloads; Large buttons 34 px → 52 px and back to 34 px.

## Automated accessibility scan (axe-core 4.x, WCAG 2 A/AA, 2.1, 2.2 AA and best practice)

States scanned, dark and light board: writing, Insert open, Menu open, selection bar, Pages panel. First scan found: a button whose accessible name did not contain its visible text, menu items without a menu parent, 8 areas outside landmarks, and a low-contrast red "Delete" label on the dark Pages panel. After the fixes the only finding left is `meta-viewport` ("zooming is disabled"): **deliberate**, because pinch is the board's own zoom and the page must not zoom itself while drawing. It does mean a teacher cannot enlarge the interface with browser zoom; the Large buttons setting is the offered alternative. Raw results: `docs/redesign/axe-after.json` (dark) and `axe-after-light.json` (light). **A clean scan is not proof of accessibility**: the canvas is not covered, keyboard drawing is not possible, and no screen reader was used.

## Viewports

Layout checks (`quickbar-level.cjs`, `quickbar-dock.cjs`, screenshots) covered 390×844, 820×1180, 1024×768, 1180×820, 1280×800, 1366×768, 1400×900, 1920×1080. **Not tested:** browser zoom, reduced available height, the on-screen keyboard, Safari/WebKit, Firefox, iOS standalone mode, safe-area insets on a real device, the Android app.

## Pending: needs real people and hardware

* Handwriting latency with a real stylus on an iPad / Android tablet / classroom board (camera-based or on-device measurement). Local frame timing above says nothing about it.
* Touch and stylus behaviour of drag-to-page, line-end handles and the block magnet on the owner's tablet and board.
* A screen-reader pass (VoiceOver / TalkBack) over the toolbar and menus.
* A task-based usability session with teachers (proposal below). No participant feedback exists; none is invented here.

### Proposed usability session (20 minutes per teacher, 5 teachers)

Tasks: (1) start writing in red, thick; (2) erase a word and go back to the pen; (3) add a page and move a drawn shape to it; (4) copy the same shape to a third page; (5) close the app, reopen, and say whether the work is saved; (6) save a PDF. Record: success without help, seconds to find each control, wrong-tool taps, requests for help, and a 1–5 confidence that the work is saved. Repeat on the owner's board with Large buttons off and on.
