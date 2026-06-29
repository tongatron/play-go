// Service worker minimale: cache dell'app shell per avvio offline.
// Le chiamate /api/ passano sempre dalla rete.
const CACHE = 'play-go-v1';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/goban.js', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return; // sempre rete
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request)),
  );
});
