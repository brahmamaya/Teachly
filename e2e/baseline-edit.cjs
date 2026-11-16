const { open, doc, stored } = require('./lib.cjs');
(async () => {
  const { browser, page, errors } = await open();
  // 1. make elements the way a teacher does: pen, text, image via the app's own insert path, shape tool
  await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(500, 360, { steps: 12 }); await page.mouse.up();
  await page.click('[data-tool=text]'); await page.mouse.click(300, 450); await page.keyboard.type('Hello'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.evaluate(() => {
    const { store } = window.__teachly;
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#4ade80'; x.fillRect(0, 0, 400, 300);
    store.addEls([{ id: 'img1', type: 'image', x: 700, y: 200, w: 300, h: 225, rot: 0, src: c.toDataURL('image/png') }]);
  });
  await page.waitForTimeout(3500);
  console.log('before reload', JSON.stringify((await doc(page)).pages[0].els.map(e => e.type)));
  await page.reload(); await page.waitForTimeout(2500);
  const d = await doc(page);
  console.log('after reload ', JSON.stringify(d.pages[0].els.map(e => e.type + (e.locked ? '(locked)' : ''))));
  // 2. try to edit each: select tool, click on it, drag it
  await page.click('[data-tool=select]');
  const img = d.pages[0].els.find(e => e.type === 'image');
  const box = await page.evaluate(async (e) => { const bd = window.teachly.board; const [sx, sy] = bd.toScreen(e.x + e.w / 2, e.y + e.h / 2); const r = bd.el.getBoundingClientRect(); return [sx + r.left, sy + r.top]; }, img);
  await page.mouse.move(box[0], box[1]); await page.mouse.down(); await page.mouse.move(box[0] + 80, box[1] + 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  const d2 = await doc(page); const img2 = d2.pages[0].els.find(e => e.type === 'image');
  console.log('image moved after reload?', img2.x !== img.x, 'dx', Math.round(img2.x - img.x));
  console.log('stored keys', JSON.stringify(Object.keys(await stored(page) || {})));
  console.log('errors', errors);
  await browser.close();
})();
