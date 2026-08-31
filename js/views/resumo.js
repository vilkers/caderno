/* views/resumo.js — a retrospectiva, em cartões de tela cheia.

   Um cartão por vez, tipografia grande entrando palavra a palavra, número
   subindo. Toque na direita avança, na esquerda volta; setas e deslizar
   fazem o mesmo. Enquanto ela está aberta o app some — é o único lugar do
   caderno que pede a tela inteira. */

import { el, nf } from '../utils.js';
import { cartoes, PERIODOS } from '../resumo.js';
import { countUp, motionOn, onSwipe } from '../ui.js';
import { anel, barras, colunas, malha, trilha, barraProgresso } from '../graficos.js';
import { LEVELS } from '../badges.js';

export function render(ctx) {
  const periodo = ctx.resumoPeriodo || 'tudo';
  const lista = cartoes(periodo);
  let i = Math.min(ctx.resumoIndice || 0, lista.length - 1);

  const view = el('div.view.resumo');
  document.body.classList.add('modo-imersivo');

  /* barrinhas de progresso, como as de story */
  const trilhas = el('div.resumo__trilhas', {},
    lista.map((_, n) => el('span.resumo__trilha', { 'data-n': n })));

  const palco = el('div.resumo__palco');

  const sair = () => {
    document.body.classList.remove('modo-imersivo');
    ctx.resumoIndice = 0;
    ctx.voltar();
  };

  const topo = el('div.resumo__topo', {}, [
    trilhas,
    el('div.resumo__acoes', {}, [
      /* Trocar o período é uma decisão da capa: depois que a história
         começou, o seletor competia com o cartão em todas as nove telas.
         Some ao virar a página e volta ao voltar pro começo. */
      el('div.chips.resumo__periodos', {}, PERIODOS.map(p =>
        el('button.chip' + (periodo === p.id ? '.is-on' : ''), {
          type: 'button', text: p.label,
          onclick: e => { e.stopPropagation(); ctx.resumoPeriodo = p.id; ctx.resumoIndice = 0; ctx.rerender(); },
        }))),
      el('button.iconbtn', { type: 'button', 'aria-label': 'Fechar', text: '✕', onclick: sair }),
    ]),
  ]);

  const pinta = () => {
    const c = lista[i];
    trilhas.querySelectorAll('.resumo__trilha').forEach((t, n) => {
      t.classList.toggle('is-feita', n < i);
      t.classList.toggle('is-atual', n === i);
    });
    palco.replaceChildren(cartao(c, i));
    palco.dataset.cartao = c.id;
    topo.querySelector('.resumo__periodos').hidden = i !== 0;
  };

  const vai = passo => {
    const novo = i + passo;
    if (novo < 0) return;
    if (novo >= lista.length) { sair(); return; }
    i = novo;
    ctx.resumoIndice = i;
    pinta();
  };

  /* toque: metade direita avança, esquerda volta */
  palco.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    const r = palco.getBoundingClientRect();
    vai(e.clientX - r.left > r.width * 0.32 ? 1 : -1);
  });
  onSwipe(palco, { left: () => vai(1), right: () => vai(-1) });

  view.append(topo, palco);
  view.tabIndex = -1;
  view.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); vai(1); }
    if (e.key === 'ArrowLeft') vai(-1);
    if (e.key === 'Escape') sair();
  });
  setTimeout(() => view.focus(), 40);

  pinta();
  return view;
}

