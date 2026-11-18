const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, touch] of [['desk', 1280, 800, false], ['ipad', 820, 1180, true], ['phone', 390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage(); await page.goto('http://localhost:5173/'); await page.waitForTimeout(1800);
    await page.click('[data-tool=eraser]'); await page.click('[data-tool=pen]'); await page.waitForTimeout(350);
    const vis = await page.$eval('.quickbar', (e) => !e.hidden);
    check(name + ': quick bar shows with the pen', vis);
    await page.click('.qb-c[data-qc="#db0000"]');
    const rb = await page.$eval('.qb-range', (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top + r.height / 2, r.width]; });
    check(name + ': thickness slider is there', rb[2] > 60);
    await page.mouse.move(rb[0] + 8, rb[1]); await page.mouse.down(); await page.mouse.move(rb[0] + rb[2] * 0.3, rb[1], { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150);
    const t = await page.evaluate(() => ({ c: window.__teachly.store.tool.color, s: window.__teachly.store.tool.size }));
    check(name + ': tap changes colour, sliding changes size', t.c === '#db0000' && t.s > 5 && t.s < 25, JSON.stringify(t));
    const want = t.s;
    const r = await page.$eval('.quickbar', (e) => { const x = e.getBoundingClientRect(); return [x.left, x.right, x.top, x.bottom]; });
    check(name + ': fits the screen', r[0] >= 0 && r[1] <= w, JSON.stringify(r.map(Math.round)));
    await page.mouse.move(w / 2 - 80, h / 3); await page.mouse.down(); await page.mouse.move(w / 2 + 80, h / 3 + 40, { steps: 6 }); await page.mouse.up();
    const p = await page.evaluate(() => { const e = window.__teachly.store.page.els[0]; return e && [e.color, e.size]; });
    check(name + ': next stroke uses them', !!p && p[0] === '#db0000' && p[1] === want, JSON.stringify(p));
    await page.click('[data-tool=eraser]'); await page.waitForTimeout(250);
    check(name + ': hidden for the eraser', await page.$eval('.quickbar', (e) => e.hidden));
    await page.click('[data-tool=pen]'); await page.waitForTimeout(350);
    await page.screenshot({ path: d + 'qb-' + name + '.png' });
    await ctx.close();
  }
  await b.close(); finish();
})();
