/* views/todos.js — organização pessoal.

   Três coisas que não são rotina mas ocupam a cabeça no mesmo lugar:
   a lista de afazeres (essa sim conversa com o app inteiro), as assinaturas
   que debitam sozinhas todo mês, e o que você tem pra receber.

   Assinaturas e carteira são gestão pessoal, de propósito fora do XP e das
   metas: dinheiro não é hábito, e transformar conta em pontuação seria
   converter uma coisa chata numa coisa chata e barulhenta. */

import { el, humanDay, todayKey, addDays, monthKey, monthLabel, moeda, nf, plural, parseKey, keyOf } from '../utils.js';
import * as store from '../store.js';
import { toast, stagger, confirmSheet, openSheet, interruptor } from '../ui.js';
import { listaArrastavel } from '../arrastar.js';
import { barras, barraProgresso } from '../graficos.js';
import { check, iconBtn } from './today.js';
import { editarCompromisso, sugestoesAgenda } from './agendaform.js';
import { painelContas } from './agenda.js';

const ABAS = [
  ['tarefas', 'Tarefas'],
  ['contas', 'Contas'],
  ['assinaturas', 'Assinaturas'],
  ['carteira', 'Carteira'],
];

export function render(ctx) {
  const aba = ABAS.some(([id]) => id === ctx.pessoalAba) ? ctx.pessoalAba : 'tarefas';
  const view = el('div.view');
  const abertas = store.listTodos().filter(t => !t.done).length;
  /* As duas abas de dinheiro andam pelo tempo: o que se paga e o que se recebe
     é por mês, e olhar o mês passado (ou o que vem) é metade da graça. */
  const mes = ctx.pessoalMes || monthKey();
  const assinaturas = store.agendaDoMes(mes, { tipos: ['assinatura'] });
  const c = store.contasDoMes(mes);
  const sobra = c.totalEntrada - c.totalSaida;

  const acoes = store.agendaDoMes(mes).filter(a => a.tipo !== 'assinatura');
  const resolvidas = acoes.filter(a => store.agendaFeito(a, mes)).length;

  const resumo = {
    tarefas: abertas ? `${abertas} em aberto` : 'nada em aberto',
    contas: acoes.length ? `${resolvidas}/${acoes.length} resolvidas` : 'vazio',
    assinaturas: assinaturas.length ? `${moeda(assinaturas.reduce((s, a) => s + (Number(a.valor) || 0), 0))}/mês` : 'vazio',
    carteira: (c.totalEntrada || c.totalSaida)
      ? `${sobra < 0 ? '−' : ''}${moeda(Math.abs(sobra))}`
      : 'vazio',
  };

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '03 — ORGANIZAÇÃO PESSOAL' }),
      el('h2.display.h-lg', { text: TITULOS[aba] }),
    ]),
    /* O resumo da aba ativa já está escrito no cartão dela, logo abaixo, e
       em letras maiores. Repetir aqui era ocupar a linha do título com uma
       informação que o olho acabou de ler. */
    el('div.vhead__r', {}, []),
  ]));

  view.append(el('div.abas', {}, ABAS.map(([id, label]) =>
    el('button.aba' + (aba === id ? '.is-on' : ''), {
      type: 'button',
      onclick: () => { ctx.pessoalAba = id; ctx.rerender(); },
    }, [
      el('span.aba__t', { text: label }),
      el('span.micro.aba__n' + (resumo[id] === 'vazio' ? '.is-vazio' : ''), { text: resumo[id] }),
    ]))));

  if (aba !== 'tarefas') view.append(navMes(ctx, mes));

  view.append(
    aba === 'tarefas' ? painelTarefas(ctx)
      : aba === 'contas' ? painelContas(ctx, mes)
      : aba === 'assinaturas' ? painelAssinaturas(ctx, mes)
      : painelCarteira(ctx, mes),
  );
  return view;
}

const TITULOS = {
  tarefas: 'AFAZERES', contas: 'CONTAS DO MÊS',
  assinaturas: 'ASSINATURAS', carteira: 'CARTEIRA',
};

