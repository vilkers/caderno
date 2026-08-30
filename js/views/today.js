/* views/today.js — o check-in do dia: um cartão por categoria,
   alvo grande, um toque salva. Nada de "salvar" no fim. */

import { el, $, humanDay, longDay, todayKey, addDays, clamp, nf } from '../utils.js';
import * as store from '../store.js';
import { currentStreak, goalProgress, isReduce } from '../analysis.js';
import { toast, stagger, onSwipe } from '../ui.js';

const HOUR_PRESETS = [2, 4, 6, 8];

export function render(ctx) {
  const day = ctx.day;
  const cats = store.activeCategories();
  const rec = store.getDay(day) || { v: {}, note: '' };
  const view = el('div.view');

  /* ── cabeçalho + navegação de dia ── */
  const label = el('span.daynav__label', { text: humanDay(day) });
  const nav = el('div.daynav', {}, [
    iconBtn('M15 6l-6 6 6 6', () => ctx.setDay(addDays(day, -1)), 'Dia anterior'),
    label,
    iconBtn('M9 6l6 6-6 6', () => ctx.setDay(addDays(day, 1)), 'Próximo dia'),
  ]);
  if (day !== todayKey()) {
    nav.append(el('button.chip', { onclick: () => ctx.setDay(todayKey()), text: 'hoje' }));
  }

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: `01 — CHECK-IN · ${longDay(day)}` }),
      el('h2.display.h-lg', { text: humanDay(day) === 'Hoje' ? 'HOJE' : humanDay(day).toUpperCase() }),
    ]),
    el('div.vhead__r', {}, [nav]),
  ]));

  /* ── resumo + fechar o dia ── */
  const answered = cats.filter(c => rec.v[c.id] !== undefined && rec.v[c.id] !== false).length;
  const bar = el('div.progress__bar');
  const summary = el('div.summary', {}, [
    el('div', {}, [
      el('p.micro', { text: 'PREENCHIDO' }),
      el('p', { class: 'num', style: { fontSize: '1.3rem', marginTop: '.2rem' },
        text: `${answered}/${cats.length}` }),
    ]),
    el('div.progress', {}, [bar]),
    el('button.btn' + (rec.closed ? '.btn--solid' : ''), {
      type: 'button',
      onclick: () => {
        store.closeDay(day, !rec.closed);
        toast(rec.closed ? 'dia reaberto' : 'dia fechado');
        ctx.rerender();
      },
    }, [el('span', { text: rec.closed ? 'DIA FECHADO ✓' : 'FECHAR O DIA' })]),
  ]);
  view.append(summary);
  requestAnimationFrame(() => { bar.style.width = `${cats.length ? (answered / cats.length) * 100 : 0}%`; });

  /* ── categorias ── */
  const entries = el('div.entries');
  if (!cats.length) {
    entries.append(el('div.empty', {}, [
      el('b', { text: 'Nenhuma categoria ativa' }),
      el('p', { text: 'Crie as suas em Ajustes → Categorias.' }),
      el('button.btn.btn--sm', { style: { marginTop: '1rem' }, onclick: () => ctx.go('ajustes') },
        [el('span', { text: 'Abrir ajustes' })]),
    ]));
  }
  cats.forEach(cat => entries.append(entryCard(cat, day, ctx)));

  /* ── nota do dia ── */
  const note = el('textarea.note', {
    placeholder: 'Como foi o dia? (opcional)',
    rows: 3,
  });
  note.value = rec.note || '';
  let noteT;
  note.addEventListener('input', () => {
    clearTimeout(noteT);
    noteT = setTimeout(() => store.setNote(day, note.value.trim()), 400);
  });
  entries.append(el('div.entry.entry--wide', {}, [
    el('div.entry__top', {}, [
      el('div.entry__id', {}, [el('span.entry__emoji', { text: '✍️' }), el('span.entry__label', { text: 'Anotação' })]),
      el('span.micro', { text: 'OPCIONAL' }),
    ]),
    el('div.entry__ctl', {}, [note]),
  ]));

  view.append(entries);

  /* ── afazeres em aberto ── */
  const abertas = store.openTodos().slice(0, 3);
  if (abertas.length) {
    view.append(el('div.section', { style: { marginTop: '2rem' } }, [
      el('div.section__h', {}, [el('p.micro', { text: 'NA LISTA HOJE' })]),
      el('div.todos', {}, abertas.map(t => el('div.todo', {}, [
        el('button.todo__box', {
          'aria-label': 'Concluir', onclick: e => {
            store.updateTodo(t.id, { done: true });
            e.currentTarget.closest('.todo').classList.add('is-leaving');
            toast('feito');
            setTimeout(() => ctx.rerender(), 320);
          },
        }, [check()]),
        el('span.todo__txt', { text: t.text }),
      ]))),
      el('button.btn.btn--sm.btn--ghost', { style: { marginTop: '.8rem' }, onclick: () => ctx.go('lista') },
        [el('span', { text: `ver todas (${store.openTodos().length})` })]),
    ]));
  }

  stagger(entries, ':scope > .entry');
  onSwipe(view, { left: () => ctx.setDay(addDays(day, 1)), right: () => ctx.setDay(addDays(day, -1)) });
  return view;
}

