// Contact sheet of every Physics – NLM piece (to look at the drawings).
const { chromium } = require('playwright');
const d = '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1600, height: 2300 }, deviceScaleFactor: 1 })).newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__teachly.store.setSettings({ subject: 'phy-11-nlm' }));
  await page.waitForTimeout(500);
  await page.click('.sd-more');
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: '.subj-panel{translate:none!important;left:0!important;top:0!important;bottom:0!important;width:1600px!important;max-width:none!important;border-radius:0!important}.sp-grid{grid-template-columns:repeat(6,1fr)!important}.sp-prev{height:150px!important}.sp-body{overflow:visible!important}.sp-hint{display:none}' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: d + 'nlm-sheet.png' });
  await b.close();
})();
