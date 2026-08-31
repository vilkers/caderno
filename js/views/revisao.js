/* views/revisao.js — o ritual de fechar a semana.

   Registrar sem nunca olhar para trás vira arquivo morto. Aqui a semana é
   lida em voz alta — o que bateu, o que não bateu, como foi contra a semana
   anterior — e você sai daqui tendo ajustado as metas da próxima. É o único
   lugar do app que pede uma decisão em vez de um registro. */

import { el, nf, weekKey, weekOfKey, addDays, todayKey, parseKey, MONTHS } from '../utils.js';
import * as store from '../store.js';
import { goalProgress, loggedDays, did, num, isReduce } from '../analysis.js';
import { toast, confirmSheet } from '../ui.js';

export function render(ctx) {
  const inicioSemana = store.state.settings.weekStart ?? 1;
  const ancora = ctx.revisaoSemana || todayKey();
  const chave = weekKey(ancora, inicioSemana);
  const dias = weekOfKey(chave, inicioSemana);
  const anterior = weekOfKey(addDays(chave, -7), inicioSemana);
  const review = store.getReview(chave);
  const fechada = !!review?.fechadaEm;
  const cats = store.activeCategories().filter(c => c.goal);

  const view = el('div.view');
  const a = parseKey(dias[0]), b = parseKey(dias[6]);
  const rotulo = `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)}`.toUpperCase();

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: `REVISÃO · ${rotulo}` }),
      el('h2.display.h-lg', { text: fechada ? 'SEMANA FECHADA' : 'FECHAR A SEMANA' }),
    ]),
    el('div.vhead__r', {}, [
      el('button.btn.btn--sm', { type: 'button', onclick: () => { ctx.revisaoSemana = addDays(chave, -7); ctx.rerender(); }, text: '←' }),
      chave !== weekKey(todayKey(), inicioSemana)
        ? el('button.btn.btn--sm', { type: 'button', onclick: () => { ctx.revisaoSemana = todayKey(); ctx.rerender(); }, text: 'atual' })
        : null,
      el('button.btn.btn--sm', { type: 'button', onclick: () => ctx.voltar(), text: '← voltar' }),
    ]),
  ]));

  /* ── como foi ── */
  const registrados = loggedDays(dias);
  const registradosAntes = loggedDays(anterior);
  const metas = cats.map(c => ({ cat: c, gp: goalProgress(c, dias[6]) })).filter(m => m.gp);
  const bateu = metas.filter(m => m.gp.ok).length;

  view.append(el('div.status' + (bateu === metas.length && metas.length ? '.is-ok' : ''), { style: { marginBottom: '1.2rem' } }, [
    el('div.status__topo', {}, [
      el('div', {}, [
        el('p.micro', { text: 'A SEMANA EM UMA LINHA' }),
        el('p.status__t', {
          text: !metas.length ? `${registrados} de 7 dias registrados`
            : bateu === metas.length ? `Tudo batido — ${registrados} de 7 dias registrados`
            : `${bateu} de ${metas.length} metas batidas · ${registrados}/7 dias`,
        }),
      ]),
    ]),
    el('p.micro.status__sub', {
      text: `SEMANA ANTERIOR: ${registradosAntes}/7 DIAS · ${comparar(registrados, registradosAntes)}`,
    }),
  ]));

  /* ── meta a meta, com ajuste pra próxima ── */
  if (metas.length) {
    view.append(el('div.section__h', {}, [el('p.micro', { text: 'META A META — AJUSTE JÁ PENSANDO NA PRÓXIMA' })]));
    const lista = el('div.metas', { style: { marginBottom: '1.4rem' } });
    metas.forEach(({ cat, gp }) => lista.append(linha(cat, gp, dias, anterior, ctx)));
    view.append(lista);
  }

  /* ── o que aconteceu ── */
  const nota = el('textarea.note', {
    rows: 3, placeholder: 'O que atrapalhou? O que deu certo? (opcional)',
    disabled: fechada || null,
  });
  nota.value = review?.nota || '';
  view.append(el('div.section', {}, [
    el('div.section__h', {}, [el('p.micro', { text: 'ANOTAÇÃO DA SEMANA' })]),
    nota,
  ]));

  /* ── fechar ── */
  view.append(el('div.wrap', { style: { marginTop: '1.2rem' } }, [
    fechada
      ? el('button.btn', {
          type: 'button',
          onclick: () => confirmSheet({
            title: 'Reabrir a semana?', text: 'Volta a ficar editável. O que você já escreveu continua aqui.',
            ok: 'Reabrir', onOk: () => { store.reopenReview(chave); ctx.rerender(); },
          }),
        }, [el('span', { text: 'reabrir' })])
      : el('button.btn.btn--solid', {
          type: 'button',
          onclick: () => {
            store.saveReview(chave, {
              fechadaEm: Date.now(),
              nota: nota.value.trim(),
              dias: registrados,
              resultados: metas.map(({ cat, gp }) => ({
                catId: cat.id, label: cat.label, mode: gp.mode,
                alvo: gp.value, feito: gp.done, ok: gp.ok,
              })),
            });
            toast('semana fechada');
            ctx.rerender();
          },
        }, [el('span', { text: 'FECHAR A SEMANA' })]),
    fechada && review.fechadaEm
      ? el('p.micro', { style: { alignSelf: 'center' }, text: `FECHADA EM ${new Date(review.fechadaEm).toLocaleDateString('pt-BR')}` })
      : null,
  ]));

  return view;
}

