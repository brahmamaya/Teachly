// My notebooks: the list / covers switch, the + menu (New notebook, Import files), and Import files: every file
// becomes a notebook whose pages take the file's shape. A 5000-page PDF is added in seconds without freezing.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, finish } = require('./lib.cjs');

// A plain PDF of n pages (w × h points), each with its number written on it.
function makePdf(n, w, h) {
  const objs = [];
  const add = (s) => objs.push(s) && objs.length;
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pagesId = objs.length + 1 + 2 * n;
  const kids = [];
  for (let i = 0; i < n; i++) {
    const c = `BT /F1 40 Tf 60 ${h - 100} Td (Page ${i + 1}) Tj ET`;
    const cid = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${cid} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${n} >>`);
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

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teachly-import-'));
  const a4 = path.join(dir, 'Chapter A4.pdf');
  const book = path.join(dir, 'Big book.pdf');
  fs.writeFileSync(a4, makePdf(3, 595, 842));
  fs.writeFileSync(book, makePdf(5000, 842, 595));
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1500);
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('[data-act=library]');
  await page.waitForTimeout(1000);

  await page.click('[data-lib=layout]');
  await page.waitForTimeout(400);
  check('the list button shows the notebooks as rows', await page.evaluate(() => document.querySelector('.lib-grid').classList.contains('as-list') && document.querySelector('.lib-layout').getAttribute('aria-pressed') === 'true'));
  await page.click('[data-lib=layout]');
  await page.waitForTimeout(400);
  check('tapped again: covers again', await page.evaluate(() => !document.querySelector('.lib-grid').classList.contains('as-list')));

  await page.click('.lib-fab');
  await page.waitForTimeout(300);
  const items = await page.$$eval('.lib-addmenu [data-lib]', (n) => n.map((e) => e.dataset.lib).join(','));
  check('+ offers New notebook and Import files', items === 'new,import', items);

  const importFiles = async (files, wait) => {
    if (!(await page.$('.lib-addmenu'))) {
      await page.click('.lib-fab');
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => {
      window.__gap = 0;
      let last = performance.now();
      const f = (t) => {
        window.__gap = Math.max(window.__gap, t - last);
        last = t;
        window.__raf = requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const t0 = Date.now();
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-lib=import]')]);
    await fc.setFiles(files);
    await page.waitForFunction((w) => document.querySelector('.toasts')?.textContent?.includes(w), wait, { timeout: 120000 });
    const s = (Date.now() - t0) / 1000;
    const gap = await page.evaluate(() => (cancelAnimationFrame(window.__raf), Math.round(window.__gap)));
    const info = await page.evaluate(() => ({ pages: window.__teachly.store.doc.pages.length, shape: window.__teachly.store.doc.shape, title: window.__teachly.store.doc.title }));
    return { s, gap, ...info };
  };

  const r1 = await importFiles([a4], '"Chapter A4" is now a notebook');
  check('an A4 PDF becomes a notebook with A4-shaped pages', r1.title === 'Chapter A4' && r1.pages === 3 && Math.abs(r1.shape - 842 / 595) < 0.01, JSON.stringify(r1));
  await page.waitForTimeout(600);
  check('it is in My notebooks, with a tall cover', await page.evaluate(() => [...document.querySelectorAll('.nb-card[data-id]')].some((c) => c.textContent.includes('Chapter A4') && c.dataset.o === 'p')));

  const r2 = await importFiles([book], '"Big book" is now a notebook');
  check('a 5000-page PDF becomes a notebook (landscape pages)', r2.pages === 5000 && Math.abs(r2.shape - 595 / 842) < 0.01, JSON.stringify(r2));
  check('…in under 20 s, the screen never frozen (no frame over 250 ms)', r2.s < 20 && r2.gap < 250, `${r2.s}s, longest frame gap ${r2.gap} ms`);
  await page.click('[data-lib=close]');
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__teachly.store.goTo(4321));
  await page.waitForTimeout(400);
  check('page 4322 of 5000 opens', (await page.textContent('.page-label')).replace(/\s/g, '') === '4322/5000');
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  fs.rmSync(dir, { recursive: true, force: true });
  finish();
})();
