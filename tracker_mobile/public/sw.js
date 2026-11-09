self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('calory-tracker-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/favicon.ico',
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== 'calory-tracker-v1') {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
