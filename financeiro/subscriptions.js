const currencies = new Set(['BRL', 'USD', 'EUR']);
const invalid = () => new Error('Confira o nome e os dados preenchidos da assinatura.');

export function normalizeSubscriptions(records = []) {
  if (!Array.isArray(records) || records.length > 150) throw invalid();
  const ids = new Set();
  return records.map(record => {
    const { id, title, amountCents = null, currency = 'BRL', day = null, card = '', active = true } = record || {};
    if (typeof id !== 'string' || !/^[a-z0-9_-]{1,80}$/.test(id) || ids.has(id) ||
        typeof title !== 'string' || !title.trim() || title.length > 100 ||
        !(amountCents === null || (Number.isSafeInteger(amountCents) && amountCents > 0)) ||
        !currencies.has(currency) || !(day === null || (Number.isInteger(day) && day >= 1 && day <= 31)) ||
        typeof card !== 'string' || card.length > 70 || typeof active !== 'boolean') throw invalid();
    if (/\d(?:[\s.-]*\d){11,}/.test(card)) throw new Error('Use só o apelido do cartão, sem seu número.');
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
  if (!day) return null;
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
  let incomplete = 0;
  for (const record of records) {
    const name = record.card || 'Cartão a definir';
    const key = name.toLocaleLowerCase('pt-BR');
    if (!groups.has(key)) groups.set(key, { card: name, rows: [] });
    groups.get(key).rows.push({ ...record, next: nextCharge(today, record.day) });
    if (record.active) {
      if (record.amountCents === null) incomplete++;
      else totals.set(record.currency, (totals.get(record.currency) || 0n) + BigInt(record.amountCents));
    }
  }
  for (const group of groups.values()) group.rows.sort((a, b) =>
    Number(b.active) - Number(a.active) || (a.next || '9999').localeCompare(b.next || '9999') || a.title.localeCompare(b.title, 'pt-BR'));
  return { groups: [...groups.values()].sort((a, b) => a.card.localeCompare(b.card, 'pt-BR')), totals, incomplete };
}
