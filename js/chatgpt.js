import * as store from './store.js';
import { debounce, todayKey } from './utils.js';

export const PATH = 'caderno-automacao/check-in.json';
const API = 'https://api.github.com';
const LIMIT = 50;
const empty = () => ({ version: 1, categories: [], days: {}, requests: [], results: [] });
export const config = () => store.state.settings.chatGPT;
let running;

function validDate(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === key;
}

async function github(c, path = '', options = {}) {
  const { method = 'GET', body } = options;
  return fetch(`${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body && JSON.stringify(body),
  });
}

async function privateRepo(c) {
  if (!c?.owner || !c.repo || !c.token || !validDate(c.from) || c.from > todayKey()) {
    throw new Error('Preencha o repositório privado, o token e a data inicial.');
  }
  const res = await github(c);
  if (!res.ok) throw new Error('Confira o repositório e o acesso do token.');
  const repo = await res.json();
  if (repo.visibility !== 'private' || repo.private !== true || repo.archived) {
    throw new Error('Use um repositório privado e ativo.');
  }
  if (!repo.default_branch) throw new Error('Inicialize o repositório privado com um README.');
  return repo.default_branch;
}

export async function check(c) {
  await privateRepo(c);
}

function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function read(c, branch) {
  const res = await github(c, `/contents/${PATH}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return { doc: empty() };
  if (!res.ok) throw new Error('Não consegui abrir o arquivo de check-in no GitHub.');
  const file = await res.json();
  try {
    if (file.encoding !== 'base64' || !file.sha) throw new Error('arquivo');
    const bytes = Uint8Array.from(atob(file.content), ch => ch.charCodeAt(0));
    const doc = JSON.parse(new TextDecoder().decode(bytes));
    if (doc.version !== 1 || !Array.isArray(doc.requests) || doc.requests.length > LIMIT || !Array.isArray(doc.results)) {
      throw new Error('formato');
    }
    return { doc, sha: file.sha };
  } catch {
    throw new Error('O arquivo de check-in está fora do formato esperado.');
  }
}

function categories() {
  return store.activeCategories().filter(({ id }) => typeof id === 'string' && !Object.hasOwn(Object.prototype, id));
}

function snapshot(from, active) {
  const ids = new Set(active.map(cat => cat.id));
  const days = {};
  for (const [date, day] of Object.entries(store.state.days).sort()) {
    if (!validDate(date) || date < from || date > todayKey()) continue;
    const values = Object.fromEntries(Object.entries(day.v).filter(([id]) => ids.has(id)));
    if (day.closed || Object.keys(values).length) days[date] = { values, closed: Boolean(day.closed) };
  }
  const metadata = active.map(cat => ({
    id: cat.id, label: cat.label, type: cat.type, unit: cat.unit, levels: cat.levels,
    min: store.scaleMin(cat), max: store.scaleMax(cat),
  }));
  return { from, categories: metadata, days };
}

function validValue(cat, value) {
  if (cat.type === 'toggle') return value === true;
  if (cat.type === 'text') return typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
  if (!Number.isFinite(value) || value > store.scaleMax(cat)) return false;
  if (cat.type === 'scale') return Number.isInteger(value) && value >= store.scaleMin(cat);
  if (cat.type === 'count') return Number.isInteger(value) && value > 0;
  return cat.type === 'hours' && value > 0 && Number.isInteger(value * 2);
}

// Validate the whole request before writing any field. Previous values are
// required so check-ins typed in the app can win over an out-of-date request.
function planCheckIn(request, from, active) {
  if (!validDate(request?.date) || request.date < from || request.date > todayKey()) return null;
  if (!Array.isArray(request.changes) || !request.changes.length || request.changes.length > active.length) return null;
  const byId = new Map(active.map(cat => [cat.id, cat]));
  const seen = new Set();
  const pending = [];
  for (const change of request.changes) {
    const category = byId.get(change?.category);
    if (!category || seen.has(category.id) || !Object.hasOwn(change, 'previous') || !validValue(category, change.value)) return null;
    seen.add(category.id);
    const current = store.getVal(request.date, category.id) ?? null;
    if (current === change.value) continue;
    if (current !== change.previous) return null;
    pending.push({ category, value: change.value });
  }
  return pending;
}

async function run(c, session) {
  const connected = () => store.getSession() === session && config() === c;
  const applied = new Set();
  for (let attempt = 0; attempt < 3; attempt++) {
    const branch = await privateRepo(c);
    if (!connected()) return;
    const { doc, sha } = await read(c, branch);
    if (!connected()) return;
    const active = categories();
    const results = new Map(doc.results.filter(item => typeof item?.id === 'string').map(item => [item.id, item]));
    let needsSave = false;
    for (const request of doc.requests) {
      if (typeof request?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(request.id) || results.has(request.id)) continue;
      const plan = planCheckIn(request, c.from, active);
      for (const entry of plan || []) {
        store.setVal(request.date, entry.category.id, entry.value, { keepZero: entry.category.type === 'scale' });
      }
      results.set(request.id, { id: request.id, status: plan ? 'applied' : 'conflict' });
      if (plan) needsSave = true;
      if (plan?.length) applied.add(request.id);
    }
    if (needsSave) {
      // Persist before acknowledging. A retry sees the same values and can
      // acknowledge them without changing them again.
      if (!(await store.flush())) throw new Error('Não consegui salvar o check-in no cofre.');
      if (!connected()) return;
    }
    const next = { version: 1, ...snapshot(c.from, active), requests: [], results: [...results.values()].slice(-LIMIT) };
    if (sha && JSON.stringify(next) === JSON.stringify(doc)) return { applied: applied.size };
    const res = await github(c, `/contents/${PATH}`, {
      method: 'PUT',
      body: { message: 'Atualizar check-in do Caderno', content: encode(JSON.stringify(next, null, 2)), branch, sha },
    });
    if (res.ok) return { applied: applied.size };
    if (res.status !== 409 && res.status !== 422) break;
  }
  throw new Error('Não consegui atualizar o check-in. Confira a permissão Contents: Read and write.');
}

export async function sync() {
  const c = config();
  const session = store.getSession();
  if (!c || !session || !navigator.onLine) return;
  if (!running) running = run(c, session).finally(() => { running = null; });
  return running;
}

export function start(onApplied) {
  const refresh = () => {
    if (document.hidden) return;
    sync().then(result => { if (result?.applied) onApplied(); }).catch(() => {});
  };
  const afterChange = debounce(refresh, 15000);
  store.subscribe(reason => {
    if (['day', 'categories', 'replace'].includes(reason) && !running) afterChange();
  });
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 60000);
  return refresh;
}
