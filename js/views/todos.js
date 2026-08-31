/* views/todos.js — organização pessoal.

   Três coisas que não são rotina mas ocupam a cabeça no mesmo lugar:
   a lista de afazeres (essa sim conversa com o app inteiro), as assinaturas
   que debitam sozinhas todo mês, e o que você tem pra receber.

   Assinaturas e carteira são gestão pessoal, de propósito fora do XP e das
   metas: dinheiro não é hábito, e transformar conta em pontuação seria
   converter uma coisa chata numa coisa chata e barulhenta. */

import { el, humanDay, todayKey, monthKey, monthLabel, moeda, nf } from '../utils.js';
import * as store from '../store.js';
import { toast, stagger, confirmSheet } from '../ui.js';
import { listaArrastavel } from '../arrastar.js';
import { barras, barraProgresso } from '../graficos.js';
import { check } from './today.js';
import { editarCompromisso, sugestoesAgenda } from './agendaform.js';

const ABAS = [
  ['tarefas', 'Tarefas'],
  ['assinaturas', 'Assinaturas'],
  ['carteira', 'Carteira'],
];

export function render(ctx) {
  const aba = ABAS.some(([id]) => id === ctx.pessoalAba) ? ctx.pessoalAba : 'tarefas';
  const view = el('div.view');
  const abertas = store.listTodos().filter(t => !t.done).length;
  const mes = monthKey();
  const assinaturas = store.agendaDoMes(mes, { tipos: ['assinatura'] });
  const entradas = store.agendaDoMes(mes, { fluxo: 'entrada' });

  const resumo = {
    tarefas: abertas ? `${abertas} em aberto` : 'nada em aberto',
    assinaturas: assinaturas.length ? moeda(assinaturas.reduce((s, a) => s + (Number(a.valor) || 0), 0)) + '/mês' : 'vazio',
    carteira: entradas.length ? moeda(entradas.reduce((s, a) => s + (Number(a.valor) || 0), 0)) : 'vazio',
  };

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '03 — ORGANIZAÇÃO PESSOAL' }),
      el('h2.display.h-lg', { text: aba === 'tarefas' ? 'AFAZERES' : aba === 'assinaturas' ? 'ASSINATURAS' : 'CARTEIRA' }),
    ]),
    el('div.vhead__r', {}, [el('p.micro', { text: resumo[aba].toUpperCase() })]),
  ]));

  view.append(el('div.abas', {}, ABAS.map(([id, label]) =>
    el('button.aba' + (aba === id ? '.is-on' : ''), {
      type: 'button',
      onclick: () => { ctx.pessoalAba = id; ctx.rerender(); },
    }, [
      el('span.aba__t', { text: label }),
      el('span.micro.aba__n', { text: resumo[id] }),
    ]))));

  view.append(
    aba === 'tarefas' ? painelTarefas(ctx)
      : aba === 'assinaturas' ? painelAssinaturas(ctx, mes)
      : painelCarteira(ctx, mes),
  );
  return view;
}

