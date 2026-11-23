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

const SUBS_META = {
  'sub-spotify': ['Entretenimento', 'spotify.com', '#1ed760', '#092a18'],
  'sub-youtube': ['Entretenimento', 'youtube.com', '#ff0033', '#fff'],
  'sub-google-one': ['Nuvem & software', 'one.google.com', '#e7f0ff', '#24498b'],
  'sub-icloud': ['Nuvem & software', 'icloud.com', '#eaf4ff', '#20579b'],
  'sub-claude': ['IA & criação', 'claude.ai', '#d97757', '#fff'],
  'sub-globoplay': ['Entretenimento', 'globoplay.globo.com', '#ee1739', '#fff'],
  'sub-uber-one': ['Serviços', 'uber.com', '#111111', '#fff'],
  'sub-ifood': ['Serviços', 'ifood.com.br', '#e91a32', '#fff'],
  'sub-meli-plus': ['Serviços', 'mercadolivre.com.br', '#ffe600', '#222'],
  'sub-savee': ['IA & criação', 'savee.it', '#eae9e5', '#252525'],
  'sub-psn': ['Entretenimento', 'playstation.com', '#1559b5', '#fff'],
  'sub-cargo-collective': ['IA & criação', 'cargo.site', '#252525', '#fff'],
  'sub-clube-livelo': ['Pontos & milhas', 'livelo.com.br', '#6e45b9', '#fff'],
  'sub-smiles': ['Pontos & milhas', 'smiles.com.br', '#fae667', '#242424'],
  'sub-magnific': ['IA & criação', 'magnific.ai', '#272347', '#fff'],
  'sub-vivo': ['Conectividade', 'vivo.com.br', '#622eaa', '#fff'],
  'sub-amazon-prime': ['Entretenimento', 'primevideo.com', '#d9f6fb', '#09537b'],
  'sub-smartfit': ['Saúde & bem-estar', 'smartfit.com.br', '#ffde00', '#1b1b1b'],
  'sub-chatgpt': ['IA & criação', 'chatgpt.com', '#dcf0e7', '#134c39'],
  'sub-google-work-mestiza': ['Nuvem & software', 'workspace.google.com', '#e7f0ff', '#24498b'],
};
const CATEGORY_ORDER = ['IA & criação', 'Entretenimento', 'Nuvem & software', 'Pontos & milhas', 'Conectividade', 'Saúde & bem-estar', 'Serviços', 'Outros'];
const subCategory = item => SUBS_META[item.id]?.[0] || 'Outros';
const formatSubAmount = (amount, currency) => {
  if (amount === null) return 'A definir';
  const full = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(amount / 100);
  return full.replace(/\u00a0/g, ' ');
};
function subscriptionIcon(item) {
  const meta = SUBS_META[item.id];
  const letters = item.title.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
  const logo = el('span.subs-logo', { style: { '--logo-bg': meta?.[2] || '#e0e7e1', '--logo-fg': meta?.[3] || '#264534' }, 'aria-hidden': 'true' }, [
    el('span.subs-monogram', { text: letters }),
  ]);
  if (meta?.[1]) {
    const img = el('img', { src: 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(meta[1]) + '&sz=64', alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('load', () => { if (img.naturalWidth > 0) logo.classList.add('logo-loaded'); });
    img.addEventListener('error', () => { img.remove(); logo.classList.remove('logo-loaded'); });
    logo.append(img);
  }
  return logo;
}

const subsViewState = { category: 'Todas', sort: 'categoria', query: '' };
export function subscriptions(records, open) {
  const { incomplete } = subscriptionGroups(records, todayKey());
  const countActive = records.filter(item => item.active).length;
  const known = records.filter(item => item.active && item.amountCents !== null);
  const totals = known.reduce((sum, item) => sum + (item.currency === 'BRL' ? item.amountCents : 0), 0);
  let category = subsViewState.category;
  let sort = subsViewState.sort;
  let query = subsViewState.query;
  const add = el('button.subs-new', { type: 'button', text: '+ Nova', onclick: () => open(null, add) });
  const list = el('div.subs-results', {});
  const resultCount = el('p.subs-result-count', { role: 'status' });
  const categoryNames = CATEGORY_ORDER.filter(name => records.some(item => subCategory(item) === name));
  const categories = ['Todas', ...categoryNames];
  const pills = el('div.subs-category-scroll', { role: 'group', 'aria-label': 'Filtrar assinaturas por categoria' });
  const search = el('input.subscription-search', {
    type: 'search', placeholder: 'Buscar serviço', 'aria-label': 'Buscar assinatura',
    value: query, oninput: () => { query = search.value.trim().toLocaleLowerCase('pt-BR'); subsViewState.query = query; redraw(); },
  });
  const sorter = el('select.subs-sort', { 'aria-label': 'Ordenar assinaturas', onchange: () => { sort = sorter.value; subsViewState.sort = sort; redraw(); } }, [
    el('option', { value: 'categoria', text: 'Por categoria' }),
    el('option', { value: 'maior', text: 'Maior valor' }),
    el('option', { value: 'menor', text: 'Menor valor' }),
    el('option', { value: 'az', text: 'Nome A–Z' }),
    el('option', { value: 'cartao', text: 'Por cartão' }),
  ]);
  sorter.value = sort;
  if (!categories.includes(category)) category = subsViewState.category = 'Todas';
  const categoryTotals = CATEGORY_ORDER.map(name => {
    const members = records.filter(item => item.active && subCategory(item) === name);
    return { name, count: members.length, amount: members.reduce((sum, item) => sum + (item.currency === 'BRL' ? item.amountCents || 0 : 0), 0) };
  }).filter(item => item.count);
  const top = Math.max(1, ...categoryTotals.map(entry => entry.amount));
  const summary = el('section.subs-overview', { 'aria-label': 'Resumo das assinaturas' }, [
    el('div.subs-overview-top', {}, [
      el('div', {}, [el('span.subs-eyebrow', { text: 'ASSINATURAS / MÊS' }),
        el('strong.subs-amount', { text: formatSubAmount(totals, 'BRL') }),
        el('p.subs-hero-hint', { text: 'Total conhecido · ' + countActive + ' ativas' + (incomplete ? ' · ' + incomplete + ' sem valor' : '') })]),
      el('span.subs-hero-mark', { text: '↗', 'aria-hidden': 'true' }),
    ]),
    el('div.subs-year-strip', {}, [
      el('span', { text: 'Equivalente em 12 meses' }),
      el('strong', { text: formatSubAmount(totals * 12, 'BRL') }),
    ]),
    el('p.subs-small-note', { text: 'Estimativa, sem valores pendentes. Não descontada do saldo nem somada às faturas.' }),
  ]);
  const categoryChart = el('section.subs-category-breakdown', {}, [
    el('div.subs-section-title', {}, [el('h3', { text: 'Onde pesa mais' }), el('span', { text: 'por categoria' })]),
    ...categoryTotals.sort((a,b) => b.amount - a.amount).map(entry =>
      el('div.subs-bar-row', {}, [
        el('div.subs-bar-heading', {}, [
          el('span', { text: entry.name }),
          el('strong', { text: formatSubAmount(entry.amount, 'BRL') }),
        ]),
        el('div.subs-bar-track', { 'aria-hidden': 'true' },
          [el('span', { style: { '--share': (entry.amount / top * 100).toFixed(2) + '%' } })]),
      ])),
  ]);
  const makeItem = item => {
    const edit = el('button.subs-service', { type: 'button', 'aria-label': 'Editar ' + item.title, onclick: () => open(item, edit) }, [
      subscriptionIcon(item),
      el('span.subs-service-copy', {}, [
        el('strong.subs-service-name', { text: item.title }),
        el('span.subs-service-meta', { text: [
          item.active ? (item.day ? 'Dia ' + item.day : 'Dia a definir') : 'Pausada',
          item.card || null,
        ].filter(Boolean).join(' · ') }),
      ]),
      el('span.subs-service-end', {}, [
        el('strong.subs-service-price' + (item.amountCents === null ? '.is-missing' : ''), { text: formatSubAmount(item.amountCents, item.currency) }),
        el('small', { text: item.active ? (item.amountCents === null ? 'completar' : '/ mês') : 'pausada' }),
      ]),
      el('span.subs-service-chevron', { text: '›', 'aria-hidden': 'true' }),
    ]);
    return el('div.subs-service-wrap', {}, [edit]);
  };
  function redraw() {
    pills.replaceChildren(...categories.map(name => {
      const count = name === 'Todas' ? records.length : records.filter(item => subCategory(item) === name).length;
      return el('button.subs-category-pill', {
        type: 'button', text: name + ' ' + count, 'aria-pressed': String(category === name),
        onclick: () => { category = name; subsViewState.category = name; redraw(); },
      });
    }));
    let rows = records.filter(item => (category === 'Todas' || subCategory(item) === category)
      && (!query || [item.title, subCategory(item), item.card].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
    const byValue = (a, b, sign) => ((a.amountCents === null) - (b.amountCents === null)) || sign * ((a.amountCents ?? 0) - (b.amountCents ?? 0));
    const alphabetical = (a, b) => a.title.localeCompare(b.title, 'pt-BR');
    if (sort === 'maior') rows.sort((a,b) => byValue(a,b,-1) || alphabetical(a,b));
    else if (sort === 'menor') rows.sort((a,b) => byValue(a,b,1) || alphabetical(a,b));
    else if (sort === 'az') rows.sort(alphabetical);
    else if (sort === 'cartao') rows.sort((a,b) => (a.card || 'zzzz').localeCompare(b.card || 'zzzz', 'pt-BR') || alphabetical(a,b));
    else rows.sort((a,b) => CATEGORY_ORDER.indexOf(subCategory(a)) - CATEGORY_ORDER.indexOf(subCategory(b)) || alphabetical(a,b));
    const groups = new Map();
    for (const item of rows) {
      const group = sort === 'categoria' ? subCategory(item) : sort === 'cartao' ? (item.card || 'Cartão a definir') : 'Serviços';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    }
    list.replaceChildren(...[...groups].map(([name, members]) => el('section.subs-list-group', {}, [
      el('div.subs-group-heading', {}, [
        el('h3', { text: name }),
        el('span', { text: members.length + (members.length === 1 ? ' serviço' : ' serviços') }),
      ]),
      el('div.subs-service-list', {}, members.map(makeItem)),
    ])), !rows.length ? el('p.subs-empty', { text: 'Nenhuma assinatura encontrada.' }) : null);
    resultCount.textContent = rows.length + (rows.length === 1 ? ' assinatura' : ' assinaturas');
  }
  const root = el('section.subs-page', { 'aria-label': 'Assinaturas' }, [
    summary,
    categoryChart,
    el('div.subs-list-heading', {}, [
      el('div', {}, [el('h2', { text: 'Seus serviços' }), resultCount]),
      add,
    ]),
    search,
    pills,
    el('div.subs-sort-wrap', {}, [
      el('span', { text: 'ORDENAR' }),
      sorter,
    ]),
    list,
  ]);
  redraw();
  return root;
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
