# Teachly ✏️ — Interactive Whiteboard for Smart Classrooms

**Teachly** ek smooth, feature-rich interactive whiteboard hai jo smart boards / interactive flat panels (IFP), laptops, tablets aur phones — sab par chalta hai. Yeh **Note 3** (Prestigio / EasiNote family) jaise whiteboard software ke saare core features deta hai, aur unse aage kuch extra cheezein bhi.

> A fast, offline-first, installable (PWA) whiteboard for teachers. No installation, no licence keys — open it in any modern browser (Chrome / Edge on Windows, Android, ChromeOS, Linux, macOS).

---

## 🚀 Quick start

```bash
npm install
npm run dev        # http://localhost:5173  (also on your LAN, so you can open it on the smart board)
npm run build      # production build → dist/
npm run preview    # serve the production build
npm test           # unit tests
```

Smart board par: build ko kisi bhi static host (GitHub Pages, Netlify, school server) par daalo, browser mein kholo, aur **"Install app"** dabao — Teachly full-screen app ki tarah offline chalega.

---

## 🔍 Note 3 ko samajhna — research summary

Note 3 (Prestigio Solutions, EasiNote ka updated version) ek Windows-only whiteboard software hai jo interactive panels ke saath bundle hota hai. Public product pages, reseller listings aur user guides se iske features:

| Note 3 feature | Kya karta hai |
|---|---|
| Multi-touch writing | Fingers ya stylus se likhna; kai log ek saath likh sakte hain |
| Soft pen / brushes | Alag pen styles, colours, thickness; "simulated soft pen" natural writing ke liye |
| Intelligent eraser | Specific part mitana bina baaki content disturb kiye; palm erase |
| Shape recognition | Haath se bani shapes ko perfect square / circle mein badalna |
| Roaming + navigation map | Infinite canvas par ghoomna, mini-map se navigate karna |
| Multi-page | Kai pages, page switching |
| Import | Images, video, audio, PDF board par daalna |
| Subject tools | English, Maths (ruler, protractor, compass, geometry), Chemistry, Physics |
| Teaching tools | Spotlight, screen cover, zoom, clock, timer, countdown |
| Screen recording | Pura session voice ke saath record |
| Gesture toolbars | Customisable / gesture-controlled toolbars, backgrounds |

**Note 3 ki limitations** (jo Teachly theek karta hai): sirf Windows, paid licence per device, offline file format sirf apne software mein khulta hai, aur purane hardware par lag.