/* ── Um cartão ─────────────────────────────────────────────── */
function cartao(c, indice) {
  const caixa = el('div.card' + (c.capa ? '.card--capa' : '') + (c.fim ? '.card--fim' : ''), {
    style: { '--tom': String(indice % 5) },
  });

  if (c.olho) caixa.append(el('p.card__olho.micro', { text: c.olho }));

  if (c.numero !== undefined) {
    const n = el('span.card__num.num', { text: '0' });
    caixa.append(el('p.card__numlinha', {}, [n, el('span.card__suf', { text: c.sufixo || '' })]));
    countUp(n, c.numero, { ms: 1100 });
  }

  const texto = el('h2.card__t.display');
  (c.linhas || []).forEach((linha, li) => {
    const l = el('span.card__linha');
    linha.split(' ').forEach((palavra, pi) => {
      l.append(el('span.card__p', { style: { '--i': String(li * 3 + pi) }, text: palavra }));
      l.append(document.createTextNode(' '));
    });
    texto.append(l);
  });
  caixa.append(texto);

  if (c.g) caixa.append(grafico(c.g));

  if (c.nota) caixa.append(el('p.card__nota', { text: c.nota }));

  if (c.capa) caixa.append(el('p.card__dica.micro', { text: motionOn() ? 'TOQUE PARA COMEÇAR →' : 'TOQUE PARA AVANÇAR →' }));
  if (c.fim) {
    caixa.append(el('button.btn.btn--solid', {
      type: 'button', style: { marginTop: '1.4rem' },
      onclick: e => {
        e.stopPropagation();
        document.body.classList.remove('modo-imersivo');
        location.hash = '';
        history.back();
      },
    }, [el('span', { text: 'voltar pro caderno' })]));
  }
  return caixa;
}

/* ── O desenho de cada cartão ──────────────────────────────── */
/* O número já está escrito em corpo gigante; o gráfico serve pra dar a
   proporção — quanto de um todo, comparado com o quê, distribuído como. */
function grafico(g) {
  const caixa = el('div.card__g');
  const espera = 620;   // entra depois do texto, não junto

  if (g.tipo === 'anel') {
    caixa.append(el('div.card__g-linha', {}, [
      anel(g.pct, { tamanho: 168, espessura: 15, texto: `${Math.round(g.pct * 100)}%`, atraso: espera }),
      g.legenda ? el('p.micro', { text: g.legenda.toUpperCase() }) : null,
    ]));
  } else if (g.tipo === 'barras') {
    caixa.append(barras(g.itens, { atraso: espera }));
  } else if (g.tipo === 'colunas') {
    caixa.append(colunas(g.valores, { labels: g.labels, destaque: g.destaque, altura: 168, atraso: espera }));
  } else if (g.tipo === 'malha') {
    caixa.append(malha(g.itens, { atraso: espera }));
    const feitos = g.itens.filter(i => i.on).length;
    caixa.append(el('p.micro', { text: `${feitos} DE ${g.itens.length} QUADRADINHOS` }));
  } else if (g.tipo === 'trilha') {
    caixa.append(trilha(g.n, { max: 21, atraso: espera }));
  } else if (g.tipo === 'escada') {
    caixa.append(escada(g, espera));
  } else if (g.tipo === 'placar') {
    caixa.append(el('div.card__placar', {}, g.itens.map(([n, l], i) => {
      const num = el('span.card__placar-n.num', { text: motionOn() ? '0' : String(n) });
      if (motionOn()) countUp(num, n, { ms: 900 });
      return el('div.card__placar-i', { style: { '--i': String(i) } }, [num, el('span.micro', { text: l })]);
    })));
  }
  return caixa;
}

/* A régua dos oito níveis, com você em algum degrau dela. */
function escada(g, espera) {
  const caixa = el('div.card__escada');
  LEVELS.forEach((nivel, i) => {
    const degrau = el('span.card__degrau' + (i < g.atual ? '.is-feito' : i === g.atual ? '.is-atual' : ''), {
      title: nivel.name,
      style: { '--i': String(i), height: `${40 + i * 11}px` },
    });
    caixa.append(degrau);
  });
  return el('div.card__g-linha', {}, [
    caixa,
    el('div.card__escada-pe', {}, [
      barraProgresso(g.pct, { atraso: espera + 200 }),
      el('p.micro', {
        text: g.atual + 1 < LEVELS.length
          ? `${Math.round(g.pct * 100)}% ATÉ ${LEVELS[g.atual + 1].name.toUpperCase()}`
          : 'ÚLTIMO DEGRAU DA RÉGUA',
      }),
    ]),
  ]);
}
