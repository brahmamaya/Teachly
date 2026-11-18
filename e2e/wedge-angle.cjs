// Stretching a wedge: the angle mark (arc and number) follows the real angle.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
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
  const info = () => page.evaluate(() => {
    const { store } = window.__teachly;
    const sel = store.page.els.filter((e) => store.selection.has(e.id));
    const tri = sel.find((e) => e.closed && e.surf);
    const p = tri.pts;
    const label = sel.find((e) => e.type === 'text');
    const arc = sel.find((e) => e.ang && e.type === 'path');
    const w = p[3] - p[0], h = p[1] - p[7];
    return { fs: label.fontSize, label: label.text, expected: Math.round((Math.atan2(h, w) * 180) / Math.PI), w, h, arcR: Math.hypot(arc.pts[0] - p[0], arc.pts[1] - p[1]), lx: label.x + label.w / 2, ly: label.y + label.h / 2, vx: p[0], vy: p[1] };
  });
  await page.click('.sd-tile[data-comp="w30"]');
  await page.waitForTimeout(400);
  let i0 = await info();
  check('a fresh 30° wedge says 30°', i0.label === '30°' && i0.expected === 30, JSON.stringify(i0));
  const grip = async (fx, fy, dx, dy) => {
    const r = await page.evaluate(() => window.teachly.board.selectionBounds());
    const [sx, sy] = await scr(r.x + r.w * fx, r.y + r.h * fy);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + dx / 2, sy + dy / 2, { steps: 6 });
    await page.mouse.move(sx + dx, sy + dy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  // pull the right side out (wider): the angle gets smaller
  await grip(1, 0.5, 160, 0);
  let i1 = await info();
  check(`wider wedge: the number follows the real angle (${i1.label}, real ${i1.expected}°)`, i1.label === `${i1.expected}°` && i1.expected < 30, JSON.stringify(i1));
  // pull the top up (taller): the angle gets bigger
  await grip(0.5, 0, 0, -160);
  let i2 = await info();
  check(`taller wedge: the number follows (${i2.label}, real ${i2.expected}°)`, i2.label === `${i2.expected}°` && i2.expected > i1.expected, JSON.stringify(i2));
  check('the number stays readable however the wedge is stretched (font size 30)', i2.fs === 30 && i1.fs === 30, `${i1.fs} ${i2.fs}`);
  check('the arc stays at the corner with a sensible size', i2.arcR > 10 && i2.arcR <= 70.01, String(i2.arcR));
  // the label stays inside the angle: on the line that halves it, at some distance from the corner
  const ang = Math.atan2(i2.vy - i2.ly, i2.lx - i2.vx);
  const half = (i2.expected * Math.PI) / 360;
  check('and the number sits on the line halving the angle', Math.abs(ang - half) < 0.03, `${((ang * 180) / Math.PI).toFixed(1)}° vs ${((half * 180) / Math.PI).toFixed(1)}°`);
  // one undo step brings the earlier angle back (number, arc and wedge together)
  await page.evaluate(() => window.__teachly.store.undo());
  const i3 = await info();
  check('undo gives the previous angle back, all together', i3.label === i1.label && i3.label === `${i3.expected}°`, JSON.stringify(i3));
  // a copy of the wedge works the same way
  await page.click('[data-pact=dup]');
  await page.waitForTimeout(300);
  await grip(1, 0.5, 120, 0);
  const i4 = await info();
  check('a duplicate follows too', i4.label === `${i4.expected}°` && i4.expected < i3.expected, JSON.stringify(i4));
  // an edited label (θ) is left alone
  await page.evaluate(() => { const { store } = window.__teachly; const t = store.page.els.find((e) => e.type === 'text' && store.selection.has(e.id)); store.mapEls(new Set([t.id]), (e) => ({ ...e, text: 'θ' })); });
  await grip(1, 0.5, 80, 0);
  const lab = await page.evaluate(() => { const { store } = window.__teachly; return store.page.els.find((e) => e.type === 'text' && store.selection.has(e.id)).text; });
  check('a label the teacher changed (θ) is not overwritten', lab === 'θ', lab);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
