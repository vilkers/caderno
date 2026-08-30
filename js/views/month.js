/* views/month.js — duas leituras do passado:

   SEMANA: grade de preenchimento em lote (dias × categorias). É onde se
   recupera a semana que ficou em branco — um toque por célula.
   MÊS: o mês inteiro, com um ponto por categoria feita em cada dia, ou
   mapa de calor quando se filtra uma categoria. */

import {
  el, monthMatrix, parseKey, todayKey, addDays, MONTHS, WD, nf, keyOf,
  weekLabels, weekOfKey, humanDay, longDay,
} from '../utils.js';
import * as store from '../store.js';
import { num, did, isReduce, loggedDays } from '../analysis.js';
import { stagger, onSwipe, openSheet, toast } from '../ui.js';
import { iconBtn, control, fmtH } from './today.js';

export function render(ctx) {
  const modo = ctx.monthMode === 'semana' ? 'semana' : 'mes';
  const view = el('div.view');

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '02 — CALENDÁRIO' }),
      el('h2.display.h-lg', { id: 'calTitle' }),
    ]),
    el('div.vhead__r', {}, [
      el('div.seg', {}, [
        el('button.seg__b' + (modo === 'semana' ? '.is-on' : ''), {
          type: 'button', onclick: () => { ctx.monthMode = 'semana'; ctx.rerender(); }, text: 'Semana',
        }),
        el('button.seg__b' + (modo === 'mes' ? '.is-on' : ''), {
          type: 'button', onclick: () => { ctx.monthMode = 'mes'; ctx.rerender(); }, text: 'Mês',
        }),
      ]),
    ]),
  ]));

  (modo === 'semana' ? renderWeek : renderMonth)(view, ctx);
  return view;
}

/* ══ SEMANA — preenchimento em lote ═════════════════════════ */
function renderWeek(view, ctx) {
  const weekStart = store.state.settings.weekStart ?? 1;
  const anchor = ctx.weekAnchor || todayKey();
  const dias = weekOfKey(anchor, weekStart);
  const cats = store.activeCategories();
  const hoje = todayKey();

  view.querySelector('#calTitle').textContent = rotuloSemana(dias);

  view.append(el('div.wrap', { style: { justifyContent: 'space-between', marginBottom: '1rem' } }, [
    el('div.daynav', {}, [
      iconBtn('M15 6l-6 6 6 6', () => { ctx.weekAnchor = addDays(anchor, -7); ctx.rerender(); }, 'Semana anterior'),
      el('span.daynav__label', { text: dias[0] > addDays(hoje, -7) ? 'esta semana' : 'semana' }),
      iconBtn('M9 6l6 6-6 6', () => { ctx.weekAnchor = addDays(anchor, 7); ctx.rerender(); }, 'Próxima semana'),
    ]),
    dias.some(d => d !== hoje)
      ? el('button.chip', { onclick: () => { ctx.weekAnchor = hoje; ctx.rerender(); }, text: 'semana atual' })
      : null,
  ]));

  if (!cats.length) {
    view.append(el('div.empty', {}, [el('b', { text: 'Sem categorias ativas' })]));
    return;
  }

  /* cabeçalho de colunas */
  const table = el('div.batch', { style: { '--cols': String(cats.length) } });
  const head = el('div.batch__row.batch__row--head');
  head.append(el('div.batch__day', {}, [el('span.micro', { text: 'DIA' })]));
  cats.forEach(c => head.append(el('div.batch__cell', {}, [
    el('span.batch__h', { title: c.label, text: c.emoji || '•' }),
  ])));
  head.append(el('div.batch__cell', {}, [el('span.micro', { text: 'FIM' })]));
  table.append(head);

  for (const k of dias) {
    const d = parseKey(k);
    const futuro = k > hoje;
    const rec = store.getDay(k);
    const row = el('div.batch__row' + (futuro ? '.is-future' : '') + (k === hoje ? '.is-today' : ''));

    row.append(el('button.batch__day', {
      type: 'button', title: `Abrir ${longDay(k)}`,
      onclick: () => { ctx.setDay(k); ctx.go('hoje'); },
    }, [
      el('span.batch__wd', { text: WD[d.getDay()] }),
      el('span.batch__n.num', { text: String(d.getDate()) }),
      store.hasEntry(k) ? el('span.batch__dot') : null,
    ]));

    for (const cat of cats) {
      row.append(batchCell(cat, k, futuro, ctx));
    }

    const fechar = el('button.batch__cell.batch__close' + (rec?.closed ? '.is-on' : ''), {
      type: 'button', 'aria-label': `Fechar ${humanDay(k)}`, title: 'Marcar o dia como respondido',
      disabled: futuro || null,
      onclick: e => {
        const next = !store.getDay(k)?.closed;
        store.closeDay(k, next);
        e.currentTarget.classList.toggle('is-on', next);
      },
    }, ['✓']);
    row.append(fechar);
    table.append(row);
  }

  view.append(el('div.batchwrap', {}, [el('div.batch__scroll', {}, [table])]));
  view.append(el('p.micro', {
    style: { marginTop: '.9rem', lineHeight: '1.8' },
    html: 'UM TOQUE NA CÉLULA ALTERNA O VALOR · HORAS E TEXTO ABREM O CONTROLE<br>TOQUE NO DIA PARA O CHECK-IN COMPLETO',
  }));

  /* resumo */
  const registrados = dias.filter(k => store.hasEntry(k)).length;
  view.append(el('div.stats', { style: { marginTop: '1.4rem' } }, [
    stat(registrados, `de 7 dias registrados`),
    ...cats.slice(0, 3).map(c => stat(
      c.type === 'toggle' ? dias.filter(k => did(c, k)).length : nf(dias.reduce((a, k) => a + num(c, k), 0), 1),
      `${c.label.toLowerCase()} na semana`)),
  ]));

  stagger(view, '.batch__row', 8);
  onSwipe(view, {
    left: () => { ctx.weekAnchor = addDays(anchor, 7); ctx.rerender(); },
    right: () => { ctx.weekAnchor = addDays(anchor, -7); ctx.rerender(); },
  });
}

