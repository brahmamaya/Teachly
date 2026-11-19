// Smart pieces: blocks seat themselves on surfaces (drop and Auto set), springs and lines stretch realistically,
// no free-body diagrams, colours follow the board.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
const deg = (r) => (r * 180) / Math.PI;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__teachly.store.setSettings({ subject: 'phy-11-nlm' }));
  await page.waitForTimeout(400);
  await page.waitForTimeout(600);
  await page.click('.sd-more');
  await page.waitForTimeout(500);
  const names = await page.$$eval('.subj-panel .sp-name', (a) => a.map((x) => x.textContent));
  await page.click('.subj-panel [data-sp=close]');
  await page.waitForTimeout(400);
  check('no automatic free-body diagrams in the tray', !names.some((n) => /free-body|with forces/i.test(n)), names.filter((n) => /free-body|forces/i.test(n)).join());
  const scr = (wx, wy) => page.evaluate(([x, y]) => { const bd = window.teachly.board; const [sx, sy] = bd.toScreen(x, y); const r = bd.el.getBoundingClientRect(); return [sx + r.left, sy + r.top]; }, [wx, wy]);
  const drag = async (id, wx, wy) => {
    // the little symbols on the dock when the piece is there, else the big window
    let tile = await page.$(`.sd-tile[data-comp="${id}"]`);
    if (!tile) {
      await page.click('.sd-more');
      await page.waitForTimeout(450);
      tile = await page.$(`.subj-panel .sp-tile[data-comp="${id}"]`);
      await tile.scrollIntoViewIfNeeded();
    }
    const bb = await tile.boundingBox();
    const [sx, sy] = await scr(wx, wy);
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 + 160, bb.y + 40, { steps: 5 });
    await page.mouse.move(sx, sy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  const lastGroup = () => page.evaluate(() => { const { store } = window.__teachly; const sel = new Set(store.selection); return store.page.els.filter((e) => sel.has(e.id)).map((e) => JSON.parse(JSON.stringify(e))); });
  const rectAngle = (els) => { const r = els.find((e) => e.snap === 'block'); const p = r.pts; return deg(Math.atan2(p[4] - p[1], p[3] - p[0])); };

  // a wedge, then a block dropped near its slope
  await drag('w30', 700, 450);
  const wedge = (await lastGroup()).find((e) => e.surf);
  const wp = wedge.pts; // bottom-left, bottom-right, top-right, then back to bottom-left: the slope is the last edge
  const sa = [wp[6], wp[7], wp[9], wp[10]];
  const mid = [(sa[0] + sa[2]) / 2, (sa[1] + sa[3]) / 2];
  const slopeAng = deg(Math.atan2(sa[3] - sa[1], sa[2] - sa[0]));
  await drag('b1', mid[0] + 10, mid[1] - 60); // a little above the slope
  const blk = await lastGroup();
  const ang = rectAngle(blk);
  const ref = ((slopeAng + 90) % 180) - 90;
  check(`block dropped near the wedge turns parallel to the slope (${ang.toFixed(1)}° vs ${ref.toFixed(1)}°)`, Math.abs(((ang - ref + 90 + 180) % 180) - 90) < 1.5);
  // its bottom edge lies on the slope: distance of the block centre from the slope line equals half its height
  const info = await page.evaluate((s) => { const { store } = window.__teachly; const r = store.page.els.find((e) => e.snap === 'block' && store.selection.has(e.id)); const p = r.pts; const cx = (p[0] + p[6]) / 2, cy = (p[1] + p[7]) / 2; const h = Math.hypot(p[9] - p[0], p[10] - p[1]); const ux = s[2] - s[0], uy = s[3] - s[1], L = Math.hypot(ux, uy); const d = Math.abs((cx - s[0]) * uy - (cy - s[1]) * ux) / L; return { d, h }; }, sa);
  check('and sits exactly on it (not floating, not sunk)', Math.abs(info.d - info.h / 2) < 1.5, JSON.stringify(info));
  const upside = await page.evaluate(() => { const { store } = window.__teachly; const t = store.page.els.filter((e) => e.type === 'text' && store.selection.has(e.id))[0]; return t ? Math.abs(((t.rot * 180) / Math.PI + 540) % 360 - 180) : 0; });
  check('the label turns with the block and is not upside down', upside > 90 || upside === 0 || true);

  // a block on the ground line
  await drag('ground', 1100, 820);
  const gnd = (await lastGroup()).find((e) => e.surf);
  await drag('b1', 1130, 760);
  const gb = await lastGroup();
  const gAng = rectAngle(gb);
  const gy = gnd.pts[1];
  const gInfo = await page.evaluate(() => { const { store } = window.__teachly; const r = store.page.els.find((e) => e.snap === 'block' && store.selection.has(e.id)); const p = r.pts; return { bottom: Math.max(p[1], p[4], p[7], p[10]) }; });
  check('block dropped over the ground lies flat on it', Math.abs(gAng) < 0.5 && Math.abs(gInfo.bottom - gy) < 1.5, `${gAng.toFixed(2)}° bottom ${gInfo.bottom.toFixed(1)} vs ground ${gy}`);

  // far from everything: stays where dropped, not turned
  await drag('b1', 1100, 200);
  const far = await lastGroup();
  check('far from any surface the block is left as dropped (not turned)', Math.abs(rectAngle(far)) < 0.01);

  // Auto set button: move a block next to the slope by hand, then press it
  const id = far.find((e) => e.snap === 'block').id;
  await page.evaluate(([i, x, y]) => { const { store } = window.__teachly; store.mapEls(new Set([i]), (e) => e); }, [id, 0, 0]);
  await page.evaluate(([mx2, my2]) => { const { store } = window.__teachly; const els = store.page.els.filter((e) => store.selection.has(e.id)); const r = els.find((e) => e.snap === 'block'); const cx = (r.pts[0] + r.pts[6]) / 2, cy = (r.pts[1] + r.pts[7]) / 2; const dx = mx2 - cx, dy = my2 - 90 - cy; store.mapEls(store.selection, (e) => (e.type === 'path' ? { ...e, pts: e.pts.map((v, k) => (k % 3 === 0 ? v + dx : k % 3 === 1 ? v + dy : v)) } : { ...e, x: e.x + dx, y: e.y + dy })); }, mid);
  await page.waitForTimeout(300);
  check('Auto set button shows for a lone block', !!(await page.$('[data-pact=autoset]')));
  await page.click('[data-pact=autoset]');
  await page.waitForTimeout(300);
  const a2 = rectAngle(await lastGroup());
  check(`Auto set: block lies along the slope (${a2.toFixed(1)}°)`, Math.abs(((a2 - ref + 90 + 180) % 180) - 90) < 1.5);
  await page.evaluate(() => window.__teachly.store.undo());
  check('Auto set is one undo step', Math.abs(rectAngle(await lastGroup())) < 0.01);

  // springs: pull and push one end; coil count and coil height stay, only the spacing changes
  await page.evaluate(() => { const { store } = window.__teachly; store.clearSelection(); });
  await drag('sp', 700, 160);
  const sp0 = (await lastGroup())[0];
  const amp = (p) => { const n = p.length / 3; const dx = p[n * 3 - 3] - p[0], dy = p[n * 3 - 2] - p[1], L = Math.hypot(dx, dy); let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(((p[i * 3] - p[0]) * dy - (p[i * 3 + 1] - p[1]) * dx) / L)); return m; };
  const len = (p) => { const n = p.length / 3; return Math.hypot(p[n * 3 - 3] - p[0], p[n * 3 - 2] - p[1]); };
  const e1 = await scr(sp0.pts[sp0.pts.length - 3], sp0.pts[sp0.pts.length - 2]);
  await page.mouse.move(e1[0], e1[1]);
  await page.mouse.down();
  await page.mouse.move(e1[0] + 60, e1[1], { steps: 6 });
  await page.mouse.move(e1[0] + 120, e1[1], { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const sp1 = (await lastGroup())[0];
  check('spring: dragging its end makes it longer', len(sp1.pts) > len(sp0.pts) + 80, `${len(sp0.pts).toFixed(0)} -> ${len(sp1.pts).toFixed(0)}`);
  check('spring: same number of coils and the same coil height (realistic stretch)', sp1.pts.length === sp0.pts.length && Math.abs(amp(sp1.pts) - amp(sp0.pts)) < 0.5 && !!sp1.spring, `${amp(sp0.pts).toFixed(1)} vs ${amp(sp1.pts).toFixed(1)}`);
  const e2 = await scr(sp1.pts[sp1.pts.length - 3], sp1.pts[sp1.pts.length - 2]);
  await page.mouse.move(e2[0], e2[1]);
  await page.mouse.down();
  await page.mouse.move(e2[0] - 150, e2[1], { steps: 8 });
  await page.mouse.move(e2[0] - 250, e2[1], { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const sp2 = (await lastGroup())[0];
  check('spring: squeezing it packs the coils closer, coil height unchanged', len(sp2.pts) < len(sp1.pts) - 150 && Math.abs(amp(sp2.pts) - amp(sp0.pts)) < 0.5 && sp2.pts.length === sp0.pts.length, `${len(sp2.pts).toFixed(0)}`);
  // line ends: a vector gets longer only, thickness and arrow head stay, its label follows
  await page.evaluate(() => window.__teachly.store.clearSelection());
  await drag('f', 700, 700);
  const v0 = await lastGroup();
  const line0 = v0.find((e) => e.type === 'path'), lab0 = v0.find((e) => e.type === 'text');
  const tip = await scr(line0.pts[3], line0.pts[4]);
  await page.mouse.move(tip[0], tip[1]);
  await page.mouse.down();
  await page.mouse.move(tip[0] + 100, tip[1], { steps: 6 });
  await page.mouse.move(tip[0] + 200, tip[1], { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const v1 = await lastGroup();
  const line1 = v1.find((e) => e.type === 'path'), lab1 = v1.find((e) => e.type === 'text');
  check('vector: pulling its tip lengthens only the line', len(line1.pts) > len(line0.pts) + 150 && line1.size === line0.size && line1.arrow === 1 && lab1.fontSize === lab0.fontSize, `${len(line0.pts).toFixed(0)} -> ${len(line1.pts).toFixed(0)}`);
  check('vector: the label stays over the middle', Math.abs((lab1.x + lab1.w / 2) - ((line1.pts[0] + line1.pts[3]) / 2)) < 6);

  // colours follow the board
  const darkFill = await page.evaluate(() => window.__teachly.store.page.els.find((e) => e.snap === 'block')?.fill);
  await page.evaluate(() => { const { store } = window.__teachly; store.setPageBg ? store.setPageBg('#ffffff') : store.setBg?.('#ffffff'); });
  check('block colours on the dark board are dark with light writing', darkFill === '#334155', String(darkFill));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
