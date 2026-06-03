// Service Worker — Drew-Sop PWA
const CACHE_NAME = 'drew-sop-v3';
const BASE = '/drew-sop/';
const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'css/style.css',
  BASE + 'js/utils.js',
  BASE + 'js/storage.js',
  BASE + 'js/api.js',
  BASE + 'js/charts.js',
  BASE + 'js/app.js',
  BASE + 'manifest.json',
  BASE + 'assets/icon-192.png',
  BASE + 'assets/icon-512.png'
];

// Install — cache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — purge old cache
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache first for shell, network first for API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Don't cache API calls
  if (url.hostname.includes('finnhub') || url.hostname.includes('coingecko') || url.hostname.includes('supabase') || url.hostname.includes('exchangerate')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Cache first for static assets
  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        if (resp.ok) cache.put(e.request, resp.clone());
        return resp;
      }))
    )
  );
});
