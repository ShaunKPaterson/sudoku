// Offline support: serve from the network when online (so updates arrive), fall back to the cache when offline.
const CACHE = 'sudoku-v7';
const ASSETS = ['./', './index.html', './engine.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const FONT_HOSTS = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Web fonts never change at a given URL: serve from the cache first so they also work offline.
  if (FONT_HOSTS.some(h => e.request.url.startsWith(h))) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    })));
    return;
  }
  if (!e.request.url.startsWith(self.location.origin)) return;
  const cached = () => caches.match(e.request, {ignoreSearch: true})
    .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
  const network = fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  });
  // On a slow connection, don't keep the player waiting: after 3 seconds use the saved copy if there is one
  // (the network answer still refreshes the cache for next time).
  const slow = new Promise(resolve => setTimeout(resolve, 3000)).then(cached).then(r => r || network);
  e.respondWith(Promise.race([network.catch(() => cached().then(r => r || Response.error())), slow]));
});
