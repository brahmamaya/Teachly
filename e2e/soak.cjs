// A long lesson on a board, in a few minutes: a 60-page PDF is turned through again and again, lines are written and
// undone, menus, the Pages panel, All pages and Read only are opened and closed, with no quiet minute in between
// (the teacher keeps touching the board). Measured after each round (garbage collected first): memory in use, page
// pictures held, DOM nodes and event listeners. They must level off, not keep growing (that made long lessons hang).
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, finish } = require('./lib.cjs');
const src = fs.readFileSync(path.join(__dirname, 'pdf-board.cjs'), 'utf8');
const makePdf = eval('(' + src.slice(src.indexOf('function makePdf'), src.indexOf('(async () =>')) + ')');
const ROUNDS = Number(process.env.ROUNDS || 6);
(async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pn-soak-')), 'Book.pdf');
  fs.writeFileSync(file, makePdf(60, 842, 595));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(1800);
  await p.tap('[data-pop=insert]');
  await p.waitForTimeout(400);
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.tap('.popover [data-act=pdf]')]);
  await ch.setFiles(file);
  await p.waitForFunction(() => window.__teachly.store.doc.pages.length >= 60, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const write = async (n) => {
    for (let s = 0; s < n; s++) {
      const x0 = 400 + (s % 10) * 90, y0 = 300 + Math.floor(s / 10) * 120;
      await tp('touchStart', x0, y0);
      for (let i = 1; i <= 6; i++) await tp('touchMove', x0 + i * 8, y0 + i * 9);
      await tp('touchEnd');
    }
  };
  const measure = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await p.waitForTimeout(300);
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6;
    const dom = await cdp.send('Memory.getDOMCounters');
    const pics = await p.evaluate(() => window.__teachly.pictures?.() ?? -1);
    return { heap: Math.round(heap), nodes: dom.nodes, listeners: dom.jsEventListeners, pics };
  };
  await cdp.send('HeapProfiler.enable');
  const rows = [];
  for (let r = 0; r < ROUNDS; r++) {
    // turn through the whole book (a tap on the board in between: the teacher never leaves it quiet)
    for (let i = 0; i < 59; i++) {
      await p.evaluate(() => window.__teachly.store.goTo(window.__teachly.store.index + 1));
      if (i % 6 === 0) await write(1);
      await p.waitForTimeout(140);
    }
    for (let i = 0; i < 59; i++) {
      await p.evaluate(() => window.__teachly.store.goTo(window.__teachly.store.index - 1));
      await p.waitForTimeout(60);
    }
    await write(12);
    for (let i = 0; i < 10; i++) await p.keyboard.press('Control+z');
    for (const sel of ['[data-pop=menu]', '[data-pop=tools]', '[data-pop=insert]']) {
      await p.tap(sel);
      await p.waitForTimeout(250);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(150);
    }
    await p.tap('[data-act=pages]');
    await p.waitForTimeout(600);
    await p.tap('[data-pg=expand]');
    await p.waitForTimeout(900);
    await p.tap('[data-pg=close]');
    await p.waitForTimeout(400);
    await p.tap('[data-act=readonly]');
    await p.waitForTimeout(1100);
    await p.tap('[data-act=readonly]');
    await p.waitForTimeout(1100);
    rows.push(await measure());
    console.log(`   round ${r + 1}: ${JSON.stringify(rows[rows.length - 1])}`);
  }
  const a = rows[1], z = rows[rows.length - 1];
  check(`memory levels off over a long lesson (${ROUNDS} rounds of the whole book)`, z.heap <= a.heap * 1.25 + 8, `${a.heap} MB after round 2 -> ${z.heap} MB after round ${ROUNDS}`);
  check('page pictures held stay few (only around the open page), however many pages were seen', z.pics >= 0 && z.pics <= 10, `${z.pics} held`);
  check('DOM nodes do not keep growing', z.nodes <= a.nodes * 1.15 + 200, `${a.nodes} -> ${z.nodes}`);
  check('event listeners do not keep growing', z.listeners <= a.listeners + 20, `${a.listeners} -> ${z.listeners}`);
  check('no page errors', errs.length === 0, errs.slice(0, 3).join('|'));
  await b.close();
  finish();
})();
