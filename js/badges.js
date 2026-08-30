/* badges.js — a régua do "menos fudido".

   Nada aqui é palpite: XP e conquistas saem dos mesmos dados que você
   registra. Se apagar um dia, o número cai junto — é medida, não prêmio de
   participação. As conquistas guardam só a data em que caíram, pra poder
   comemorar uma vez e não toda hora. */

import { state, listCategories, listTodos, hasEntry, getDay } from './store.js';
import { lastNDays, todayKey, addDays } from './utils.js';
import { currentStreak, bestStreak, logStreak, goalProgress, isReduce, weekOf, did } from './analysis.js';

/* ── A escada ──────────────────────────────────────────────── */
export const LEVELS = [
  { min: 0,    name: 'Modo caos',        lore: 'O caderno existe. Já é alguma coisa.' },
  { min: 50,   name: 'Dando sinal de vida', lore: 'Você aparece com alguma frequência.' },
  { min: 150,  name: 'Funcional',        lore: 'Dá pra confiar em você numa terça-feira.' },
  { min: 350,  name: 'No eixo',          lore: 'A semana já tem forma. Poucos buracos.' },
  { min: 700,  name: 'Menos fudido',     lore: 'Aquilo que você queria quando abriu isso aqui.' },
  { min: 1200, name: 'Vivendo direito',  lore: 'Metas batidas viraram rotina, não exceção.' },
  { min: 2000, name: 'Assustadoramente adulto', lore: 'Louça, lixo, academia e sono. Quem é você.' },
  { min: 3000, name: 'Lenda doméstica',  lore: 'Escreveram um mito sobre a sua pia vazia.' },
];

/* ── XP ────────────────────────────────────────────────────── */
/* Só conta o que foi de fato registrado: semana sem nenhum dia anotado não
   rende meta batida, senão abstinência de categoria vazia viraria XP de
   graça. O cache evita recalcular a cada pintura de tela. */
let cacheXp = { rev: -1, val: null };

export function xp() {
  if (cacheXp.rev === state.rev && cacheXp.val) return cacheXp.val;

  let total = 0;
  let fechados = 0;
  const comMetaDiaria = listCategories().filter(c => !c.archived && c.goal?.period === 'day');

  for (const k of Object.keys(state.days)) {
    if (!hasEntry(k)) continue;
    const dia = getDay(k);
    total += 2;                                   // registrar o dia
    if (dia?.closed) { total += 3; fechados++; }  // fechar o dia
    if (dia?.note) total += 1;                    // escrever sobre ele
    for (const cat of comMetaDiaria) {            // meta diária batida
      if (goalProgress(cat, k)?.ok) total += 3;
    }
  }

  // metas semanais, só em semanas que têm registro
  const comMetaSemanal = listCategories().filter(c => !c.archived && c.goal?.period === 'week');
  if (comMetaSemanal.length) {
    for (let w = 0; w < 12; w++) {
      const dia = addDays(todayKey(), -7 * w);
      if (!weekOf(dia).some(hasEntry)) continue;
      for (const cat of comMetaSemanal) {
        if (goalProgress(cat, dia)?.ok) total += 8;
      }
    }
  }

  // sequências: cada semana inteira seguida vale um empurrão
  total += Math.floor(logStreak() / 7) * 10;
  for (const cat of listCategories().filter(c => !c.archived)) {
    total += Math.floor(bestStreak(cat) / 7) * 5;
  }

  total += listTodos().filter(t => t.done).length;  // tarefa concluída

  cacheXp = { rev: state.rev, val: { total, fechados } };
  return cacheXp.val;
}

export function level(total) {
  let i = 0;
  for (let n = 0; n < LEVELS.length; n++) if (total >= LEVELS[n].min) i = n;
  const atual = LEVELS[i];
  const proximo = LEVELS[i + 1] || null;
  const base = atual.min;
  const teto = proximo ? proximo.min : atual.min;
  return {
    i, ...atual, proximo,
    falta: proximo ? proximo.min - total : 0,
    pct: proximo ? Math.min(1, (total - base) / (teto - base)) : 1,
  };
}

/* ── Catálogo ──────────────────────────────────────────────── */
const diasRegistrados = () => Object.keys(state.days).filter(hasEntry).length;
const anotacoes = () => Object.values(state.days).filter(d => d.note).length;

/** Semana em que todas as metas foram batidas. `offset` em semanas atrás. */
function semanaPerfeita(offset = 0) {
  const dia = addDays(todayKey(), -7 * offset);
  const cats = listCategories().filter(c => !c.archived && c.goal?.period === 'week');
  if (!cats.length) return false;
  if (!weekOf(dia).some(hasEntry)) return false;
  return cats.every(c => goalProgress(c, dia)?.ok);
}

