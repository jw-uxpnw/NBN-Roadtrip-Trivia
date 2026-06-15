/* Road Trip Questions — service worker
   Cache-first for everything: the whole app, including the question bank,
   is precached on install so it works with zero connectivity. */

const CACHE = 'rtq-v60';

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
  // Primary category images (trivia gameplay + step 2 setup)
  './assets/Pacific%20Northwest.png',
  './assets/Animals%20%26%20Nature.png',
  './assets/Movies%20%26%20TV.png',
  './assets/Music.png',
  './assets/Food.png',
  './assets/Sports.png',
  './assets/Science%20%26%20Space.png',
  './assets/History.png',
  './assets/Geography.png',
  './assets/Kid%20Classics.png',
  // Extra category images
  './assets/General%20Knowledge.png',
  './assets/Film%20%26%20TV.png',
  './assets/Arts%20%26%20Literature.png',
  './assets/Society%20%26%20Culture.png',
  './assets/Mythology.png',
  './assets/Books.png',
  './assets/Video%20Games.png',
  './assets/Computers.png',
  './assets/Cartoons.png',
  './assets/Math.png',
  // Round length images (step 1)
  './assets/Just%20a%20Hitch.png',
  './assets/A%20Skosh.png',
  './assets/A%20Bushel.png',
  './assets/Infinity.png',
  // Difficulty images (step 3)
  './assets/Diff%20Any.png',
  './assets/Diff%20Easy.png',
  './assets/Diff%20Medium.png',
  './assets/Diff%20Hard.png',
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
