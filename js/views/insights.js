/* views/insights.js — o que os dados dizem: números grandes,
   barras, mapa por dia da semana e leituras em texto. */

import { el, lastNDays, nf, WD } from '../utils.js';
import * as store from '../store.js';
import {
  num, did, isReduce, loggedDays, logStreak, currentStreak, bestStreak,
  meanLogged, weekdayProfile, goalProgress, suggestions,
} from '../analysis.js';
import { countUp, stagger, openSheet } from '../ui.js';
import * as badges from '../badges.js';

const RANGES = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];

export function render(ctx) {
  const view = el('div.view');
  const range = ctx.range || 30;
  const days = lastNDays(range);
  const cats = store.activeCategories().filter(c => c.type !== 'text');
  const logged = loggedDays(days);

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '04 — INSIGHTS' }),
      el('h2.display.h-lg', { text: 'PADRÕES' }),
    ]),
    el('div.vhead__r', {}, [
      el('div.chips', {}, RANGES.map(([n, label]) =>
        el('button.chip' + (range === n ? '.is-on' : ''), {
          type: 'button', onclick: () => { ctx.range = n; ctx.rerender(); }, text: label,
        }))),
    ]),
  ]));

  /* ── números do topo ── */
  const metasOk = cats.filter(c => c.goal && goalProgress(c)?.ok).length;
  const metasTot = cats.filter(c => c.goal).length;
  const stats = el('div.stats', {}, [
    statBig(logged, 'registrados', `de ${range}`),
    statBig(logStreak(), 'sequência', 'dias'),
    statBig(metasTot ? Math.round((metasOk / metasTot) * 100) : 0, 'metas em dia', `${metasOk}/${metasTot}`, '%'),
    statBig(store.openTodos().length, 'afazeres abertos'),
  ]);
  view.append(stats);

  /* ── nível e conquistas ── */
  view.append(section('NÍVEL', nivelCard()));

  if (logged === 0) {
    view.append(el('div.empty', {}, [
      el('b', { text: 'Ainda sem dados neste período' }),
      el('p', { text: 'Registre alguns dias e os padrões aparecem aqui.' }),
    ]));
    return view;
  }

  /* ── barras por categoria ── */
  const bars = el('div.bars');
  for (const cat of cats) {
    const isBin = cat.type === 'toggle';
    const hits = days.filter(k => did(cat, k)).length;
    const pct = logged ? hits / logged : 0;
    const media = meanLogged(cat, days);
    const streak = currentStreak(cat);
    const val = isBin
      ? `${nf(pct * 100)}% · ${hits}/${logged} dias`
      : `média ${nf(media, 1)}${cat.unit ? ' ' + cat.unit : ''} · ${hits} dias`;
    const fill = el('div.bar__fill', { style: { background: isReduce(cat) ? 'var(--dim)' : 'var(--accent)' } });
    bars.append(el('div', {}, [
      el('div.bar__top', {}, [
        el('span.bar__name', {}, [`${cat.emoji || '•'} ${cat.label}`,
          streak > 1 ? el('span.micro', { text: (isReduce(cat) ? '∅' : '↑') + streak + 'd · rec ' + bestStreak(cat) }) : null]),
        el('span.bar__v', { text: val }),
      ]),
      el('div.bar__track', {}, [fill]),
    ]));
    requestAnimationFrame(() => { fill.style.width = `${Math.round(pct * 100)}%`; });
  }
  view.append(section('FREQUÊNCIA', bars));

  /* ── mapa por dia da semana ── */
  const heatCat = cats.find(c => c.id === ctx.heatCat) || cats[0];
  if (heatCat) {
    const prof = weekdayProfile(heatCat, lastNDays(Math.max(range, 56)));
    const max = Math.max(...prof, 0.001);
    const heat = el('div');
    heat.append(el('div.chips', { style: { marginBottom: '.4rem' } }, cats.map(c =>
      el('button.chip' + (c.id === heatCat.id ? '.is-on' : ''), {
        type: 'button', onclick: () => { ctx.heatCat = c.id; ctx.rerender(); }, text: `${c.emoji} ${c.label}`,
      }))));
    heat.append(el('div.heat', {}, prof.map(v => el('div.heat__c', {
      title: nf(v, 1),
      style: { background: v > 0 ? 'var(--accent)' : 'var(--line)', opacity: v > 0 ? String(0.25 + 0.75 * (v / max)) : '1' },
    }))));
    heat.append(el('div.heat', { style: { marginTop: '.3rem' } }, WD.map(w => el('span.heat__lbl', { text: w }))));
    view.append(section('POR DIA DA SEMANA', heat));
  }

  /* ── leituras ── */
  const tips = suggestions(7);
  const box = el('div.tips');
  if (!tips.length) {
    box.append(el('p.muted', { text: 'Registre mais alguns dias para o caderno começar a comentar.' }));
  }
  tips.forEach(t => box.append(el('div.tip', {}, [
    el('p.micro.tip__k', { text: `${t.kind.toUpperCase()} · ${t.title}` }),
    el('p.tip__t', { html: t.text }),
  ])));
  view.append(section('O QUE EU LEIO NISSO', box));

  /* ── conquistas ── */
  const b = badges.summary();
  const grade = el('div.badges', {}, b.lista.map(x => el('button.badge' + (x.got ? '.is-got' : ''), {
    type: 'button',
    onclick: () => openSheet(x.name, close => [
      el('div.award', {}, [
        el('span.award__e', { text: x.emoji }),
        el('div', {}, [
          el('p.award__n', { text: x.name }),
          el('p.award__d', { text: x.desc }),
          el('p.micro', { style: { marginTop: '.4rem' },
            text: x.got
              ? (x.at ? `CONQUISTADA EM ${new Date(x.at).toLocaleDateString('pt-BR')}` : 'CONQUISTADA')
              : (x.hint ? `FALTA: ${x.hint.toUpperCase()}` : 'AINDA NÃO') }),
        ]),
      ]),
      el('div.sheet__actions', {}, [
        el('button.btn.btn--solid', { type: 'button', onclick: close }, [el('span', { text: 'fechar' })]),
      ]),
    ]),
  }, [
    el('span.badge__e', { text: x.emoji }),
    el('span.badge__n', { text: x.name }),
    el('span.badge__h', { text: x.got ? (x.at ? new Date(x.at).toLocaleDateString('pt-BR') : 'feito') : (x.hint || 'bloqueada') }),
    !x.got && x.progress > 0 ? el('span.badge__bar', {}, [el('i', { style: { width: `${Math.round(x.progress * 100)}%` } })]) : null,
  ])));
  view.append(section(`CONQUISTAS · ${b.ganhas}/${b.total}`, grade));

  stagger(view, '.stat');
  stagger(view, '.tip');
  stagger(view, '.badge', 24, 22);
  view.querySelectorAll('[data-count]').forEach(n =>
    countUp(n, Number(n.dataset.count), { suffix: n.dataset.suffix || '' }));
  return view;
}

