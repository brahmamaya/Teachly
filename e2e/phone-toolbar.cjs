// Phones (two-row toolbar): menus stay on the screen, one tap opens Tools (the late click of that tap must not pick an
// item in the menu that opened under the finger), the dock rows are in the right order at the bottom and at the top,
// and placed freely both rows float centred.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(2000);
  const layout = async (set) => {
    await p.evaluate((st) => window.__teachly.store.setSettings({ tbShown: ['tools'], tbAlign: 'sides', ...st }), set);
    await p.setViewportSize({ width: 413, height: 915 });
    await p.waitForTimeout(150);
    await p.setViewportSize({ width: 412, height: 915 });
    await p.waitForTimeout(500);
  };
  const rects = () => p.evaluate(() => ['.tb-left', '.tb-right'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
  const inside = async () => p.evaluate(() => { const e = document.querySelector('.popover:not(.leaving)'); if (!e) return false; const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5; });

  await layout({ tbPos: 'bottom', tbY: undefined });
  let [tools, acts] = await rects();
  check('bottom: the tools row sits above the actions row, which touches the bottom edge', tools.b <= acts.t + 1 && acts.b >= 914, JSON.stringify({ tools, acts }));
  await p.tap('[data-pop=menu]');
  await p.waitForTimeout(500);
  check('the menu stays on the screen', await inside());
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  const toolBefore = await p.evaluate(() => window.__teachly.store.tool.tool);
  await p.tap('[data-pop=tools]');
  await p.waitForTimeout(500);
  check('one tap opens Tools (and stays open)', !!(await p.$('.popover.pop-list-2:not(.leaving)')) && (await inside()));
  check('…without picking what lay under the finger', (await p.evaluate(() => window.__teachly.store.tool.tool)) === toolBefore);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);

  await layout({ tbPos: 'top', tbY: undefined });
  [tools, acts] = await rects();
  check('top: a full-width dock at the top edge (no empty strip beside it)', tools.t <= 0.5 && tools.l <= 0.5 && tools.r >= 411.5 && acts.l <= 0.5 && acts.r >= 411.5, JSON.stringify({ tools, acts }));

  await layout({ tbY: 0.5 });
  [tools, acts] = await rects();
  const centred = (r) => Math.abs(r.l - (412 - r.r)) < 2;
  check('placed freely: both rows float centred, one above the other', centred(tools) && centred(acts) && tools.b <= acts.t, JSON.stringify({ tools, acts }));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
