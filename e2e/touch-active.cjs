// Phones and tablets: tapping a tool leaves only the clean blue marker behind it (no grey "hover" patch over it),
// and the marker sits exactly on the button with the same round corners.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1500);
  for (const t of ['eraser', 'shape', 'select', 'pen']) {
    await page.tap(`.tb-left .tb-btn[data-tool=${t}]`);
    await page.waitForTimeout(600);
    if (await page.$('.popover')) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    const m = await page.evaluate(() => {
      const ind = document.querySelector('.tb-left .tb-ind'), a = document.querySelector('.tb-left .tb-btn.active');
      const i = ind.getBoundingClientRect(), r = a.getBoundingClientRect();
      const greys = [...document.querySelectorAll('.tb-left .tb-btn:not(.open)')].filter((x) => getComputedStyle(x).backgroundColor !== 'rgba(0, 0, 0, 0)').length;
      return { off: Math.round(Math.abs(i.left - r.left) + Math.abs(i.top - r.top) + Math.abs(i.width - r.width)), same: getComputedStyle(ind).borderTopLeftRadius === getComputedStyle(a).borderTopLeftRadius, greys };
    });
    check(`${t}: the blue marker is exactly on the button, same corners, no grey patch left on any button`, m.off <= 1 && m.same && m.greys === 0, JSON.stringify(m));
  }
  await b.close();
  finish();
})();
