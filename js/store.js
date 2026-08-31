/* store.js — estado, valores padrão, persistência cifrada e eventos.

   Modelo v2: todo item (dia, categoria, tarefa) carrega `updatedAt`, e
   apagar vira `deletedAt` (lápide). É o que permite juntar o caderno deste
   aparelho com o do repositório sem perder nem ressuscitar nada. */

import * as vault from './vault.js';
import { uid, debounce, todayKey, monthKey, daysInMonth, keyOf, parseKey, WD } from './utils.js';
import { mergeDocs } from './merge.js';

export const VERSION = 3;

/* Com que frequência a categoria é cobrada. É o que separa "faltou" de
   "não era pra hoje" — sem isso o progresso do dia mente. */
export const CADENCIAS = {
  diaria:  { label: 'Todo dia',   hint: 'Entra na conta do dia. Falta se não for marcada (remédio, sono).' },
  semanal: { label: 'Na semana',  hint: 'Cobrada pela meta da semana, não por dia (academia, louça).' },
  livre:   { label: 'Quando rolar', hint: 'Registra quando acontece e não cobra nada (bebida, humor).' },
};

/**
 * Em que dias da semana a categoria cobra. `cat.dias` é uma lista de 0 (dom)
 * a 6 (sáb); **vazia ou ausente significa todos os sete**, que é como o app
 * sempre funcionou — por isso não há migração nenhuma a fazer.
 *
 * Só faz sentido em cadência diária: "na semana" já é cobrada pela meta e
 * "quando rolar" não cobra nada.
 */
export function cobraNoDia(cat, key) {
  if (cadencia(cat) !== 'diaria') return false;
  if (!Array.isArray(cat?.dias) || !cat.dias.length) return true;
  return cat.dias.includes(parseKey(key).getDay());
}

/** Rótulo curto dos dias — 'TER' pra um só, 'SEG·QUA·SEX' pra alguns. */
export function rotuloDias(cat) {
  if (!Array.isArray(cat?.dias) || !cat.dias.length || cat.dias.length === 7) return null;
  return [...cat.dias].sort((a, b) => a - b).map(d => WD[d]).join('·');
}

/** Cadência de uma categoria, deduzida da meta quando não foi escolhida. */
export function cadencia(cat) {
  if (cat?.cadence && CADENCIAS[cat.cadence]) return cat.cadence;
  if (cat?.goal?.period === 'day') return 'diaria';
  if (cat?.goal?.mode === 'min' && cat?.goal?.period === 'week') return 'semanal';
  return 'livre';
}

export const TYPES = {
  toggle: { label: 'Sim / não',    hint: 'Um toque: fiz ou não fiz.' },
  count:  { label: 'Contagem',     hint: 'Quantas vezes / quantas unidades.' },
  hours:  { label: 'Horas',        hint: 'Duração, com meia hora de precisão.' },
  scale:  { label: 'Escala',       hint: 'Uma nota com referência escrita em cada nível.' },
  text:   { label: 'Texto livre',  hint: 'Uma anotação curta.' },
};

const now = () => Date.now();

export const DEFAULT_CATEGORIES = () => ([
  { emoji: '🏋️', label: 'Academia', type: 'toggle', cadence: 'semanal', goal: { mode: 'min', value: 4, period: 'week' } },
  { emoji: '💼', label: 'Trabalho', type: 'hours', unit: 'h', max: 16, cadence: 'diaria', goal: { mode: 'min', value: 6, period: 'day' } },
  { emoji: '🍺', label: 'Bebida', type: 'scale', min: 0, max: 10,
    levels: {
      0: 'seco', 1: 'uma no almoço', 2: 'duas, social', 3: 'happy hour comportado',
      4: 'já tô alegre', 5: 'bebedeira média', 6: 'passei do ponto', 7: 'mó porre',
      8: 'apagando', 9: 'filme queimado', 10: 'ressaca de dois dias',
    },
    cadence: 'livre', goal: { mode: 'max', value: 12, period: 'week' } },
  { emoji: '🌿', label: 'Maconha', type: 'count', unit: 'vezes', cadence: 'livre',
    levels: { 1: 'um de leve', 2: 'dose dupla', 3: 'chapei', 4: 'dia perdido' },
    goal: { mode: 'max', value: 4, period: 'week' } },
  { emoji: '🐾', label: 'Passeio com o Estojo', type: 'count', unit: 'passeios', cadence: 'diaria', goal: { mode: 'min', value: 7, period: 'week' } },
  { emoji: '🍽️', label: 'Louça', type: 'toggle', cadence: 'semanal', goal: { mode: 'min', value: 5, period: 'week' } },
  { emoji: '🗑️', label: 'Lixo', type: 'toggle', cadence: 'semanal', goal: { mode: 'min', value: 3, period: 'week' } },
  { emoji: '😴', label: 'Sono', type: 'hours', unit: 'h', max: 14, cadence: 'diaria', goal: { mode: 'min', value: 7, period: 'day' } },
  { emoji: '🙂', label: 'Humor', type: 'scale', min: 1, max: 5, cadence: 'livre',
    levels: { 1: 'no fundo do poço', 2: 'mal', 3: 'normal', 4: 'bem', 5: 'dia ótimo' } },
].map((c, i) => ({ id: uid(), order: i, updatedAt: now(), ...c })));

