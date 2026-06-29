/**
 * PayFlow Service Worker
 * ───────────────────────────────────────────────────────────────────────────
 * Strategy: Cache-First for static assets, Network-Only for API calls.
 * This ensures the app loads offline while NEVER caching sensitive payment
 * data, authentication tokens, or any API responses.
 *
 * Security guarantees:
 *  - /user, /wallet, /transaction, /qr, /rewards, /otp, /referral, /bank
 *    routes are NEVER cached (network-only, pass-through).
 *  - Auth headers / tokens are NOT stored or intercepted.
 *  - Only static build assets are cached (HTML, CSS, JS, images, fonts).
 */

const CACHE_NAME = 'payflow-static-v1';

/**
 * Static assets to pre-cache on SW install.
 * Vite generates hashed filenames, so we cache the root shell
 * and let runtime caching pick up the hashed bundles automatically.
 */
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

/**
 * API path prefixes that must NEVER be cached.
 * Any request whose URL pathname starts with one of these
 * will always go directly to the network.
 */
const API_PREFIXES = [
  '/user',
  '/wallet',
  '/transaction',
  '/qr',
  '/rewards',
  '/otp',
  '/referral',
  '/bank',
  '/notifications',
];

// ─── Helper: is this request an API call we must NOT cache? ───────────────────
function isApiRequest(request) {
  const url = new URL(request.url);
  // Only apply to same-origin or known backend origins
  return API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

// ─── Helper: is this a navigation request (HTML page load)? ──────────────────
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// ─── Helper: is this a static cacheable asset? ───────────────────────────────
function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|ico)$/) !== null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — pre-cache critical shell assets
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing PayFlow Service Worker…');

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching shell assets');
        // Use addAll with individual error handling so one missing file
        // doesn't abort the entire install.
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) =>
              console.warn(`[SW] Pre-cache failed for ${url}:`, err)
            )
          )
        );
      })
      .then(() => {
        // Skip the waiting phase; the new SW activates immediately.
        return self.skipWaiting();
      })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — delete outdated caches
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating PayFlow Service Worker…');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => {
        // Claim all open clients so the new SW controls them immediately.
        return self.clients.claim();
      })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — intercept all network requests
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Only handle GET requests — never intercept POST/PUT/DELETE etc.
  if (request.method !== 'GET') return;

  // 2. API calls → network-only (pass straight through, never cache).
  //    This covers all sensitive payment & user data.
  if (isApiRequest(request)) {
    // Let the browser handle it natively — no event.respondWith() call.
    return;
  }

  // 3. Navigation requests (HTML) → Network-first, fall back to cached shell.
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Cache the fresh HTML response for offline use
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline: serve cached root shell so the SPA can boot
          return caches.match('/') || caches.match(request);
        })
    );
    return;
  }

  // 4. Static assets (JS, CSS, images, fonts) → Cache-first, network fallback.
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache immediately, update cache in background (stale-while-revalidate)
          const networkFetch = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
              }
              return networkResponse;
            })
            .catch(() => {/* network unavailable, cached version already served */});

          return cachedResponse;
        }

        // Not in cache — fetch from network and cache the result
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Everything else → network-only (no caching)
});
