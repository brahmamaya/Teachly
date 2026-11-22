// The Pages panel: swipe it to the right and it follows the finger and goes away; a short swipe springs back;
// up / down only scrolls. It also opens and closes softly (slides in from the side).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1600);
  const cdp = await ctx.newCDPSession(page);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const open = async () => {
    await page.click('[data-act=pages]');
    await page.waitForTimeout(700);
  };
  const swipe = async (dx, dy, steps = 12) => {
    const r = await (await page.$('.pages-panel .pages-head')).boundingBox();
    const x = r.x + r.width / 2, y = r.y + r.height + 60;
    await tp('touchStart', x, y);
    let mid = null;
    for (let i = 1; i <= steps; i++) {
      await tp('touchMove', x + (dx * i) / steps, y + (dy * i) / steps);
      if (i === Math.round(steps / 2)) mid = await page.evaluate(() => document.querySelector('.pages-panel')?.style.translate || '');
    }
    await tp('touchEnd');
    await page.waitForTimeout(600);
    return mid;
  };
  await open();
  const o = await page.evaluate(() => getComputedStyle(document.querySelector('.pages-panel')).animationDuration);
  check('the panel slides in softly (about half a second)', parseFloat(o) >= 0.45, o);
  const mid = await swipe(260, 6);
  check('swiping right: the panel follows the finger', /^\d+(\.\d+)?px/.test(mid) && parseFloat(mid) > 60, mid);
  check('…and once let go it slides away (closed)', !(await page.$('.pages-panel:not(.leaving)')));
  await open();
  await swipe(50, 0, 10);
  check('a short swipe springs back (still open)', !!(await page.$('.pages-panel:not(.leaving)')));
  await swipe(0, 160);
  check('up / down does not close it', !!(await page.$('.pages-panel:not(.leaving)')));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
