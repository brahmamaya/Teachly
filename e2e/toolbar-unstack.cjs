// The toolbar goes back to ONE line when the screen is wide again (it used to stay stuck in two rows with huge
// buttons after the screen had been narrow once: start-up, rotating an iPad, split view).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 600, height: 1000 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1600);
  const st = () => page.evaluate(() => { const l = document.querySelector('.tb-left').getBoundingClientRect(), r = document.querySelector('.tb-right').getBoundingClientRect(); return { stacked: document.querySelector('#app').classList.contains('tb-stacked'), sameRow: Math.abs((l.top + l.bottom) / 2 - (r.top + r.bottom) / 2) < 6, ui: Number(getComputedStyle(document.documentElement).getPropertyValue('--ui')) }; });
  check('narrow screen: two rows', (await st()).stacked);
  for (const [w, h] of [[1194, 834], [820, 1180], [1366, 1024], [1194, 834]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1300);
    const s = await st();
    const wide = w >= 820;
    check(`${w}x${h}: ${wide ? 'one line' : 'two rows'}, normal button size`, s.stacked === !wide && (wide ? s.sameRow : true) && s.ui <= 1.2, JSON.stringify(s));
  }
  await page.setViewportSize({ width: 600, height: 1000 });
  await page.waitForTimeout(1300);
  check('and back to narrow: two rows again', (await st()).stacked);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
