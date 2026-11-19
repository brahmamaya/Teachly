// A block put near a plane by tap or carried near it by hand turns along the plane and sits on it.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const deg = (r) => (r * 180) / Math.PI;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__teachly.store.setSettings({ subject: 'phy-11-nlm' }));
  await page.waitForTimeout(600);
  const scr = (wx, wy) => page.evaluate(([x, y]) => { const bd = window.teachly.board; const [sx, sy] = bd.toScreen(x, y); const r = bd.el.getBoundingClientRect(); return [sx + r.left, sy + r.top]; }, [wx, wy]);
  const blockNow = () => page.evaluate(() => {
    const { store } = window.__teachly;
    const r = store.page.els.find((e) => e.snap === 'block' && store.selection.has(e.id));
    const wedge = store.page.els.find((e) => e.closed && e.surf && e.pts.length === 12);
    const p = r.pts, w = wedge.pts;
    const cx = (p[0] + p[6]) / 2, cy = (p[1] + p[7]) / 2, h = Math.hypot(p[9] - p[0], p[10] - p[1]);
    // slope = last edge of the wedge outline (top-right corner back to the bottom-left one)
    const ux = w[9] - w[6], uy = w[10] - w[7], L = Math.hypot(ux, uy);
    const dist = Math.abs((cx - w[6]) * uy - (cy - w[7]) * ux) / L;
    return { ang: Math.atan2(p[4] - p[1], p[3] - p[0]), dist, h, cx, cy };
  });
  const slopeAng = -30;
  // 1. wedge, then a block by TAP: it seats itself on the slope
  await page.click('.sd-tile[data-comp="w30"]');
  await page.waitForTimeout(300);
  await page.click('.sd-tile[data-comp="b1"]');
  await page.waitForTimeout(400);
  const t1 = await blockNow();
  check(`tapped block lies along the slope (${deg(t1.ang).toFixed(1)}°)`, Math.abs(deg(t1.ang) - slopeAng) < 1.5);
  check('and rests exactly on it', Math.abs(t1.dist - t1.h / 2) < 1.5, `${t1.dist.toFixed(1)} vs ${(t1.h / 2).toFixed(1)}`);
  // 2. carry it away (far from the wedge), then back near the slope by hand: it seats itself while carried and stays so on release
  const away = await scr(t1.cx - 60, t1.cy - 360);
  const here = await scr(t1.cx, t1.cy);
  await page.mouse.move(here[0], here[1]);
  await page.mouse.down();
  await page.mouse.move(away[0], away[1], { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const t2 = await blockNow();
  check('carried far from every surface it is left as it is (no magnet)', Math.hypot(t2.cx - t1.cx, t2.cy - t1.cy) > 200);
  const near = await scr(t1.cx + 20, t1.cy - 70);
  const cur = await scr(t2.cx, t2.cy);
  await page.mouse.move(cur[0], cur[1]);
  await page.mouse.down();
  await page.mouse.move(near[0], near[1] - 140, { steps: 12 });
  await page.mouse.move(near[0], near[1], { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const t3 = await blockNow();
  check(`carried near the slope: it turns along the plane (${deg(t3.ang).toFixed(1)}°)`, Math.abs(deg(t3.ang) - slopeAng) < 1.5);
  check('and sits on it', Math.abs(t3.dist - t3.h / 2) < 1.5, `${t3.dist.toFixed(1)}`);
  // 3. the same one undone is one step
  await page.evaluate(() => window.__teachly.store.undo());
  const t4 = await blockNow();
  check('one undo takes it back to where it was before the move', Math.hypot(t4.cx - t2.cx, t4.cy - t2.cy) < 1);
  // 4. Alt held: no magnet
  await page.keyboard.down('Alt');
  const cur2 = await scr(t4.cx, t4.cy);
  await page.mouse.move(cur2[0], cur2[1]);
  await page.mouse.down();
  await page.mouse.move(near[0], near[1] - 140, { steps: 10 });
  await page.mouse.move(near[0], near[1], { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await page.waitForTimeout(250);
  const t5 = await blockNow();
  check('holding Alt switches the magnet off (the block stays where it is carried, not seated)', Math.abs(t5.dist - t5.h / 2) > 3, `${t5.dist.toFixed(1)} vs ${(t5.h / 2).toFixed(1)}`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
