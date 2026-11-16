import * as store from './store.js';

export const CLIENT_KEY = 'caderno.tarefas.cliente-oauth.v1';
import { debounce } from './utils.js';

const API = 'https://tasks.googleapis.com/tasks/v1';
const SCOPE = 'https://www.googleapis.com/auth/tasks';
const MARKER = 'Caderno ID: ';
let identity, grant, running;

export function loadIdentity() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (!identity) identity = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error('Não consegui carregar o login do Google.')); };
    document.head.append(script);
  }).catch(err => { identity = null; throw err; });
  return identity;
}

export function authorize(clientId) {
  const session = store.getSession();
  return requestGoogleGrant(clientId).then(response => {
    if (!session || store.getSession() !== session) throw new Error('Destranque o Caderno.');
    grant = { ...response, session };
  });
}

export function requestGoogleGrant(clientId) {
  const oauth = globalThis.google?.accounts?.oauth2;
  if (!oauth) return Promise.reject(new Error('Aguarde o login do Google carregar.'));
  return new Promise((resolve, reject) => {
    oauth.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      include_granted_scopes: false,
      callback: response => {
        if (response.error || !response.access_token || !oauth.hasGrantedAllScopes(response, SCOPE)) {
          reject(new Error('Autorize o acesso ao Google Tasks para continuar.'));
          return;
        }
        resolve({ token: response.access_token, expires: Date.now() + Number(response.expires_in) * 1000 });
      },
      error_callback: () => reject(new Error('O login do Google foi fechado ou bloqueado.')),
    }).requestAccessToken({ prompt: 'select_account' });
  });
}

export async function googleRequest(token, path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body && JSON.stringify(body),
  });
  if (res.status === 401) {
    if (grant?.token === token) grant = null;
    throw new Error('Autorize o Google Tasks novamente.');
  }
  if (!res.ok) throw new Error(`Google Tasks respondeu ${res.status}. Confira o acesso e a API do projeto.`);
  return res.json();
}

export async function list(token, path, query = {}) {
  const items = [];
  let pageToken;
  do {
    const params = new URLSearchParams({ ...query, ...(pageToken ? { pageToken } : {}) });
    const page = await googleRequest(token, `${path}?${params}`);
    items.push(...(page.items || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

function fields(task) {
  return {
    title: task.text,
    due: task.due ? `${task.due}T00:00:00.000Z` : null,
    status: task.done ? 'completed' : 'needsAction',
  };
}

function differs(local, remote) {
  return local.title !== remote.title || (local.due || '').slice(0, 10) !== (remote.due || '').slice(0, 10)
    || local.status !== remote.status;
}

export async function syncTasks(token, currentGrant = () => true) {
  const session = store.getSession();
  const stillOpen = () => session && store.getSession() === session && currentGrant();
  const result = { sent: 0, received: 0 };
  if (!stillOpen()) return result;
  const lists = await list(token, '/users/@me/lists');
  const candidates = lists.filter(item => item.title === 'Caderno');
  if (candidates.length > 1) throw new Error('Há duas listas chamadas Caderno no Google Tasks. Deixe um nome Caderno único.');
  if (!stillOpen()) return result;
  const taskList = candidates[0] || await googleRequest(token, '/users/@me/lists', 'POST', { title: 'Caderno' });
  const path = `/lists/${encodeURIComponent(taskList.id)}/tasks`;
  const remoteItems = await list(token, path, { maxResults: '100', showCompleted: 'true', showHidden: 'true' });
  const linked = new Map();
  for (const remote of remoteItems) {
    const firstLine = remote.notes?.split('\n', 1)[0];
    if (remote.deleted || !firstLine?.startsWith(MARKER)) continue;
    const id = firstLine.slice(MARKER.length);
    if (linked.has(id)) throw new Error('Há uma tarefa duplicada na lista Caderno do Google Tasks.');
    linked.set(id, remote);
  }
  for (const task of store.listTodos()) {
    if (!stillOpen()) break;
    const remote = linked.get(task.id);
    const patch = fields(task);
    if (!remote) {
      if (task.done || !task.due) continue;
      await googleRequest(token, path, 'POST', { ...patch, notes: MARKER + task.id });
      result.sent++;
    } else if (differs(patch, remote)) {
      if (Date.parse(remote.updated) > task.updatedAt) {
        store.updateTodo(task.id, { text: remote.title, due: remote.due?.slice(0, 10) || null, done: remote.status === 'completed' });
        result.received++;
      } else {
        await googleRequest(token, `${path}/${encodeURIComponent(remote.id)}`, 'PATCH', patch);
        result.sent++;
      }
    }
  }
  if (result.received && !(await store.flush())) throw new Error('Não consegui guardar as alterações do Google Tasks no cofre.');
  return result;
}

export const authorized = () => Boolean(grant && grant.session === store.getSession() && grant.expires > Date.now() + 15000);
export function disconnect() { grant = null; }

export async function sync() {
  if (!authorized()) return;
  if (!running) {
    const authorizedGrant = grant;
    const run = () => syncTasks(authorizedGrant.token, () => grant === authorizedGrant && authorized());
    running = (navigator.locks ? navigator.locks.request('caderno-google-tasks', run) : run())
      .finally(() => { running = null; });
  }
  return running;
}

export function start(onChange) {
  const refresh = () => {
    if (document.hidden || !navigator.onLine) return;
    sync().then(result => { if (result?.received) onChange(); }).catch(() => {});
  };
  const afterChange = debounce(refresh, 3000);
  store.subscribe(reason => { if (['todos', 'replace'].includes(reason) && !running && authorized()) afterChange(); });
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('online', refresh);
  setInterval(refresh, 60000);
}