/* ── Uma meta, com o resultado e o ajuste ──────────────────── */
function linha(cat, gp, dias, anterior, ctx) {
  const antes = gp.period === 'week'
    ? (cat.type === 'toggle' ? anterior.filter(k => did(cat, k)).length : anterior.reduce((s, k) => s + num(cat, k), 0))
    : null;

  const box = el('div.meta');
  const valor = el('input.meta__num', { type: 'number', min: '0', step: '0.5', value: String(cat.goal.value) });
  valor.addEventListener('change', () => {
    store.updateCategory(cat.id, { goal: { ...cat.goal, value: Number(valor.value) || 0 } });
    toast(`meta de ${cat.label.toLowerCase()}: ${valor.value}`);
  });

  const ajusta = passo => {
    const novo = Math.max(0, (Number(valor.value) || 0) + passo);
    valor.value = String(novo);
    valor.dispatchEvent(new Event('change'));
  };

  box.append(
    el('div.meta__cab', {}, [
      el('span.meta__e', { text: cat.emoji || '•' }),
      el('span.meta__n', { text: cat.label }),
      el('div.meta__prog', {}, [
        el('span.meta__v', {
          style: { color: gp.ok ? '#3ecf8e' : 'var(--accent-txt)' },
          text: `${nf(gp.done, gp.done % 1 ? 1 : 0)}/${nf(gp.value)}`,
        }),
        el('span.micro', { text: gp.ok ? 'BATEU' : (gp.mode === 'min' ? 'FALTOU' : 'ESTOUROU') }),
      ]),
    ]),
    el('div.meta__ctl', {}, [
      el('span.micro', { text: antes !== null ? `SEMANA ANTERIOR: ${nf(antes, antes % 1 ? 1 : 0)}` : 'META DIÁRIA' }),
      el('div.meta__campos', {}, [
        el('button.btn.btn--sm', { type: 'button', onclick: () => ajusta(-1), text: '−' }),
        valor,
        el('button.btn.btn--sm', { type: 'button', onclick: () => ajusta(1), text: '+' }),
        el('span.micro', { text: gp.period === 'week' ? 'por semana' : 'por dia' }),
      ]),
    ]),
  );
  return box;
}

const comparar = (agora, antes) => {
  if (!antes && !agora) return 'SEM COMPARAÇÃO';
  if (agora > antes) return `+${agora - antes} DIA(S)`;
  if (agora < antes) return `${agora - antes} DIA(S)`;
  return 'MESMO RITMO';
};
