/* Testa a cadência por dia da semana e a tarefa com data.
   Rode com: node tools/test-dias.mjs

   São as duas regras que decidem o que o dia cobra de você — erradas, o
   painel do check-in mente, que é a única coisa que o app não pode fazer. */

import * as store from '../js/store.js';
import { currentStreak, bestStreak, unidadeStreak, pluralStreak } from '../js/analysis.js';
import { todayKey, addDays, parseKey } from '../js/utils.js';

let falhas = 0;
const ok = (cond, nome) => {
  console.log(`${cond ? '  ok ' : '  FALHOU '} ${nome}`);
  if (!cond) falhas++;
};

globalThis.localStorage ??= {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

const SEG = '2026-09-07', TER = '2026-09-08', QUA = '2026-09-09';

console.log('dias da semana');
{
  const terapia = { label: 'Terapia', cadence: 'diaria', dias: [2] };
  ok(!store.cobraNoDia(terapia, SEG), 'terça-feira não cobra na segunda');
  ok(store.cobraNoDia(terapia, TER), 'e cobra na terça');
  ok(!store.cobraNoDia(terapia, QUA), 'nem na quarta');
  ok(store.rotuloDias(terapia) === 'ter', 'o rótulo diz que dia é');

  const semDias = { label: 'Sono', cadence: 'diaria' };
  ok(store.cobraNoDia(semDias, SEG) && store.cobraNoDia(semDias, TER),
    'sem lista de dias, cobra todo dia — nada a migrar');
  ok(store.rotuloDias(semDias) === null, 'e não escreve rótulo nenhum');

  const vazia = { label: 'Louça', cadence: 'diaria', dias: [] };
  ok(store.cobraNoDia(vazia, QUA), 'lista vazia é o mesmo que todos os sete');

  const sete = { label: 'Água', cadence: 'diaria', dias: [0, 1, 2, 3, 4, 5, 6] };
  ok(store.rotuloDias(sete) === null, 'os sete dias não viram rótulo — é "todo dia"');

  const semanal = { label: 'Academia', cadence: 'semanal', dias: [1] };
  ok(!store.cobraNoDia(semanal, SEG), 'cadência semanal nunca cobra por dia, tenha dias ou não');
  const livre = { label: 'Bebida', cadence: 'livre' };
  ok(!store.cobraNoDia(livre, SEG), 'e "quando rolar" também não');

  const fds = { label: 'Feira', cadence: 'diaria', dias: [6, 0] };
  ok(store.rotuloDias(fds) === 'dom·sáb', 'vários dias saem em ordem');
}

console.log('\nsequência por ocorrência');
{
  /* A dívida que a rodada 14 assumiu: terapia toda terça nunca passava de 1,
     porque a sequência andava dia a dia e a quarta-feira quebrava tudo.
     As datas são relativas a hoje de propósito — teste que só passa numa
     terça-feira é um teste que mente seis dias por semana. */
  const terapia = { id: 'seq-ter', label: 'Terapia', cadence: 'diaria', dias: [2], type: 'toggle' };
  const todoDia = { id: 'seq-dia', label: 'Remédio', cadence: 'diaria', type: 'toggle' };

  let terca = todayKey();
  while (parseKey(terca).getDay() !== 2) terca = addDays(terca, -1);

  store.state.days = {};
  const marca = k => { store.state.days[k] = { v: { 'seq-ter': true, 'seq-dia': true }, note: '', updatedAt: Date.now() }; };
  for (let i = 0; i < 5; i++) marca(addDays(terca, -7 * i));

  ok(currentStreak(terapia) === 5, 'cinco terças seguidas contam 5 (antes travava em 1)');
  ok(bestStreak(terapia) === 5, 'e o recorde também enxerga as cinco');
  ok(currentStreak(todoDia) <= 1, 'a mesma marcação, numa categoria de todo dia, não vira sequência');

  /* uma terça em branco no meio corta */
  delete store.state.days[addDays(terca, -14)];
  ok(currentStreak(terapia) === 2, 'faltar uma terça corta a sequência ali');

  /* marcar numa quarta não conta como ocorrência: não é o dia dela */
  marca(addDays(terca, -13));
  ok(currentStreak(terapia) === 2, 'e marcar fora do dia não remenda a sequência');

  ok(unidadeStreak(terapia) === 'ter' && pluralStreak(terapia) === 'terças',
    'a sequência é escrita na unidade dela — 5 ter, não 5d');
  ok(unidadeStreak(todoDia) === 'd' && pluralStreak(todoDia) === 'dias',
    'e a de todo dia continua em dias');

  const seg_qua_sex = { id: 'seq-3', label: 'Corrida', cadence: 'diaria', dias: [1, 3, 5], type: 'count' };
  ok(unidadeStreak(seg_qua_sex) === 'x' && pluralStreak(seg_qua_sex) === 'vezes',
    'com mais de um dia, a unidade é "vezes"');
  store.state.days = {};
}

console.log('\ntarefa com data');
{
  store.state.todos.length = 0;
  const hoje = store.addTodo('Levar o Estojo no vet', { due: TER });
  store.addTodo('Comprar ração', { due: SEG });
  const solta = store.addTodo('Ler o contrato');

  ok(store.todosDoDia(TER).length === 1, 'o dia devolve só o que foi marcado nele');
  ok(store.todosDoDia(QUA).length === 0, 'e nada num dia sem tarefa');
  ok(solta.due === null, 'tarefa nasce sem data');
  ok(store.todosAtrasados(TER).map(t => t.text).join() === 'Comprar ração',
    'o que passou do dia e continua aberto conta como atrasado');

  store.updateTodo(hoje.id, { done: true });
  ok(store.todosDoDia(TER).length === 0, 'concluída sai do dia');
  ok(store.todosAtrasados(QUA).length === 1, 'e sai dos atrasados também');

  store.updateTodo(hoje.id, { done: false, due: null });
  ok(store.todosDoDia(TER).length === 0, 'tirar a data tira do calendário');
  ok(store.listTodos().length === 3, 'sem apagar a tarefa');
}

console.log('\nordem da lista de afazeres');
{
  store.state.todos.length = 0;
  const hoje = todayKey();
  const ontem = addDays(hoje, -1), amanha = addDays(hoje, 1);
  const b = store.addTodo('Zelar pelo Estojo', { due: amanha });
  const a = store.addTodo('Comprar café');
  const c = store.addTodo('Atrasada', { due: ontem });
  const nomes = ordem => store.ordenarTodos(store.listTodos(), ordem, hoje).map(t => t.text);

  ok(nomes('prazo')[0] === 'Atrasada', 'por prazo, a atrasada vem primeiro');
  ok(nomes('prazo')[2] === 'Comprar café', 'e a sem data vai pro fim');
  ok(nomes('alfabetica').join() === 'Atrasada,Comprar café,Zelar pelo Estojo', 'A–Z ordena por nome');
  ok(nomes('recentes')[0] === 'Atrasada', 'mais novas: a última escrita no topo');
  ok(nomes('manual')[0] === 'Atrasada', 'do meu jeito, quem já venceu ainda sobe');

  store.updateTodo(c.id, { done: true });
  ['manual', 'prazo', 'alfabetica', 'recentes'].forEach(o =>
    ok(nomes(o).at(-1) === 'Atrasada', `concluída desce em qualquer ordem (${o})`));

  ok(nomes('inventada')[0] !== undefined, 'ordem desconhecida não quebra a lista');
  store.state.todos.length = 0;
}

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