/* ══ ASSINATURAS ════════════════════════════════════════════ */
function painelAssinaturas(ctx, mes) {
  const view = el('div.painel');
  const itens = store.agendaDoMes(mes, { tipos: ['assinatura'] });
  const total = itens.reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const semValor = itens.filter(a => !a.valor).length;

  view.append(el('div.wrap', { style: { marginBottom: '1rem' } }, [
    el('button.btn.btn--sm.btn--solid', {
      type: 'button',
      onclick: () => editarCompromisso(null, () => ctx.rerender(), { tipo: 'assinatura', emoji: '🎧' }),
    }, [el('span', { text: '+ nova assinatura' })]),
    el('button.btn.btn--sm', {
      type: 'button', onclick: () => sugestoesAgenda(() => ctx.rerender()),
    }, [el('span', { text: 'sugestões' })]),
  ]));

  if (!itens.length) {
    view.append(el('div.empty', {}, [
      el('b', { text: 'Nenhuma assinatura' }),
      el('p', { text: 'Spotify, Google, Netflix, iCloud — o que debita sozinho todo mês. Junto dá pra ver quanto some da conta sem você fazer nada.' }),
    ]));
    return view;
  }

  view.append(el('div.totalzao', {}, [
    el('p.micro', { text: 'TODO MÊS SAI, EM ASSINATURA' }),
    el('p.totalzao__n.num', { text: moeda(total) }),
    el('p.micro', {
      text: total
        ? `${moeda(total * 12)} POR ANO · ${itens.length} ASSINATURA${itens.length > 1 ? 'S' : ''}`
        : `${itens.length} ASSINATURA${itens.length > 1 ? 'S' : ''} SEM VALOR ESCRITO`,
    }),
  ]));

  if (total) {
    view.append(barras(
      [...itens].filter(a => a.valor).sort((a, b) => b.valor - a.valor).map((a, i) => ({
        label: `${a.emoji} ${a.label}`, valor: Number(a.valor), destaque: i === 0,
        texto: moeda(a.valor),
      })),
      { atraso: 120 },
    ));
  }
  if (semValor) {
    view.append(el('p.micro', {
      style: { marginTop: '.8rem', color: 'var(--dim)' },
      text: `${semValor} SEM VALOR — TOQUE PRA COMPLETAR E ELAS ENTRAM NA CONTA.`,
    }));
  }

  view.append(listaAgenda(itens, mes, ctx, { verbo: 'debitou' }));
  return view;
}

/* ══ CARTEIRA ═══════════════════════════════════════════════ */
function painelCarteira(ctx, mes) {
  const view = el('div.painel');
  const c = store.contasDoMes(mes);
  const entradas = c.entradas;

  view.append(el('div.wrap', { style: { marginBottom: '1rem' } }, [
    el('button.btn.btn--sm.btn--solid', {
      type: 'button',
      onclick: () => editarCompromisso(null, () => ctx.rerender(), { tipo: 'renda', emoji: '💰' }),
    }, [el('span', { text: '+ nova entrada' })]),
    el('p.micro', { text: monthLabel(mes).toUpperCase() }),
  ]));

  if (!entradas.length) {
    view.append(el('div.empty', {}, [
      el('b', { text: 'Nada previsto pra entrar' }),
      el('p', { text: 'O pagamento da agência, um freela, o que for. Aqui é só o que você espera receber neste mês — dá pra marcar quando cair.' }),
    ]));
    return view;
  }

  view.append(el('div.totalzao', {}, [
    el('p.micro', { text: 'A RECEBER ESTE MÊS' }),
    el('p.totalzao__n.num', { text: moeda(c.aReceber) }),
    el('p.micro', { text: `DE ${moeda(c.totalEntrada)} PREVISTOS · ${moeda(c.recebido)} JÁ CAIU` }),
    barraProgresso(c.totalEntrada ? c.recebido / c.totalEntrada : 0, { atraso: 150 }),
  ]));

  if (c.totalSaida) {
    const sobra = c.totalEntrada - c.totalSaida;
    view.append(el('div.confronto', {}, [
      barras([
        { label: 'entra', valor: c.totalEntrada, texto: moeda(c.totalEntrada), destaque: sobra >= 0 },
        { label: 'sai', valor: c.totalSaida, texto: moeda(c.totalSaida), destaque: sobra < 0 },
      ], { atraso: 200 }),
      el('p.micro' + (sobra < 0 ? '.is-neg' : ''), {
        style: { marginTop: '.7rem' },
        text: sobra >= 0
          ? `SOBRA PREVISTA ${moeda(sobra)} — CONTANDO TUDO QUE ESTÁ NA AGENDA`
          : `FALTAM ${moeda(Math.abs(sobra))} PRA FECHAR O MÊS COM O QUE ESTÁ NA AGENDA`,
      }),
    ]));
  }

  view.append(listaAgenda(entradas, mes, ctx, { verbo: 'caiu' }));
  return view;
}

