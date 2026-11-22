// Read only: the button opens into a "Read only" pill, the writing tools fade away, and nothing on the page
// changes (pen, keys, undo); the board still slides. Tapping it again brings everything back.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1366, height: 834 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1500);
  const n = () => page.evaluate(() => window.__teachly.store.page.els.length);
  const draw = async (y) => {
    await page.mouse.move(500, y);
    await page.mouse.down();
    await page.mouse.move(650, y + 30, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  };
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'pen' }));
  await draw(300);
  const n0 = await n();
  check('the pen writes before Read only', n0 === 1, String(n0));
  check('the Read only button is on the tool bar', !!(await page.$('.tb-left [data-act=readonly]')));
  await page.click('[data-act=readonly]');
  await page.waitForTimeout(600);
  check('on: the button says "Read only"', (await page.evaluate(() => getComputedStyle(document.querySelector('.tb-ro-label')).opacity)) === '1');
  const left = await page.evaluate(() => [...document.querySelectorAll('.tb-left > *, .tb-right > *')].filter((e) => getComputedStyle(e).display !== 'none' && e.offsetWidth).map((e) => e.dataset.act).join(','));
  check('on: only Read only, Screenshot and Pages stay on the bar (no empty gap)', left === 'readonly,shot,pages', left);
  check('on: the writing tools fade away', (await page.evaluate(() => getComputedStyle(document.querySelector('.tb-left [data-tool=pen]')).opacity)) === '0');
  const cam0 = await page.evaluate(() => JSON.stringify(window.teachly.board.cam));
  await draw(400);
  check('on: the pen writes nothing (it slides the board)', (await n()) === n0 && (await page.evaluate(() => JSON.stringify(window.teachly.board.cam))) !== cam0);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('e');
  await page.waitForTimeout(200);
  check('on: undo and tool keys change nothing', (await n()) === n0 && (await page.evaluate(() => window.__teachly.store.tool.tool)) === 'pen');
  // one tap on the words "Read only" (not the icon) turns it off
  const lb = await (await page.$('.tb-ro-label')).boundingBox();
  await page.mouse.click(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.waitForTimeout(600);
  check('off: the tools come back', (await page.evaluate(() => getComputedStyle(document.querySelector('.tb-left [data-tool=pen]')).opacity)) === '1');
  await draw(500);
  check('off: the pen writes again', (await n()) === n0 + 1);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
