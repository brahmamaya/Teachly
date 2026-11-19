# Reported problems: what was found, and performance numbers

Written 19 Nov 2026. Everything here was checked in headless Chromium inside the development container, with **emulated** touch. Nothing here was tried on a real iPad, Android tablet, stylus or classroom board.

## 1. The reported problems

| # | Reported | Steps tried | Result | Cause (area) | Status |
|---|---|---|---|---|---|
| 1 | Tools and features scattered | read every menu (see FEATURE-MATRIX.md) and looked at the 40 baseline screenshots | confirmed: the Menu mixes documents, app settings and a destructive action; one feature (PNG export) was unreachable; the notebook name was never shown | UI organisation | **partly fixed** (name button, Save picture, safer Delete page, Move/Copy picker). A separate Document menu is only proposed. |
| 2 | Toolbar buttons slow | tapped 56 tools with real touch events (CDP) at CPU slow-down 1×, 4×, 8×, blank and heavy page | before: the app reacted only when the finger **lifted** (click): 116–121 ms at normal CPU, 143–191 ms at 8×, none under 100 ms. After: it reacts when the finger **lands**: 27–38 ms (p50), all selections under 100 ms in every scenario | input handling (event used) | **fixed**, locally measured |
| 3 | Writing or tool choice delayed | synthetic pen strokes (240 samples) on a 1,200-stroke document | no dropped frames, no missing points (table below) | rendering / input | **not reproduced** in this container; real-device test pending |
| 4 | Boards: slide / page interaction unreliable | read `board.ts`; tried one-finger slide and 60 page switches with touch events | found: Hand mode needed a stylus or "stylus only" before one finger would slide; a finger-only board could not slide. Fixed: in Hand mode a finger or mouse slides, a stylus writes. 60 switches and 40 rapid taps ended on the right page every time | input handling | **fixed in emulation**; real board pending |
| 5 | Some devices do not get updates | read `public/sw.js`, `main.ts`, `vite.config.ts` | pages are fetched network-first, files by hash cache-first, so a reload gets the new version. But a new version only takes over **when the app comes back to the screen**. A classroom board that is never put away keeps running the old code for days | app update behaviour | **found; a "New version ready: tap to update" button was added** (see section 3). Android APK is a separate build and updates only through its own update file. |
| 6 | Added content not editable after reopening | built a 3-page notebook (ink, text, shapes, photos), moved/resized/rotated, waited for Saved, reloaded, closed and reopened, moved every element, edited the text, repeated with 30 rapid edits then close, a failed save then Retry, an old v1 notebook | all elements stayed individually editable; photos are stored as separate files; old notebook opens with a backup copy. The real cause found earlier: stylus-only mode stopped a finger from selecting/moving, and text/table editors could save onto the wrong page | input handling + storage | **fixed and tested** (`persistence.cjs`, 21 checks) |
| 7 | Moving/copying content between pages hard | tried drag to thumbnail (mouse, touch, pen), picker, undo, reopen | before: no route. Now: drag onto a thumbnail, or selection bar ▸ page icon ▸ Move / Copy ▸ page number | missing workflow | **built and tested** |

## 2. Performance, same device and document

Measured with `e2e/perf-baseline.cjs`: Chromium headless in this container, 1366×768, a document with 3 pages of 400 strokes each, CPU slow-down applied through the debugging protocol. **These are local measurements, not field INP, and not a tablet.**

A = pointer down on a toolbar button until the tool has changed and two frames were drawn. B = 240 synthetic mouse samples while the pen is down: gaps between animation frames (16.7 ms is one frame at 60 Hz). C = switching page until two frames were drawn. D = an edit until the autosave reports it written.

| Scenario | A tool, p50 / p95 ms | B frame gap p50 / p95 / max ms | B frames over 33 ms | B points kept of 240 | C page switch p50 / p95 ms | D save confirmed p50 / max ms |
|---|---|---|---|---|---|---|
| full | 26.4 / 26.6 | 16.7 / 16.8 / 18.7 | 0 of 241 | 240 | 33.3 / 37.0 | 14.8 / 24.4 |
| full, CPU ×4 | 27.8 / 35.2 | 16.7 / 17.3 / 23.6 | 0 of 246 | 240 | 85.8 / 107.0 | 49.4 / 75.7 |
| lite, CPU ×4 | 28.3 / 33.4 | 16.7 / 17.4 / 24.0 | 0 of 245 | 240 | 68.6 / 112.1 | 40.4 / 60.4 |

This is the **baseline for the redesign** (the app after the earlier toolbar and storage work). Before that earlier toolbar work the toolbar test gave 116–191 ms (row 2 above); that older run used a different script.

**After the redesign changes** (same script, same container, same document):

| Scenario | A tool, p50 / p95 ms | B frame gap p50 / p95 / max ms | B frames over 33 ms | B points kept of 240 | C page switch p50 / p95 ms | D save confirmed p50 / max ms |
|---|---|---|---|---|---|---|
| full | 26.4 / 26.5 | 16.7 / 16.8 / 18.1 | 0 of 240 | 240 | 33.3 / 35.6 | 14.9 / 26.1 |
| full, CPU ×4 | 24.7 / 34.5 | 16.7 / 18.0 / 26.1 | 0 of 453 | 240 | 99.7 / 119.0 | 58.0 / 78.3 |
| lite, CPU ×4 | 26.5 / 43.2 | 16.7 / 17.8 / 27.6 | 0 of 425 | 240 | 98.7 / 127.3 | 58.5 / 100.7 |

Two more runs of the page-switch column gave 92.4 / 86.4 ms (full, ×4) and 95.5 / 87.0 ms (lite, ×4). So page switching at ×4 slow-down varies between about 86 and 100 ms from run to run; the baseline (85.8 and 68.6) and the later runs overlap for the full path, and the lite path looks about 20–30 ms slower in 3 of 3 later runs. That is **not proven to be caused by the redesign** (one document, one container, 3 runs), but it is not ruled out either, so it should be looked at again on a real board. Tool selection and writing are unchanged within noise. Saving at ×4 went from about 40–49 ms to about 58 ms (p50) in the same runs; same caveat.

Reading the table: tool changes are well under the provisional 100 ms target. Writing shows no dropped frames or lost points in this synthetic test; this does not prove ink latency on a real pen (which needs a camera or an oscilloscope-style test on the device). Page switching on a heavy page at 4× slow-down is the slowest action (up to 112 ms); worth watching but not changed.

## 3. Update button (added in this redesign)

When a new version has been installed in the background and the app has been open for a while, a small "New version ready — update" button appears above the toolbar. Tapping it first writes the notebook, then reloads. Nothing happens by itself during a lesson. The app also asks for a new version every 30 minutes, not only when it comes back to the screen (so a board that stays on gets it too).
