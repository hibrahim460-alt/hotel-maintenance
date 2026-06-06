// Minimal offline service worker fallback script (sw.js)
const CACHE_NAME = 'roster-env-v1';

self.addEventListener('install', (e) => {
  // Instantly activate the new service worker instance without waiting
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Claim all active client tabs immediately
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Network-first execution strategy pass-through without blocking runtime operations
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