/* ── Andar pelos meses ─────────────────────────────────────── */
function navMes(ctx, mes) {
  const desloca = n => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    ctx.pessoalMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    ctx.rerender();
  };
  return el('div.mesnav', {}, [
    el('div.daynav', {}, [
      iconBtn('M15 6l-6 6 6 6', () => desloca(-1), 'Mês anterior'),
      el('span.daynav__label', { text: monthLabel(mes) }),
      iconBtn('M9 6l6 6-6 6', () => desloca(1), 'Próximo mês'),
    ]),
    mes !== monthKey()
      ? el('button.chip', { type: 'button', onclick: () => { ctx.pessoalMes = null; ctx.rerender(); }, text: 'este mês' })
      : null,
  ]);
}

/* ══ ASSINATURAS ════════════════════════════════════════════ */
function painelAssinaturas(ctx, mes) {
  const view = el('div.painel');
  const itens = store.agendaDoMes(mes, { tipos: ['assinatura'] });
  const total = itens.reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const semValor = itens.filter(a => !a.valor).length;

  if (!itens.length) {
    view.append(el('div.empty', {}, [
      el('b', { text: 'Nenhuma assinatura' }),
      el('p', { text: 'Só o que debita sozinho todo mês: Spotify, Google, Netflix, academia. Junto dá pra ver quanto some da conta sem você fazer nada — e o que dá pra cortar.' }),
    ]));
    view.append(botoesAssinatura(ctx));
    return view;
  }

  view.append(el('div.totalzao', {}, [
    el('p.micro', { text: 'TODO MÊS SAI, EM ASSINATURA' }),
    el('p.totalzao__n.num', { text: moeda(total) }),
    el('p.nota-pe', {
      text: total
        ? `${moeda(total * 12)} por ano, em ${plural(itens.length, 'assinatura', 'assinaturas')}.`
        : `${plural(itens.length, 'assinatura ainda sem valor escrito', 'assinaturas ainda sem valor escrito')}.`,
    }),
  ]));

  /* A frase que faz cortar. O gráfico dizia "Adobe é a maior barra"; o que
     decide é quanto ela custa por ano — e isso estava só na cabeça de quem
     multiplicasse. */
  const ordenadas = [...itens].filter(a => a.valor).sort((a, b) => b.valor - a.valor);
  if (ordenadas.length > 1) {
    const maior = ordenadas[0];
    view.append(el('p.nota-pe.assin__corte', {
      html: `A mais cara é <b>${maior.emoji || ''} ${maior.label}</b>: ${moeda(maior.valor, { cents: 2 })} por mês — `
        + `<b>${moeda(maior.valor * 12, { cents: 2 })} por ano</b>, ${Math.round((maior.valor / total) * 100)}% do que você assina.`,
    }));
  }

  /* Uma coisa só. Antes eram duas: um gráfico de barras com os mesmos quatro
     nomes e valores, e logo abaixo a lista com os mesmos quatro nomes e
     valores. A barra agora mora dentro da linha, que é onde ela informa. */
  const lista = el('div.assins');
  const teto = Math.max(1, ...itens.map(a => Number(a.valor) || 0));
  itens.forEach(item => {
    const feito = store.agendaFeito(item, mes);
    const linha = el('div.assin' + (feito ? '.is-feito' : ''));
    const preenche = el('i', { style: { width: '0%' } });
    linha.append(
      /* debita sozinha, então marcar é opcional — o quadradinho fica, mas
         pequeno e sem pergunta escrita em cima dele. */
      el('button.agitem__check.assin__check', {
        type: 'button', 'aria-pressed': String(feito),
        'aria-label': `${feito ? 'Desmarcar' : 'Marcar'} ${item.label} como debitada`,
        onclick: () => {
          store.marcarAgenda(item.id, mes, !feito);
          toast(feito ? 'desmarcado' : 'debitou ✓');
          ctx.rerender();
        },
      }, [el('span', { text: feito ? '✓' : '' })]),
      el('button.assin__l', {
        type: 'button',
        onclick: () => editarCompromisso(store.agendaById(item.id), () => ctx.rerender()),
      }, [
        el('span.assin__t', {}, [
          el('span.agitem__e', { text: item.emoji || '•' }),
          el('span', { text: item.label }),
        ]),
        item.valor
          ? el('span.assin__v.num', { text: moeda(item.valor, { cents: 2 }) })
          : el('span.micro.assin__v', { text: 'sem valor' }),
        el('span.assin__meta', {}, [
          el('span.assin__bar', {}, [preenche]),
          el('span.micro.assin__d', {
            text: [item.dia ? `dia ${item.dia}` : 'sem dia', feito ? 'debitou ✓' : ''].filter(Boolean).join(' · '),
          }),
        ]),
      ]),
    );
    requestAnimationFrame(() => { preenche.style.width = `${Math.max(2, ((Number(item.valor) || 0) / teto) * 100)}%`; });
    lista.append(linha);
  });
  view.append(lista);

  if (semValor) {
    view.append(el('p.nota-pe', {
      text: `${plural(semValor, 'uma está sem valor', 'estão sem valor')} — toque pra completar e ${semValor === 1 ? 'ela entra' : 'elas entram'} na conta.`,
    }));
  }

  view.append(botoesAssinatura(ctx));
  stagger(lista, '.assin');
  return view;
}

