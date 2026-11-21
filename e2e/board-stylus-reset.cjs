// Classroom boards: "Stylus only" left on by an older version is switched off once, so fingers write and erase
// again; a teacher who turns it on afterwards keeps it. With it on, a finger trying to erase gets a message.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  // as an older version left it: "Stylus only" on, no fix flag
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); const k = 'teachly.settings'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.penOnly = true; delete o.penOnlyBoardFix; localStorage.setItem(k, JSON.stringify(o)); } });
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1600);
  check('on a board, an old "Stylus only" is switched off', (await page.evaluate(() => window.__teachly.store.settings.penOnly)) === false);
  const cdp = await ctx.newCDPSession(page);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'pen', penStyle: 'pen' }));
  await tp('touchStart', 300, 300); for (let j = 1; j <= 15; j++) await tp('touchMove', 300 + j * 15, 300); await tp('touchEnd');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'eraser' }));
  await tp('touchStart', 400, 250); for (let j = 1; j <= 10; j++) await tp('touchMove', 400, 250 + j * 10); await tp('touchEnd');
  await page.waitForTimeout(300);
  check('a finger erases on the board', (await page.evaluate(() => window.__teachly.store.page.els.length)) === 2);
  // the teacher turns it on again on purpose: it stays on after a reload
  await page.evaluate(() => window.__teachly.store.setSettings({ penOnly: true }));
  await page.reload();
  await page.waitForTimeout(1600);
  check('turned on again by the teacher, it stays on', (await page.evaluate(() => window.__teachly.store.settings.penOnly)) === true);
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'eraser' }));
  await page.waitForTimeout(1300);
  await tp('touchStart', 600, 400); for (let j = 1; j <= 6; j++) await tp('touchMove', 600, 400 + j * 10); await tp('touchEnd');
  await page.waitForTimeout(300);
  check('and a finger trying to erase gets the message', /fingers do not write or erase/.test(await page.evaluate(() => document.querySelector('.toasts')?.textContent || '')));
  await b.close();
  finish();
})();
