// PocketPlan Service Worker
const CACHE_NAME = "pocketplan-v2";
const STATIC_ASSETS = [
  "/",
  "/budgets",
  "/transactions",
  "/accounts",
  "/payments",
  "/insights",
  "/settings",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map(async (asset) => {
          try {
            const res = await fetch(asset);
            if (res.ok) {
              await cache.put(asset, res);
            }
          } catch {
            // Silently ignore during development or transient network hiccups
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Avoid caching API routes or external database requests
  if (url.pathname.startsWith("/api/") || url.origin !== location.origin) {
    return;
  }

  // Network first with cache fallback for HTML pages
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request) || caches.match("/"))
    );
    return;
  }

  // Cache first for static assets
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
