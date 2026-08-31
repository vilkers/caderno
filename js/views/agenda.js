/* views/agenda.js — o mês que não é rotina: o que vence, o que se paga,
   o que se emite e o que entra.

   A rotina é diária e se mede em constância; isto aqui é pontual e se mede
   em "resolvido ou não". Por isso vive numa tela própria, com o mês inteiro
   à vista e um toque por item — e não no check-in do dia. */

import { el, monthKey, monthLabel, todayKey, parseKey, moeda, nf, humanDay, MONTHS, WD } from '../utils.js';
import * as store from '../store.js';
import { toast, stagger, confirmSheet } from '../ui.js';
import { barraProgresso, anel } from '../graficos.js';
import { iconBtn } from './today.js';
import { editarCompromisso } from './agendaform.js';

export function render(ctx) {
  const mes = ctx.agendaMes || monthKey();
  const hoje = todayKey();
  const c = store.contasDoMes(mes);
  const view = el('div.view');

  const desloca = n => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    ctx.agendaMes = monthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    ctx.rerender();
  };

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: `AGENDA · ${monthLabel(mes).toUpperCase()}` }),
      el('h2.display.h-lg', { text: 'O MÊS' }),
    ]),
    el('div.vhead__r', {}, [
      el('div.daynav', {}, [
        iconBtn('M15 6l-6 6 6 6', () => desloca(-1), 'Mês anterior'),
        mes !== monthKey()
          ? el('button.chip', { onclick: () => { ctx.agendaMes = null; ctx.rerender(); }, text: 'este mês' })
          : null,
        iconBtn('M9 6l6 6-6 6', () => desloca(1), 'Próximo mês'),
      ]),
      el('button.btn.btn--sm', { type: 'button', onclick: () => ctx.voltar(), text: '← voltar' }),
    ]),
  ]));

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
              ? el('p.micro', { text: `INCLUI ${moeda(c.assinaturas)} DE ASSINATURA, QUE DEBITA SOZINHA` })
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
    el('button.btn.btn--sm', {
      type: 'button',
      onclick: () => { ctx.ajustesFoco = 'agenda'; ctx.go('ajustes'); },
    }, [el('span', { text: 'editar a agenda' })]),
  ]));

  view.append(el('p.micro', {
    style: { marginTop: '1.6rem', lineHeight: '1.9' },
    html: 'O QUE VOCÊ MARCA AQUI VALE SÓ PRA ESTE MÊS — NO MÊS QUE VEM TUDO VOLTA EM ABERTO.'
      + (c.assinaturas ? '<br>ASSINATURAS FICAM EM PESSOAL → ASSINATURAS.' : ''),
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
  el('span.micro', { text: `${rotulo.toUpperCase()} ${moeda(total)}` }),
  barraProgresso(total ? feito / total : 0),
  el('span.micro.dinheiro__f', { text: `${moeda(feito)} ${verbo}` }),
]);

function proximoTexto(acoes, hoje) {
  const pendentes = acoes.filter(a => a.data && !store.agendaFeito(a, monthKey(a.data)));
  const atrasado = pendentes.find(a => a.data < hoje);
  if (atrasado) return `${atrasado.label.toLowerCase()} passou do dia`;
  const proximo = pendentes.find(a => a.data >= hoje);
  if (proximo) return `o próximo é ${proximo.label.toLowerCase()}, dia ${proximo.dia}`;
  return 'nada com data à frente';
}

function vazio(ctx) {
  return el('div.empty', {}, [
    el('p.display.h-md', { text: 'NADA NA AGENDA' }),
    el('p', {
      style: { color: 'var(--dim)', maxWidth: '42ch', margin: '.6rem 0 1.4rem' },
      text: 'Aqui ficam as coisas que acontecem todo mês num dia certo: aluguel, cartões, contas de casa, a nota fiscal — e o que entra. Elas aparecem no calendário e cobram você no dia.',
    }),
    el('button.btn.btn--solid', {
      type: 'button',
      onclick: () => { ctx.ajustesFoco = 'agenda'; ctx.go('ajustes'); },
    }, [el('span', { text: 'montar a agenda' })]),
  ]);
}

