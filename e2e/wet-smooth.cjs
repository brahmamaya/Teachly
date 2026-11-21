// Writing on a board (few touch points): the line while writing looks the same as the finished line — no straight
// stubs or kinks that vanish on lift (owner's board video, 21 Nov 2026).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'pen', penStyle: 'pen', size: 6, color: '#fdd130' }));
  const cdp = await ctx.newCDPSession(page);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  // the yellow pixels of the given canvases, put together (only the board's own canvases)
  const ink = (which) => page.evaluate((which) => {
    const cs = [...document.querySelectorAll('canvas')].filter((c) => which.some((w) => c.classList.contains(w)));
    const w = cs[0].width, h = cs[0].height, o = document.createElement('canvas');
    o.width = w; o.height = h;
    const g = o.getContext('2d');
    cs.forEach((c) => g.drawImage(c, 0, 0));
    const d = g.getImageData(0, 0, w, h).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 120) n++;
    return n;
  }, which);
  const pts = [];
  for (let i = 0; i <= 14; i++) { const t = (i / 14) * Math.PI * 2; pts.push([500 + Math.sin(t) * 150, 200 + i * 25]); }
  await tp('touchStart', ...pts[0]);
  for (const p of pts.slice(1)) { await tp('touchMove', ...p); await page.waitForTimeout(16); }
  await page.waitForTimeout(150);
  const live = await ink(['wet', 'overlay']);
  await tp('touchEnd');
  await page.waitForTimeout(500);
  const done = await ink(['ink']);
  check('the line while writing matches the finished line (no extra stubs)', live > 0 && done > 0 && Math.abs(live - done) / done < 0.04, JSON.stringify({ live, done }));
  await b.close();
  finish();
})();