/* ── Agenda do mês ─────────────────────────────────────────────
   Contas, cartões, aluguel, nota fiscal, assinaturas e o que entra:
   tudo é o mesmo objeto — um compromisso com um dia do mês. O que muda é
   `tipo` (onde ele aparece) e `fluxo` (se o dinheiro sai ou entra).
   Item sem `valor` é só um compromisso: não entra em conta nenhuma. */

export const AGENDA_TIPOS = {
  conta:      { label: 'Conta de casa', emoji: '🧾', fluxo: 'saida' },
  cartao:     { label: 'Cartão',        emoji: '💳', fluxo: 'saida' },
  aluguel:    { label: 'Aluguel',       emoji: '🏠', fluxo: 'saida' },
  nf:         { label: 'Trabalho',      emoji: '📄', fluxo: 'saida' },
  assinatura: { label: 'Assinatura',    emoji: '🎧', fluxo: 'saida' },
  evento:     { label: 'Evento',        emoji: '📌', fluxo: 'saida' },
  renda:      { label: 'Entrada',       emoji: '💰', fluxo: 'entrada' },
};

/* Sugestões de partida. Os dias são exemplo — cada banco e cada contrato tem
   o seu, então a tela diz isso e deixa editar na hora. */
export const AGENDA_PRESETS = [
  { grupo: 'CARTÕES', itens: [
    { emoji: '💜', label: 'Cartão Nubank', tipo: 'cartao', dia: 10 },
    { emoji: '🧡', label: 'Cartão Itaú', tipo: 'cartao', dia: 7 },
    { emoji: '🖤', label: 'Cartão BTG', tipo: 'cartao', dia: 15 },
  ] },
  { grupo: 'CASA', itens: [
    { emoji: '🏠', label: 'Aluguel', tipo: 'aluguel', dia: 5 },
    { emoji: '🏢', label: 'Condomínio', tipo: 'conta', dia: 5 },
    { emoji: '⚡', label: 'Luz', tipo: 'conta', dia: 12 },
    { emoji: '💧', label: 'Água', tipo: 'conta', dia: 12 },
    { emoji: '🌐', label: 'Internet', tipo: 'conta', dia: 20 },
    { emoji: '🔥', label: 'Gás', tipo: 'conta', dia: 18 },
  ] },
  { grupo: 'TRABALHO', itens: [
    { emoji: '📄', label: 'Emitir a NF da agência', tipo: 'nf', dia: 1 },
    { emoji: '⏱️', label: 'Fechar as horas do mês', tipo: 'nf', dia: 30 },
  ] },
  { grupo: 'ASSINATURAS', itens: [
    { emoji: '🎧', label: 'Spotify', tipo: 'assinatura', dia: 5 },
    { emoji: '☁️', label: 'Google', tipo: 'assinatura', dia: 8 },
    { emoji: '🎬', label: 'Netflix', tipo: 'assinatura', dia: 15 },
    { emoji: '📦', label: 'iCloud', tipo: 'assinatura', dia: 2 },
    { emoji: '🎮', label: 'PlayStation Plus', tipo: 'assinatura', dia: 20 },
    { emoji: '🎨', label: 'Adobe', tipo: 'assinatura', dia: 12 },
    { emoji: '🤖', label: 'Claude', tipo: 'assinatura', dia: 1 },
    { emoji: '📺', label: 'YouTube Premium', tipo: 'assinatura', dia: 18 },
    { emoji: '🏋️', label: 'Academia', tipo: 'assinatura', dia: 5 },
  ] },
  { grupo: 'ENTRADAS', itens: [
    { emoji: '💰', label: 'Pagamento da agência', tipo: 'renda', dia: 10 },
    { emoji: '🧾', label: 'Freela', tipo: 'renda', repete: 'unico' },
  ] },
];