/* Lista compartilhada pelas duas abas de dinheiro. */
function listaAgenda(itens, mes, ctx, { verbo }) {
  const hoje = todayKey();
  const lista = el('div.agenda', { style: { marginTop: '1.2rem' } });
  itens.forEach(item => {
    const feito = store.agendaFeito(item, mes);
    const entra = store.fluxoDe(item) === 'entrada';
    const linha = el('div.agitem' + (feito ? '.is-feito' : ''), { 'data-tipo': item.tipo });
    linha.append(...[
      el('button.agitem__check', {
        type: 'button', 'aria-pressed': String(feito),
        'aria-label': `${feito ? 'Desmarcar' : 'Marcar'} ${item.label}`,
        onclick: () => {
          store.marcarAgenda(item.id, mes, !feito);
          toast(feito ? 'desmarcado' : `${verbo} ✓`);
          ctx.rerender();
        },
      }, [el('span', { text: feito ? '✓' : '' })]),
      el('button.agitem__l', {
        type: 'button',
        onclick: () => editarCompromisso(store.agendaById(item.id), () => ctx.rerender()),
      }, [
        el('span.agitem__t', {}, [
          el('span.agitem__e', { text: item.emoji || '•' }),
          el('span', { text: item.label }),
        ]),
        el('span.micro.agitem__d', {
          text: [
            item.dia ? `dia ${item.dia}` : 'sem data',
            item.data && item.data <= hoje && !feito ? `já ${verbo}?` : '',
            item.nota,
          ].filter(Boolean).join(' · '),
        }),
      ]),
      item.valor
        ? el('span.agitem__v.num' + (entra ? '.is-entra' : ''), { text: (entra ? '+' : '') + moeda(item.valor) })
        : el('span.micro.agitem__v', { text: 'sem valor' }),
    ].filter(Boolean));
    lista.append(linha);
  });
  stagger(lista, '.agitem');
  return lista;
}

