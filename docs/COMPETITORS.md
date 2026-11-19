# Teachly vs GoodNotes, Notability, Noteful

Research date: 20 Nov 2026 (web search only; I did not install or test those apps). Statements about other apps come from reviews
and comparison pages, so treat them as hints, not facts: goodnotes.com/blog/goodnotes-vs-notability, setapp.com/app-reviews/goodnotes-vs-notability,
tapsmart.com/apps/noteful-review, 8bitvoid.substack.com (Noteful features).

## What they are known for
- **GoodNotes:** nested folders, many templates, handwriting search, spell-check / word prompts, real-time collaboration, many platforms.
- **Notability:** audio recording tied to the notes, many templates (planners, calendars), flashcards (paid).
- **Noteful:** Pencil-first feel, pen presets, lasso move/resize, double-tap to eraser, tags (paid), no handwriting search, local only.

## Where Teachly already matches or leads
Lasso select/move/resize/rotate, 4 pen kinds, eraser (part/object/area), 21 shapes with hold-to-snap, text and tables, PDF/PowerPoint/pictures,
PDF export, lesson recording, stylus palm rejection, folders/favourites/trash, autosave with honest status, classroom tools (ruler, protractor,
compass, timer, spotlight, magnifier, graphing, calculator, picker, scoreboard), a Physics subject helper, free and no login, data stays on the device.

## Done in this pass
- **My pens:** four saved pens (kind, colour, thickness, steadiness) in the pen menu (Noteful / GoodNotes style presets). Test: `e2e/pen-presets.cjs`.
- Faster saving and no atkas while writing (see the responsiveness work), and a calmer look (`src/ui/look.css`).

## Honest gaps (not done, need decisions or big work)
| Gap | Why it matters | Cost / risk |
|---|---|---|
| Handwriting search | GoodNotes' best-known feature | Needs on-device handwriting recognition (big model, slows phones); privacy-safe only if fully local |
| Nested folders | Teachers with many classes | Medium: library data format change |
| Page templates (planner, lined, Cornell, graph) | Notability / GoodNotes lead | Medium; patterns exist, templates do not |
| Real-time collaboration, cloud sync | GoodNotes | Conflicts with "no data leaves the device"; not planned |
| Pencil double-tap / squeeze | Apple only | Not available in a browser or Android WebView |
| Zoom window (write in a magnified box) | Fine writing on a big board | Medium |
| Tags, outline, bookmarks | Navigation of long notebooks | Medium |

## Suggested order
1. Page templates (small, very visible). 2. Zoom window. 3. Nested folders. 4. Outline / bookmarks. Handwriting search only if the owner accepts a large local model.