export const blankSettings = () => ({
  palette: 'noir', motion: true, autolock: 15, showStreaks: true, weekStart: 1,
  updatedAt: now(),
  sync: { enabled: false, owner: '', repo: '', branch: 'main', path: 'dados/caderno.enc.json', token: '', lastSync: 0, lastSha: '' },
});

/** Quem usa o caderno. Foto e nome ficam dentro do cofre, cifrados. */
export const blankProfile = () => ({
  nome: '', foto: '', frase: '', desde: now(), updatedAt: now(),
});

export const blankState = () => ({
  version: VERSION,
  rev: 0,
  updatedAt: now(),
  deviceId: uid(),
  profile: blankProfile(),
  settings: blankSettings(),
  categories: DEFAULT_CATEGORIES(),
  days: {},
  todos: [],
  agenda: [],          // compromissos do mês, assinaturas e entradas
  reviews: {},         // chave da semana → como ela fechou
  badges: {},          // id da conquista → quando caiu
  levelSeen: 0,        // último nível já comemorado
});

/* ── Estado vivo ───────────────────────────────────────────── */
export const state = blankState();
let session = null;
const subs = new Set();

export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };

const persist = debounce(async () => {
  if (!session) return;
  try { await vault.write(session, state); }
  catch (e) { console.error('falha ao salvar', e); emitOnly('save-error'); }
}, 400);

function emitOnly(reason) { subs.forEach(fn => fn(reason)); }

export function emit(reason = 'change') {
  state.rev = (state.rev || 0) + 1;
  state.updatedAt = now();
  emitOnly(reason);
  persist();
}
export const flush = () => persist.flush();

/* ── Migração e reidratação ────────────────────────────────── */

/** Traz qualquer documento antigo para o formato v2. */
export function migrate(data) {
  const fresh = blankState();
  if (!data || typeof data !== 'object') return fresh;
  const t = Number(data.updatedAt) || now();

  const settings = { ...fresh.settings, ...(data.settings || {}) };
  settings.sync = { ...fresh.settings.sync, ...(data.settings?.sync || {}) };
  settings.updatedAt = Number(data.settings?.updatedAt) || t;

  const categories = (Array.isArray(data.categories) && data.categories.length
    ? data.categories : fresh.categories)
    .map((c, i) => ({
      ...c, id: c.id || uid(), order: c.order ?? i,
      cadence: c.cadence || cadencia(c),
      /* dias vazio = todos os sete; guardo normalizado pra não vazar lixo */
      dias: Array.isArray(c.dias) ? c.dias.map(Number).filter(d => d >= 0 && d <= 6) : [],
      updatedAt: Number(c.updatedAt) || t,
    }));

  const days = {};
  for (const [k, d] of Object.entries(data.days || {})) {
    if (!d || typeof d !== 'object') continue;
    days[k] = { v: d.v || {}, note: d.note || '', closed: !!d.closed, updatedAt: Number(d.updatedAt) || t };
  }

  const todos = (data.todos || [])
    .map(x => ({
      ...x, id: x.id || uid(),
      createdAt: Number(x.createdAt) || t,
      updatedAt: Number(x.updatedAt) || Number(x.doneAt) || Number(x.createdAt) || t,
    }))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
      || (b.star ? 1 : 0) - (a.star ? 1 : 0)
      || b.createdAt - a.createdAt)
    .map((x, i) => ({ ...x, order: x.order ?? i }));

  const agenda = (Array.isArray(data.agenda) ? data.agenda : [])
    .map((a, i) => ({
      repete: 'mensal', fluxo: 'saida', tipo: 'conta', emoji: '•', label: 'Compromisso',
      ...a,
      id: a.id || uid(),
      order: a.order ?? i,
      marcas: a.marcas && typeof a.marcas === 'object' ? a.marcas : {},
      createdAt: Number(a.createdAt) || t,
      updatedAt: Number(a.updatedAt) || t,
    }));

  const profile = { ...fresh.profile, ...(data.profile || {}) };
  profile.desde = Number(data.profile?.desde) || menorData(days) || t;
  profile.updatedAt = Number(data.profile?.updatedAt) || t;

  return {
    version: VERSION,
    rev: Number(data.rev) || 0,
    updatedAt: t,
    deviceId: data.deviceId || fresh.deviceId,
    profile, settings, categories, days, todos, agenda,
    reviews: data.reviews && typeof data.reviews === 'object' ? data.reviews : {},
    badges: data.badges && typeof data.badges === 'object' ? data.badges : {},
    levelSeen: Number(data.levelSeen) || 0,
  };
}

