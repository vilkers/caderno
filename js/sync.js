/* sync.js — o caderno num arquivo do seu repositório.

   O app grava `dados/caderno.enc.json` pela API de conteúdo do GitHub, com
   um token que fica cifrado dentro do cofre. O arquivo é o MESMO blob AES-GCM
   do localStorage: o repositório pode ser público que ninguém lê nada.

   Fluxo de cada sincronia: puxa o arquivo → junta com o que há aqui
   (js/merge.js decide item a item pelo `updatedAt`) → grava de volta. */

import * as store from './store.js';
import * as vault from './vault.js';
import { debounce } from './utils.js';

const API = 'https://api.github.com';

/* ── Estado observável ─────────────────────────────────────── */
let status = { state: 'off', msg: 'desligado', at: 0 };
const listeners = new Set();
export const onStatus = fn => { listeners.add(fn); fn(status); return () => listeners.delete(fn); };
export const getStatus = () => status;
function setStatus(state, msg) {
  status = { state, msg, at: Date.now() };
  listeners.forEach(fn => fn(status));
}

export const cfg = () => store.state.settings?.sync || {};
export const configured = () => {
  const c = cfg();
  return !!(c.enabled && c.owner && c.repo && c.token && c.path);
};

/* ── base64 de texto UTF-8 (sem estourar a pilha) ──────────── */
function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ── Chamada crua ──────────────────────────────────────────── */
async function api(path, opts = {}) {
  const c = cfg();
  return fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

const contentsUrl = () => {
  const c = cfg();
  return `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;
};

/** Testa credenciais e permissão de escrita. Usado na tela de ajustes. */
export async function check(candidate) {
  const c = { ...cfg(), ...candidate };
  if (!c.owner || !c.repo || !c.token) return { ok: false, msg: 'Faltam usuário, repositório ou token.' };
  const res = await fetch(`${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`, {
    headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 401) return { ok: false, msg: 'Token inválido ou expirado.' };
  if (res.status === 404) return { ok: false, msg: 'Repositório não encontrado (ou o token não alcança ele).' };
  if (!res.ok) return { ok: false, msg: `GitHub respondeu ${res.status}.` };
  const repo = await res.json();
  if (!repo.permissions?.push) return { ok: false, msg: 'O token não tem permissão de escrita (Contents: read and write).' };
  return { ok: true, msg: `Conectado a ${repo.full_name}${repo.private ? ' (privado)' : ' (público)'}.`, repo };
}

/* ── Puxar ─────────────────────────────────────────────────── */
/** @returns {{doc:object|null, sha:string|null, missing:boolean}} */
export async function pull() {
  const c = cfg();
  const res = await api(`${contentsUrl()}?ref=${encodeURIComponent(c.branch || 'main')}`);
  if (res.status === 404) return { doc: null, sha: null, missing: true };
  if (res.status === 401) throw new Error('Token inválido ou expirado.');
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status} ao ler o arquivo.`);

  const meta = await res.json();
  let parsed;
  try { parsed = JSON.parse(fromB64(meta.content)); }
  catch { throw new Error('O arquivo do repositório não é um caderno válido.'); }

  if (parsed.empty) return { doc: null, sha: meta.sha, missing: false };
  if (!parsed.ct) throw new Error('O arquivo do repositório não está no formato do caderno.');

  let doc;
  try { doc = await vault.open(parsed); }
  catch (e) {
    throw new Error(e.message === 'trancado'
      ? 'Destranque o caderno antes de sincronizar.'
      : 'O arquivo do repositório foi cifrado com outra senha.');
  }
  return { doc, sha: meta.sha, missing: false };
}

/* ── Empurrar ──────────────────────────────────────────────── */
async function put(sha) {
  const c = cfg();
  const session = store.getSession();
  if (!session) throw new Error('Destranque o caderno antes de sincronizar.');
  const blob = await vault.seal(session, store.syncDoc());
  const dias = Object.keys(store.state.days).length;
  const body = {
    message: `caderno: ${dias} dia(s), ${store.listTodos().length} tarefa(s) — ${new Date().toLocaleString('pt-BR')}`,
    content: toB64(JSON.stringify(blob, null, 1)),
    branch: c.branch || 'main',
    ...(sha ? { sha } : {}),
  };
  const res = await api(contentsUrl(), { method: 'PUT', body: JSON.stringify(body) });
  if (res.status === 409 || res.status === 422) return { conflict: true };
  if (res.status === 401) throw new Error('Token inválido ou expirado.');
  if (res.status === 403) {
    // pode ser permissão, mas também é o que o GitHub responde quando se
    // grava rápido demais — a mensagem dele diz qual dos dois é
    const dele = await mensagemDoGitHub(res);
    throw new Error(/secondary rate|abuse/i.test(dele || '')
      ? 'O GitHub pediu pra desacelerar (muitas gravações seguidas). Tento de novo em instantes.'
      : (dele || 'Sem permissão de escrita nesse repositório.'));
  }
  if (!res.ok) throw new Error(await mensagemDoGitHub(res) || `GitHub respondeu ${res.status} ao gravar.`);
  const out = await res.json();
  return { sha: out.content?.sha };
}

async function mensagemDoGitHub(res) {
  try { const j = await res.clone().json(); return j?.message || ''; } catch { return ''; }
}

const espera = ms => new Promise(ok => setTimeout(ok, ms));

/**
 * Os dois cadernos têm o mesmo conteúdo?
 * `rev`, `updatedAt` e `deviceId` ficam de fora: eles mudam a cada junção,
 * então compará-los faria toda sincronia parecer uma mudança — e era isso
 * que mantinha o app gravando sem parar.
 */
function mesmoConteudo(a, b) {
  if (!a || !b) return false;
  const limpo = d => JSON.stringify({
    days: d.days, categories: d.categories, todos: d.todos, agenda: d.agenda,
    reviews: d.reviews, badges: d.badges, profile: d.profile, levelSeen: d.levelSeen,
    settings: { ...d.settings, sync: undefined, updatedAt: undefined },
  });
  return limpo(a) === limpo(b);
}

/* ── Sincronia completa ────────────────────────────────────── */
let running = null;

/**
 * Puxa, junta e grava. Devolve { merged, pushed }.
 * `silent` só muda o texto de status (usado na sincronia automática).
 */
export async function syncNow({ silent = false } = {}) {
  if (!configured()) { setStatus('off', 'desligado'); return { skipped: true }; }
  if (running) return running;

  running = (async () => {
    setStatus('syncing', silent ? 'sincronizando' : 'sincronizando…');
    try {
      const remote = await pull();
      const merged = remote.doc ? store.applyRemote(remote.doc) : false;

      /* Nada a gravar: o repositório já está igual a isto aqui. Sair agora
         evita um commit vazio e, principalmente, evita o vaivém em que cada
         junção agendava a próxima sincronia sem nenhuma mudança real. */
      if (remote.doc && mesmoConteudo(store.syncDoc(), remote.doc)) {
        store.setSync({ lastSync: Date.now(), lastSha: remote.sha || '', lastError: '' });
        setStatus('ok', 'sincronizado');
        return { merged, pushed: false };
      }

      /* A API de conteúdo do GitHub é consistente "com atraso": logo depois de
         uma gravação, a leitura pode devolver o sha antigo, e aí a gravação
         seguinte bate de frente. Então: puxa de novo, junta e tenta outra vez,
         esperando um pouco mais a cada rodada. */
      let sha = remote.sha;
      let result = await put(sha);
      for (let tentativa = 1; result.conflict && tentativa <= 3; tentativa++) {
        setStatus('syncing', `o repositório mudou — tentando de novo (${tentativa}/3)`);
        await espera(700 * tentativa);
        const denovo = await pull();
        if (denovo.doc) store.applyRemote(denovo.doc);
        sha = denovo.sha;
        result = await put(sha);
      }
      if (result.conflict) {
        throw new Error('O repositório mudou enquanto eu gravava. Seus dados estão salvos aqui — toque em sincronizar de novo.');
      }

      store.setSync({ lastSync: Date.now(), lastSha: result.sha || '', lastError: '' });
      setStatus('ok', 'sincronizado');
      return { merged, pushed: true };
    } catch (e) {
      store.setSync({ lastError: e.message });
      setStatus('error', e.message);
      throw e;
    } finally {
      running = null;
    }
  })();

  return running;
}

/** Só puxa e junta — usado ao destrancar, antes de mexer em qualquer coisa. */
export async function pullAndMerge() {
  if (!configured()) return { skipped: true };
  setStatus('syncing', 'buscando');
  try {
    const remote = await pull();
    const merged = remote.doc ? store.applyRemote(remote.doc) : false;
    setStatus('ok', merged ? 'atualizado do repositório' : 'sincronizado');
    return { merged, missing: remote.missing };
  } catch (e) {
    setStatus('error', e.message);
    throw e;
  }
}

/* ── Automático ────────────────────────────────────────────── */
/* 15s em vez de 6: cada sincronia é um commit no seu repositório, e marcar
   cinco coisas seguidas não precisa virar cinco commits. Os dados já estão
   cifrados no aparelho o tempo todo; o repositório pode ficar 15s atrás. */
const auto = debounce(() => {
  if (!configured() || !navigator.onLine) return;
  syncNow({ silent: true }).catch(() => {});
}, 15000);

export function start() {
  store.subscribe(reason => {
    if (reason === 'sync' || reason === 'save-error') return;
    if (!configured()) { setStatus('off', 'desligado'); return; }
    setStatus('pending', 'alterações locais');
    auto();
  });
  window.addEventListener('online', () => { if (configured()) auto(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && configured()) auto.flush();
  });
}
