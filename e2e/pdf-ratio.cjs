// A file's pages keep the file's own shape everywhere, with no lines around them:
//  1. a page filled edge to edge by its PDF page is exported (Save PDF) exactly that size: no band of board colour
//     round it (the region used to add 24 units all round);
//  2. an older notebook where the PDF page sits inside a page of another shape, written on only inside it: the saved
//     page has the PDF page's own shape; written on outside it: the whole page is kept;
//  3. a file's page is drawn with nothing outside it (no shadow or edge line, which showed as lines round dark pages).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { check, finish } = require('./lib.cjs');
const src = fs.readFileSync(path.join(__dirname, 'pdf-board.cjs'), 'utf8');
const makePdf = eval('(' + src.slice(src.indexOf('function makePdf'), src.indexOf('(async () =>')) + ')');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(1800);
  const bytes = [...makePdf(2, 595, 842)];
  const r = await p.evaluate(async (bytes) => {
    const { store } = window.__teachly;
    const file = new File([new Uint8Array(bytes)], 'A4.pdf', { type: 'application/pdf' });
    const { importPdf } = await import('/src/io/files.ts');
    const { makePdf } = await import('/src/io/pdfvector.ts');
    const { firstPageShape } = await import('/src/io/pdfpages.ts');
    const { pageRegion } = await import('/src/renderer.ts');
    const { PAGE } = await import('/src/page.ts');
    const shapeOf = async (pages) => firstPageShape((await makePdf(pages, 1)).blob);
    // 1. blank notebook: pages take the PDF's shape and fill it
    store.commit([{ ...store.page, els: [] }], 0);
    await importPdf(window.teachly.board, file, undefined, undefined, true);
    const filled = store.doc.pages[0];
    const reg = pageRegion(filled.els);
    const one = { region: reg, page: { ...PAGE }, saved: await shapeOf([filled]) };
    // 2. an older notebook: the A4 page inside a wide page, ink inside it / outside it
    store.loadDoc({ version: 1, title: 'Old', pages: [{ id: 'o', bg: '#0b1736', pattern: 'none', els: [] }] });
    const img = { ...filled.els.find((e) => e.pdf), id: 'img', x: 600, y: 0, w: 900 * (595 / 842), h: 900 };
    const inkIn = { id: 'in', type: 'path', pts: [700, 100, 0.5, 800, 200, 0.5], style: 'pen', color: '#fff', size: 3, opacity: 1 };
    const inkOut = { ...inkIn, id: 'out', pts: [50, 100, 0.5, 150, 200, 0.5] };
    const two = { inside: await shapeOf([{ id: 'a', bg: '#0b1736', pattern: 'none', els: [img, inkIn] }]), outside: await shapeOf([{ id: 'b', bg: '#0b1736', pattern: 'none', els: [img, inkOut] }]), wide: PAGE.h / PAGE.w };
    // 3. drawn with nothing outside it
    const { drawEl, getImage } = await import('/src/renderer.ts');
    const el = { id: 'x', type: 'image', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', x: 20, y: 20, w: 60, h: 60, rot: 0, locked: true };
    getImage(el.src);
    await new Promise((ok) => setTimeout(ok, 300));
    const c = document.createElement('canvas');
    c.width = c.height = 100;
    const g = c.getContext('2d');
    drawEl(g, el);
    const d = g.getImageData(0, 0, 100, 100).data;
    let outside = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) if ((x < 19 || x > 81 || y < 19 || y > 81) && d[(y * 100 + x) * 4 + 3] > 0) outside++;
    return { one, two, outside };
  }, bytes);
  const near = (a, b2) => Math.abs(a - b2) < 0.01;
  const in1 = (a, b2) => Math.abs(a - b2) <= 1; // the page's height is rounded to whole units
  check('a page filled by its PDF page: the region is exactly the page (no band round it)', in1(r.one.region.x, 0) && in1(r.one.region.y, 0) && in1(r.one.region.w, r.one.page.w) && in1(r.one.region.h, r.one.page.h), JSON.stringify(r.one.region));
  check('…and Save PDF gives that page in the PDF\'s own shape', near(r.one.saved, 842 / 595), String(r.one.saved));
  check('older notebook, written on inside the PDF page: the saved page has the PDF page\'s shape', near(r.two.inside, 842 / 595), String(r.two.inside));
  check('older notebook, written on outside it: the whole page is kept', near(r.two.outside, r.two.wide), JSON.stringify(r.two));
  check('a file\'s page is drawn with nothing outside it (no shadow or edge line)', r.outside === 0, `${r.outside} pixels outside`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
