// Look of the pieces on a light board and on a dark one (screenshots).
const { chromium } = require('playwright');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__teachly.store.setSettings({ subject: 'phy-11-nlm' }));
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('.board-palette .swatch[data-bg="#ffffff"], .board-palette .swatch:nth-child(2)');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.mouse.click(900, 300);
  await page.waitForTimeout(300);
  await page.click('.sd-more');
  await page.waitForTimeout(500);
  const place = async (id, x, y) => {
    const tile = await page.$(`.sp-tile[data-comp="${id}"]`);
    await tile.scrollIntoViewIfNeeded();
    const bb = await tile.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + 200, bb.y + 20, { steps: 4 });
    await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  };
  await place('w30', 700, 520);
  await place('b1', 745, 440);
  await place('atw', 1150, 300);
  await place('spw', 650, 150);
  await place('f', 1000, 700);
  await place('mkp', 1250, 620);
  await page.mouse.click(1350, 850);
  await page.screenshot({ path: d + 'subj-light.png' });
  await b.close();
})();
