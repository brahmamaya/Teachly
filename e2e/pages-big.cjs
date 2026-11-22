// A notebook of thousands of pages: the Pages panel opens and closes at once (only the pages near the view are made),
// scrolling reaches every page, and tapping one opens it. Measured on a 4x slower CPU.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const s = window.__teachly.store;
    const p = s.page;
    s.commit(Array.from({ length: 3000 }, (_, i) => ({ ...p, id: 'big' + i, els: [] })), 0);
  });
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const longest = async (fn) => {
    await page.evaluate(() => {
      window.__g = 0;
      let l = performance.now();
      const f = (t) => {
        window.__g = Math.max(window.__g, t - l);
        l = t;
        window.__r = requestAnimationFrame(f);
      };
      window.__r = requestAnimationFrame(f);
    });
    await fn();
    await page.waitForTimeout(900);
    return page.evaluate(() => (cancelAnimationFrame(window.__r), Math.round(window.__g)));
  };
  const g1 = await longest(() => page.click('[data-act=pages]'));
  const made = await page.$$eval('.pages-list .page-thumb', (n) => n.length);
  check('3000 pages: the Pages panel opens without a freeze (4x slower CPU)', g1 < 250, `longest frame ${g1} ms`);
  check('…only the pages near the view are made', made > 5 && made < 80, `${made} made`);
  // a finger slides the list down a long way (past the made pages): it keeps moving the whole way
  {
    const r = await (await page.$('.pages-list')).boundingBox();
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const x = r.x + r.width / 2;
    let total = 0;
    for (let round = 0; round < 6; round++) {
      const y = r.y + r.height * 0.85;
      await tp('touchStart', x, y);
      for (let i = 1; i <= 12; i++) await tp('touchMove', x, y - i * 30);
      await tp('touchEnd');
      await page.waitForTimeout(150);
    }
    total = await page.evaluate(() => document.querySelector('.pages-list').scrollTop);
    const shown = await page.$$eval('.pages-list .page-thumb', (n) => n.map((e) => Number(e.dataset.i)));
    check('a finger slides the list a long way down (not stuck, no sorting started)', total > 1500 && !(await page.$('.pages-list.sorting')), `scrolled ${Math.round(total)} px`);
    check('…and the pages there are made', shown.length > 5 && Math.min(...shown) > 5, `${Math.min(...shown)}–${Math.max(...shown)}`);
  }
  await page.evaluate(() => {
    const l = document.querySelector('.pages-list');
    l.scrollTop = l.scrollHeight;
  });
  await page.waitForTimeout(800);
  const last = await page.$('.page-thumb[data-i="2999"]');
  check('scrolling to the end shows the last page', !!last);
  await last.click();
  await page.waitForTimeout(500);
  check('tapping it opens page 3000', (await page.evaluate(() => window.__teachly.store.index)) === 2999);
  const g2 = await longest(() => page.click('[data-act=pages]'));
  check('closing is instant too', g2 < 250, `longest frame ${g2} ms`);
  // All pages (Expand) as well
  await page.click('[data-act=pages]');
  await page.waitForTimeout(700);
  const g3 = await longest(() => page.click('[data-pg=expand]'));
  const items = await page.$$eval('.pgs-item', (n) => n.length);
  check('All pages (Expand) opens without a freeze, only the rows near the view made', g3 < 350 && items < 200, `longest frame ${g3} ms, ${items} made`);
  check('…showing the open page', await page.evaluate(() => { const c = document.querySelector('.pgs-n.cur'); if (!c) return false; const r = c.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }));
  const g4 = await longest(() => page.click('[data-pg=close]'));
  check('…and closes at once', g4 < 250, `longest frame ${g4} ms`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
