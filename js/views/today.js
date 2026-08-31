/* views/today.js — o check-in do dia: um cartão por categoria,
   alvo grande, um toque salva. Nada de "salvar" no fim.

   A faixa de dias no topo existe pro caso mais comum de esquecimento:
   voltar dois, três dias e preencher o que ficou em branco. */

import { el, humanDay, longDay, todayKey, addDays, clamp, nf, keyOf, parseKey, weekKey, monthKey, moeda, WD } from '../utils.js';
import * as store from '../store.js';
import { currentStreak, goalProgress, isReduce, dayStatus, weekGoals, semanaPendente } from '../analysis.js';
import { toast, stagger, onSwipe, confirmSheet } from '../ui.js';
import { summary as badgeSummary } from '../badges.js';

const STRIP_DAYS = 10;

export function render(ctx) {
  const day = ctx.day;
  const cats = store.activeCategories();
  const rec = store.getDay(day) || { v: {}, note: '' };
  const view = el('div.view');
  const isFuture = day > todayKey();

  /* ── cabeçalho + navegação de dia ── */
  const nav = el('div.daynav', {}, [
    iconBtn('M15 6l-6 6 6 6', () => ctx.setDay(addDays(day, -1)), 'Dia anterior'),
    el('span.daynav__label', { text: humanDay(day) }),
    iconBtn('M9 6l6 6-6 6', () => ctx.setDay(addDays(day, 1)), 'Próximo dia'),
  ]);
  const picker = el('input.daypick', {
    type: 'date', value: day, max: addDays(todayKey(), 1), 'aria-label': 'Escolher data',
  });
  picker.addEventListener('change', () => { if (picker.value) ctx.setDay(picker.value); });
  nav.append(picker);
  if (day !== todayKey()) {
    nav.append(el('button.chip', { onclick: () => ctx.setDay(todayKey()), text: 'hoje' }));
  }

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '01 — CHECK-IN' }),
      el('h2.display.h-lg', { text: tituloDoDia(day) }),
    ]),
    el('div.vhead__r', {}, [nav]),
  ]));

  /* ── faixa dos últimos dias ── */
  view.append(dayStrip(day, ctx));

  /* ── convite pra fechar a semana ── */
  const inicioSemana = store.state.settings.weekStart ?? 1;
  const pendente = semanaPendente(todayKey(), inicioSemana);
  if (pendente) {
    const daSemanaPassada = pendente !== weekKey(todayKey(), inicioSemana);
    view.append(el('button.alert', {
      type: 'button',
      onclick: () => { ctx.revisaoSemana = pendente; ctx.go('revisao'); },
      html: daSemanaPassada
        ? `<span class="micro">A SEMANA PASSADA ACABOU</span>
           <span>Ela ficou sem fechar. <b>Ver como foi e ajustar as metas</b> →</span>`
        : `<span class="micro">FIM DA SEMANA</span>
           <span>A semana fecha hoje. <b>Revisar e ajustar as metas</b> da próxima →</span>`,
    }));
  }

  /* ── pendências da semana ── */
  const buracos = ultimosDias(14).filter(k => k !== todayKey() && !store.hasEntry(k));
  const recentes = buracos.filter(k => k >= addDays(todayKey(), -7));
  if (recentes.length >= 2) {
    view.append(el('button.alert', {
      type: 'button',
      onclick: () => { ctx.monthMode = 'semana'; ctx.go('mes'); },
      html: `<span class="micro">EM BRANCO</span>
             <span><b>${recentes.length} dias</b> da última semana sem registro. Preencher na grade da semana →</span>`,
    }));
  }

  /* ── status do dia: o que falta, e nada além disso ── */
  const painel = el('div.status');
  const semana = el('div.semana');

  /** Repintado a cada marcação — é o retorno imediato de "tá em ordem?". */
  const pintaStatus = () => {
    const st = dayStatus(day);
    const fechadoAgora = !!store.getDay(day)?.closed;
    painel.classList.toggle('is-ok', st.ok || st.vazio);
    painel.replaceChildren();

    const bar = el('div.progress__bar');
    painel.append(el('div.status__topo', {}, [
      el('div', {}, [
        el('p.micro', { text: fechadoAgora ? 'DIA FECHADO' : 'STATUS DO DIA' }),
        el('p.status__t', {
          text: st.vazio ? 'Nada obrigatório hoje'
            : st.ok ? 'Tudo em ordem'
            : `Falta marcar ${st.faltando.length} de ${st.total}`,
        }),
      ]),
      el('div.wrap', {}, [
        !st.ok && !isFuture && st.faltando.length
          ? el('button.btn.btn--sm', { type: 'button', onclick: () => repetirDiaAnterior(day, ctx) },
              [el('span', { text: 'repetir ontem' })])
          : null,
        el('button.btn' + (fechadoAgora ? '.btn--solid' : ''), {
          type: 'button',
          onclick: () => {
            store.closeDay(day, !fechadoAgora);
            toast(fechadoAgora ? 'dia reaberto' : 'dia fechado');
            pintaStatus();
          },
        }, [el('span', { text: fechadoAgora ? 'FECHADO ✓' : 'FECHAR O DIA' })]),
      ]),
    ]));

    if (!st.vazio) {
      painel.append(el('div.progress', {}, [bar]));
      requestAnimationFrame(() => { bar.style.width = `${Math.round(st.pct * 100)}%`; });
    }

    if (st.faltando.length) {
      painel.append(el('div.status__faltas', {}, st.faltando.map(c =>
        el('button.falta', {
          type: 'button',
          onclick: () => {
            const alvo = entries.querySelector(`[data-cat="${c.id}"]`);
            alvo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            alvo?.classList.remove('pisca'); void alvo?.offsetWidth; alvo?.classList.add('pisca');
          },
          text: `${c.emoji || '•'} ${c.label}`,
        }))));
    }

    const sub = [];
    if (!st.vazio) sub.push(`${st.feitas.length}/${st.total} obrigatórias`);
    if (st.extras.length) sub.push(`${st.extras.length} extra(s) marcada(s)`);
    if (sub.length) painel.append(el('p.micro.status__sub', { text: sub.join(' · ').toUpperCase() }));

    // o fio de aviso dos cartões acompanha
    entries.querySelectorAll('[data-cat]').forEach(card => {
      const c = store.catById(card.dataset.cat);
      card.classList.toggle('falta-hoje', !!c && store.cobraNoDia(c, day) && !store.respondida(c, day));
    });
  };

  /** O que ainda falta para fechar as metas da semana. */
  const pintaSemana = () => {
    const metas = weekGoals(day).filter(m => m.situacao !== 'batida');
    semana.replaceChildren();
    semana.hidden = !metas.length;
    if (!metas.length) return;
    semana.append(el('div.section__h', {}, [
      el('p.micro', { text: 'PARA FECHAR A SEMANA' }),
      el('button.micro.semana__link', { type: 'button', onclick: () => ctx.go('metas'), text: 'ajustar metas' }),
    ]));
    semana.append(el('div.semana__l', {}, metas.slice(0, 4).map(m => {
      const preenche = el('i');
      const linha = el('div.mini', { 'data-sit': m.situacao }, [
        el('div.mini__t', {}, [
          el('span.mini__n', { text: `${m.cat.emoji || '•'} ${m.cat.label}` }),
          el('span.mini__v', {
            text: m.mode === 'min'
              ? `faltam ${nf(m.falta, m.falta % 1 ? 1 : 0)} em ${m.restam}d`
              : (m.situacao === 'estourou'
                  ? `${nf(m.done, m.done % 1 ? 1 : 0)} — teto ${nf(m.value)}`
                  : `${nf(m.done, m.done % 1 ? 1 : 0)}/${nf(m.value)} no teto`),
          }),
        ]),
        el('div.mini__b', {}, [preenche]),
      ]);
      requestAnimationFrame(() => { preenche.style.width = `${Math.round(Math.min(1, m.pct) * 100)}%`; });
      return linha;
    })));
  };

  /* a régua do "menos fudido", sempre à mão */
  const b = badgeSummary();
  const xpBar = el('i');
  const linhaNivel = el('button.levelline', {
    type: 'button', onclick: () => ctx.go('insights'), title: 'Ver conquistas',
  }, [
    el('span.micro', { text: `NÍVEL ${b.level.i + 1}` }),
    el('span.levelline__n', { text: b.level.name }),
    el('span.levelline__bar', {}, [xpBar]),
    el('span.micro', { text: `${b.ganhas}/${b.total} ✦` }),
  ]);
  requestAnimationFrame(() => { xpBar.style.width = `${Math.round(b.level.pct * 100)}%`; });

  view.append(painel, semana, linhaNivel);

  /* ── o que o mês cobra hoje ── */
  const doDia = compromissosDoDia(day, ctx);
  if (doDia) view.append(doDia);

  /* toda marcação atualiza o status e as metas sem repintar a tela inteira */
  ctx.softRefresh = () => { pintaStatus(); pintaSemana(); };

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
  const note = el('textarea.note', { placeholder: 'Como foi o dia? (opcional)', rows: 3 });
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

  /* ── afazeres em aberto ──
     Ordem: as marcadas pra hoje, depois as que passaram do dia, depois as
     soltas. Sempre fora do progresso do dia — tarefa se empurra pra frente
     por definição, e ser cobrado por "comprar ração" treina você a ignorar
     o painel, que é a peça mais cara do app. */
  const comData = t => (t.due === day ? 0 : t.due && t.due < day ? 1 : 2);
  const abertas = [...store.openTodos()]
    .sort((a, b) => comData(a) - comData(b) || (a.due || '').localeCompare(b.due || ''))
    .slice(0, 3);
  if (abertas.length) {
    view.append(el('div.section', { style: { marginTop: 'var(--s-7)' } }, [
      el('div.section__h', {}, [el('p.micro', { text: 'NA LISTA HOJE' })]),
      el('div.todos', {}, abertas.map(t => el('div.todo', {}, [
        el('button.todo__box', {
          'aria-label': 'Concluir',
          onclick: e => {
            store.updateTodo(t.id, { done: true });
            e.currentTarget.closest('.todo').classList.add('is-leaving');
            toast('feito', { action: 'desfazer', onAction: () => { store.updateTodo(t.id, { done: false }); ctx.rerender(); } });
            setTimeout(() => ctx.rerender(), 320);
          },
        }, [check()]),
        el('span.todo__txt', { text: t.text }),
        t.due === day
          ? el('span.micro.todo__sel', { text: 'HOJE' })
          : t.due && t.due < day
            ? el('span.micro.todo__sel.is-atrasada', { text: 'ERA PRA ' + humanDay(t.due).toUpperCase() })
            : null,
      ].filter(Boolean)))),
      el('button.btn.btn--sm.btn--ghost', { style: { marginTop: 'var(--s-3)' }, onclick: () => ctx.go('lista') },
        [el('span', { text: `ver todas (${store.openTodos().length})` })]),
    ]));
  }

  pintaStatus();
  pintaSemana();
  stagger(entries, ':scope > .entry');
  onSwipe(view, { left: () => ctx.setDay(addDays(day, 1)), right: () => ctx.setDay(addDays(day, -1)) });
  return view;
}

