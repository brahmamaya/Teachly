// C. Toolbar response: touch (real CDP touch events) on a blank and a heavy page, CPU throttled 1x/4x/8x.
// Reports, for each selection: (a) press -> visible feedback, (b) release -> tool really changed.
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5173/';
const N = +(process.env.N || 56);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

async function run(heavy, rate, lite) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: false });
  const page = await ctx.newPage();
  if (lite) await page.addInitScript(() => { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }); });
  await page.goto(URL); await page.waitForTimeout(1500);
  if (heavy) await page.evaluate(() => {
    const { store } = window.__teachly; const els = [];
    for (let i = 0; i < 1500; i++) { const pts = []; const x = Math.random() * 1500, y = Math.random() * 850; for (let k = 0; k < 60; k++) pts.push(x + k * 3, y + Math.sin(k / 4) * 20, 0.5); els.push({ id: 'h' + i, type: 'path', pts, style: 'pen', color: '#ffffff', size: 3, opacity: 1 }); }
    store.addEls(els);
  });
  await page.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(page);
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.evaluate(() => {
    window.__lat = [];
    // t0: the finger lands. The feedback is "seen" at the first frame after the button shows it as active.
    document.addEventListener('pointerdown', (e) => { const b = e.target.closest && e.target.closest('[data-tool]'); if (!b || !b.closest('.toolbars')) return; const t0 = performance.now(); const id = b.dataset.tool; window.__cur = { id, t0, seen: 0, tool: 0 };
      const poll = () => { const el = document.querySelector('.toolbars .tb-left [data-tool="' + id + '"]'); const c = window.__cur; if (!c || c.id !== id) return;
        if (!c.seen && el && (el.classList.contains('active') || el.classList.contains('pressed') || el.matches(':active'))) requestAnimationFrame(() => { if (window.__cur === c && !c.seen) c.seen = performance.now() - t0; });
        if (!c.tool && window.__teachly.store.tool.tool === id) c.tool = performance.now() - t0;
        if (!(c.seen && c.tool)) requestAnimationFrame(poll); else window.__lat.push(c); };
      requestAnimationFrame(poll); }, true);
  });
  const tools = ['select', 'pen', 'eraser', 'text', 'tape', 'laser', 'fill', 'select', 'text', 'eraser', 'pen'];
  const seen = [], tool = [];
  for (let i = 0; i < N; i++) {
    let id = tools[i % tools.length];
    const cur = await page.evaluate(() => window.__teachly.store.tool.tool); if (cur === id) id = tools[(i + 1) % tools.length];
    const box = await page.locator(`.toolbars .tb-left [data-tool="${id}"]`).first().boundingBox();
    if (!box) continue;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(70); // a quick tap
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction((id) => { const l = window.__lat; return l.length && l[l.length - 1].id === id && window.__cur === l[l.length - 1]; }, id, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(120);
    const c = await page.evaluate(() => window.__lat[window.__lat.length - 1]);
    if (c && c.id === id) { seen.push(c.seen); tool.push(c.tool); }
    // next stroke must use the selected tool
  }
  // the next stroke uses the selected tool
  await page.click('[data-tool=pen]').catch(() => {});
  await browser.close();
  return { n: seen.length, seen, tool };
}

(async () => {
  console.log('scenario                      n   feedback p50/p95/max (ms, from finger down)   tool changed p50/p95');
  for (const lite of (process.env.LITE ? [true] : [false, true])) for (const heavy of [false, true]) for (const rate of [1, 4, 8]) {
    const r = await run(heavy, rate, lite);
    const ok = r.seen.filter((v) => v <= 100).length;
    console.log(`${lite ? 'lite ' : 'full '}${heavy ? 'heavy' : 'blank'} cpu x${rate}`.padEnd(30), String(r.n).padStart(2), `  ${pct(r.seen, 0.5).toFixed(0)}/${pct(r.seen, 0.95).toFixed(0)}/${Math.max(...r.seen).toFixed(0)}  (${(100 * ok / r.n).toFixed(0)}% <=100ms)`.padEnd(48), `  ${pct(r.tool, 0.5).toFixed(0)}/${pct(r.tool, 0.95).toFixed(0)}`);
  }
})();
