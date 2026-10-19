// PocketPlan Service Worker v3
const CACHE_NAME = "pocketplan-v3";

self.addEventListener("install", (event) => {
  // Force activation immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Purge all old caches (including pocketplan-v1 and pocketplan-v2)
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Deleting stale cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // CRITICAL FIX: Only intercept GET requests.
  // Cache API explicitly throws an error on POST, PUT, DELETE, PATCH:
  // "TypeError: Failed to execute 'put' on 'Cache': Request method 'POST' is unsupported"
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Avoid caching API routes, development hot-reloads, or external origins
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.origin !== location.origin
  ) {
    return;
  }

  // In development (localhost), bypass service worker caching completely
  // so code changes and hot reload are never stale, preventing hydration mismatches
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // Network-first strategy for live pages with offline cache fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match("/")))
    );
    return;
  }

  // Cache-first for static production assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
