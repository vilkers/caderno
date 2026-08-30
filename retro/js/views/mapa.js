/* views/mapa.js — MAPA DO MUNDO: a semana como fases numeradas, e a grade
   de preenchimento em lote logo abaixo (vertical, sem arrastar pro lado). */

import { el, todayKey, addDays, parseKey, weekOfKey, longDay, humanDay, WD, nf, MONTHS } from '../../../js/utils.js';
import * as store from '../../../js/store.js';
import { goalProgress, isReduce, did, num } from '../../../js/analysis.js';
import * as sfx from '../sfx.js';
import { sprite } from '../sprites.js';
import { aviso } from '../ui.js';
import { abrirControle } from './fase.js';

export function render(ctx) {
  const inicioSemana = store.state.settings.weekStart ?? 1;
  const ancora = ctx.weekAnchor || todayKey();
  const dias = weekOfKey(ancora, inicioSemana);
  const cats = store.activeCategories();
  const hoje = todayKey();
  const tela = el('div.tela');

  const a = parseKey(dias[0]), b = parseKey(dias[6]);
  const rotulo = a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()].slice(0, 3).toUpperCase()}`
    : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3).toUpperCase()} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3).toUpperCase()}`;

  tela.append(el('div.titulo', {}, [
    el('h2.t16.sombra', { text: rotulo }),
    el('div.linha', {}, [
      el('button.btn.btn--peq', {
        type: 'button', text: '◀ SEMANA',
        onclick: () => { sfx.passo(); ctx.weekAnchor = addDays(ancora, -7); ctx.rerender(); },
      }),
      !(dias[0] <= hoje && hoje <= dias[6])
        ? el('button.btn.btn--peq', {
            type: 'button', text: 'ATUAL',
            onclick: () => { sfx.passo(); ctx.weekAnchor = hoje; ctx.rerender(); },
          })
        : null,
      el('button.btn.btn--peq', {
        type: 'button', text: 'SEMANA ▶',
        onclick: () => { sfx.passo(); ctx.weekAnchor = addDays(ancora, 7); ctx.rerender(); },
      }),
    ]),
  ]));

  /* mapa: um nó por dia */
  const mapa = el('div.mapa');
  dias.forEach((k, i) => {
    const d = parseKey(k);
    const rec = store.getDay(k);
    const no = el('button.no' + (k === hoje ? '.hoje' : '') + (k > hoje ? '.futuro' : ''), {
      type: 'button', title: longDay(k), disabled: k > hoje || null,
      onclick: () => { sfx.pulo(); ctx.setDay(k); ctx.go('fase'); },
    }, [
      el('span.no__d', { text: WD[d.getDay()].toUpperCase() }),
      sprite(rec?.closed ? 'bandeira' : store.hasEntry(k) ? 'batido' : 'bloco', { scale: 2 }),
      el('span.no__n', { text: `${i + 1}-${d.getDate()}` }),
    ]);
    mapa.append(no);
  });
  tela.append(mapa);

  if (!cats.length) {
    tela.append(el('div.vazio', {}, [el('p.t10', { text: 'SEM CATEGORIAS' })]));
    return tela;
  }

  /* grade: uma faixa por categoria, sete colunas fixas */
  tela.append(el('p.t8', { style: { marginBottom: '8px', color: 'var(--tinta2)' },
    text: 'PREENCHER EM LOTE — UM TOQUE POR CÉLULA' }));

  const cabeca = el('div.grade__cels', { style: { marginBottom: '8px', padding: '0 8px' } });
  dias.forEach(k => {
    const d = parseKey(k);
    cabeca.append(el('div', { class: 't8', style: { textAlign: 'center', color: 'var(--tinta2)' },
      text: `${WD[d.getDay()][0].toUpperCase()}${d.getDate()}` }));
  });
  tela.append(cabeca);

  const grade = el('div.grade');
  for (const cat of cats) {
    const gp = goalProgress(cat, dias[6]);
    const faixa = el('div.grade__l');
    faixa.append(el('div.grade__c', {}, [
      el('span.grade__nome', { text: `${cat.emoji || ''} ${cat.label}`.trim() }),
      gp ? el('span.grade__meta', {
        style: { color: gp.ok ? 'var(--verdeTxt)' : '' },
        text: `${nf(gp.done, gp.done % 1 ? 1 : 0)}/${gp.value}`,
      }) : null,
    ]));
    const cels = el('div.grade__cels');
    dias.forEach(k => cels.append(celula(cat, k, k > hoje, ctx)));
    faixa.append(cels);
    grade.append(faixa);
  }

  /* fechar o dia */
  const fim = el('div.grade__l');
  fim.append(el('div.grade__c', {}, [el('span.grade__nome', { text: '🚩 Fechar o dia' })]));
  const celsF = el('div.grade__cels');
  dias.forEach(k => {
    const bt = el('button.cel' + (store.getDay(k)?.closed ? '.on' : ''), {
      type: 'button', disabled: k > hoje || null, 'aria-label': `Fechar ${humanDay(k)}`, text: '✓',
    });
    bt.addEventListener('click', () => {
      const novo = !store.getDay(k)?.closed;
      store.closeDay(k, novo);
      bt.classList.toggle('on', novo);
      novo ? sfx.fase() : sfx.bump();
    });
    celsF.append(bt);
  });
  fim.append(celsF);
  grade.append(fim);
  tela.append(grade);

  /* resumo */
  const registrados = dias.filter(k => store.hasEntry(k)).length;
  tela.append(el('div.placar', { style: { marginTop: '16px' } }, [
    linhaPlacar('DIAS NA SEMANA', `${registrados}/7`),
    ...cats.slice(0, 3).map(c => linhaPlacar(
      c.label.toUpperCase(),
      c.type === 'toggle' ? `${dias.filter(k => did(c, k)).length}/7`
        : nf(dias.reduce((s, k) => s + num(c, k), 0), 1))),
  ]));

  return tela;
}

function celula(cat, k, futuro, ctx) {
  const bt = el('button.cel', { type: 'button', disabled: futuro || null,
    title: `${cat.label} · ${humanDay(k)}` });
  const pinta = () => {
    const v = store.getVal(k, cat.id);
    const cheio = cat.type === 'toggle' ? !!v : (Number(v) > 0 || v === 0 || (cat.type === 'text' && !!v));
    bt.classList.toggle('on', !!cheio);
    bt.classList.toggle('reduz', isReduce(cat) && !!cheio);
    bt.classList.toggle('zero', v === 0);
    bt.textContent = !cheio ? '' : v === 0 ? '0'
      : cat.type === 'toggle' ? '✓'
      : cat.type === 'text' ? '✎'
      : String(v).replace('.', ',');
  };
  pinta();

  const longa = cat.type === 'hours' || cat.type === 'text'
    || (cat.type === 'scale' && store.scaleMax(cat) - store.scaleMin(cat) > 5);

  bt.addEventListener('click', () => {
    if (longa) { abrirControle(cat, k, pinta, ctx); return; }
    const v = store.getVal(k, cat.id);
    const teto = cat.type === 'scale' ? store.scaleMax(cat) : 3;
    const novo = cat.type === 'toggle' ? !v : ((Number(v) || 0) >= teto ? 0 : (Number(v) || 0) + 1);
    store.setVal(k, cat.id, novo);
    pinta();
    novo ? sfx.moeda() : sfx.bump();
  });
  return bt;
}

const linhaPlacar = (rot, val) =>
  el('div.placar__l', {}, [el('span', { text: rot }), el('b', { text: String(val) })]);
