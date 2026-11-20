// Phones: the notebook library and dialogs fit a small screen (landscape ~340 px tall, portrait ~412 px wide).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  for (const [w, h, n] of [[770, 344, 'phone on its side'], [915, 412, 'big phone on its side'], [412, 915, 'phone upright']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(process.env.URL || 'http://localhost:5173/');
    await page.waitForTimeout(1500);
    await page.click('[data-pop=menu]');
    await page.waitForTimeout(300);
    await page.click('.mt-tile[data-act=library]');
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const side = document.querySelector('.lib-side').getBoundingClientRect();
      const t = getComputedStyle(document.querySelector('.lib-title'));
      const row = document.querySelector('.ls-item').getBoundingClientRect();
      return { side: Math.round(side.width), title: parseFloat(t.fontSize), row: Math.round(row.height), wide: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    if (h < 520) check(`${n}: a narrow side list with small rows and a small title`, m.side <= 230 && m.row <= 38 && m.title <= 24, JSON.stringify(m));
    else check(`${n}: the lists are one slim row across the top, a smaller title`, m.side >= w - 20 && m.row <= 40 && m.title <= 26, JSON.stringify(m));
    check(`${n}: nothing sticks out sideways`, !m.wide);
    await page.click('.lib-new');
    await page.waitForTimeout(600);
    const go = await page.$('.nn-box button[type=submit], .nn-box .dl-go');
    if (go) await go.scrollIntoViewIfNeeded();
    const g = go && (await go.boundingBox());
    check(`${n}: the New notebook box fits (its Create button can be reached and is full height)`, !!g && g.y >= 0 && g.y + g.height <= h + 1 && g.height >= 40, JSON.stringify(g));
    check(`${n}: no page errors`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await b.close();
  finish();
})();
