// Edit toolbar menu: no row is squeezed (the "Pen colour bar" line was pressed flat under "Stick to the top edge" on
// iPad), and "Toolbar at" / "Buttons" sit in one label column away from the edge, so both rows' choices line up.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h] of [['iPad', 1180, 820], ['phone', 412, 915]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(process.env.URL || 'http://localhost:5173/');
    await p.waitForTimeout(1800);
    await p.evaluate(() => window.__teachly.store.setSettings({ tbPos: 'top', tbY: 0.05, tbAlign: 'middle' }));
    await p.setViewportSize({ width: w + 1, height: h });
    await p.waitForTimeout(200);
    await p.setViewportSize({ width: w, height: h });
    await p.waitForTimeout(600);
    await p.tap('[data-pop=menu]');
    await p.waitForTimeout(500);
    await p.tap('[data-act=tbedit]');
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const pop = document.querySelector('.popover.pop-tbedit:not(.leaving)');
      const squeezed = [...pop.children].filter((e) => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'auto').map((e) => e.className);
      const rows = [...pop.querySelectorAll('.tbe-row')].map((s) => ({ label: s.querySelector('span').getBoundingClientRect().left + parseFloat(getComputedStyle(s.querySelector('span')).paddingLeft) - s.getBoundingClientRect().left, first: s.querySelector('button').getBoundingClientRect().left }));
      return { squeezed, rows };
    });
    check(`${name}: no row of Edit toolbar is squeezed`, r.squeezed.length === 0, r.squeezed.join(','));
    check(`${name}: "Toolbar at" and "Buttons" have room from the edge and their choices line up`, r.rows.length === 2 && r.rows.every((x) => x.label >= 10) && Math.abs(r.rows[0].first - r.rows[1].first) < 1, JSON.stringify(r.rows));
    await ctx.close();
  }
  await b.close();
  finish();
})();
