import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { syncTasks } from '../js/google-tasks.js';
import { mergeDocs } from '../js/merge.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
};
await store.createVault('senha-ficticia');
const date = store.todayKey();
const receivable = store.addAgenda({ tipo: 'renda', label: 'Projeto', repete: 'unico', data: date, valor: 1250 });
const bill = store.addAgenda({ tipo: 'conta', label: 'Conta', valor: 100 });
const finances = { date, balance: 400025, invested: 100010, receivables: [
  { id: receivable.id, previous: 'Projeto', title: 'Projeto atual', due: date, value: 1250 },
] };
assert.throws(() => store.applyWalletImport({ ...finances, receivables: [{ ...finances.receivables[0], value: 999 }] }), /mudou/);
assert.equal(store.state.wallet, null);
store.applyWalletImport(finances);
const saved = store.state.wallet;
assert.equal(saved.balance + saved.invested, 500035);
assert.equal(store.agendaById(receivable.id).label, 'Projeto atual');
assert.equal(store.agendaById(bill.id).label, 'Conta');
store.applyWalletImport(finances);
assert.equal(store.state.wallet, saved);
const remoteWallet = { ...saved, balance: 420000, updatedAt: saved.updatedAt + 20 };
const localDoc = store.syncDoc();
const merge = mergeDocs(localDoc, { ...localDoc, wallet: remoteWallet });
assert.equal(merge.changed, true);
assert.deepEqual(merge.doc.wallet, remoteWallet);

const dated = store.addTodo('Tarefa com prazo', { due: date });
store.addTodo('Sem prazo');
store.addTodo('Concluída', { due: date, done: true });
const googleLists = [];
const googleItems = [];
let writes = 0;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  if (path.endsWith('/users/@me/lists')) {
    if (options.method === 'GET') return Response.json({ items: googleLists });
    googleLists.push({ id: 'lista-teste', title: body.title });
    return Response.json(googleLists[0]);
  }
  if (options.method === 'GET') return Response.json({ items: googleItems });
  writes++;
  if (options.method === 'POST') {
    googleItems.push({ ...body, id: 'id-remote', updated: new Date().toISOString() });
    return Response.json(googleItems.at(-1));
  }
  assert.equal(path.endsWith('/id-remote'), true);
  Object.assign(googleItems[0], body);
  return Response.json(googleItems[0]);
};

assert.deepEqual(await syncTasks('teste'), { sent: 1, received: 0 });
assert.equal(googleLists[0].title, 'Caderno');
assert.equal(googleItems[0].due.slice(0, 10), date);
assert.deepEqual(await syncTasks('teste'), { sent: 0, received: 0 });
assert.equal(writes, 1);
Object.assign(googleItems[0], { status: 'completed', updated: new Date(Date.now() + 50).toISOString() });
assert.deepEqual(await syncTasks('teste'), { sent: 0, received: 1 });
assert.equal(dated.done, true);
store.updateTodo(dated.id, { text: 'Título atualizado', updatedAt: Date.now() });
googleItems[0].updated = new Date(dated.updatedAt - 1).toISOString();
assert.deepEqual(await syncTasks('teste'), { sent: 1, received: 0 });
assert.equal(googleItems[0].title, 'Título atualizado');
store.lockVault();
assert.deepEqual(await syncTasks('teste'), { sent: 0, received: 0 });
console.log('Carteira e Google Tasks passaram: atualização sem duplicatas e sincronização de título, prazo e conclusão.');