function painelTarefas(ctx) {
  const view = el('div.painel');
  const tab = ctx.todoTab || 'abertas';
  const todos = store.listTodos();
  const abertas = todos.filter(t => !t.done);
  const feitas = todos.filter(t => t.done);

  /* campo de adicionar */
  const input = el('input', {
    type: 'text', placeholder: 'O que precisa ser feito?', 'aria-label': 'Nova tarefa',
    autocomplete: 'off', enterkeyhint: 'done',
  });
  const add = () => {
    const t = store.addTodo(input.value);
    if (!t) return;
    input.value = '';
    ctx.todoTab = 'abertas';
    ctx.rerender();
    setTimeout(() => view.querySelector('.todoadd input')?.focus(), 30);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  view.append(el('div.todoadd', {}, [
    input,
    el('button.btn.btn--sm.btn--solid', { type: 'button', onclick: add }, [el('span', { text: 'Add' })]),
  ]));

  /* abas */
  const tabs = el('div.tabs', {}, [
    ['abertas', `abertas ${abertas.length}`],
    ['feitas', `feitas ${feitas.length}`],
    ['todas', 'todas'],
  ].map(([id, label]) => el('button.chip' + (tab === id ? '.is-on' : ''), {
    type: 'button', onclick: () => { ctx.todoTab = id; ctx.rerender(); }, text: label,
  })));
  if (feitas.length) {
    tabs.append(el('button.chip', {
      type: 'button', class: 'chip right',
      onclick: () => confirmSheet({
        title: 'Limpar concluídas?',
        text: `${feitas.length} tarefa(s) concluídas serão apagadas.`,
        ok: 'Limpar', danger: true,
        onOk: () => {
        const apagadas = store.clearDoneTodos();
        toast(`${apagadas.length} apagada(s)`, {
          action: 'desfazer',
          onAction: () => { apagadas.forEach(t => store.restoreTodo(t)); ctx.rerender(); },
        });
        ctx.rerender();
      },
      }),
      text: 'limpar feitas',
    }));
  }
  view.append(tabs);

  /* lista */
  const list = tab === 'abertas' ? abertas : tab === 'feitas' ? feitas : todos;
  if (!list.length) {
    view.append(el('div.empty', {}, [
      el('b', { text: tab === 'feitas' ? 'Nada concluído ainda' : 'Lista vazia' }),
      el('p', { text: tab === 'feitas' ? 'O que você marcar como feito aparece aqui.' : 'Escreva ali em cima e aperte Enter.' }),
    ]));
    return view;
  }

  const ul = el('div.todos');
  /* ordem manual manda: o que você arrastou fica onde deixou. A estrela
     virou marca-texto — antes ela empurrava a tarefa pro topo e brigava
     com o arrasto. */
  const sorted = [...list].sort((a, b) =>
    (a.done ? 1 : 0) - (b.done ? 1 : 0)
    || (a.done ? (b.doneAt || 0) - (a.doneAt || 0) : (a.order ?? 0) - (b.order ?? 0)));

  for (const t of sorted) {
    const row = el('div.todo' + (t.done ? '.is-done' : '') + (t.star ? '.is-star' : ''), { 'data-id': t.id });

    const box = el('button.todo__box', { type: 'button', 'aria-label': t.done ? 'Reabrir' : 'Concluir' }, [check()]);
    box.addEventListener('click', () => {
      const next = !t.done;
      store.updateTodo(t.id, { done: next });
      row.classList.toggle('is-done', next);
      if (next) toast('feito', { action: 'desfazer', onAction: () => { store.updateTodo(t.id, { done: false }); ctx.rerender(); } });
      if (tab !== 'todas') {
        row.classList.add('is-leaving');
        setTimeout(() => ctx.rerender(), 320);
      }
    });

    const txt = el('span.todo__txt', { text: t.text, contenteditable: 'plaintext-only', spellcheck: 'false' });
    txt.addEventListener('blur', () => {
      const v = txt.textContent.trim();
      if (!v) { txt.textContent = t.text; return; }
      if (v !== t.text) { store.updateTodo(t.id, { text: v }); toast('editado'); }
    });
    txt.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); txt.blur(); }
      if (e.key === 'Escape') { txt.textContent = t.text; txt.blur(); }
    });

    const star = el('button.star' + (t.star ? '.is-on' : ''), { type: 'button', 'aria-label': 'Destacar', html: starSvg });
    star.addEventListener('click', () => {
      store.updateTodo(t.id, { star: !t.star });
      star.classList.toggle('is-on', !t.star);
      ctx.rerender();
    });

    const del = el('button.todo__x', { type: 'button', 'aria-label': 'Apagar', html: xSvg });
    del.addEventListener('click', () => {
      row.classList.add('is-leaving');
      setTimeout(() => {
        const apagada = store.removeTodo(t.id);
        ctx.rerender();
        toast('tarefa apagada', {
          action: 'desfazer',
          onAction: () => { store.restoreTodo(apagada); ctx.rerender(); },
        });
      }, 300);
    });

    const pega = el('button.todo__pega' + (t.done ? '.is-off' : ''), {
      type: 'button', disabled: t.done || null,
      'aria-label': `Mover: ${t.text}`, title: 'Arraste para ordenar (ou use ↑ ↓)',
      html: PEGA_SVG,
    });
    row.append(pega, box, txt, el('div.todo__act', {}, [star, del]));
    if (t.done && t.doneAt) {
      row.append(el('span.micro', { text: humanDay(new Date(t.doneAt).toISOString().slice(0, 10)) }));
    }
    ul.append(row);
  }
  view.append(ul);

  if (tab !== 'feitas') {
    listaArrastavel(ul, {
      itemSel: '.todo:not(.is-done)',
      pegaSel: '.todo__pega:not(.is-off)',
      aoSoltar: ids => { store.reorderTodos(ids); toast('ordem salva'); },
    });
  }

  stagger(ul, '.todo');
  return view;
}

const PEGA_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">'
  + [4, 8, 12].map(y => [5, 11].map(x => `<circle cx="${x}" cy="${y}" r="1.4"/>`).join('')).join('')
  + '</svg>';
const starSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 3.5l2.6 5.5 5.9.8-4.3 4.2 1 6-5.2-2.9L6.8 20l1-6L3.5 9.8l5.9-.8z"/></svg>';
const xSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export { todayKey };
