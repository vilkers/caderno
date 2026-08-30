/* sw.js — casco do Caderno 2.0 em cache. Os dados não passam por aqui:
   ficam cifrados no localStorage, compartilhados com a versão clássica. */

const CACHE = 'caderno-retro-v1';
const CASCO = [
  './', './index.html', './manifest.webmanifest',
  './css/retro.css',
  './js/main.js', './js/ui.js', './js/sfx.js', './js/sprites.js',
  './js/views/fase.js', './js/views/mapa.js', './js/views/missoes.js',
  './js/views/placar.js', './js/views/opcoes.js',
  './assets/icone.svg',
  './assets/fonts/pressstart2p-latin.woff2', './assets/fonts/pressstart2p-latin-ext.woff2',
  './assets/fonts/silkscreen-latin.woff2', './assets/fonts/silkscreen-latin-700.woff2',
  '../js/store.js', '../js/vault.js', '../js/utils.js', '../js/analysis.js',
  '../js/badges.js', '../js/merge.js', '../js/sync.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCO)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(caches.match(request).then(hit => {
    const rede = fetch(request).then(res => {
      if (res.ok && new URL(request.url).origin === location.origin) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(request, copia));
      }
      return res;
    }).catch(() => hit);
    return hit || rede;
  }));
});
