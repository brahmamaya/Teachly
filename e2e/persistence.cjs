// A. Persistence: three pages of mixed content stay individually editable after reload, close / reopen,
//    rapid edits, failed saves, stale saves and an older saved document.
const { open, doc, check, finish, settled, anchor, goToPage, where, insertPhoto, dragEl, scr } = require('./lib.cjs');

(async () => {
  let { browser, ctx, page, errors } = await open();
  const tt = (fn, ...a) => page.evaluate(fn, ...a);

  // ---- build three pages the way a teacher does -------------------------------------------------
  const stroke = async (x, y) => { await page.click('[data-tool=pen]'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 120, y + 30, { steps: 8 }); await page.mouse.move(x + 200, y - 10, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(100); };
  const text = async (x, y, s) => { await page.click('[data-tool=text]'); await page.mouse.click(x, y); await page.keyboard.type(s); await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
  const rect = async (x, y) => { await page.click('[data-tool=shape]'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 60, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(100); };
  await stroke(250, 250); await text(250, 400, 'Page one'); await rect(500, 300); await insertPhoto(page, 1);
  await page.click('[data-act=next]'); await page.waitForTimeout(300);
  await stroke(260, 260); await insertPhoto(page, 2); await text(300, 500, 'Second');
  await page.click('[data-act=next]'); await page.waitForTimeout(300);
  await rect(300, 300); await text(300, 480, 'Third page'); await insertPhoto(page, 3);
  let d = await doc(page);
  check('three pages built', d.pages.length === 3 && d.pages.every((p) => p.els.length >= 3), JSON.stringify(d.pages.map((p) => p.els.map((e) => e.type[0]).join(''))));

  // ---- move, resize, rotate a photo ---------------------------------------------------------------
  const photo = d.pages[0].els.find((e) => e.type === 'image');
  await dragEl(page, photo.id, 70, 40);
  await tt(() => { const bd = window.teachly.board; return bd.selectionBounds(); });
  const bounds = await tt(() => window.teachly.board.selectionBounds());
  const [cx, cy] = await scr(page, bounds.x + bounds.w, bounds.y + bounds.h);
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 25, cy + 18, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
  const b2 = await tt(() => window.teachly.board.selectionBounds());
  const [rx, ry] = await scr(page, b2.x + b2.w / 2, b2.y - 40 / (await tt(() => window.teachly.board.cam.z)));
  await page.mouse.move(rx, ry); await page.mouse.down(); await page.mouse.move(rx + 70, ry + 10, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(250);
  const edited = (await doc(page)).pages[0].els.find((e) => e.id === photo.id);
  check('photo moved, resized and rotated', edited.x !== photo.x && edited.w !== photo.w && Math.abs(edited.rot) > 0.05, `dx ${Math.round(edited.x - photo.x)} dw ${Math.round(edited.w - photo.w)} rot ${edited.rot.toFixed(2)}`);

  await settled(page);
  const before = await doc(page);
  const status = await tt(() => window.__teachly.autosave.saveState().status);
  check('autosave reports Saved after the edits', status === 'saved');
  const raw = await tt(async () => { const { store } = window.__teachly; return new Promise((res) => { const q = indexedDB.open('teachly'); q.onsuccess = () => { const s = q.result.transaction('docs').objectStore('docs'); const g = s.get('nb:' + store.doc.id); g.onsuccess = () => { const keys = s.getAllKeys(); keys.onsuccess = () => res({ rev: g.result.rev, schema: g.result.schema, srcs: g.result.pages.flatMap((p) => p.els.filter((e) => e.type === 'image').map((e) => e.src.slice(0, 12))), assets: keys.result.filter((k) => String(k).startsWith('asset:')).length, size: JSON.stringify(g.result).length }); }; }; }); });
  check('photos are stored as separate assets, notebook record is small', raw.srcs.every((s) => s.startsWith('asset:')) && raw.assets === 3 && raw.size < 20000, JSON.stringify(raw));

  // ---- editable after reload and after closing / reopening ------------------------------------
  const verify = async (label) => {
    const now = await doc(page);
    const same = JSON.stringify(now.pages.map((p) => p.els.map((e) => [e.id, e.type, Math.round(e.x ?? 0), Math.round(e.y ?? 0), Math.round(e.w ?? 0), Math.round(e.h ?? 0), +(e.rot ?? 0).toFixed(3), e.text ?? '']))) === JSON.stringify(before.pages.map((p) => p.els.map((e) => [e.id, e.type, Math.round(e.x ?? 0), Math.round(e.y ?? 0), Math.round(e.w ?? 0), Math.round(e.h ?? 0), +(e.rot ?? 0).toFixed(3), e.text ?? ''])));
    check(`${label}: same pages, elements, positions, rotation and text`, same);
    let editable = 0, total = 0, covered = 0;
    for (const p of now.pages) for (const e of p.els) {
      const free = (await anchor(page, e.id))[3];
      if (!free) { covered++; continue; } // lies completely under a later photo: cannot be tapped, as on paper
      total++;
      const w0 = await where(page, e.id);
      await dragEl(page, e.id, 40, 25);
      const w1 = await where(page, e.id);
      if (Math.hypot(w1[0] - w0[0], w1[1] - w0[1]) > 5) editable++; else console.log('   not movable:', e.type, e.id, JSON.stringify(w0), 'sel', await page.evaluate(() => [...window.__teachly.store.selection]), 'page', await page.evaluate(() => window.__teachly.store.page.id), p.id, 'cam', JSON.stringify(await page.evaluate(() => window.teachly.board.cam)));
      await page.evaluate(() => window.__teachly.store.undo()); await page.waitForTimeout(80);
    }
    check(`${label}: every element can be selected and moved`, editable === total, `${editable}/${total} (${covered} completely covered by a later photo, skipped)`);
    // text can be edited again
    const t = now.pages.flatMap((p) => p.els.map((e) => ({ ...e, pid: p.id }))).find((e) => e.type === 'text');
    await goToPage(page, t.pid); await page.click('[data-tool=text]');
    const [tx, ty] = await anchor(page, t.id).then(([x, y]) => scr(page, x, y));
    await page.mouse.click(tx, ty); await page.waitForTimeout(250);
    const opened = await page.$eval('.text-editor', (e) => e.value).catch(() => null);
    await page.keyboard.press('End'); await page.keyboard.type('!'); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    const after = (await doc(page)).pages.flatMap((p) => p.els).find((e) => e.id === t.id);
    check(`${label}: text opens in the editor and can be changed`, opened === t.text && after.text === t.text + '!', `${opened} -> ${after.text}`);
    await page.evaluate(() => window.__teachly.store.undo()); await page.waitForTimeout(100);
  };
  await page.reload(); await page.waitForTimeout(2500);
  await verify('after reload');
  await settled(page);
  await page.close();
  page = await ctx.newPage(); errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/'); await page.waitForTimeout(2500);
  await verify('after closing and reopening');
  check('photos are drawn from the stored assets', await tt(async () => { const { store } = window.__teachly; const { imagesReady } = await import('/src/renderer.ts?x=' + Date.now()).catch(() => ({})); return store.doc.pages.every((p) => p.els.filter((e) => e.type === 'image').every((e) => e.src.startsWith('asset:'))); }));

  // ---- rapid consecutive edits, then close at once ---------------------------------------------------
  const target = (await doc(page)).pages[1].els.find((e) => e.type === 'image');
  await goToPage(page, (await doc(page)).pages[1].id);
  await tt((id) => { const { store } = window.__teachly; for (let i = 0; i < 30; i++) store.mapEls(new Set([id]), (e) => ({ ...e, x: e.x + 2 })); }, target.id);
  const finalX = (await where(page, target.id))[0];
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await page.waitForTimeout(200); await page.close(); // the app is going away
  page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/'); await page.waitForTimeout(2500);
  const x2 = (await where(page, target.id))[0];
  check('30 rapid edits then closing at once: the last state is on the device', Math.abs(x2 - finalX) < 0.01, `${x2} vs ${finalX}`);

  // ---- failed saves keep the edits, say so, and recover ------------------------------------------------
  await page.evaluate(() => { window.__fail = 2; const real = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...a) { if (window.__fail > 0) { window.__fail--; throw new DOMException('disk full', 'QuotaExceededError'); } return real.apply(this, a); }; });
  const t2 = (await doc(page)).pages[0].els.find((e) => e.type === 'image');
  await page.evaluate((id) => { const { store } = window.__teachly; store.goTo(0); store.mapEls(new Set([id]), (e) => ({ ...e, x: e.x + 33 })); }, t2.id);
  await page.waitForFunction(() => window.__teachly.autosave.saveState().status === 'error', null, { timeout: 6000 });
  const pill = await page.$eval('.save-pill', (e) => ({ state: e.dataset.state, text: e.textContent, hidden: e.hidden }));
  check('a failed save is shown ("Not saved" with Retry) and the edit stays in memory', pill.state === 'error' && /Not saved/.test(pill.text) && /Retry/.test(pill.text) && (await where(page, t2.id))[0] === t2.x + 33, pill.text.slice(0, 80));
  await page.click('.save-pill [data-sv=retry]');
  await page.waitForFunction(() => window.__teachly.autosave.saveState().status === 'saved', null, { timeout: 12000 });
  await settled(page);
  await page.reload(); await page.waitForTimeout(2500);
  check('after the failures the edit is saved', Math.abs((await where(page, t2.id))[0] - (t2.x + 33)) < 0.01);

  // ---- an older save can never replace a newer one --------------------------------------------------------
  const r = await page.evaluate(async () => {
    const { store, library } = window.__teachly;
    const newer = { ...store.doc, rev: (store.doc.rev ?? 0) + 10, title: 'NEWER' };
    const older = { ...store.doc, rev: (store.doc.rev ?? 0) + 5, title: 'OLDER' };
    // fired together, newest first, then oldest: the oldest must be refused
    const res = await Promise.all([library.saveNotebookChecked(newer), library.saveNotebookChecked(older)]);
    const stored = await library.loadNotebook(store.doc.id);
    // oldest first, then newest: both go through, the newest stays
    const res2 = await Promise.all([library.saveNotebookChecked({ ...older, rev: newer.rev + 1, title: 'MID' }), library.saveNotebookChecked({ ...newer, rev: newer.rev + 2, title: 'LAST' })]);
    const stored2 = await library.loadNotebook(store.doc.id);
    return { res, title: stored.title, res2, title2: stored2.title };
  });
  check('a stale save is refused and the newer notebook stays', r.res[0] === true && r.res[1] === false && r.title === 'NEWER', JSON.stringify(r));
  check('saves fired out of order end with the newest', r.res2.every(Boolean) && r.title2 === 'LAST');

  // ---- an older saved document (format 1: pictures inside, repeated ids, a flat page) ------------------------
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#e0a'; x.fillRect(0, 0, 300, 200); return c.toDataURL('image/png'); });
  await page.evaluate(async (png) => {
    const old = { version: 1, id: 'oldnb', title: 'Old lesson', pages: [
      { id: 'op1', bg: '#000000', pattern: 'none', els: [ { id: 'dup', type: 'text', x: 200, y: 200, w: 200, h: 60, rot: 0, text: 'old text', color: '#fff', fontSize: 40 }, { id: 'dup', type: 'image', x: 500, y: 300, w: 300, h: 200, rot: 0, src: png }, { id: 'pa', type: 'path', pts: [300, 600, 0.5, 500, 640, 0.5], style: 'pen', color: '#fff', size: 4 } ] },
      { id: 'op2', bg: '#ffffff', pattern: 'none', els: [ { id: 'flat', type: 'image', x: 0, y: 0, w: 1600, h: 900, rot: 0, locked: true, src: png } ] } ] };
    await new Promise((res) => { const q = indexedDB.open('teachly'); q.onsuccess = () => { const tx = q.result.transaction('docs', 'readwrite'); const s = tx.objectStore('docs'); s.put(old, 'nb:oldnb'); const g = s.get('library'); g.onsuccess = () => { s.put([{ id: 'oldnb', title: 'Old lesson', updated: Date.now() + 1e6, pages: 2, thumb: '', folder: '' }, ...(g.result || [])], 'library'); }; tx.oncomplete = res; }; });
  }, png);
  await page.evaluate(() => localStorage.setItem('teachly.lastNotebook', 'oldnb'));
  await page.reload(); await page.waitForTimeout(3500);
  const toast = await page.$$eval('.toast', (a) => a.map((x) => x.textContent).join(' | '));
  const od = await doc(page);
  const ids = od.pages.flatMap((p) => p.els.map((e) => e.id));
  check('old notebook opens, repeated ids are repaired', od.id === 'oldnb' && new Set(ids).size === ids.length, ids.join(','));
  check('the teacher is told about the update and the flat page', /older version/.test(toast) && /flat picture/.test(toast), toast.slice(0, 160));
  await settled(page, 15000);
  const after = await page.evaluate(async () => {
    const q = await new Promise((ok) => { const r = indexedDB.open('teachly'); r.onsuccess = () => ok(r.result); });
    const get = (k) => new Promise((ok) => { const g = q.transaction('docs').objectStore('docs').get(k); g.onsuccess = () => ok(g.result); });
    const a = await get('nb:oldnb'), b = await get('bak:oldnb:v1');
    return { schema: a.schema, srcs: a.pages.flatMap((p) => p.els.filter((e) => e.type === 'image').map((e) => e.src.slice(0, 6))), backupSrc: b?.pages?.[0]?.els?.[1]?.src?.slice(0, 11), backupSchema: b?.schema ?? 1, backupIds: b?.pages?.[0]?.els?.map((e) => e.id).join(',') };
  });
  check('old notebook is saved in the new format, pictures as assets', after.schema === 2 && after.srcs.every((s) => s === 'asset:'), JSON.stringify(after));
  check('the untouched original is kept (bak:oldnb:v1)', after.backupSrc === 'data:image/' && after.backupSchema === 1 && after.backupIds === 'dup,dup,pa', JSON.stringify(after));
  const flatEl = od.pages[1].els[0];
  check('the flat page stays a picture (not pretended to be rebuilt)', flatEl.type === 'image' && flatEl.locked === true);
  await dragEl(page, od.pages[0].els.find((e) => e.type === 'image').id, 50, 30);
  const moved = await where(page, od.pages[0].els.find((e) => e.type === 'image').id);
  check('old notebook elements are editable', Math.abs(moved[0] - 500) > 5, JSON.stringify(moved));

  errors = errors.filter((m) => m !== 'disk full');
  check('no page errors during the run (apart from the simulated disk-full)', errors.length === 0, errors.slice(0, 2).join(' / '));
  await browser.close();
  finish();
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(2); });