const botoesAssinatura = ctx => el('div.wrap', { style: { marginTop: 'var(--s-6)' } }, [
  el('button.btn.btn--sm', {
    type: 'button',
    onclick: () => editarCompromisso(null, () => ctx.rerender(), { tipo: 'assinatura', emoji: '🎧' }),
  }, [el('span', { text: '+ nova assinatura' })]),
  el('button.btn.btn--sm', {
    type: 'button',
    onclick: () => sugestoesAgenda(() => ctx.rerender(), {
      grupos: ['ASSINATURAS'], titulo: 'Assinaturas comuns',
    }),
  }, [el('span', { text: 'sugestões' })]),
]);

/* ══ CARTEIRA ═══════════════════════════════════════════════ */
function painelCarteira(ctx, mes) {
  const view = el('div.painel');
  const c = store.contasDoMes(mes);
  const hoje = todayKey();

  /* A carteira é o dinheiro do mês nas duas direções: o que entra e o que
     sai. O que sai vem de todo lado — agenda, assinatura, ou algo lançado
     aqui mesmo —, porque a pergunta desta tela é "quanto sobra", e ela não
     sobra diferente dependendo de onde você anotou. */
  /* Inclui o que ainda está sem valor: é tocando nele que você completa.
     Nas somas ele não entra — contasDoMes só soma o que tem número. */
  const entra = c.entradas;
  const sai = c.saidas;

  if (!entra.length && !sai.length) {
    view.append(el('div.empty', {}, [
      el('b', { text: 'Sem valores neste mês' }),
      el('p', { text: 'Registre o que você tem pra receber (pagamento, freela) e o que tem pra pagar. Marque quando cair ou quando quitar — o saldo do mês se atualiza sozinho.' }),
    ]));
    view.append(botoesCarteira(ctx));
    return view;
  }

  /* O número primeiro. Antes desta tela abrir com dois botões de cadastrar,
     que é o que se faz duas vezes por mês; o que se faz todo dia é olhar
     quanto sobra. */
  const sobra = c.totalEntrada - c.totalSaida;
  view.append(el('div.totalzao', {}, [
    el('p.micro', { text: sobra >= 0 ? 'SOBRA PREVISTA NO MÊS' : 'FALTA PRA FECHAR O MÊS' }),
    el('p.totalzao__n.num' + (sobra < 0 ? '.is-neg' : ''), { text: moeda(Math.abs(sobra)) }),
    el('p.nota-pe', { text: `${moeda(c.totalEntrada)} a receber · ${moeda(c.totalSaida)} a pagar` }),
    barras([
      { label: 'entra', valor: c.totalEntrada, texto: moeda(c.totalEntrada, { cents: 2 }), destaque: sobra >= 0 },
      { label: 'sai', valor: c.totalSaida, texto: moeda(c.totalSaida, { cents: 2 }), destaque: sobra < 0 },
    ], { atraso: 150 }),
  ]));

  if (entra.length) {
    view.append(bloco('A RECEBER', c.totalEntrada, c.recebido, 'já caiu'));
    view.append(listaAgenda(entra, mes, ctx, { verbo: 'caiu' }));
  }

  if (sai.length) {
    /* Três montes, não uma lista de nove. A pergunta "o que eu faço agora"
       não se responde numa fileira ordenada por dia do mês: vencido é agora,
       o resto é depois, e assinatura não é pra fazer nada — ela debita
       sozinha, então vive fechada numa linha só, somada. */
    const assinaturas = sai.filter(a => a.tipo === 'assinatura');
    const contas = sai.filter(a => a.tipo !== 'assinatura');
    const vencidas = contas.filter(a => a.data && a.data < hoje && !store.agendaFeito(a, mes));
    const resto = contas.filter(a => !vencidas.includes(a));

    view.append(bloco('A PAGAR', c.totalSaida, c.pago, 'já pago'));
    if (vencidas.length) {
      view.append(el('div.section__h.grupoh.is-urgente', {}, [
        el('p.micro', { text: 'PASSOU DO DIA' }),
        el('span.micro.grupoh__n', { text: moeda(soma(vencidas), { cents: 2 }) }),
      ]));
      view.append(listaAgenda(vencidas, mes, ctx, { verbo: 'pagou' }));
    }
    if (resto.length) {
      view.append(el('div.section__h.grupoh', {}, [
        el('p.micro', { text: vencidas.length ? 'O RESTO DO MÊS' : 'NO MÊS' }),
        el('span.micro.grupoh__n', { text: moeda(soma(resto), { cents: 2 }) }),
      ]));
      view.append(listaAgenda(resto, mes, ctx, { verbo: 'pagou' }));
    }
    if (assinaturas.length) {
      view.append(el('button.linhatudo', {
        type: 'button',
        onclick: () => { ctx.pessoalAba = 'assinaturas'; ctx.rerender(); },
      }, [
        el('span', { text: `${plural(assinaturas.length, 'assinatura', 'assinaturas')} · debitam sozinhas` }),
        el('span.linhatudo__s.num', { text: moeda(c.assinaturas, { cents: 2 }) }),
      ]));
    }
  }

  view.append(botoesCarteira(ctx));
  return view;
}

