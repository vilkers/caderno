/* views/placar.js — a tela de fim de fase: pontuação, mundo atual e a
   vitrine de troféus. Os mesmos números do clássico, com outra roupa. */

import { el, lastNDays, nf } from '../../../js/utils.js';
import * as store from '../../../js/store.js';
import { summary, LEVELS } from '../../../js/badges.js';
import { loggedDays, logStreak, currentStreak, bestStreak, meanLogged, did, isReduce, suggestions } from '../../../js/analysis.js';
import { sprite } from '../sprites.js';
import { caixa } from '../ui.js';
import * as sfx from '../sfx.js';

export function render(ctx) {
  const tela = el('div.tela');
  const b = summary();
  const faixa = ctx.range || 30;
  const dias = lastNDays(faixa);
  const registrados = loggedDays(dias);

  tela.append(el('div.titulo', {}, [
    el('h2.t16.sombra', { text: 'PLACAR' }),
    el('div.linha', {}, [7, 30, 90].map(n =>
      el('button.btn.btn--peq' + (faixa === n ? '.btn--a' : ''), {
        type: 'button', text: `${n}D`,
        onclick: () => { sfx.passo(); ctx.range = n; ctx.rerender(); },
      }))),
  ]));

  /* mundo atual */
  const barra = el('i');
  tela.append(el('div.mundo', {}, [
    el('p.t8', { style: { color: 'var(--tinta2)' }, text: `MUNDO ${b.level.i + 1}-1 DE ${LEVELS.length}` }),
    el('p.mundo__n', { text: b.level.name.toUpperCase() }),
    el('p.mundo__l', { text: b.level.lore }),
    el('div.barra', {}, [barra]),
    el('p.t8', {
      text: b.level.proximo
        ? `FALTAM ${b.level.falta} XP PARA "${b.level.proximo.name.toUpperCase()}"`
        : 'ÚLTIMO MUNDO. ZEROU O JOGO.',
    }),
  ]));
  requestAnimationFrame(() => { barra.style.width = `${Math.round(b.level.pct * 100)}%`; });

  /* pontuação */
  tela.append(el('div.placar', {}, [
    linha('PONTOS', String(b.xp).padStart(6, '0')),
    linha('MOEDAS', `${b.ganhas}/${b.total}`),
    linha('SEQUÊNCIA', `${logStreak()} DIAS`),
    linha('REGISTRADOS', `${registrados}/${faixa}`),
    linha('MISSÕES ABERTAS', String(store.openTodos().length)),
  ]));

  /* frequência por categoria */
  const cats = store.activeCategories().filter(c => c.type !== 'text');
  if (registrados) {
    tela.append(el('p.t10', { style: { margin: '16px 0 8px' }, text: 'FREQUÊNCIA' }));
    const lista = el('div.placar');
    for (const c of cats) {
      const acertos = dias.filter(k => did(c, k)).length;
      const valor = c.type === 'toggle'
        ? `${nf(registrados ? (acertos / registrados) * 100 : 0)}%`
        : `${nf(meanLogged(c, dias), 1)}${c.unit ? ' ' + c.unit : ''}`;
      const seq = currentStreak(c);
      lista.append(el('div.placar__l', {}, [
        el('span', { text: `${c.emoji || ''} ${c.label}`.trim().toUpperCase() }),
        el('b', { text: seq > 1 ? `${valor}  ${isReduce(c) ? '∅' : '↑'}${seq}` : valor }),
      ]));
    }
    tela.append(lista);
  }

  /* troféus */
  tela.append(el('p.t10', { style: { margin: '16px 0 8px' }, text: `TROFÉUS ${b.ganhas}/${b.total}` }));
  const vitrine = el('div.trofeus');
  b.lista.forEach(t => {
    const card = el('button.trofeu' + (t.got ? '' : '.travado'), {
      type: 'button',
      onclick: () => {
        sfx.passo();
        caixa(t.name.toUpperCase(), close => [
          el('div', { style: { display: 'grid', justifyItems: 'center', gap: '12px' } }, [
            sprite(t.got ? 'estrela' : 'bloco', { scale: 4 }),
            el('p', { style: { fontSize: '15px', textAlign: 'center' }, text: t.desc }),
            el('p.t8', {
              style: { color: t.got ? 'var(--ouro)' : 'var(--tinta2)' },
              text: t.got
                ? (t.at ? `EM ${new Date(t.at).toLocaleDateString('pt-BR')}` : 'CONQUISTADO')
                : (t.hint ? `FALTA: ${t.hint.toUpperCase()}` : 'AINDA NÃO'),
            }),
          ]),
          el('div.modal__acoes', {}, [el('button.btn.btn--v', { type: 'button', onclick: close, text: 'FECHAR' })]),
        ]);
      },
    }, [
      sprite(t.got ? 'estrela' : 'bloco', { scale: 2 }),
      el('span.trofeu__n', { text: t.name.toUpperCase() }),
      el('span.trofeu__h', { text: t.got ? '★' : (t.hint || '—') }),
    ]);
    vitrine.append(card);
  });
  tela.append(vitrine);

  /* leituras */
  const dicas = suggestions(4);
  if (dicas.length) {
    tela.append(el('p.t10', { style: { margin: '16px 0 8px' }, text: 'RELATÓRIO' }));
    const cx = el('div.placar');
    dicas.forEach(d => cx.append(el('div', {
      style: { padding: '12px', background: 'rgba(0,0,0,.35)', boxShadow: '0 0 0 2px #000 inset' },
    }, [
      el('p.t8', { style: { color: 'var(--ouro)' }, text: `${d.kind.toUpperCase()} · ${d.title}` }),
      el('p', { style: { fontSize: '14px', marginTop: '6px', lineHeight: '1.6' },
        html: d.text.replace(/<b>/g, '<b style="color:var(--ouro);font-weight:400">') }),
    ])));
    tela.append(cx);
  }

  return tela;
}

const linha = (rot, val) => el('div.placar__l', {}, [el('span', { text: rot }), el('b', { text: val })]);
