// Spotlight/magnifier close on tool pick, copy on one page + paste on another, camera fallback, hand (slide) with one finger.
const { chromium } = require('playwright');
const { check, finish, scr, anchor, where } = require('./lib.cjs');
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(process.env.URL || 'http://localhost:5173/'); await page.waitForTimeout(1800);
  const menu = async (act) => { await page.click('[data-pop=tools]'); await page.waitForTimeout(250); await page.click(`.pm-item[data-act=${act}]`); await page.waitForTimeout(250); };

  // 1. Spotlight and magnifier go away when a pen / eraser is picked
  await menu('spotlight');
  check('spotlight is on', !!(await page.$('.spotlight')));
  await page.click('[data-tool=eraser]'); await page.waitForTimeout(150);
  check('spotlight closes when the eraser is picked', !(await page.$('.spotlight')));
  await menu('magnifier');
  check('magnifier is on', !!(await page.$('.magnifier')));
  await page.click('[data-tool=pen]'); await page.waitForTimeout(150);
  check('magnifier closes when the pen is picked', !(await page.$('.magnifier')));

  // 2. Copy on page 1, paste on page 2 at the same place
  await page.click('[data-tool=pen]'); await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(420, 340, { steps: 6 }); await page.mouse.up();
  await page.click('[data-tool=text]'); await page.mouse.click(500, 450); await page.keyboard.type('copy me'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.click('[data-tool=select]'); await page.evaluate(() => { const { store } = window.__teachly; store.select(store.page.els.map((e) => e.id)); }); await page.waitForTimeout(300);
  const ids1 = await page.evaluate(() => [...window.__teachly.store.selection]);
  check('selected the things on page 1', ids1.length === 2, String(ids1.length));
  await page.click('[data-pact=copy]'); await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__teachly.store.page.els.map((e) => e.pts ? [e.pts[0], e.pts[1]] : [e.x, e.y]));
  await page.click('[data-act=next]').catch(() => {}); 
  await page.evaluate(() => { const { store } = window.__teachly; if (store.doc.pages.length < 2) store.addPage(); store.goTo(1); });
  await page.waitForTimeout(300);
  await page.click('[data-pop=insert]'); await page.waitForTimeout(250);
  check('Insert menu offers Paste', !!(await page.$('.pm-item[data-act=paste]')));
  await page.click('.pm-item[data-act=paste]'); await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ idx: window.__teachly.store.index, els: window.__teachly.store.page.els.map((e) => e.pts ? [e.pts[0], e.pts[1]] : [e.x, e.y]) }));
  check('pasted on page 2, same place', after.idx === 1 && after.els.length === 2 && JSON.stringify(after.els.sort()) === JSON.stringify(before.sort()), JSON.stringify(after));
  const p1 = await page.evaluate(() => window.__teachly.store.doc.pages[0].els.length);
  check('page 1 still has its own items', p1 === 2);

  // 3. Camera: when the live camera cannot start, the phone-camera / gallery button is offered
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('', 'NotReadableError')); });
  await page.click('[data-pop=insert]'); await page.waitForTimeout(250); await page.click('.pm-item[data-act=camera]'); await page.waitForTimeout(500);
  const vis = await page.$eval('[data-fallback]', (e) => !e.hidden);
  check('camera that cannot start offers the camera-app / gallery button', vis);
  await page.setInputFiles('[data-fallback] input', `${require('./lib.cjs').IMG}/photo1.png`); await page.waitForTimeout(500);
  check('a picked photo shows up with "Add to page"', await page.$eval('[data-c=use]', (e) => !e.hidden));
  await page.click('[data-c=use]'); await page.waitForTimeout(600);
  check('photo is on the page', await page.evaluate(() => window.__teachly.store.page.els.some((e) => e.type === 'image')));

  // 4. Hand (slide) mode: one finger slides the board (no stylus, no pen-only)
  await page.evaluate(() => { const { store } = window.__teachly; store.setSettings({ penOnly: false }); store.setTool({ tool: 'pen', slide: true }); });
  await page.evaluate(() => window.teachly.board.setCam({ x: 0, y: 0, z: 1.5 }));
  const cam0 = await page.evaluate(() => ({ ...window.teachly.board.cam }));
  const n0 = await page.evaluate(() => window.__teachly.store.page.els.length);
  const cdp = await ctx.newCDPSession(page);
  const pt = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(700, 400) });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(700 - i * 30, 400 - i * 10) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(300);
  const cam1 = await page.evaluate(() => ({ ...window.teachly.board.cam }));
  const n1 = await page.evaluate(() => window.__teachly.store.page.els.length);
  check('one finger in hand mode slides the board', Math.abs(cam1.x - cam0.x) > 50, `${cam0.x}->${cam1.x}`);
  check('and draws nothing', n1 === n0);
  await browser.close(); finish();
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
