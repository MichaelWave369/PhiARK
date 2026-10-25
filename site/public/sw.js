/* Offline cache for FIRST-PARTY static PhiARK Pages assets only.
   This is NOT the private vault, a mirror of third-party sources, or PhiOS. */
const CACHE = 'phiark-pages-v1';
const SCOPE = self.registration.scope;
const HOME = new URL('index.html', SCOPE).href;
const ALLOWED = new URL(SCOPE);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(HOME, { cache: 'reload' });
    if (!response.ok) throw new Error('PhiARK shell unavailable for offline caching');
    const html = await response.clone().text();
    await cache.put(HOME, response.clone());
    await cache.put(SCOPE, response.clone());
    const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map(match => new URL(match[1], SCOPE))
      .filter(url => url.origin === ALLOWED.origin && url.pathname.startsWith(ALLOWED.pathname))
      .map(url => url.href);
    const essential = [new URL('icon.svg', SCOPE).href, new URL('manifest.webmanifest', SCOPE).href];
    await cache.addAll([...new Set([...urls, ...essential])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('phiark-pages-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ALLOWED.origin || !url.pathname.startsWith(ALLOWED.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const shell = await cache.match(HOME);
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
