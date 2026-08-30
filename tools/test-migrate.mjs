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
ok(out.version === 2, 'versão vira 2');
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

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
