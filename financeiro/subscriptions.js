const currencies = new Set(['BRL', 'USD', 'EUR']);
const invalid = () => new Error('Confira o nome, o valor, o dia e o apelido do cartão.');

export function normalizeSubscriptions(records = []) {
  if (!Array.isArray(records) || records.length > 150) throw invalid();
  const ids = new Set();
  return records.map(record => {
    const { id, title, amountCents, currency, day, card, active = true } = record || {};
    if (typeof id !== 'string' || !/^[a-z0-9_-]{1,80}$/.test(id) || ids.has(id) ||
        typeof title !== 'string' || !title.trim() || title.length > 100 ||
        !Number.isSafeInteger(amountCents) || amountCents <= 0 || !currencies.has(currency) ||
        !Number.isInteger(day) || day < 1 || day > 31 ||
        typeof card !== 'string' || !card.trim() || card.length > 70 || typeof active !== 'boolean') throw invalid();
    if (/\d(?:[\s.-]*\d){11,}/.test(card)) throw new Error('Use o apelido do cartão, como Itaú pessoal.');
    ids.add(id);
    return { id, title: title.trim(), amountCents, currency, day, card: card.trim(), active };
  });
}

export function dueInMonth(month, day) {
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return month + '-' + String(Math.min(day, last)).padStart(2, '0');
}

export function nextCharge(today, day) {
  const month = today.slice(0, 7);
  const due = dueInMonth(month, day);
  if (due >= today) return due;
  const [year, number] = month.split('-').map(Number);
  const following = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
  return dueInMonth(following, day);
}

export function subscriptionGroups(records, today) {
  const groups = new Map();
  const totals = new Map();
  for (const record of records) {
    const key = record.card.toLocaleLowerCase('pt-BR');
    if (!groups.has(key)) groups.set(key, { card: record.card, rows: [] });
    groups.get(key).rows.push({ ...record, next: nextCharge(today, record.day) });
    if (record.active) totals.set(record.currency, (totals.get(record.currency) || 0n) + BigInt(record.amountCents));
  }
  for (const group of groups.values()) {
    group.rows.sort((a, b) => Number(b.active) - Number(a.active) || a.next.localeCompare(b.next) || a.title.localeCompare(b.title, 'pt-BR'));
  }
  return { groups: [...groups.values()].sort((a, b) => a.card.localeCompare(b.card, 'pt-BR')), totals };
}
