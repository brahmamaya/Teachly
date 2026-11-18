// Library (My notebooks): Favorites, New button, layouts on desktop / iPad / phone.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, touch] of [['desk', 1280, 800, false], ['ipad', 820, 1180, true], ['phone', 390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1800);
    await page.click('[data-pop=menu]');
    await page.waitForTimeout(300);
    await page.click('[data-act=library]');
    await page.waitForTimeout(800);
    check(name + ': library opens with Favorites and New', !!(await page.$('.library .ls-item[data-v=fav]')) && !!(await page.$('.lib-new')));
    await page.screenshot({ path: d + 'lib-' + name + '.png' });
    if (await page.$('.nb-card:not(.nb-new)')) {
      await page.click('.nb-card:not(.nb-new) .nb-star');
      await page.waitForTimeout(500);
      check(name + ': star marks a favourite', (await page.$$eval('.nb-star.on', (a) => a.length)) === 1);
      await page.click('.ls-item[data-v=fav]');
      await page.waitForTimeout(500);
      check(name + ': Favorites view lists it', (await page.$$('.nb-card:not(.nb-new)')).length === 1);
    } else check(name + ': a notebook card exists', false);
    check(name + ': no errors', errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await b.close();
  finish();
})();
