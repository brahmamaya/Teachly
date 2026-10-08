# Teachly ✏️ — Interactive Whiteboard for Smart Classrooms

**Teachly** ek smooth, feature-rich interactive whiteboard hai jo smart boards / interactive flat panels (IFP), laptops, tablets aur phones — sab par chalta hai. Yeh **Note 3** (Prestigio / EasiNote family) se inspired hai — wahi zaroori features, lekin bahut simple aur aasan.

> A fast, offline-first, installable (PWA) whiteboard for teachers. No installation, no licence keys — open it in any modern browser (Chrome / Edge on Windows, Android, ChromeOS, Linux, macOS).

---

## 🚀 Quick start

```bash
npm install
npm run dev        # http://localhost:5173  (also on your LAN, so you can open it on the smart board)
npm run build      # production build → dist/
npm run preview    # serve the production build
npm test           # unit tests
npm run build:single   # dist-single/Teachly.html — one offline file for pen drives / smart boards
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

## ✅ What Teachly has

Teachly is deliberately simple: one toolbar at the bottom, big buttons, and options only where you need them.

| Toolbar | What it does |
|---|---|
| **Select** | Tap anything to move, resize or rotate it |
| **Pen** | Pen, brush, calligraphy or highlighter; any colour (picker + your recent colours). Hold the pen still at the end of a drawing to turn it into a perfect shape |
| **Eraser** | Erase part of a line or the whole line; rub with your palm; clear the page |
| **Shapes** | 18 shapes including 3D (cube, cylinder, cone, sphere). A new shape stays selected so you can change it straight away |
| **Fill** | Tap inside any shape or hand-drawn loop to colour it |
| **Text** | Tap and type |
| **Tape** | Drag over an answer to hide it; tap the tape to reveal, tap again to hide |
| **Laser** | Glowing pointer trail that fades by itself |
| **Undo / Redo** | Every step, including clearing a page |
| **Insert** | Picture, PDF / book pages, PowerPoint (.pptx) slides, table, new page |
| **Tools** | Ruler and protractor (the pen snaps to their edges), compass, timer, spotlight, screen cover, magnifier, graph plotter (type y = f(x), up to 3 curves, axes and numbers drawn for you), calculator (DEG/RAD, writes the answer on the board), random picker (numbers or student names, no repeats), scoreboard (2–6 teams), **group writing** (many students write at the same time on a touch board) |
| **Menu** | Board colour, 8 templates (plain, grid, lines, 4-line, dots, graph, music, Cornell), My notebooks, record lesson as video (board + voice), open / save file, save as PDF, full screen |

**Change a shape:** tap it, and a bar appears with **Colour**, **Thickness**, **Fill**, **Size − / +**, **Copy** and **Delete**.

**Tables:** pick rows × columns from the grid, type straight away (Tab / Enter moves to the next cell), double-tap any cell later to edit. The bar adds **Rows ± / Columns ±**, **Header** on/off, line colour and cell fill; drag the edges to stretch.

Pinch with two fingers to zoom and move the board. Pages are switched with the arrows at the bottom right. Everything is saved automatically on the device in **My notebooks** — unlimited notebooks, all free. Shapes show cyan dotted guides and snap into line with each other while you move them.

## 🏗️ Architecture

```
src/
  board.ts          Canvas layers (background / ink / live overlay), camera, pointer + gesture routing
  renderer.ts       Stroke outlines (perfect-freehand), shapes, text, images, backgrounds
  store.ts          Immutable document model, structural-sharing undo/redo, settings
  instruments.ts    Ruler and protractor with edge snapping
  shapes.ts         Shape builder + hand-drawn shape recogniser
  tools/            pen, eraser, select, text, shape, compass
  widgets/          timer, spotlight, screen cover
  io/               autosave, import (image/PDF), export (PDF), lesson files
  ui/               toolbar, popovers, properties bar
```

**Why it's smooth:** wet ink is drawn on a separate low-latency (`desynchronized`) canvas using every coalesced pointer sample plus predicted points; committed ink lives on its own layer that only re-renders when the document or camera changes, with viewport culling and cached `Path2D` geometry.

## License

MIT

## 📱 Android app (APK) for digital boards

`android/` wraps the offline single-file build in a tiny full-screen Android
app (Android 7.0+): no internet needed, files open through the board's file
manager (PDF, PowerPoint, pictures), saves go to **Downloads/Teachly**, and
the microphone works for lesson recording.

```bash
KEY=teachly-release.p12 KEY_PASS='…' TOOLS=/path/to/android-tools ./android/build.sh   # → android/build/Teachly.apk
```

`TOOLS` holds jars from Maven Central (apktool-lib — which carries `aapt2` and
the Android framework — dalvik-dx, Robolectric `android-all`, apksig). The
signing key is kept by the owner, outside this repository; always sign with
the same key so new versions install over old ones without losing notebooks.