const soma = lista => lista.reduce((t, a) => t + (Number(a.valor) || 0), 0);

/* Cadastrar é raro: os botões vivem no fim, e sem o acento — que nesta tela
   pertence ao número, não ao "+". */
const botoesCarteira = ctx => el('div.wrap', { style: { marginTop: 'var(--s-6)' } }, [
  el('button.btn.btn--sm', {
    type: 'button',
    onclick: () => editarCompromisso(null, () => ctx.rerender(), { tipo: 'renda', emoji: '💰' }),
  }, [el('span', { text: '+ a receber' })]),
  el('button.btn.btn--sm', {
    type: 'button',
    onclick: () => editarCompromisso(null, () => ctx.rerender(), { tipo: 'conta', emoji: '💸' }),
  }, [el('span', { text: '+ a pagar' })]),
]);

/* Cabeçalho de bloco com a barra do quanto já foi resolvido. */
const bloco = (titulo, total, feito, verbo) => el('div.carteirabloco', {}, [
  el('div.section__h', {}, [el('p.micro', { text: titulo })]),
  /* Em coluna, dinheiro tem duas casas sempre: "R$ 9.800" ao lado de
     "R$ 2.300,00" faz a vírgula dançar e a coluna deixa de ser coluna. */
  el('div.dinheiro__l', {}, [
    el('span.num', { text: moeda(total, { cents: 2 }) }),
    barraProgresso(total ? feito / total : 0),
    el('span.dinheiro__f', {}, [
      el('span.num', { text: moeda(feito, { cents: 2 }) }),
      el('span.micro', { text: verbo }),
    ]),
  ]),
]);

/* Lista compartilhada pelas duas abas de dinheiro. */
function listaAgenda(itens, mes, ctx, { verbo }) {
  const hoje = todayKey();
  const lista = el('div.agenda', { style: { marginTop: 'var(--s-3)' } });
  itens.forEach(item => {
    const feito = store.agendaFeito(item, mes);
    const entra = store.fluxoDe(item) === 'entrada';
    const atrasado = !feito && item.data && item.data < hoje;
    const linha = el('div.agitem' + (feito ? '.is-feito' : '') + (atrasado ? '.is-atrasado' : ''), { 'data-tipo': item.tipo });
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
        /* "já pagou?" em toda linha era a mesma pergunta nove vezes — e a
           resposta é o próprio quadradinho ao lado. Fica só o que muda de
           linha pra linha: o dia, o atraso e a sua nota. */
        el('span.micro.agitem__d', {
          text: [
            item.dia ? `dia ${item.dia}` : 'sem data',
            atrasado ? `${verbo === 'caiu' ? 'não caiu' : 'não pago'}` : '',
            item.nota,
          ].filter(Boolean).join(' · '),
        }),
      ]),
      item.valor
        ? el('span.agitem__v.num' + (entra ? '.is-entra' : ''), { text: (entra ? '+' : '') + moeda(item.valor, { cents: 2 }) })
        : el('span.micro.agitem__v', { text: 'sem valor' }),
    ].filter(Boolean));
    lista.append(linha);
  });
  stagger(lista, '.agitem');
  return lista;
}

