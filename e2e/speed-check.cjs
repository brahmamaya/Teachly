// Settings > Check writing speed: measures while the teacher writes and shows the result with the facts about this
// device (screen, drawing size, browser, cores); nothing is sent anywhere. The card closes softly.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 800 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], reqs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => { if (!r.url().startsWith('http://localhost')) reqs.push(r.url()); });
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(1800);
  await p.tap('[data-pop=menu]');
  await p.waitForTimeout(400);
  await p.tap('.mt-settings summary');
  await p.waitForTimeout(300);
  await p.tap('[data-act=speedcheck]');
  await p.waitForTimeout(400);
  check('it asks the teacher to write', /Write on the board/.test(await p.textContent('.speed-card')));
  const cdp = await ctx.newCDPSession(p);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  for (let s = 0; s < 6; s++) {
    await tp('touchStart', 300 + s * 100, 400);
    for (let i = 1; i < 15; i++) await tp('touchMove', 300 + s * 100 + i * 4, 400 + i * 10);
    await tp('touchEnd');
  }
  await p.waitForTimeout(6500);
  const text = await p.textContent('.speed-card');
  check('the result shows how smooth it was and this device\'s facts', /Smooth|uneven|Slow/.test(text) && /Frames/.test(text) && /Drawing size/.test(text) && /Browser/.test(text) && /samples/.test(text), text.replace(/\s+/g, ' ').slice(0, 200));
  check('the writing still went onto the page', (await p.evaluate(() => window.__teachly.store.page.els.length)) === 6);
  await p.tap('[data-sp-close]');
  await p.waitForTimeout(400);
  check('Close takes it away', !(await p.$('.speed-card')));
  check('nothing was sent anywhere', reqs.length === 0, reqs.join(' '));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
