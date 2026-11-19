// "Block on wedge + hanging block": the hanging block must hang clear of the wedge, not inside it.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__teachly.store.setSettings({ subject: 'phy-11-nlm' }));
  await page.waitForTimeout(600);
  await page.click('.sd-more');
  await page.waitForTimeout(500);
  await page.click('.subj-panel .sp-tile[data-comp="ptwo"]');
  await page.waitForTimeout(500);
  const g = await page.evaluate(() => {
    const { store } = window.__teachly;
    const els = store.page.els.filter((e) => store.selection.has(e.id));
    const wedge = els.find((e) => e.closed && e.surf && e.pts.length === 12);
    const blocks = els.filter((e) => e.closed && e.type === 'path' && e !== wedge && e.pts.length === 15);
    const wx = Math.max(wedge.pts[0], wedge.pts[3], wedge.pts[6]);
    const hanging = blocks.map((e) => ({ minX: Math.min(e.pts[0], e.pts[3], e.pts[6], e.pts[9]), minY: Math.min(e.pts[1], e.pts[4], e.pts[7], e.pts[10]) })).sort((a, b) => b.minY - a.minY)[0];
    return { wedgeRight: wx, blockLeft: hanging.minX };
  });
  check(`the hanging block clears the wedge (block left ${g.blockLeft.toFixed(0)} > wedge right ${g.wedgeRight.toFixed(0)})`, g.blockLeft > g.wedgeRight + 8, JSON.stringify(g));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
