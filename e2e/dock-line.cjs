// The pieces dock of a chapter sits on the toolbar's own line in every toolbar layout (top / bottom, one bar in the
// middle / halves at the sides): beside a middle bar in the free space, between the halves at the sides. It is never
// stretched (with both top and bottom set it became a tall white pill in the middle of the screen). During Read only
// (and its glide) it steps aside, and comes back on the line after.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const DEVICES = [
  ['iPad', 1180, 820, { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }],
  ['laptop', 1366, 800, {}],
  ['board', 1920, 1080, { userAgent: 'Mozilla/5.0 (Linux; Android 11; Board) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Safari/537.36' }],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, opt] of DEVICES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, ...opt });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(process.env.URL || 'http://localhost:5173/');
    await p.waitForTimeout(1800);
    const look = () => p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom, op: +getComputedStyle(e).opacity }; };
      return { L: r('.tb-left'), R: r('.tb-right'), d: r('.subj-dock') };
    });
    for (const [pos, align] of [['top', 'middle'], ['bottom', 'middle'], ['bottom', 'sides'], ['top', 'sides']]) {
      await p.evaluate(([tbPos, tbAlign]) => window.__teachly.store.setSettings({ subject: 'phy-11-nlm', subjectDock: true, tbPos, tbAlign, tbY: undefined }), [pos, align]);
      await p.setViewportSize({ width: w + 1, height: h });
      await p.waitForTimeout(150);
      await p.setViewportSize({ width: w, height: h });
      await p.waitForTimeout(900);
      const m = await look();
      const bar = { t: Math.min(m.L.t, m.R.t), b: Math.max(m.L.b, m.R.b) };
      const dh = m.d.b - m.d.t, dc = (m.d.t + m.d.b) / 2, bc = (bar.t + bar.b) / 2;
      const hits = [m.L, m.R].some((x) => m.d.l < x.r + 4 && m.d.r > x.l - 4 && m.d.t < x.b && m.d.b > x.t);
      check(`${name}, toolbar ${pos} / ${align}: the dock is a slim bar (not stretched)`, dh < 80, `${Math.round(dh)} px tall`);
      check(`${name}, toolbar ${pos} / ${align}: on the toolbar's line, touching neither half`, Math.abs(dc - bc) < 4 && !hits, JSON.stringify({ dock: [Math.round(m.d.l), Math.round(m.d.r), Math.round(dc)], barMid: Math.round(bc), hits }));
    }
    // Read only: the dock steps aside, then comes back on the line
    await p.tap('[data-act=readonly]');
    await p.waitForTimeout(1300);
    const ro = await look();
    check(`${name}: with Read only on the dock is hidden`, ro.d.op === 0, String(ro.d.op));
    await p.tap('[data-act=readonly]');
    await p.waitForTimeout(1500);
    const back = await look();
    const bc2 = (Math.min(back.L.t, back.R.t) + Math.max(back.L.b, back.R.b)) / 2;
    check(`${name}: Read only off: the dock is back, on the toolbar's line`, back.d.op === 1 && Math.abs((back.d.t + back.d.b) / 2 - bc2) < 4, JSON.stringify(back.d));
    check(`${name}: no page errors`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await b.close();
  finish();
})();