/** O primeiro dia registrado — serve de "no caderno desde". */
function menorData(days) {
  const chaves = Object.keys(days || {}).sort();
  if (!chaves.length) return 0;
  const [y, m, d] = chaves[0].split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Reidrata mantendo a referência de `state` (as telas apontam para ela). */
function hydrate(data) {
  const doc = migrate(data);
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, doc);
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

export function lockVault() { session = null; vault.forget(); }
export const isUnlocked = () => !!session;
/** A sessão de cifra viva — usada por js/sync.js para selar o arquivo. */
export const getSession = () => session;

export async function setPassword(newPassword, hint) {
  session = await vault.create(newPassword, state);
  vault.writeMeta({ hint: hint || '' });
}

export function replaceAll(data) {
  hydrate(data);
  emit('replace');
}

/** Junta um documento vindo do repositório com o daqui. */
export function applyRemote(remoteDoc) {
  const { doc, changed } = mergeDocs(structuredClone(state), migrate(remoteDoc));
  if (changed) {
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, doc);
    emit('replace');
  }
  return changed;
}

/* ── Dias ──────────────────────────────────────────────────── */
export const getDay = k => state.days[k] || null;

function ensureDay(k) {
  if (!state.days[k]) state.days[k] = { v: {}, note: '', closed: false, updatedAt: now() };
  return state.days[k];
}
/** Dia sem nada dentro vira lápide (registro vazio), não sumiço. */
function tidyDay(k) {
  const d = state.days[k];
  if (!d) return;
  if (!Object.keys(d.v).length && !d.note && !d.closed) state.days[k] = { v: {}, note: '', closed: false, updatedAt: now() };
}

export function getVal(k, id) {
  const d = state.days[k];
  return d ? d.v[id] : undefined;
}

export function setVal(k, id, value, { keepZero = false } = {}) {
  const d = ensureDay(k);
  const vazio = value === undefined || value === null || value === '' || value === false
    || (value === 0 && !keepZero);
  if (vazio) delete d.v[id];
  else d.v[id] = value;
  d.updatedAt = now();
  tidyDay(k);
  emit('day');
}

export function setNote(k, text) {
  const d = ensureDay(k);
  d.note = text;
  d.updatedAt = now();
  tidyDay(k);
  emit('day');
}

export function closeDay(k, closed = true) {
  const d = ensureDay(k);
  d.closed = closed;
  d.updatedAt = now();
  tidyDay(k);
  emit('day');
}

/** Copia os valores de um dia para outro (o "repetir ontem"). */
export function copyDay(fromKey, toKey) {
  const from = state.days[fromKey];
  if (!from || !Object.keys(from.v).length) return 0;
  const to = ensureDay(toKey);
  const ids = new Set(activeCategories().map(c => c.id));
  let n = 0;
  for (const [id, v] of Object.entries(from.v)) {
    if (!ids.has(id)) continue;
    to.v[id] = v; n++;
  }
  to.updatedAt = now();
  emit('day');
  return n;
}

export const hasEntry = k => {
  const d = state.days[k];
  return !!d && (d.closed || Object.keys(d.v).length > 0 || !!d.note);
};

/* ── Categorias ────────────────────────────────────────────── */
export const listCategories = () => state.categories
  .filter(c => !c.deletedAt)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
