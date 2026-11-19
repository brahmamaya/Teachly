// My notebooks side panel: the measured iPad sidebar look (rows 46 px high with no gap, a pill for the chosen one,
// panel 318 px wide) and a button that hides / shows the list.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1600);
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('.mt-tile[data-act=library]');
  await page.waitForTimeout(1000);
  const g = await page.evaluate(() => {
    const r = (e) => { const x = e.getBoundingClientRect(); return { w: Math.round(x.width), h: Math.round(x.height), t: Math.round(x.top) }; };
    const items = [...document.querySelectorAll('.lib-side .ls-item')].slice(0, 3).map(r);
    const on = getComputedStyle(document.querySelector('.ls-item.on'));
    return { side: r(document.querySelector('.lib-side')), items, radius: on.borderTopLeftRadius, bg: on.backgroundColor, size: on.fontSize, weight: on.fontWeight, color: on.color };
  });
  check('the panel is 318 px wide', g.side.w === 318, JSON.stringify(g.side));
  check('rows are 46 px high and touch each other (no gap)', g.items.every((i) => i.h === 46) && g.items[1].t - g.items[0].t === 46 && g.items[2].t - g.items[1].t === 46, JSON.stringify(g.items));
  check('the chosen row is a pill (23 px corners) in soft grey', g.radius === '23px' && g.bg === 'rgb(56, 56, 58)', `${g.radius} ${g.bg}`);
  check('type is 16 px medium white', g.size === '16px' && g.weight === '500' && g.color === 'rgb(255, 255, 255)', `${g.size} ${g.weight} ${g.color}`);
  await page.click('.lib-side .ls-toggle');
  await page.waitForTimeout(700);
  check('the button at the top of the panel hides the list', !(await page.isVisible('.lib-side')) && (await page.isVisible('.lib-showside')));
  await page.click('.lib-showside');
  await page.waitForTimeout(700);
  check('and a button next to the title brings it back', (await page.isVisible('.lib-side')) && !(await page.isVisible('.lib-showside')));
  await page.click('.ls-item[data-v="trash"]');
  await page.waitForTimeout(400);
  check('choosing Trash still works', (await page.textContent('.lib-title')) === 'Trash');
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
