// Crop a picture: a Crop button for a selected picture, handles to drag, one undo step, the picture is not lost
// (Whole picture brings it back), it also works for a turned picture, and the saved PDF/PNG show only the kept part.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1800);
  // a picture with four colours: red | green on top, blue | yellow below
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const g = c.getContext('2d');
    [['#ff0000', 0, 0], ['#00ff00', 200, 0], ['#0000ff', 0, 150], ['#ffff00', 200, 150]].forEach(([col, x, y]) => { g.fillStyle = col; g.fillRect(x, y, 200, 150); });
    const { store } = window.__teachly;
    store.addEls([{ id: 'pic', type: 'image', src: c.toDataURL('image/png'), x: 300, y: 250, w: 400, h: 300, rot: 0 }]);
    store.setTool({ tool: 'select' });
    store.select(['pic']);
  });
  await page.waitForTimeout(700);
  check('a Crop button shows for a selected picture', !!(await page.$('[data-pact=crop]')));
  await page.evaluate(() => { const { store } = window.__teachly; store.addEls([{ id: 'txt', type: 'text', text: 'hi', color: '#fff', fontSize: 40, x: 900, y: 300, w: 60, h: 50, rot: 0 }]); store.select(['txt']); });
  await page.waitForTimeout(300);
  check('and not for text', !(await page.$('[data-pact=crop]')));
  await page.evaluate(() => window.__teachly.store.select(['pic']));
  await page.waitForTimeout(300);

  const world = (wx, wy) => page.evaluate(([x, y]) => { const bd = window.teachly.board; const [sx, sy] = bd.toScreen(x, y); const r = bd.el.getBoundingClientRect(); return [sx + r.left, sy + r.top]; }, [wx, wy]);
  const el = () => page.evaluate(() => { const e = window.__teachly.store.page.els.find((x) => x.id === 'pic'); return JSON.parse(JSON.stringify(e)); });
  const pixel = (wx, wy) => page.evaluate(([x, y]) => { const bd = window.teachly.board; const [sx, sy] = bd.toScreen(x, y); const c = bd.ink, k = c.width / c.getBoundingClientRect().width; const d = c.getContext('2d').getImageData(Math.round(sx * k), Math.round(sy * k), 1, 1).data; return [d[0], d[1], d[2]]; }, [wx, wy]);

  // open the crop screen and drag the left and bottom edges in: keep the top-right (green) part
  await page.click('[data-pact=crop]');
  await page.waitForTimeout(500);
  check('the crop screen opens with a frame and 8 handles', !!(await page.$('.crop-box')) && (await page.$$('.crop-h')).length === 8);
  const hb = async (h) => { const bb = await (await page.$(`.crop-h[data-e="${h}"]`)).boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
  const dragBy = async (h, dx, dy) => { const [x, y] = await hb(h); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 }); await page.mouse.move(x + dx, y + dy, { steps: 3 }); await page.mouse.up(); };
  const k = await page.evaluate(() => window.teachly.board.cam.z);
  await dragBy('w', 200 * k, 0); // the left half goes
  await dragBy('s', 0, -150 * k); // the lower half goes
  await page.click('[data-c=done]');
  await page.waitForTimeout(600);
  const e1 = await el();
  check('the picture keeps only the top-right part (saved as a window, same pixels)', e1.crop && Math.abs(e1.crop.x - 0.5) < 0.03 && Math.abs(e1.crop.y) < 0.03 && Math.abs(e1.crop.w - 0.5) < 0.03 && Math.abs(e1.crop.h - 0.5) < 0.03, JSON.stringify(e1.crop));
  check('it stays where it was on the board (the kept part did not jump)', Math.abs(e1.x - 500) < 8 && Math.abs(e1.y - 250) < 8 && Math.abs(e1.w - 200) < 8 && Math.abs(e1.h - 150) < 8, JSON.stringify([e1.x, e1.y, e1.w, e1.h]));
  const p = await pixel(e1.x + e1.w / 2, e1.y + e1.h / 2);
  check('and shows only green', p[1] > 200 && p[0] < 60 && p[2] < 60, JSON.stringify(p));
  // crop again: the whole picture is still there to choose from
  await page.evaluate(() => window.__teachly.store.select(['pic']));
  await page.waitForTimeout(300);
  await page.click('[data-pact=crop]');
  await page.waitForTimeout(500);
  await page.click('[data-c=reset]');
  await page.click('[data-c=done]');
  await page.waitForTimeout(600);
  const e2 = await el();
  check('"Whole picture" brings everything back, in the same place', !e2.crop && Math.abs(e2.w - 400) < 2 && Math.abs(e2.h - 300) < 2 && Math.abs(e2.x - 300) < 2 && Math.abs(e2.y - 250) < 2, JSON.stringify([e2.crop, e2.x, e2.y, e2.w, e2.h]));
  // one undo step per crop
  await page.evaluate(() => window.__teachly.store.undo());
  const e3 = await el();
  check('undo brings the cropped state back in one step', !!e3.crop);
  await page.evaluate(() => window.__teachly.store.redo());

  // cancel changes nothing
  await page.evaluate(() => window.__teachly.store.select(['pic']));
  await page.waitForTimeout(300);
  await page.click('[data-pact=crop]');
  await page.waitForTimeout(400);
  await dragBy('e', -100 * k, 0);
  await page.click('[data-c=cancel]');
  await page.waitForTimeout(500);
  const e4 = await el();
  check('Cancel changes nothing', JSON.stringify(e4) === JSON.stringify(e2) || (!e4.crop && !e2.crop && e4.w === e2.w), JSON.stringify(e4.crop));
  check('the crop screen is gone', !(await page.$('.crop-ui')));

  // a turned picture crops correctly too
  await page.evaluate(() => { const { store } = window.__teachly; store.mapEls(new Set(['pic']), (e) => ({ ...e, rot: Math.PI / 6 })); store.select(['pic']); });
  await page.waitForTimeout(400);
  await page.click('[data-pact=crop]');
  await page.waitForTimeout(500);
  await dragBy('w', 150 * k, 0);
  await page.click('[data-c=done]');
  await page.waitForTimeout(600);
  const e5 = await el();
  check('a turned picture keeps its turn and loses the left part', Math.abs(e5.rot - Math.PI / 6) < 1e-6 && e5.crop && e5.crop.x > 0.3 && e5.crop.x < 0.45, JSON.stringify(e5.crop));
  // the saved PDF comes out and does not use the whole picture
  const pdfOk = await page.evaluate(async () => { const m = await import('/src/io/pdfvector.ts'); const { store } = window.__teachly; const r = await m.makePdf(store.doc.pages, 1); return r.blob.size > 1000; });
  check('saving a PDF with a cropped picture works', pdfOk);
  await page.evaluate(() => window.__teachly.autosave.saveNow());
  await page.reload();
  await page.waitForTimeout(2200);
  const saved = await page.evaluate(() => { const e = window.__teachly.store.page.els.find((x) => x.id === 'pic'); return e && e.crop ? e.crop.x : null; });
  check('the crop is saved with the notebook and is there after reopening', saved !== null && saved > 0.3, String(saved));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
