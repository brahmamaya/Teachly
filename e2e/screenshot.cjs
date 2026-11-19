// Screenshot button on the toolbar: a PNG of exactly what is in view, sharp, with the content in the right place.
const { chromium } = require('playwright');
const fs = require('fs');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1800);
  check('the toolbar has a Screenshot button', !!(await page.$('[data-act=shot]')) && /creenshot/.test((await page.getAttribute('[data-act=shot]', 'aria-label')) || ''));
  // a red square at a known place in the world
  await page.evaluate(() => {
    const { store } = window.__teachly;
    store.addEls([{ id: 'r', type: 'path', style: 'shape', pts: [700, 400, 0.5, 900, 400, 0.5, 900, 560, 0.5, 700, 560, 0.5, 700, 400, 0.5], color: '#ff0000', size: 8, opacity: 1, closed: true, fill: '#ff0000' }]);
  });
  await page.waitForTimeout(400);
  const view = await page.evaluate(() => window.teachly.board.viewRect());
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-act=shot]')]);
  const name = dl.suggestedFilename();
  check('it saves a PNG called ...-screenshot.png', /-screenshot\.png$/.test(name), name);
  const path = await dl.path();
  const buf = fs.readFileSync(path);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  check('the picture has the shape of what is on the screen', Math.abs(w / h - view.w / view.h) < 0.02, `${w}x${h} vs view ${Math.round(view.w)}x${Math.round(view.h)}`);
  check('and is bigger than the screen so it stays sharp', w >= 1366, `${w}px wide`);
  // the red square is where it should be, and the background is the board colour
  const px = await page.evaluate(async ([b64, vx, vy, vw, vh]) => {
    const img = new Image();
    await new Promise((ok) => { img.onload = ok; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const at = (wx, wy) => Array.from(x.getImageData(Math.round(((wx - vx) / vw) * img.width), Math.round(((wy - vy) / vh) * img.height), 1, 1).data);
    return { inside: at(800, 480), outside: at(300, 300) };
  }, [buf.toString('base64'), view.x, view.y, view.w, view.h]);
  check('the red square is in the picture at the right place', px.inside[0] > 200 && px.inside[1] < 60 && px.inside[2] < 60, JSON.stringify(px.inside));
  check('the rest is the board colour (not blank, not transparent)', px.outside[3] === 255, JSON.stringify(px.outside));
  // zoomed in: the picture is what is in view now, not the whole page
  await page.evaluate(() => window.teachly.board.setCam({ x: 700, y: 400, z: 3 }));
  await page.waitForTimeout(300);
  const view2 = await page.evaluate(() => window.teachly.board.viewRect());
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-act=shot]')]);
  const b2 = fs.readFileSync(await dl2.path());
  check('zoomed in, it is only what is in view (and still sharp)', Math.abs(b2.readUInt32BE(16) / b2.readUInt32BE(20) - view2.w / view2.h) < 0.02 && b2.readUInt32BE(16) >= 1366, `${b2.readUInt32BE(16)}x${b2.readUInt32BE(20)}`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
