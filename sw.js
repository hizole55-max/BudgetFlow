
const CACHE = 'budgetflow-shell-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// Install the new service worker and prepare the offline shell.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate the new worker and remove outdated caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Do not intercept requests to other websites.
  if (url.origin !== self.location.origin) return;

  const isHTML =
    request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first: try to get the latest website.
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE)
              .then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            await caches.match(request) ||
            await caches.match('./index.html') ||
            Response.error()
          );
        })
    );

    return;
  }

  // Other same-origin assets: use cache when available.
  event.respondWith(
    caches.match(request)
      .then(hit => hit || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE)
            .then(cache => cache.put(request, copy));
        }
        return response;
      }))
  );
});
