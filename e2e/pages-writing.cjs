// Writing with the Pages panel open on a classroom board (lite, 4x slower CPU): the panel is not remade after every
// line (that made the ink stall); it catches up once the writing pauses, showing the new line in the page's picture.
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
  await p.evaluate(() => window.__teachly.store.setTool({ tool: 'pen' }));
  await p.tap('[data-act=pages]');
  await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => {
    window.__made = 0;
    new MutationObserver(() => window.__made++).observe(document.querySelector('.pages-panel') || document.querySelector('.pages-list').parentElement, { childList: true });
  });
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  for (let s = 0; s < 8; s++) {
    const x0 = 500 + s * 90, y0 = 400;
    await tp('touchStart', x0, y0);
    for (let i = 1; i <= 8; i++) await tp('touchMove', x0 + i * 6, y0 + i * 8);
    await tp('touchEnd');
  }
  const during = await p.evaluate(() => window.__made);
  await p.waitForTimeout(2500);
  const after = await p.evaluate(() => window.__made);
  const n = await p.evaluate(() => window.__teachly.store.page.els.length);
  check('all 8 lines were written', n === 8, String(n));
  check('the Pages panel is not remade while writing', during <= 1, `${during} times`);
  check('…and catches up once the writing pauses', after > during, `${during} -> ${after}`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
