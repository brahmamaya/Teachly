// Lesson recording that can run for hours: the video is written to the device piece by piece while it records
// (never piling up in memory), stop gives one video file, and a recording cut off by the app closing can still be
// saved the next time the app opens.
const { chromium } = require('playwright');
const { check, finish } = require('./lib.cjs');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const url = process.env.URL || 'http://localhost:5173/';
  await page.goto(url);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__teachly.store.setSettings({ tbShown: ['record'] }));
  await page.waitForTimeout(400);
  const parts = () =>
    page.evaluate(async () => {
      const { allKeys } = await import('/src/io/idb.ts');
      return (await allKeys()).filter((k) => k.startsWith('rec:')).length;
    });
  const start = async () => {
    await page.click('[data-act=record]');
    await page.waitForTimeout(400);
    await page.click('.rq-opt[data-q="720"]');
    await page.click('[data-go]');
    await page.waitForTimeout(500);
  };
  await start();
  await page.mouse.move(300, 300);
  await page.mouse.down();
  for (let i = 0; i < 30; i++) await page.mouse.move(300 + i * 10, 300 + Math.sin(i / 3) * 40);
  await page.mouse.up();
  await page.waitForTimeout(3000);
  const n1 = await parts();
  await page.waitForTimeout(3000);
  const n2 = await parts();
  check('while recording, the video is written to the device piece by piece (more pieces keep coming)', n1 >= 1 && n2 > n1, `${n1} then ${n2} pieces stored`);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('.rec-pill .stop')]);
  const path = await dl.path();
  const size = require('fs').statSync(path).size;
  check('stop gives one video file with everything in it', size > 20000 && /\.(webm|mp4)$/.test(dl.suggestedFilename()), `${dl.suggestedFilename()} ${size} bytes`);
  const saved = await page.evaluate(async () => (await (await import('/src/io/recparts.ts')).leftRecordings()).every((l) => l.saved));
  check('the saved video is marked as handed over (its pieces are cleaned up later)', saved);

  // the app closes in the middle of a recording
  await page.evaluate(async () => {
    const { leftRecordings, clearParts, forgetType } = await import('/src/io/recparts.ts');
    for (const l of await leftRecordings()) await clearParts(l.id).then(() => forgetType(l.id));
  });
  await start();
  await page.waitForTimeout(7000);
  await page.reload();
  await page.waitForTimeout(4500);
  check('after the app closed mid-recording, it offers to save that video', /not finished/.test((await page.textContent('.rec-pill.ready').catch(() => '')) || ''));
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('.rec-pill.ready .save')]);
  const size2 = require('fs').statSync(await dl2.path()).size;
  check('…and the saved video has what was recorded', size2 > 10000, `${size2} bytes`);
  check('no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  finish();
})();
