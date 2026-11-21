// "Put on board" puts the graph where the teacher is looking, also when the board was slid off the page with the
// hand tool (it used to go inside the page, off screen: "Graph added" but nothing to see).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__teachly.store.setTool({ slide: true }));
  for (const [name, cam] of [['on the page', { x: 0, y: 0 }], ['slid below the page', { x: 0, y: 1500 }], ['zoomed into a corner', { x: 1000, y: 700, z: 2 }], ['slid right of the page', { x: 2500, y: 100 }]]) {
    await page.evaluate((cam) => { const bd = window.teachly.board; bd.setCam({ ...bd.cam, ...cam }); const { store } = window.__teachly; store.commit([{ ...store.page, els: [] }], 0); }, cam);
    await page.waitForTimeout(300);
    await page.click('[data-pop=insert]');
    await page.waitForTimeout(300);
    await page.click('.pm-item[data-act=graph]');
    await page.waitForTimeout(700);
    await page.click('text=Line');
    await page.waitForTimeout(200);
    await page.click('[data-put]');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const { store } = window.__teachly, v = window.teachly.board.viewRect();
      let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
      for (const e of store.page.els) if (e.type === 'text') { x1 = Math.min(x1, e.x); y1 = Math.min(y1, e.y); x2 = Math.max(x2, e.x + e.w); y2 = Math.max(y2, e.y + e.h); }
      return { inView: x1 >= v.x - 2 && x2 <= v.x + v.w + 2 && y1 >= v.y - 2 && y2 <= v.y + v.h + 2, n: store.page.els.length };
    });
    check(`${name}: the graph appears on screen`, r.n > 0 && r.inView, JSON.stringify(r));
  }
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
