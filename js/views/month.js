/* views/month.js — o mês inteiro numa grade. Sem filtro, cada dia
   mostra um quadradinho por categoria (mesma ordem sempre);
   com filtro, vira mapa de calor de uma categoria só. */

import { el, monthMatrix, parseKey, todayKey, MONTHS, WD, nf, keyOf } from '../utils.js';
import * as store from '../store.js';
import { num, did, isReduce, loggedDays } from '../analysis.js';
import { stagger, onSwipe } from '../ui.js';
import { iconBtn } from './today.js';

export function render(ctx) {
  const view = el('div.view');
  const cur = parseKey(ctx.day);
  let year = ctx.monthY ?? cur.getFullYear();
  let month = ctx.monthM ?? cur.getMonth();
  const cats = store.activeCategories().filter(c => c.type !== 'text');
  const filter = ctx.monthFilter && cats.find(c => c.id === ctx.monthFilter) ? ctx.monthFilter : null;

  const title = el('h2.display.h-lg', { text: `${MONTHS[month].toUpperCase()} ${year}` });
  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [el('p.micro', { text: '02 — MÊS' }), title]),
    el('div.vhead__r', {}, [
      iconBtn('M15 6l-6 6 6 6', () => shift(-1), 'Mês anterior'),
      iconBtn('M9 6l6 6-6 6', () => shift(1), 'Próximo mês'),
    ]),
  ]));

  function shift(n) {
    const d = new Date(year, month + n, 1);
    ctx.monthY = d.getFullYear(); ctx.monthM = d.getMonth();
    ctx.rerender();
  }

  /* filtro por categoria */
  const chips = el('div.chips', { style: { marginBottom: '1rem' } }, [
    el('button.chip' + (!filter ? '.is-on' : ''), { onclick: () => { ctx.monthFilter = null; ctx.rerender(); }, text: 'todas' }),
    ...cats.map(c => el('button.chip' + (filter === c.id ? '.is-on' : ''), {
      onclick: () => { ctx.monthFilter = c.id; ctx.rerender(); },
      text: `${c.emoji} ${c.label}`,
    })),
  ]);
  view.append(chips);

  /* grade */
  const head = el('div.cal__head', {}, WD.map(w => el('span', { text: w })));
  const grid = el('div.cal');
  const all = monthMatrix(year, month);
  const weeks = [0, 1, 2, 3, 4, 5].map(w => all.slice(w * 7, w * 7 + 7)).filter(w => w.some(d => !d.out));
  const cells = weeks.flat();
  const fCat = filter ? cats.find(c => c.id === filter) : null;
  const maxVal = fCat ? Math.max(1, ...cells.map(c => num(fCat, c.key))) : 1;

  for (const c of cells) {
    const rec = store.getDay(c.key);
    const cell = el('button.cal__day' + (c.out ? '.is-out' : '') + (rec ? '.has-data' : ''), {
      type: 'button',
      'aria-label': c.key,
      onclick: () => { ctx.setDay(c.key); ctx.go('hoje'); },
    });
    if (c.key === todayKey()) cell.classList.add('is-today');
    if (c.key === ctx.day) cell.classList.add('is-sel');
    cell.append(el('span.cal__n', { text: String(c.day) }));

    if (fCat) {
      const v = num(fCat, c.key);
      const p = v / maxVal;
      if (v > 0) {
        cell.append(el('span', {
          style: {
            position: 'absolute', inset: '0', background: 'var(--accent)',
            opacity: String(0.18 + 0.72 * p), zIndex: '-1',
          },
        }));
        cell.style.isolation = 'isolate';
        if (fCat.type !== 'toggle') {
          cell.append(el('span.num', { style: { fontSize: '10px', opacity: '.9' }, text: nf(v, v % 1 ? 1 : 0) }));
        }
      }
    } else {
      const dots = el('div.cal__dots');
      cats.forEach((cat, i) => {
        const on = did(cat, c.key);
        if (!on) return;
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

  /* legenda / resumo do mês */
  const monthKeys = cells.filter(c => !c.out).map(c => c.key);
  const registrados = loggedDays(monthKeys);
  const resumo = el('div.stats', { style: { marginTop: '1.4rem' } }, [
    stat(registrados, `dias registrados de ${monthKeys.length}`),
    ...(fCat
      ? [
          stat(nf(monthKeys.reduce((a, k) => a + num(fCat, k), 0), fCat.type === 'hours' ? 1 : 0),
            `total · ${fCat.label.toLowerCase()}`),
          stat(monthKeys.filter(k => did(fCat, k)).length, `dias com ${fCat.label.toLowerCase()}`),
        ]
      : cats.slice(0, 3).map(c => stat(monthKeys.filter(k => did(c, k)).length, `dias · ${c.label.toLowerCase()}`))),
  ]);
  view.append(resumo);

  if (!fCat) {
    view.append(el('div.legend', {}, cats.map(c =>
      el('span.legend__i', {}, [
        el('span.dot', { style: { opacity: isReduce(c) ? '.45' : '.95', borderRadius: isReduce(c) ? '1px' : '50%' } }),
        `${c.emoji} ${c.label}`,
      ]))));
  }

  stagger(grid, '.cal__day', 41, 9);
  onSwipe(view, { left: () => shift(1), right: () => shift(-1) });
  return view;
}

const stat = (n, label) => el('div.stat', {}, [
  el('span.stat__n', { text: String(n) }),
  el('p.micro.stat__l', { text: label }),
]);

export { keyOf };