/** Uma célula da grade: toque alterna; horas e texto abrem o controle cheio. */
function batchCell(cat, k, futuro, ctx) {
  const cell = el('button.batch__cell', {
    type: 'button',
    disabled: futuro || null,
    title: `${cat.label} · ${humanDay(k)}`,
    'aria-label': `${cat.label} em ${humanDay(k)}`,
  });
  const pinta = () => {
    const v = store.getVal(k, cat.id);
    const cheio = cat.type === 'toggle' ? !!v : Number(v) > 0 || (cat.type === 'text' && !!v);
    cell.classList.toggle('is-on', !!cheio);
    cell.classList.toggle('is-reduce', isReduce(cat) && !!cheio);
    cell.textContent = !cheio ? ''
      : cat.type === 'toggle' ? '✓'
      : cat.type === 'text' ? '✎'
      : cat.type === 'hours' ? fmtH(Number(v))
      : String(v);
  };
  pinta();

  cell.addEventListener('click', () => {
    if (cat.type === 'hours' || cat.type === 'text') {
      openSheet(`${cat.emoji || '•'} ${cat.label} · ${humanDay(k)}`, () => [
        control(cat, k, null, { ...ctx, softRefresh: pinta }),
        el('p.micro', { text: 'FECHA SOZINHO — O VALOR JÁ ESTÁ SALVO' }),
      ]);
      return;
    }
    const v = store.getVal(k, cat.id);
    let next;
    if (cat.type === 'toggle') next = !v;
    else if (cat.type === 'scale') next = (Number(v) || 0) >= 5 ? 0 : (Number(v) || 0) + 1;
    else next = (Number(v) || 0) >= 3 ? 0 : (Number(v) || 0) + 1;   // contagem: 0→1→2→3→0
    store.setVal(k, cat.id, next);
    pinta();
  });
  return cell;
}

