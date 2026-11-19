// D. Move selected things to another page: drag onto a thumbnail (mouse + real touch), "Move to page", undo/redo, reopen.
const { chromium } = require('playwright');
const { check, finish, settled, scr, insertPhoto } = require('./lib.cjs');
const URL = process.env.URL || 'http://localhost:5173/';
const counts = (page) => page.evaluate(() => window.__teachly.store.doc.pages.map((p) => p.els.length));
const is = async (page, want) => JSON.stringify(await counts(page)) === JSON.stringify(want);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  let page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(1800);
  // page 1: a line, a text, a photo; pages 2 and 3 empty
  await page.click('[data-tool=pen]');
  await page.mouse.move(300, 250); await page.mouse.down(); await page.mouse.move(420, 280, { steps: 6 }); await page.mouse.up();
  await page.click('[data-tool=text]');
  await page.mouse.click(300, 400); await page.keyboard.type('hello'); await page.keyboard.press('Escape');
  await insertPhoto(page, 1);
  await page.evaluate(() => { const { store } = window.__teachly; store.addPage(); store.addPage(); store.goTo(0); });
  await page.waitForTimeout(300);
  check('start: page 1 has 3 things, others empty', await is(page, [3, 0, 0]), JSON.stringify(await counts(page)));
  await page.click('[data-act=pages]');
  await page.waitForTimeout(500);
  check('Pages panel lists 3 thumbnails', (await page.$$('.page-thumb')).length === 3);

  // --- mouse drag of ONE item (the photo) onto page 3
  const photo = await page.evaluate(() => window.__teachly.store.page.els.find((e) => e.type === 'image'));
  await page.click('[data-tool=select]');
  const [px, py] = await scr(page, photo.x + photo.w / 2, photo.y + photo.h / 2);
  const t3 = await (await page.$$('.page-thumb'))[2].boundingBox();
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 60, py + 30, { steps: 5 });
  await page.mouse.move(t3.x + t3.width / 2, t3.y + t3.height / 2, { steps: 12 });
  const lit = await page.$eval('.page-thumb.drop-on', (e) => e.dataset.i).catch(() => null);
  check('while dragging: thumbnail 3 is highlighted', lit === '2', String(lit));
  check('while dragging: a badge shows what is carried', (await page.$eval('.drop-badge', (e) => e.textContent).catch(() => '')) === '1 item');
  await page.mouse.up();
  await page.waitForTimeout(300);
  check('dropped: photo moved to page 3', await is(page, [2, 0, 1]), JSON.stringify(await counts(page)));
  check('highlight and badge are gone', !(await page.$('.drop-on')) && !(await page.$('.drop-badge')));
  const moved = await page.evaluate(() => { const e = window.__teachly.store.doc.pages[2].els[0]; return [e.type, e.x >= 0, e.y >= 0, e.x + e.w <= 1600, e.y + e.h <= 900]; });
  check('and it lies inside page 3', moved[0] === 'image' && moved.slice(1).every(Boolean), JSON.stringify(moved));
  await page.evaluate(() => window.__teachly.store.undo());
  await page.waitForTimeout(150);
  check('undo brings it back in one step', await is(page, [3, 0, 0]), JSON.stringify(await counts(page)));
  await page.evaluate(() => window.__teachly.store.redo());
  await page.waitForTimeout(150);
  check('redo moves it again', await is(page, [2, 0, 1]));
  await page.evaluate(() => window.__teachly.store.undo());
  await page.waitForTimeout(150);

  // --- released on the board: the item only moves on its page
  const [qx, qy] = await scr(page, photo.x + photo.w / 2, photo.y + photo.h / 2);
  await page.mouse.move(qx, qy); await page.mouse.down(); await page.mouse.move(qx + 80, qy + 20, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(200);
  check('released on the board: nothing leaves the page', await is(page, [3, 0, 0]));
  await page.evaluate(() => window.__teachly.store.undo());

  // --- several things at once with the picker
  await page.evaluate(() => { const { store } = window.__teachly; store.select(store.page.els.map((e) => e.id)); });
  await page.waitForTimeout(250);
  await page.click('[data-pact=moveto]');
  await page.waitForTimeout(250);
  check('picker lists pages and a new page', (await page.$$('.mp-grid button')).length === 4);
  await page.click('.mp-grid [data-to="1"]');
  await page.waitForTimeout(300);
  check('all 3 moved to page 2', await is(page, [0, 3, 0]), JSON.stringify(await counts(page)));
  await page.evaluate(() => window.__teachly.store.undo());
  check('undo returns all 3', await is(page, [3, 0, 0]));
  await page.evaluate(() => { const { store } = window.__teachly; store.select(store.page.els.map((e) => e.id)); });
  await page.waitForTimeout(250);
  await page.click('[data-pact=moveto]');
  await page.waitForTimeout(250);
  await page.click('.mp-new');
  await page.waitForTimeout(300);
  check('"+ New" makes a page and moves things there in one step', await is(page, [0, 0, 0, 3]), JSON.stringify(await counts(page)));
  await page.evaluate(() => window.__teachly.store.undo());
  check('one undo removes the new page again', await is(page, [3, 0, 0]), JSON.stringify(await counts(page)));

  // --- real finger drag (touch events) of the text onto page 2
  const text = await page.evaluate(() => window.__teachly.store.page.els.find((e) => e.type === 'text'));
  await page.evaluate(() => window.__teachly.store.clearSelection());
  const [tx, ty] = await scr(page, text.x + text.w / 2, text.y + text.h / 2);
  const t2 = await (await page.$$('.page-thumb'))[1].boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const P = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: P(tx, ty) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200); // a tap selects it
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: P(tx, ty) });
  for (let i = 1; i <= 14; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: P(tx + ((t2.x + t2.width / 2 - tx) * i) / 14, ty + ((t2.y + t2.height / 2 - ty) * i) / 14) });
  const hot = await page.$eval('.page-thumb.drop-on', (e) => e.dataset.i).catch(() => null);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  check('finger: page 2 lit up while dragging', hot === '1', String(hot));
  check('finger: text moved to page 2', await is(page, [2, 1, 0]), JSON.stringify(await counts(page)));
  await settled(page);
  await page.close();
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(2500);
  check('after closing and reopening the pages keep their things', await is(page, [2, 1, 0]), JSON.stringify(await counts(page)));
  const ids = await page.evaluate(() => window.__teachly.store.doc.pages.flatMap((p) => p.els.map((e) => e.id)));
  check('no duplicates, nothing lost (3 things in total)', ids.length === 3 && new Set(ids).size === 3);

  // --- auto-scroll of the panel: many pages in a short window
  await page.setViewportSize({ width: 1280, height: 560 });
  await page.evaluate(() => { const { store } = window.__teachly; for (let i = 0; i < 12; i++) store.addPage(); store.goTo(0); });
  await page.waitForTimeout(300);
  if (!(await page.$('.pages-list'))) { await page.click('[data-act=pages]'); await page.waitForTimeout(500); }
  const first = await page.evaluate(() => { const e = window.__teachly.store.page.els[0]; return { x: e.pts ? e.pts[0] : e.x + e.w / 2, y: e.pts ? e.pts[1] : e.y + e.h / 2 }; });
  await page.click('[data-tool=select]');
  const [ax, ay] = await scr(page, first.x, first.y);
  const lb = await (await page.$('.pages-list')).boundingBox();
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(ax + 30, ay + 10, { steps: 4 });
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height - 12, { steps: 10 });
  const s0 = await page.$eval('.pages-list', (e) => e.scrollTop);
  await page.waitForTimeout(700);
  const s1 = await page.$eval('.pages-list', (e) => e.scrollTop);
  await page.mouse.move(lb.x + lb.width / 2, lb.y + 12, { steps: 4 });
  await page.waitForTimeout(900);
  const s2 = await page.$eval('.pages-list', (e) => e.scrollTop);
  await page.mouse.up();
  check('panel scrolls down by itself near its bottom edge', s1 > s0 + 20, `${s0} -> ${s1}`);
  check('and back up near its top edge', s2 < s1 - 20, `${s1} -> ${s2}`);
  check('no page errors', errors.length === 0, errors.join('|'));
  await browser.close();
  finish();
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
