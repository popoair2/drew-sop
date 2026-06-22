// Service Worker — Drew-Sop PWA
const CACHE_NAME = 'drew-sop-v18';
const BASE = '/drew-sop/';

// Install — skip waiting so new SW activates immediately
self.addEventListener('install', e => {
  self.skipWaiting();
});

// Activate — purge old cache + claim all clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first for HTML/JS/CSS, cache first for icons
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Don't cache API calls
  if (url.hostname.includes('finnhub') || url.hostname.includes('coingecko') ||
      url.hostname.includes('supabase') || url.hostname.includes('exchangerate') ||
      url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('fonts.googleapis')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // For our own assets: network first, fall back to cache
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return resp;
    }).catch(() =>
      caches.open(CACHE_NAME).then(cache => cache.match(e.request))
    )
  );
});
