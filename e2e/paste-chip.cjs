// Copy a shape, go to another page, tap the floating Paste button.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  check('no Paste button before anything is copied', await page.$eval('.paste-chip', (e) => e.hidden));
  await page.evaluate(() => {
    const { store } = window.__teachly;
    store.addEls([{ id: 't1', type: 'path', pts: [300, 400, 0.5, 500, 400, 0.5, 400, 200, 0.5], style: 'shape', color: '#ef4444', size: 4, opacity: 1, closed: true, fill: '#ef4444' }]);
    store.setTool({ tool: 'select' });
    store.select(['t1']);
  });
  await page.waitForTimeout(300);
  await page.click('[data-pact=copy]');
  await page.waitForTimeout(300);
  check('after Copy a Paste button shows', !(await page.$eval('.paste-chip', (e) => e.hidden)) && /Paste 1 item/.test(await page.$eval('.paste-chip', (e) => e.textContent)));
  await page.evaluate(() => { const { store } = window.__teachly; store.addPage(); store.goTo(1); });
  await page.waitForTimeout(300);
  check('it is still there on the next page', !(await page.$eval('.paste-chip', (e) => e.hidden)));
  await page.click('.pc-go');
  await page.waitForTimeout(300);
  const els = await page.evaluate(() => window.__teachly.store.page.els.map((e) => [e.pts[0], e.pts[1]]));
  check('one tap pastes it on this page, same place', els.length === 1 && els[0][0] === 300 && els[0][1] === 400, JSON.stringify(els));
  await page.click('.pc-x');
  check('the cross closes the Paste button', await page.$eval('.paste-chip', (e) => e.hidden));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
