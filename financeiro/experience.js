import { el, humanDay, monthLabel, todayKey } from '../js/utils.js';
import { subscriptionGroups } from './subscriptions.js';

export const currencies = { BRL: 'Real · BRL', USD: 'Dólar · USD', EUR: 'Euro · EUR' };
const templates = Object.keys(currencies).map(currency => [currency,
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 0 })]);
const formats = Object.fromEntries(templates);

export function money(cents, currency = 'BRL') {
  const amount = BigInt(cents);
  const abs = amount < 0n ? -amount : amount;
  return (amount < 0n ? '−' : '') + formats[currency].format(abs / 100n) + ',' + String(abs % 100n).padStart(2, '0');
}

const portion = (amount, sum) => sum ? Number(amount * 10000n / sum) / 100 : 0;

export function river(wallet, overview, month = wallet.paymentMonth) {
  const { income, expenses } = overview;
  if (income.total === 0n && expenses.total === 0n) {
    return el('section.panel.stack', {}, [
      el('div.view-heading', {}, [el('h2', { text: 'Fluxo de ' + monthLabel(month) }), el('span.finance-period', { text: 'Sem fechamento' })]),
      el('p.finance-hint', { text: 'Sem entradas ou saídas completas registradas neste mês. O saldo confirmado aparece acima e não é alterado por esta visualização.' }),
    ]);
  }
  const net = income.total - expenses.total;
  const remaining = net > 0n ? net : 0n;
  const cover = expenses.total > income.total ? expenses.total : income.total;
  const series = [
    ['Pagas', expenses.settled, 'paid'],
    ['A pagar', expenses.pending, 'planned'],
    ['Projeção', remaining, 'remaining'],
  ];
  let offset = 0;
  const branches = series.map(([, amount, tone], index) => {
    const share = portion(amount, cover) / 100;
    const start = offset;
    offset += share;
    if (amount === 0n) return null;
    return el('span.river-segment.' + tone, { style: {
      '--origin-start': 19 + start * 62 + '%',
      '--origin-end': 19 + offset * 62 + '%',
      '--branch-start': 2 + index * 4 + start * 88 + '%',
      '--branch-end': 2 + index * 4 + offset * 88 + '%',
    } });
  });
  return el('section.finance-hero', { 'aria-label': 'Fluxo das entradas e saídas do mês' }, [
    el('div.finance-title', {}, [
      el('div', {}, [el('p.finance-caption', { text: monthLabel(month) }), el('h2', { text: 'Fluxo do mês' })]),
      el('span.finance-period', { text: 'Projeção' }),
    ]),
    el('strong.finance-net' + (net < 0n ? '.negative' : ''), { text: money(net) }),
    el('div.river', {}, [
      el('div.river-in', {}, [el('span', { text: 'Rendas do mês' }), el('strong', { text: money(income.total) })]),
      el('div.river-branches', { 'aria-hidden': 'true' }, branches),
      el('ul.river-legend', {}, series.map(([label, value, tone]) => el('li.' + tone, {}, [
        el('span', { text: label }), el('strong', { text: label === 'Projeção' ? money(net) : money(value) }),
      ]))),
    ]),
    el('p.finance-hint', { text: 'Rendas registradas no mês menos despesas pagas e previstas.' }),
  ]);
}

