// Does a finger still edit objects once a stylus has been seen (penOnly is saved in settings)?
const { open, doc } = require('./lib.cjs');
(async () => {
  const { browser, ctx, page } = await open({ hasTouch: true });
  const cdp = await ctx.newCDPSession(page);
  const touch = async (pts) => { // pts: [[x,y],...] one finger down, moves, up
    const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p[0], y: p[1], id: 1 }] : [] });
    await send('touchStart', pts[0]); for (const p of pts.slice(1)) await send('touchMove', p); await send('touchEnd');
  };
  await page.evaluate(() => {
    const { store } = window.__teachly;
    store.addEls([{ id: 'img1', type: 'image', x: 500, y: 300, w: 300, h: 225, rot: 0, src: 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='225'><rect width='300' height='225' fill='#4ade80'/></svg>") }]);
  });
  await page.click('[data-tool=select]'); await page.waitForTimeout(500);
  const centre = () => page.evaluate(() => { const { store } = window.__teachly; const e = store.page.els.find((x) => x.id === 'img1'); const bd = window.teachly.board; const [sx, sy] = bd.toScreen(e.x + e.w / 2, e.y + e.h / 2); const r = bd.el.getBoundingClientRect(); return [sx + r.left, sy + r.top, e.x]; });
  for (const penOnly of [false, true]) {
    await page.evaluate(async (v) => { const { store } = window.__teachly; store.setSettings({ penOnly: v }); }, penOnly);
    const [cx, cy, x0] = await centre();
    await touch([[cx, cy], [cx + 20, cy + 10], [cx + 60, cy + 30], [cx + 90, cy + 40]]);
    await page.waitForTimeout(300);
    const [, , x1] = await centre();
    console.log(`penOnly=${penOnly}: finger drag moved the image by`, Math.round(x1 - x0), 'units');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
  }
  await browser.close();
})();
