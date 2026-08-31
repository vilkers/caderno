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
import { num, did, isReduce, loggedDays, goalProgress, dayStatus } from '../analysis.js';
import { anel, colunas, linha, tomDoDia } from '../graficos.js';
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

  /* navegação só por botão: nada de gesto lateral brigando com a rolagem */
  view.append(el('div.wrap', { style: { justifyContent: 'space-between', marginBottom: '1rem' } }, [
    el('div.daynav', {}, [
      iconBtn('M15 6l-6 6 6 6', () => { ctx.weekAnchor = addDays(anchor, -7); ctx.rerender(); }, 'Semana anterior'),
      el('span.daynav__label', { text: dias[0] <= hoje && hoje <= dias[6] ? 'esta semana' : 'semana' }),
      iconBtn('M9 6l6 6-6 6', () => { ctx.weekAnchor = addDays(anchor, 7); ctx.rerender(); }, 'Próxima semana'),
    ]),
    !(dias[0] <= hoje && hoje <= dias[6])
      ? el('button.chip', { onclick: () => { ctx.weekAnchor = hoje; ctx.rerender(); }, text: 'semana atual' })
      : null,
  ]));

  if (!cats.length) {
    view.append(el('div.empty', {}, [el('b', { text: 'Sem categorias ativas' })]));
    return;
  }

  /* cabeçalho dos sete dias, grudado no topo enquanto a lista rola */
  const cabecalho = el('div.wgrid__head');
  for (const k of dias) {
    const d = parseKey(k);
    cabecalho.append(el('button.wgrid__day' + (k === hoje ? '.is-today' : '') + (k > hoje ? '.is-future' : ''), {
      type: 'button', title: `Abrir ${longDay(k)}`,
      onclick: () => { ctx.setDay(k); ctx.go('hoje'); },
    }, [
      el('span.wgrid__wd', { text: WD[d.getDay()] }),
      el('span.wgrid__n.num', { text: String(d.getDate()) }),
      el('span.wgrid__dot' + (store.getDay(k)?.closed ? '.is-closed' : store.hasEntry(k) ? '.is-filled' : '')),
    ]));
  }
  view.append(cabecalho);

  /* uma faixa por categoria — a página rola pra baixo, nunca pro lado */
  const lista = el('div.wgrid');
  for (const cat of cats) {
    const gp = goalProgress(cat, dias[6]);
    const faixa = el('div.wgrid__row');
    faixa.append(el('div.wgrid__cat', {}, [
      el('span.wgrid__emoji', { text: cat.emoji || '•' }),
      el('span.wgrid__label', { text: cat.label }),
      gp ? el('span.wgrid__goal', {
        style: { color: gp.ok ? 'var(--accent)' : '' },
        text: `${nf(gp.done, gp.done % 1 ? 1 : 0)}/${gp.value}`,
      }) : null,
    ]));
    const cels = el('div.wgrid__cells');
    for (const k of dias) cels.append(batchCell(cat, k, k > hoje, ctx));
    faixa.append(cels);
    lista.append(faixa);
  }

  /* fechar o dia, na mesma malha de sete colunas */
  const fechar = el('div.wgrid__row.wgrid__row--close');
  fechar.append(el('div.wgrid__cat', {}, [
    el('span.wgrid__emoji', { text: '✓' }),
    el('span.wgrid__label', { text: 'Fechar o dia' }),
  ]));
  const celsF = el('div.wgrid__cells');
  for (const k of dias) {
    const futuro = k > hoje;
    celsF.append(el('button.batch__cell.batch__close' + (store.getDay(k)?.closed ? '.is-on' : ''), {
      type: 'button', 'aria-label': `Fechar ${humanDay(k)}`, title: 'Marcar o dia como respondido',
      disabled: futuro || null,
      onclick: e => {
        const next = !store.getDay(k)?.closed;
        store.closeDay(k, next);
        e.currentTarget.classList.toggle('is-on', next);
        cabecalho.querySelectorAll('.wgrid__dot')[dias.indexOf(k)]
          ?.classList.toggle('is-closed', next);
      },
    }, ['✓']));
  }
  fechar.append(celsF);
  lista.append(fechar);
  view.append(lista);

  view.append(el('p.micro', {
    style: { marginTop: '.9rem', lineHeight: '1.8' },
    html: 'UM TOQUE NA CÉLULA ALTERNA O VALOR · HORAS, TEXTO E ESCALA LONGA ABREM O CONTROLE<br>TOQUE NO DIA LÁ EM CIMA PARA O CHECK-IN COMPLETO',
  }));

  /* resumo */
  const registrados = dias.filter(k => store.hasEntry(k)).length;
  view.append(el('div.stats', { style: { marginTop: '1.4rem' } }, [
    stat(registrados, `de 7 dias registrados`),
    ...cats.slice(0, 3).map(c => stat(
      c.type === 'toggle' ? dias.filter(k => did(c, k)).length : nf(dias.reduce((a, k) => a + num(c, k), 0), 1),
      `${c.label.toLowerCase()} na semana`)),
  ]));

  stagger(view, '.wgrid__row', 12);
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
    const cheio = cat.type === 'toggle' ? !!v : Number(v) > 0 || (cat.type === 'text' && !!v) || v === 0;
    cell.classList.toggle('is-on', !!cheio);
    cell.classList.toggle('is-reduce', isReduce(cat) && !!cheio);
    cell.classList.toggle('is-zero', v === 0);
    cell.textContent = !cheio ? ''
      : v === 0 ? '0'
      : cat.type === 'toggle' ? '✓'
      : cat.type === 'text' ? '✎'
      : cat.type === 'hours' ? fmtH(Number(v))
      : String(v);
  };
  pinta();

  const escalaLonga = cat.type === 'scale' && (store.scaleMax(cat) - store.scaleMin(cat)) > 5;
  cell.addEventListener('click', () => {
    if (cat.type === 'hours' || cat.type === 'text' || escalaLonga) {
      openSheet(`${cat.emoji || '•'} ${cat.label} · ${humanDay(k)}`, () => [
        control(cat, k, null, { ...ctx, softRefresh: pinta }),
        el('p.micro', { text: 'FECHA SOZINHO — O VALOR JÁ ESTÁ SALVO' }),
      ]);
      return;
    }
    const v = store.getVal(k, cat.id);
    const teto = cat.type === 'scale' ? store.scaleMax(cat) : 3;
    let next;
    if (cat.type === 'toggle') next = !v;
    else next = (Number(v) || 0) >= teto ? 0 : (Number(v) || 0) + 1;   // 0→1→…→teto→0
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
/* O ponto por categoria dizia pouco: dez bolinhas iguais não são leitura,
   são poeira. Agora cada dia carrega três informações, cada uma com uma
   forma própria:

     anel   — quanto do que era obrigatório naquele dia foi fechado;
     coluna — quantas marcações o dia teve (o volume, comparado ao mês);
     ponto  — tinha compromisso do mês caindo ali (conta, cartão, NF).

   Filtrando uma categoria, tudo isso dá lugar ao mapa de calor dela. */
function renderMonth(view, ctx) {
  const weekStart = store.state.settings.weekStart ?? 1;
  const cur = parseKey(ctx.day);
  const year = ctx.monthY ?? cur.getFullYear();
  const month = ctx.monthM ?? cur.getMonth();
  const cats = store.activeCategories().filter(c => c.type !== 'text');
  const filter = ctx.monthFilter && cats.find(c => c.id === ctx.monthFilter) ? ctx.monthFilter : null;
  const hoje = todayKey();

  view.querySelector('#calTitle').textContent = `${MONTHS[month].toUpperCase()} ${year}`;

  const shift = n => {
    const d = new Date(year, month + n, 1);
    ctx.monthY = d.getFullYear(); ctx.monthM = d.getMonth();
    ctx.rerender();
  };

  view.append(el('div.wrap', { style: { justifyContent: 'space-between', marginBottom: '1rem' } }, [
    el('div.chips', {}, [
      el('button.chip' + (!filter ? '.is-on' : ''), { onclick: () => { ctx.monthFilter = null; ctx.rerender(); }, text: 'o mês inteiro' }),
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
  const grid = el('div.cal' + (filter ? ' cal--calor' : ''));
  const all = monthMatrix(year, month, weekStart);
  const weeks = [0, 1, 2, 3, 4, 5].map(w => all.slice(w * 7, w * 7 + 7)).filter(w => w.some(d => !d.out));
  const cells = weeks.flat();
  const fCat = filter ? cats.find(c => c.id === filter) : null;
  const maxVal = fCat ? Math.max(1, ...cells.map(c => num(fCat, c.key))) : 1;
  const maxMarcas = Math.max(1, ...cells.map(c => Object.keys(store.getDay(c.key)?.v || {}).length));
  const mesChave = `${year}-${String(month + 1).padStart(2, '0')}`;
  const compromissos = store.agendaDoMes(mesChave);

  for (const c of cells) {
    const rec = store.getDay(c.key);
    const marcas = Object.keys(rec?.v || {}).length;
    const doDia = compromissos.filter(a => a.data === c.key);
    const st = fCat ? null : dayStatus(c.key);

    const cell = el('button.cal__day' + (c.out ? '.is-out' : '') + (store.hasEntry(c.key) ? '.has-data' : ''), {
      type: 'button',
      'aria-label': longDay(c.key),
      title: doDia.length ? doDia.map(a => a.label).join(' · ') : '',
      onclick: () => previaDoDia(c.key, ctx),
    });
    if (c.key === hoje) cell.classList.add('is-today');
    if (c.key === ctx.day) cell.classList.add('is-sel');
    if (c.key > hoje) cell.classList.add('is-futuro');

    if (fCat) {
      const v = num(fCat, c.key);
      if (v > 0) {
        cell.style.setProperty('--calor', String(0.16 + 0.74 * (v / maxVal)));
        cell.classList.add('is-quente');
      }
      cell.append(el('span.cal__n', { text: String(c.day) }));
      if (v > 0 && fCat.type !== 'toggle') {
        cell.append(el('span.cal__v.num', { text: nf(v, v % 1 ? 1 : 0) }));
      }
    } else {
      /* anel de cobrança do dia */
      if (st && st.total && !c.out) {
        cell.append(el('span.cal__anel', {
          style: { background: tomDoDia(st.pct ?? (st.feitas / st.total)) },
        }));
      }
      cell.append(el('span.cal__n', { text: String(c.day) }));
      /* coluna de volume */
      if (marcas) {
        cell.append(el('span.cal__vol', {
          style: { '--v': String(Math.max(0.14, marcas / maxMarcas)) },
          title: `${marcas} marcaç${marcas > 1 ? 'ões' : 'ão'}`,
        }));
      }
      if (rec?.closed) cell.classList.add('is-fechado');
      if (doDia.length) {
        cell.append(el('span.cal__ag' + (doDia.every(a => store.agendaFeito(a, mesChave)) ? '.is-ok' : ''), {
          text: doDia.length > 1 ? String(doDia.length) : '',
        }));
      }
    }
    grid.append(cell);
  }
  view.append(head, grid);
  view.append(legenda(fCat));

  /* ── o mês em gráfico ── */
  const monthKeys = cells.filter(c => !c.out).map(c => c.key);
  const passados = monthKeys.filter(k => k <= hoje);
  const porSemana = weeks.map(w => w.filter(d => !d.out && store.hasEntry(d.key)).length);

  view.append(el('div.mesgraf', {}, [
    el('div.mesgraf__l', {}, [
      el('p.micro', { text: 'DIAS REGISTRADOS, SEMANA A SEMANA' }),
      colunas(porSemana, {
        labels: weeks.map((_, i) => `S${i + 1}`),
        destaque: porSemana.indexOf(Math.max(...porSemana)),
        altura: 80, formato: v => (v ? String(v) : ''),
      }),
    ]),
    anel(passados.length ? loggedDays(monthKeys) / passados.length : 0, {
      tamanho: 96, espessura: 9,
      texto: loggedDays(monthKeys), sufixo: `de ${passados.length}`,
    }),
  ]));

  if (fCat) {
    const serie = monthKeys.map(k => num(fCat, k));
    if (serie.some(v => v > 0)) {
      view.append(el('div.mesgraf__linha', {}, [
        el('p.micro', { text: `${fCat.label.toUpperCase()} AO LONGO DO MÊS` }),
        linha(serie, { atraso: 200 }),
      ]));
    }
  }

  view.append(el('div.stats', { style: { marginTop: '1.2rem' } }, [
    ...(fCat
      ? [
          stat(nf(monthKeys.reduce((a, k) => a + num(fCat, k), 0), fCat.type === 'hours' ? 1 : 0), `total · ${fCat.label.toLowerCase()}`),
          stat(monthKeys.filter(k => did(fCat, k)).length, `dias com ${fCat.label.toLowerCase()}`),
          stat(monthKeys.filter(k => store.hasEntry(k) && !did(fCat, k)).length, 'dias sem'),
        ]
      : [
          stat(monthKeys.filter(k => store.getDay(k)?.closed).length, 'dias fechados'),
          stat(compromissos.length, 'compromissos do mês'),
          stat(compromissos.filter(a => store.agendaFeito(a, mesChave)).length, 'já resolvidos'),
        ]),
  ]));

  stagger(grid, '.cal__day', 41, 9);
  onSwipe(view, { left: () => shift(1), right: () => shift(-1) });
}

/* Legenda: sem ela as formas viram enfeite. */
function legenda(fCat) {
  if (fCat) {
    return el('div.legend', {}, [
      el('span.legend__i', {}, [el('span.legend__calor'), 'mais escuro = mais ' + fCat.label.toLowerCase()]),
    ]);
  }
  return el('div.legend', {}, [
    el('span.legend__i', {}, [el('span.legend__anel'), 'quanto do obrigatório do dia fechou']),
    el('span.legend__i', {}, [el('span.legend__vol'), 'quantas marcações teve']),
    el('span.legend__i', {}, [el('span.cal__ag', { style: { position: 'static' } }), 'compromisso do mês']),
  ]);
}

/* ── Prévia do dia ─────────────────────────────────────────── */
/* Tocar num dia abria o check-in direto e tirava você do mês. Agora abre
   uma prévia: dá pra ver, marcar o compromisso e só então entrar. */
function previaDoDia(k, ctx) {
  const cats = store.activeCategories();
  const mes = k.slice(0, 7);

  openSheet(longDay(k), close => {
    const rec = store.getDay(k);
    const st = dayStatus(k);
    const marcadas = cats.filter(c => store.respondida(c, k));
    const doDia = store.agendaDoMes(mes).filter(a => a.data === k);
    const corpo = [];

    corpo.push(el('div.previa__topo', {}, [
      anel(st.total ? st.pct : (marcadas.length ? 1 : 0), {
        tamanho: 76, espessura: 8,
        texto: marcadas.length, sufixo: 'marcadas',
      }),
      el('div', {}, [
        el('p.status__t', {
          text: rec?.closed ? 'Dia fechado'
            : !st.total ? (marcadas.length ? 'Registrado' : 'Sem registro')
            : st.ok ? 'Tudo em ordem' : `Faltou ${st.faltando.length} de ${st.total}`,
        }),
        st.faltando.length
          ? el('p.micro', { text: st.faltando.map(c => c.label).join(', ').toUpperCase() })
          : null,
      ]),
    ]));

    if (marcadas.length) {
      corpo.push(el('div.chips', { style: { marginTop: '.4rem' } }, marcadas.map(c => {
        const v = store.getVal(k, c.id);
        const txt = c.type === 'toggle' ? '' : c.type === 'hours' ? fmtH(Number(v)) : String(v);
        return el('span.chip.is-on', { text: `${c.emoji} ${c.label}${txt ? ` ${txt}` : ''}` });
      })));
    }

    if (rec?.note) corpo.push(el('p.previa__nota', { text: rec.note }));

    if (doDia.length) {
      corpo.push(el('p.micro', { style: { marginTop: '1rem' }, text: 'DO MÊS, NESTE DIA' }));
      const lista = el('div.agenda');
      doDia.forEach(item => {
        const feito = store.agendaFeito(item, mes);
        const linhaEl = el('div.agitem.agitem--curto' + (feito ? '.is-feito' : ''));
        linhaEl.append(...[
          el('button.agitem__check', {
            type: 'button', 'aria-pressed': String(feito), 'aria-label': `Marcar ${item.label}`,
            onclick: e => {
              store.marcarAgenda(item.id, mes, !feito);
              e.currentTarget.setAttribute('aria-pressed', String(!feito));
              e.currentTarget.firstChild.textContent = !feito ? '✓' : '';
              linhaEl.classList.toggle('is-feito', !feito);
              toast(feito ? 'desmarcado' : 'resolvido ✓');
            },
          }, [el('span', { text: feito ? '✓' : '' })]),
          el('span.agitem__t', {}, [
            el('span.agitem__e', { text: item.emoji || '•' }),
            el('span', { text: item.label }),
          ]),
        ].filter(Boolean));
        lista.append(linhaEl);
      });
      corpo.push(lista);
    }

    corpo.push(el('div.sheet__actions', {}, [
      el('button.btn', {
        type: 'button',
        onclick: () => { store.closeDay(k, !rec?.closed); toast(rec?.closed ? 'dia reaberto' : 'dia fechado'); close(); ctx.rerender(); },
      }, [el('span', { text: rec?.closed ? 'reabrir' : 'fechar o dia' })]),
      el('button.btn.btn--solid', {
        type: 'button',
        onclick: () => { close(); ctx.setDay(k); ctx.go('hoje'); },
      }, [el('span', { text: 'abrir o dia' })]),
    ]));
    return corpo;
  });
}

const stat = (n, label) => el('div.stat', {}, [
  el('span.stat__n', { text: String(n) }),
  el('p.micro.stat__l', { text: label }),
]);

export { keyOf };
