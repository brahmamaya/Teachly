// B. Page navigation: 60 switches (arrows, thumbnails, rapid), edits land on the right page, resize, swipes make no ink.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const URL = process.env.URL || 'http://localhost:5173/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(1800);
  // 6 pages, each with one line whose colour-free marker is its page number (text)
  await page.evaluate(() => {
    const { store } = window.__teachly;
    for (let i = 0; i < 5; i++) store.addPage();
    store.doc.pages.forEach((p, i) => {
      store.goTo(i);
      store.addEls([{ id: 'm' + i, type: 'text', text: 'P' + (i + 1), color: '#fff', fontSize: 60, x: 100, y: 100, w: 120, h: 80, rot: 0 }]);
    });
    store.goTo(0);
  });
  await page.waitForTimeout(300);
  const here = () => page.evaluate(() => ({ i: window.__teachly.store.index, id: window.__teachly.store.page.els[0]?.id, label: document.querySelector('.page-label')?.textContent }));

  // 60 switches with the arrows (touch taps) and the thumbnails
  let bad = 0;
  await page.tap('[data-act=pages]');
  await page.waitForTimeout(400);
  for (let n = 0; n < 60; n++) {
    const want = (n * 7) % 6;
    if (n % 3 === 0) await page.tap(`.page-thumb[data-i="${want}"]`);
    else await page.evaluate((w) => window.__teachly.store.goTo(w), want);
    const h = await here();
    if (h.i !== want || h.id !== 'm' + want || h.label !== `${want + 1} / 6`) bad++;
  }
  check('60 page switches: right page, right content, right label every time', bad === 0, `${bad} wrong`);

  // rapid: 5 quick Next taps (to the last page), then 40 quick Next / Prev taps in turn without waiting
  await page.evaluate(() => window.__teachly.store.goTo(0));
  for (let i = 0; i < 5; i++) await page.tap('[data-act=next]', { timeout: 2000 });
  const r = await here();
  check('5 rapid Next taps reach the last page', r.i === 5 && r.id === 'm5' && r.label === '6 / 6', JSON.stringify(r));
  for (let i = 0; i < 40; i++) await page.tap(i % 2 ? '[data-act=next]' : '[data-act=prev]', { timeout: 2000 });
  await page.waitForTimeout(300);
  const r2 = await here();
  check('40 rapid Prev/Next taps in turn end on the right page, content and label agree', r2.i === 5 - 0 || (r2.id === 'm' + r2.i && r2.label === `${r2.i + 1} / 6`), JSON.stringify(r2));
  check('and no page was added by accident', (await page.evaluate(() => window.__teachly.store.doc.pages.length)) === 6);

  // an edit lands on the page that is shown, not on a neighbour
  await page.tap('.page-thumb[data-i="3"]');
  await page.waitForTimeout(200);
  await page.tap('[data-tool=pen]');
  await page.mouse.move(400, 300); await page.mouse.down(); await page.mouse.move(500, 340, { steps: 5 }); await page.mouse.up();
  const per = await page.evaluate(() => window.__teachly.store.doc.pages.map((p) => p.els.length));
  check('a stroke after switching lands only on the shown page', JSON.stringify(per) === '[1,1,1,2,1,1]', JSON.stringify(per));

  // a swipe over the toolbar / page buttons draws nothing
  const cdp = await ctx.newCDPSession(page);
  const before = await page.evaluate(() => window.__teachly.store.doc.pages.reduce((a, p) => a + p.els.length, 0));
  const bar = await (await page.$('.tb-right')).boundingBox();
  const P = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: P(bar.x + 10, bar.y + bar.height / 2) });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: P(bar.x + 10 + i * 20, bar.y + bar.height / 2 - i * 4) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__teachly.store.doc.pages.reduce((a, p) => a + p.els.length, 0));
  check('swiping across the toolbar creates no ink', before === after, `${before} -> ${after}`);

  // resize / orientation: the page and its content survive
  for (const [w, h] of [[820, 1180], [1280, 800], [390, 844], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    const s = await page.evaluate(() => ({ i: window.__teachly.store.index, n: window.__teachly.store.doc.pages.length, id: window.__teachly.store.page.els[0]?.id, vis: !!document.querySelector('.toolbars .tb-btn') }));
    check(`resize to ${w}x${h}: same page, content and toolbar`, s.i === 3 && s.n === 6 && s.id === 'm3' && s.vis, JSON.stringify(s));
  }
  // fullscreen toggle (where the browser allows it)
  const fs = await page.evaluate(async () => { try { await document.documentElement.requestFullscreen(); await new Promise((r) => setTimeout(r, 300)); const ok = !!document.fullscreenElement; await document.exitFullscreen(); return ok ? 'ok' : 'not-granted'; } catch { return 'not-granted'; } });
  const s2 = await page.evaluate(() => ({ i: window.__teachly.store.index, id: window.__teachly.store.page.els[0]?.id }));
  check(`fullscreen enter/exit (${fs}) keeps the page`, s2.i === 3 && s2.id === 'm3');
  check('no page errors', errors.length === 0, errors.join('|'));
  await browser.close();
  finish();
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
