// Flip buttons for shapes, no "Graph from an equation" in the shape menu, compact colour panel and selection bar.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.click('[data-tool=eraser]');
  await page.click('[data-tool=shape]');
  await page.waitForTimeout(500);
  check('shape menu has no "Graph from an equation"', !(await page.$('.popover [data-act=graph]')));
  const cb = await page.$eval('.popover .n3-colors', (e) => e.getBoundingClientRect().height);
  const pb = await page.$eval('.popover', (e) => e.getBoundingClientRect().height);
  check('colour panel is shorter than the whole menu (no big empty block)', cb < pb - 20, `${Math.round(cb)} vs ${Math.round(pb)}`);
  await page.screenshot({ path: d + 'shape-menu.png' });
  // a triangle: pointing up, apex on the left side so a flip is visible
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const { store } = window.__teachly;
    store.addEls([{ id: 't1', type: 'path', pts: [300, 400, 0.5, 500, 400, 0.5, 300, 200, 0.5], style: 'shape', color: '#ef4444', size: 4, opacity: 1, closed: true, fill: '#ef4444' }]);
    store.setTool({ tool: 'select' });
    store.select(['t1']);
  });
  await page.waitForTimeout(400);
  check('flip buttons show for a shape', !!(await page.$('[data-pact=flipx]')) && !!(await page.$('[data-pact=flipy]')));
  const pts = () => page.evaluate(() => Array.from(window.__teachly.store.page.els.find((e) => e.id === 't1').pts));
  const p0 = await pts();
  await page.click('[data-pact=flipx]');
  await page.waitForTimeout(200);
  const p1 = await pts();
  check('left-right flip mirrors x around the middle, y unchanged', Math.abs(p1[0] - 500) < 0.01 && Math.abs(p1[3] - 300) < 0.01 && Math.abs(p1[6] - 500) < 0.01 && p1[1] === p0[1] && p1[7] === p0[7], JSON.stringify(p1));
  await page.click('[data-pact=flipy]');
  await page.waitForTimeout(200);
  const p2 = await pts();
  check('up-down flip mirrors y around the middle', Math.abs(p2[1] - 200) < 0.01 && Math.abs(p2[7] - 400) < 0.01 && Math.abs(p2[0] - p1[0]) < 0.01, JSON.stringify(p2));
  await page.evaluate(() => { window.__teachly.store.undo(); window.__teachly.store.undo(); });
  await page.waitForTimeout(150);
  const p3 = await pts();
  check('two undos give back the original', JSON.stringify(p3) === JSON.stringify(p0));
  const bar = await page.$eval('.props .props-row', (e) => e.getBoundingClientRect().height);
  const n = await page.$$eval('.props .pv-btn', (a) => a.length);
  check('selection bar is compact (about 40px per option)', bar / n < 46, `${Math.round(bar)}px for ${n}`);
  await page.screenshot({ path: d + 'sel-bar.png' });
  // text / pictures do not get flip buttons
  await page.evaluate(() => { const { store } = window.__teachly; store.addEls([{ id: 'x1', type: 'text', text: 'hi', color: '#fff', fontSize: 40, x: 600, y: 300, w: 80, h: 50, rot: 0 }]); store.select(['x1']); });
  await page.waitForTimeout(300);
  check('no flip buttons for text', !(await page.$('[data-pact=flipx]')));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
