// Service Worker tối thiểu - cache shell + ảnh.
// Đặt tại /sw.js (public/). Có thể thay bằng workbox/vite-plugin-pwa nếu cần feature mạnh hơn.

const CACHE_VERSION = 'kk-shell-v1';
const RUNTIME_IMAGES = 'kk-runtime-images-v1';

// Pre-cache shell tối thiểu - đường dẫn build sẽ thay đổi nên chỉ cache root.
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== RUNTIME_IMAGES)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bỏ qua API requests (luôn online).
  if (url.pathname.startsWith('/api/')) return;

  // Network-first cho HTML để luôn có nội dung mới.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((m) => m || caches.match('/')))
    );
    return;
  }

  // Cache-first cho ảnh.
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(RUNTIME_IMAGES).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  // Stale-while-revalidate cho assets js/css.
  if (['script', 'style', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
  }
});
