// Local performance baseline (headless Chromium in this container: a LOCAL measurement, not field INP and not a real tablet).
//  A. toolbar: finger/mouse down -> tool changed and first frame shown
//  B. continuous writing: how long each synthetic pointer sample takes to reach the next frame, and dropped frames
//  C. page switching: store.goTo -> next frame
//  D. saving: edit -> "Saved" confirmed by the real autosave
// Usage: node e2e/perf-baseline.cjs   (dev server on :5173)  -> prints a Markdown table
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5173/';
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
const f = (n) => (Number.isFinite(n) ? n.toFixed(1) : 'n/a');
(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const [label, lite, rate] of [['full', false, 1], ['full, CPU x4', false, 4], ['lite, CPU x4', true, 4]]) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
    const page = await ctx.newPage();
    if (lite) await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
    await page.goto(URL);
    await page.waitForTimeout(1500);
    // a document with some weight: 3 pages, 400 strokes each
    await page.evaluate(() => {
      const { store } = window.__teachly;
      for (let p = 0; p < 3; p++) {
        if (p) store.addPage();
        store.goTo(p);
        const els = [];
        for (let i = 0; i < 400; i++) { const pts = []; const x = Math.random() * 1400, y = Math.random() * 800; for (let k = 0; k < 30; k++) pts.push(x + k * 4, y + Math.sin(k / 3) * 14, 0.5); els.push({ id: `p${p}s${i}`, type: 'path', pts, style: 'pen', color: '#ffffff', size: 3, opacity: 1 }); }
        store.addEls(els);
      }
      store.goTo(0);
    });
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    // A. toolbar
    const tool = await page.evaluate(async () => {
      const ids = ['select', 'pen', 'eraser', 'text', 'tape', 'laser', 'fill'];
      const out = [];
      for (let i = 0; i < 28; i++) {
        const id = ids[i % ids.length];
        const btn = document.querySelector(`.tb-left [data-tool="${id}"]`);
        if (!btn || window.__teachly.store.tool.tool === id) continue;
        const t0 = performance.now();
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch', button: 0 }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (window.__teachly.store.tool.tool === id) out.push(performance.now() - t0);
        btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch', button: 0 }));
        await new Promise((r) => setTimeout(r, 40));
      }
      return out;
    });
    // B. writing: 240 pointer samples with the pen tool, frame gaps measured by rAF
    await page.click('[data-tool=pen]');
    await page.waitForTimeout(300);
    const frames = await page.evaluate(() => { window.__gaps = []; let last = performance.now(); const tick = () => { const n = performance.now(); window.__gaps.push(n - last); last = n; window.__raf = requestAnimationFrame(tick); }; window.__raf = requestAnimationFrame(tick); });
    const board = await page.evaluate(() => { const r = window.teachly.board.el.getBoundingClientRect(); return [r.left, r.top]; });
    const t0 = Date.now();
    await page.mouse.move(board[0] + 300, board[1] + 300);
    await page.mouse.down();
    for (let i = 0; i < 240; i++) await page.mouse.move(board[0] + 300 + i * 3, board[1] + 300 + Math.sin(i / 12) * 80);
    await page.mouse.up();
    const writeMs = Date.now() - t0;
    const gaps = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__gaps.slice(2); });
    const dropped = gaps.filter((g) => g > 33).length;
    const stroke = await page.evaluate(() => { const els = window.__teachly.store.page.els; const e = els[els.length - 1]; return { pts: e.pts.length / 3 }; });
    // C. page switching
    const sw = await page.evaluate(async () => {
      const { store } = window.__teachly;
      const out = [];
      for (let i = 0; i < 30; i++) {
        const t = performance.now();
        store.goTo(i % 3);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        out.push(performance.now() - t);
      }
      return out;
    });
    // D. saving
    const save = await page.evaluate(async () => {
      const { store, autosave } = window.__teachly;
      const out = [];
      for (let i = 0; i < 5; i++) {
        const t = performance.now();
        store.addEls([{ id: 'sv' + i + Math.random(), type: 'text', text: 'x', color: '#fff', fontSize: 30, x: 100, y: 100 + i * 40, w: 20, h: 36, rot: 0 }]);
        await autosave.saveNow();
        out.push(performance.now() - t);
      }
      return out;
    });
    rows.push({ label, tool, gaps, dropped, writeMs, stroke, sw, save });
    await ctx.close();
  }
  await b.close();
  console.log('| Scenario (1366x768, 1200 strokes) | A tool: p50 / p95 ms | B frame gap p50 / p95 / max ms | B frames >33 ms | B stroke points kept (of 240) | C page switch p50 / p95 ms | D save confirmed p50 / max ms |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.label} | ${f(pct(r.tool, 0.5))} / ${f(pct(r.tool, 0.95))} (n=${r.tool.length}) | ${f(pct(r.gaps, 0.5))} / ${f(pct(r.gaps, 0.95))} / ${f(Math.max(...r.gaps))} | ${r.dropped} of ${r.gaps.length} | ${r.stroke.pts} | ${f(pct(r.sw, 0.5))} / ${f(pct(r.sw, 0.95))} | ${f(pct(r.save, 0.5))} / ${f(Math.max(...r.save))} |`);
})();
