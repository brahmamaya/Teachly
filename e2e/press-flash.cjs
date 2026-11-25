// A tap on any toolbar button shows its teal on screen, even on a slow board where the button's work (a new page,
// undo on a full page) keeps the app busy for a moment: the teal stays for at least a few drawn frames.
// Counted in frames that were drawn (requestAnimationFrame runs right before each frame is painted).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(1800);
  // a full page of writing (undo and a new page then take a moment on a slow board)
  await p.evaluate(() => {
    const { store } = window.__teachly;
    const els = [];
    for (let i = 0; i < 3000; i++) { const pts = []; const x = Math.random() * 1800, y = Math.random() * 1000; for (let k = 0; k < 40; k++) pts.push(x + k * 3, y + Math.sin(k / 3) * 12, 0.5); els.push({ id: 'w' + i, type: 'path', pts, style: 'pen', color: '#ffffff', size: 3, opacity: 1 }); }
    store.addEls(els);
  });
  await p.waitForTimeout(600);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  for (const sel of ['[data-act=undo]', '[data-act=redo]', '[data-act=next]', '[data-act=prev]']) {
    const el = await p.$(sel);
    if (!el || !(await el.isEnabled())) continue;
    await p.evaluate((s) => {
      window.__f = 0;
      const btn = document.querySelector(s);
      const t0 = performance.now();
      const f = () => {
        const c = getComputedStyle(btn).backgroundColor;
        if (/15, 159, 144/.test(c)) window.__f++;
        if (performance.now() - t0 < 2500) window.__r = requestAnimationFrame(f);
      };
      window.__r = requestAnimationFrame(f);
    }, sel);
    await el.tap();
    await p.waitForTimeout(2800);
    const frames = await p.evaluate(() => window.__f);
    check(`${sel}: its teal is on screen for at least 3 drawn frames (6x slower CPU, full page)`, frames >= 3, `${frames} frames`);
  }
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
