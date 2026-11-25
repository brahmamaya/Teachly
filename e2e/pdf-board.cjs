// PDFs on classroom boards. Boards often run an old Android WebView (Chrome 80-93): the PDF reader's worker came into
// the build untranslated (class `static {}` blocks, `??=`, …), so on those boards opening a PDF silently did nothing.
//  1. The BUILT app (dist/) holds no syntax newer than Chrome 80 in any script, the PDF worker included.
//  2. On the built app, Insert > PDF on a board-like screen adds the pages and the first page is drawn.
// Needs `npm run build` first.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { check, finish } = require('./lib.cjs');

const dist = path.join(__dirname, '..', 'dist', 'assets');
// newer-than-Chrome-80 syntax (outside strings this is code; the checks are kept simple on purpose)
const NEW = { 'class static block': /\bstatic\s*\{/, '??=': /\?\?=/, '||=': /\|\|=/, '&&=': /&&=/, 'private #field access': /this\.#[A-Za-z_$]/ };
const bad = [];
for (const f of fs.readdirSync(dist).filter((n) => /\.(m?js)$/.test(n))) {
  const s = fs.readFileSync(path.join(dist, f), 'utf8');
  for (const [k, r] of Object.entries(NEW)) if (r.test(s)) bad.push(`${f}: ${k}`);
}
check('the built app (PDF worker included) has no syntax an old board browser (Chrome 80) cannot read', bad.length === 0, bad.join(', '));

function makePdf(n, w, h) {
  const objs = [];
  const add = (s) => objs.push(s) && objs.length;
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pagesId = objs.length + 1 + 2 * n;
  const kids = [];
  for (let i = 0; i < n; i++) {
    const c = `0 0 0 rg 40 40 ${w - 80} ${h - 80} re f BT 1 1 1 rg /F1 60 Tf 80 ${h - 160} Td (Page ${i + 1}) Tj ET`;
    const cid = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${cid} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${n} >>`);
  const cat = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offs = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

(async () => {
  const port = 4180;
  const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore', detached: true });
  await new Promise((r) => setTimeout(r, 3500));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pn-pdf-')), 'Lesson.pdf');
  fs.writeFileSync(file, makePdf(4, 842, 595));
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 11; Board) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Safari/537.36' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${port}/`);
    await p.waitForTimeout(2500);
    const n0 = await p.evaluate(() => window.__teachly.store.doc.pages.length);
    await p.tap('[data-pop=insert]');
    await p.waitForTimeout(500);
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.tap('.popover [data-act=pdf]')]);
    await chooser.setFiles(file);
    const pdfPages = () => p.evaluate(() => window.__teachly.store.doc.pages.filter((pg) => pg.els.some((e) => e.type === 'image' && e.pdf)).length);
    await p.waitForFunction(() => window.__teachly.store.doc.pages.filter((pg) => pg.els.some((e) => e.type === 'image' && e.pdf)).length >= 4, null, { timeout: 20000 }).catch(() => {});
    const n1 = await pdfPages();
    check('Insert > PDF adds the PDF\'s 4 pages (built app, board screen)', n1 === 4, `${n1} PDF pages (notebook had ${n0})`);
    // the PDF page is drawn on the board: its dark box shows in the middle of the screen
    await p.waitForTimeout(2500);
    const dark = await p.evaluate(() => {
      const c = document.querySelector('canvas.ink'), g = c.getContext('2d');
      const d = g.getImageData(Math.round(c.width * 0.45), Math.round(c.height * 0.5), 20, 20).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] < 40 && d[i + 1] < 40) n++;
      return n;
    });
    check('…and the PDF page is drawn on the board', dark > 300, `${dark} dark pixels`);
    check('no page errors', errs.length === 0, errs.join('|'));
  } finally {
    await b.close();
    try {
      process.kill(-server.pid); // the whole group (npx and the server it started)
    } catch {}
  }
  finish();
})();