export const activeCategories = () => listCategories().filter(c => !c.archived);
export const catById = id => state.categories.find(c => c.id === id && !c.deletedAt);

export function addCategory(cat) {
  const c = {
    id: uid(), emoji: '•', label: 'Nova categoria', type: 'toggle',
    order: listCategories().length, updatedAt: now(), ...cat,
  };
  state.categories.push(c);
  emit('categories');
  return c;
}
export function updateCategory(id, patch) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return;
  Object.assign(c, patch, { updatedAt: now() });
  emit('categories');
}
/** Apagar deixa lápide: some das telas e some também no outro aparelho. */
export function removeCategory(id) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return null;
  const snapshot = { ...c };
  c.deletedAt = now();
  c.updatedAt = now();
  emit('categories');
  return snapshot;
}
export function restoreCategory(snapshot) {
  const c = state.categories.find(x => x.id === snapshot.id);
  if (c) { delete c.deletedAt; Object.assign(c, snapshot, { updatedAt: now() }); }
  else state.categories.push({ ...snapshot, deletedAt: undefined, updatedAt: now() });
  emit('categories');
}
export function moveCategory(id, toIndex) {
  const list = listCategories();
  const from = list.findIndex(c => c.id === id);
  if (from < 0) return;
  const [c] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(list.length, toIndex)), 0, c);
  list.forEach((cat, i) => { if (cat.order !== i) { cat.order = i; cat.updatedAt = now(); } });
  emit('categories');
}
export function resetCategories() {
  state.categories.forEach(c => { c.deletedAt = now(); c.updatedAt = now(); });
  DEFAULT_CATEGORIES().forEach(c => state.categories.push(c));
  emit('categories');
}

/** A categoria foi respondida nesse dia? (zero conta como resposta.) */
export function respondida(cat, key) {
  const v = getVal(key, cat.id);
  if (v === undefined || v === null || v === '') return false;
  if (cat.type === 'toggle') return v === true;
  return true;
}

/** O texto de referência de um valor, quando a categoria tem níveis escritos. */
export function levelLabel(cat, value) {
  if (!cat?.levels || value === undefined || value === null || value === '') return '';
  return cat.levels[String(value)] || cat.levels[Number(value)] || '';
}
/** A escala começa em 0? Então 0 é resposta ("seco"), não ausência. */
export const scaleMin = cat => (cat.type === 'scale' ? (cat.min ?? 1) : 0);
export const scaleMax = cat => (cat.type === 'scale' ? (cat.max ?? 5) : (cat.max ?? 99));

/* ── Afazeres ──────────────────────────────────────────────── */
export const listTodos = () => state.todos.filter(t => !t.deletedAt);
export const openTodos = () => listTodos().filter(t => !t.done);

/**
 * As tarefas marcadas pra um dia. `due` é uma data só — nunca repetição:
 * se tem que voltar, ou é ritmo (categoria) ou é dia do mês (compromisso).
 * É essa linha que impede um quarto tipo de coisa nascer aqui.
 */
export const todosDoDia = k => listTodos().filter(t => t.due === k && !t.done);
/** As que já passaram do dia e continuam abertas. */
export const todosAtrasados = (hoje = todayKey()) =>
  listTodos().filter(t => t.due && t.due < hoje && !t.done);

export function addTodo(text, extra = {}) {
  const menor = Math.min(0, ...listTodos().map(x => x.order ?? 0));
  const t = {
    id: uid(), text: String(text || '').trim(), done: false, star: false,
    order: menor - 1,                       // entra no topo da lista
    createdAt: now(), updatedAt: now(), due: null, ...extra,
  };
  if (!t.text) return null;
  state.todos.unshift(t);
  emit('todos');
  return t;
}
export function updateTodo(id, patch) {
  const t = state.todos.find(x => x.id === id);
  if (!t) return;
  Object.assign(t, patch, { updatedAt: now() });
  if ('done' in patch) t.doneAt = patch.done ? now() : null;
  emit('todos');
}
export function removeTodo(id) {
  const t = state.todos.find(x => x.id === id);
  if (!t) return null;
  const snapshot = { ...t };
  t.deletedAt = now();
  t.updatedAt = now();
  emit('todos');
  return snapshot;
}
export function restoreTodo(snapshot) {
  const t = state.todos.find(x => x.id === snapshot.id);
  if (t) { delete t.deletedAt; Object.assign(t, snapshot, { updatedAt: now() }); }
  else state.todos.unshift({ ...snapshot, deletedAt: undefined, updatedAt: now() });
  emit('todos');
}
/** Reordena pela sequência de ids que veio do arrasto. */
export function reorderTodos(ids) {
  ids.forEach((id, i) => {
    const t = state.todos.find(x => x.id === id);
    if (t && t.order !== i) { t.order = i; t.updatedAt = now(); }
  });
  emit('todos');
}

