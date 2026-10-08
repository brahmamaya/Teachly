// Teachly service worker: works offline, but always shows the newest version
// when online. Pages are network-first; hashed build assets are cache-first.
const CACHE = 'teachly-v4';

// Download the whole app up front so it works offline from the first launch
// (important when it is installed on an iPad home screen).
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const list = await (await fetch('precache.json', { cache: 'no-cache' })).json();
        const cache = await caches.open(CACHE);
        await Promise.all(list.map((f) => cache.add(new Request(f, { cache: 'no-cache' })).catch(() => {})));
      } catch {
        /* offline during install: files are cached as they are used instead */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const hashedAsset = url.pathname.includes('/assets/');
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      if (hashedAsset) {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }
      try {
        // Skip the browser's HTTP cache so a new version shows immediately.
        const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        // Offline: serve the saved copy (the app shell for any page request).
        return (await cache.match(req)) ?? (req.mode === 'navigate' ? await cache.match('./') : undefined) ?? Response.error();
      }
    }),
  );
});