/* ── Cartão de uma categoria ───────────────────────────────── */
function entryCard(cat, day, ctx) {
  const val = store.getVal(day, cat.id);
  const card = el('div.entry' + (cat.type === 'text' ? '.entry--wide' : ''));
  const on = cat.type === 'toggle' ? !!val : Number(val) > 0;
  if (on) card.classList.add('is-on');

  const meta = el('div.entry__meta');
  if (store.state.settings.showStreaks) {
    const s = currentStreak(cat, day);
    if (s > 1) meta.append(el('span.entry__streak', { text: (isReduce(cat) ? '∅ ' : '↑ ') + s + 'd' }));
  }
  const gp = goalProgress(cat, day);
  if (gp) {
    meta.append(el('span.entry__streak', {
      title: `Meta: ${gp.mode === 'min' ? 'no mínimo' : 'no máximo'} ${gp.value} por ${gp.period === 'day' ? 'dia' : 'semana'}`,
      text: `${nf(gp.done, gp.done % 1 ? 1 : 0)}/${gp.value}${gp.period === 'week' ? '·sem' : ''}`,
      style: { color: gp.ok ? 'var(--accent)' : '' },
    }));
  }

  card.append(el('div.entry__top', {}, [
    el('div.entry__id', {}, [
      el('span.entry__emoji', { text: cat.emoji || '•' }),
      el('span.entry__label', { text: cat.label }),
    ]),
    meta,
  ]));

  card.append(el('div.entry__ctl', {}, [control(cat, day, card, ctx)]));
  return card;
}

