import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import * as vault from '../js/vault.js';
import { FINANCE_ACCESS, TASK_EXPORT, makeTransfer, openTransfer } from '../js/companion-transfer.js';
import { readWalletForConnection } from '../js/chatgpt.js';
import { changeTask, importCaderno, loadBoards, migrationPlan } from '../tarefas/backend.js';

const dataStore = new Map();
globalThis.localStorage = { getItem: key => dataStore.get(key) ?? null, setItem: (key, value) => dataStore.set(key, value) };
const password = 'senha-ficticia';
await store.createVault(password);
const today = store.todayKey();
const config = { owner: 'teste', repo: 'privado', token: 'token-ficticio', from: today };
const transferPassword = 'senha-nova-financeiro';
const originalVault = vault.exportEncrypted();
const code = await makeTransfer(store.getSession(), FINANCE_ACCESS, config, transferPassword);
const oldCode = JSON.stringify(await vault.seal(store.getSession(), { type: FINANCE_ACCESS, data: config }));
assert.doesNotMatch(code, /token-ficticio|privado/);
assert.equal(vault.exportEncrypted(), originalVault);
await assert.rejects(openTransfer(code, 'senha-errada', FINANCE_ACCESS), /senha/);
await assert.rejects(openTransfer(code, password, FINANCE_ACCESS), /senha/);
await assert.rejects(openTransfer(code, transferPassword, TASK_EXPORT), /este app/);
store.lockVault();
assert.deepEqual(await openTransfer(code, transferPassword, FINANCE_ACCESS), config);
assert.deepEqual(await openTransfer(oldCode, password, FINANCE_ACCESS), config);

const ledger = { version: 1, date: today, balance: 100000, invested: 200000,
  balanceEstimated: false, paymentMonth: today.slice(0, 7), receivables: [], payments: [] };
let privateRepo = false;
let walletReads = 0;
const googleBoards = [];
const googleItems = [];
let interrupt = true;
globalThis.fetch = async (url, options) => {
  if (url.startsWith('https://api.github.com/')) {
    assert.equal(options.method, 'GET');
    if (!url.includes('/contents/')) return Response.json({ private: privateRepo, visibility: privateRepo ? 'private' : 'public', default_branch: 'main' });
    walletReads++;
    return Response.json({ sha: 'wallet-sha', encoding: 'base64', content: Buffer.from(JSON.stringify(ledger)).toString('base64') });
  }
  const path = new URL(url).pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  if (path.endsWith('/users/@me/lists')) {
    if (options.method === 'GET') return Response.json({ items: googleBoards });
    googleBoards.push({ id: 'caderno-list', title: body.title });
    return Response.json(googleBoards[0]);
  }
  if (options.method === 'GET') return Response.json({ items: googleItems });
  if (options.method === 'PATCH') {
    const task = googleItems.find(item => path.endsWith('/' + item.id));
    Object.assign(task, body);
    return Response.json(task);
  }
  if (interrupt && googleItems.length === 1) {
    interrupt = false;
    return new Response(null, { status: 503 });
  }
  googleItems.push({ ...body, id: 'google-' + googleItems.length });
  return Response.json(googleItems.at(-1));
};
await assert.rejects(readWalletForConnection(config), /privado/);
assert.equal(walletReads, 0);
privateRepo = true;
assert.deepEqual((await readWalletForConnection(config)).data, ledger);
assert.equal(store.isUnlocked(), false);

const records = [{ id: 'um', text: 'Primeira', due: today }, { id: 'dois', text: 'Segunda', due: null, star: true }];
assert.equal(migrationPlan(records, []).length, 2);
await assert.rejects(importCaderno('google-ficticio', records), /503/);
assert.equal(googleItems.length, 1);
assert.equal(await importCaderno('google-ficticio', records), 1);
assert.equal(await importCaderno('google-ficticio', records), 0);
assert.equal(googleBoards.length, 1);
assert.equal(googleItems[0].due.slice(0, 10), today);
assert.equal(googleItems[1].due, undefined);
assert.match(googleItems[1].notes, /Prioridade/);
await changeTask('google-ficticio', 'caderno-list', googleItems[0].id, { status: 'completed' });
assert.equal((await loadBoards('google-ficticio'))[0].tasks[0].status, 'completed');
console.log('Apps separados OK: acesso cifrado, leitura privada e migração idempotente de tarefas.');