const FIXAS = [
  { id: 'primeiro-dia', emoji: '🌱', name: 'Primeiro registro', desc: 'Você anotou um dia.',
    test: () => diasRegistrados() >= 1, progress: () => Math.min(1, diasRegistrados()) },
  { id: 'semana-cheia', emoji: '📅', name: 'Semana cheia', desc: 'Sete dias seguidos de registro.',
    test: () => logStreak() >= 7, progress: () => logStreak() / 7, hint: () => `${logStreak()}/7 dias` },
  { id: 'quinzena', emoji: '🔁', name: 'Quinzena', desc: 'Quinze dias seguidos sem furar.',
    test: () => logStreak() >= 15, progress: () => logStreak() / 15, hint: () => `${logStreak()}/15 dias` },
  { id: 'mes-fechado', emoji: '🗓️', name: 'Mês fechado', desc: 'Trinta dias seguidos. Virou hábito.',
    test: () => logStreak() >= 30, progress: () => logStreak() / 30, hint: () => `${logStreak()}/30 dias` },
  { id: 'cem-dias', emoji: '💯', name: 'Cem dias', desc: 'Cem dias registrados no total.',
    test: () => diasRegistrados() >= 100, progress: () => diasRegistrados() / 100, hint: () => `${diasRegistrados()}/100` },
  { id: 'ritual', emoji: '✅', name: 'Ritual', desc: 'Vinte dias fechados de propósito.',
    test: () => xp().fechados >= 20, progress: () => xp().fechados / 20, hint: () => `${xp().fechados}/20 fechados` },
  { id: 'diarista', emoji: '✍️', name: 'Diarista', desc: 'Dez anotações escritas.',
    test: () => anotacoes() >= 10, progress: () => anotacoes() / 10, hint: () => `${anotacoes()}/10 anotações` },
  { id: 'semana-perfeita', emoji: '🎯', name: 'Semana perfeita', desc: 'Todas as metas da semana batidas.',
    test: () => [0, 1, 2, 3, 4, 5, 6, 7].some(w => semanaPerfeita(w)) },
  { id: 'trinca-perfeita', emoji: '🏆', name: 'Trinca perfeita', desc: 'Três semanas perfeitas seguidas.',
    test: () => [0, 1, 2, 3, 4, 5].some(w => semanaPerfeita(w) && semanaPerfeita(w + 1) && semanaPerfeita(w + 2)) },
  { id: 'lista-zerada', emoji: '🧹', name: 'Lista zerada', desc: 'Nenhuma tarefa em aberto (com pelo menos cinco feitas).',
    test: () => listTodos().filter(t => t.done).length >= 5 && listTodos().every(t => t.done) },
  { id: 'virou-a-chave', emoji: '📈', name: 'Virou a chave', desc: 'Uma categoria melhorou de verdade em duas semanas.',
    test: () => listCategories().filter(c => !c.archived && !isReduce(c)).some(c => {
      const a = lastNDays(14).filter(k => did(c, k)).length;
      const b = lastNDays(14, addDays(todayKey(), -14)).filter(k => did(c, k)).length;
      return b >= 2 && a >= b * 1.5 && a >= 5;
    }) },
  { id: 'volta-por-cima', emoji: '🔙', name: 'Volta por cima', desc: 'Voltou a registrar depois de sumir uma semana.',
    test: () => {
      const buraco = lastNDays(21).slice(0, 10).filter(k => !hasEntry(k)).length;
      return buraco >= 5 && logStreak() >= 5;
    } },
];

/** Conquistas que nascem das SUAS categorias — mudam quando você edita. */
function dinamicas() {
  const out = [];
  for (const cat of listCategories().filter(c => !c.archived && c.type !== 'text')) {
    const reduzir = isReduce(cat);
    for (const n of [7, 30]) {
      out.push({
        id: `${reduzir ? 'limpo' : 'seq'}-${cat.id}-${n}`,
        emoji: reduzir ? '🧊' : '🔥',
        name: reduzir
          ? `${cat.emoji || '•'} ${cat.label}: ${n} limpo`
          : `${cat.emoji || '•'} ${cat.label} × ${n}`,
        desc: reduzir ? `${n} dias seguidos sem.` : `${n} dias seguidos.`,
        test: () => currentStreak(cat) >= n || bestStreak(cat) >= n,
        progress: () => Math.max(currentStreak(cat), bestStreak(cat)) / n,
        hint: () => `${Math.max(currentStreak(cat), bestStreak(cat))}/${n} dias`,
      });
    }
  }
  return out;
}

export function catalog() { return [...FIXAS, ...dinamicas()]; }

/* ── Avaliação ─────────────────────────────────────────────── */
/** Lista completa com o que está ganho, quando e o quanto falta. */
export function evaluate() {
  const ganhas = state.badges || {};
  return catalog().map(b => {
    let got = false;
    try { got = !!b.test(); } catch { got = false; }
    let progress = got ? 1 : 0;
    if (!got && b.progress) { try { progress = Math.min(0.99, Math.max(0, b.progress())); } catch {} }
    return {
      id: b.id, emoji: b.emoji, name: b.name, desc: b.desc,
      got, at: ganhas[b.id] || null, progress,
      hint: !got && b.hint ? (() => { try { return b.hint(); } catch { return ''; } })() : '',
    };
  });
}

/** Carimba as novas e devolve só elas (pra comemorar uma vez só). */
export function claim() {
  if (!state.badges) state.badges = {};
  const novas = [];
  for (const b of evaluate()) {
    if (b.got && !state.badges[b.id]) {
      state.badges[b.id] = Date.now();
      novas.push(b);
    }
  }
  return novas;
}

export function summary() {
  const { total } = xp();
  const lista = evaluate();
  return {
    xp: total,
    level: level(total),
    ganhas: lista.filter(b => b.got).length,
    total: lista.length,
    lista,
  };
}
