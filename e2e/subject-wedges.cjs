// Look of the wedge angle labels (screenshot of the big window scrolled to the wedges).
const { chromium } = require('playwright');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__teachly.store.setSettings({ subject: 'phy-11-nlm' }));
  await page.waitForTimeout(500);
  await page.click('.sd-more');
  await page.waitForTimeout(500);
  await page.evaluate(() => { const h = [...document.querySelectorAll('.sp-body h3')].find((x) => x.textContent === 'Wedges'); h.scrollIntoView(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: d + 'wedges.png', clip: { x: 180, y: 60, width: 920, height: 680 } });
  await b.close();
})();
