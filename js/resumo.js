/* resumo.js — a retrospectiva do caderno em cartões.

   Só o cálculo mora aqui: cada cartão é um objeto com o que dizer e o
   número que carrega. Cartão sem dado suficiente não entra — retrospectiva
   com "0" em tudo é constrangedora, não é celebração. */

import { state, listCategories, listTodos, hasEntry, getDay, cadencia } from './store.js';
import { lastNDays, todayKey, addDays, parseKey, WD_LONG, MONTHS, nf } from './utils.js';
import { num, did, isReduce, bestStreak, currentStreak, loggedDays, weekdayProfile } from './analysis.js';
import { summary as placar } from './badges.js';

export const PERIODOS = [
  { id: '30', label: '30 dias', dias: 30 },
  { id: '90', label: '90 dias', dias: 90 },
  { id: 'tudo', label: 'tudo', dias: 0 },
];

/** Chaves do período pedido — 'tudo' começa no primeiro dia registrado. */
export function diasDoPeriodo(id = 'tudo') {
  if (id !== 'tudo') return lastNDays(Number(id));
  const chaves = Object.keys(state.days).filter(hasEntry).sort();
  if (!chaves.length) return lastNDays(30);
  const inicio = chaves[0];
  const total = Math.min(730, Math.round((parseKey(todayKey()) - parseKey(inicio)) / 864e5) + 1);
  return Array.from({ length: total }, (_, i) => addDays(inicio, i));
}

