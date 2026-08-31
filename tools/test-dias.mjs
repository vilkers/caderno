/* Testa a cadência por dia da semana e a tarefa com data.
   Rode com: node tools/test-dias.mjs

   São as duas regras que decidem o que o dia cobra de você — erradas, o
   painel do check-in mente, que é a única coisa que o app não pode fazer. */

import * as store from '../js/store.js';

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

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
