/* Testa a junção de dois cadernos. Rode com: node tools/test-merge.mjs
   Não faz parte do app publicado — é só rede de segurança da lógica que
   decide o que sobrevive quando dois aparelhos escrevem o mesmo arquivo. */

import { mergeDocs, mergeById, mergeDays, diffSummary, TOMB_TTL } from '../js/merge.js';

let falhas = 0;
const ok = (cond, nome) => {
  console.log(`${cond ? '  ok ' : '  FALHOU '} ${nome}`);
  if (!cond) falhas++;
};

const T = 1_700_000_000_000;
const base = (over = {}) => ({
  version: 2, rev: 1, updatedAt: T, settings: { palette: 'noir', updatedAt: T, sync: { token: 'local' } },
  categories: [], days: {}, todos: [], ...over,
});

console.log('dias');
{
  const local = base({ days: { '2026-08-24': { v: { a: true }, updatedAt: T } } });
  const remote = base({ days: { '2026-08-25': { v: { a: true }, updatedAt: T } } });
  const { doc, changed } = mergeDocs(local, remote, T + 1);
  ok(Object.keys(doc.days).length === 2, 'dia que só existe no repositório entra');
  ok(changed === true, 'a junção avisa que mudou');
}
{
  const local = base({ days: { d: { v: { a: 1 }, updatedAt: T + 100 } } });
  const remote = base({ days: { d: { v: { a: 9 }, updatedAt: T } } });
  const { doc } = mergeDocs(local, remote, T + 200);
  ok(doc.days.d.v.a === 1, 'edição mais nova daqui vence a antiga de lá');
}
{
  const local = base({ days: { d: { v: { a: 1 }, updatedAt: T } } });
  const remote = base({ days: { d: { v: { a: 9 }, updatedAt: T + 100 } } });
  const { doc } = mergeDocs(local, remote, T + 200);
  ok(doc.days.d.v.a === 9, 'edição mais nova de lá vence a antiga daqui');
}
{
  const local = base({ days: { d: { v: {}, note: '', closed: false, updatedAt: T + 100 } } });
  const remote = base({ days: { d: { v: { a: true }, updatedAt: T } } });
  const { doc } = mergeDocs(local, remote, T + 200);
  ok(Object.keys(doc.days.d.v).length === 0, 'desmarcar aqui não é desfeito pelo repositório');
}

console.log('tarefas e categorias');
{
  const local = base({ todos: [{ id: 't1', text: 'a', deletedAt: T + 100, updatedAt: T + 100 }] });
  const remote = base({ todos: [{ id: 't1', text: 'a', updatedAt: T }] });
  const { doc } = mergeDocs(local, remote, T + 200);
  ok(doc.todos.length === 1 && !!doc.todos[0].deletedAt, 'tarefa apagada aqui continua apagada');
}
{
  const local = base({ todos: [{ id: 't1', text: 'antigo', updatedAt: T }] });
  const remote = base({ todos: [{ id: 't1', text: 'novo', updatedAt: T + 50 }, { id: 't2', text: 'outra', updatedAt: T }] });
  const { doc } = mergeDocs(local, remote, T + 100);
  ok(doc.todos.find(t => t.id === 't1').text === 'novo', 'texto editado depois vence');
  ok(doc.todos.length === 2, 'tarefa nova do repositório entra');
}
{
  const local = base({ categories: [{ id: 'c1', label: 'Academia', order: 0, updatedAt: T }] });
  const remote = base({ categories: [{ id: 'c1', label: 'Musculação', order: 0, updatedAt: T + 10 }] });
  const { doc } = mergeDocs(local, remote, T + 20);
  ok(doc.categories[0].label === 'Musculação', 'categoria renomeada no outro aparelho vence');
}
{
  const velha = { id: 'x', deletedAt: T - TOMB_TTL - 1000, updatedAt: T - TOMB_TTL - 1000 };
  const out = mergeById([velha], [], T);
  ok(out.length === 0, 'lápide velha é varrida');
}

console.log('configuração e casos de borda');
{
  const local = base();
  const remote = base({ settings: { palette: 'acido', updatedAt: T + 500, sync: { token: 'REMOTO' } } });
  const { doc } = mergeDocs(local, remote, T + 600);
  ok(doc.settings.palette === 'acido', 'preferência mais nova vem do repositório');
  ok(doc.settings.sync.token === 'local', 'o token de sincronia nunca vem do arquivo');
}
{
  const local = base({ days: { d: { v: { a: 1 }, updatedAt: T } } });
  const { doc, changed } = mergeDocs(local, { empty: true }, T);
  ok(changed === false && Object.keys(doc.days).length === 1, 'arquivo vazio no repositório não apaga nada');
}
{
  const local = base();
  const remote = base({ days: { a: {}, b: {} }, todos: [{ id: 'n', updatedAt: T }] });
  const d = diffSummary(local, remote);
  ok(d.days === 2 && d.todos === 1, 'resumo da diferença conta o que viria de lá');
}
{
  const local = base({ rev: 4 }); const remote = base({ rev: 9 });
  const { doc } = mergeDocs(local, remote, T);
  ok(doc.rev === 10, 'a revisão sempre avança');
}
{
  ok(Object.keys(mergeDays({ a: { updatedAt: 1 } }, {})).length === 1, 'juntar com nada é inofensivo');
}

console.log('conquistas');
{
  const local = base({ badges: { a: T + 100 } });
  const remote = base({ badges: { a: T, b: T + 5 } });
  const { doc } = mergeDocs(local, remote, T + 200);
  ok(doc.badges.a === T, 'fica a data mais antiga da conquista');
  ok(doc.badges.b === T + 5, 'conquista do outro aparelho entra');
}

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
