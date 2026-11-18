// The colour / thickness bar sits on the toolbar's own line when there is room between its halves.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, touch, inline] of [['tablet1024', 1024, 768, true, true], ['desk1280', 1280, 800, false, true], ['board1920', 1920, 1080, true, true], ['ipad-portrait', 820, 1180, true, true], ['phone', 390, 844, true, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 1000 });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1800);
    await page.click('[data-tool=eraser]');
    await page.click('[data-tool=pen]');
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const q = document.querySelector('.quickbar').getBoundingClientRect();
      const l = document.querySelector('.tb-left').getBoundingClientRect();
      const r = document.querySelector('.tb-right').getBoundingClientRect();
      return { q: [q.left, q.right, q.top, q.bottom], l: [l.left, l.right, l.top, l.bottom], r: [r.left, r.right, r.top, r.bottom], inline: document.querySelector('.quickbar').classList.contains('inline') };
    });
    const qc = (m.q[2] + m.q[3]) / 2, lc = (m.l[2] + m.l[3]) / 2;
    if (inline) {
      check(`${name}: same line as the toolbar (centres ${Math.round(qc)} vs ${Math.round(lc)})`, m.inline && Math.abs(qc - lc) < 3);
      check(`${name}: between the two halves, touching neither`, m.q[0] > m.l[1] + 4 && m.q[1] < m.r[0] - 4, JSON.stringify(m.q.map(Math.round)));
    } else check(`${name}: not enough room, stays just above the toolbar`, !m.inline && m.q[3] <= Math.min(m.l[2], m.r[2]) + 1, JSON.stringify(m));
    await page.screenshot({ path: d + 'qbl-' + name + '.png' });
    await ctx.close();
  }
  await b.close();
  finish();
})();
