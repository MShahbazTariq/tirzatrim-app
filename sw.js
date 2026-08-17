const CACHE_NAME = 'tirzatrim-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle all Supabase live requests
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
