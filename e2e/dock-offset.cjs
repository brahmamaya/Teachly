// The pieces dock and the pen bar stay on the toolbar's line even when window.innerHeight is not the real bottom
// of the screen (iPad Safari / home-screen app): they used to slide half below the screen edge.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1194, 834], [1366, 1024]]) {
    for (const lost of [0, 40, -30]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
      const page = await ctx.newPage();
    await page.addInitScript(() => { try { const k = 'teachly.settings'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.quickBar = true; localStorage.setItem(k, JSON.stringify(o)); } catch (e) { /* ignore */ } });
      // innerHeight lies by `lost` pixels; the screen's real bottom edge stays where it is
      await page.addInitScript((lost) => { const real = Object.getOwnPropertyDescriptor(Window.prototype, 'innerHeight') || Object.getOwnPropertyDescriptor(window, 'innerHeight'); Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => (real.get ? real.get.call(window) : real.value) - lost }); }, lost);
      await page.goto(process.env.URL || 'http://localhost:5173/');
      await page.waitForTimeout(1600);
      await page.evaluate(() => { const { store } = window.__teachly; store.setSettings({ subject: 'phy-11-nlm', tbHidden: [], tbShown: [] }); store.setTool({ tool: 'pen' }); });
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await page.waitForTimeout(500);
      const m = await page.evaluate((h) => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return [x.top, x.bottom]; };
        const c = (a) => (a[0] + a[1]) / 2;
        const l = r('.tb-left'), d = r('.subj-dock'), q = r('.quickbar:not([hidden])');
        return { dockDy: d ? Math.round(c(d) - c(l)) : null, dockBottomGap: d ? Math.round(h - d[1]) : null, qDy: q ? Math.round(c(q) - c(l)) : null };
      }, h);
      check(`${w}x${h}, innerHeight off by ${lost}px: the dock is on the toolbar's line and fully on screen`, m.dockDy !== null && Math.abs(m.dockDy) < 8 && m.dockBottomGap >= -3, JSON.stringify(m));
      await ctx.close();
    }
  }
  await b.close();
  finish();
})();
