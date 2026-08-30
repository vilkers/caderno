/* views/todos.js — lista de afazeres: campo sempre no topo,
   Enter adiciona, toque conclui, texto edita no lugar. */

import { el, humanDay, todayKey } from '../utils.js';
import * as store from '../store.js';
import { toast, stagger, confirmSheet } from '../ui.js';
import { check } from './today.js';

export function render(ctx) {
  const view = el('div.view');
  const tab = ctx.todoTab || 'abertas';
  const todos = store.state.todos;
  const abertas = todos.filter(t => !t.done);
  const feitas = todos.filter(t => t.done);

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '03 — LISTA' }),
      el('h2.display.h-lg', { text: 'AFAZERES' }),
    ]),
    el('div.vhead__r', {}, [
      el('p.micro', { text: `${abertas.length} ABERTAS · ${feitas.length} FEITAS` }),
    ]),
  ]));

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
        onOk: () => { store.clearDoneTodos(); toast('lista limpa'); ctx.rerender(); },
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
  const sorted = [...list].sort((a, b) =>
    (b.star ? 1 : 0) - (a.star ? 1 : 0) || (a.done ? 1 : 0) - (b.done ? 1 : 0) || b.createdAt - a.createdAt);

  for (const t of sorted) {
    const row = el('div.todo' + (t.done ? '.is-done' : ''));

    const box = el('button.todo__box', { type: 'button', 'aria-label': t.done ? 'Reabrir' : 'Concluir' }, [check()]);
    box.addEventListener('click', () => {
      const next = !t.done;
      store.updateTodo(t.id, { done: next });
      row.classList.toggle('is-done', next);
      if (next) toast('feito');
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

    const star = el('button.star' + (t.star ? '.is-on' : ''), { type: 'button', 'aria-label': 'Fixar no topo', html: starSvg });
    star.addEventListener('click', () => {
      store.updateTodo(t.id, { star: !t.star });
      star.classList.toggle('is-on', !t.star);
      ctx.rerender();
    });

    const del = el('button.todo__x', { type: 'button', 'aria-label': 'Apagar', html: xSvg });
    del.addEventListener('click', () => {
      row.classList.add('is-leaving');
      setTimeout(() => { store.removeTodo(t.id); ctx.rerender(); }, 300);
    });

    row.append(box, txt, el('div.todo__act', {}, [star, del]));
    if (t.done && t.doneAt) {
      row.append(el('span.micro', { text: humanDay(new Date(t.doneAt).toISOString().slice(0, 10)) }));
    }
    ul.append(row);
  }
  view.append(ul);
  stagger(ul, '.todo');
  return view;
}

const starSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 3.5l2.6 5.5 5.9.8-4.3 4.2 1 6-5.2-2.9L6.8 20l1-6L3.5 9.8l5.9-.8z"/></svg>';
const xSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export { todayKey };
