/* merge.js — junta dois cadernos (este aparelho e o do repositório)
   sem inventar nada: cada item carrega `updatedAt` e ganha quem é mais
   novo. Apagar é um item com `deletedAt`, para que a exclusão feita num
   aparelho não seja ressuscitada pelo outro.

   Funções puras de propósito: dá para testar sem navegador
   (`node tools/test-merge.mjs`). */

export const TOMB_TTL = 180 * 864e5;   // lápides somem depois de 180 dias

const ts = o => Number(o?.updatedAt) || 0;
const newer = (a, b) => (ts(b) > ts(a) ? b : a);

/** Junta duas listas de itens com `id`, mantendo o mais recente de cada. */
export function mergeById(localList = [], remoteList = [], now = Date.now()) {
  const out = new Map();
  for (const item of localList) if (item?.id) out.set(item.id, item);
  for (const item of remoteList) {
    if (!item?.id) continue;
    const mine = out.get(item.id);
    out.set(item.id, mine ? newer(mine, item) : item);
  }
  return [...out.values()].filter(i => !(i.deletedAt && now - i.deletedAt > TOMB_TTL));
}

/**
 * A agenda junta-se por item, mas as marcas de cada mês ("paguei o cartão em
 * setembro") são independentes entre si: se um aparelho marcou setembro e o
 * outro outubro, os dois valem. Dentro do mesmo mês vale a marca mais nova.
 */
export function mergeAgenda(localList = [], remoteList = [], now = Date.now()) {
  const porId = new Map();
  for (const item of [...localList, ...remoteList]) if (item?.id) {
    const anterior = porId.get(item.id);
    porId.set(item.id, anterior ? newer(anterior, item) : item);
  }
  for (const [id, item] of porId) {
    const marcas = {};
    for (const lado of [localList, remoteList]) {
      const dele = lado.find(x => x?.id === id)?.marcas || {};
      for (const [mes, m] of Object.entries(dele)) {
        const atual = marcas[mes];
        if (!atual || Number(m?.em || 0) > Number(atual.em || 0)) marcas[mes] = m;
      }
    }
    porId.set(id, { ...item, marcas });
  }
  return [...porId.values()]
    .filter(i => !(i.deletedAt && now - i.deletedAt > TOMB_TTL))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Junta os dias: a chave é a data, ganha o registro editado por último. */
export function mergeDays(localDays = {}, remoteDays = {}) {
  const out = { ...localDays };
  for (const [key, remote] of Object.entries(remoteDays)) {
    const mine = out[key];
    if (!mine) { out[key] = remote; continue; }
    out[key] = newer(mine, remote);
  }
  return out;
}

/**
 * Junta dois documentos completos.
 * Devolve { doc, changed } — `changed` diz se o remoto trouxe algo novo.
 */
export function mergeDocs(local, remote, now = Date.now()) {
  if (!remote || remote.empty) return { doc: local, changed: false };

  const days = mergeDays(local.days, remote.days);
  const categories = mergeById(local.categories, remote.categories, now)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const todos = mergeById(local.todos, remote.todos, now)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const agenda = mergeAgenda(local.agenda, remote.agenda, now);

  // preferências são do aparelho, mas o lado editado por último vence
  // a configuração de sincronia é sempre deste aparelho (guarda o token)
  const settings = ts(remote.settings) > ts(local.settings)
    ? { ...local.settings, ...remote.settings, sync: local.settings?.sync }
    : local.settings;

  // perfil: vence quem editou por último (foto e nome andam juntos)
  const profile = ts(remote.profile) > ts(local.profile)
    ? { ...local.profile, ...remote.profile }
    : local.profile;

  // revisões: uma por semana, ganha a editada por último
  const reviews = { ...(local.reviews || {}) };
  for (const [k, r] of Object.entries(remote.reviews || {})) {
    reviews[k] = !reviews[k] || ts(r) > ts(reviews[k]) ? r : reviews[k];
  }

  const badges = { ...(remote.badges || {}) };
  for (const [id, at] of Object.entries(local.badges || {})) {
    badges[id] = badges[id] ? Math.min(badges[id], at) : at;    // vale a primeira vez
  }

  const doc = {
    ...local,
    version: Math.max(local.version || 2, remote.version || 2),
    rev: Math.max(local.rev || 0, remote.rev || 0) + 1,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, now),
    profile, settings, categories, days, todos, agenda, reviews, badges,
  };

  const changed = JSON.stringify([local.days, local.categories, local.todos, local.agenda])
                !== JSON.stringify([doc.days, doc.categories, doc.todos, doc.agenda]);
  return { doc, changed };
}

/** Quantos itens o remoto acrescentaria — usado só para avisar o usuário. */
export function diffSummary(local, remote) {
  if (!remote || remote.empty) return { days: 0, todos: 0, categories: 0 };
  const localDayKeys = new Set(Object.keys(local.days || {}));
  const localTodoIds = new Set((local.todos || []).map(t => t.id));
  const localCatIds = new Set((local.categories || []).map(c => c.id));
  return {
    days: Object.keys(remote.days || {}).filter(k => !localDayKeys.has(k)).length,
    todos: (remote.todos || []).filter(t => !localTodoIds.has(t.id) && !t.deletedAt).length,
    categories: (remote.categories || []).filter(c => !localCatIds.has(c.id) && !c.deletedAt).length,
  };
}
