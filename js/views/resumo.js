/* views/resumo.js — a retrospectiva, em cartões de tela cheia.

   Um cartão por vez, tipografia grande entrando palavra a palavra, número
   subindo. Toque na direita avança, na esquerda volta; setas e deslizar
   fazem o mesmo. Enquanto ela está aberta o app some — é o único lugar do
   caderno que pede a tela inteira. */

import { el } from '../utils.js';
import { cartoes, PERIODOS } from '../resumo.js';
import { countUp, motionOn, onSwipe } from '../ui.js';

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
      el('div.chips', {}, PERIODOS.map(p =>
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