/** Mesma ideia para as categorias. */
export function reorderCategories(ids) {
  ids.forEach((id, i) => {
    const c = state.categories.find(x => x.id === id);
    if (c && c.order !== i) { c.order = i; c.updatedAt = now(); }
  });
  emit('categories');
}

export function clearDoneTodos() {
  const cleared = listTodos().filter(t => t.done);
  cleared.forEach(t => { t.deletedAt = now(); t.updatedAt = now(); });
  emit('todos');
  return cleared.map(t => ({ ...t, deletedAt: undefined }));
}

/* ── Agenda do mês ─────────────────────────────────────────── */
export const listAgenda = () => state.agenda
  .filter(a => !a.deletedAt)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const agendaById = id => state.agenda.find(a => a.id === id && !a.deletedAt);

/** O fluxo do item — herdado do tipo quando não foi escrito. */
export const fluxoDe = item => item?.fluxo || AGENDA_TIPOS[item?.tipo]?.fluxo || 'saida';

/** Em que dia do mês esse item cai — o 31 vira o último dia de fevereiro. */
export function diaNoMes(item, mes = monthKey()) {
  const [y, m] = mes.split('-').map(Number);
  if (item.repete === 'unico') {
    return item.data && item.data.startsWith(mes) ? Number(item.data.slice(8, 10)) : null;
  }
  const ultimo = daysInMonth(y, m - 1);
  return Math.min(Math.max(1, Number(item.dia) || 1), ultimo);
}

/** A data completa em que ele cai naquele mês ('2026-09-10'). */
export function dataNoMes(item, mes = monthKey()) {
  const dia = diaNoMes(item, mes);
  if (!dia) return null;
  const [y, m] = mes.split('-').map(Number);
  return keyOf(new Date(y, m - 1, dia));
}

/** Os compromissos que acontecem naquele mês, já em ordem de dia. */
export function agendaDoMes(mes = monthKey(), { tipos, fluxo } = {}) {
  return listAgenda()
    .filter(a => !a.pausado)
    .filter(a => (a.repete === 'unico' ? (a.data || '').startsWith(mes) : true))
    .filter(a => (tipos ? tipos.includes(a.tipo) : true))
    .filter(a => (fluxo ? fluxoDe(a) === fluxo : true))
    .map(a => ({ ...a, dia: diaNoMes(a, mes), data: dataNoMes(a, mes) }))
    .sort((a, b) => (a.dia || 99) - (b.dia || 99) || (a.order ?? 0) - (b.order ?? 0));
}

/** Feito nesse mês? (pago, emitido, recebido — depende do tipo.) */
export const agendaFeito = (item, mes = monthKey()) => !!item?.marcas?.[mes]?.feito;

export function marcarAgenda(id, mes, feito = true) {
  const a = state.agenda.find(x => x.id === id);
  if (!a) return;
  if (!a.marcas) a.marcas = {};
  a.marcas[mes] = { feito: !!feito, em: now() };
  a.updatedAt = now();
  emit('agenda');
}

