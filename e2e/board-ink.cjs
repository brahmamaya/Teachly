// Classroom boards are often white: writing must always show. A pen picked from the tray (never given a colour) on a
// white page writes black, not white; the first colour circle is black there; going to a dark page turns it white.
// Runs as a "lite" board (few cores, like the classroom boards) with finger touches.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1600);
  check('runs as a classroom board (lite)', await page.evaluate(() => document.documentElement.classList.contains('lite')));
  // a white page, and a pen colour saved as white (as an earlier version left it)
  await page.evaluate(() => {
    const { store } = window.__teachly;
    // page 1 dark with a white pen, page 2 white: going to page 2 must not leave a white pen
    const p = store.doc.pages[0];
    store.commit([{ ...p, id: 'dk', bg: '#222222', els: [] }, { ...p, id: 'wt', bg: '#ffffff', els: [] }], 0);
    store.setTool({ tool: 'pen', penStyle: 'pen', color: '#f2f2f0' });
    store.goTo(1);
  });
  await page.waitForTimeout(300);
  check('a white pen on a white page turns black', (await page.evaluate(() => window.__teachly.store.tool.color)) === '#000000');
  const cdp = await ctx.newCDPSession(page);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const dark = (x, y) => page.evaluate(([x, y]) => {
    const c = window.teachly.board.ink, k = c.width / c.getBoundingClientRect().width, r = c.getBoundingClientRect();
    const d = c.getContext('2d').getImageData(Math.round((x - r.left) * k) - 3, Math.round((y - r.top) * k) - 3, 7, 7).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40 && d[i] + d[i + 1] + d[i + 2] < 600) n++;
    return n;
  }, [x, y]);
  let row = 0;
  for (const k of ['pencil', 'fineliner', 'pen', 'crayon', 'fountain', 'marker', 'watercolor', 'brush', 'calligraphy']) {
    // pick the pen from the tray like a teacher would
    await page.click('[data-tool=pen]');
    await page.waitForTimeout(250);
    if (!(await page.$('.pt-pens'))) {
      await page.click('[data-tool=pen]');
      await page.waitForTimeout(250);
    }
    await page.click(`.pt-pen[data-style=${k}]`);
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const y = 120 + row * 60;
    await tp('touchStart', 300, y);
    for (let i = 1; i <= 20; i++) await tp('touchMove', 300 + i * 15, y + Math.sin(i / 2) * 6);
    await tp('touchEnd');
    await page.waitForTimeout(250);
    const c = await page.evaluate(() => window.__teachly.store.tool.color);
    const n = await dark(450, y + Math.sin(10 / 2) * 6);
    check(`${k}: writing shows on the white page (colour ${c})`, n > 0 && c !== '#f2f2f0', `dark pixels ${n}`);
    row++;
  }
  await page.click('[data-tool=pen]');
  await page.waitForTimeout(300);
  if (!(await page.$('.pt-cols'))) await page.click('[data-tool=pen]');
  await page.waitForTimeout(300);
  const cols = await page.$$eval('.pt-cols .pt-col', (n) => n.map((e) => e.dataset.color || 'wheel'));
  check('the pen bar has 10 colour circles: white, black, blue, green, yellow, red, pink, orange, purple and the flower', cols.length === 10 && cols.includes('#000000') && cols.includes('#f2f2f0') && cols.includes('#ff4fa3') && cols[9] === 'wheel', cols.join(','));
  await page.keyboard.press('Escape');
  // a dark page: black ink turns white
  await page.evaluate(() => window.__teachly.store.goTo(0));
  await page.waitForTimeout(300);
  check('a black pen going to a dark page turns white', (await page.evaluate(() => window.__teachly.store.tool.color)) === '#f2f2f0');
  // black chosen on purpose on a dark page stays black while writing (it only changes with the page)
  await page.evaluate(() => window.__teachly.store.setTool({ color: '#000000' }));
  await tp('touchStart', 300, 600);
  for (let i = 1; i <= 8; i++) await tp('touchMove', 300 + i * 15, 600);
  await tp('touchEnd');
  await page.waitForTimeout(300);
  check('a black chosen on a dark page stays black after writing', (await page.evaluate(() => window.__teachly.store.tool.color)) === '#000000');
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
