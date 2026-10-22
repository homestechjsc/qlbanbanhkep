const CACHE_NAME = 'banhkep-pos-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './adquanly.js',
  './manifest.json'
];

// Cài đặt Service Worker và lưu cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Xóa cache cũ để nhận file index.html mới
self.addEventListener('activate', (event) => {
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

// Chiến lược Network-First: Ưu tiên mạng thật cho Firebase realtime, mất mạng mới đọc cache
self.addEventListener('fetch', (event) => {
  // Không cache các request gửi lên Firebase Realtime Database
  if (event.request.url.includes('firebasedatabase.app')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});