/* ── Compromissos do mês que caem hoje ─────────────────────── */
/* Não entram no status do dia de propósito: pagar o aluguel não é hábito,
   e misturar as duas coisas faria o progresso da rotina mentir de novo. */
function compromissosDoDia(day, ctx) {
  const mes = monthKey(day);
  // assinatura debita sozinha: ela não tem nada a pedir de você hoje
  const doMes = store.agendaDoMes(mes).filter(a => a.tipo !== 'assinatura');
  const doDia = doMes.filter(a => a.data === day);
  const atrasados = day === todayKey()
    ? doMes.filter(a => a.data && a.data < day && !store.agendaFeito(a, mes))
    : [];
  const itens = [...atrasados, ...doDia];
  if (!itens.length) return null;

  const caixa = el('div.hojeagenda');
  caixa.append(el('div.hojeagenda__h', {}, [
    el('p.micro', { text: atrasados.length ? 'DO MÊS · TEM COISA ATRASADA' : 'DO MÊS, HOJE' }),
    el('button.chip', {
      type: 'button',
      /* 'agenda' saiu do roteador quando a tela virou aba de Pessoal — este
         botão passou a não fazer nada. Agora leva pra aba certa. */
      onclick: () => { ctx.pessoalAba = 'contas'; ctx.go('lista'); },
      text: 'ver o mês',
    }),
  ]));

  itens.forEach(item => {
    const feito = store.agendaFeito(item, mes);
    const atrasado = item.data < day && !feito;
    const linha = el('div.agitem.agitem--curto' + (feito ? '.is-feito' : '') + (atrasado ? '.is-atrasado' : ''));
    linha.append(...[
      el('button.agitem__check', {
        type: 'button', 'aria-pressed': String(feito), 'aria-label': `Marcar ${item.label}`,
        onclick: () => {
          store.marcarAgenda(item.id, mes, !feito);
          toast(feito ? 'desmarcado' : 'resolvido ✓');
          ctx.rerender();
        },
      }, [el('span', { text: feito ? '✓' : '' })]),
      el('span.agitem__t', {}, [
        el('span.agitem__e', { text: item.emoji || '•' }),
        el('span', { text: item.label }),
      ]),
      atrasado ? el('span.micro.agitem__d', { text: `venceu dia ${item.dia}` }) : null,
      item.valor ? el('span.agitem__v.num', { text: moeda(item.valor) }) : null,
    ].filter(Boolean));
    caixa.append(linha);
  });
  return caixa;
}

