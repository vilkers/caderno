/* store.js — estado, valores padrão, persistência cifrada e eventos */

import * as vault from './vault.js';
import { uid, debounce, todayKey } from './utils.js';

export const TYPES = {
  toggle: { label: 'Sim / não',    hint: 'Um toque: fiz ou não fiz.' },
  count:  { label: 'Contagem',     hint: 'Quantas vezes / quantas unidades.' },
  hours:  { label: 'Horas',        hint: 'Duração, com meia hora de precisão.' },
  scale:  { label: 'Escala 1–5',   hint: 'Intensidade, humor, qualidade.' },
  text:   { label: 'Texto livre',  hint: 'Uma anotação curta.' },
};

export const DEFAULT_CATEGORIES = () => ([
  { id: uid(), emoji: '🏋️', label: 'Academia',  type: 'toggle', goal: { mode: 'min', value: 4, period: 'week' } },
  { id: uid(), emoji: '💼', label: 'Trabalho',  type: 'hours',  unit: 'h', max: 16, goal: { mode: 'min', value: 6, period: 'day' } },
  { id: uid(), emoji: '🍺', label: 'Bebida',    type: 'count',  unit: 'doses', goal: { mode: 'max', value: 6, period: 'week' } },
  { id: uid(), emoji: '🌿', label: 'Maconha',   type: 'toggle', goal: { mode: 'max', value: 3, period: 'week' } },
  { id: uid(), emoji: '🐾', label: 'Passeio com o Estojo', type: 'count', unit: 'passeios', goal: { mode: 'min', value: 7, period: 'week' } },
  { id: uid(), emoji: '🍽️', label: 'Louça',     type: 'toggle', goal: { mode: 'min', value: 5, period: 'week' } },
  { id: uid(), emoji: '🗑️', label: 'Lixo',      type: 'toggle', goal: { mode: 'min', value: 3, period: 'week' } },
  { id: uid(), emoji: '😴', label: 'Sono',      type: 'hours',  unit: 'h', max: 14, goal: { mode: 'min', value: 7, period: 'day' } },
  { id: uid(), emoji: '🙂', label: 'Humor',     type: 'scale' },
]);

export const blankState = () => ({
  version: 1,
  settings: { palette: 'noir', motion: true, autolock: 15, showStreaks: true },
  categories: DEFAULT_CATEGORIES(),
  days: {},
  todos: [],
});

/* ── Estado vivo ───────────────────────────────────────────── */
export const state = blankState();
let session = null;
const subs = new Set();

export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };

const persist = debounce(async () => {
  if (!session) return;
  try { await vault.write(session, state); }
  catch (e) { console.error('falha ao salvar', e); }
}, 400);

export function emit(reason = 'change') {
  subs.forEach(fn => fn(reason));
  persist();
}
export const flush = () => persist.flush();

/** Reidrata mantendo a referência de `state` */
function hydrate(data) {
  const fresh = blankState();
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, fresh, data || {});
  state.settings = { ...fresh.settings, ...(data?.settings || {}) };
  state.categories = (data?.categories?.length ? data.categories : fresh.categories)
    .map(c => ({ ...c, id: c.id || uid() }));
  state.days = data?.days || {};
  state.todos = (data?.todos || []).map(t => ({ ...t, id: t.id || uid() }));
  state.version = 1;
}

export async function createVault(password, hint) {
  hydrate(blankState());
  session = await vault.create(password, state);
  if (hint) vault.writeMeta({ hint });
  return state;
}

export async function unlockVault(password) {
  const { session: s, data } = await vault.unlock(password);
  session = s;
  hydrate(data);
  return state;
}

export function lockVault() { session = null; }
export const isUnlocked = () => !!session;

export async function setPassword(newPassword, hint) {
  session = await vault.create(newPassword, state);
  vault.writeMeta({ hint: hint || '' });
}

export function replaceAll(data) {
  hydrate(data);
  emit('replace');
}

/* ── Dias ──────────────────────────────────────────────────── */
export const getDay = k => state.days[k] || null;

function ensureDay(k) {
  if (!state.days[k]) state.days[k] = { v: {}, note: '', updatedAt: Date.now() };
  return state.days[k];
}

export function getVal(k, id) {
  const d = state.days[k];
  return d ? d.v[id] : undefined;
}

export function setVal(k, id, value) {
  const d = ensureDay(k);
  if (value === undefined || value === null || value === '' || value === false || value === 0) delete d.v[id];
  else d.v[id] = value;
  d.updatedAt = Date.now();
  if (!Object.keys(d.v).length && !d.note && !d.closed) delete state.days[k];
  emit('day');
}

export function setNote(k, text) {
  const d = ensureDay(k);
  d.note = text;
  d.updatedAt = Date.now();
  if (!Object.keys(d.v).length && !text && !d.closed) delete state.days[k];
  emit('day');
}

export function closeDay(k, closed = true) {
  const d = ensureDay(k);
  d.closed = closed;
  d.updatedAt = Date.now();
  if (!closed && !Object.keys(d.v).length && !d.note) delete state.days[k];
  emit('day');
}

export const hasEntry = k => {
  const d = state.days[k];
  return !!d && (d.closed || Object.keys(d.v).length > 0 || !!d.note);
};

/* ── Categorias ────────────────────────────────────────────── */
export const activeCategories = () => state.categories.filter(c => !c.archived);
export const catById = id => state.categories.find(c => c.id === id);

export function addCategory(cat) {
  const c = { id: uid(), emoji: '•', label: 'Nova categoria', type: 'toggle', ...cat };
  state.categories.push(c);
  emit('categories');
  return c;
}
export function updateCategory(id, patch) {
  const c = catById(id);
  if (!c) return;
  Object.assign(c, patch);
  emit('categories');
}
export function removeCategory(id, purge = true) {
  state.categories = state.categories.filter(c => c.id !== id);
  if (purge) {
    for (const k of Object.keys(state.days)) {
      const d = state.days[k];
      if (d.v && id in d.v) { delete d.v[id]; if (!Object.keys(d.v).length && !d.note && !d.closed) delete state.days[k]; }
    }
  }
  emit('categories');
}
export function moveCategory(id, toIndex) {
  const from = state.categories.findIndex(c => c.id === id);
  if (from < 0) return;
  const [c] = state.categories.splice(from, 1);
  state.categories.splice(Math.max(0, Math.min(state.categories.length, toIndex)), 0, c);
  emit('categories');
}

/* ── Afazeres ──────────────────────────────────────────────── */
export function addTodo(text, extra = {}) {
  const t = { id: uid(), text: text.trim(), done: false, star: false, createdAt: Date.now(), due: null, ...extra };
  if (!t.text) return null;
  state.todos.unshift(t);
  emit('todos');
  return t;
}
export function updateTodo(id, patch) {
  const t = state.todos.find(x => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  if ('done' in patch) t.doneAt = patch.done ? Date.now() : null;
  emit('todos');
}
export function removeTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  emit('todos');
}
export function clearDoneTodos() {
  state.todos = state.todos.filter(t => !t.done);
  emit('todos');
}
export const openTodos = () => state.todos.filter(t => !t.done);

/* ── Import / export ───────────────────────────────────────── */
export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'caderno' }, null, 2);
}
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('days' in data)) throw new Error('formato');
  replaceAll(data);
}

export { todayKey };
