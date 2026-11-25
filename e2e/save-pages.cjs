// Saving a big notebook during a long lesson: each page is stored on its own and only changed pages are written, so a
// save after a new line stays quick however big the notebook has grown (the whole notebook was written every time and
// the board hung for up to a second). Everything still comes back exactly after a reload: pages, their order, lines,
// a deleted page stays deleted (and its record is removed), older notebooks (pages stored inside) still open and are
// converted, a copy is independent, and deleting a notebook removes all of its pages.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const URL = process.env.URL || 'http://localhost:5173/';
  await p.goto(URL);
  await p.waitForTimeout(1800);
  // 200 pages × 300 lines
  await p.evaluate(() => {
    const { store } = window.__teachly;
    const pages = [];
    for (let q = 0; q < 200; q++) {
      const els = [];
      for (let i = 0; i < 300; i++) {
        const pts = [];
        const x = (i * 37) % 1500, y = (i * 53) % 800;
        for (let k = 0; k < 30; k++) pts.push(x + k * 3, y + Math.sin(k / 3) * 12, 0.5);
        els.push({ id: `s${q}-${i}`, type: 'path', pts, style: 'pen', color: '#ffffff', size: 3, opacity: 1 });
      }
      pages.push({ id: 'pg' + q, bg: '#000000', pattern: 'none', els });
    }
    store.commit(pages, 0);
  });
  await p.evaluate(() => window.__teachly.autosave.saveNow());
  const id = await p.evaluate(() => window.__teachly.store.doc.id);
  // a new line on page 6, saved on a 4x slower CPU
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const r = await p.evaluate(async () => {
    const { store, autosave } = window.__teachly;
    store.goTo(5);
    store.addEls([{ id: 'new-line', type: 'path', pts: [10, 10, 0.5, 90, 90, 0.5], style: 'pen', color: '#fff', size: 3, opacity: 1 }]);
    await new Promise((ok) => setTimeout(ok, 600)); // the page turn and the new line are drawn first: only the save is timed
    let g = 0, l = performance.now(), on = true;
    const f = (t) => {
      g = Math.max(g, t - l);
      l = t;
      if (on) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
    await new Promise((ok) => setTimeout(ok, 100));
    const t0 = performance.now();
    const ok = await autosave.saveNow();
    const ms = performance.now() - t0;
    await new Promise((ok2) => setTimeout(ok2, 200));
    on = false;
    return { ok, ms: Math.round(ms), frame: Math.round(g) };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  check('a save after one new line in a 200-page notebook is quick (4x slower CPU)', r.ok && r.ms < 250 && r.frame < 150, JSON.stringify(r));
  // reload: all there
  const shape = () => p.evaluate(() => { const d = window.__teachly.store.doc; return { id: d.id, n: d.pages.length, ids: d.pages.map((x) => x.id).join(','), lines: d.pages.reduce((s, x) => s + x.els.length, 0), has: d.pages[5]?.els.some((e) => e.id === 'new-line') }; });
  await p.reload();
  await p.waitForTimeout(2500);
  let s = await shape();
  check('after a reload the notebook is all there (200 pages, every line, the new line on page 6)', s.id === id && s.n === 200 && s.lines === 200 * 300 + 1 && s.has, JSON.stringify({ ...s, ids: undefined }));
  // delete page 10, move the last page to the front
  await p.evaluate(() => {
    const { store } = window.__teachly;
    const pages = store.doc.pages.filter((x) => x.id !== 'pg9');
    pages.unshift(pages.pop());
    store.commit(pages, 0);
  });
  const want = await shape();
  await p.evaluate(() => window.__teachly.autosave.saveNow());
  await p.reload();
  await p.waitForTimeout(2500);
  s = await shape();
  check('a deleted page stays deleted and a moved page stays moved after a reload', s.n === 199 && s.ids === want.ids, `${s.n} pages`);
  const recs = await p.evaluate(async (id) => { const keys = await new Promise((ok) => { const r = indexedDB.open('teachly'); r.onsuccess = () => { const q = r.result.transaction('docs').objectStore('docs').getAllKeys(); q.onsuccess = () => ok(q.result.map(String)); }; }); return keys.filter((k) => k.startsWith(`pg:${id}:`)).length; }, id);
  check('…and the deleted page\'s record is gone (one record per page)', recs === 199, `${recs} records`);
  // an older notebook (pages stored inside the notebook) still opens, and is converted when saved
  const old = await p.evaluate(async () => {
    const { library, store, autosave } = window.__teachly;
    const doc = { version: 1, id: 'oldnb', title: 'Old one', schema: 2, rev: 1, pages: [{ id: 'o1', bg: '#000000', pattern: 'none', els: [{ id: 'oe', type: 'path', pts: [1, 1, 0.5, 9, 9, 0.5], style: 'pen', color: '#fff', size: 3, opacity: 1 }] }, { id: 'o2', bg: '#000000', pattern: 'none', els: [] }] };
    await new Promise((ok) => { const r = indexedDB.open('teachly'); r.onsuccess = () => { const tx = r.result.transaction('docs', 'readwrite'); const os = tx.objectStore('docs'); os.put(doc, 'nb:oldnb'); os.put(1, 'rv:oldnb'); const g = os.get('library'); g.onsuccess = () => os.put([{ id: 'oldnb', title: 'Old one', updated: Date.now(), pages: 2, thumb: '' }, ...(g.result || [])], 'library'); tx.oncomplete = ok; }; });
    const loaded = await library.loadNotebook('oldnb');
    store.loadDoc(loaded);
    store.addEls([{ id: 'oe2', type: 'path', pts: [1, 1, 0.5, 19, 19, 0.5], style: 'pen', color: '#fff', size: 3, opacity: 1 }]);
    await autosave.saveNow();
    const again = await library.loadNotebook('oldnb');
    return { first: loaded.pages.length, lines: again.pages[0].els.length, n: again.pages.length };
  });
  check('an older notebook (pages inside) opens, and after a save it reads back right', old.first === 2 && old.n === 2 && old.lines === 2, JSON.stringify(old));
  // a copy is independent; deleting a notebook removes all its pages
  const cp = await p.evaluate(async () => {
    const { library } = window.__teachly;
    await library.duplicateNotebook('oldnb');
    const copy = (await library.listNotebooks()).find((m) => m.title === 'Old one (copy)');
    await library.deleteNotebook('oldnb');
    const c = await library.loadNotebook(copy.id);
    const keys = await new Promise((ok) => { const r = indexedDB.open('teachly'); r.onsuccess = () => { const q = r.result.transaction('docs').objectStore('docs').getAllKeys(); q.onsuccess = () => ok(q.result.map(String)); }; });
    return { copyPages: c?.pages.length, oldLeft: keys.filter((k) => k.startsWith('pg:oldnb:') || k === 'nb:oldnb').length };
  });
  check('a copy keeps its own pages, and a deleted notebook leaves no page behind', cp.copyPages === 2 && cp.oldLeft === 0, JSON.stringify(cp));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
