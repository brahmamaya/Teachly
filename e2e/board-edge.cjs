// Classroom boards (Android panels): the touch frame covers the outer edge of the screen, so the toolbar's buttons
// keep clear of it (the bar itself still reaches the edge). Other devices are unchanged (buttons close to the edge).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const BOARD = 'Mozilla/5.0 (Linux; Android 11; Board) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Safari/537.36';
(async () => {
  const b = await chromium.launch();
  for (const [name, ua, want] of [['board', BOARD, true], ['laptop', undefined, false]]) {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, ...(ua ? { userAgent: ua } : {}) });
    const p = await ctx.newPage();
    await p.goto(process.env.URL || 'http://localhost:5173/');
    await p.waitForTimeout(2000);
    const m = await p.evaluate(() => {
      const bar = document.querySelector('.tb-left').getBoundingClientRect();
      const btns = [...document.querySelectorAll('.tb-left .tb-btn, .tb-right .tb-btn')].filter((e) => e.offsetWidth).map((e) => e.getBoundingClientRect());
      const right = document.querySelector('.tb-right').getBoundingClientRect();
      return { barBottom: innerHeight - bar.bottom, barLeft: bar.left, rightGap: innerWidth - right.right, bottomGap: Math.min(...btns.map((r) => innerHeight - r.bottom)), leftGap: Math.min(...btns.map((r) => r.left)), rightBtnGap: Math.min(...btns.map((r) => innerWidth - r.right)) };
    });
    check(`${name}: the bars still reach the screen edges`, m.barBottom <= 0.5 && m.barLeft <= 0.5 && m.rightGap <= 0.5, JSON.stringify(m));
    if (want) check('board: every button keeps at least 14 px from the bottom, left and right edges', m.bottomGap >= 14 && m.leftGap >= 14 && m.rightBtnGap >= 14, JSON.stringify(m));
    else check('laptop: buttons as before, close to the edge', m.bottomGap < 10, JSON.stringify(m));
    await ctx.close();
  }
  await b.close();
  finish();
})();