/* ── Faixa de dias ─────────────────────────────────────────── */
function dayStrip(day, ctx) {
  const strip = el('div.strip', { role: 'group', 'aria-label': 'Últimos dias' });
  const dias = ultimosDias(STRIP_DAYS);
  if (day > dias[dias.length - 1] || day < dias[0]) dias.push(day);   // dia escolhido fora da faixa

  for (const k of dias) {
    const d = parseKey(k);
    const rec = store.getDay(k);
    const btn = el('button.strip__d', {
      type: 'button',
      'aria-current': k === day ? 'date' : null,
      title: longDay(k),
      onclick: () => ctx.setDay(k),
    }, [
      el('span.strip__w', { text: WD[d.getDay()] }),
      el('span.strip__n.num', { text: String(d.getDate()) }),
      el('span.strip__s'),
    ]);
    if (k === day) btn.classList.add('is-sel');
    if (k === todayKey()) btn.classList.add('is-today');
    if (rec?.closed) btn.classList.add('is-closed');
    else if (store.hasEntry(k)) btn.classList.add('is-filled');
    strip.append(btn);
  }
  requestAnimationFrame(() => {
    strip.querySelector('.is-sel')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  return strip;
}

const ultimosDias = n => Array.from({ length: n }, (_, i) => addDays(todayKey(), -(n - 1 - i)));

function tituloDoDia(day) {
  const h = humanDay(day);
  if (h === 'Hoje') return 'HOJE';
  if (h === 'Ontem') return 'ONTEM';
  const d = parseKey(day);
  return `${WD[d.getDay()].toUpperCase()} ${d.getDate()}`;
}

/* ── Repetir o dia anterior ────────────────────────────────── */
function repetirDiaAnterior(day, ctx) {
  const from = addDays(day, -1);
  const origem = store.getDay(from);
  if (!origem || !Object.keys(origem.v).length) {
    toast('o dia anterior está em branco');
    return;
  }
  const antes = structuredClone(store.getDay(day) || { v: {}, note: '', closed: false });
  const aplicar = () => {
    const n = store.copyDay(from, day);
    ctx.rerender();
    toast(`${n} valor(es) copiados`, {
      action: 'desfazer',
      onAction: () => {
        store.state.days[day] = { ...antes, updatedAt: Date.now() };
        store.emit('day');
        ctx.rerender();
      },
    });
  };
  const atual = store.getDay(day);
  if (atual && Object.keys(atual.v).length) {
    confirmSheet({
      title: 'Repetir o dia anterior?',
      text: `Os valores de ${humanDay(from).toLowerCase()} substituem o que já está preenchido aqui. Dá pra desfazer logo depois.`,
      ok: 'Repetir', onOk: aplicar,
    });
  } else aplicar();
}

/* ── Cartão de uma categoria ───────────────────────────────── */
function entryCard(cat, day, ctx) {
  const val = store.getVal(day, cat.id);
  const card = el('div.entry' + (cat.type === 'text' ? '.entry--wide' : ''), { 'data-cat': cat.id });
  const on = cat.type === 'toggle' ? !!val : Number(val) > 0;
  if (on) card.classList.add('is-on');
  const cobra = store.cobraNoDia(cat, day);
  if (cobra && !store.respondida(cat, day)) card.classList.add('falta-hoje');
  /* Categoria de dia certo, num dia que não é o dela: continua marcável —
     consulta remarcada é consulta —, mas não cobra e não pesa no progresso. */
  const foraDoDia = store.cadencia(cat) === 'diaria' && !cobra;
  if (foraDoDia) card.classList.add('fora-do-dia');

  const meta = el('div.entry__meta');
  const dias = store.rotuloDias(cat);
  if (dias) meta.append(el('span.entry__dias.micro', { text: dias, title: 'só nesses dias da semana' }));
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
export function control(cat, day, card, ctx) {
  const save = (v, opts) => { store.setVal(day, cat.id, v, opts); ctx.softRefresh?.(); };

  if (cat.type === 'toggle') {
    const on0 = !!store.getVal(day, cat.id);
    const btn = el('button.tog', { type: 'button', 'aria-pressed': String(on0) });
    const txt = el('span', { text: on0 ? 'FEITO' : 'MARCAR' });
    btn.append(txt, el('span.tog__mark', {}, [check()]));
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(next));
      txt.textContent = next ? 'FEITO' : 'MARCAR';
      card?.classList.toggle('is-on', next);
      save(next);
    });
    return btn;
  }

  if (cat.type === 'count') {
    const wrap = el('div');
    const cur = () => Number(store.getVal(day, cat.id) || 0);
    const lvlNote = el('p.lvl');
    const pintaNota = v => {
      const txt = store.levelLabel(cat, v);
      lvlNote.textContent = txt || '';
      lvlNote.classList.toggle('is-empty', !txt);
    };
    const valEl = el('span.step__val.num', { text: String(cur()) });
    if (!cur()) valEl.classList.add('is-zero');
    const set = n => {
      const v = clamp(n, 0, cat.max || 99);
      valEl.textContent = String(v);
      valEl.classList.toggle('is-zero', !v);
      valEl.classList.remove('pop'); void valEl.offsetWidth; valEl.classList.add('pop');
      card?.classList.toggle('is-on', v > 0);
      wrap.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-on', Number(c.dataset.v) === v));
      pintaNota(v);
      save(v);
    };
    pintaNota(cur());
    wrap.append(el('div.step', {}, [
      el('button.step__btn', { type: 'button', 'aria-label': 'Menos', onclick: () => set(cur() - 1), text: '−' }),
      el('span', {}, [valEl, el('span.step__unit', { text: cat.unit || '' })]),
      el('button.step__btn', { type: 'button', 'aria-label': 'Mais', onclick: () => set(cur() + 1), text: '+' }),
    ]));
    if (cat.levels) wrap.append(lvlNote);
    return wrap;
  }

  if (cat.type === 'hours') {
    const max = cat.max || 16;
    const cur = () => Number(store.getVal(day, cat.id) || 0);
    const wrap = el('div');
    const valEl = el('span.leitura__n.num', { text: fmtH(cur()) });
    if (!cur()) valEl.classList.add('is-zero');
    const slider = el('input.slider', {
      type: 'range', min: 0, max, step: 0.5, value: cur(), 'aria-label': cat.label,
    });
    const set = n => {
      const v = clamp(Math.round(n * 2) / 2, 0, max);
      valEl.textContent = fmtH(v);
      valEl.classList.toggle('is-zero', !v);
      slider.value = v;
      card?.classList.toggle('is-on', v > 0);
      save(v);
    };
    wrap.append(
      el('div.leitura', {}, [valEl, el('span.leitura__u.micro', { text: cat.unit || 'h' })]),
      slider,
      el('div.regua', {}, [
        el('span.micro', { text: '0' }),
        el('span.micro', { text: `${max}${cat.unit || 'h'}` }),
      ]),
    );
    slider.addEventListener('input', () => set(Number(slider.value)));
    return wrap;
  }

  if (cat.type === 'scale') {
    const min = store.scaleMin(cat);
    const max = store.scaleMax(cat);
    const niveis = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const largo = niveis.length > 6;                    // muitos níveis → medidor compacto
    const cur = () => {
      const v = store.getVal(day, cat.id);
      return v === undefined || v === '' ? null : Number(v);
    };

    const wrap = el('div');
    const box = el('div' + (largo ? '.meter' : '.scale'));
    const nota = el('p.lvl');

    const pinta = () => {
      const v = cur();
      /* Zero é resposta, mas não é conquista: o pixel mais saturado da tela
         não pode estar dizendo "não fiz". */
      box.querySelectorAll('[data-v]').forEach(b => {
        const n = Number(b.dataset.v);
        const escolhido = n === v;
        /* No medidor longo o preenchimento vai até o valor — é um medidor,
           não onze escolhas soltas. Na escala curta continua marcando um. */
        b.classList.toggle('is-on', largo ? (v !== null && n <= v && n > 0) : escolhido);
        b.classList.toggle('is-topo', largo && escolhido);
        b.classList.toggle('is-zero', escolhido && n === 0);
      });
      wrap.querySelectorAll('.refs__r').forEach(r =>
        r.classList.toggle('is-atual', Number(r.dataset.v) === v));
      const txt = store.levelLabel(cat, v);
      nota.replaceChildren(...(v === null
        ? [el('span', { text: 'sem resposta' })]
        : [el('b.lvl__n.num', { text: String(v) }), txt ? el('span', { text: txt }) : null].filter(Boolean)));
      nota.classList.toggle('is-empty', v === null);
      card?.classList.toggle('is-on', v !== null && v > 0);
    };

    niveis.forEach(n => {
      const b = el('button' + (largo ? '.meter__s' : '.scale__dot'), {
        type: 'button', 'data-v': n,
        text: largo ? '' : String(n),
        'aria-label': `${n}${store.levelLabel(cat, n) ? ` — ${store.levelLabel(cat, n)}` : ''}`,
        title: store.levelLabel(cat, n) || `nível ${n}`,
      });
      b.addEventListener('click', () => {
        const next = cur() === n ? null : n;         // tocar de novo limpa a resposta
        save(next === null ? undefined : next, { keepZero: min === 0 });
        pinta();
      });
      box.append(b);
    });

    wrap.append(box, nota);

    if (cat.levels && Object.keys(cat.levels).length) {
      const lista = el('div.refs', { hidden: true }, niveis.map(n => el('div.refs__r' + (cur() === n ? '.is-atual' : ''), { 'data-v': n }, [
        el('span.refs__n.num', { text: String(n) }),
        el('span', { text: store.levelLabel(cat, n) || '—' }),
      ])));
      const toggle = el('button.reflink', {
        type: 'button',
        onclick: () => {
          lista.hidden = !lista.hidden;
          toggle.textContent = lista.hidden ? 'ver referências' : 'esconder referências';
        },
        text: 'ver referências',
      });
      wrap.append(toggle, lista);
    }

    pinta();
    return wrap;
  }

  const ta = el('textarea.note', { rows: 2, placeholder: 'Escreva…' });
  ta.value = store.getVal(day, cat.id) || '';
  let t;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { save(ta.value.trim()); card?.classList.toggle('is-on', !!ta.value.trim()); }, 400);
  });
  return ta;
}

/* ── Peças ─────────────────────────────────────────────────── */
export const fmtH = v => (v % 1 ? v.toFixed(1).replace('.', ',') : String(v));

export function check() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '13'); svg.setAttribute('height', '13');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M4 12.5l5.5 5.5L20 6.5');
  svg.append(p);
  return svg;
}

export function iconBtn(d, onclick, label) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d); svg.append(p);
  return el('button.iconbtn', { type: 'button', onclick, 'aria-label': label }, [svg]);
}

export { keyOf };
