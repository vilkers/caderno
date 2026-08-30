/* utils.js — helpers de DOM, data e formatação */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Cria elemento: el('div.card', {onclick}, ['texto', outroEl]) */
export function el(spec, props = {}, kids = []) {
  const [tag, ...cls] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (cls.length) node.className = cls.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of [].concat(kids)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export function debounce(fn, ms = 300) {
  let t;
  const wrapped = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  wrapped.flush = (...a) => { clearTimeout(t); fn(...a); };
  return wrapped;
}

/* ── Datas (sempre no fuso local, chave YYYY-MM-DD) ────────── */
export const pad = n => String(n).padStart(2, '0');
export const keyOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayKey = () => keyOf(new Date());
export function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); }
export const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);

export const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WD_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "Hoje", "Ontem" ou "qua, 12 mar" */
export function humanDay(k) {
  const t = todayKey();
  if (k === t) return 'Hoje';
  if (k === addDays(t, -1)) return 'Ontem';
  if (k === addDays(t, 1)) return 'Amanhã';
  const d = parseKey(k);
  return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
export function longDay(k) {
  const d = parseKey(k);
  return `${WD_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Matriz do mês: 6 semanas x 7 dias, começando no domingo */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: keyOf(d), day: d.getDate(), out: d.getMonth() !== month };
  });
}

export const lastNDays = (n, end = todayKey()) =>
  Array.from({ length: n }, (_, i) => addDays(end, -(n - 1 - i)));

export const nf = (n, dec = 0) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
