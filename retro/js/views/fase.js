/* views/fase.js — a FASE DE HOJE.

   Cada categoria é um bloco: por responder mostra o "?", respondida vira
   bloco batido e cospe uma moeda. Sim/não resolve num toque; contagem,
   horas, escala e texto abrem a caixa de diálogo. No fim da fase está a
   bandeira: fechar o dia. */

import { el, humanDay, longDay, todayKey, addDays, parseKey, clamp, nf, WD } from '../../../js/utils.js';
import * as store from '../../../js/store.js';
import { currentStreak, goalProgress, isReduce } from '../../../js/analysis.js';
import { summary as placar } from '../../../js/badges.js';
import * as sfx from '../sfx.js';
import { sprite, animado } from '../sprites.js';
import { caixa, aviso } from '../ui.js';

const FAIXA = 8;   // dias na régua do topo

export function render(ctx) {
  const dia = ctx.day;
  const cats = store.activeCategories();
  const rec = store.getDay(dia) || { v: {}, note: '' };
  const tela = el('div.tela');

  /* título */
  tela.append(el('div.titulo', {}, [
    el('div', {}, [
      el('h2.t16.sombra', { text: dia === todayKey() ? 'FASE DE HOJE' : tituloDia(dia) }),
      el('p', { style: { fontSize: '13px', color: 'var(--tinta2)', marginTop: '4px' }, text: longDay(dia) }),
    ]),
    el('div.linha', {}, [
      el('button.btn.btn--peq', { type: 'button', onclick: () => ctx.setDay(addDays(dia, -1)), text: '◀' }),
      dia !== todayKey()
        ? el('button.btn.btn--peq', { type: 'button', onclick: () => ctx.setDay(todayKey()), text: 'HOJE' })
        : null,
      el('button.btn.btn--peq', { type: 'button', onclick: () => ctx.setDay(addDays(dia, 1)), text: '▶' }),
    ]),
  ]));

  /* régua de dias */
  const regua = el('div.dias');
  for (let i = FAIXA - 1; i >= 0; i--) {
    const k = addDays(todayKey(), -i);
    const d = parseKey(k);
    const b = el('button.dia' + (k === dia ? '.sel' : '') + (k === todayKey() ? '.hoje' : ''), {
      type: 'button', title: longDay(k),
      onclick: () => { sfx.passo(); ctx.setDay(k); },
    }, [
      el('span.dia__s', { text: WD[d.getDay()].toUpperCase() }),
      el('span.dia__n', { text: String(d.getDate()) }),
      el('span.dia__p'),
    ]);
    if (store.getDay(k)?.closed) b.classList.add('fechou');
    else if (store.hasEntry(k)) b.classList.add('tem');
    regua.append(b);
  }
  tela.append(regua);
  requestAnimationFrame(() => regua.querySelector('.sel')?.scrollIntoView({ block: 'nearest', inline: 'center' }));

  /* barra de progresso da fase */
  const feitas = () => cats.filter(c => {
    const v = store.getVal(dia, c.id);
    return v !== undefined && v !== false && v !== '';
  }).length;
  const barra = el('i');
  tela.append(el('div', {}, [
    el('p.t8', { text: `PROGRESSO ${feitas()}/${cats.length}`, id: 'faseProg' }),
    el('div.barra', {}, [barra]),
  ]));
  const pintaBarra = () => {
    const p = cats.length ? feitas() / cats.length : 0;
    barra.style.width = `${Math.round(p * 100)}%`;
    const t = tela.querySelector('#faseProg');
    if (t) t.textContent = `PROGRESSO ${feitas()}/${cats.length}`;
  };
  requestAnimationFrame(pintaBarra);

  /* blocos */
  const fase = el('div.fase');
  if (!cats.length) {
    fase.append(el('div.vazio', {}, [
      el('p.t10', { text: 'SEM CATEGORIAS' }),
      el('p', { style: { marginTop: '8px', fontSize: '14px' }, text: 'Crie as suas em OPÇÕES.' }),
    ]));
  }
  cats.forEach(cat => fase.append(blocoCat(cat, dia, ctx, pintaBarra)));
  tela.append(fase);

  /* bandeira: fechar o dia */
  const bandeira = el('button.bandeira', { type: 'button' }, [
    sprite('bandeira', { scale: 3 }),
    el('div', { style: { flex: '1' } }, [
      el('p.t10', { text: rec.closed ? 'FASE COMPLETA' : 'FECHAR O DIA' }),
      el('p', { style: { fontSize: '13px', color: 'var(--tinta2)', marginTop: '4px' },
        text: rec.closed ? 'Você fincou a bandeira nesse dia.' : 'Hasteie a bandeira quando terminar.' }),
    ]),
  ]);
  bandeira.addEventListener('click', () => {
    const novo = !store.getDay(dia)?.closed;
    store.closeDay(dia, novo);
    if (novo) { sfx.fase(); bandeira.classList.add('hasteou'); aviso('BANDEIRA HASTEADA'); }
    else { sfx.bump(); aviso('DIA REABERTO'); }
    setTimeout(() => ctx.rerender(), 420);
  });
  tela.append(el('div', { style: { marginTop: '16px' } }, [bandeira]));

  /* anotação */
  const nota = el('textarea', {
    rows: 3, placeholder: 'Anotação do dia (opcional)',
    style: {
      width: '100%', marginTop: '16px', padding: '12px', background: '#000', color: 'var(--tinta)',
      fontFamily: 'Silkscreen, monospace', fontSize: '14px', boxShadow: '0 0 0 2px var(--tinta) inset',
    },
  });
  nota.value = rec.note || '';
  let t;
  nota.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => store.setNote(dia, nota.value.trim()), 400);
  });
  tela.append(nota);

  /* herói andando no chão */
  const b = placar();
  tela.append(el('div.heroi', {}, [
    animado('heroi_a', 'heroi_b', { scale: 3, cls: 'heroi__anda' }),
    el('p.t8', { style: { color: 'var(--tinta2)' }, text: b.level.name.toUpperCase() }),
  ]));
  tela.append(el('div.chao', { style: { marginTop: '8px' } }));

  return tela;
}

