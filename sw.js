// При любом изменении файлов приложения увеличивай VERSION — так телефоны получат обновление.
const VERSION = 'chase-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/main.js',
  './js/vendor/js-yaml.mjs',
  './js/core/labels.js',
  './js/core/md.js',
  './js/core/trick.js',
  './js/core/ops.js',
  './js/core/log.js',
  './js/core/rules.js',
  './js/core/generator.js',
  './js/core/stats.js',
  './js/core/model.js',
  './js/data/github.js',
  './js/data/store.js',
  './js/data/sync.js',
  './js/ui/app.js',
  './js/ui/helpers.js',
  './js/ui/views/layout.js',
  './js/ui/views/login.js',
  './js/ui/views/train.js',
  './js/ui/views/run.js',
  './js/ui/views/library.js',
  './js/ui/views/trick.js',
  './js/ui/views/edit.js',
  './js/ui/views/add.js',
  './js/ui/views/progress.js',
  './js/ui/views/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: сразу отдаём из кеша (быстро и офлайн), в фоне обновляем.
// Запросы к api.github.com сюда не попадают — данные живут в IndexedDB.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request)
      .then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached) {
      e.waitUntil(network);
      return cached;
    }
    return (await network) || (await cache.match('./index.html')) || Response.error();
  }));
});
