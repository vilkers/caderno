/* analysis.js — leitura dos dados: sequências, metas, padrões,
   comparações entre categorias e sugestões em texto. Tudo local. */

import { state, hasEntry } from './store.js';
import { addDays, todayKey, parseKey, lastNDays, WD_LONG, nf } from './utils.js';

/* ── Base ──────────────────────────────────────────────────── */

/** Valor numérico comparável de uma categoria num dia (0 quando ausente). */
export function num(cat, key) {
  const d = state.days[key];
  const v = d ? d.v[cat.id] : undefined;
  if (v === undefined || v === null || v === '') return 0;
  if (cat.type === 'toggle') return v ? 1 : 0;
  if (cat.type === 'text') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
export const did = (cat, key) => num(cat, key) > 0;

/** Categorias que a gente quer manter em baixa (meta "no máximo"). */
export const isReduce = cat => cat.goal?.mode === 'max';

/** Dias registrados no período. */
export const loggedDays = days => days.filter(hasEntry).length;

/** Semana corrente (domingo → sábado) que contém `key`. */
export function weekOf(key = todayKey()) {
  const d = parseKey(key);
  const start = addDays(key, -d.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function sum(cat, days) { return days.reduce((a, k) => a + num(cat, k), 0); }
export function mean(cat, days) { return days.length ? sum(cat, days) / days.length : 0; }
/** Média só dos dias em que houve registro do dia (evita diluir com dias vazios). */
export function meanLogged(cat, days) {
  const ks = days.filter(hasEntry);
  return ks.length ? sum(cat, ks) / ks.length : 0;
}

/* ── Sequências ────────────────────────────────────────────── */

/** Sequência atual: dias seguidos fazendo (ou, em metas "max", sem fazer). */
export function currentStreak(cat, from = todayKey()) {
  const reduce = isReduce(cat);
  let k = from, n = 0;
  // o dia de hoje só quebra a sequência de "fazer" depois de encerrado
  if (!reduce && !did(cat, k)) k = addDays(k, -1);
  for (let i = 0; i < 400; i++) {
    const ok = reduce ? !did(cat, k) && hasEntry(k) : did(cat, k);
    if (!ok) break;
    n++; k = addDays(k, -1);
  }
  return n;
}

export function bestStreak(cat, days = 365) {
  const reduce = isReduce(cat);
  let best = 0, run = 0;
  for (const k of lastNDays(days)) {
    const ok = reduce ? !did(cat, k) && hasEntry(k) : did(cat, k);
    run = ok ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Sequência de dias registrados (o hábito de usar o caderno). */
export function logStreak() {
  let k = todayKey(), n = 0;
  if (!hasEntry(k)) k = addDays(k, -1);
  for (let i = 0; i < 400; i++) {
    if (!hasEntry(k)) break;
    n++; k = addDays(k, -1);
  }
  return n;
}

/* ── Metas ─────────────────────────────────────────────────── */

/** Progresso da meta no período corrente. */
export function goalProgress(cat, key = todayKey()) {
  if (!cat.goal) return null;
  const { mode, value, period } = cat.goal;
  const days = period === 'day' ? [key] : weekOf(key);
  const done = cat.type === 'toggle'
    ? days.filter(k => did(cat, k)).length
    : sum(cat, days);
  const left = period === 'week'
    ? weekOf(key).filter(k => k >= todayKey()).length
    : 0;
  const ok = mode === 'min' ? done >= value : done <= value;
  return { mode, value, period, done, left, ok, pct: value ? Math.min(1, done / value) : 0 };
}

/* ── Padrões ───────────────────────────────────────────────── */

/** Média por dia da semana (0=dom). */
export function weekdayProfile(cat, days) {
  const acc = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  for (const k of days) {
    if (!hasEntry(k)) continue;
    const w = parseKey(k).getDay();
    acc[w].sum += num(cat, k);
    acc[w].n++;
  }
  return acc.map(a => (a.n ? a.sum / a.n : 0));
}

/** Comparação: dias COM a categoria binária vs dias SEM, medindo outra. */
export function compare(binCat, numCat, days) {
  const withD = [], without = [];
  for (const k of days) {
    if (!hasEntry(k)) continue;
    (did(binCat, k) ? withD : without).push(num(numCat, k));
  }
  if (withD.length < 3 || without.length < 3) return null;
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const a = avg(withD), b = avg(without);
  return { with: a, without: b, delta: a - b, nWith: withD.length, nWithout: without.length };
}

/** Pearson entre duas séries diárias. */
export function correlation(catA, catB, days) {
  const ks = days.filter(hasEntry);
  if (ks.length < 10) return null;
  const xs = ks.map(k => num(catA, k)), ys = ks.map(k => num(catB, k));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return { r: sxy / Math.sqrt(sxx * syy), n: ks.length };
}

/* ── Sugestões ─────────────────────────────────────────────── */

const fmtVal = (cat, v) => {
  if (cat.type === 'hours') return `${nf(v, 1)}h`;
  if (cat.type === 'toggle') return `${nf(v * 100, 0)}%`;
  return nf(v, v % 1 ? 1 : 0);
};

/**
 * Gera até `limit` observações sobre os dados.
 * Cada item: { kind, title, text } — `text` aceita <b> para destaque.
 */
export function suggestions(limit = 7) {
  const cats = state.categories.filter(c => !c.archived && c.type !== 'text');
  const d30 = lastNDays(30), d14 = lastNDays(14), prev14 = lastNDays(14, addDays(todayKey(), -14));
  const logged30 = loggedDays(d30);
  const out = [];

  /* 1. hábito de registrar */
  const ls = logStreak();
  if (logged30 < 10) {
    out.push({ kind: 'registro', title: 'Comece pelo básico', weight: 9,
      text: `Você registrou <b>${logged30} dos últimos 30 dias</b>. Os padrões aparecem a partir de ~14 dias. Dois toques por dia já bastam.` });
  } else if (ls >= 3) {
    out.push({ kind: 'registro', title: 'Constância', weight: 4,
      text: `<b>${ls} dias seguidos</b> de registro, ${logged30} nos últimos 30. Os números abaixo já são confiáveis.` });
  }

  for (const cat of cats) {
    const reduce = isReduce(cat);
    const streak = currentStreak(cat);
    const best = bestStreak(cat);

    /* 2. meta da semana */
    const gp = goalProgress(cat);
    if (gp && gp.period === 'week') {
      if (gp.mode === 'min' && !gp.ok && (gp.left <= 3 || gp.value - gp.done > gp.left)) {
        const falta = gp.value - gp.done;
        out.push({ kind: 'meta', title: `${cat.emoji} ${cat.label}`, weight: falta > gp.left ? 8 : 6,
          text: falta > gp.left
            ? `Faltam <b>${nf(falta)}</b> para a meta da semana e só restam <b>${gp.left}</b> dias. Dá pra ajustar a meta em Ajustes se ela não bate com a vida real.`
            : `<b>${nf(gp.done)}/${nf(gp.value)}</b> na semana. Faltam ${nf(falta)} em ${gp.left} dia(s) — ainda dá.` });
      }
      if (gp.mode === 'max' && gp.done > gp.value) {
        out.push({ kind: 'meta', title: `${cat.emoji} ${cat.label}`, weight: 8,
          text: `<b>${nf(gp.done)}</b> nesta semana, acima do teto de ${nf(gp.value)}. Vale olhar o que dispara: veja o dia da semana abaixo.` });
      }
    }

    /* 3. sequências */
    if (streak >= 3) {
      out.push({ kind: 'sequência', title: `${cat.emoji} ${cat.label}`, weight: 5,
        text: reduce
          ? `<b>${streak} dias sem</b>. Seu recorde é ${best}.`
          : `<b>${streak} dias seguidos</b>. Seu recorde é ${best}.` });
    }

    /* 4. tendência 14 vs 14 */
    const a = meanLogged(cat, d14), b = meanLogged(cat, prev14);
    if (b > 0 && Math.abs(a - b) / b > 0.25 && loggedDays(d14) >= 5 && loggedDays(prev14) >= 5) {
      const up = a > b;
      const bom = reduce ? !up : up;
      out.push({ kind: 'tendência', title: `${cat.emoji} ${cat.label}`, weight: bom ? 4 : 7,
        text: `${cat.type === 'toggle' ? 'Frequência' : 'Média diária'} ${up ? 'subiu' : 'caiu'} de <b>${fmtVal(cat, b)}</b> para <b>${fmtVal(cat, a)}</b> nas últimas 2 semanas${bom ? ' — na direção que você queria.' : '.'}` });
    }

    /* 5. dia da semana fora da curva */
    if (logged30 >= 12) {
      const prof = weekdayProfile(cat, lastNDays(56));
      const avg = prof.reduce((x, y) => x + y, 0) / 7;
      if (avg > 0) {
        const hi = prof.indexOf(Math.max(...prof)), lo = prof.indexOf(Math.min(...prof));
        if (prof[hi] > avg * 1.8) {
          out.push({ kind: 'padrão', title: `${cat.emoji} ${cat.label}`, weight: reduce ? 7 : 3,
            text: `Concentra em <b>${WD_LONG[hi]}</b> (${fmtVal(cat, prof[hi])} contra ${fmtVal(cat, avg)} na média).` });
        } else if (prof[lo] < avg * 0.25 && !reduce) {
          out.push({ kind: 'padrão', title: `${cat.emoji} ${cat.label}`, weight: 4,
            text: `<b>${WD_LONG[lo].charAt(0).toUpperCase() + WD_LONG[lo].slice(1)}</b> é o buraco da semana. Um plano só pra esse dia costuma resolver.` });
        }
      }
    }
  }

  /* 6. cruzamentos entre categorias */
  const bins = cats.filter(c => c.type === 'toggle' || c.type === 'count');
  const nums = cats.filter(c => c.type === 'hours' || c.type === 'scale' || c.type === 'count');
  for (const b of bins) {
    for (const n of nums) {
      if (b.id === n.id) continue;
      const c = compare(b, n, lastNDays(60));
      if (!c) continue;
      const base = Math.abs(c.without) || 1;
      if (Math.abs(c.delta) / base < 0.2 || Math.abs(c.delta) < 0.25) continue;
      out.push({ kind: 'cruzamento', title: `${b.emoji} ${b.label} × ${n.emoji} ${n.label}`, weight: 6,
        text: `Nos dias com ${b.label.toLowerCase()}, ${n.label.toLowerCase()} fica em <b>${fmtVal(n, c.with)}</b>; sem, <b>${fmtVal(n, c.without)}</b>. (${c.nWith} vs ${c.nWithout} dias)` });
    }
  }

  /* 7. afazeres esquecidos */
  const velhas = state.todos.filter(t => !t.done && Date.now() - t.createdAt > 12 * 864e5);
  if (velhas.length) {
    out.push({ kind: 'lista', title: 'Lista de afazeres', weight: 5,
      text: `<b>${velhas.length} tarefa(s)</b> abertas há mais de 12 dias. Se não vai fazer, apagar também é decidir.` });
  }

  const seen = new Set();
  return out
    .sort((x, y) => y.weight - x.weight)
    .filter(s => { const k = s.kind + s.title; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, limit);
}
