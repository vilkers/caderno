/* Garante que um caderno gravado pela versão antiga continua abrindo.
   Rode com: node tools/test-migrate.mjs */

import { migrate } from '../js/store.js';
const v1 = {
  version: 1,
  settings: { palette: 'oceano', motion: false, autolock: 5, showStreaks: true },
  categories: [
    { id: 'a', emoji: '🏋️', label: 'Academia', type: 'toggle', goal: { mode: 'min', value: 4, period: 'week' } },
    { id: 'b', emoji: '🍺', label: 'Bebida', type: 'count' },
  ],
  days: { '2026-08-24': { v: { a: true, b: 2 }, note: 'oi', closed: true } },
  todos: [{ id: 't', text: 'pagar luz', done: false, star: true, createdAt: 1756000000000 }],
};
const out = migrate(v1);
let falhas = 0;
const ok = (c, n) => { console.log((c ? '  ok  ' : '  FALHOU ') + n); if (!c) falhas++; };
ok(out.version === 3, 'versão vira 3');
ok(Array.isArray(out.agenda) && out.agenda.length === 0, 'documento antigo ganha agenda vazia');
ok(out.settings.palette === 'oceano' && out.settings.autolock === 5, 'preferências preservadas');
ok(out.settings.weekStart === 1, 'início de semana ganha padrão');
ok(out.settings.sync && out.settings.sync.enabled === false, 'bloco de sincronia criado desligado');
ok(out.categories.every(c => c.updatedAt && c.order !== undefined), 'categorias ganham updatedAt e ordem');
ok(out.categories[0].label === 'Academia', 'categorias preservadas');
ok(out.days['2026-08-24'].v.b === 2 && out.days['2026-08-24'].closed === true, 'dia preservado');
ok(out.days['2026-08-24'].updatedAt > 0, 'dia ganha updatedAt');
ok(out.todos[0].text === 'pagar luz' && out.todos[0].star === true, 'tarefa preservada');
ok(out.todos[0].updatedAt > 0, 'tarefa ganha updatedAt');
const vazio = migrate(null);
ok(vazio.categories.length === 9 && vazio.days && vazio.todos.length === 0, 'documento nulo vira caderno novo');

{
  const doc = migrate({ ...v1, agenda: [
    { label: 'Aluguel', dia: 5 },
    { id: 'x', label: 'Netflix', tipo: 'assinatura', dia: 15, valor: 44.9, marcas: { '2026-09': { feito: true, em: 1 } } },
  ] });
  ok(doc.agenda.length === 2, 'agenda atravessa a migração');
  ok(!!doc.agenda[0].id && doc.agenda[0].repete === 'mensal' && doc.agenda[0].tipo === 'conta',
     'compromisso sem campos ganha id, tipo e repetição');
  ok(doc.agenda[1].marcas['2026-09'].feito === true, 'as marcas do mês sobrevivem');
}

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
