// Read only on a phone (two-row dock), turned on and off with a FINGER (the tapped button is shrunk a little while
// pressed: measuring that made the pill fly past its bar). Checked every frame on a slower CPU:
//  - the Read only pill stays inside the white bar on its way (one clock for both),
//  - the pill never runs over Screenshot, and its last frame matches the real bar (no jump at the end),
//  - the board is never wiped for a frame (it flashed white).
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForTimeout(2000);
  // a mark on the board, to see that it is never wiped
  await p.evaluate(() => {
    const { store } = window.__teachly;
    store.addEls([{ id: 'mark', type: 'path', pts: [100, 400, 0.5, 300, 400, 0.5], style: 'pen', color: '#ffffff', size: 30, opacity: 1 }]);
  });
  await p.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const watch = () => p.evaluate(() => {
    window.__w = { out: 0, over: -1e9, wiped: 0, last: null };
    const ink = document.querySelector('canvas.ink'), g2 = ink.getContext('2d');
    // a pixel of the mark, found once (then watched every frame)
    const all = g2.getImageData(0, 0, ink.width, ink.height).data;
    let at = -1;
    for (let i = 3; i < all.length; i += 4 * 7) if (all[i] > 200) { at = (i - 3) / 4; break; }
    const px = at % ink.width, py = Math.floor(at / ink.width);
    window.__w.found = at >= 0;
    const f = () => {
      const ro = document.querySelector('.tb-ro').getBoundingClientRect();
      const pill = document.querySelector('.tb-ro-pill').getBoundingClientRect();
      const shot = document.querySelector('[data-act=shot]').getBoundingClientRect();
      const g = document.querySelector('.tb-morph');
      if (g) {
        const gr = g.getBoundingClientRect(), c = ro.top + ro.height / 2;
        window.__w.out = Math.max(window.__w.out, gr.top - c, c - gr.bottom);
        // the visible part of the pill (its clip) must end before Screenshot starts
        const m = /inset\(([\d.]+)px ([\d.]+)px/.exec(getComputedStyle(document.querySelector('.tb-ro-pill')).clipPath);
        const sc = pill.width / (document.querySelector('.tb-ro-pill').offsetWidth || 1);
        const end = pill.right - (m ? parseFloat(m[2]) * sc : 0);
        if (getComputedStyle(document.querySelector('.tb-ro-pill')).opacity > 0.3) window.__w.over = Math.max(window.__w.over, end - shot.left);
        window.__w.last = { ro: [ro.left, ro.top, ro.height], shot: [shot.left, shot.top] };
      }
      if (at >= 0 && g2.getImageData(px, py, 1, 1).data[3] === 0) window.__w.wiped++;
      window.__r = requestAnimationFrame(f);
    };
    window.__r = requestAnimationFrame(f);
  });
  const stop = () => p.evaluate(() => (cancelAnimationFrame(window.__r), window.__w));
  const final = () => p.evaluate(() => { const ro = document.querySelector('.tb-ro').getBoundingClientRect(), shot = document.querySelector('[data-act=shot]').getBoundingClientRect(); return { ro: [ro.left, ro.top, ro.height], shot: [shot.left, shot.top] }; });
  for (const dir of ['on', 'off']) {
    await watch();
    await p.tap('[data-act=readonly]');
    await p.waitForTimeout(2200);
    const w = await stop();
    check(`${dir}: the Read only button stays inside the white bar all the way`, w.out <= 2, `${Math.round(w.out)} px outside`);
    if (dir === 'on') {
      check('on: the teal pill never runs over Screenshot', w.over <= 1, `${Math.round(w.over)} px`);
      const f = await final();
      const jump = Math.max(...w.last.ro.map((v, i) => Math.abs(v - f.ro[i])), ...w.last.shot.map((v, i) => Math.abs(v - f.shot[i])));
      check('on: the last frame of the way is where the real bar is (no jump at the end)', jump <= 2, `${jump.toFixed(1)} px`);
    }
    check(`${dir}: the board is never wiped for a frame (no white flash)`, w.found && w.wiped === 0, `${w.wiped} frames`);
  }
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
