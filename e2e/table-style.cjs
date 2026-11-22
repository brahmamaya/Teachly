// Tables: pick a look before inserting (remembered), and change a table's look and details from its Table style panel
// (header row, stripes, first column, round corners, lines, text side and size).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const s = window.__teachly.store;
    s.commit([{ ...s.page, bg: '#ffffff', els: [] }], 0);
  });
  await page.click('[data-pop=insert]');
  await page.waitForTimeout(300);
  await page.click('[data-act=table]');
  await page.waitForTimeout(300);
  const looks = (await page.$$('.tt-looks [data-tnew]')).length;
  check('the table menu offers at least 10 looks', looks >= 10, String(looks));
  await page.click('[data-tnew=sunshine]');
  await page.waitForTimeout(200);
  await page.click('[data-tr="3"][data-tc="3"]');
  await page.waitForTimeout(300);
  await page.keyboard.type('Day');
  await page.keyboard.press('Escape');
  const t = () => page.evaluate(() => window.__teachly.store.page.els.find((e) => e.type === 'table'));
  let tb = await t();
  check('the new table has the chosen look', tb.theme === 'sunshine' && tb.headerFill === '#f59e0b' && tb.round === true, JSON.stringify({ theme: tb.theme, h: tb.headerFill }));
  check('…and the choice is remembered for the next table', (await page.evaluate(() => window.__teachly.store.settings.tableTheme)) === 'sunshine');
  await page.evaluate(() => {
    const s = window.__teachly.store;
    s.setTool({ tool: 'select' });
    s.select([s.page.els.find((e) => e.type === 'table').id]);
  });
  await page.waitForTimeout(300);
  await page.click('[data-sec=table]');
  await page.waitForTimeout(300);
  await page.click('[data-ttheme=ocean]');
  await page.waitForTimeout(200);
  tb = await t();
  check('Table style: a look changes the whole table (cells kept)', tb.theme === 'ocean' && tb.headerFill === '#0d9488' && tb.cells[0][0] === 'Day');
  await page.click('[data-ttog=firstCol]');
  await page.click('[data-tlines=rows]');
  await page.click('[data-talign=left]');
  const fs0 = tb.fontSize;
  await page.click('[data-tfont="1.14"]');
  await page.click('[data-ttog=stripes]');
  await page.waitForTimeout(200);
  tb = await t();
  check('details change one by one: first column, lines, text side and size, stripes', tb.firstCol === true && tb.lines === 'rows' && tb.align === 'left' && tb.fontSize > fs0 && tb.stripes === false, JSON.stringify({ f: tb.firstCol, l: tb.lines, a: tb.align, s: tb.stripes }));
  // the header really is drawn teal on the board
  const px = await page.evaluate((tb) => {
    const b = window.teachly.board;
    const [sx, sy] = b.toScreen(tb.x + tb.w * 0.8, tb.y + tb.h / tb.rows / 2);
    const c = b.ink, r = c.getBoundingClientRect(), k = c.width / r.width;
    return [...c.getContext('2d').getImageData(Math.round((sx - r.left) * k), Math.round((sy - r.top) * k), 1, 1).data];
  }, tb);
  check("the header is drawn in the look's colour", Math.abs(px[0] - 13) < 30 && Math.abs(px[1] - 148) < 30 && Math.abs(px[2] - 136) < 30, String(px));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  check('every change can be undone', (await t()).stripes === true);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
