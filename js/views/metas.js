/* views/metas.js — o painel de metas.

   Entrar em nove categorias pra ajustar nove metas é trabalho demais pra
   uma decisão que se toma junta ("essa semana quero X de academia e no
   máximo Y de bebida"). Aqui tudo está numa tela só: cadência, modo, valor
   e período, com o quanto já foi feito nesta semana ao lado. */

import { el, nf } from '../utils.js';
import * as store from '../store.js';
import { CADENCIAS } from '../store.js';
import { weekGoals, goalProgress } from '../analysis.js';
import { toast } from '../ui.js';

const SITUACAO = {
  batida: { txt: 'batida', cor: '#3ecf8e' },
  'no ritmo': { txt: 'no ritmo', cor: '' },
  apertado: { txt: 'apertado', cor: 'var(--accent)' },
  estourou: { txt: 'estourou', cor: 'var(--accent)' },
};

export function render(ctx) {
  const view = el('div.view');
  const cats = store.activeCategories();

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '04 — METAS' }),
      el('h2.display.h-lg', { text: 'METAS' }),
    ]),
    el('div.vhead__r', {}, [
      el('button.btn.btn--sm', { type: 'button', onclick: () => ctx.voltar(), text: '← voltar' }),
    ]),
  ]));

  /* resumo da semana */
  const semana = weekGoals();
  if (semana.length) {
    const abertas = semana.filter(m => m.situacao !== 'batida').length;
    view.append(el('div.status' + (abertas ? '' : '.is-ok'), { style: { marginBottom: '1.4rem' } }, [
      el('div.status__topo', {}, [
        el('div', {}, [
          el('p.micro', { text: 'ESTA SEMANA' }),
          el('p.status__t', {
            text: abertas
              ? `${abertas} meta(s) em aberto, ${semana.length - abertas} batida(s)`
              : 'Semana fechada — todas as metas batidas',
          }),
        ]),
      ]),
    ]));
  }

  if (!cats.length) {
    view.append(el('div.empty', {}, [el('b', { text: 'Sem categorias ativas' })]));
    return view;
  }

  const lista = el('div.metas');
  cats.forEach(cat => lista.append(linhaMeta(cat, ctx)));
  view.append(lista);

  view.append(el('p.micro', {
    style: { marginTop: '1.4rem', lineHeight: '1.9' },
    html: 'CADÊNCIA DIZ O QUE O DIA COBRA DE VOCÊ:<br>' +
          Object.entries(CADENCIAS).map(([k, v]) => `<b>${v.label.toUpperCase()}</b> — ${v.hint}`).join('<br>'),
  }));

  return view;
}

/* ── Uma linha: cadência + meta + progresso ────────────────── */
function linhaMeta(cat, ctx) {
  const linha = el('div.meta');
  const cad = store.cadencia(cat);

  const progresso = el('div.meta__prog');
  const pintaProgresso = () => {
    const gp = goalProgress(cat);
    progresso.replaceChildren();
    if (!gp) {
      progresso.append(el('span.micro', { text: 'SEM META' }));
      return;
    }
    const info = weekGoals().find(m => m.cat.id === cat.id);
    const sit = info ? SITUACAO[info.situacao] : null;
    progresso.append(el('span.meta__v', {
      style: { color: sit?.cor || '' },
      text: `${nf(gp.done, gp.done % 1 ? 1 : 0)}/${nf(gp.value)}`,
    }));
    progresso.append(el('span.micro', {
      style: { color: sit?.cor || '' },
      text: gp.period === 'week' ? (sit ? sit.txt.toUpperCase() : 'NA SEMANA') : 'HOJE',
    }));
  };

  /* cadência */
  const cadSel = el('select.minisel', {}, Object.entries(CADENCIAS).map(([k, v]) =>
    el('option', { value: k, text: v.label, selected: cad === k ? true : null })));
  cadSel.addEventListener('change', () => {
    store.updateCategory(cat.id, { cadence: cadSel.value });
    toast(`${cat.label}: ${CADENCIAS[cadSel.value].label.toLowerCase()}`);
    ctx.rerender();
  });

  /* meta */
  const temMeta = el('input', { type: 'checkbox', 'aria-label': `Meta para ${cat.label}` });
  temMeta.checked = !!cat.goal;
  const modo = el('select.minisel', {}, [
    el('option', { value: 'min', text: 'no mínimo', selected: cat.goal?.mode !== 'max' ? true : null }),
    el('option', { value: 'max', text: 'no máximo', selected: cat.goal?.mode === 'max' ? true : null }),
  ]);
  const valor = el('input.meta__num', { type: 'number', min: '0', step: '0.5', value: String(cat.goal?.value ?? 3) });
  const periodo = el('select.minisel', {}, [
    el('option', { value: 'week', text: 'por semana', selected: cat.goal?.period !== 'day' ? true : null }),
    el('option', { value: 'day', text: 'por dia', selected: cat.goal?.period === 'day' ? true : null }),
  ]);

  const salvar = () => {
    store.updateCategory(cat.id, {
      goal: temMeta.checked
        ? { mode: modo.value, value: Number(valor.value) || 0, period: periodo.value }
        : null,
    });
    campos.forEach(c => { c.disabled = !temMeta.checked; });
    linha.classList.toggle('sem-meta', !temMeta.checked);
    pintaProgresso();
    toast('meta salva');
  };
  const campos = [modo, valor, periodo];
  campos.forEach(c => { c.disabled = !temMeta.checked; c.addEventListener('change', salvar); });
  temMeta.addEventListener('change', salvar);

  linha.classList.toggle('sem-meta', !cat.goal);
  linha.append(
    el('div.meta__cab', {}, [
      el('span.meta__e', { text: cat.emoji || '•' }),
      el('span.meta__n', { text: cat.label }),
      progresso,
    ]),
    el('div.meta__ctl', {}, [
      el('label.meta__cad', {}, [el('span.micro', { text: 'COBRA' }), cadSel]),
      el('label.meta__on', {}, [temMeta, el('span.micro', { text: 'META' })]),
      el('div.meta__campos', {}, [modo, valor, periodo]),
    ]),
  );
  pintaProgresso();
  return linha;
}
