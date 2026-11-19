// Screenshots of the main states at the five viewports of the redesign brief (before / after comparisons).
// Usage: OUT=docs/redesign/before node e2e/redesign-shots.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'docs/redesign/shots';
const URL = process.env.URL || 'http://localhost:5173/';
const SIZES = [[390, 844, true], [768, 1024, true], [1024, 768, true], [1366, 768, false], [1920, 1080, false]];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const [w, h, touch] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 1000 });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForTimeout(1800);
    const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: `${OUT}/${w}x${h}-${name}.png` }); };
    const clearUp = async () => { await page.keyboard.press('Escape'); await page.mouse.click(Math.round(w / 2), Math.round(h / 3)); await page.waitForTimeout(200); };
    // a little content to look at
    await page.evaluate(() => {
      const { store } = window.__teachly;
      store.addEls([
        { id: 'r1', type: 'path', style: 'pen', pts: [300, 300, 0.5, 420, 280, 0.5, 520, 330, 0.5, 640, 300, 0.5], color: '#ef4444', size: 6, opacity: 1 },
        { id: 't1', type: 'text', text: 'F = ma', color: '#ffffff', fontSize: 70, x: 320, y: 450, w: 260, h: 90, rot: 0 },
        { id: 's1', type: 'path', style: 'shape', pts: [900, 300, 0.5, 1100, 300, 0.5, 1100, 460, 0.5, 900, 460, 0.5, 900, 300, 0.5], color: '#60a5fa', size: 5, opacity: 1, closed: true, fill: null },
      ]);
    });
    await page.click('[data-tool=eraser]').catch(() => {});
    await page.click('[data-tool=pen]').catch(() => {});
    await shot('01-pen');
    await page.click('[data-tool=pen]').catch(() => {});
    await shot('02-pen-menu');
    await clearUp();
    await page.click('[data-pop=insert]').catch(() => {});
    await shot('03-insert');
    await clearUp();
    await page.click('[data-pop=tools]').catch(() => {});
    await shot('04-tools');
    await clearUp();
    await page.click('[data-pop=menu]').catch(() => {});
    await shot('05-menu');
    await clearUp();
    await page.evaluate(() => { const { store } = window.__teachly; store.setTool({ tool: 'select' }); store.select(['s1']); });
    await shot('06-selection');
    await page.evaluate(() => window.__teachly.store.clearSelection());
    await page.click('[data-act=pages]').catch(() => {});
    await shot('07-pages');
    await page.click('[data-act=pages]').catch(() => {});
    await page.click('[data-act=library]').catch(() => {});
    await page.click('[data-pop=menu]').catch(() => {});
    await page.click('[data-act=library]').catch(() => {});
    await shot('08-notebooks');
    await ctx.close();
  }
  await b.close();
  console.log('screenshots in', OUT);
})();
