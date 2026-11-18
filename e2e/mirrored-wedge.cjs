// Wedges facing left: no turning needed. Angle follows stretching, a block seats on the left slope, arrows come in every direction.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const deg = (r) => (r * 180) / Math.PI;
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__teachly.store.setSettings({ subject: 'phy-11-nlm' }));
  await page.waitForTimeout(600);
  const names = async () => { await page.click('.sd-more'); await page.waitForTimeout(450); const n = await page.$$eval('.subj-panel .sp-name', (a) => a.map((x) => x.textContent)); return n; };
  const all = await names();
  const need = ['Wedge 30° (left)', 'Wedge 37° (left)', 'Wedge 45° (left)', 'Wedge 53° (left)', 'Wedge 60° (left)', 'Block on wedge 30° (left)', 'Force F ←', 'Force F ↑', 'Force F ↓', 'Tension T ←', 'Friction f ↑', 'Acceleration a ↓', 'Velocity v ←', 'Spring (up-down)', 'Wall (other side)', 'String (up-down)'];
  check('left-facing wedges and arrows in every direction are there', need.every((x) => all.includes(x)), need.filter((x) => !all.includes(x)).join());
  await page.click('.subj-panel .sp-tile[data-comp="w30m"]');
  await page.waitForTimeout(500);
  const info = () => page.evaluate(() => {
    const { store } = window.__teachly;
    const sel = store.page.els.filter((e) => store.selection.has(e.id));
    const tri = sel.find((e) => e.closed && e.surf);
    const p = tri.pts;
    const label = sel.find((e) => e.type === 'text');
    const xs = [p[0], p[3], p[6]], ys = [p[1], p[4], p[7]];
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    return { label: label.text, expected: Math.round(deg2(Math.atan2(h, w))), fs: label.fontSize, upright: label.rot === 0 };
    function deg2(r) { return (r * 180) / Math.PI; }
  });
  const i0 = await info();
  check('a left-facing wedge says 30° and its writing is upright', i0.label === '30°' && i0.upright, JSON.stringify(i0));
  const scr = (wx, wy) => page.evaluate(([x, y]) => { const bd = window.teachly.board; const [sx, sy] = bd.toScreen(x, y); const r = bd.el.getBoundingClientRect(); return [sx + r.left, sy + r.top]; }, [wx, wy]);
  const r = await page.evaluate(() => window.teachly.board.selectionBounds());
  const [sx, sy] = await scr(r.x + r.w / 2, r.y);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, sy - 100, { steps: 6 });
  await page.mouse.move(sx, sy - 200, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const i1 = await info();
  check(`stretched taller: the number follows (${i1.label}, real ${i1.expected}°) and stays readable`, i1.label === `${i1.expected}°` && i1.expected > 30 && i1.fs === 30, JSON.stringify(i1));
  // a block near the left slope turns the other way and sits on it
  await page.click('.sd-tile[data-comp="b1"]');
  await page.waitForTimeout(400);
  const blk = await page.evaluate(() => {
    const { store } = window.__teachly;
    const r = store.page.els.find((e) => e.snap === 'block' && store.selection.has(e.id));
    const w = store.page.els.find((e) => e.closed && e.surf && e.pts.length === 12);
    const p = r.pts, q = w.pts;
    const ang = (Math.atan2(p[4] - p[1], p[3] - p[0]) * 180) / Math.PI;
    // the slope is the edge that is neither horizontal nor vertical
    let s = null;
    for (let i = 0; i < 3; i++) { const ax = q[i * 3], ay = q[i * 3 + 1], bx = q[i * 3 + 3], by = q[i * 3 + 4]; if (Math.abs(ax - bx) > 1 && Math.abs(ay - by) > 1) s = [ax, ay, bx, by]; }
    const cx = (p[0] + p[6]) / 2, cy = (p[1] + p[7]) / 2, h = Math.hypot(p[9] - p[0], p[10] - p[1]);
    const L = Math.hypot(s[2] - s[0], s[3] - s[1]);
    const d = Math.abs((cx - s[0]) * (s[3] - s[1]) - (cy - s[1]) * (s[2] - s[0])) / L;
    const slope = (Math.atan2(s[3] - s[1], s[2] - s[0]) * 180) / Math.PI;
    return { ang, slope, d, h };
  });
  const diff = ((blk.ang - blk.slope + 270) % 180) - 90;
  check(`the block lies along the left slope (${blk.ang.toFixed(1)}° on a ${blk.slope.toFixed(1)}° slope)`, Math.abs(diff) < 1.5 && Math.abs(blk.d - blk.h / 2) < 1.5, JSON.stringify(blk));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
