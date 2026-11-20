/* sw.js — funcționare 100% offline după prima încărcare */
const CACHE = 'fw-pwa-v21';
const SHELL = [
  './', './index.html', './manifest.json', './css/styles.css', './css/tailwind.css',
  './js/app.js', './js/merge.js', './js/vault.js', './js/drive-sync.js', './js/calculators.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
// Resurse externe versionate (cache-first). API-urile Google NU se cache-uiesc.
const CDN_HOSTS = []; // Tailwind e acum generat local (css/tailwind.css)
const NEVER_CACHE = ['googleapis.com', 'accounts.google.com', 'gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER_CACHE.some((h) => url.hostname.endsWith(h))) return;

  // CDN: cache-first
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Same-origin: network-first (actualizări rapide), fallback cache (offline)
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
  }
});
