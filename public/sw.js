const CACHE = 'st-monicah-field-v2';
const SHELL = ['/field-companion', '/timetable', '/offline.html', '/manifest.json'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request).then(response => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => cached || Response.error());
      return cached || network;
    }));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && (url.pathname === '/field-companion' || url.pathname === '/timetable')) caches.open(CACHE).then(cache => cache.put(url.pathname, response.clone()));
      return response;
    }).catch(async () => (await caches.match(url.pathname)) || (await caches.match('/offline.html')) || Response.error()));
  }
});
