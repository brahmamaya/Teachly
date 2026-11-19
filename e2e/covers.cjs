// Subject covers: 12 subjects x 20 covers, a tab per subject in both pickers, the choice is saved, and every card in My notebooks is the same box.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1600);
  const info = await page.evaluate(async () => {
    const m = await import('/src/ui/covers.ts');
    const subj = m.COVER_GROUPS.filter((g) => g.id !== 'gen');
    return {
      general: m.COVER_GROUPS[0].covers.length,
      subjects: subj.map((g) => g.name),
      counts: subj.map((g) => g.covers.length),
      allDistinct: subj.every((g) => new Set(g.covers.map((c) => c.sub.pair)).size === 20 && new Set(g.covers.map((c) => c.sub.drawing + ':' + c.sub.style)).size === 20),
      ids: new Set(m.COVER_GROUPS.flatMap((g) => g.covers.map((c) => c.id))).size,
    };
  });
  check('12 subjects', info.subjects.length === 12 && ['Physics', 'Chemistry', 'Maths', 'History', 'Geography', 'Social science', 'Drawing', 'Zoology', 'Botany'].every((s) => info.subjects.includes(s)), info.subjects.join(','));
  check('20 covers in every subject (240) and the 12 general ones are kept', info.counts.every((n) => n === 20) && info.general === 12 && info.ids === 252, JSON.stringify([info.counts, info.general, info.ids]));
  check('inside a subject no two covers share colours, and none repeats a drawing + layout', info.allDistinct);

  // the new-notebook dialog: tabs, a cover from another subject
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('.mt-tile[data-act=library]');
  await page.waitForTimeout(700);
  await page.click('.nb-new');
  await page.waitForTimeout(700);
  check('the new-notebook dialog has a tab for every subject', (await page.$$('.cv-tab')).length === 13);
  await page.click('.cv-tab[data-cg="zoo"]');
  await page.waitForTimeout(200);
  check('a subject tab shows its 20 covers', (await page.$$('.cv-opt[data-cv^="zoo-"]')).length === 20 && (await page.$$('.cv-opt[data-cv^="phy-"]')).length === 0);
  await page.click('.cv-opt[data-cv="zoo-04"]');
  await page.fill('.nn-box input', 'Animals');
  await page.click('.dl-go');
  await page.waitForTimeout(1200);
  const meta = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('teachly'); r.onsuccess = () => { const g = r.result.transaction('docs').objectStore('docs').get('library'); g.onsuccess = () => res((g.result || []).map((m) => [m.title, m.cover])); }; }));
  check('the chosen subject cover is saved with the notebook', meta.some(([t, c]) => t === 'Animals' && c === 'zoo-04'), JSON.stringify(meta));

  // My notebooks: change a cover from the card menu, with tabs
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('.mt-tile[data-act=library]');
  await page.waitForTimeout(900);
  await page.evaluate(async () => {
    const L = await import('/src/io/library.ts');
    for (const [t, p, c] of [['Wide plain', false, ''], ['Tall maths', true, 'mat-05'], ['Wide history', false, 'his-07'], ['Tall plain', true, '']]) { const d = L.blankNotebook(t, '#000000', p ? 'portrait' : undefined); const s = await L.saveNotebook(d); if (c) await L.setCover(s.id, c); }
  });
  await page.reload();
  await page.waitForTimeout(1800);
  await page.click('[data-pop=menu]');
  await page.waitForTimeout(300);
  await page.click('.mt-tile[data-act=library]');
  await page.waitForTimeout(1200);
  const boxes = await page.$$eval('.lib-grid .nb-card', (cs) => cs.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  check('every card in My notebooks is the same size (within a pixel)', boxes.length >= 6 && boxes.every((x) => Math.abs(x[0] - boxes[0][0]) <= 1 && Math.abs(x[1] - boxes[0][1]) <= 1), JSON.stringify(boxes));
  const covers = await page.$$eval('.lib-grid .nb-card:not(.nb-new) .nb-cover', (cs) => cs.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  check('and so is the area every book stands in', covers.length >= 5 && covers.every((a) => Math.abs(a[0] - covers[0][0]) <= 1 && Math.abs(a[1] - covers[0][1]) <= 1), JSON.stringify(covers));
  const fits = await page.$$eval('.lib-grid .nb-card .nbc', (cs) => cs.every((c) => { const p = c.parentElement.getBoundingClientRect(), r = c.getBoundingClientRect(); return r.width > 20 && r.left >= p.left - 1 && r.right <= p.right + 1 && r.top >= p.top - 1 && r.bottom <= p.bottom + 1; }));
  check('wide and tall covers sit whole inside the area', fits);

  await page.click('.nb-card:not(.nb-new) .nb-more');
  await page.waitForTimeout(300);
  await page.click('.nb-act[data-lib="cover"]');
  await page.waitForTimeout(500);
  check('the cover chooser in My notebooks has the subject tabs too', (await page.$$('.sv-box .cv-tab')).length === 13);
  await page.click('.sv-box .cv-tab[data-g="che"]');
  await page.waitForTimeout(250);
  check('and shows that subject\'s covers', (await page.$$('.sv-box .cv-opt[data-v^="che-"]')).length === 20);
  await page.click('.sv-box .cv-opt[data-v="che-09"]');
  await page.waitForTimeout(700);
  check('a cover picked there is applied', (await page.$$('.lib-grid .nbc[data-a^="che:"]')).length >= 1);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