const tituloDia = k => {
  const h = humanDay(k);
  return h === 'Ontem' ? 'FASE DE ONTEM' : `FASE DE ${h.toUpperCase()}`;
};

/* ── Um bloco ──────────────────────────────────────────────── */
function blocoCat(cat, dia, ctx, pintaBarra) {
  const linha = el('button.bloco', { type: 'button' });
  const caixaSpr = el('div.bloco__spr');
  const valor = el('div.bloco__val');
  const meta = el('div.bloco__meta');

  const respondido = () => {
    const v = store.getVal(dia, cat.id);
    if (cat.type === 'toggle') return !!v;
    if (cat.type === 'text') return !!v;
    return v !== undefined && v !== '';
  };

  const pinta = () => {
    caixaSpr.replaceChildren(sprite(respondido() ? 'batido' : 'bloco', { scale: 3 }));
    const v = store.getVal(dia, cat.id);
    valor.replaceChildren();
    if (cat.type === 'toggle') {
      valor.append(el('span', { text: v ? 'OK' : '—' }));
    } else if (v === undefined || v === '') {
      valor.append(el('span', { text: '—' }));
    } else if (cat.type === 'text') {
      valor.append(el('span', { text: '✎' }));
    } else {
      valor.append(el('span', { text: String(v).replace('.', ',') }));
      const ref = store.levelLabel(cat, v);
      if (ref) valor.append(el('small', { text: ref }));
      else if (cat.unit) valor.append(el('small', { text: cat.unit }));
    }
    const gp = goalProgress(cat, dia);
    const seq = currentStreak(cat, dia);
    const partes = [];
    if (gp) partes.push(`${nf(gp.done, gp.done % 1 ? 1 : 0)}/${gp.value}`);
    if (seq > 1) partes.push(`${isReduce(cat) ? '∅' : '↑'}${seq}D`);
    meta.textContent = partes.join('  ');
    meta.classList.toggle('ok', !!gp?.ok);
  };

  const moedinha = () => {
    const m = animado('moeda_a', 'moeda_b', { scale: 3, ms: 90, cls: 'moeda-sobe' });
    caixaSpr.append(m);
    setTimeout(() => m.remove(), 620);
  };

  const bateu = ganhou => {
    linha.classList.remove('bateu'); void linha.offsetWidth; linha.classList.add('bateu');
    if (ganhou) { sfx.moeda(); moedinha(); } else sfx.bump();
    pinta();
    pintaBarra();
  };

  linha.addEventListener('click', () => {
    if (cat.type === 'toggle') {
      const novo = !store.getVal(dia, cat.id);
      store.setVal(dia, cat.id, novo);
      bateu(novo);
      return;
    }
    abrirControle(cat, dia, () => { bateu(respondido()); }, ctx);
  });

  linha.append(caixaSpr, el('div.bloco__txt', {}, [
    el('span.bloco__nome', { text: `${cat.emoji || ''} ${cat.label}`.trim() }),
    meta,
  ]), valor);
  pinta();
  return linha;
}