export function spendingCalendar(wallet, month = wallet.paymentMonth) {
  const [year, monthNumber] = month.split('-').map(Number);
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dates = Array.from({ length }, (_, i) => month + '-' + String(i + 1).padStart(2, '0'));
  const perDay = new Map();
  for (const item of wallet.payments) {
    if (item.date?.startsWith(month + '-') && item.amountCents !== null) perDay.set(item.date, (perDay.get(item.date) || 0n) + BigInt(item.amountCents));
  }
  let max = 0n;
  for (const amount of perDay.values()) if (amount > max) max = amount;
  const index = dates.indexOf(todayKey());
  const summary = el('p.finance-hint', { role: 'status', text: perDay.size ? 'Arraste para consultar um dia.' : 'As despesas com data aparecem aqui.' });
  const cursor = el('input.spend-range', {
    type: 'range', min: 1, max: dates.length, value: index < 0 ? 1 : index + 1, 'aria-label': 'Dia do mês',
    oninput: () => {
      const day = dates[Number(cursor.value) - 1];
      summary.textContent = humanDay(day) + ' · ' + money(perDay.get(day) || 0n);
      plot.style.setProperty('--selected', ((Number(cursor.value) - .5) / dates.length * 100) + '%');
    },
  });
  const plot = el('div.spending-grid', { 'aria-hidden': 'true', style: { '--days': dates.length, '--selected': ((Number(cursor.value) - .5) / dates.length * 100) + '%' } }, dates.map(day => {
    const total = perDay.get(day) || 0n;
    return el(day === todayKey() ? 'i.is-today' : 'i', { style: { '--bar': portion(total, max) + '%' } });
  }));
  return el('section.panel.spending-calendar', {}, [
    el('div.view-heading', {}, [el('h2', { text: 'Despesas por dia' }), el('span.finance-period', { text: monthLabel(month) })]),
    el('div.spending-plot', {}, [plot, cursor]),
    el('div.spending-scale', { 'aria-hidden': 'true' }, [el('span', { text: '1' }), el('span', { text: '15' }), el('span', { text: String(length) })]),
    summary,
  ]);
}

export function spendingBreakdown(wallet, month = wallet.paymentMonth) {
  const summary = wallet.spendingSummary;
  if (!summary?.categories?.length || summary.month !== month) return null;
  const headingMonth = monthLabel(summary.month);
  return el('section.panel.stack', { 'aria-label': 'Despesas por categoria' }, [
    el('div.view-heading', {}, [el('h2', { text: 'Gastos por categoria' }), el('span.finance-period', { text: headingMonth })]),
    ...summary.categories.map(item => el('div.spending-category-row', {}, [
      el('span', { text: item.label }),
      el('strong', { text: money(item.amountCents) }),
    ])),
    el('p.finance-hint', { text: 'Resumo de novembro; não descontado novamente do saldo atual.' }),
  ]);
}

const filters = ['Todos', 'Rendas', 'Despesas'];
export function movements(wallet, filter, change, add, editPayment = () => {}, editIncome = () => {}, month = wallet.paymentMonth) {
  const rows = [
    ...wallet.receivables.filter(item => item.date?.startsWith(month + '-') || (!item.date && month === todayKey().slice(0,7))).map(item => ({ ...item, kind: 'Rendas' })),
    ...wallet.payments.filter(item => (item.month || item.date?.slice(0,7) || wallet.paymentMonth) === month).map(item => ({ ...item, kind: 'Despesas' })),
  ].filter(item => filter === 'Todos' || filter === item.kind);
  const groups = new Map();
  rows.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') ||
    (a.status === 'pending' && b.status === 'pending' ? (a.date || '9999').localeCompare(b.date || '9999') : (b.date || '').localeCompare(a.date || '')));
  for (const item of rows) {
    const group = item.status === 'pending' ? 'Previstos' : item.date ? humanDay(item.date) : 'Sem data';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }
  return el('section.stack', { 'aria-label': 'Movimentos' }, [
    el('div.view-heading', {}, [el('h2', { text: 'Movimentos' }), el('span.finance-period', { text: 'Carteira' })]),
    el('div.movement-filters', { role: 'group', 'aria-label': 'Tipo de movimento' }, filters.map(type =>
      el('button', { type: 'button', text: type, 'aria-pressed': String(filter === type), onclick: () => change(type) }))),
    ...[...groups].map(([heading, items]) => el('section.panel.finance-records', {}, [
      el('h3', { text: heading }),
      el('ul', {}, items.map(item => {
        const income = item.kind === 'Rendas';
        return el('li.finance-record', {}, [
          el('span.record-symbol.' + (income ? 'income' : 'expense'), { text: income ? '+' : '−', 'aria-hidden': 'true' }),
          el('div', {}, [el('strong', { text: item.title }), el('p', { text: [income ? 'Renda' : 'Despesa', heading === 'Previstos' && item.date ? humanDay(item.date) : '', item.note || ''].filter(Boolean).join(' · ') }),
            el('button.plan-edit', { type: 'button', text: item.amountCents === null ? 'Definir valor' : 'Editar', onclick: () => income ? editIncome(item) : editPayment(item) })]),
          el('strong.record-money', { text: item.amountCents === null ? 'A definir' : money(income ? item.amountCents : -item.amountCents) }),
        ]);
      })),
    ])),
    !rows.length ? el('div.panel.stack', {}, [el('p.muted', { text: 'Nenhum movimento neste filtro.' }), el('button', { type: 'button', text: 'Novo lançamento', onclick: add })]) : null,
  ]);
}

