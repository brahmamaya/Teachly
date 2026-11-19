// "My pens": save the pen in use into a slot, change the pen, tap the slot to get it back; it survives a reload.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1800);
  const tool = () => page.evaluate(() => { const t = window.__teachly.store.tool; return { s: t.penStyle, c: t.color, z: t.size }; });
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'pen', penStyle: 'pen', color: '#db0000', size: 7 }));
  await page.click('[data-tool=pen]'); // second tap on the active pen opens its menu
  await page.waitForTimeout(400);
  check('the pen menu has My pens with 4 slots', (await page.$$('.n3-preset')).length === 4);
  await page.click('.n3-preset[data-pslot="0"]'); // empty slot: saves the pen in use
  await page.waitForTimeout(200);
  check('an empty slot stores the pen in use', await page.evaluate(() => { const p = window.__teachly.store.settings.penPresets?.[0]; return !!p && p.color === '#db0000' && p.size === 7 && p.style === 'pen'; }));
  await page.evaluate(() => window.__teachly.store.setTool({ penStyle: 'calligraphy', color: '#174ebd', size: 20 }));
  await page.waitForTimeout(200);
  await page.click('.n3-preset[data-pslot="0"]');
  await page.waitForTimeout(200);
  const t = await tool();
  check('tapping a full slot brings the saved pen back (kind, colour, size)', t.s === 'pen' && t.c === '#db0000' && t.z === 7, JSON.stringify(t));
  await page.evaluate(() => window.__teachly.store.setTool({ color: '#4ceb45', size: 3 }));
  await page.click('.n3-preset[data-pslot="0"]');
  await page.waitForTimeout(150);
  check('a full slot is not overwritten by a plain tap', (await page.evaluate(() => window.__teachly.store.settings.penPresets[0].color)) === '#db0000');
  await page.evaluate(() => window.__teachly.store.setTool({ color: '#4ceb45', size: 3 }));
  await page.click('.n3-psave');
  await page.click('.n3-preset[data-pslot="0"]');
  await page.waitForTimeout(150);
  check('Save, then the slot, overwrites it', (await page.evaluate(() => window.__teachly.store.settings.penPresets[0].color)) === '#4ceb45');
  await page.reload();
  await page.waitForTimeout(1800);
  check('the saved pens are still there after reopening', (await page.evaluate(() => window.__teachly.store.settings.penPresets?.[0]?.color)) === '#4ceb45');
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