function painelTarefas(ctx) {
  const view = el('div.painel');
  const hoje = todayKey();
  const tab = ctx.todoTab || 'abertas';
  const ordem = store.ORDENS_TODO[store.state.settings.todoOrder] ? store.state.settings.todoOrder : 'manual';
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

  /* Um controle, uma pergunta: o botão diz a ordem em vigor e abre a folha
     que explica cada uma. Quatro chips soltos aqui roubariam a linha das
     abas, que é onde mora a conta de quanto falta. */
  if (list.length > 1 || ordem !== 'manual') {
    view.append(el('div.ordemlinha', {}, [
      el('button.ordembtn', {
        type: 'button',
        'aria-label': `Ordem da lista: ${store.ORDENS_TODO[ordem].label}`,
        onclick: () => escolherOrdem(ordem, () => ctx.rerender()),
      }, [
        el('span.ordembtn__i', { html: ORDEM_SVG }),
        el('span.micro', { text: store.ORDENS_TODO[ordem].label }),
      ]),
    ]));
  }

  /* A ordem agora é escolha, não regra fixa: 'Do meu jeito' é o arrasto de
     sempre (com quem tem dia marcado subindo), e as outras três respondem
     perguntas diferentes — o que vence antes, onde está aquela tarefa, o que
     eu acabei de escrever. A estrela segue sendo marca-texto e não mexe na
     ordem: ela brigava com o arrasto. */
  const sorted = store.ordenarTodos(list, ordem, hoje);

  const linhaTarefa = t => {
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

    /* A data continua na linha: é a única das quatro ações que também é
       informação — ela diz quando, não só deixa mudar. */
    const data = el('button.todo__data' + (t.due ? '.is-on' : '') + (t.due && t.due < hoje && !t.done ? '.is-atrasada' : ''), {
      type: 'button',
      'aria-label': t.due ? `Data: ${humanDay(t.due)}` : 'Marcar um dia pra fazer',
      title: t.due ? humanDay(t.due) : 'quando eu vou fazer',
    }, [t.due ? el('span.micro', { text: diaCurto(t.due) }) : el('span', { html: CAL_SVG })]);
    data.addEventListener('click', () => escolherDia(t, () => ctx.rerender()));

    /* Estrela e apagar saíram da linha. Somadas, comiam 70px de um celular
       de 393 — e o texto da tarefa, que é o conteúdo, ficava com 151. Agora
       moram na folha da tarefa, onde ainda cabe editar o texto inteiro com
       espaço pra ler. A estrela continua visível: é o fio no canto. */
    const mais = el('button.todo__mais', {
      type: 'button', 'aria-label': `Mais sobre: ${t.text}`, title: 'Estrela, apagar, editar',
      html: MAIS_SVG,
    });
    mais.addEventListener('click', () => folhaTarefa(t, ctx));

    /* Na ordem que não é a manual, a alça não existe — arrastar ali não faria
       nada, e escondida com opacity ela ainda roubava 50px da linha. */
    if (ordem === 'manual' && !t.done) {
      row.append(el('button.todo__pega', {
        type: 'button', 'aria-label': `Mover: ${t.text}`, title: 'Arraste para ordenar (ou use ↑ ↓)',
        html: PEGA_SVG,
      }));
    }
    row.append(box, txt, el('div.todo__act', {}, [data, mais]));
    if (t.done && t.doneAt) {
      row.append(el('span.micro.todo__feitaem', { text: humanDay(new Date(t.doneAt).toISOString().slice(0, 10)) }));
    }
    return row;
  };

  /* Na ordem por prazo a lista vira blocos de tempo. Vinte linhas seguidas
     não dizem o que é pra agora; "3 atrasadas / 2 hoje" diz na primeira
     olhada — e é justamente o que essa ordem foi escolhida pra responder.
     Nas outras ordens a lista é contínua: agrupar por data ali seria
     desmanchar a ordem que você pediu. */
  const listas = [];
  if (ordem === 'prazo') {
    const fimSemana = addDays(hoje, 7);
    const faixas = [
      ['ATRASADAS', t => !t.done && t.due && t.due < hoje],
      ['HOJE', t => !t.done && t.due === hoje],
      ['PRÓXIMOS 7 DIAS', t => !t.done && t.due && t.due <= fimSemana],
      ['DEPOIS', t => !t.done && t.due],
      ['SEM DIA MARCADO', t => !t.done],
      ['FEITAS', () => true],
    ];
    const resto = [...sorted];
    for (const [titulo, cabe] of faixas) {
      const desta = resto.filter(cabe);
      if (!desta.length) continue;
      desta.forEach(t => resto.splice(resto.indexOf(t), 1));
      listas.push([titulo, desta]);
    }
  } else {
    listas.push([null, sorted]);
  }

  const primeira = el('div.todos');
  for (const [titulo, itens] of listas) {
    const ul = titulo === null ? primeira : el('div.todos');
    itens.forEach(t => ul.append(linhaTarefa(t)));
    if (titulo) {
      view.append(el('div.section__h.grupoh' + (titulo === 'ATRASADAS' ? '.is-urgente' : ''), {}, [
        el('p.micro', { text: titulo }),
        el('span.micro.grupoh__n', { text: String(itens.length) }),
      ]));
    }
    view.append(ul);
    stagger(ul, '.todo');
  }

  if (tab !== 'feitas' && ordem === 'manual') {
    listaArrastavel(primeira, {
      itemSel: '.todo:not(.is-done)',
      pegaSel: '.todo__pega',
      aoSoltar: ids => { store.reorderTodos(ids); toast('ordem salva'); },
    });
  }

  /* Limpar concluídas saiu da linha dos filtros: era uma ação destrutiva
     dentro da fileira de filtros, e a quarta pílula estourava a largura do
     celular. Vive aqui, embaixo, e só onde ela faz sentido. */
  if (tab === 'feitas' && feitas.length) {
    view.append(el('button.btn.btn--sm.btn--danger', {
      type: 'button', style: { marginTop: 'var(--s-4)' },
      onclick: () => confirmSheet({
        title: 'Limpar concluídas?',
        text: `${plural(feitas.length, 'tarefa concluída será apagada', 'tarefas concluídas serão apagadas')}.`,
        ok: 'Limpar', danger: true,
        onOk: () => {
          const apagadas = store.clearDoneTodos();
          toast(plural(apagadas.length, 'apagada', 'apagadas'), {
            action: 'desfazer',
            onAction: () => { apagadas.forEach(t => store.restoreTodo(t)); ctx.rerender(); },
          });
          ctx.rerender();
        },
      }),
    }, [el('span', { text: `limpar ${plural(feitas.length, 'concluída', 'concluídas')}` })]));
  }

  return view;
}

