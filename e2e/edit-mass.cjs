// The mass (label) on a block is editable: double-tap it, or the Edit label button.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__teachly.store.setSettings({ subject: 'phy-11-nlm' }));
  await page.waitForTimeout(600);
  const labelOf = () => page.evaluate(() => window.__teachly.store.page.els.find((e) => e.type === 'text').text);
  const screen = () => page.evaluate(() => { const t = window.__teachly.store.page.els.find((e) => e.type === 'text'); const bd = window.teachly.board; const [sx, sy] = bd.toScreen(t.x + t.w / 2, t.y + t.h / 2); const r = bd.el.getBoundingClientRect(); return [sx + r.left, sy + r.top]; });
  await page.click('.sd-tile[data-comp="b1"]');
  await page.waitForTimeout(400);
  check('the block starts with the label m', (await labelOf()) === 'm');
  // 1. double-tap the label while the whole block is selected
  const [x, y] = await screen();
  await page.mouse.click(x, y);
  await page.waitForTimeout(120);
  await page.mouse.click(x, y);
  await page.waitForTimeout(400);
  check('double-tap on the mass opens the text editor', !!(await page.$('.text-editor, textarea.text-edit, [contenteditable=true]')));
  await page.keyboard.press('Control+a');
  await page.keyboard.type('5 kg');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('and the mass can be changed (5 kg)', (await labelOf()) === '5 kg', await labelOf());
  // 2. the Edit label button in the selection bar
  const r = await page.evaluate(() => { const { store } = window.__teachly; store.select(store.page.els.map((e) => e.id)); });
  await page.waitForTimeout(400);
  check('the selection bar has an Edit label button', !!(await page.$('[data-pact=edittext]')));
  await page.click('[data-pact=edittext]');
  await page.waitForTimeout(400);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('m₂');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('it opens the label for editing (m₂)', (await labelOf()) === 'm₂', await labelOf());
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
