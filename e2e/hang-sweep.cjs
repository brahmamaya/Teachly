// Nothing freezes, on any device: phone, iPad, laptop and a classroom board (few cores), each on a 4x slower CPU and with
// a notebook of 1000 pages. Every common action (menu, tools, pages, all pages, read only, notebooks, guide) is timed by
// its longest frame; over 300 ms (75 ms on a real device of that speed) counts as a freeze.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const LIMIT = 300;
const DEVICES = [
  ['phone', 412, 915, { hasTouch: true, isMobile: true }],
  ['iPad', 1180, 820, { hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }],
  ['laptop', 1366, 800, {}],
  ['board', 1920, 1080, { hasTouch: true, lite: true }],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, opt] of DEVICES) {
    const { lite, ...ctxOpt } = opt;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...ctxOpt });
    const page = await ctx.newPage();
    if (lite) await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(process.env.URL || 'http://localhost:5173/');
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
      const s = window.__teachly.store;
      const p = s.page;
      s.setSettings({ tbShown: ['tools'], tbHidden: [] });
      s.commit(Array.from({ length: 1000 }, (_, i) => ({ ...p, id: 'h' + i, els: [] })), 0);
    });
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const tap = (sel) => (ctxOpt.hasTouch ? page.tap(sel) : page.click(sel));
    const longest = async (fn) => {
      await page.evaluate(() => {
        window.__g = 0;
        let l = performance.now();
        const f = (t) => {
          window.__g = Math.max(window.__g, t - l);
          l = t;
          window.__r = requestAnimationFrame(f);
        };
        window.__r = requestAnimationFrame(f);
      });
      await fn();
      await page.waitForTimeout(1300);
      return page.evaluate(() => (cancelAnimationFrame(window.__r), Math.round(window.__g)));
    };
    const res = [];
    const step = async (label, fn) => res.push([label, await longest(fn)]);
    await step('menu open', () => tap('[data-pop=menu]'));
    await step('menu close', () => page.keyboard.press('Escape'));
    await step('tools open', () => tap('[data-pop=tools]'));
    await step('tools close', () => page.keyboard.press('Escape'));
    await step('pages open', () => tap('[data-act=pages]'));
    await step('all pages open', () => tap('[data-pg=expand]'));
    await step('all pages close', () => tap('[data-pg=close]'));
    await step('read only on', () => tap('[data-act=readonly]'));
    await step('read only off', () => tap('[data-act=readonly]'));
    await step('next page', () => tap('[data-act=next]'));
    await tap('[data-pop=menu]');
    await page.waitForTimeout(500);
    await step('notebooks open', () => tap('[data-act=library]'));
    await step('notebooks close', () => tap('[data-lib=close]'));
    await tap('[data-pop=menu]');
    await page.waitForTimeout(500);
    await step('guide open', () => tap('[data-act=guide]'));
    await step('guide close', () => tap('[data-gd=close]'));
    const worst = res.reduce((a, r) => (r[1] > a[1] ? r : a), ['', 0]);
    check(`${name}: no freeze in any action (4x slower CPU, 1000 pages)`, res.every((r) => r[1] < LIMIT), res.map((r) => `${r[0]} ${r[1]}`).join(', '));
    console.log(`   ${name} worst: ${worst[0]} ${worst[1]} ms`);
    check(`${name}: no page errors`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await b.close();
  finish();
})();