/**
 * A folha de uma tarefa: o que não cabia na linha sem espremer o texto.
 * Editar aqui é confortável — a linha tem 200px, esta caixa tem a tela.
 */
function folhaTarefa(t, ctx) {
  openSheet('Tarefa', close => {
    const campo = el('textarea.note', { rows: 3, 'aria-label': 'Texto da tarefa' });
    campo.value = t.text;
    const salvarTexto = () => {
      const v = campo.value.trim();
      if (v && v !== t.text) { store.updateTodo(t.id, { text: v }); toast('editado'); }
    };
    return [
      campo,
      el('button.row.rowbtn', {
        type: 'button',
        onclick: () => { salvarTexto(); escolherDia(t, () => ctx.rerender()); },
      }, [
        el('div.row__l', {}, [
          el('p.row__t', { text: 'Quando' }),
          el('p.row__d', { text: t.due ? humanDay(t.due) : 'sem dia marcado' }),
        ]),
        el('span.micro', { text: t.due ? 'trocar' : 'marcar' }),
      ]),
      el('div.row', {}, [
        el('div.row__l', {}, [
          el('p.row__t', { text: 'Destacar' }),
          el('p.row__d', { text: 'Põe o fio no canto. Não muda a ordem.' }),
        ]),
        interruptor(!!t.star, v => { store.updateTodo(t.id, { star: v }); ctx.rerender(); }, 'Destacar'),
      ]),
      el('div.sheet__actions', {}, [
        el('button.btn.btn--danger', {
          type: 'button',
          onclick: () => {
            const apagada = store.removeTodo(t.id);
            close(); ctx.rerender();
            toast('tarefa apagada', {
              action: 'desfazer',
              onAction: () => { store.restoreTodo(apagada); ctx.rerender(); },
            });
          },
        }, [el('span', { text: 'apagar' })]),
        el('button.btn.btn--solid', {
          type: 'button',
          onclick: () => { salvarTexto(); close(); ctx.rerender(); },
        }, [el('span', { text: 'pronto' })]),
      ]),
    ];
  });
}