/* ── Caixa de controle (contagem, horas, escala, texto) ────── */
export function abrirControle(cat, dia, aoMudar, ctx) {
  caixa(`${cat.emoji || ''} ${cat.label}`.trim().toUpperCase(), close => {
    const corpo = [];
    const ref = el('p.ref');
    const pintaRef = v => {
      const txt = store.levelLabel(cat, v);
      ref.textContent = v === undefined || v === '' ? '' : (txt ? `${v} · ${txt}` : '');
    };

    if (cat.type === 'count' || cat.type === 'hours') {
      const passo = cat.type === 'hours' ? 0.5 : 1;
      const teto = cat.type === 'hours' ? (cat.max || 16) : (cat.max || 99);
      const cur = () => Number(store.getVal(dia, cat.id) || 0);
      const vis = el('span.contador__v', { text: fmt(cur()) });
      const set = n => {
        const v = clamp(Math.round(n / passo) * passo, 0, teto);
        vis.textContent = fmt(v);
        store.setVal(dia, cat.id, v);
        pintaRef(v);
        sfx.passo();
        aoMudar();
      };
      corpo.push(el('div.contador', {}, [
        el('button.btn', { type: 'button', onclick: () => set(cur() - passo), text: '−' }),
        vis,
        el('button.btn', { type: 'button', onclick: () => set(cur() + passo), text: '+' }),
      ]));
      corpo.push(el('div.linha', { style: { justifyContent: 'center', marginTop: '8px' } },
        (cat.type === 'hours' ? [2, 4, 6, 8] : [0, 1, 2, 3, 5]).filter(n => n <= teto).map(n =>
          el('button.btn.btn--peq', { type: 'button', onclick: () => set(n), text: cat.type === 'hours' ? `${n}H` : String(n) }))));
      pintaRef(cur());
      corpo.push(ref);
    } else if (cat.type === 'scale') {
      const min = store.scaleMin(cat), max = store.scaleMax(cat);
      const med = el('div.medidor');
      const cur = () => {
        const v = store.getVal(dia, cat.id);
        return v === undefined || v === '' ? null : Number(v);
      };
      const pinta = () => {
        med.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === cur()));
        const v = cur();
        ref.textContent = v === null ? 'SEM RESPOSTA' : `${v} · ${store.levelLabel(cat, v) || ''}`;
      };
      for (let n = min; n <= max; n++) {
        med.append(el('button', {
          type: 'button', 'data-v': n, text: String(n),
          onclick: () => {
            const novo = cur() === n ? undefined : n;
            store.setVal(dia, cat.id, novo, { keepZero: min === 0 });
            pinta(); sfx.moeda(); aoMudar();
          },
        }));
      }
      corpo.push(med, ref);
      pinta();
    } else {
      const ta = el('textarea', {
        rows: 4,
        style: { width: '100%', padding: '12px', background: '#000', color: 'var(--tinta)',
          fontFamily: 'Silkscreen, monospace', fontSize: '14px', boxShadow: '0 0 0 2px var(--tinta) inset' },
      });
      ta.value = store.getVal(dia, cat.id) || '';
      let t;
      ta.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { store.setVal(dia, cat.id, ta.value.trim()); aoMudar(); }, 400);
      });
      corpo.push(ta);
    }

    corpo.push(el('div.modal__acoes', {}, [
      el('button.btn', {
        type: 'button',
        onclick: () => { store.setVal(dia, cat.id, undefined); aoMudar(); close(); sfx.bump(); },
        text: 'LIMPAR',
      }),
      el('button.btn.btn--v', { type: 'button', onclick: close, text: 'PRONTO' }),
    ]));
    return corpo;
  });
}

const fmt = v => (v % 1 ? String(v).replace('.', ',') : String(v));
