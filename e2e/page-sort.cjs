// Pages panel: hold a page and drag it to a new place (touch and mouse), smooth and one undo step.
// Add PDF: a notebook with pages asks where the PDF goes (at the end by default) and puts it there.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const SHOT = process.env.SHOT;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1600);
  // 12 pages, each with its number written on it
  await page.evaluate(() => {
    const { store } = window.__teachly;
    const pages = Array.from({ length: 12 }, (_, i) => ({ ...store.doc.pages[0], id: 'p' + (i + 1), els: [{ id: 't' + (i + 1), type: 'text', text: 'P' + (i + 1), color: '#fff', fontSize: 60, x: 100, y: 100, w: 120, h: 70, rot: 0 }] }));
    store.commit(pages, 0);
  });
  const order = () => page.evaluate(() => window.__teachly.store.doc.pages.map((p) => p.id.slice(1)).join(','));
  await page.click('[data-act=pages]');
  await page.waitForTimeout(800);
  const thumb = async (n) => (await page.$(`.pages-list .page-thumb[data-i="${n}"]`)).boundingBox();

  // touch: hold page 10, drag it up to where page 8 is
  await page.evaluate(() => document.querySelector('.pages-list .page-thumb[data-i="9"]').scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(300);
  const cdp = await ctx.newCDPSession(page);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const a = await thumb(9);
  const x = a.x + a.width / 2, y0 = a.y + a.height / 2;
  await tp('touchStart', x, y0);
  await page.waitForTimeout(600); // long press (a hold of 0.45 s picks a page up)
  check('holding a page lifts it (a copy follows the finger)', !!(await page.$('.page-ghost')));
  const step = (await thumb(9)).y - (await thumb(8)).y;
  const target = y0 - step * 2;
  for (let i = 1; i <= 12; i++) await tp('touchMove', x, y0 + ((target - y0) * i) / 12);
  await page.waitForTimeout(250);
  const shifted = await page.evaluate(() => [...document.querySelectorAll('.pages-list .page-thumb')].filter((t) => t.style.transform.includes('translateY')).length);
  check('the other pages slide aside to make room', shifted === 2, String(shifted));
  if (SHOT) await page.screenshot({ path: SHOT + '/page-sort.png' });
  await tp('touchEnd');
  await page.waitForTimeout(500);
  check('page 10 is now page 8', (await order()) === '1,2,3,4,5,6,7,10,8,9,11,12', await order());
  check('the drag copy is gone', !(await page.$('.page-ghost')));
  await page.evaluate(() => window.__teachly.store.undo());
  check('one undo puts it back', (await order()) === '1,2,3,4,5,6,7,8,9,10,11,12', await order());

  // a quick swipe on the list only scrolls (no drag)
  await page.evaluate(() => (document.querySelector('.pages-list').scrollTop = 0));
  const s = await thumb(2);
  await tp('touchStart', s.x + s.width / 2, s.y + s.height / 2);
  for (let i = 1; i <= 6; i++) await tp('touchMove', s.x + s.width / 2, s.y + s.height / 2 - i * 20);
  await tp('touchEnd');
  await page.waitForTimeout(300);
  check('a quick swipe does not move a page', (await order()) === '1,2,3,4,5,6,7,8,9,10,11,12', await order());

  // mouse: drag page 2 down below page 4
  await page.evaluate(() => (document.querySelector('.pages-list').scrollTop = 0));
  await page.waitForTimeout(200);
  const m = await thumb(1);
  const st = (await thumb(2)).y - m.y;
  await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2 + (st * 2.2 * i) / 10);
  await page.mouse.up();
  await page.waitForTimeout(500);
  check('mouse drag: page 2 moved below page 4', (await order()) === '1,3,4,2,5,6,7,8,9,10,11,12', await order());

  // hold a page and drag it out over the board: its content is copied onto the open page, selected (to move / resize)
  await page.evaluate(() => { window.__teachly.store.goTo(0); document.querySelector('.pages-list').scrollTop = 0; });
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => window.__teachly.store.page.els.length);
  const q = await thumb(2); // page "4" sits at place 3 now
  const qx = q.x + q.width / 2, qy = q.y + q.height / 2;
  await tp('touchStart', qx, qy);
  await page.waitForTimeout(600); // hold (0.45 s picks a page up)
  for (let i = 1; i <= 12; i++) await tp('touchMove', qx - (qx - 400) * (i / 12), qy + (400 - qy) * (i / 12));
  await page.waitForTimeout(250);
  check('over the board the page shrinks and says where it goes', !!(await page.$('.page-ghost.out')));
  check('and the pages in the list go back to their places', await page.evaluate(() => [...document.querySelectorAll('.pages-list .page-thumb')].every((t) => !t.style.transform)));
  if (SHOT) await page.screenshot({ path: SHOT + '/page-out.png' });
  await tp('touchEnd');
  await page.waitForTimeout(500);
  const dropped = await page.evaluate(() => { const { store } = window.__teachly; const els = store.page.els; return { n: els.length, text: els.map((e) => e.text).join(','), sel: store.selection.size, tool: store.tool.tool, unlocked: els.every((e) => !e.locked) }; });
  check('its content is now on the open page, selected so it can be moved or resized', dropped.n === before + 1 && dropped.text.includes('P4') && dropped.sel === 1 && dropped.tool === 'select', JSON.stringify(dropped));
  check('the page order did not change', (await order()) === '1,3,4,2,5,6,7,8,9,10,11,12', await order());

  // add a PDF at the end of the notebook
  const pdfBytes = await page.evaluate(async () => {
    const m = await import('/src/io/pdfvector.ts');
    const { store } = window.__teachly;
    const r = await m.makePdf(store.doc.pages.slice(0, 3), 1);
    return [...new Uint8Array(await r.blob.arrayBuffer())];
  });
  await page.evaluate(() => window.__teachly.store.goTo(1));
  await page.click('[data-pop=insert]');
  await page.waitForTimeout(300);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.pm-item[data-act=pdf]')]);
  await chooser.setFiles({ name: 'Chapter 2.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) });
  await page.waitForTimeout(500);
  check('a notebook with pages asks where the PDF goes', !!(await page.$('.dl-box [data-m=end].on')) && !!(await page.$('.dl-box [data-m=after]')) && !!(await page.$('.dl-box [data-m=start]')));
  if (SHOT) await page.screenshot({ path: SHOT + '/pdf-place.png' });
  await page.click('.dl-go');
  await page.waitForTimeout(2500);
  const st2 = await page.evaluate(() => { const { store } = window.__teachly; return { n: store.doc.pages.length, at: store.index, firstNew: !!store.doc.pages[12]?.els[0]?.pdf, last: store.doc.pages[11].id }; });
  check('"At the end": its 3 pages come after the last page and the first of them opens', st2.n === 15 && st2.at === 12 && st2.firstNew && st2.last === 'p12', JSON.stringify(st2));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
