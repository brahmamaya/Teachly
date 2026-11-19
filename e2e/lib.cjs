// Shared helpers for the browser checks (run with: node e2e/<file>.cjs, dev server on :5173).
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5173/';
async function open(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(1500);
  return { browser, ctx, page, errors };
}
/** The live document, through the app's own store (read only). */
const doc = (page) => page.evaluate(() => { const { store } = window.__teachly; return JSON.parse(JSON.stringify({ id: store.doc.id, index: store.index, pages: store.doc.pages.map((p) => ({ id: p.id, els: p.els.map((e) => ({ id: e.id, type: e.type, x: e.x, y: e.y, w: e.w, h: e.h, rot: e.rot, text: e.text, locked: e.locked, n: e.pts ? e.pts.length : 0 })) })) })); });
/** What is really stored on the device for the open notebook. */
const stored = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const q = indexedDB.open('teachly');
        q.onsuccess = () => {
          const s = q.result.transaction('docs').objectStore('docs');
          const g = s.getAllKeys();
          g.onsuccess = () => {
            const k = g.result.find((x) => String(x).startsWith('nb:'));
            const d = s.get(k);
            d.onsuccess = () => res(d.result ? JSON.parse(JSON.stringify(d.result, (kk, v) => (typeof v === 'string' && v.length > 200 ? v.slice(0, 40) + '…' : v))) : null);
          };
        };
      }),
  );
module.exports = { open, doc, stored, chromium };

// ---- more helpers --------------------------------------------------------------
const IMG = process.env.IMG || '/tmp/claude-0/-home-user/d5235605-7a47-541d-aa6c-5d97c2dc1d83/scratchpad/img';
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) fails++; };
const finish = () => { console.log(fails ? `\n${fails} check(s) FAILED` : '\nall checks passed'); process.exitCode = fails ? 1 : 0; };
/** Screen position of a world point. */
const scr = (page, wx, wy) => page.evaluate(([x, y]) => { const b = window.teachly.board; const [sx, sy] = b.toScreen(x, y); const r = b.el.getBoundingClientRect(); return [sx + r.left, sy + r.top]; }, [wx, wy]);
/** Wait until everything is written (status saved and the stored revision matches). */
const settled = (page, ms = 8000) => page.waitForFunction(() => { const t = window.__teachly; return t.autosave.saveState().status === 'saved' && t.autosave.confirmedRev() === (t.store.doc.rev ?? 0); }, null, { timeout: ms });
/** A point that is certainly on the element: the first point of a line, else the centre of a box. */
const anchor = (page, id) => page.evaluate((id) => {
  const { store } = window.__teachly;
  const box = (e) => { if (e.pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < e.pts.length; i += 3) { x0 = Math.min(x0, e.pts[i]); x1 = Math.max(x1, e.pts[i]); y0 = Math.min(y0, e.pts[i + 1]); y1 = Math.max(y1, e.pts[i + 1]); } return { x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: y1 - y0 + 16 }; } return { x: e.x, y: e.y, w: e.w, h: e.h }; };
  for (const p of store.doc.pages) {
    const k = p.els.findIndex((x) => x.id === id); if (k < 0) continue;
    const e = p.els[k], above = p.els.slice(k + 1).map(box);
    const free = (x, y) => !above.some((b) => x >= b.x - 10 && x <= b.x + b.w + 10 && y >= b.y - 10 && y <= b.y + b.h + 10);
    const cands = [];
    if (e.pts) for (let i = 0; i < e.pts.length; i += 3) cands.push([e.pts[i], e.pts[i + 1]]);
    else for (let u = 0.1; u < 1; u += 0.2) for (let v = 0.1; v < 1; v += 0.2) cands.push([e.x + e.w * u, e.y + e.h * v]);
    const c = cands.find(([x, y]) => free(x, y));
    return c ? [c[0], c[1], p.id, true] : [cands[0][0], cands[0][1], p.id, false];
  }
  return null;
}, id);
const goToPage = (page, pid) => page.evaluate((pid) => { const { store } = window.__teachly; store.goTo(store.doc.pages.findIndex((p) => p.id === pid)); }, pid);
/** The piece of an element that moves when it is moved (for before / after). */
const where = (page, id) => page.evaluate((id) => { const { store } = window.__teachly; for (const p of store.doc.pages) { const e = p.els.find((x) => x.id === id); if (e) return e.pts ? [e.pts[0], e.pts[1]] : [e.x, e.y]; } return null; }, id);
async function insertPhoto(page, n) {
  await page.click('[data-pop=insert]'); await page.waitForTimeout(250);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('.pm-item[data-act=image]')]);
  await fc.setFiles(`${IMG}/photo${n}.png`); await page.waitForTimeout(500);
}
async function dragEl(page, id, dx, dy) {
  const [wx, wy, pid] = await anchor(page, id);
  await goToPage(page, pid); await page.evaluate(() => window.__teachly.store.clearSelection()); await page.click('[data-tool=select]'); await page.waitForTimeout(150);
  const [sx, sy] = await scr(page, wx, wy);
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + dx / 2, sy + dy / 2, { steps: 4 }); await page.mouse.move(sx + dx, sy + dy, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(150);
}
Object.assign(module.exports, { IMG, check, finish, scr, settled, anchor, goToPage, where, insertPhoto, dragEl });
