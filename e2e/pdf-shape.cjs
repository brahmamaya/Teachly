// A PDF's pages become the notebook's pages (slides), not pictures pasted on pages of another shape:
//  1. a notebook with nothing written: Insert > PDF gives pages exactly the PDF's shape, each PDF page filling its page;
//  2. a notebook with writing and pages of another shape: the "where" dialog offers, and preselects, "as its own
//     notebook", which opens it with pages exactly like the PDF (the old notebook stays);
//  3. a PDF of the same shape as the notebook: added at the end by default, filling the pages.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, finish } = require('./lib.cjs');
const src = fs.readFileSync(path.join(__dirname, 'pdf-board.cjs'), 'utf8');
const makePdf = eval('(' + src.slice(src.indexOf('function makePdf'), src.indexOf('(async () =>')) + ')');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pn-shape-'));
  const tall = path.join(dir, 'Notes A4.pdf'), wide = path.join(dir, 'Slides.pdf');
  fs.writeFileSync(tall, makePdf(3, 595, 842));
  fs.writeFileSync(wide, makePdf(2, 1600, 900));
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 }, hasTouch: true })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(1800);
  const insert = async (file) => {
    await p.tap('[data-pop=insert]');
    await p.waitForTimeout(400);
    const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.tap('.popover [data-act=pdf]')]);
    await ch.setFiles(file);
  };
  // the PDF pages: does each picture fill its page exactly?
  const state = () => p.evaluate(() => {
    const { store } = window.__teachly;
    const pdf = store.doc.pages.filter((pg) => pg.els.some((e) => e.type === 'image' && e.pdf));
    const W = 1600, sh = store.doc.shape;
    const fill = pdf.every((pg) => { const im = pg.els.find((e) => e.pdf); const H = sh ? (sh >= 1 ? 900 * sh : 1600 * sh) : 900; const PW = sh && sh >= 1 ? 900 : W; return Math.abs(im.x) < 1 && Math.abs(im.y) < 1 && Math.abs(im.w - PW) < 1 && Math.abs(im.h - H) < 1; });
    return { id: store.doc.id, pages: store.doc.pages.length, pdf: pdf.length, shape: sh, fill };
  });
  // 1. blank notebook
  await insert(tall);
  await p.waitForTimeout(3000);
  let s = await state();
  check('blank notebook + tall PDF: the pages take the PDF\'s shape and are exactly its 3 pages', s.pdf === 3 && s.pages === 3 && Math.abs(s.shape - 842 / 595) < 0.01, JSON.stringify(s));
  check('…each PDF page fills its page (nothing pasted on a page of another shape)', s.fill, JSON.stringify(s));
  // 2. a notebook with writing, other shape
  await p.evaluate(() => { const { store } = window.__teachly; store.loadDoc({ version: 1, title: 'Lesson', pages: [{ id: 'a', bg: '#000000', pattern: 'none', els: [{ id: 'l', type: 'path', pts: [100, 100, 0.5, 300, 200, 0.5], style: 'pen', color: '#fff', size: 3, opacity: 1 }] }] }); });
  await p.waitForTimeout(800);
  const before = await state();
  await insert(tall);
  await p.waitForSelector('.dl-box', { timeout: 8000 });
  const pre = await p.evaluate(() => document.querySelector('.dl-row.on')?.dataset.m);
  check('notebook with writing + PDF of another shape: "as its own notebook" is offered and chosen first', pre === 'own', String(pre));
  await p.tap('.dl-go');
  await p.waitForTimeout(3500);
  s = await state();
  check('…it opens as its own notebook with pages exactly like the PDF', s.id !== before.id && s.pdf === 3 && s.pages === 3 && Math.abs(s.shape - 842 / 595) < 0.01 && s.fill, JSON.stringify(s));
  // 3. same shape: added to this notebook at the end
  await p.evaluate(() => { const { store } = window.__teachly; store.loadDoc({ version: 1, title: 'Wide', pages: [{ id: 'b', bg: '#000000', pattern: 'none', els: [{ id: 'm', type: 'path', pts: [100, 100, 0.5, 300, 200, 0.5], style: 'pen', color: '#fff', size: 3, opacity: 1 }] }] }); });
  await p.waitForTimeout(800);
  const id3 = await p.evaluate(() => window.__teachly.store.doc.id);
  await insert(wide);
  await p.waitForSelector('.dl-box', { timeout: 8000 });
  const pre3 = await p.evaluate(() => document.querySelector('.dl-row.on')?.dataset.m);
  await p.tap('.dl-go');
  await p.waitForTimeout(3000);
  s = await state();
  check('PDF of the same shape: "at the end" is chosen first, and its pages are added to this notebook, filling them', pre3 === 'end' && s.id === id3 && s.pages === 3 && s.pdf === 2 && s.fill, JSON.stringify({ pre3, ...s }));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
