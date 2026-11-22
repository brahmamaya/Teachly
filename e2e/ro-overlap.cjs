// Read only on/off with the toolbar one bar at the top (the calm squeeze): the teal "Read only" pill and its words never
// run over the Screenshot button while it moves (they grow on the same time and curve). Checked every frame.
// (Chromium only shows the timing part; the Safari jump is caught by the plain-px check.)
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(1800);
  const layout = async (st) => {
    await p.evaluate((st) => window.__teachly.store.setSettings({ tbY: undefined, ...st }), st);
    await p.setViewportSize({ width: 1181, height: 820 });
    await p.waitForTimeout(200);
    await p.setViewportSize({ width: 1180, height: 820 });
    await p.waitForTimeout(600);
  };
  // every frame: how far the pill (its visible part) and the words reach past the Screenshot icon's left edge
  const run = () => p.evaluate(() => new Promise((done) => {
    const pill = document.querySelector('.tb-ro-pill'), label = document.querySelector('.tb-ro-label'), shot = document.querySelector('[data-act=shot] .icon') || document.querySelector('[data-act=shot]');
    let worst = -1e9, at = 0;
    const t0 = performance.now();
    const f = () => {
      const pr = pill.getBoundingClientRect(), k = pr.width / pill.offsetWidth;
      const m = /inset\(([^)]*)\)/.exec(getComputedStyle(pill).clipPath);
      // the right inset: "calc(a% - bpx)", "Npx" or none
      let right = 0;
      if (m) {
        const c = /calc\(([-\d.e]+)% - ([-\d.e]+)px\)/.exec(m[1]);
        right = c ? (parseFloat(c[1]) / 100) * pill.offsetWidth - parseFloat(c[2]) : parseFloat(m[1].split(/\s+/)[1]) || 0;
      }
      const pillEnd = getComputedStyle(pill).opacity > 0.05 ? pr.right - right * k : -1e9;
      const lr = label.getBoundingClientRect();
      const labEnd = +getComputedStyle(label).opacity > 0.1 ? lr.right : -1e9;
      const over = Math.max(pillEnd, labEnd) - shot.getBoundingClientRect().left;
      if (over > worst) { worst = over; at = Math.round(performance.now() - t0); }
      if (performance.now() - t0 < 1100) requestAnimationFrame(f);
      else done({ worst: Math.round(worst), at });
    };
    document.querySelector('[data-act=readonly]').click();
    requestAnimationFrame(f);
  }));
  // Safari animates an inset() of plain lengths only (a calc() inset jumps to the end at once: the pill opened over
  // Screenshot on iPad)
  const cp = await p.evaluate(() => getComputedStyle(document.querySelector('.tb-ro-pill')).clipPath);
  check('the pill opens with plain px (no calc(), which Safari does not animate)', !cp.includes('calc') && !cp.includes('%'), cp);
  for (const [name, st] of [['one bar at the top', { tbPos: 'top', tbAlign: 'middle' }], ['bars at the bottom corners', { tbPos: 'bottom', tbAlign: 'sides' }]]) {
    await layout(st);
    const on = await run();
    check(`${name}, on: the pill and its words never run over Screenshot`, on.worst <= 1, JSON.stringify(on));
    await p.waitForTimeout(300);
    const off = await run();
    check(`${name}, off: neither on the way back`, off.worst <= 1, JSON.stringify(off));
    await p.waitForTimeout(300);
  }
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
