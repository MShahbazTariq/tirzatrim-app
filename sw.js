const CACHE_NAME = 'tirzatrim-v6';   // ← bump version to force update

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        );
      }),
      self.clients.claim()
    ])
  );
});

// ============================================================
// FETCH HANDLER — SAFE VERSION
// ============================================================
// Rules:
//  - Skip non-GET requests entirely (POST, PUT, DELETE, PATCH)
//  - Skip cross-origin requests (Supabase API, external CDNs)
//  - Skip non-HTTP(S) protocols
//  - For same-origin GETs: network-first, cache fallback, always
//    return a valid Response
// ============================================================
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Only handle http/https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Skip cross-origin (Supabase, external APIs, CDNs)
  if (url.origin !== self.location.origin) return;

  // Network-first with cache fallback
  event.respondWith(
    (async () => {
      try {
        const networkRes = await fetch(req);
        // Cache successful same-origin responses for offline use
        if (networkRes && networkRes.ok && url.pathname.match(/\.(html|css|js|png|jpg|jpeg|svg|ico|woff2?)$/i)) {
          try {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, networkRes.clone());
          } catch (cacheErr) {
            // Silent — cache failures should never break the request
          }
        }
        return networkRes;
      } catch (err) {
        // Network failed — try cache
        try {
          const cached = await caches.match(req);
          if (cached) return cached;
        } catch (cacheErr) {
          // Ignore cache errors
        }
        // Nothing in cache — return a valid fallback response
        return new Response('Offline', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// ============================================================
// PUSH NOTIFICATION HANDLER (unchanged)
// ============================================================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data = { body: event.data.text() }; }
  }

  const title = data.title || 'TirzaTrim Alert';
  const options = {
    body: data.body || 'New operational update received.',
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url: data.url || '/team.html' }
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TT_DATABASE_MUTATED' });
        });
      })
    ])
  );
});

// ============================================================
// NOTIFICATION CLICK HANDLER (unchanged)
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/team.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
