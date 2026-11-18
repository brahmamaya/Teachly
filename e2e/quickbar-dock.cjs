// With the subject dock open, the dock and the pen colours share the toolbar line and FILL the free space:
// the fewer toolbar buttons, the more pieces and the more colours.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const run = async (name, w, h, touch, hidden) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 1000 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1800);
    await page.evaluate(([hid]) => { const { store } = window.__teachly; store.setSettings({ tbHidden: hid, tbShown: [], subject: 'phy-11-nlm' }); store.setTool({ tool: 'eraser' }); }, [hidden]);
    await page.waitForTimeout(500);
    await page.click('[data-tool=pen]');
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; };
      const q = document.querySelector('.quickbar');
      return {
        dock: box('.subj-dock'), qb: box('.quickbar'), bar: box('.tb-left'), bar2: box('.tb-right'),
        tiles: [...document.querySelectorAll('.sd-tile')].filter((e) => !e.hidden).length,
        colours: [...q.querySelectorAll('.qb-c')].filter((e) => getComputedStyle(e).display !== 'none').length,
        slider: getComputedStyle(q.querySelector('.qb-range')).display !== 'none',
        size: q.classList.contains('mini') ? 'mini' : q.classList.contains('mid') ? 'mid' : 'full',
      };
    });
    await page.screenshot({ path: d + 'fill-' + name + '.png' });
    await ctx.close();
    return m;
  };
  const mid = (a) => (a[2] + a[3]) / 2;
  // fewer buttons: more is shown
  const few = ['redo', 'timer', 'poll', 'graph', 'fill', 'tape', 'laser', 'pagenav', 'pages'];
  const rich = await run('desk1400-few', 1400, 900, false, few);
  const poor = await run('desk1400-all', 1400, 900, false, []);
  check(`few toolbar buttons: more pieces on the dock (${rich.tiles}) than with all buttons (${poor.tiles})`, rich.tiles > poor.tiles, `${rich.tiles} vs ${poor.tiles}`);
  check(`few toolbar buttons: a richer pen bar (${rich.size}) than with all buttons (${poor.size})`, ['full', 'mid', 'mini'].indexOf(rich.size) <= ['full', 'mid', 'mini'].indexOf(poor.size));
  check('few buttons: the whole pen bar (all colours and the slider) fits on the line', rich.size === 'full' && rich.slider && rich.colours >= 6, JSON.stringify([rich.size, rich.colours, rich.slider]));
  for (const [name, m] of [['few', rich], ['all', poor]]) {
    check(`${name}: dock and pen bar on the toolbar's line, side by side, not touching the toolbar halves`, Math.abs(mid(m.qb) - mid(m.bar)) < 8 && Math.abs(mid(m.dock) - mid(m.bar)) < 8 && m.dock[1] <= m.qb[0] + 1 && m.dock[0] >= m.bar[1] && m.qb[1] <= m.bar2[0], JSON.stringify([m.dock, m.qb, m.bar, m.bar2].map((a) => a.map(Math.round))));
  }
  // tight screens still work
  const tight = await run('ipad1180-all', 1180, 820, true, []);
  check(`tight (1180, all buttons): a small pen bar (${tight.size}) and ${tight.tiles} pieces, on the line`, Math.abs(mid(tight.qb) - mid(tight.bar)) < 8 && tight.tiles >= 3, JSON.stringify([tight.size, tight.tiles]));
  const small = await run('ipad820-all', 820, 1180, true, []);
  check('narrow tablet: nothing overlaps (both sit above the toolbar if the line is too short)', small.dock && small.qb && (small.qb[3] <= small.dock[2] + 2 || small.dock[3] <= small.qb[2] + 2 || small.dock[1] <= small.qb[0] + 1 || small.qb[1] <= small.dock[0] + 1), JSON.stringify([small.dock, small.qb].map((a) => a.map(Math.round))));
  const phone = await run('phone', 390, 844, true, []);
  check('phone: both above the toolbar, not overlapping', phone.qb[3] <= phone.bar[2] + 4 && (phone.qb[3] <= phone.dock[2] + 2 || phone.dock[3] <= phone.qb[2] + 2), JSON.stringify([phone.dock, phone.qb, phone.bar].map((a) => a.map(Math.round))));
  // the arrow of the small bar opens the whole bar above
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate(() => { const { store } = window.__teachly; store.setSettings({ tbHidden: [], tbShown: [], subject: 'phy-11-nlm' }); store.setTool({ tool: 'eraser' }); });
  await page.waitForTimeout(500);
  await page.click('[data-tool=pen]');
  await page.waitForTimeout(700);
  await page.click('.quickbar .qb-c[data-qc="#4ceb45"]');
  check('a colour from the small bar sets the pen', (await page.evaluate(() => window.__teachly.store.tool.color)) === '#4ceb45');
  await page.click('.qb-arrow');
  await page.waitForTimeout(500);
  const full = await page.evaluate(() => { const q = document.querySelector('.quickbar'); const r = q.getBoundingClientRect(); const bar = document.querySelector('.tb-left').getBoundingClientRect(); return { colours: [...q.querySelectorAll('.qb-c')].filter((e) => getComputedStyle(e).display !== 'none').length, slider: getComputedStyle(q.querySelector('.qb-range')).display !== 'none', above: r.bottom <= bar.top + 2 }; });
  check('the arrow opens the whole bar above the toolbar (all colours, slider)', full.colours >= 6 && full.slider && full.above, JSON.stringify(full));
  await page.click('.qb-arrow');
  await page.waitForTimeout(500);
  check('and closes it again', await page.evaluate(() => !document.querySelector('.quickbar').classList.contains('open')));
  await page.click('.tb-subject');
  await page.waitForTimeout(600);
  check('without the dock the bar is the normal full one', await page.evaluate(() => { const q = document.querySelector('.quickbar'); return !q.classList.contains('mini') && !q.classList.contains('mid') && !q.classList.contains('withdock'); }));
  await ctx.close();
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
