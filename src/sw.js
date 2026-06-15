/* Road Trip Questions — service worker
   Cache-first for everything: the whole app, including the question bank,
   is precached on install so it works with zero connectivity. */

const CACHE = 'rtq-v52';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './questions.json',
  './manifest.json',
  './assets/Naughtybynature_front.png',
  './assets/nbn-logo.png',
  './assets/TRIVIA.png',
  './assets/CAR%20TALK.png',
  './assets/Silly%20-%20Imagination.png',
  './assets/Would%20You%20Rather.png',
  './assets/Family%20-%20Us.png',
  './assets/Get%20to%20Know%20You.png',
  './assets/Big%20Questions.png',
  './assets/Correct.png',
  './assets/Wrong.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' bypasses the browser HTTP cache, so a new service
      // worker version always precaches fresh files from the server
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // never cache cross-origin requests (e.g. the Open Trivia DB API) —
  // cache-first would replay the same batch of questions forever
  if (!event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached =>
      cached ||
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
    )
  );
});
