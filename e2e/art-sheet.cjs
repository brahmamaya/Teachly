// Contact sheet of the cover drawings of one subject, for looking at them: node e2e/art-sheet.cjs <id e.g. phy> <out.png>
const { chromium } = require('playwright');
(async () => {
  const [id, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1200);
  await page.evaluate(async (id) => {
    const m = await import('/src/ui/subjectcovers.ts');
    document.body.innerHTML = '';
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;box-sizing:border-box;overflow:hidden;background:#fff;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:10px;z-index:99999';
    for (let i = 0; i < 8; i++) {
      const c = m.SUBJECT_COVERS.find((x) => x.id === id + '-' + String(i + 1).padStart(2, '0'));
      const d = document.createElement('div');
      d.style.cssText = `aspect-ratio:1;min-width:0;background:linear-gradient(135deg,${c.bg},${c.bg2});position:relative;border-radius:8px`;
      const g = document.createElement('div');
      g.style.cssText = `position:absolute;inset:6%;background:${c.ink};-webkit-mask:${m.drawingUrl(id + ':' + i)} center/contain no-repeat;mask:${m.drawingUrl(id + ':' + i)} center/contain no-repeat`;
      d.appendChild(g);
      w.appendChild(d);
    }
    document.body.appendChild(w);
  }, id);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
  if (errs.length) console.log('ERRORS', errs.join('|'));
  await b.close();
})();
