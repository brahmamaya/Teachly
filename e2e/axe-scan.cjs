// Automated accessibility scan (axe-core) of the interface around the canvas, in several states.
// axe-core is NOT a project dependency: install it somewhere else and point AXE at its axe.min.js.
//   AXE=/path/to/node_modules/axe-core/axe.min.js node e2e/axe-scan.cjs
// An automated scan finds only part of the problems (the canvas itself is not covered); it is not proof of accessibility.
const { chromium } = require('playwright');
const fs = require('fs');
const AXE = process.env.AXE;
if (!AXE || !fs.existsSync(AXE)) { console.error('Set AXE to the path of axe.min.js'); process.exit(2); }
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true })).newPage();
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1800);
  if (process.env.LIGHT) {
    await page.click('[data-pop=menu]');
    await page.waitForTimeout(300);
    await page.click('.board-palette .swatch:nth-child(2)');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  await page.addScriptTag({ path: AXE });
  const scan = async (state) => {
    const r = await page.evaluate(async () => {
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, first: v.nodes[0].target.join(' ') }));
    });
    console.log(`\n## ${state}: ${r.length} rule(s) with violations`);
    for (const v of r) console.log(`- ${v.id} [${v.impact}] x${v.n}: ${v.help} (e.g. ${v.first})`);
    return r;
  };
  const all = {};
  all.writing = await scan('writing (initial)');
  await page.click('[data-pop=insert]');
  await page.waitForTimeout(400);
  all.insert = await scan('Insert menu open');
  await page.keyboard.press('Escape');
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(400);
  all.menu = await scan('Menu open');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const { store } = window.__teachly; store.addEls([{ id: 'a1', type: 'path', style: 'shape', pts: [300, 300, 0.5, 400, 300, 0.5, 400, 400, 0.5, 300, 400, 0.5, 300, 300, 0.5], color: '#fff', size: 4, opacity: 1, closed: true, fill: null }]); store.setTool({ tool: 'select' }); store.select(['a1']); });
  await page.waitForTimeout(400);
  all.selection = await scan('selection bar');
  await page.click('[data-act=pages]');
  await page.waitForTimeout(500);
  all.pages = await scan('Pages panel');
  await b.close();
  fs.writeFileSync(process.env.OUT || 'docs/redesign/axe-after.json', JSON.stringify(all, null, 1));
})();
