/* views/agenda.js — o mês que não é rotina: o que vence, o que se paga,
   o que se emite e o que entra.

   A rotina é diária e se mede em constância; isto aqui é pontual e se mede
   em "resolvido ou não" — por isso não entra no check-in do dia.

   Virou uma aba de Pessoal (Contas), e não uma tela própria: a Carteira já
   listava os mesmos itens com a soma partida em entra/sai, e marcar como pago
   funcionava nas duas. Duas telas quase iguais, uma a um toque e a outra a
   dois. Aqui mora o painel; quem desenha cabeçalho e navegação de mês é
   views/todos.js. */

import { el, monthKey, todayKey, parseKey, moeda, WD } from '../utils.js';
import * as store from '../store.js';
import { toast, stagger, openSheet, interruptor } from '../ui.js';
import { barraProgresso, anel } from '../graficos.js';
import { editarCompromisso, sugestoesAgenda } from './agendaform.js';

export function painelContas(ctx, mes) {
  const hoje = todayKey();
  const c = store.contasDoMes(mes);
  const view = el('div.painel');

  if (!c.itens.length) {
    view.append(vazio(ctx));
    return view;
  }

  /* Assinatura debita sozinha: ela conta no dinheiro, mas não é tarefa —
     fica na área pessoal e não engrossa a lista do que você tem que fazer. */
  const acoes = c.itens.filter(a => a.tipo !== 'assinatura');
  const resolvidos = acoes.filter(a => store.agendaFeito(a, mes)).length;

  /* ── o mês em uma linha ── */
  view.append(el('div.mescabeca', {}, [
    anel(acoes.length ? resolvidos / acoes.length : 1, { tamanho: 88, espessura: 8, texto: resolvidos, sufixo: `de ${acoes.length}` }),
    el('div.mescabeca__l', {}, [
      el('p.micro', { text: 'RESOLVIDOS ESTE MÊS' }),
      el('p.status__t', {
        text: resolvidos === acoes.length
          ? 'Mês inteiro em ordem.'
          : `Faltam ${acoes.length - resolvidos} — ${proximoTexto(acoes, hoje)}`,
      }),
      c.totalSaida || c.totalEntrada
        ? el('div.dinheiro', {}, [
            c.totalSaida ? linhaDinheiro('sai', c.totalSaida, c.pago, 'pago') : null,
            c.totalEntrada ? linhaDinheiro('entra', c.totalEntrada, c.recebido, 'recebido') : null,
            c.assinaturas
              ? el('p.nota-pe', { text: `Inclui ${moeda(c.assinaturas)} de assinatura, que debita sozinha.` })
              : null,
            c.totalSaida && c.totalEntrada
              ? el('p.micro.dinheiro__saldo' + (c.saldo < 0 ? '.is-neg' : ''), {
                  text: `SALDO PREVISTO ${c.saldo < 0 ? '−' : '+'}${moeda(Math.abs(c.saldo))}`,
                })
              : null,
          ].filter(Boolean))
        : null,
    ]),
  ]));

  /* ── a lista, por dia ── */
  const lista = el('div.agenda');
  let ultimoDia = null;
  acoes.forEach(item => {
    if (item.dia !== ultimoDia) {
      ultimoDia = item.dia;
      lista.append(marcoDoDia(item, mes, hoje));
    }
    lista.append(linhaAgenda(item, mes, hoje, ctx));
  });
  view.append(lista);

  view.append(el('div.wrap', { style: { marginTop: '1.4rem' } }, [
    el('button.btn.btn--sm.btn--solid', {
      type: 'button',
      onclick: () => editarCompromisso(null, () => ctx.rerender()),
    }, [el('span', { text: '+ novo compromisso' })]),
    el('button.btn.btn--sm', {
      type: 'button',
      onclick: () => sugestoesAgenda(() => ctx.rerender(), { grupos: ['CARTÕES', 'CASA', 'TRABALHO'] }),
    }, [el('span', { text: 'sugestões' })]),
  ]));

  /* A lista completa mora aqui, não em Ajustes: Ajustes guarda o que o app
     te pergunta todo dia; compromisso é conteúdo — nasce, tem valor e morre.
     Esta é a única porta pros pausados e pros únicos de outros meses. */
  const todos = store.listAgenda();
  view.append(el('button.linhatudo', {
    type: 'button',
    onclick: () => listaCompleta(ctx),
  }, [
    el('span', { text: `todos os compromissos (${todos.length})` }),
    el('span.linhatudo__s.micro', { text: 'INCLUI PAUSADOS E DE OUTROS MESES' }),
  ]));

  view.append(el('p.nota-pe', {
    html: 'O que você marca aqui vale só pra este mês — no mês que vem tudo volta em aberto.'
      + (c.assinaturas ? '<br>Assinatura debita sozinha: fica na aba ao lado e conta no dinheiro do mês.' : ''),
  }));

  stagger(lista, '.agitem');
  return view;
}

/* ── Peças ─────────────────────────────────────────────────── */
function marcoDoDia(item, mes, hoje) {
  const data = item.data;
  const d = data ? parseKey(data) : null;
  const passou = data && data < hoje;
  return el('div.agdia' + (data === hoje ? '.is-hoje' : '') + (passou ? '.is-passado' : ''), {}, [
    el('span.agdia__n.num', { text: String(item.dia ?? '—') }),
    el('span.micro', { text: d ? WD[d.getDay()] : '' }),
    data === hoje ? el('span.micro.agdia__hoje', { text: 'hoje' }) : null,
  ]);
}

