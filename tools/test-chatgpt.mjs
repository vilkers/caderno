import assert from 'node:assert/strict';
import * as chatGPT from '../js/chatgpt.js';
import * as store from '../js/store.js';
import * as vault from '../js/vault.js';
import { addDays, todayKey } from '../js/utils.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
};
Object.defineProperty(globalThis.navigator, 'onLine', { value: true });

const today = todayKey();
const settings = { owner: 'teste', repo: 'privado', from: today, token: 'token-de-teste' };
await store.createVault('senha-de-teste');
store.setSync({ token: 'token-da-sincronia' });
store.setChatGPT(settings);
const { id: sleep } = store.activeCategories().find(cat => cat.label === 'Sono');
const { id: gym } = store.activeCategories().find(cat => cat.label === 'Academia');
const { id: drink } = store.activeCategories().find(cat => cat.label === 'Bebida');
store.setVal(addDays(today, -1), sleep, 6);
store.setNote(today, 'anotação pessoal');
store.addTodo('tarefa pessoal');

let isPrivate = false;
let remote = null;
let sha = 0;
let collision = null;
const request = (id, category, value, previous = null) => ({
  id, date: today, changes: [{ category, value, previous }],
});
const queue = item => { remote.requests.push(item); sha++; };

globalThis.fetch = async (url, options) => {
  if (!url.includes('/contents/')) {
    return Response.json({ private: isPrivate, visibility: isPrivate ? 'private' : 'public', default_branch: 'main' });
  }
  if (options.method === 'GET') {
    if (!remote) return new Response(null, { status: 404 });
    return Response.json({ sha: String(sha), encoding: 'base64', content: Buffer.from(JSON.stringify(remote)).toString('base64') });
  }
  if (collision) { queue(collision); collision = null; }
  const body = JSON.parse(options.body);
  if (remote && body.sha !== String(sha)) return new Response(null, { status: 409 });
  remote = JSON.parse(Buffer.from(body.content, 'base64'));
  sha++;
  return Response.json({});
};

await assert.rejects(chatGPT.sync(), /privado/);
assert.equal(remote, null);
isPrivate = true;
await chatGPT.sync();
assert.deepEqual(remote.days, {});
assert.ok(remote.categories.some(cat => cat.id === sleep));
const previousSha = sha;
await chatGPT.sync();
assert.equal(sha, previousSha);

queue(request('primeiro', sleep, 7.5));
collision = request('segundo', gym, true);
assert.deepEqual(await chatGPT.sync(), { applied: 2 });
assert.deepEqual(remote.requests, []);
assert.deepEqual(remote.days[today].values, { [sleep]: 7.5, [gym]: true });
assert.deepEqual(remote.results.map(item => item.status), ['applied', 'applied']);

const conflict = request('conflito', sleep, 8, 6);
conflict.changes.unshift({ category: drink, value: 0, previous: null });
queue(conflict);
queue(request('incorreto', sleep, 7.3, 7.5));
await chatGPT.sync();
assert.deepEqual(remote.results.slice(-2).map(item => item.status), ['conflict', 'conflict']);
assert.equal(store.getVal(today, sleep), 7.5);
assert.equal(store.getVal(today, drink), undefined);

queue(request('zero', drink, 0));
await chatGPT.sync();
const saved = await vault.unlock('senha-de-teste');
assert.equal(saved.data.days[today].v[drink], 0);
assert.equal(saved.data.days[today].note, 'anotação pessoal');

const exported = JSON.parse(store.exportJSON());
assert.equal(exported.settings.sync, undefined);
assert.equal(exported.settings.chatGPT, undefined);
assert.equal(exported.days[today].v[drink], 0);
assert.doesNotMatch(JSON.stringify(remote), /token-de-teste|token-da-sincronia|anotação pessoal|tarefa pessoal/);
store.importJSON(JSON.stringify(exported));
assert.equal(store.state.settings.sync.token, 'token-da-sincronia');
assert.equal(chatGPT.config().token, 'token-de-teste');
await store.flush();

console.log('Check-in aprovado: privacidade, concorrência, conflitos, cofre e JSON sem credenciais.');
