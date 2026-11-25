// "Sometimes the chosen button has no teal behind it": a long random run of everything a teacher does with the toolbar
// (tools, a second tap that opens a tool's menu, Slide, menus, Read only, pages, toolbar at top / bottom, keys, the
// hexagon, drawing and undo), on phone, iPad and board. After every step: if the chosen tool has a button on the
// toolbar, the teal marker is fully shown exactly behind it.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const DEVICES = [
  ['phone', 412, 915, { hasTouch: true, isMobile: true }],
  ['iPad', 1180, 820, { hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }],
  ['board', 1920, 1080, { hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 11; Board) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Safari/537.36' }],
];
const STEPS = Number(process.env.STEPS || 70);
let seed = Number(process.env.SEED || 7);
const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, opt] of DEVICES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...opt });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(process.env.URL || 'http://localhost:5173/');
    await p.waitForTimeout(2000);
    await p.evaluate(() => window.__teachly.store.setSettings({ hexItems: ['select', 'pen', 'eraser', 'text', 'shape', 'laser'] }));
    const relayout = async (st) => {
      await p.evaluate((st) => window.__teachly.store.setSettings({ tbY: undefined, ...st }), st);
      await p.setViewportSize({ width: w + 1, height: h });
      await p.waitForTimeout(120);
      await p.setViewportSize({ width: w, height: h });
    };
    const tapIf = async (sel) => {
      const el = await p.$(sel);
      if (!el || !(await el.isVisible())) return false;
      await el.tap({ timeout: 2000 }).catch(() => {});
      return true;
    };
    const esc = () => p.keyboard.press('Escape');
    const draw = async () => {
      await p.evaluate(() => window.__teachly.store.setTool({ tool: 'pen' }));
      const cdp = await ctx.newCDPSession(p);
      const x = w * 0.4, y = h * 0.4;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let i = 1; i < 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 12, y: y + i * 6, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const actions = [
      ['tool', async () => { const all = await p.$$('.tb-left [data-tool]'); const vis = []; for (const e of all) if (await e.isVisible()) vis.push(e); if (vis.length) await vis[rnd(vis.length)].tap().catch(() => {}); }],
      ['tool twice (menu)', async () => { const t = await p.evaluate(() => window.__teachly.store.tool.tool); if (await tapIf(`.tb-left [data-tool=${t}]`)) { await p.waitForTimeout(300); await esc(); } }],
      ['slide', () => tapIf('.tb-left [data-act=slide]')],
      ['tools menu pick', async () => { if (await tapIf('[data-pop=tools]')) { await p.waitForTimeout(400); const items = await p.$$('.popover:not(.leaving) [data-act^="tool-"]'); if (items.length) await items[rnd(items.length)].tap().catch(() => {}); else await esc(); } }],
      ['menu open/close', async () => { if (await tapIf('[data-pop=menu]')) { await p.waitForTimeout(350); await esc(); } }],
      ['read only on/off', async () => { if (await tapIf('[data-act=readonly]')) { await p.waitForTimeout(1200); await tapIf('[data-act=readonly]'); await p.waitForTimeout(1200); } }],
      ['new page', () => tapIf('[data-act=add]')],
      ['prev page', () => tapIf('[data-act=prev]')],
      ['pages panel', async () => { if (await tapIf('[data-act=pages]')) { await p.waitForTimeout(500); await tapIf('[data-act=pages]'); } }],
      ['key', async () => { await p.keyboard.press(['p', 'e', 'v', 't', 's'][rnd(5)]); }],
      ['hexagon', async () => { const hx = await p.$$('.hexdock .hx:not(.hx-move)'); if (hx.length) await hx[rnd(hx.length)].tap().catch(() => {}); }],
      ['draw + undo', async () => { await draw(); await p.waitForTimeout(200); await p.keyboard.press('Control+z'); }],
      ['toolbar top', () => relayout({ tbPos: 'top', tbAlign: ['middle', 'sides'][rnd(2)] })],
      ['toolbar bottom', () => relayout({ tbPos: 'bottom', tbAlign: ['middle', 'sides'][rnd(2)] })],
    ];
    const bad = [];
    for (let i = 0; i < STEPS; i++) {
      const [label, fn] = actions[rnd(actions.length)];
      await fn();
      await p.waitForTimeout(750); // the marker's glide
      const r = await p.evaluate(() => {
        if (document.querySelector('#app').classList.contains('ro')) return { skip: 'read only' };
        const tool = window.__teachly.store.tool.tool;
        const btn = [...document.querySelectorAll(`.tb-left [data-tool="${tool}"]`)].find((e) => e.offsetWidth);
        const ind = document.querySelector('.tb-left .tb-ind');
        if (!btn) return { skip: `no ${tool} button` };
        const a = btn.getBoundingClientRect(), m = ind.getBoundingClientRect();
        const op = +getComputedStyle(ind).opacity, bg = getComputedStyle(ind).backgroundImage + getComputedStyle(ind).backgroundColor;
        return { tool, active: btn.classList.contains('active'), op, off: Math.round(Math.abs(a.left + a.width / 2 - (m.left + m.width / 2)) + Math.abs(a.top + a.height / 2 - (m.top + m.height / 2))), teal: /20, 184, 166|13, 148, 136|15, 159, 144/.test(bg) };
      });
      if (r.skip) continue;
      if (!r.active || r.op < 0.95 || r.off > 3 || !r.teal) bad.push(`#${i} after "${label}": ${JSON.stringify(r)}`);
    }
    check(`${name}: after every step the chosen tool has the teal behind it (${STEPS} random steps)`, bad.length === 0, bad.slice(0, 4).join(' | '));
    check(`${name}: no page errors`, errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();
  }
  await b.close();
  finish();
})();
