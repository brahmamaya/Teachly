// A PDF's pages become pages exactly as the file has them: each page keeps its OWN shape (a PDF may mix sizes), the
// PDF page fills it edge to edge, nothing is fitted into a page of another shape:
//  1. a notebook with nothing written: Insert > PDF of mixed page sizes gives one page per PDF page, each in its shape;
//  2. turning to a page makes the board's page that page's shape (a tall page after a wide one and back);
//  3. a notebook with writing: the PDF's pages are added (at the end by default), each still in its own shape, and the
//     notebook's own pages keep theirs;
//  4. after a reload every page still has its shape.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, finish } = require('./lib.cjs');

// A PDF whose pages have the given sizes (points), each with a dark box so a drawn page shows.
function makePdf(sizes) {
  const objs = [];
  const add = (s) => objs.push(s) && objs.length;
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pagesId = objs.length + 1 + 2 * sizes.length;
  const kids = [];
  sizes.forEach(([w, h], i) => {
    const c = `0 0 0 rg 40 40 ${w - 80} ${h - 80} re f BT 1 1 1 rg /F1 40 Tf 80 ${h - 140} Td (Page ${i + 1}) Tj ET`;
    const cid = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${cid} 0 R >>`));
  });
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${sizes.length} >>`);
  const cat = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offs = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const SIZES = [[595, 842], [1600, 900], [842, 595]]; // A4 tall, a wide slide, A4 landscape
const RATIOS = SIZES.map(([w, h]) => h / w);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pn-shape-'));
  const mixed = path.join(dir, 'Mixed.pdf');
  fs.writeFileSync(mixed, makePdf(SIZES));
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 }, hasTouch: true })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const URL = process.env.URL || 'http://localhost:5173/';
  await p.goto(URL);
  await p.waitForTimeout(1800);
  const insert = async () => {
    await p.tap('[data-pop=insert]');
    await p.waitForTimeout(400);
    const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.tap('.popover [data-act=pdf]')]);
    await ch.setFiles(mixed);
  };
  // each PDF page: its shape and whether its picture fills its page exactly
  const pdfPages = () => p.evaluate(() => {
    const { store, page } = window.__teachly;
    return store.doc.pages.map((pg, i) => {
      const im = pg.els.find((e) => e.type === 'image' && e.pdf);
      if (!im) return { i, pdf: false, shape: pg.shape ?? null };
      const w = pg.shape >= 1 ? 900 : 1600, h = Math.round(w * pg.shape);
      return { i, pdf: true, shape: pg.shape, fill: Math.abs(im.x) < 0.5 && Math.abs(im.y) < 0.5 && Math.abs(im.w - w) < 0.5 && Math.abs(im.h - h) < 0.5 };
    });
  });
  const near = (a, b2) => Math.abs(a - b2) < 0.01;
  const shapesOk = (list) => list.length === 3 && list.every((x, k) => x.pdf && near(x.shape, RATIOS[k]) && x.fill);
  // 1. blank notebook
  await insert();
  await p.waitForTimeout(3500);
  let s = await pdfPages();
  check('blank notebook + a PDF of mixed page sizes: one page per PDF page, each in its own shape, filled edge to edge', s.length === 3 && shapesOk(s), JSON.stringify(s));
  // 2. turning pages: the board's page takes each page's shape
  const live = [];
  for (const i of [0, 1, 2, 0]) {
    await p.evaluate((i) => window.__teachly.store.goTo(i), i);
    await p.waitForTimeout(300);
    live.push(await p.evaluate(() => window.__teachly.page.PAGE.h / window.__teachly.page.PAGE.w));
  }
  check('turning pages: the page in view has that page\'s own shape (tall, wide, landscape, tall again)', live.every((r, k) => Math.abs(r - RATIOS[[0, 1, 2, 0][k]]) < 0.01), live.map((r) => r.toFixed(3)).join(' '));
  // 3. a notebook with writing (wide pages): added at the end, each page keeps its own shape
  await p.evaluate(() => { const { store } = window.__teachly; store.loadDoc({ version: 1, title: 'Lesson', pages: [{ id: 'a', bg: '#000000', pattern: 'none', els: [{ id: 'l', type: 'path', pts: [100, 100, 0.5, 300, 200, 0.5], style: 'pen', color: '#fff', size: 3, opacity: 1 }] }] }); });
  await p.waitForTimeout(800);
  await insert();
  await p.waitForSelector('.dl-box', { timeout: 8000 });
  const pre = await p.evaluate(() => document.querySelector('.dl-row.on')?.dataset.m);
  await p.tap('.dl-go');
  await p.waitForTimeout(3500);
  s = await pdfPages();
  check('notebook with writing: "at the end" first, the PDF\'s pages added after it, each in its own shape', pre === 'end' && s.length === 4 && !s[0].pdf && s[0].shape === null && shapesOk(s.slice(1)), JSON.stringify({ pre, s }));
  // 4. reload: the shapes stay
  await p.evaluate(() => window.__teachly.autosave.saveNow());
  await p.reload();
  await p.waitForTimeout(2500);
  s = await pdfPages();
  check('after a reload every page still has its own shape', s.length === 4 && shapesOk(s.slice(1)), JSON.stringify(s));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
