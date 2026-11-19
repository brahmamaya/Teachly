// Redesign checks: state cues (aria), Escape layers, copy/move to page, safer Delete page, document title, large buttons.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);

  // --- state cues for assistive technology (and a second cue besides colour)
  const names = await page.evaluate(() => [...document.querySelectorAll('.toolbars button')].filter((b) => !b.closest('.hexdock')).filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim())).length);
  check('every toolbar button has an accessible name', names === 0, `${names} without`);
  await page.click('[data-tool=eraser]');
  await page.waitForTimeout(200);
  const pressed = await page.evaluate(() => [...document.querySelectorAll('.tb-left [data-tool]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.tool));
  check('exactly the active tool is marked aria-pressed', pressed.length === 1 && pressed[0] === 'eraser', pressed.join());
  await page.click('[data-pop=insert]');
  await page.waitForTimeout(300);
  check('an open menu button says aria-expanded=true', (await page.getAttribute('[data-pop=insert]', 'aria-expanded')) === 'true');
  const lonely = await page.evaluate(() => [...document.querySelectorAll('.popover button')].filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim())).length);
  check('buttons inside menus are named too', lonely === 0, `${lonely} without`);

  // --- Escape closes one layer at a time
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('Escape closes the open menu first', !(await page.$('.popover')));
  await page.evaluate(() => { const { store } = window.__teachly; store.addEls([{ id: 'e1', type: 'text', text: 'hi', color: '#fff', fontSize: 40, x: 300, y: 300, w: 60, h: 50, rot: 0 }]); store.setTool({ tool: 'select' }); store.select(['e1']); });
  await page.click('[data-act=pages]');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('with something selected, Escape clears the selection and keeps the Pages panel', (await page.evaluate(() => window.__teachly.store.selection.size)) === 0 && !!(await page.$('.pages-panel')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('the next Escape closes the Pages panel', !(await page.$('.pages-panel')));

  // --- the notebook's name is always visible and opens My notebooks
  const title = await page.$eval('.doc-title', (e) => e.textContent);
  check('the notebook name is shown top left', title === 'My notebook', title);
  await page.click('.doc-title');
  await page.waitForTimeout(700);
  check('and opens My notebooks', !!(await page.$('.library')));
  await page.click('.library [data-lib=close]');
  await page.waitForTimeout(400);

  // --- Move and Copy to a page
  await page.evaluate(() => { const { store } = window.__teachly; store.addPage(); store.goTo(0); store.setTool({ tool: 'select' }); store.select(['e1']); });
  await page.waitForTimeout(300);
  await page.click('[data-pact=moveto]');
  await page.waitForTimeout(300);
  check('the picker has a Move / Copy switch (Move is chosen first)', (await page.getAttribute('.mp-seg [data-mode=move]', 'aria-pressed')) === 'true' && !!(await page.$('.mp-seg [data-mode=copy]')));
  await page.click('.mp-seg [data-mode=copy]');
  await page.click('.mp-grid [data-to="1"]');
  await page.waitForTimeout(300);
  const counts = await page.evaluate(() => window.__teachly.store.doc.pages.map((p) => p.els.length));
  check('Copy: the thing is on both pages', JSON.stringify(counts) === '[1,1]', JSON.stringify(counts));
  const copy = await page.evaluate(() => { const [a, b] = window.__teachly.store.doc.pages; return { sameId: a.els[0].id === b.els[0].id, sameText: a.els[0].text === b.els[0].text, samePlace: a.els[0].x === b.els[0].x && a.els[0].y === b.els[0].y, textType: b.els[0].type }; });
  check('the copy is its own thing (new id), still text, same place', !copy.sameId && copy.sameText && copy.samePlace && copy.textType === 'text', JSON.stringify(copy));
  await page.evaluate(() => window.__teachly.store.undo());
  check('one undo removes the copy', JSON.stringify(await page.evaluate(() => window.__teachly.store.doc.pages.map((p) => p.els.length))) === '[1,0]');
  await page.evaluate(() => { const { store } = window.__teachly; store.select(['e1']); });
  await page.waitForTimeout(250);
  await page.click('[data-pact=moveto]');
  await page.waitForTimeout(300);
  check('Move is remembered as the default again after a copy only if chosen (Copy stays selected)', (await page.getAttribute('.mp-seg [data-mode=copy]', 'aria-pressed')) === 'true');
  await page.click('.mp-seg [data-mode=move]');
  await page.click('.mp-grid [data-to="1"]');
  await page.waitForTimeout(300);
  check('Move: the thing leaves this page', JSON.stringify(await page.evaluate(() => window.__teachly.store.doc.pages.map((p) => p.els.length))) === '[0,1]');
  await page.evaluate(() => window.__teachly.store.undo());

  // --- Delete page asks twice
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('.mt-tile[data-act=delete-page]');
  await page.waitForTimeout(200);
  check('Delete page: the first tap only asks', (await page.evaluate(() => window.__teachly.store.doc.pages.length)) === 2 && !!(await page.$('.mt-tile.armed')));
  await page.click('.mt-tile[data-act=delete-page]');
  await page.waitForTimeout(250);
  check('the second tap deletes (and it can be undone)', (await page.evaluate(() => window.__teachly.store.doc.pages.length)) === 1);
  await page.evaluate(() => window.__teachly.store.undo());
  check('undo brings the page back', (await page.evaluate(() => window.__teachly.store.doc.pages.length)) === 2);

  // --- Save picture (PNG) is reachable now
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.click('.mt-tile[data-act=export-png]')]);
  check('Menu ▸ Save picture downloads a PNG of the page', !!dl && /\.png$/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : 'no download');
  await page.keyboard.press('Escape');

  // --- the update button: appears, saves first, then reloads
  await page.evaluate(() => window.__teachly.showUpdatePill());
  check('"New version ready" button can be shown', !!(await page.$('.update-pill')));
  await page.evaluate(() => { window.__marker = 'before-reload'; });
  await Promise.all([page.waitForEvent('framenavigated', { timeout: 15000 }), page.click('.update-pill')]);
  await page.waitForTimeout(1800);
  check('tapping it saves, then reloads the app (the notebook is still there)', (await page.evaluate(() => window.__marker)) === undefined && (await page.evaluate(() => window.__teachly.store.doc.pages.length)) === 2);

  // --- Large buttons: bigger on request, compact by default
  await page.keyboard.press('Escape');
  const small = await page.$eval('.tb-left .tb-btn', (e) => e.getBoundingClientRect().width);
  await page.evaluate(() => window.__teachly.store.setSettings({ bigControls: true }));
  await page.waitForTimeout(500);
  const big = await page.$eval('.tb-left .tb-btn', (e) => e.getBoundingClientRect().width);
  check(`Large buttons make the toolbar buttons bigger (${small.toFixed(0)} px -> ${big.toFixed(0)} px)`, big > small * 1.3, `${small} -> ${big}`);
  await page.evaluate(() => window.__teachly.store.setSettings({ bigControls: false }));
  await page.waitForTimeout(500);
  const back = await page.$eval('.tb-left .tb-btn', (e) => e.getBoundingClientRect().width);
  check('and compact is back when switched off', Math.abs(back - small) < 0.5, `${back} vs ${small}`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
