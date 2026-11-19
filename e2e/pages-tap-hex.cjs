// Tap on the board closes the Pages panel; menus opened from the floating hexagon still open at the toolbar.
const { chromium } = require('playwright');
const { check, finish, scr } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const { store } = window.__teachly;
    store.addEls([{ id: 'r1', type: 'text', text: 'hello', color: '#fff', fontSize: 50, x: 300, y: 300, w: 140, h: 70, rot: 0 }]);
  });
  // 1. tap on empty board closes the panel
  await page.tap('[data-act=pages]');
  await page.waitForTimeout(500);
  check('Pages panel is open', !!(await page.$('.pages-panel')));
  await page.tap('[data-tool=pen]');
  await page.mouse.click(700, 250);
  await page.waitForTimeout(500);
  check('a tap on the board closes the panel', !(await page.$('.pages-panel')));
  // 2. a tap that selects a thing keeps it (so the thing can be carried to a page)
  await page.tap('[data-act=pages]');
  await page.waitForTimeout(500);
  await page.tap('[data-tool=select]');
  const [tx, ty] = await scr(page, 370, 335);
  await page.mouse.click(tx, ty);
  await page.waitForTimeout(500);
  check('tapping a thing to select it keeps the panel open', !!(await page.$('.pages-panel')) && (await page.evaluate(() => window.__teachly.store.selection.size)) === 1);
  await page.mouse.click(700, 500);
  await page.waitForTimeout(500);
  check('tapping empty board then closes it', !(await page.$('.pages-panel')));
  // 3. hexagon at the top: the shape menu still opens at the toolbar (bottom)
  await page.evaluate(() => { const { store } = window.__teachly; store.setSettings({ hexItems: ['shape', 'pen'], hexPos: { x: 0.5, y: 0.12 } }); });
  await page.reload();
  await page.waitForTimeout(1800);
  const hex = await page.$('.hexdock [data-tool=shape]');
  check('hexagon has the shape button', !!hex);
  await hex.click();
  await page.waitForTimeout(500);
  const pop = await page.$eval('.popover', (e) => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; });
  const bar = await page.$eval('.tb-left', (e) => e.getBoundingClientRect().top);
  check('shape menu opens just above the toolbar, not up at the hexagon', pop[1] <= bar + 2 && pop[1] > bar - 60 && pop[0] > 200, `menu ${Math.round(pop[0])}-${Math.round(pop[1])}, toolbar top ${Math.round(bar)}`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
