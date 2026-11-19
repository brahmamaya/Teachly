// Privacy: while the app is used, the device talks to Teachly's own address only (no fonts, scripts, pictures or anything else from other websites).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const url = process.env.URL || 'http://localhost:5173/';
  const own = new URL(url).origin;
  const seen = new Set();
  const outside = [];
  ctx.on('request', (r) => {
    const u = r.url();
    seen.add(u.split('?')[0]);
    if (!u.startsWith(own) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('about:')) outside.push(u);
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url);
  await page.waitForTimeout(2000);
  // a spread of features: tools, subject pieces, menus, library with covers, exports
  await page.evaluate(() => { const { store } = window.__teachly; store.setSettings({ subject: 'phy-11-nlm' }); store.setTool({ tool: 'pen' }); });
  await page.waitForTimeout(600);
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('[data-act=tbedit]');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.click('.doc-title');
  await page.waitForTimeout(900);
  await page.click('.nb-new');
  await page.waitForTimeout(600);
  for (const t of ['phy', 'zoo', 'bot']) { await page.click(`.cv-tab[data-cg="${t}"]`); await page.waitForTimeout(150); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }).catch(() => null), page.evaluate(async () => { const m = await import('/src/io/files.ts'); await m.exportScreenshot(window.teachly.board); })]);
  check('a screenshot can be made (offline work)', !!dl);
  await page.evaluate(async () => { const m = await import('/src/io/pdfvector.ts'); const { store } = window.__teachly; await m.makePdf(store.doc.pages, 2); }).catch(() => {});
  await page.waitForTimeout(1500);
  check('the app really made requests of its own', seen.size > 5, `${seen.size}`);
  check('no request went to any other website', outside.length === 0, outside.slice(0, 5).join(' | '));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
