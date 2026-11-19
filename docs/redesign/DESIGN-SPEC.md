# Teachly interface: design specification

Status: written on 19 Nov 2026 from the real code and the screenshots in `docs/redesign/before/`. Parts marked **built** exist in the app now; parts marked **proposed** are the next stages and are NOT built yet.

## 1. What the audit found (before any change)

Screenshots: `docs/redesign/before/<width>x<height>-<state>.png` for 390×844, 768×1024, 1024×768, 1366×768 and 1920×1080 (writing, pen menu, Insert, Tools, Menu, selection, Pages, My notebooks).

| Finding | Where | Kind |
|---|---|---|
| The **Menu** (the "☰" at the bottom right) holds board colour and pattern, notebook files, import, export, recording, share, install, full screen, **Delete page**, subject, toolbar editing and settings in one panel. Documents, app preferences and a destructive action sit side by side. | `ui/app.ts` case `menu` | organisation |
| **Delete page** was one tap, next to "Full screen" and "Share". It could be undone, but it was easy to hit. | Menu tile | safety |
| The notebook's **name was never shown** on the board. Teachers could not tell which notebook they were in. | corner | status |
| `exportPng()` (save a picture of the page) existed in the code but **nothing called it**. | `io/files.ts` | unreachable feature |
| Selection bar: up to 12 icon-only buttons, names only in tooltips, with no accessible name for screen readers. | `renderProps` | discoverability, accessibility |
| Tool buttons showed the active tool by colour and shape, but gave **no state to assistive technology** (`aria-pressed`, `aria-expanded` were missing). | `renderToolbar` | accessibility |
| Escape cleared the selection and closed menus in one go. Side panels ignored Escape. | `bindKeys` | interaction rule |
| Moving or copying things to another page had no route except Copy and Paste. | — | missing workflow |
| A teacher who changes the toolbar to few buttons left a large unused gap in the middle of the bar. | toolbar layout | space |
| Toolbar buttons are 34 px (compact) on tablets and about 29 px on 1366 px laptops. The owner prefers compact; the redesign brief proposes 44–48 px. | `ui/scale.ts` | conflict, see section 6 |

Not found: any feature in the code without a place in the new interface. The one dead feature (PNG export) got one.

## 2. Responsibility groups and where they live now

The six groups of the brief are responsibilities, not six bars. This is how they are placed today (**built**).

| Group | Primary home | Also reachable from |
|---|---|---|
| A. Document | name button (top left) → My notebooks; Menu ▸ Notebooks, New, Save notebook, Open file, PDF, PowerPoint, Save PDF, **Save picture**; the Saved pill (top right) | Ctrl+S |
| B. Core tool dock | bottom-left bar: Select, Hand, Pen, Eraser, Shapes, Text (Fill, Tape, Laser optional); bottom-right bar: Undo, Redo | keys V P E S T, Ctrl+Z / Y |
| C. Insert | `+` button: Picture, PDF, PowerPoint, Table, Graph, New page, Paste | Menu ▸ PDF / PowerPoint |
| D. Pages | page arrows with "n / N"; Pages panel (thumbnails, new page, up/down, copy/paste/delete page); All-pages grid | PageUp / PageDown; **Move / Copy to page** in the selection bar; drag onto a thumbnail |
| E. Contextual properties | colour and thickness bar above the toolbar (pen and shapes); selection bar beside the selected thing; pen / eraser / shape menus on a second tap | — |
| F. Settings and help | Menu ▸ Settings (stylus, palm, scribble, hold shapes, **Large buttons**), Edit toolbar, Privacy, Terms | — |

Rules (**built** unless marked):

1. Core tool positions never change by themselves.
2. A tool button selects the tool. A second tap on a tool that has options opens its menu. Choosing a colour or size does not change tool or selection.
3. Escape closes one layer at a time: an open menu, then the Pages panel (when nothing is selected), then the selection.
4. A tap on empty board closes the Pages panel. A tap that selects something keeps it, so the thing can be carried to a page.
5. Menus that were opened from the floating hexagon open at the toolbar, always in the same place.
6. Delete page asks for a second tap. "Clear page" in the eraser menu already needs a deliberate slide.
7. Move and Copy to a page are one picker with a visible Move / Copy switch; both are one undo step.
8. **Proposed:** a separate "Document" menu for files and a smaller "Settings" menu, so the Menu stops mixing the two.

## 3. Visual tokens (**built** in `src/ui/tokens.css`)

Surfaces, text, border, one accent (`--tk-accent`), danger, spacing steps (4, 8, 12, 16), radius (14, pill), elevation, motion (0.18 s), icon size and stroke, system font stack (no remote fonts), and one focus ring (3 px, with a light halo so it shows on dark surfaces too). New or changed parts use the tokens (name button, Move/Copy switch, armed Delete tile, focus). The older 7,000-line stylesheet still holds the older components; moving them onto the tokens is **proposed** and must be done screen by screen.

## 4. States the interface must show

| State | How it is shown | Built |
|---|---|---|
| Active tool | highlighted pill and underline dot, `aria-pressed` | yes |
| Menu open | pressed look, `aria-expanded` | yes |
| Pen colour and size | the colour dot on the pen button, the colour bar | yes |
| Selected thing | handles and the selection bar | yes |
| Current page | "n / N", highlighted thumbnail | yes |
| Undo / redo available | buttons dim when not available | yes |
| Saving / Saved / Not saved | the pill; "Saved" only after the write is confirmed (`autosave.ts`) | yes |
| Editing vs sliding the board | Hand button pressed (`aria-pressed`) | yes |
| Move vs Copy | switch with text and pressed state, not only colour | yes |

## 5. Responsive behaviour

Same groups on every device; only the arrangement changes.

* Wide screens (laptop, board): two toolbar halves on the bottom edge; the free line between them holds the colour bar and, when a subject is chosen, its dock. With fewer buttons the dock and colour bar grow to fill the space.
* Tablet: same, with the dock and colour bar shrinking in steps; they stack above the toolbar if the line is too short.
* Phone: toolbar in two full-width rows; the colour bar and dock sit above them.
* Boards and fingers: **Settings ▸ Large buttons** (about 1.5×). Off by default so that the compact look the owner prefers does not change.

## 6. Decisions that need the owner

1. **Button size.** The brief proposes a 44–48 px goal. The owner has said twice that the compact size was right. I kept compact as the default and added Large buttons as a choice. Please decide whether Large should become the default on touch screens.
2. **A separate Document menu** (proposed in section 2, rule 8) would change where several Menu actions live. Not built; waiting for a decision.
3. **Labels under toolbar icons** on large screens (helps recognition, costs space). Not built.

## 7. Accessibility: what is and is not covered

Built: accessible names for toolbar, menu and selection-bar buttons; `aria-pressed` and `aria-expanded`; one visible focus ring; reduced-motion respected by the new parts; the Move / Copy picker closes with Escape; no essential action is hover-only; every drag has a button alternative (page move: picker; page reorder: Up / Down; line ends: no alternative yet).

Not covered: the canvas itself (drawing on a `<canvas>` is not readable by a screen reader; there is no text alternative for ink), full keyboard operation of the drawing tools, and a contrast audit of the older stylesheet. A scan with axe is **pending** (see TEST-LOG.md). Real screen-reader testing was not done.
