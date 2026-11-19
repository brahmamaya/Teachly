// "Ink ahead of the pen" (off by default): a short guessed bit is drawn on the overlay only, never stored in the stroke.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1800);
  // The browser would give predicted points ahead of the pen: fake them (30 px further along x).
  await page.evaluate(() => {
    PointerEvent.prototype.getPredictedEvents = function () { return [{ clientX: this.clientX + 30, clientY: this.clientY, pressure: 0.5 }]; };
  });
  const cdp = await ctx.newCDPSession(page);
  const press = (x, y) => cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  const move = (x, y) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, pointerType: 'pen' });
  const up = (x, y) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, pointerType: 'pen' });
  // pixels painted on the overlay layer in a strip just ahead of the pen
  const ahead = () => page.evaluate(() => {
    const c = window.teachly.board.overlay, g = c.getContext('2d'), k = c.width / c.getBoundingClientRect().width;
    const r = c.getBoundingClientRect();
    const x = Math.round((500 + 15 - r.left) * k), y = Math.round((300 - r.top) * k);
    const d = g.getImageData(x - 3, y - 6, 6, 12).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    return n;
  });
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'pen', penStyle: 'pen', color: '#ffffff', size: 6 }));
  for (const [label, on] of [['off', false], ['on', true]]) {
    await page.evaluate((v) => window.__teachly.store.setSettings({ inkPredict: v }), on);
    await press(400, 300);
    for (let x = 410; x <= 500; x += 10) await move(x, 300);
    await page.waitForTimeout(120);
    const n = await ahead();
    if (on) check('on: a guessed bit is drawn ahead of the pen on the overlay', n > 5, `${n} px`);
    else check('off (default): nothing is drawn ahead of the pen', n === 0, `${n} px`);
    await up(500, 300);
    await page.waitForTimeout(150);
    const last = await page.evaluate(() => { const e = window.__teachly.store.page.els; const l = e[e.length - 1]; const bd = window.teachly.board, r = bd.el.getBoundingClientRect(); let m = 0; for (let i = 0; i < l.pts.length; i += 3) m = Math.max(m, bd.toScreen(l.pts[i], l.pts[i + 1])[0] + r.left); return { n: e.length, maxX: m }; });
    check(`${label}: the stored stroke ends where the pen really ended (the guess is not saved)`, last.maxX <= 503, JSON.stringify(last));
    check(`${label}: nothing is left ahead of the pen after lifting`, (await ahead()) === 0);
  }
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