export function subscriptions(records, open) {
  const { groups, totals, incomplete } = subscriptionGroups(records, todayKey());
  const add = el('button.primary', { type: 'button', text: '+ Nova assinatura', onclick: () => open(null, add) });
  return el('section.stack', { 'aria-label': 'Assinaturas' }, [
    el('section.finance-hero', {}, [
      el('div.finance-title', {}, [el('h2', { text: 'Assinaturas' }), el('span.finance-period', { text: 'Mensais' })]),
      totals.size ? el('div.subscription-totals', {}, [...totals].map(([currency, value]) => el('strong', { text: money(value, currency) }))) : null,
      el('p.finance-hint', { text: 'Total conhecido de assinaturas ativas' + (incomplete ? ' · ' + incomplete + ' valor(es) a confirmar' : '') + '. Não descontado novamente do saldo.' }),
      add,
    ]),
    ...groups.map(group => el('section.panel.finance-records', {}, [
      el('h3', { text: group.card }),
      el('ul', {}, group.rows.map(item => {
        const edit = el('button.subscription-row', { type: 'button', 'aria-label': 'Editar assinatura: ' + item.title, onclick: () => open(item, edit) }, [
          el('span.record-symbol.expense', { 'aria-hidden': 'true', text: '↻' }),
          el('span', {}, [el('strong', { text: item.title }), el('span.subscription-date', { text: !item.active ? 'Pausada' : item.next ? 'Próxima: ' + humanDay(item.next) : 'Dia a definir' })]),
          el('strong.record-money', { text: item.amountCents === null ? 'Valor a definir' : money(item.amountCents, item.currency) }),
        ]);
        return el('li', {}, [edit]);
      })),
    ])),
    !groups.length ? el('p.panel.muted', { text: 'Nenhuma assinatura cadastrada.' }) : null,
  ]);
}

export function bindQuickAdd(menu) {
  const trigger = menu.querySelector('summary');
  let gesture, suppressClickUntil = 0;
  function clear() {
    const previous = gesture;
    gesture = null;
    previous?.target?.classList.remove('is-target');
    return previous;
  }
  trigger.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, wasOpen: menu.open };
  });
  trigger.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 14) return;
    gesture.dragging = true;
    menu.open = true;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.finance-add-options button');
    gesture.target?.classList.remove('is-target');
    gesture.target = target && menu.contains(target) ? target : null;
    gesture.target?.classList.add('is-target');
  });
  trigger.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const previous = clear();
    if (!previous.dragging) return;
    suppressClickUntil = Date.now() + 400;
    previous.target?.click();
  });
  trigger.addEventListener('pointercancel', event => {
    if (gesture?.id !== event.pointerId) return;
    const previous = clear();
    if (previous.dragging && !previous.wasOpen) menu.open = false;
  });
  trigger.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) event.preventDefault();
  });
}