/** A folha da ordem: as quatro com o que cada uma responde, escrito. */
function escolherOrdem(atual, aoSalvar = () => {}) {
  openSheet('Ordem da lista', close => [
    el('p', {
      style: { color: 'var(--dim)', fontSize: 'var(--t-corpo)', marginBottom: 'var(--s-4)' },
      text: 'Vale pra esta lista e fica salva. Concluída sempre desce, em qualquer ordem.',
    }),
    ...Object.entries(store.ORDENS_TODO).map(([id, o]) =>
      el('button.row.rowbtn' + (id === atual ? '.is-on' : ''), {
        type: 'button', 'aria-pressed': String(id === atual),
        onclick: () => {
          store.setSetting('todoOrder', id);
          toast(`ordem: ${o.label.toLowerCase()}`);
          close();
          aoSalvar();
        },
      }, [
        el('div.row__l', {}, [
          el('p.row__t', { text: o.label }),
          el('p.row__d', { text: o.hint }),
        ]),
        el('span.rowbtn__m', {}, id === atual ? [check()] : []),
      ])),
  ]);
}

const ORDEM_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
  + 'stroke-width="1.8" stroke-linecap="round" aria-hidden="true">'
  + '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg>';

const MAIS_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">'
  + [6, 12, 18].map(x => `<circle cx="${x}" cy="12" r="1.7"/>`).join('') + '</svg>';
const PEGA_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">'
  + [4, 8, 12].map(y => [5, 11].map(x => `<circle cx="${x}" cy="${y}" r="1.4"/>`).join('')).join('')
  + '</svg>';
const CAL_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8">'
  + '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>';

/** dd/mm — cabe no lugar de um ícone; 'hoje' e 'amanhã' cabem melhor ainda. */
function diaCurto(k) {
  const hoje = todayKey();
  if (k === hoje) return 'hoje';
  const d = parseKey(hoje); d.setDate(d.getDate() + 1);
  if (k === keyOf(d)) return 'amanhã';
  return `${k.slice(8)}/${k.slice(5, 7)}`;
}

/**
 * A folha de escolher o dia. Native <input type=date> pro calendário do
 * sistema, e três atalhos pro caso comum — que é hoje, amanhã ou tirar.
 */
export function escolherDia(t, aoSalvar = () => {}) {
  openSheet(t.text, close => {
    const grava = due => {
      store.updateTodo(t.id, { due });
      toast(due ? `marcada pra ${humanDay(due)}` : 'sem data');
      close();
      aoSalvar();
    };
    const campo = el('input', { type: 'date', value: t.due || todayKey(), 'aria-label': 'Dia' });
    const amanha = parseKey(todayKey()); amanha.setDate(amanha.getDate() + 1);

    return [
      el('p', {
        style: { color: 'var(--dim)', fontSize: 'var(--t-corpo)', marginBottom: 'var(--s-4)' },
        text: 'Que dia você vai fazer? Ela aparece no calendário do mês e sobe na lista quando o dia chega. Não entra na conta da rotina — tarefa se empurra pra frente, e o check-in não pode virar cobrança de recado.',
      }),
      el('div.chips', {}, [
        ['hoje', todayKey()], ['amanhã', keyOf(amanha)],
      ].map(([rot, k]) => el('button.chip' + (t.due === k ? '.is-on' : ''), {
        type: 'button', onclick: () => grava(k), text: rot,
      }))),
      el('div.field', {}, [el('p.micro', { text: 'OU ESCOLHA' }), campo]),
      el('div.sheet__actions', {}, [
        t.due
          ? el('button.btn.btn--sm', { type: 'button', onclick: () => grava(null) }, [el('span', { text: 'tirar a data' })])
          : null,
        el('button.btn.btn--solid', {
          type: 'button', onclick: () => grava(campo.value || null),
        }, [el('span', { text: 'salvar' })]),
      ].filter(Boolean)),
    ];
  });
}


export { todayKey };
