
const CACHE_NAME = 'shrimp-master-v21';
const OFFLINE_URL = '/index.html';

// Only pre-cache the absolute essentials. 
// Vite generates hashed filenames for JS/CSS, so we cannot list them here manually.
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('PWA: Pre-caching critical assets');
      return cache.addAll(CRITICAL_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('PWA: Removing legacy cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 1. Navigation Requests (Page loads): Network First -> Cache -> Offline Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
           const resClone = response.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
           return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(res => res || caches.match(OFFLINE_URL));
        })
    );
    return;
  }

  // 2. Asset Requests (Images, JS, CSS): Stale-While-Revalidate
  // Serve from cache immediately, then update cache in background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Only cache valid responses (not error codes or opaque responses for external CDNs if strictly needed)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Network failed, just return undefined (the promise will resolve with cachedResponse if available)
      });

      return cachedResponse || fetchPromise;
    })
  );
});
