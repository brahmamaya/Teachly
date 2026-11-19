// The pieces dock never touches or overlaps the two toolbar halves: it keeps free space on both sides,
// also right after toolbar buttons are shown or hidden (the halves change width then).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1024, 768], [1180, 820], [1194, 834], [1366, 1024], [1920, 1080]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(process.env.URL || 'http://localhost:5173/');
    await page.waitForTimeout(1500);
    for (const [label, patch] of [['all buttons', { tbHidden: [], tbShown: [] }], ['few buttons', { tbHidden: ['redo', 'timer', 'poll', 'graph', 'fill', 'tape', 'laser', 'pagenav', 'pages'], tbShown: [] }], ['all buttons again', { tbHidden: [], tbShown: [] }]]) {
      await page.evaluate((p) => window.__teachly.store.setSettings({ subject: 'phy-11-nlm', ...p }), patch);
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return [x.left, x.right, x.top, x.bottom]; };
        return { l: r('.tb-left'), r: r('.tb-right'), d: r('.subj-dock') };
      });
      const onLine = m.d && Math.abs((m.d[2] + m.d[3]) / 2 - (m.l[2] + m.l[3]) / 2) < 10;
      const ok = !m.d || !onLine || (m.d[0] >= m.l[1] + 20 && m.d[1] <= m.r[0] - 20);
      check(`${w}x${h}, ${label}: the dock keeps free space on both sides (or sits above the toolbar)`, ok, JSON.stringify({ l: m.l && [Math.round(m.l[1])], d: m.d && [Math.round(m.d[0]), Math.round(m.d[1])], r: m.r && [Math.round(m.r[0])], onLine }));
    }
    await ctx.close();
  }
  await b.close();
  finish();
})();