function nivelCard() {
  const b = badges.summary();
  const bar = el('i');
  const card = el('div.level', {}, [
    el('div.level__top', {}, [
      el('div', {}, [
        el('p.micro', { text: `NÍVEL ${b.level.i + 1} DE ${badges.LEVELS.length}` }),
        el('h3.display.level__n', { text: b.level.name }),
        el('p.level__l', { text: b.level.lore }),
      ]),
      el('div.level__xp', {}, [
        el('span.stat__n.num', { text: String(b.xp) }),
        el('p.micro', { text: 'XP' }),
      ]),
    ]),
    el('div.level__bar', {}, [bar]),
    el('p.micro', {
      text: b.level.proximo
        ? `FALTAM ${b.level.falta} XP PARA "${b.level.proximo.name.toUpperCase()}"`
        : 'ÚLTIMO NÍVEL. NÃO HÁ MAIS PRA ONDE SUBIR.',
    }),
  ]);
  requestAnimationFrame(() => { bar.style.width = `${Math.round(b.level.pct * 100)}%`; });
  return card;
}

function statBig(n, label, sub, suffix = '') {
  return el('div.stat', {}, [
    el('span.stat__n.num', { 'data-count': n, 'data-suffix': suffix, text: '0' + suffix }),
    el('p.micro.stat__l', { text: sub ? `${label} · ${sub}` : label }),
  ]);
}

const section = (title, body) => el('div.section', {}, [
  el('div.section__h', {}, [el('p.micro', { text: title })]),
  body,
]);