Sources: [Prestigio Solutions — Note3](https://prestigio-solutions.com/product/note3-interactive-whiteboard-software), [LOFT TECH — Note 3 Software](https://www.lofttech.com/browse-interactive-displays/note3-software), [ASBIS catalog](https://catalog.asbis.com/product/psnte3), [Ability Infotech](https://abilityinfotech.com/product/note-3-software-for-education-window/), [G2 — Note 3](https://www.g2.com/products/note-3/reviews), [MAXHUB EasiNote 5](https://global-site-v1.maxhub.com/en/en5).

---

## ✅ Feature comparison

| | Note 3 | **Teachly** |
|---|:-:|:-:|
| Smooth pressure-sensitive ink | ✅ | ✅ coalesced + **predicted** pointer events, low-latency canvas, Bezier-smoothed strokes |
| Pen / brush / highlighter | ✅ | ✅ + **Magic ink** (disappears automatically) |
| Laser pointer | ➖ | ✅ glowing fading trail |
| Multi-touch writing | ✅ | ✅ (toggle) |
| Stylus-only mode (finger pans, pen writes) | ➖ | ✅ |
| Eraser: stroke / partial / area | ✅ | ✅ stroke, **partial (splits strokes)**, lasso-area, clear page |
| Palm eraser | ✅ | ✅ auto-detects large touch contact; pen eraser-end supported |
| Shape recognition | ✅ | ✅ **hold-to-snap** (hold pen still) + optional auto mode |
| Shapes incl. 3D | ✅ | ✅ 21 shapes: polygons, arrows, cube, cylinder, cone, sphere, XY axes |
| Infinite canvas + navigation map | ✅ | ✅ pinch-zoom, pan, wheel, minimap |
| Multiple pages + thumbnails | ✅ | ✅ add / duplicate / reorder / delete |
| Backgrounds | ✅ | ✅ 7 colours + custom, grid, dots, ruled, **English 4-line**, graph, music staff, isometric |
| Import images / PDF / video | ✅ | ✅ drag-and-drop, paste, PDF → one page each (locked background) |
| Ruler, set squares, protractor | ✅ | ✅ **pen snaps to edges**, rotate with 15° snapping, protractor needle reading |
| Compass | ✅ | ✅ real two-step compass with radius reuse for constructions |
| Function grapher | ➖ | ✅ multiple functions, editable after insertion |
| Scientific calculator | ➖ | ✅ deg/rad, Ans, factorial |
| Periodic table | ✅ | ✅ all 118 elements, insert element cards |
| Subject library | ✅ | ✅ Physics circuit symbols, Chemistry lab apparatus, Biology, Maths |
| Spotlight / screen cover / magnifier | ✅ | ✅ circle/rect spotlight, 4-direction curtain, live magnifier |
| Timer, stopwatch, clock | ✅ | ✅ big-screen mode, alarm, laps |
| Random name picker, dice, coin | ➖ | ✅ no-repeat mode |
| Scoreboard | ➖ | ✅ up to 6 teams |
| Screen + mic recording | ✅ | ✅ |
| Document camera / screenshot to board | ➖ | ✅ annotate a live camera capture or any window |
| Select, move, scale, rotate, recolour, lock | ✅ | ✅ lasso select, context bar, z-order, lock |
| Undo / redo | ✅ | ✅ 300 steps, including page operations |
| Autosave | ➖ | ✅ IndexedDB, survives refresh / power cut |
| Export | ✅ | ✅ PDF (all pages), PNG, `.teachly` lesson file |
| Platform | Windows only | **Any browser** — Windows, Android panels, ChromeOS, Linux, Mac, tablets; installable & offline |
| Price | Paid licence | Free / open source (MIT) |

---

## ⌨️ Shortcuts

| Keys | Action |
|---|---|
| `V` `P` `E` `S` `T` `L` `H` `C` | Select, Pen, Eraser, Shapes, Text, Laser, Pan, Compass |
| `Space` + drag / middle mouse / two fingers | Move the board |
| `Ctrl` + wheel, pinch, `+` `-` `0` | Zoom |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Ctrl+C` `Ctrl+V` `Ctrl+D` `Del` | Copy, paste, duplicate, delete |
| `PageUp` / `PageDown` | Previous / next page |
| `Ctrl+S` / `Ctrl+O` | Save / open lesson |
| `F` | Full screen |

---

## 🏗️ Architecture

```
src/
  board.ts          Canvas layers (background / ink / live overlay), camera, pointer + gesture routing
  renderer.ts       Stroke outlines (perfect-freehand), shapes, text, images, video, graphs, backgrounds
  store.ts          Immutable document model, structural-sharing undo/redo, settings
  instruments.ts    Ruler, set squares, protractor with edge snapping
  shapes.ts         Shape builder + hand-drawn shape recogniser
  mathexpr.ts       Safe expression parser (no eval) for grapher & calculator
  tools/            pen, eraser, select, text, shape, laser, compass, pan
  widgets/          timer, clock, picker, scoreboard, calculator, grapher, periodic table, subject library, spotlight, curtain, magnifier
  io/               autosave, import (image/PDF/video), export (PDF/PNG), lesson files, recording, camera
  ui/               toolbar, popovers, menu, pages panel, minimap, selection bar
```

**Why it's smooth:** wet ink is drawn on a separate low-latency (`desynchronized`) canvas using every coalesced pointer sample plus predicted points; committed ink lives on its own layer that only re-renders when the document or camera changes, with viewport culling and cached `Path2D` geometry.

## License

MIT
