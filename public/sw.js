const CACHE_NAME = 'ges-sms-cache-v2';
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/attendance_empty.jpg'
];

// Install Event: cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching core app shell...');
      return cache.addAll(STATIC_RESOURCES).catch((err) => {
        console.warn('[Service Worker] Pre-cache warning (some files may be compiled dynamically):', err);
      });
    })
  );
  // Force active state directly
  self.skipWaiting();
});

// Activate Event: clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Purging stale obsolete cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: intercept requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // We only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Bypass API routes entirely
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Bypass Firebase firestore protocol routes which shouldn't be cached through local custom SW
  if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('firebase')) {
    return;
  }

  // For navigation requests (loading index.html / app root), use Network-First strategy
  // to ensure users always receive the newest code updates when online, with an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline, fall back to cached root
          return caches.match('/');
        })
    );
    return;
  }

  // Cache-First with Network-Fallback Strategy for non-navigation static resources
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Clone the response before caching it
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch((err) => {
          console.log('[Service Worker] Fetch failed, and no cache match for:', url.pathname);
          return undefined;
        });
    })
  );
});
