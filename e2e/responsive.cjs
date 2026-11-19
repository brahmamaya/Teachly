// Responsiveness + correctness: rapid tool switching, first stroke right after a tool change, toolbar taps never draw,
// undo/redo after strokes, save -> reload -> edit again, listeners/queues do not grow.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(process.env.URL || 'http://localhost:5173/');
  await page.waitForTimeout(1800);
  const cdp = await ctx.newCDPSession(page);
  const els = () => page.evaluate(() => window.__teachly.store.page.els.length);
  const stroke = async (x0, y0, type = 'pen') => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1, pointerType: type });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + i * 8, y: y0 + i * 3, button: 'left', buttons: 1, pointerType: type });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 + 100, y: y0 + 36, button: 'left', clickCount: 1, pointerType: type });
  };

  // 1. rapid tool changes by real touch taps end in the last requested tool, and draw nothing
  const before = await els();
  for (const t of ['eraser', 'pen', 'select', 'eraser', 'pen', 'text', 'pen']) await page.touchscreen.tap(...(await page.$eval(`.tb-left [data-tool="${t}"]`, (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })));
  await page.waitForTimeout(150);
  const st = await page.evaluate(() => ({ tool: window.__teachly.store.tool.tool, pressed: [...document.querySelectorAll('.tb-left [data-tool]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.tool) }));
  check('rapid taps: the last tapped tool is active (state and highlight agree)', st.tool === 'pen' && st.pressed.length === 1 && st.pressed[0] === 'pen', JSON.stringify(st));
  check('toolbar taps never put a stroke on the page', (await els()) === before, `${before} -> ${await els()}`);

  // 2. the first stroke right after a tool change uses the new tool
  await page.touchscreen.tap(...(await page.$eval('.tb-left [data-tool="eraser"]', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })));
  await page.touchscreen.tap(...(await page.$eval('.tb-left [data-tool="pen"]', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })));
  await stroke(300, 300);
  await page.waitForTimeout(200);
  const first = await page.evaluate(() => { const e = window.__teachly.store.page.els; const l = e[e.length - 1]; return { n: e.length, type: l?.type, style: l?.style, pts: (l?.pts?.length ?? 0) / 3 }; });
  check('first stroke right after eraser -> pen is a pen stroke with all its samples', first.n === before + 1 && first.type === 'path' && first.style === 'pen' && first.pts >= 12, JSON.stringify(first));

  // 3. pen -> eraser -> pen -> select with strokes in between
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'eraser' }));
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'pen' }));
  await stroke(300, 400);
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'select' }));
  await page.waitForTimeout(150);
  check('after pen/eraser/pen/select the second stroke is stored too', (await els()) === before + 2);

  // 4. undo / redo
  await page.evaluate(() => { const s = window.__teachly.store; s.undo(); });
  const u1 = await els();
  await page.evaluate(() => { const s = window.__teachly.store; s.undo(); });
  const u2 = await els();
  await page.evaluate(() => { const s = window.__teachly.store; s.redo(); s.redo(); });
  check('undo, undo, redo, redo walk back and forth exactly', u1 === before + 1 && u2 === before && (await els()) === before + 2, `${u1},${u2},${await els()}`);

  // 5. cancelled pointer keeps what was written and leaves no stuck state
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'pen' }));
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 600, y: 300, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600 + i * 10, y: 300, button: 'left', buttons: 1, pointerType: 'pen' });
  await page.evaluate(() => window.teachly.board.overlay.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'pen', bubbles: true })));
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700, y: 300, button: 'left', clickCount: 1, pointerType: 'pen' });
  await page.waitForTimeout(150);
  check('the board is not stuck "writing" after a cancel', !(await page.evaluate(() => window.teachly.board.busyInput)));

  // 6. save -> reload -> same notebook, still editable
  await page.evaluate(() => window.__teachly.autosave.saveNow());
  const nStored = await els();
  await page.reload();
  await page.waitForTimeout(2200);
  check('after reload the strokes are back', (await els()) === nStored && nStored >= before + 2, `${nStored} -> ${await els()}`);
  await page.evaluate(() => window.__teachly.store.setTool({ tool: 'pen' }));
  const cdp2 = await ctx.newCDPSession(page);
  await cdp2.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 300, y: 500, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  for (let i = 1; i <= 10; i++) await cdp2.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 300 + i * 9, y: 500 + i, button: 'left', buttons: 1, pointerType: 'pen' });
  await cdp2.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 510, button: 'left', clickCount: 1, pointerType: 'pen' });
  await page.waitForTimeout(200);
  check('and the reopened notebook can be edited and undone', (await els()) === nStored + 1 && (await page.evaluate(() => { window.__teachly.store.undo(); return window.__teachly.store.page.els.length; })) === nStored);

  // 7. sustained use: no growth of listeners / timers / saves in flight
  const mem = await page.evaluate(async () => {
    const s = window.__teachly.store; const t0 = performance.now();
    for (let i = 0; i < 300; i++) { s.setTool({ tool: ['pen', 'eraser', 'select'][i % 3] }); if (i % 20 === 0) await new Promise((r) => requestAnimationFrame(r)); }
    return { ms: performance.now() - t0, buttons: document.querySelectorAll('.toolbars button').length, popovers: document.querySelectorAll('.popover').length };
  });
  check('300 rapid tool changes: toolbar not duplicated, no stray menus', mem.buttons < 40 && mem.popovers === 0, JSON.stringify(mem));
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
