// Writing on a classroom board (lite path, 1920x1080, 4x slower CPU, a page already full of writing): a finger writes
// many short strokes quickly, like words on the board. Measured in the page: for every touch sample, the time from the
// event to the frame that shows it (input latency), the longest frame, and the time each lift takes.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, deviceScaleFactor: Number(process.env.DPR || 1) });
  const page = await ctx.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate((style) => {
    const { store } = window.__teachly;
    const els = [];
    for (let i = 0; i < 1500; i++) {
      const pts = [];
      const x = Math.random() * 1800, y = Math.random() * 1000;
      for (let k = 0; k < 40; k++) pts.push(x + k * 3, y + Math.sin(k / 3) * 12, 0.5);
      els.push({ id: 'w' + i, type: 'path', pts, style: 'pen', color: '#ffffff', size: 3, opacity: 1 });
    }
    store.addEls(els);
    store.setTool({ tool: style[1], penStyle: style[0] });
  }, [process.env.STYLE || 'pen', process.env.TOOL || 'pen']);
  await page.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.RATE || 4) });
  await page.evaluate(() => {
    window.__lat = [];
    window.__gap = 0;
    window.__ups = [];
    const pend = [];
    const ov = document.querySelector('canvas.overlay');
    ov.addEventListener('pointermove', (e) => pend.push(e.timeStamp), { capture: true });
    ov.addEventListener('pointerup', () => { const t = performance.now(); requestAnimationFrame(() => window.__ups.push(performance.now() - t)); }, { capture: true });
    let last = performance.now();
    const f = (t) => {
      window.__gap = Math.max(window.__gap, t - last);
      last = t;
      // the frame callback runs before the board's own frame in the same tick; count what was pending
      for (const s of pend.splice(0)) window.__lat.push(t - s);
      window.__r = requestAnimationFrame(f);
    };
    window.__r = requestAnimationFrame(f);
  });
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 2, radiusY: 2 }] });
  const t0 = Date.now();
  for (let s = 0; s < 24; s++) {
    const x0 = 200 + (s % 12) * 120, y0 = 300 + Math.floor(s / 12) * 200;
    await tp('touchStart', x0, y0);
    for (let i = 1; i <= 18; i++) await tp('touchMove', x0 + Math.sin(i / 3) * 40, y0 + i * 5);
    await tp('touchEnd');
  }
  const ms = Date.now() - t0;
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    cancelAnimationFrame(window.__r);
    const s = [...window.__lat].sort((a, b) => a - b);
    const u = [...window.__ups].sort((a, b) => a - b);
    return { n: s.length, p50: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], gap: window.__gap, up50: u[Math.floor(u.length / 2)], upMax: u[u.length - 1], strokes: window.__teachly.store.page.els.length };
  });
  const fx = (n) => Math.round(n);
  console.log(`   ${ms} ms to send; touch→frame p50 ${fx(r.p50)} / p95 ${fx(r.p95)} / max ${fx(r.max)} ms; longest frame ${fx(r.gap)} ms; lift→frame p50 ${fx(r.up50)} / max ${fx(r.upMax)} ms`);
  check('every stroke was kept', r.strokes === 1500 + 24, String(r.strokes));
  check('touch to screen stays quick (p95 under 60 ms on a 4x slower CPU)', r.p95 < 60, `p95 ${fx(r.p95)} ms`);
  check('lifting the finger never freezes the board (under 80 ms)', r.upMax < 80, `max ${fx(r.upMax)} ms`);
  check('no long frame while writing (under 100 ms)', r.gap < 100, `${fx(r.gap)} ms`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