function linhaAgenda(item, mes, hoje, ctx) {
  const feito = store.agendaFeito(item, mes);
  const atrasado = !feito && item.data && item.data < hoje;
  const entra = store.fluxoDe(item) === 'entrada';

  const linha = el('div.agitem' + (feito ? '.is-feito' : '') + (atrasado ? '.is-atrasado' : ''), {
    'data-tipo': item.tipo,
  });

  const marcar = () => {
    store.marcarAgenda(item.id, mes, !feito);
    toast(feito ? 'desmarcado' : (entra ? 'recebido ✓' : 'resolvido ✓'));
    ctx.rerender();
  };

  linha.append(...[
    el('button.agitem__check', {
      type: 'button', 'aria-pressed': String(feito),
      'aria-label': `${feito ? 'Desmarcar' : 'Marcar'} ${item.label}`,
      onclick: marcar,
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
          store.AGENDA_TIPOS[item.tipo]?.label || item.tipo,
          item.repete === 'unico' ? 'só este mês' : 'todo mês',
          item.nota,
        ].filter(Boolean).join(' · '),
      }),
    ]),
    item.valor
      ? el('span.agitem__v.num' + (entra ? '.is-entra' : ''), { text: (entra ? '+' : '') + moeda(item.valor) })
      : null,
  ].filter(Boolean));
  return linha;
}

const linhaDinheiro = (rotulo, total, feito, verbo) => el('div.dinheiro__l', {}, [
  el('span.dinheiro__r', {}, [
    el('span.micro', { text: rotulo.toUpperCase() }),
    el('span.num', { text: moeda(total) }),
  ]),
  barraProgresso(total ? feito / total : 0),
  el('span.dinheiro__f', {}, [
    el('span.num', { text: moeda(feito) }),
    el('span.micro', { text: verbo }),
  ]),
]);

function proximoTexto(acoes, hoje) {
  const pendentes = acoes.filter(a => a.data && !store.agendaFeito(a, monthKey(a.data)));
  const atrasado = pendentes.find(a => a.data < hoje);
  if (atrasado) return `${atrasado.label} passou do dia`;
  const proximo = pendentes.find(a => a.data >= hoje);
  if (proximo) return `o próximo é ${proximo.label}, dia ${proximo.dia}`;
  return 'nada com data à frente';
}

/**
 * Todos os compromissos, de qualquer mês, pausados inclusive — a visão de
 * manutenção, separada da visão do mês porque respondem perguntas
 * diferentes: "o que falta pagar agora" e "o que existe cadastrado".
 */
export function listaCompleta(ctx) {
  const pinta = close => {
    const itens = store.listAgenda();
    const corpo = [
      el('p', {
        style: { color: 'var(--dim)', fontSize: 'var(--t-corpo)', marginBottom: 'var(--s-4)' },
        text: 'Tudo que está cadastrado. Pausar tira do mês e do calendário sem apagar o histórico.',
      }),
    ];
    if (!itens.length) {
      corpo.push(el('p.micro', { text: 'NADA CADASTRADO AINDA' }));
    } else {
      corpo.push(el('div.tudolista', {}, itens.map(a => el('div.tudoitem' + (a.pausado ? '.is-pausado' : ''), {}, [
        el('button.tudoitem__l', {
          type: 'button',
          onclick: () => editarCompromisso(a, () => { ctx.rerender(); close(); }),
        }, [
          el('span.tudoitem__t', {}, [
            el('span', { text: a.emoji || '•' }),
            el('span', { text: a.label }),
          ]),
          el('span.micro', {
            text: [
              a.repete === 'unico' ? (a.data || 'sem data') : `todo dia ${a.dia}`,
              store.AGENDA_TIPOS[a.tipo]?.label || a.tipo,
              a.valor ? moeda(a.valor) : null,
              a.pausado ? 'pausado' : null,
            ].filter(Boolean).join(' · '),
          }),
        ]),
        interruptor(!a.pausado, ligado => {
          store.updateAgenda(a.id, { pausado: !ligado });
          toast(ligado ? 'de volta ao mês' : 'pausado');
          ctx.rerender();
        }, `Cobrar ${a.label}`),
      ]))));
    }
    corpo.push(el('div.sheet__actions', {}, [
      el('button.btn.btn--sm', {
        type: 'button',
        onclick: () => editarCompromisso(null, () => { ctx.rerender(); close(); }),
      }, [el('span', { text: '+ novo' })]),
      el('button.btn.btn--solid', { type: 'button', onclick: close }, [el('span', { text: 'pronto' })]),
    ]));
    return corpo;
  };
  openSheet('Todos os compromissos', pinta);
}

function vazio(ctx) {
  return el('div.empty', {}, [
    el('b', { text: 'Nada nas contas' }),
    el('p', { text: 'O que acontece todo mês num dia certo: aluguel, cartões, contas de casa, a nota fiscal. Aparece no calendário e cobra você no dia.' }),
    el('div.wrap', { style: { marginTop: '1.2rem', justifyContent: 'center' } }, [
      el('button.btn.btn--sm.btn--solid', {
        type: 'button',
        onclick: () => sugestoesAgenda(() => ctx.rerender(), { grupos: ['CARTÕES', 'CASA', 'TRABALHO'] }),
      }, [el('span', { text: 'começar pelas sugestões' })]),
      el('button.btn.btn--sm', {
        type: 'button',
        onclick: () => editarCompromisso(null, () => ctx.rerender()),
      }, [el('span', { text: '+ do zero' })]),
    ]),
  ]);
}

