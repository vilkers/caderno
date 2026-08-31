/* sw.js — cache do casco do app para uso offline.
   Os dados nunca passam por aqui: ficam cifrados no localStorage. */

const CACHE = 'caderno-v11';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/fonts.css',
  './assets/fonts/archivo-latin.woff2', './assets/fonts/archivo-latin-ext.woff2',
  './assets/fonts/jetbrainsmono-latin.woff2', './assets/fonts/jetbrainsmono-latin-ext.woff2',
  './js/main.js', './js/store.js', './js/vault.js', './js/utils.js',
  './js/ui.js', './js/palettes.js', './js/analysis.js',
  './js/merge.js', './js/sync.js', './js/badges.js', './js/icons.js', './js/avatar.js', './js/idb.js', './js/lembrete.js', './js/arrastar.js', './js/resumo.js', './js/graficos.js',
  './js/views/today.js', './js/views/month.js', './js/views/todos.js',
  './js/views/insights.js', './js/views/settings.js', './js/views/metas.js', './js/views/perfil.js', './js/views/resumo.js', './js/views/revisao.js', './js/views/agenda.js', './js/views/agendaform.js',
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

/* ── Lembrete ──────────────────────────────────────────────────
   O worker não abre o cofre (a chave só existe na memória da página com o
   app destrancado), então ele lê a gaveta do js/idb.js: quantas marcações
   faltam hoje e a que horas avisar. Nada além disso. */

const BANCO = 'caderno', LOJA = 'resumo', CHAVE = 'hoje';

function comBanco(modo, fn) {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onerror = () => falha(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(LOJA, modo);
      const r = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => { db.close(); ok(r && r.result); };
      tx.onerror = () => { db.close(); falha(tx.error); };
    };
  });
}

async function conferirLembrete() {
  let r;
  try { r = await comBanco('readonly', loja => loja.get(CHAVE)); } catch { return; }
  if (!r || !r.ligado || !r.faltam || r.fechado) return;

  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  if (r.data !== hoje) return;                 // resumo de ontem: ignora
  if (agora.getHours() < (r.hora ?? 21)) return;
  if (r.avisadoEm === hoje) return;            // um aviso por dia basta

  await self.registration.showNotification('Fecha o dia?', {
    body: r.nomes?.length ? `Falta: ${r.nomes.join(', ')}.` : `${r.faltam} marcação(ões) esperando por você.`,
    tag: 'caderno-dia',
    icon: './assets/icon.svg',
    badge: './assets/icon.svg',
    data: { url: './?v=rapido' },
  });
  try { await comBanco('readwrite', loja => loja.put({ ...r, avisadoEm: hoje }, CHAVE)); } catch {}
}

self.addEventListener('periodicsync', e => {
  if (e.tag === 'lembrete') e.waitUntil(conferirLembrete());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const destino = e.notification.data?.url || './';
  e.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const aba of abas) {
      if (aba.url.includes('/caderno') || aba.url.includes(self.registration.scope)) return aba.focus();
    }
    return self.clients.openWindow(destino);
  })());
});

/* Duas estratégias, porque as duas coisas envelhecem diferente:

   • o código do app (html, js, css) vai pela REDE primeiro, com o cache como
     rede de segurança depois de 2,5s ou se a conexão falhar. Antes era o
     contrário, e a versão nova só aparecia na segunda vez que você abria o
     app — dava toda a impressão de que a correção não tinha chegado.
   • fonte, ícone e afins vão pelo CACHE primeiro: são grandes, não mudam e
     não vale pagar rede por eles. */
const ehCodigo = url =>
  url.origin === location.origin && /\.(html|js|css|webmanifest)$|\/$/.test(url.pathname);

const comLimite = (promessa, ms) =>
  Promise.race([promessa, new Promise((_, x) => setTimeout(() => x(new Error('lento')), ms))]);

function guardar(request, res) {
  if (res && res.ok && new URL(request.url).origin === location.origin) {
    const copia = res.clone();
    caches.open(CACHE).then(c => c.put(request, copia));
  }
  return res;
}

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (ehCodigo(url)) {
    e.respondWith(
      comLimite(fetch(request).then(res => guardar(request, res)), 2500)
        .catch(() => caches.match(request).then(hit => hit || fetch(request))),
    );
    return;
  }

  e.respondWith(
    caches.match(request).then(hit => {
      const rede = fetch(request).then(res => guardar(request, res)).catch(() => hit);
      return hit || rede;
    }),
  );
});
