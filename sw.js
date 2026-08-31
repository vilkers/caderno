/* sw.js — cache do casco do app para uso offline.
   Os dados nunca passam por aqui: ficam cifrados no localStorage. */

const CACHE = 'caderno-v7';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/fonts.css',
  './assets/fonts/archivo-latin.woff2', './assets/fonts/archivo-latin-ext.woff2',
  './assets/fonts/jetbrainsmono-latin.woff2', './assets/fonts/jetbrainsmono-latin-ext.woff2',
  './js/main.js', './js/store.js', './js/vault.js', './js/utils.js',
  './js/ui.js', './js/palettes.js', './js/analysis.js',
  './js/merge.js', './js/sync.js', './js/badges.js', './js/icons.js', './js/avatar.js', './js/arrastar.js', './js/resumo.js',
  './js/views/today.js', './js/views/month.js', './js/views/todos.js',
  './js/views/insights.js', './js/views/settings.js', './js/views/metas.js', './js/views/perfil.js', './js/views/resumo.js',
  './assets/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then(hit => {
      const net = fetch(request).then(res => {
        if (res.ok && new URL(request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
