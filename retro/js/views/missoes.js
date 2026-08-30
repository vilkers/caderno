/* views/missoes.js — a lista de afazeres virou lista de missões. */

import { el } from '../../../js/utils.js';
import * as store from '../../../js/store.js';
import * as sfx from '../../../temas/pixel/sfx.js';
import { sprite } from '../../../temas/pixel/sprites.js';
import { aviso, confirma } from '../ui.js';

export function render(ctx) {
  const tela = el('div.tela');
  const todas = store.listTodos();
  const abertas = todas.filter(t => !t.done);
  const feitas = todas.filter(t => t.done);
  const aba = ctx.aba || 'abertas';

  tela.append(el('div.titulo', {}, [
    el('h2.t16.sombra', { text: 'MISSÕES' }),
    el('p.t8', { style: { color: 'var(--tinta2)' }, text: `${abertas.length} ABERTAS · ${feitas.length} FEITAS` }),
  ]));

  const campo = el('input', { type: 'text', placeholder: 'Nova missão…', 'aria-label': 'Nova missão', enterkeyhint: 'done' });
  const add = () => {
    const t = store.addTodo(campo.value);
    if (!t) return;
    campo.value = '';
    sfx.powerup();
    ctx.aba = 'abertas';
    ctx.rerender();
    setTimeout(() => tela.querySelector('.addmissao input')?.focus(), 30);
  };
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  tela.append(el('div.addmissao', {}, [campo, el('button.btn.btn--v', { type: 'button', onclick: add, text: '+' })]));

  tela.append(el('div.linha', { style: { marginBottom: '12px' } }, [
    ...[['abertas', `ABERTAS ${abertas.length}`], ['feitas', `FEITAS ${feitas.length}`], ['todas', 'TODAS']]
      .map(([id, r]) => el('button.btn.btn--peq' + (aba === id ? '.btn--a' : ''), {
        type: 'button', text: r, onclick: () => { ctx.aba = id; ctx.rerender(); },
      })),
    feitas.length ? el('button.btn.btn--peq', {
      type: 'button', text: 'LIMPAR',
      onclick: () => confirma({
        titulo: 'LIMPAR FEITAS?', texto: `${feitas.length} missão(ões) concluída(s) serão apagadas.`,
        ok: 'LIMPAR',
        onOk: () => {
          const apagadas = store.clearDoneTodos();
          sfx.bump();
          ctx.rerender();
          aviso(`${apagadas.length} APAGADA(S)`, {
            acao: 'DESFAZER',
            aoClicar: () => { apagadas.forEach(t => store.restoreTodo(t)); ctx.rerender(); },
          });
        },
      }),
    }) : null,
  ]));

  const lista = aba === 'abertas' ? abertas : aba === 'feitas' ? feitas : todas;
  if (!lista.length) {
    tela.append(el('div.vazio', {}, [
      el('p.t10', { text: aba === 'feitas' ? 'NADA FEITO AINDA' : 'SEM MISSÕES' }),
      el('p', { style: { marginTop: '8px', fontSize: '14px' },
        text: aba === 'feitas' ? 'O que você concluir aparece aqui.' : 'Escreva ali em cima e aperte Enter.' }),
    ]));
    return tela;
  }

  const box = el('div.missoes');
  [...lista]
    .sort((x, y) => (y.star ? 1 : 0) - (x.star ? 1 : 0) || (x.done ? 1 : 0) - (y.done ? 1 : 0) || y.createdAt - x.createdAt)
    .forEach(t => {
      const linha = el('div.missao' + (t.done ? '.feita' : ''));
      const cx = el('button.missao__cx', { type: 'button', 'aria-label': t.done ? 'Reabrir' : 'Concluir' });
      if (t.done) cx.append(sprite('moeda_a', { scale: 2 }));
      cx.addEventListener('click', () => {
        const novo = !t.done;
        store.updateTodo(t.id, { done: novo });
        novo ? sfx.moeda() : sfx.bump();
        if (novo) aviso('+1 MOEDA', { acao: 'DESFAZER', aoClicar: () => { store.updateTodo(t.id, { done: false }); ctx.rerender(); } });
        ctx.rerender();
      });

      const txt = el('span.missao__t', { text: t.text, contenteditable: 'plaintext-only', spellcheck: 'false' });
      txt.addEventListener('blur', () => {
        const v = txt.textContent.trim();
        if (!v) { txt.textContent = t.text; return; }
        if (v !== t.text) { store.updateTodo(t.id, { text: v }); aviso('EDITADA'); }
      });
      txt.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); txt.blur(); }
        if (e.key === 'Escape') { txt.textContent = t.text; txt.blur(); }
      });

      const estrela = el('button.missao__x', { type: 'button', 'aria-label': 'Fixar', text: t.star ? '★' : '☆' });
      estrela.addEventListener('click', () => { store.updateTodo(t.id, { star: !t.star }); sfx.passo(); ctx.rerender(); });

      const apagar = el('button.missao__x', { type: 'button', 'aria-label': 'Apagar', text: '✕' });
      apagar.addEventListener('click', () => {
        const snap = store.removeTodo(t.id);
        sfx.bump();
        ctx.rerender();
        aviso('APAGADA', { acao: 'DESFAZER', aoClicar: () => { store.restoreTodo(snap); ctx.rerender(); } });
      });

      linha.append(cx, txt, estrela, apagar);
      box.append(linha);
    });
  tela.append(box);
  return tela;
}
