// Calculator: with the toolbar at the top its title is never hidden under the bar, a finger can move it by touching it
// anywhere (even on a key, without pressing that key), and a plain tap on a key still types it.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(1800);
  await p.evaluate(() => window.__teachly.store.setSettings({ tbPos: 'top', tbY: undefined, tbAlign: 'middle' }));
  await p.setViewportSize({ width: 1181, height: 820 });
  await p.waitForTimeout(200);
  await p.setViewportSize({ width: 1180, height: 820 });
  await p.waitForTimeout(500);
  await p.tap('[data-pop=tools]');
  await p.waitForTimeout(500);
  await p.tap('.popover [data-act=calc]');
  await p.waitForTimeout(700);
  const r = () => p.evaluate(() => {
    const h = document.querySelector('.panel .panel-head').getBoundingClientRect();
    const bar = Math.max(...[...document.querySelectorAll('.toolbars .toolbar')].map((e) => e.getBoundingClientRect().bottom));
    return { head: h.top, x: h.left, bar, expr: document.querySelector('.calc-expr').value };
  });
  const a = await r();
  check('the title sits below the top toolbar (not hidden)', a.head >= a.bar, JSON.stringify(a));
  const cdp = await ctx.newCDPSession(p);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const k = await (await p.$('.calc-k[data-k="7"]')).boundingBox();
  const x = k.x + k.width / 2, y = k.y + k.height / 2;
  await tp('touchStart', x, y);
  for (let i = 1; i <= 10; i++) await tp('touchMove', x + i * 25, y - i * 5);
  await tp('touchEnd');
  await p.waitForTimeout(300);
  const m = await r();
  check('touching a key and sliding moves the calculator', Math.abs(m.x - a.x - 250) < 6, JSON.stringify(m));
  check('…without pressing that key', m.expr === a.expr, JSON.stringify(m.expr));
  await p.waitForTimeout(1200);
  await p.tap('.calc-k[data-k="7"]');
  await p.waitForTimeout(200);
  check('a plain tap on a key still types it', (await r()).expr.endsWith('7'));
  // dragged up into the toolbar: it stops below the bar
  const hd = await (await p.$('.panel .panel-head')).boundingBox();
  await tp('touchStart', hd.x + 60, hd.y + 10);
  for (let i = 1; i <= 10; i++) await tp('touchMove', hd.x + 60, hd.y + 10 - i * 40);
  await tp('touchEnd');
  await p.waitForTimeout(300);
  const u = await r();
  check('dragged up, the title stops below the toolbar', u.head >= u.bar - 1, JSON.stringify(u));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
