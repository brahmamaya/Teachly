// A wedge placed by an older version (no angle tags on its arc and number) still gets its angle updated when stretched.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const { store } = window.__teachly;
    const g = 'oldwedge';
    const P = (pts) => pts.flatMap(([x, y]) => [x, y, 0.5]);
    const cx = 800, cy = 500, th = Math.PI / 6, hyp = 360, w = hyp * Math.cos(th), h = hyp * Math.sin(th);
    const bl = [cx - w / 2, cy + h / 2], br = [cx + w / 2, cy + h / 2], tr = [cx + w / 2, cy - h / 2];
    const arc = [];
    for (let i = 0; i <= 14; i++) arc.push([bl[0] + Math.cos((-th * i) / 14) * 70, bl[1] + Math.sin((-th * i) / 14) * 70]);
    store.addEls([
      { id: 'o1', type: 'path', style: 'shape', pts: [...P([bl, br, tr]), bl[0], bl[1], 0.5], color: '#fff', size: 5, opacity: 1, closed: true, fill: '#374151', surf: true, group: g },
      { id: 'o2', type: 'path', style: 'shape', pts: P(arc), color: '#fff', size: 3, opacity: 1, closed: false, fill: null, group: g },
      { id: 'o3', type: 'text', text: '30°', color: '#fff', fontSize: 30, bold: true, x: bl[0] + 85, y: bl[1] - 50, w: 62, h: 36, rot: 0, group: g },
    ]);
    store.setTool({ tool: 'select' });
    store.select(['o1', 'o2', 'o3']);
  });
  await page.waitForTimeout(400);
  const scr = (wx, wy) => page.evaluate(([x, y]) => { const bd = window.teachly.board; const [sx, sy] = bd.toScreen(x, y); const r = bd.el.getBoundingClientRect(); return [sx + r.left, sy + r.top]; }, [wx, wy]);
  const r = await page.evaluate(() => window.teachly.board.selectionBounds());
  const [sx, sy] = await scr(r.x + r.w / 2, r.y);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, sy - 120, { steps: 8 });
  await page.mouse.move(sx, sy - 240, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => {
    const { store } = window.__teachly;
    const t = store.page.els.find((e) => e.id === 'o1').pts;
    const label = store.page.els.find((e) => e.id === 'o3');
    const w = t[3] - t[0], h = t[1] - t[7];
    return { label: label.text, real: Math.round((Math.atan2(h, w) * 180) / Math.PI), tagged: !!label.ang };
  });
  check(`an old wedge stretched taller: the number follows (${res.label}, real ${res.real}°)`, res.label === `${res.real}°` && res.real > 30, JSON.stringify(res));
  check('and it is marked from now on', res.tagged);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