function rotuloSemana(dias) {
  const a = parseKey(dias[0]), b = parseKey(dias[6]);
  const mesA = MONTHS[a.getMonth()].slice(0, 3).toUpperCase();
  const mesB = MONTHS[b.getMonth()].slice(0, 3).toUpperCase();
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${mesA}`
    : `${a.getDate()} ${mesA} – ${b.getDate()} ${mesB}`;
}

/* ══ MÊS ════════════════════════════════════════════════════ */
function renderMonth(view, ctx) {
  const weekStart = store.state.settings.weekStart ?? 1;
  const cur = parseKey(ctx.day);
  const year = ctx.monthY ?? cur.getFullYear();
  const month = ctx.monthM ?? cur.getMonth();
  const cats = store.activeCategories().filter(c => c.type !== 'text');
  const filter = ctx.monthFilter && cats.find(c => c.id === ctx.monthFilter) ? ctx.monthFilter : null;

  view.querySelector('#calTitle').textContent = `${MONTHS[month].toUpperCase()} ${year}`;

  const shift = n => {
    const d = new Date(year, month + n, 1);
    ctx.monthY = d.getFullYear(); ctx.monthM = d.getMonth();
    ctx.rerender();
  };

  view.append(el('div.wrap', { style: { justifyContent: 'space-between', marginBottom: '1rem' } }, [
    el('div.chips', {}, [
      el('button.chip' + (!filter ? '.is-on' : ''), { onclick: () => { ctx.monthFilter = null; ctx.rerender(); }, text: 'todas' }),
      ...cats.map(c => el('button.chip' + (filter === c.id ? '.is-on' : ''), {
        onclick: () => { ctx.monthFilter = c.id; ctx.rerender(); },
        text: `${c.emoji} ${c.label}`,
      })),
    ]),
    el('div.daynav', {}, [
      iconBtn('M15 6l-6 6 6 6', () => shift(-1), 'Mês anterior'),
      iconBtn('M9 6l6 6-6 6', () => shift(1), 'Próximo mês'),
    ]),
  ]));

  const head = el('div.cal__head', {}, weekLabels(weekStart).map(w => el('span', { text: w })));
  const grid = el('div.cal');
  const all = monthMatrix(year, month, weekStart);
  const weeks = [0, 1, 2, 3, 4, 5].map(w => all.slice(w * 7, w * 7 + 7)).filter(w => w.some(d => !d.out));
  const cells = weeks.flat();
  const fCat = filter ? cats.find(c => c.id === filter) : null;
  const maxVal = fCat ? Math.max(1, ...cells.map(c => num(fCat, c.key))) : 1;

  for (const c of cells) {
    const rec = store.getDay(c.key);
    const cell = el('button.cal__day' + (c.out ? '.is-out' : '') + (store.hasEntry(c.key) ? '.has-data' : ''), {
      type: 'button',
      'aria-label': longDay(c.key),
      onclick: () => { ctx.setDay(c.key); ctx.go('hoje'); },
    });
    if (c.key === todayKey()) cell.classList.add('is-today');
    if (c.key === ctx.day) cell.classList.add('is-sel');
    cell.append(el('span.cal__n', { text: String(c.day) }));

    if (fCat) {
      const v = num(fCat, c.key);
      if (v > 0) {
        cell.style.isolation = 'isolate';
        cell.append(el('span', {
          style: {
            position: 'absolute', inset: '0', background: 'var(--accent)',
            opacity: String(0.18 + 0.72 * (v / maxVal)), zIndex: '-1',
          },
        }));
        if (fCat.type !== 'toggle') {
          cell.append(el('span.num', { style: { fontSize: '10px', opacity: '.9' }, text: nf(v, v % 1 ? 1 : 0) }));
        }
      }
    } else {
      const dots = el('div.cal__dots');
      cats.forEach(cat => {
        if (!did(cat, c.key)) return;
        dots.append(el('span.dot', {
          title: cat.label,
          style: { opacity: String(isReduce(cat) ? 0.45 : 0.95), borderRadius: isReduce(cat) ? '1px' : '50%' },
        }));
      });
      if (rec?.closed) dots.append(el('span.dot', { style: { background: 'var(--accent)' }, title: 'dia fechado' }));
      cell.append(dots);
    }
    grid.append(cell);
  }
  view.append(head, grid);

  const monthKeys = cells.filter(c => !c.out).map(c => c.key);
  view.append(el('div.stats', { style: { marginTop: '1.4rem' } }, [
    stat(loggedDays(monthKeys), `dias registrados de ${monthKeys.length}`),
    ...(fCat
      ? [
          stat(nf(monthKeys.reduce((a, k) => a + num(fCat, k), 0), fCat.type === 'hours' ? 1 : 0), `total · ${fCat.label.toLowerCase()}`),
          stat(monthKeys.filter(k => did(fCat, k)).length, `dias com ${fCat.label.toLowerCase()}`),
        ]
      : cats.slice(0, 3).map(c => stat(monthKeys.filter(k => did(c, k)).length, `dias · ${c.label.toLowerCase()}`))),
  ]));

  if (!fCat) {
    view.append(el('div.legend', {}, cats.map(c =>
      el('span.legend__i', {}, [
        el('span.dot', { style: { opacity: isReduce(c) ? '.45' : '.95', borderRadius: isReduce(c) ? '1px' : '50%' } }),
        `${c.emoji} ${c.label}`,
      ]))));
  }

  stagger(grid, '.cal__day', 41, 9);
  onSwipe(view, { left: () => shift(1), right: () => shift(-1) });
}

const stat = (n, label) => el('div.stat', {}, [
  el('span.stat__n', { text: String(n) }),
  el('p.micro.stat__l', { text: label }),
]);

export { keyOf };
