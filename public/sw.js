// PocketPlan Service Worker v4 - Rapid Open & Offline Support
const CACHE_NAME = "pocketplan-v4";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  // Pre-cache core shell for instant (<50ms) offline/cold-start launch
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => console.warn("[SW] Pre-caching non-fatal warning:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Purge obsolete cache versions
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log("[SW] Deleting obsolete cache:", key);
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests (Cache API does not support POST/PUT/DELETE)
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Bypass API calls, webpack HMR, or foreign origins
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.origin !== location.origin
  ) {
    return;
  }

  // Bypass during local development
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // NAVIGATION REQUESTS (Opening the app or visiting routes)
  // Stale-While-Revalidate: Return cached app shell immediately for instant startup,
  // while updating from network in background. Prevents freezing on server cold starts!
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed or server is sleeping; return cached page or fallback to root shell
            return cachedResponse || caches.match("/");
          });

        // If we have a cached version, serve it instantaneously (<50ms);
        // otherwise wait for network fetch.
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // STATIC ASSETS (_next/static, images, icons, fonts)
  // Cache-First with Network fallback and automatic caching
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, copy);
        });

        return networkResponse;
      });
    })
  );
});
