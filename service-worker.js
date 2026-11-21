// My Fast service worker.
// App code (page, app.js, style.css) is network-first so updates show up right away; icons, the
// manifest and the Supabase library are cache-first. Bump CACHE_NAME when those change.
const CACHE_NAME = 'my-fast-v6';
const CORE = ['./', './index.html', './style.css?v=5', './app.js?v=5', './supabase.js', './manifest.json'];
const OPTIONAL = [
  './icons/icon-192-v2.png',
  './icons/icon-512-v2.png',
  './icons/icon-maskable-192-v2.png',
  './icons/icon-maskable-512-v2.png',
  './icons/badge-96-v2.png',
  './fonts/inter-latin-wght-normal.woff2',
  './fonts/inter-cyrillic-wght-normal.woff2',
];

self.addEventListener('install', (event) => {
  const fresh = (url) => new Request(url, { cache: 'reload' });
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(CORE.map(fresh)).then(() =>
        Promise.all(OPTIONAL.map((url) => cache.add(fresh(url)).catch(() => {})))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Only this app's old caches: My Fleet and other apps on ttomov88.github.io share cache storage.
    const keys = await caches.keys();
    const old = keys.filter((k) => (k.startsWith('my-fast-') || k.startsWith('fasttrack-cache')) && k !== CACHE_NAME);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Coming from the old cache-first version: reload open windows once so they get the new app.
    if (old.some((k) => k.startsWith('fasttrack-cache'))) {
      const wins = await self.clients.matchAll({ type: 'window' });
      wins.forEach((w) => { try { w.navigate(w.url); } catch (e) {} });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;   // account data always comes fresh from Supabase
  const isPage = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isAppCode = isPage || /\/(app\.js|style\.css)$/.test(url.pathname);

  if (isAppCode) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || (isPage ? caches.match('./index.html') : Response.error())))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});

// Goal reached / time to start, sent by the server even when the app is closed.
self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (e) { msg = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(msg.title || 'My Fast', {
    body: msg.body || '',
    icon: 'icons/icon-192-v2.png',
    badge: 'icons/badge-96-v2.png',
    tag: msg.tag || 'my-fast',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) { if ('focus' in w) return w.focus(); }
      return self.clients.openWindow('./');
    })
  );
});
