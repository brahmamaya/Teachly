// With the subject dock open, the pen colours show beside it on the same line: only white, yellow, green, blue and a faint arrow.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const [name, w, h, touch, line] of [['desk1400', 1400, 900, false, true], ['ipad1180', 1180, 820, true, true], ['ipad820', 820, 1180, true, false], ['phone', 390, 844, true, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 1000 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1800);
    await page.evaluate(() => { const { store } = window.__teachly; store.setSettings({ tbHidden: [], tbShown: [], subject: 'phy-11-nlm' }); store.setTool({ tool: 'eraser' }); });
    await page.waitForTimeout(500);
    await page.click('[data-tool=pen]');
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; };
      const vis = [...document.querySelectorAll('.quickbar .qb-c')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.dataset.qc);
      return { dock: box('.subj-dock'), qb: box('.quickbar'), bar: box('.tb-left'), mini: document.querySelector('.quickbar').classList.contains('mini'), vis, arrow: getComputedStyle(document.querySelector('.qb-arrow')).display, range: getComputedStyle(document.querySelector('.qb-range')).display };
    });
    check(`${name}: the pen bar is small beside the dock (4 colours, no slider, an arrow)`, m.mini && m.vis.length === 4 && m.arrow !== 'none' && m.range === 'none', JSON.stringify(m.vis));
    check(`${name}: the colours are white, yellow, green, blue`, ['#f2f2f0', '#febf00', '#4ceb45', '#174ebd'].every((c) => m.vis.includes(c)));
    const mid = (a) => (a[2] + a[3]) / 2;
    if (line) {
      check(`${name}: on the toolbar's line, side by side with the dock (no overlap)`, Math.abs(mid(m.qb) - mid(m.bar)) < 8 && Math.abs(mid(m.dock) - mid(m.bar)) < 8 && m.dock[1] <= m.qb[0] + 1, JSON.stringify([m.dock, m.qb, m.bar].map((a) => a.map(Math.round))));
    } else {
      check(`${name}: not enough room on the line: both sit just above the toolbar without overlapping`, (m.qb[3] <= m.dock[2] + 2 || m.dock[3] <= m.qb[2] + 2) && m.qb[3] <= m.bar[2] + 4 && m.dock[3] <= m.bar[2] + 4, JSON.stringify([m.dock, m.qb].map((a) => a.map(Math.round))));
    }
    // a colour from the small bar works
    await page.click('.quickbar .qb-c[data-qc="#4ceb45"]');
    check(`${name}: tapping green from the small bar sets the pen`, (await page.evaluate(() => window.__teachly.store.tool.color)) === '#4ceb45');
    // the arrow opens the whole bar above, and closes it again
    await page.click('.qb-arrow');
    await page.waitForTimeout(500);
    const full = await page.evaluate(() => { const q = document.querySelector('.quickbar'); const r = q.getBoundingClientRect(); const bar = document.querySelector('.tb-left').getBoundingClientRect(); return { mini: q.classList.contains('mini'), colours: [...q.querySelectorAll('.qb-c')].filter((e) => getComputedStyle(e).display !== 'none').length, slider: getComputedStyle(q.querySelector('.qb-range')).display !== 'none', above: r.bottom <= bar.top + 2 }; });
    check(`${name}: the arrow opens the whole bar (all colours and the slider) above the toolbar`, !full.mini && full.colours >= 6 && full.slider && full.above, JSON.stringify(full));
    await page.screenshot({ path: d + 'qbd-' + name + '-open.png' });
    await page.click('.qb-arrow');
    await page.waitForTimeout(500);
    check(`${name}: and the arrow closes it again`, await page.evaluate(() => document.querySelector('.quickbar').classList.contains('mini')));
    await page.screenshot({ path: d + 'qbd-' + name + '.png' });
    // closing the dock gives the full bar back
    await page.click('.tb-subject');
    await page.waitForTimeout(600);
    check(`${name}: without the dock the bar is the normal full one`, await page.evaluate(() => { const q = document.querySelector('.quickbar'); return !q.classList.contains('mini') && !q.classList.contains('withdock'); }));
    await ctx.close();
  }
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