export function addAgenda(item = {}) {
  const maior = Math.max(0, ...listAgenda().map(x => x.order ?? 0));
  const a = {
    id: uid(), emoji: '•', label: 'Novo compromisso', tipo: 'conta',
    repete: 'mensal', dia: 1, data: null, valor: null, nota: '',
    marcas: {}, order: maior + 1, createdAt: now(), updatedAt: now(),
    ...item,
  };
  a.fluxo = a.fluxo || AGENDA_TIPOS[a.tipo]?.fluxo || 'saida';
  state.agenda.push(a);
  emit('agenda');
  return a;
}
export function updateAgenda(id, patch) {
  const a = state.agenda.find(x => x.id === id);
  if (!a) return;
  Object.assign(a, patch, { updatedAt: now() });
  if (patch.tipo && !patch.fluxo) a.fluxo = AGENDA_TIPOS[patch.tipo]?.fluxo || 'saida';
  emit('agenda');
}
export function removeAgenda(id) {
  const a = state.agenda.find(x => x.id === id);
  if (!a) return null;
  const snapshot = { ...a };
  a.deletedAt = now();
  a.updatedAt = now();
  emit('agenda');
  return snapshot;
}
export function restoreAgenda(snapshot) {
  const a = state.agenda.find(x => x.id === snapshot.id);
  if (a) { delete a.deletedAt; Object.assign(a, snapshot, { updatedAt: now() }); }
  else state.agenda.push({ ...snapshot, deletedAt: undefined, updatedAt: now() });
  emit('agenda');
}
export function reorderAgenda(ids) {
  ids.forEach((id, i) => {
    const a = state.agenda.find(x => x.id === id);
    if (a && a.order !== i) { a.order = i; a.updatedAt = now(); }
  });
  emit('agenda');
}

/**
 * O mês em números. Só entra no cálculo o que tem valor escrito — o resto
 * é compromisso, não dinheiro.
 */
export function contasDoMes(mes = monthKey()) {
  const itens = agendaDoMes(mes);
  const soma = (lista, filtro) => lista.filter(filtro).reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const saidas = itens.filter(a => fluxoDe(a) === 'saida');
  const entradas = itens.filter(a => fluxoDe(a) === 'entrada');
  const totalSaida = soma(saidas, () => true);
  const pago = soma(saidas, a => agendaFeito(a, mes));
  const totalEntrada = soma(entradas, () => true);
  const recebido = soma(entradas, a => agendaFeito(a, mes));
  return {
    mes, itens,
    saidas, entradas,
    assinaturas: soma(saidas, a => a.tipo === 'assinatura'),
    totalSaida, pago, aPagar: totalSaida - pago,
    totalEntrada, recebido, aReceber: totalEntrada - recebido,
    saldo: totalEntrada - totalSaida,
    pendentes: itens.filter(a => !agendaFeito(a, mes)),
    feitos: itens.filter(a => agendaFeito(a, mes)),
  };
}

/** O que cai num dia específico — usado pelo calendário e pelo check-in. */
export function agendaDoDia(k = todayKey()) {
  return agendaDoMes(monthKey(k)).filter(a => a.data === k);
}

/* ── Revisão da semana ─────────────────────────────────────── */
export const getReview = chave => state.reviews?.[chave] || null;

export function saveReview(chave, dados) {
  if (!state.reviews) state.reviews = {};
  state.reviews[chave] = { ...(state.reviews[chave] || {}), ...dados, chave, updatedAt: now() };
  emit('reviews');
  return state.reviews[chave];
}
export function reopenReview(chave) {
  if (state.reviews?.[chave]) {
    state.reviews[chave] = { ...state.reviews[chave], fechadaEm: 0, updatedAt: now() };
    emit('reviews');
  }
}

/* ── Perfil ────────────────────────────────────────────────── */
export function setProfile(patch) {
  state.profile = { ...state.profile, ...patch, updatedAt: now() };
  emit('profile');
}
/** Iniciais para quando não há foto. */
export function iniciais() {
  const n = (state.profile?.nome || '').trim();
  if (!n) return '✳';
  const p = n.split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

/* ── Preferências ──────────────────────────────────────────── */
export function setSetting(key, value) {
  state.settings[key] = value;
  state.settings.updatedAt = now();
  emit('settings');
}
export function setSync(patch) {
  state.settings.sync = { ...state.settings.sync, ...patch };
  state.settings.updatedAt = now();
  emitOnly('sync');
  persist();
}

/* ── Import / export ───────────────────────────────────────── */
export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'caderno' }, null, 2);
}
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('days' in data)) throw new Error('formato');
  replaceAll(data);
}
/** O que vai para o arquivo do repositório (sem o token de sincronia). */
export function syncDoc() {
  const doc = structuredClone(state);
  doc.settings = { ...doc.settings, sync: undefined };
  return doc;
}

export { todayKey };