const periodoEmTexto = dias => {
  if (!dias.length) return '';
  const a = parseKey(dias[0]), b = parseKey(dias[dias.length - 1]);
  const mes = d => MONTHS[d.getMonth()].slice(0, 3);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${mes(b)}`
    : `${a.getDate()} ${mes(a)} — ${b.getDate()} ${mes(b)}`;
};

/**
 * Monta os cartões. Devolve [{ id, olho, linhas, numero, sufixo, nota }]
 * `linhas` é o texto grande, quebrado do jeito que deve aparecer.
 */
export function cartoes(periodo = 'tudo') {
  const dias = diasDoPeriodo(periodo);
  const registrados = loggedDays(dias);
  const cats = listCategories().filter(c => !c.archived && c.type !== 'text');
  const b = placar();
  const out = [];

  out.push({
    id: 'capa', capa: true,
    olho: periodoEmTexto(dias),
    linhas: ['O SEU', 'CADERNO', 'ATÉ AQUI'],
    nota: registrados ? `${registrados} dias registrados` : 'ainda sem dados — registre alguns dias',
  });

  if (!registrados) return out;

  out.push({
    id: 'dias', olho: 'VOCÊ APARECEU',
    numero: registrados, sufixo: registrados === 1 ? ' dia' : ' dias',
    linhas: [`de ${dias.length}`],
    nota: registrados / dias.length > 0.7
      ? 'presença de quem leva a sério'
      : 'cada dia anotado é um dia que existe',
  });

  /* sequência */
  const seqTop = Math.max(0, ...cats.map(c => bestStreak(c, dias.length)));
  const catSeq = cats.find(c => bestStreak(c, dias.length) === seqTop);
  if (seqTop >= 3 && catSeq) {
    out.push({
      id: 'sequencia', olho: 'SUA MAIOR SEQUÊNCIA',
      numero: seqTop, sufixo: ' dias',
      linhas: [isReduce(catSeq) ? `SEM ${catSeq.label.toUpperCase()}` : catSeq.label.toUpperCase()],
      nota: isReduce(catSeq) ? 'seguidos, sem escorregar' : 'seguidos, sem falhar',
    });
  }

  /* o que você mais fez */
  const feitos = cats
    .filter(c => !isReduce(c))
    .map(c => ({ c, n: dias.filter(k => did(c, k)).length }))
    .sort((x, y) => y.n - x.n);
  if (feitos[0]?.n) {
    out.push({
      id: 'campeao', olho: 'O QUE VOCÊ MAIS FEZ',
      linhas: [feitos[0].c.label.toUpperCase()],
      numero: feitos[0].n, sufixo: feitos[0].n === 1 ? ' vez' : ' vezes',
      nota: feitos[1]?.n ? `depois vem ${feitos[1].c.label.toLowerCase()}, com ${feitos[1].n}` : '',
    });
  }

  /* dia da semana mais forte da categoria campeã */
  if (feitos[0]?.n >= 5) {
    const perfil = weekdayProfile(feitos[0].c, dias);
    const media = perfil.reduce((a, x) => a + x, 0) / 7;
    const melhor = perfil.indexOf(Math.max(...perfil));
    if (media > 0 && perfil[melhor] > media * 1.3) {
      out.push({
        id: 'diadasemana', olho: 'SEU DIA É',
        linhas: [WD_LONG[melhor].toUpperCase()],
        nota: `é quando ${feitos[0].c.label.toLowerCase()} acontece de verdade`,
      });
    }
  }

  /* horas somadas */
  const horas = cats.filter(c => c.type === 'hours')
    .map(c => ({ c, total: dias.reduce((a, k) => a + num(c, k), 0) }))
    .sort((x, y) => y.total - x.total)[0];
  if (horas?.total >= 10) {
    out.push({
      id: 'horas', olho: `${horas.c.label.toUpperCase()}, SOMANDO TUDO`,
      numero: Math.round(horas.total), sufixo: 'h',
      linhas: [`${nf(horas.total / 24, 1)} dias inteiros`],
      nota: 'foi isso que o relógio viu',
    });
  }

  /* dias limpos */
  const reduzir = cats.filter(isReduce)
    .map(c => ({ c, limpos: dias.filter(k => hasEntry(k) && !did(c, k)).length }))
    .sort((x, y) => y.limpos - x.limpos)[0];
  if (reduzir?.limpos >= 5) {
    out.push({
      id: 'limpos', olho: 'DIAS LIMPOS',
      numero: reduzir.limpos, sufixo: ' dias',
      linhas: [`SEM ${reduzir.c.label.toUpperCase()}`],
      nota: 'não fazer também conta',
    });
  }

  /* missões */
  const feitas = listTodos().filter(t => t.done).length;
  if (feitas >= 3) {
    out.push({
      id: 'missoes', olho: 'DA LISTA, VOCÊ RISCOU',
      numero: feitas, sufixo: feitas === 1 ? ' tarefa' : ' tarefas',
      linhas: ['RISCADAS'],
      nota: 'sem contar as que você fingiu que não viu',
    });
  }

  /* dias fechados */
  const fechados = dias.filter(k => getDay(k)?.closed).length;
  if (fechados >= 5) {
    out.push({
      id: 'ritual', olho: 'VOCÊ FECHOU O DIA',
      numero: fechados, sufixo: fechados === 1 ? ' vez' : ' vezes',
      linhas: ['DE PROPÓSITO'],
      nota: 'fechar é diferente de esquecer',
    });
  }

  /* onde você está */
  out.push({
    id: 'nivel', olho: `NÍVEL ${b.level.i + 1} DE 8`,
    linhas: [b.level.name.toUpperCase()],
    numero: b.xp, sufixo: ' xp',
    nota: `${b.ganhas} de ${b.total} conquistas · ${b.level.lore}`,
  });

  /* fecho */
  const nome = (state.profile?.nome || '').trim().split(/\s+/)[0];
  out.push({
    id: 'fim', fim: true,
    olho: 'E É ISSO',
    linhas: nome ? [`ATÉ AMANHÃ,`, nome.toUpperCase()] : ['ATÉ AMANHÃ'],
    nota: frase(registrados, dias.length, currentStreak(cats[0] || {})),
  });

  return out;
}

function frase(registrados, total, seq) {
  const taxa = registrados / Math.max(1, total);
  if (taxa > 0.85) return 'Você não falhou quase nunca. Isso é raro.';
  if (taxa > 0.6) return 'Consistência mais do que suficiente pra confiar nos números.';
  if (taxa > 0.3) return 'Deu pra ver um padrão. Mais alguns dias e dá pra ver o resto.';
  return 'Começou. É o passo que a maioria não dá.';
}
