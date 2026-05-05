/* eslint-disable */
// Service worker for the Phone App PWA.
// Caches the application shell with a stale-while-revalidate strategy.
// CACHE_VERSION is replaced at build time by next.config.ts.

const CACHE_VERSION = self.__PHONE_APP_CACHE_VERSION__ || 'dev';
const SHELL_CACHE = `phone-app-shell-${CACHE_VERSION}`;
const SHELL_URLS = ['/', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('phone-app-shell-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API or auth responses — they must always be fresh.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (
            res.ok &&
            (req.mode === 'navigate' ||
              req.destination === 'document' ||
              req.destination === 'script' ||
              req.destination === 'style')
          ) {
            cache.put(req, res.clone()).catch(() => undefined);
          }
          return res;
        })
        .catch(() => null);
      if (cached) {
        // stale-while-revalidate
        network.catch(() => undefined);
        return cached;
      }
      const fresh = await network;
      if (fresh) return fresh;
      // Last resort: try a cached shell entry.
      return (await cache.match('/')) ?? new Response('offline', { status: 503 });
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'phone-app:skip-waiting') {
    self.skipWaiting();
  }
});
