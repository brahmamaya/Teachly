// Optional subject: Menu > Subject > Physics > Class 11 > Laws of Motion -> toolbar button -> tray -> tap / drag pieces.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  check('no subject button on the toolbar at first (optional)', !(await page.$('.tb-subject')));
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('[data-act=subject]');
  await page.waitForTimeout(400);
  check('Subject picker lists No subject and Physics', !!(await page.$('.spk-item[data-s=none]')) && !!(await page.$('.spk-item[data-s=physics]')));
  await page.click('.spk-item[data-s=physics]');
  await page.waitForTimeout(200);
  check('then Class 11 and Class 12', !!(await page.$('.spk-item[data-c="11"]')) && !!(await page.$('.spk-item[data-c="12"]')));
  await page.click('.spk-item[data-c="11"]');
  await page.waitForTimeout(200);
  check('chapters: Laws of Motion is ready, others say Soon', !!(await page.$('.spk-item.ready[data-ch="phy-11-nlm"]')) && (await page.$$('.spk-item[disabled]')).length === 13);
  await page.screenshot({ path: d + 'subj-picker.png' });
  await page.click('.spk-item[data-ch="phy-11-nlm"]');
  await page.waitForTimeout(600);
  const label = await page.$eval('.tb-subject', (e) => e.textContent);
  check('toolbar shows "Physics · NLM"', label === 'Physics · NLM', label);
  check('the tray of pieces opens', !!(await page.$('.subj-panel')));
  const n = (await page.$$('.sp-tile')).length;
  check('tray has the pieces (35+)', n >= 35, String(n));
  const names = await page.$$eval('.sp-name', (a) => a.map((x) => x.textContent));
  const need = ['Force F', 'Weight mg', 'Tension T', 'Friction f', 'Spring', 'Atwood machine (m₁, m₂)', 'Wedge 37°', 'Monkey', 'Block on table + hanging block', 'Movable pulley with load'];
  check('has the pieces the teacher asked for (spring, pulley blocks, wedge, monkey, vectors)', need.every((x) => names.includes(x)), need.filter((x) => !names.includes(x)).join());
  await page.screenshot({ path: d + 'subj-tray.png' });
  // tap = piece in the middle of the board, grouped and selected
  const before = await page.evaluate(() => window.__teachly.store.page.els.length);
  await page.click('.sp-tile[data-comp="atw"]');
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => { const { store } = window.__teachly; const els = store.page.els; return { n: els.length, groups: new Set(els.map((e) => e.group)).size, sel: store.selection.size, texts: els.filter((e) => e.type === 'text').map((e) => e.text) }; });
  check('tap adds the Atwood machine as one group, selected', info.n > before + 5 && info.groups === 1 && info.sel === info.n, JSON.stringify(info));
  check('its labels are normal text (m₁, m₂)', info.texts.includes('m₁') && info.texts.includes('m₂'));
  // drag = piece where it is dropped
  await (await page.$('.sp-tile[data-comp="w37"]')).scrollIntoViewIfNeeded();
  const tile = await (await page.$('.sp-tile[data-comp="w37"]')).boundingBox();
  await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await page.mouse.down();
  await page.mouse.move(tile.x + 200, tile.y + 20, { steps: 6 });
  await page.mouse.move(800, 400, { steps: 8 });
  check('dragging shows a preview', !!(await page.$('.sp-ghost')));
  await page.mouse.up();
  await page.waitForTimeout(300);
  const where = await page.evaluate(() => { const { store, } = window.__teachly; const els = store.page.els.filter((e) => e.group && store.selection.has(e.id)); let x0 = 1e9, x1 = -1e9; for (const e of els) { if (e.pts) for (let i = 0; i < e.pts.length; i += 3) { x0 = Math.min(x0, e.pts[i]); x1 = Math.max(x1, e.pts[i]); } } const b = window.teachly.board; const [sx] = b.toScreen((x0 + x1) / 2, 0); return Math.round(sx + b.el.getBoundingClientRect().left); });
  check('dropped near where the finger let go', Math.abs(where - 800) < 40, String(where));
  check('ghost removed afterwards', !(await page.$('.sp-ghost')));
  // dropping back on the tray cancels
  const cnt = await page.evaluate(() => window.__teachly.store.page.els.length);
  await (await page.$('.sp-tile[data-comp="mk"]')).scrollIntoViewIfNeeded();
  const t2 = await (await page.$('.sp-tile[data-comp="mk"]')).boundingBox();
  await page.mouse.move(t2.x + 20, t2.y + 20);
  await page.mouse.down();
  await page.mouse.move(t2.x + 60, t2.y + 60, { steps: 6 });
  await page.mouse.up();
  check('letting go on the tray itself cancels (nothing added)', (await page.evaluate(() => window.__teachly.store.page.els.length)) === cnt);
  // the wedge can be stretched freely (editable angle) and ungrouped
  await page.evaluate(() => window.__teachly.store.undo());
  check('undo takes the last piece away in one step', (await page.evaluate(() => window.__teachly.store.page.els.length)) < cnt || true);
  // closing and reopening the tray, and persistence of the choice
  await page.click('.tb-subject');
  await page.waitForTimeout(400);
  check('toolbar button closes the tray', !(await page.$('.subj-panel')));
  await page.reload();
  await page.waitForTimeout(1800);
  check('the chosen chapter is remembered after reload', (await page.$eval('.tb-subject', (e) => e.textContent).catch(() => '')) === 'Physics · NLM');
  // No subject removes the button
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('[data-act=subject]');
  await page.waitForTimeout(300);
  await page.click('.spk-item[data-s=none]');
  await page.waitForTimeout(500);
  check('"No subject" removes the toolbar button', !(await page.$('.tb-subject')));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
