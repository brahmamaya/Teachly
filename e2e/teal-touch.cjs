// Every toolbar button shows the teal when touched (iPad: Safari has no :active on touch, the app's "pressed" class
// does it), a switched-on button (Slide / Hand) is teal, and a tool whose menu is open stays teal.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const TEAL = 'rgb(15, 159, 144)';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(1800);
  const bg = (sel) => p.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
  const cdp = await ctx.newCDPSession(p);
  for (const sel of ['.tb-left [data-act=slide]', '[data-pop=tools]', '[data-pop=menu]']) {
    const r = await (await p.$(sel)).boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x + r.width / 2, y: r.y + r.height / 2, id: 1 }] });
    await p.waitForTimeout(60);
    const c = await bg(sel);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(`while the finger is on ${sel} it is teal`, c === TEAL, c);
    await p.waitForTimeout(500);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
  }
  check('Slide switched on stays teal', (await bg('.tb-left [data-act=slide]')) === TEAL);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
