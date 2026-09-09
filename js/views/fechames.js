/* views/fechames.js — o ritual de fechar o mês.

   A semana já tinha o dela: o mês virava a página em silêncio. E o mês é
   onde mora o que a semana não vê — quanto entrou, quanto saiu, o que ficou
   atrasado, e se a rotina andou mais ou menos que no mês passado.

   Mesmo desenho da revisão semanal de propósito: mesmo painel de uma linha,
   mesma anotação, mesmo botão que fecha e reabre. Dois rituais parecidos são
   um ritual só, aprendido uma vez. */

import { el, nf, moeda, monthKey, monthLabel, todayKey, parseKey, keyOf, daysInMonth, plural } from '../utils.js';
import * as store from '../store.js';
import { num, did, isReduce, mesPendente } from '../analysis.js';
import { iconBtn } from './today.js';
import { toast, confirmSheet, stagger } from '../ui.js';

export function render(ctx) {
  const mes = ctx.fechaMes || mesPendente(todayKey()) || mesAnterior(monthKey(), 0);
  const anterior = mesAnterior(mes, 1);
  const review = store.getReview(mes);
  const fechado = !!review?.fechadoEm;

  const view = el('div.view');
  const podeAvancar = mes < monthKey();

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: `FECHAMENTO · ${monthLabel(mes).toUpperCase()}` }),
      el('h2.display.h-lg', { text: fechado ? 'MÊS FECHADO' : 'FECHAR O MÊS' }),
    ]),
    el('div.vhead__r', {}, [
      el('div.daynav', {}, [
        iconBtn('M15 6l-6 6 6 6', () => { ctx.fechaMes = anterior; ctx.rerender(); }, 'Mês anterior'),
        podeAvancar
          ? iconBtn('M9 6l6 6-6 6', () => { ctx.fechaMes = mesSeguinte(mes); ctx.rerender(); }, 'Mês seguinte')
          : null,
      ]),
    ]),
  ]));

  /* ── o mês em uma linha ── */
  const c = store.contasDoMes(mes);
  const cAntes = store.contasDoMes(anterior);
  const sobra = c.totalEntrada - c.totalSaida;
  const sobraAntes = cAntes.totalEntrada - cAntes.totalSaida;
  const dias = diasDoMes(mes);
  const registrados = dias.filter(k => store.hasEntry(k)).length;
  const registradosAntes = diasDoMes(anterior).filter(k => store.hasEntry(k)).length;

  view.append(el('div.totalzao', {}, [
    el('p.micro', { text: sobra >= 0 ? 'SOBROU NO MÊS' : 'FALTOU NO MÊS' }),
    el('p.totalzao__n.num' + (sobra < 0 ? '.is-neg' : ''), { text: moeda(Math.abs(sobra)) }),
    el('p.nota-pe', {
      text: `${moeda(c.totalEntrada)} entrou · ${moeda(c.totalSaida)} saiu`
        + (cAntes.totalEntrada || cAntes.totalSaida
          ? ` — ${monthLabel(anterior).split(' ')[0].toLowerCase()} fechou em ${sobraAntes < 0 ? '−' : ''}${moeda(Math.abs(sobraAntes))}.`
          : ''),
    }),
  ]));

  /* ── a rotina, no mesmo painel da revisão da semana ── */
  view.append(el('div.status' + (registrados >= dias.length - 2 ? '.is-ok' : ''), { style: { margin: 'var(--s-4) 0' } }, [
    el('div.status__topo', {}, [
      el('div', {}, [
        el('p.micro', { text: 'A ROTINA NO MÊS' }),
        el('p.status__t', { text: `${registrados} de ${dias.length} dias registrados` }),
      ]),
    ]),
    el('p.micro.status__sub', {
      text: `MÊS ANTERIOR: ${registradosAntes}/${diasDoMes(anterior).length} DIAS · ${comparar(registrados, registradosAntes)}`,
    }),
  ]));

  /* ── o que cada categoria fez, contra o mês anterior ── */
  const cats = store.activeCategories().filter(cat => cat.type !== 'text');
  const linhas = cats.map(cat => {
    const agora = cat.type === 'toggle' ? dias.filter(k => did(cat, k)).length : dias.reduce((t, k) => t + num(cat, k), 0);
    const antes = cat.type === 'toggle'
      ? diasDoMes(anterior).filter(k => did(cat, k)).length
      : diasDoMes(anterior).reduce((t, k) => t + num(cat, k), 0);
    return { cat, agora, antes };
  }).filter(l => l.agora || l.antes);

  if (linhas.length) {
    view.append(el('div.section__h', {}, [el('p.micro', { text: 'CATEGORIA A CATEGORIA' })]));
    const lista = el('div.mesl');
    linhas.forEach(({ cat, agora, antes }) => {
      const delta = agora - antes;
      lista.append(el('div.mesl__r', {}, [
        el('span.mesl__e', { text: cat.emoji || '•' }),
        el('span.mesl__n', { text: cat.label }),
        el('span.mesl__v.num', { text: nf(agora, agora % 1 ? 1 : 0) }),
        /* Numa categoria de teto (bebida, maconha), subir não é conquista —
           então o verde não é do sinal, é da direção certa. */
        el('span.micro.mesl__d' + (delta === 0 ? '' : (delta > 0) !== isReduce(cat) ? '.is-bom' : '.is-ruim'), {
          text: antes || agora ? (delta === 0 ? 'igual' : `${delta > 0 ? '+' : '−'}${nf(Math.abs(delta), Math.abs(delta) % 1 ? 1 : 0)}`) : '',
        }),
      ]));
    });
    view.append(lista);
  }

  /* ── o que ficou pendurado ──
     Não é lista de vergonha: é a única chance de decidir o que fazer com o
     que passou, antes de o mês seguinte encobrir. */
  const pendentes = store.agendaDoMes(mes)
    .filter(a => a.tipo !== 'assinatura' && !store.agendaFeito(a, mes));
  if (pendentes.length) {
    /* Somar o que você não pagou com o que não te pagaram dá um número que
       não quer dizer nada. São duas dívidas de direções opostas, e só uma
       delas é sua. */
    const soma = lista => lista.reduce((t, a) => t + (Number(a.valor) || 0), 0);
    const aPagar = pendentes.filter(a => store.fluxoDe(a) === 'saida');
    const aReceber = pendentes.filter(a => store.fluxoDe(a) !== 'saida');
    view.append(el('div.section__h.grupoh.is-urgente', {}, [
      el('p.micro', { text: 'FICOU SEM RESOLVER' }),
      el('span.micro.grupoh__n', {
        text: [
          soma(aPagar) ? `${moeda(soma(aPagar), { cents: 2 })} não pago` : '',
          soma(aReceber) ? `${moeda(soma(aReceber), { cents: 2 })} não caiu` : '',
        ].filter(Boolean).join(' · '),
      }),
    ]));
    const lista = el('div.agenda');
    pendentes.forEach(item => {
      const entra = store.fluxoDe(item) === 'entrada';
      lista.append(el('div.agitem' + (entra ? '' : '.is-atrasado'), {}, [
        el('button.agitem__check', {
          type: 'button', 'aria-pressed': 'false',
          'aria-label': `Marcar ${item.label} como ${entra ? 'recebido' : 'pago'}`,
          onclick: () => { store.marcarAgenda(item.id, mes, true); toast(entra ? 'caiu ✓' : 'resolvido ✓'); ctx.rerender(); },
        }, [el('span', { text: '' })]),
        el('span.agitem__l', {}, [
          el('span.agitem__t', {}, [
            el('span.agitem__e', { text: item.emoji || '•' }),
            el('span', { text: item.label }),
          ]),
          el('span.micro.agitem__d', { text: `dia ${item.dia} · ${entra ? 'não caiu' : 'não pago'}` }),
        ]),
        item.valor
          ? el('span.agitem__v.num' + (entra ? '.is-entra' : ''), { text: (entra ? '+' : '') + moeda(item.valor, { cents: 2 }) })
          : null,
      ].filter(Boolean)));
    });
    view.append(lista);
    stagger(lista, '.agitem');
  }

  /* ── anotação ── */
  const nota = el('textarea.note', {
    rows: 3, placeholder: 'Como foi o mês? O que você quer diferente no próximo? (opcional)',
    disabled: fechado || null,
  });
  nota.value = review?.nota || '';
  view.append(el('div.section', { style: { marginTop: 'var(--s-6)' } }, [
    el('div.section__h', {}, [el('p.micro', { text: 'ANOTAÇÃO DO MÊS' })]),
    nota,
  ]));

  /* ── fechar ── */
  view.append(el('div.wrap', { style: { marginTop: 'var(--s-5)' } }, [
    fechado
      ? el('button.btn', {
          type: 'button',
          onclick: () => confirmSheet({
            title: 'Reabrir o mês?', text: 'Volta a ficar editável. O que você já escreveu continua aqui.',
            ok: 'Reabrir',
            onOk: () => { store.saveReview(mes, { fechadoEm: 0 }); ctx.fechaMes = mes; ctx.rerender(); },
          }),
        }, [el('span', { text: 'reabrir' })])
      : el('button.btn.btn--solid', {
          type: 'button',
          onclick: () => {
            store.saveReview(mes, {
              fechadoEm: Date.now(),
              nota: nota.value.trim(),
              dias: registrados,
              entrou: c.totalEntrada, saiu: c.totalSaida, sobra,
              pendentes: pendentes.length,
            });
            toast('mês fechado');
            ctx.fechaMes = mes;
            ctx.rerender();
          },
        }, [el('span', { text: 'FECHAR O MÊS' })]),
    fechado && review.fechadoEm
      ? el('p.micro', { style: { alignSelf: 'center' }, text: `FECHADO EM ${new Date(review.fechadoEm).toLocaleDateString('pt-BR')}` })
      : null,
  ].filter(Boolean)));

  return view;
}

/* ── Peças ─────────────────────────────────────────────────── */
const desloca = (mes, n) => {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const mesAnterior = (mes, n = 1) => desloca(mes, -n);
const mesSeguinte = mes => desloca(mes, 1);

function diasDoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return Array.from({ length: daysInMonth(y, m - 1) }, (_, i) => keyOf(new Date(y, m - 1, i + 1)));
}

const comparar = (agora, antes) => {
  if (!antes && !agora) return 'SEM COMPARAÇÃO';
  if (agora === antes) return 'MESMO RITMO';
  const d = agora - antes;
  return `${d > 0 ? '+' : '−'}${plural(Math.abs(d), 'DIA', 'DIAS')}`.toUpperCase();
};
