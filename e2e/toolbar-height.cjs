// Edit toolbar > Height: dragging the slider moves the bar, and it STAYS at that height after the finger lifts
// (it used to jump back to the edge), also after a reload; "Stick to the … edge" puts it on the nearer edge.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/'); await p.waitForTimeout(1800);
  await p.evaluate(() => window.__teachly.store.setSettings({ tbPos: 'top', tbY: undefined, tbAlign: 'middle' }));
  await p.setViewportSize({ width: 1181, height: 820 }); await p.waitForTimeout(300); await p.setViewportSize({ width: 1180, height: 820 }); await p.waitForTimeout(500);
  await p.tap('[data-pop=menu]'); await p.waitForTimeout(500);
  await p.tap('[data-act=tbedit]'); await p.waitForTimeout(600);
  const pos = () => p.evaluate(() => ({ y: window.__teachly.store.settings.tbY, L: document.querySelector('.tb-left').getBoundingClientRect().top, R: document.querySelector('.tb-right').getBoundingClientRect().top, pop: !!document.querySelector('.popover:not(.leaving) [data-tby]'), free: document.querySelector('#app')?.hasAttribute('data-tbfree') }));
  const a = await pos();
  check('at the start the bar touches the top edge', a.L <= 1 && !a.free, JSON.stringify(a));
  const s = await (await p.$('[data-tby]')).boundingBox();
  const cdp = await ctx.newCDPSession(p);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const y = s.y + s.height / 2;
  await tp('touchStart', s.x + 4, y);
  for (let i = 1; i <= 10; i++) { await tp('touchMove', s.x + 4 + i * s.width * 0.05, y); await p.waitForTimeout(30); }
  const m = await pos();
  check('dragging the slider moves the bar down', m.L > 300, JSON.stringify(m));
  await tp('touchEnd'); await p.waitForTimeout(600);
  const e = await pos();
  check('after the finger lifts the bar stays at that height', Math.abs(e.L - m.L) < 2 && e.free, JSON.stringify(e));
  await p.reload();
  await p.waitForTimeout(1800);
  const r = await pos();
  check('…and after a reload', Math.abs(r.L - m.L) < 3, JSON.stringify(r));
  await p.tap('[data-pop=menu]');
  await p.waitForTimeout(500);
  await p.tap('[data-act=tbedit]');
  await p.waitForTimeout(600);
  await p.tap('[data-tbstick]');
  await p.waitForTimeout(700);
  const t = await pos();
  check('"Stick to the … edge" puts it on the nearer edge (here the bottom: it was below the middle)', t.L > 700 && !t.free, JSON.stringify(t));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
