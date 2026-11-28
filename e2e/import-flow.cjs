// Import like other note apps: My notebooks > + > Import files, several PDFs at once. At once each file gets a
// "Preparing…" card with its name; each card turns into its own notebook (cover, page count); opened, the page has the
// PDF page's own shape on a grey desk (so nothing around it looks like part of the page), and the page count shows.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const { check, finish } = require('./lib.cjs');
const src = fs.readFileSync(path.join(__dirname, 'pdf-shape.cjs'), 'utf8');
const makePdf = eval('(' + src.slice(src.indexOf('function makePdf'), src.indexOf('const SIZES')) + ')');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pn-imp-'));
  const a = path.join(dir, 'Physics Chapter 1.pdf'), c = path.join(dir, 'Wide Slides.pdf');
  fs.writeFileSync(a, makePdf(Array(12).fill([595, 842])));
  fs.writeFileSync(c, makePdf(Array(4).fill([1600, 900])));
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.teachly.library.show());
  await p.waitForTimeout(900);
  const before = await p.$$eval('.nb-card:not(.nb-new):not(.nb-prep)', (e) => e.length);
  await p.tap('[data-lib=add]');
  await p.waitForTimeout(400);
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.tap('[data-lib=import]')]);
  await ch.setFiles([a, c]);
  await p.waitForTimeout(150);
  const prep = await p.$$eval('.nb-prep .nb-title', (e) => e.map((x) => x.textContent));
  check('several PDFs at once: a "Preparing…" card for each, with its name, at once', prep.join('|') === 'Physics Chapter 1|Wide Slides', prep.join('|'));
  await p.waitForFunction(() => !document.querySelector('.nb-prep'), null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(600);
  const cards = await p.$$eval('.nb-card:not(.nb-new):not(.nb-prep)', (e) => e.map((x) => x.querySelector('.nb-title').textContent + ' ' + x.querySelector('.nb-age')?.textContent + ' ' + x.dataset.o + ' ' + !!x.querySelector('.nb-cover img')));
  check('each file is now its own notebook with its cover, page count and shape', cards.length === before + 2 && cards.includes('Physics Chapter 1 12p p true') && cards.includes('Wide Slides 4p l true'), cards.join(' | '));
  await p.tap('.nb-card[data-o=p] .nb-cover[data-lib=open]');
  await p.waitForTimeout(2000);
  const v = await p.evaluate(() => {
    const { page } = window.__teachly;
    const cv = document.querySelector('canvas');
    const g = cv.getContext('2d');
    const px = g.getImageData(4, Math.round(cv.height / 2), 1, 1).data; // far left: outside the tall page
    return { ratio: page.PAGE.h / page.PAGE.w, desk: [...px.slice(0, 3)], count: document.body.innerText.includes('1 / 12') };
  });
  check('opened: the page has the PDF page\'s shape', Math.abs(v.ratio - 842 / 595) < 0.01, String(v.ratio));
  check('around the page is the grey desk, not the page colour', v.desk.join() === '201,204,209', v.desk.join());
  check('the page count shows (1 / 12)', v.count, '');
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