/* ── Controles por tipo ────────────────────────────────────── */
function control(cat, day, card, ctx) {
  const save = v => {
    store.setVal(day, cat.id, v);
    ctx.softRefresh?.();
  };

  if (cat.type === 'toggle') {
    const on0 = !!store.getVal(day, cat.id);
    const btn = el('button.tog', { type: 'button', 'aria-pressed': String(on0) });
    const txt = el('span', { text: on0 ? 'FEITO' : 'MARCAR' });
    btn.append(txt, el('span.tog__mark', {}, [check()]));
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(next));
      txt.textContent = next ? 'FEITO' : 'MARCAR';
      card.classList.toggle('is-on', next);
      save(next);
    });
    return btn;
  }

  if (cat.type === 'count') {
    const wrap = el('div');
    const cur = () => Number(store.getVal(day, cat.id) || 0);
    const valEl = el('span.step__val.num', { text: String(cur()) });
    if (!cur()) valEl.classList.add('is-zero');
    const set = n => {
      const v = clamp(n, 0, cat.max || 99);
      valEl.textContent = String(v);
      valEl.classList.toggle('is-zero', !v);
      valEl.classList.remove('pop'); void valEl.offsetWidth; valEl.classList.add('pop');
      card.classList.toggle('is-on', v > 0);
      wrap.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-on', Number(c.dataset.v) === v));
      save(v);
    };
    wrap.append(el('div.step', {}, [
      el('button.step__btn', { type: 'button', 'aria-label': 'Menos', onclick: () => set(cur() - 1), text: '−' }),
      el('span', {}, [valEl, el('span.step__unit', { text: cat.unit || '' })]),
      el('button.step__btn', { type: 'button', 'aria-label': 'Mais', onclick: () => set(cur() + 1), text: '+' }),
    ]));
    const chips = el('div.chips', {}, [0, 1, 2, 3, 5].map(n =>
      el('button.chip' + (cur() === n ? '.is-on' : ''), { type: 'button', 'data-v': n, onclick: () => set(n), text: String(n) })));
    wrap.append(chips);
    return wrap;
  }

  if (cat.type === 'hours') {
    const max = cat.max || 16;
    const cur = () => Number(store.getVal(day, cat.id) || 0);
    const wrap = el('div');
    const valEl = el('span.step__val.num', { text: fmtH(cur()) });
    if (!cur()) valEl.classList.add('is-zero');
    const slider = el('input.slider', { type: 'range', min: 0, max, step: 0.5, value: cur(), 'aria-label': cat.label });
    const set = n => {
      const v = clamp(Math.round(n * 2) / 2, 0, max);
      valEl.textContent = fmtH(v);
      valEl.classList.toggle('is-zero', !v);
      slider.value = v;
      card.classList.toggle('is-on', v > 0);
      wrap.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-on', Number(c.dataset.v) === v));
      save(v);
    };
    wrap.append(el('div.step', {}, [
      el('button.step__btn', { type: 'button', 'aria-label': 'Menos', onclick: () => set(cur() - 0.5), text: '−' }),
      el('span', {}, [valEl, el('span.step__unit', { text: cat.unit || 'h' })]),
      el('button.step__btn', { type: 'button', 'aria-label': 'Mais', onclick: () => set(cur() + 0.5), text: '+' }),
    ]));
    slider.addEventListener('input', () => set(Number(slider.value)));
    wrap.append(slider);
    wrap.append(el('div.chips', {}, HOUR_PRESETS.filter(h => h <= max).map(h =>
      el('button.chip' + (cur() === h ? '.is-on' : ''), { type: 'button', 'data-v': h, onclick: () => set(h), text: `${h}h` }))));
    return wrap;
  }

  if (cat.type === 'scale') {
    const cur = () => Number(store.getVal(day, cat.id) || 0);
    const box = el('div.scale');
    [1, 2, 3, 4, 5].forEach(n => {
      const b = el('button.scale__dot' + (cur() === n ? '.is-on' : ''), { type: 'button', text: String(n) });
      b.addEventListener('click', () => {
        const next = cur() === n ? 0 : n;
        box.querySelectorAll('.scale__dot').forEach((d, i) => d.classList.toggle('is-on', i + 1 === next));
        card.classList.toggle('is-on', next > 0);
        save(next);
      });
      box.append(b);
    });
    return box;
  }

  /* text */
  const ta = el('textarea.note', { rows: 2, placeholder: 'Escreva…' });
  ta.value = store.getVal(day, cat.id) || '';
  let t;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { save(ta.value.trim()); card.classList.toggle('is-on', !!ta.value.trim()); }, 400);
  });
  return ta;
}

/* ── Peças ─────────────────────────────────────────────────── */
const fmtH = v => (v % 1 ? v.toFixed(1).replace('.', ',') : String(v));

function check() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '13'); svg.setAttribute('height', '13');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M4 12.5l5.5 5.5L20 6.5');
  svg.append(p);
  return svg;
}

function iconBtn(d, onclick, label) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d); svg.append(p);
  return el('button.iconbtn', { type: 'button', onclick, 'aria-label': label }, [svg]);
}

export { check, iconBtn };
