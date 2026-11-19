# Teachly: feature-preservation matrix

Built by reading the source (`src/ui/app.ts`, `library.ts`, `pages.ts`, `pagegrid.ts`, `subjectpanel.ts`, `src/io/*`, `src/tools/*`, `src/widgets/*`) and by running the app. **Class**: A = existing behaviour that works, B = existing behaviour that is broken or unreachable, C = improvement made by this redesign.
**Verification**: a script name means an automated browser check in `e2e/` that passed on 19 Nov 2026 in headless Chromium (emulated touch, not a real tablet or board). "Read only" means the feature was found in the code and kept in place, but no check was run for it in this pass.

| # | Feature | Source | Access path before | Access path now | Class | Verification | Final status |
|---|---|---|---|---|---|---|---|
| **Document** |||||||||
| 1 | Notebook name shown on the board | `ui/app.ts documentTitle` | not shown anywhere on the board | top-left name button, opens My notebooks | C | `redesign.cjs` | new |
| 2 | My notebooks (grid, search, folders, favourites, trash, covers, rename, copy, download, delete/restore/purge) | `ui/library.ts`, `io/library.ts` | Menu ▸ Notebooks | Menu ▸ Notebooks **and** the name button | A | `library-ui.cjs` (open, star, favourites); rest read only | kept, extra door added |
| 3 | New notebook (name, shape, cover) | `ui/newnotebook.ts` | Menu ▸ New / Notebooks ▸ New | unchanged | A | read only | kept |
| 4 | Save notebook file (.teachly), Ctrl+S | `io/files.ts` | Menu ▸ Save notebook | unchanged | A | read only | kept |
| 5 | Open file | `io/files.ts` | Menu ▸ Open file | unchanged | A | read only | kept |
| 6 | Open PDF / book | `io/pdfpages.ts` | Menu ▸ PDF, Insert ▸ PDF | unchanged | A | read only | kept |
| 7 | Open PowerPoint | `io/office.ts` | Menu ▸ PowerPoint, Insert ▸ PowerPoint | unchanged | A | read only | kept |
| 8 | Save PDF (page range) | `io/pdfvector.ts`, `ui/pdfrange.ts` | Menu ▸ Save PDF | unchanged | A | read only (unit tests cover the PDF maker) | kept |
| 9 | Save a picture of the page (PNG) | `io/files.ts exportPng` | **none: the function existed but nothing called it** | Menu ▸ Save picture | B → C | `redesign.cjs` (download starts) | reachable now |
| 10 | Autosave, Saved / Saving / Not saved pill, Retry | `io/autosave.ts`, `ui/savebadge.ts` | automatic, top-right pill | unchanged | A | `persistence.cjs` (failed save → Retry → saved) | kept |
| 11 | Reopen with everything editable | `io/library.ts`, `io/migrate.ts` | automatic | unchanged | A | `persistence.cjs` (3 pages: ink, text, shapes, photos; reload and close/reopen; old v1 notebook) | kept |
| 12 | Record lesson | `widgets/recorder.ts` | Menu ▸ Record (toolbar button opt-in) | unchanged | A | read only (needs a microphone) | kept |
| 13 | Full screen, Share, Install, Privacy, Terms | `ui/app.ts`, `ui/install.ts`, `ui/legal.ts` | Menu | unchanged | A | read only | kept |
| **Board look and app settings** |||||||||
| 14 | Board colour and pattern | `ui/app.ts setBoard` | Menu (top) | unchanged | A | `subject-light.cjs` (light board) | kept |
| 15 | Settings: stylus only, erase with palm, scribble to erase, hold pen for a shape | `ui/app.ts` | Menu ▸ Settings | unchanged | A | `baseline-touch.cjs` (stylus-only still allows finger editing) | kept |
| 16 | **Large buttons** (bigger toolbar for boards/fingers) | `ui/scale.ts` | none | Menu ▸ Settings ▸ Large buttons (off by default, compact stays) | C | `redesign.cjs` (34 px → 52 px, and back) | new |
| 17 | Edit toolbar: position top/bottom, height, align, show/hide buttons, Simple toolbar, Show all | `ui/app.ts tbedit` | Menu ▸ Edit toolbar | unchanged | A | `simple-ui.cjs` | kept |
| 18 | Floating hexagon dock | `ui/app.ts renderHex` | Edit toolbar ▸ Floating hexagon | unchanged (its menus now open at the toolbar) | A | `pages-tap-hex.cjs` | kept |
| 19 | Subject helper (Physics Class 11 Laws of Motion, 46+ pieces) | `ui/subjectpanel.ts`, `subjects/*` | Menu ▸ Subject | unchanged | A | `subject-nlm.cjs`, `subject-smart.cjs`, `block-magnet.cjs`, `wedge-angle.cjs`, `mirrored-wedge.cjs` | kept |
| **Core tools (toolbar, left)** |||||||||
| 20 | Select (tap, lasso, move, resize, rotate, groups) | `tools/select.ts` | toolbar, key V | unchanged | A | `move-pages.cjs`, `persistence.cjs` (every element selectable and movable) | kept |
| 21 | Slide (hand) mode: move/zoom the board | `board.ts` | toolbar hand | unchanged | A | `friend-requests.cjs` (one finger slides, draws nothing) | kept |
| 22 | Pen: pen, brush, calligraphy, highlighter; colour, size, steadiness | `tools/pen.ts`, pen menu | toolbar pen (second tap = menu), key P | unchanged, plus one-tap colour bar | A + C | `quickbar.cjs` | kept |
| 23 | Quick colour and thickness bar | `ui/quickbar.ts` | none | floats on the toolbar line while a pen/shape is active | C | `quickbar.cjs`, `quickbar-level.cjs`, `quickbar-dock.cjs` | new |
| 24 | Eraser: part / object / area, size, clear-page slider | `tools/eraser.ts` | toolbar, key E | unchanged (Clear page already needs a deliberate slide) | A | read only | kept |
| 25 | Shapes (21 kinds, colour, size, fill) | `tools/misc.ts`, `shapes.ts` | toolbar, key S | unchanged | A | `flip-shape-ui.cjs` | kept |
| 26 | Fill (paint bucket) | `tools/fill.ts` | toolbar (hidden by default), Tools menu | unchanged | A | read only | kept |
| 27 | Text (type, edit, table cell editing) | `tools/text.ts`, `tools/table.ts` | toolbar, key T, double-tap a label | unchanged + Edit label button | A + C | `edit-mass.cjs` | kept |
| 28 | Tape (hide answers) | `tools/tape.ts` | toolbar (hidden by default), Tools menu | unchanged | A | read only | kept |
| 29 | Laser pointer | `tools/laser.ts` | toolbar (hidden by default), Tools menu | unchanged | A | read only | kept |
| 30 | Undo / Redo (buttons dim when unavailable), Ctrl+Z/Y | `store.ts` | toolbar right, keys | unchanged | A | used by most scripts | kept |
| **Insert and classroom tools** |||||||||
| 31 | Insert: Picture, PDF/Book, PowerPoint, Table, Graph y=f(x), New page, Paste | `ui/app.ts` | toolbar `+` | unchanged | A | `friend-requests.cjs` (menu), `persistence.cjs` (pictures) | kept |
| 32 | ~~Take photo (camera)~~ | removed by the owner on 19 Nov 2026 | | | removed on purpose | `friend-requests.cjs` (no camera item) | removed |
| 33 | Tools menu: Ruler, Protractor, Compass, Timer, Spotlight, Screen cover, Magnifier, Graph, Calculator (with inverse functions), Random picker, Scoreboard, Poll, Group writing | `widgets/*`, `instruments.ts` | toolbar ruler button | unchanged | A | `simple-ui.cjs` (calculator), `friend-requests.cjs` (spotlight/magnifier close) | kept |
| **Pages** |||||||||
| 34 | Page arrows and "n / N" | `ui/app.ts` | toolbar right | unchanged | A | `navigation.cjs` (60 switches, rapid taps) | kept |
| 35 | Pages panel: thumbnails, go, up, down, copy page, paste page, delete page, new page, expand | `ui/pages.ts` | toolbar pages button | unchanged; closes with Escape or a tap on empty board | A + C | `move-pages.cjs`, `pages-tap-hex.cjs`, `redesign.cjs` | kept |
| 36 | All-pages grid (select several, undo/redo, open) | `ui/pagegrid.ts` | Pages panel ▸ Expand | unchanged | A | read only | kept |
| 37 | Delete page | `ui/app.ts` | Menu tile, one tap | Menu tile, **second tap to confirm** (still undoable) | C | `redesign.cjs` | safer |
| 38 | Move things to a page: drag onto a thumbnail | `ui/pagedrop.ts`, `tools/select.ts` | none | drag with mouse, finger or pen onto a page in the panel (panel scrolls itself) | C | `move-pages.cjs`, `pen-drag-page.cjs` | new |
| 39 | Move / **Copy** things to a page without dragging | `ui/app.ts movePicker`, `store.ts` | none | selection bar ▸ page icon ▸ Move or Copy switch, page numbers, "+ New" | C | `move-pages.cjs`, `redesign.cjs` (copy: new ids, same place, one undo) | new |
| **Selected things (selection bar)** |||||||||
| 40 | Delete, colour, thickness, fill, bigger/smaller, flip, group/ungroup, table row/column/header | `ui/app.ts renderProps` | selection bar | unchanged | A | `flip-shape-ui.cjs`; rest read only | kept |
| 41 | Copy, Duplicate, Paste (floating Paste button) | `io/files.ts`, `ui/app.ts` | Ctrl+C/V/D, selection bar | Copy and Duplicate are separate buttons; Paste button appears after Copy | A + C | `paste-chip.cjs`, `friend-requests.cjs` | kept |
| 42 | Auto set, block magnet, line/spring end handles | `subjects/snap.ts`, `tools/select.ts` | none | selection bar button; automatic while moving a block near a surface | C | `block-magnet.cjs`, `subject-smart.cjs` | new |
| **Keyboard** |||||||||
| 43 | Ctrl+Z/Y, Ctrl+S, Ctrl+C/V/D, Delete, Escape, PageUp/PageDown, V P E S T, Space-drag | `ui/app.ts bindKeys` | keyboard | Escape now closes one layer at a time: menu, then Pages panel (nothing selected), then selection | A + C | `redesign.cjs` (Escape layers) | kept |
