import { el, addDays, humanDay, todayKey } from '../js/utils.js';
import { CLIENT_KEY, DEFAULT_CLIENT_ID, loadIdentity, requestGoogleGrant } from '../js/google-tasks.js';
import * as biometria from '../js/biometria.js';
import * as vault from '../js/vault.js';
import { TASK_EXPORT, openTransfer } from '../js/companion-transfer.js';
import { loadBoards, createTask, changeTask, taskFields, dateOf, highPriority, migrationPlan, importCaderno } from './backend.js';

const FACE_KEY = 'caderno.tarefas.face.v1';
const SNAPSHOT = 'caderno.tarefas.copia.v1';
const app = document.querySelector('#app');
const FILTERS = [['today', 'Hoje'], ['week', 'Semana'], ['open', 'Abertas'], ['done', 'Concluídas']];
const SYNC_LABEL = 'Sincronizar com Google';
let grant, faceSecret, syncedAt, syncing;
let boards = [], area = '', filter = 'today', epoch = 0, revision = 0;
let snapshotWrite = Promise.resolve();

function currentSession() {
  const active = epoch;
  const authorized = grant;
  return {
    active: () => epoch === active && grant === authorized,
    request: operation => usingGrant(authorized, operation),
  };
}

async function usingGrant(authorized, operation) {
  if (authorized?.expires > Date.now() + 15000) {
    try { return await operation(authorized.token); }
    catch (error) {
      if (error.message !== 'Autorize o Google Tasks novamente.') throw error;
    }
  }
  if (grant === authorized) {
    grant = null;
    if (document.querySelector('#taskOverview')) showTasks('Toque em Sincronizar com Google para continuar.');
    await rememberTasks();
  }
  throw new Error('Volte à lista e toque em Sincronizar com Google para continuar.');
}

function resetSession() {
  epoch++;
  grant = faceSecret = syncedAt = syncing = null;
  boards = [];
  area = '';
}

function render(...content) {
  document.body.classList.remove('entry');
  app.replaceChildren(el('h1', { text: 'Tarefas' }), ...content);
}

function hasSession() {
  return grant?.expires > Date.now() + 15000;
}

function lock(message = '') {
  resetSession();
  const status = el('p.status', { role: 'status', text: message });
  if (!localStorage.getItem(SNAPSHOT)) {
    render(el('div.panel.stack', {}, [setupFace(status), status]));
    document.body.classList.add('entry');
    return;
  }
  const face = el('button.primary', { type: 'button', text: 'Entrar com Face ID', onclick: async () => {
    face.disabled = true;
    try {
      const secret = await biometria.entrar(FACE_KEY);
      const snapshot = await vault.open(JSON.parse(localStorage.getItem(SNAPSHOT)), secret);
      if (!face.isConnected) return;
      faceSecret = secret;
      boards = snapshot.boards;
      syncedAt = snapshot.syncedAt;
      grant = snapshot.grant;
      showTasks();
      loadIdentity().catch(() => {});
      if (hasSession()) refreshOverview();
    } catch { setError(status, new Error('Não consegui abrir com Face ID. Tente novamente.')); }
    finally { face.disabled = false; }
  } });
  render(el('div.panel.stack', {}, [face, status]));
  document.body.classList.add('entry');
}

function rememberTasks() {
  if (!faceSecret) return Promise.resolve(false);
  const secret = faceSecret;
  const active = epoch;
  const snapshot = { boards, syncedAt, grant: hasSession() ? grant : null };
  const write = snapshotWrite.then(async () => {
    if (epoch !== active) return false;
    const sealed = await vault.sealWithPassword(secret, snapshot);
    if (epoch !== active) return false;
    localStorage.setItem(SNAPSHOT, JSON.stringify(sealed));
    return true;
  }).catch(() => false);
  snapshotWrite = write;
  return write;
}

function setupFace(status) {
  let pending;
  const button = el('button', { type: 'button', text: 'Ativar Face ID', onclick: async () => {
    button.disabled = true;
    try {
      const credential = pending ? await biometria.completarCredencial(pending) : await biometria.criarCredencial('Tarefas');
      if (!button.isConnected) return;
      if (credential.precisaSegundoToque) {
        pending = credential;
        button.textContent = 'Confirmar Face ID';
        return;
      }
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      const sealed = await vault.sealWithPassword(secret, { boards, syncedAt, grant: hasSession() ? grant : null });
      if (!button.isConnected) return;
      await biometria.guardar(secret, credential, FACE_KEY);
      localStorage.setItem(SNAPSHOT, JSON.stringify(sealed));
      faceSecret = secret;
      showTasks('Face ID ativado.');
      loadIdentity().catch(() => {});
    } catch { setError(status, new Error('Não consegui ativar o Face ID neste navegador.')); }
    finally { button.disabled = false; }
  } });
  return button;
}

function setError(status, error) {
  status.classList.add('error');
  status.textContent = error.message;
}

async function updateBoards(authorized = grant) {
  const active = epoch;
  const started = ++revision;
  const data = await usingGrant(authorized, loadBoards);
  if (epoch !== active || revision !== started) return false;
  grant = authorized;
  boards = data;
  syncedAt = Date.now();
  if (!boards.some(board => board.id === area)) area = '';
  await rememberTasks();
  return epoch === active && revision === started;
}

async function refreshOverview(message = '') {
  const view = document.querySelector('#taskOverview');
  try {
    if (await updateBoards() && view?.isConnected) showTasks(message);
  } catch (error) {
    const status = view?.querySelector('.status');
    if (status?.isConnected) setError(status, error);
  }
}

async function saveTask(listId, task) {
  revision++;
  boards = boards.map(board => board.id !== listId ? board : {
    ...board, tasks: board.tasks.some(item => item.id === task.id)
      ? board.tasks.map(item => item.id === task.id ? task : item)
      : [...board.tasks, task],
  });
  await rememberTasks();
}

function visibleTasks() {
  const today = todayKey();
  const until = addDays(today, 6);
  return boards.filter(board => !area || board.id === area).flatMap(board => board.tasks
    .filter(task => {
      if (task.deleted) return false;
      if (task.status === 'completed') return filter === 'done';
      if (filter === 'done') return false;
      const date = dateOf(task);
      if (filter === 'today') return date && date <= today;
      if (filter === 'week') return date && date <= until;
      return true;
    }).map(task => ({ task, board })))
    .sort((a, b) => (dateOf(a.task) || '9999').localeCompare(dateOf(b.task) || '9999')
      || Number(highPriority(b.task)) - Number(highPriority(a.task)) || a.task.title.localeCompare(b.task.title));
}

async function syncGoogle(status) {
  if (syncing) return;
  const active = epoch;
  syncing = true;
  try {
    let authorized = grant;
    if (!hasSession()) {
      if (!globalThis.google?.accounts?.oauth2) {
        status.textContent = 'Carregando a conexão do Google…';
        await loadIdentity();
        if (active === epoch && status.isConnected) status.textContent = 'Toque novamente em Sincronizar com Google.';
        return;
      }
      status.textContent = 'Aguardando o Google…';
      authorized = await requestGoogleGrant(localStorage.getItem(CLIENT_KEY) || DEFAULT_CLIENT_ID);
    }
    if (epoch !== active) return;
    status.textContent = 'Buscando suas tarefas…';
    if (await updateBoards(authorized) && document.querySelector('#taskOverview')) showTasks('Tarefas sincronizadas.');
  } catch (error) {
    if (epoch === active && status.isConnected) setError(status, error);
  } finally {
    if (epoch === active) syncing = false;
  }
}

function showTasks(message = '') {
  if (!faceSecret) { lock(); return; }
  const connected = hasSession();
  const status = el('p.status', { role: 'status', text: message });
  const tasks = visibleTasks();
  const refresh = el(connected ? 'button' : 'button.primary', {
    type: 'button', text: SYNC_LABEL, onclick: async () => {
      refresh.disabled = true;
      status.classList.remove('error');
      try { await syncGoogle(status); }
      finally { refresh.disabled = false; }
    },
  });
  const picker = el('select', { onchange: event => { area = event.currentTarget.value; showTasks(); } }, [
    el('option', { value: '', text: 'Todas as listas' }),
    ...boards.map(board => el('option', { value: board.id, selected: area === board.id, text: board.title })),
  ]);
  render(el('div.stack', { id: 'taskOverview' }, [
    !connected && syncedAt ? el('p.muted', { text: 'Última sincronização: ' + new Date(syncedAt).toLocaleString('pt-BR') }) : null,
    el('div.actions', {}, [
      refresh,
      connected && boards.length ? el('button.primary', { type: 'button', text: '+ Nova tarefa', onclick: () => editTask() }) : null,
    ]),
    status,
    el('label', {}, ['Lista', picker]),
    el('section.panel', {}, [
      el('div.tabs', { role: 'group', 'aria-label': 'Filtro de tarefas' }, FILTERS.map(([id, text]) => el('button', {
        type: 'button', text, 'aria-pressed': String(filter === id), onclick: () => { filter = id; showTasks(); },
      }))),
      tasks.length ? el('ul.tasks-list', {}, tasks.map(({ task, board }) => taskRow(task, board, status)))
        : el('p.muted', { text: !boards.length && !connected ? 'Sincronize com o Google para carregar suas listas.'
          : filter === 'today' ? 'Nada com prazo para hoje. Veja Abertas para incluir tarefas sem prazo.' : 'Nenhuma tarefa neste recorte.' }),
    ]),
    el('div.actions', {}, [
      el('button', { type: 'button', text: 'Importar do Caderno', disabled: !connected, onclick: showImport }),
      el('button', { type: 'button', text: 'Trancar', onclick: () => lock() }),
    ]),
  ]));
}

function taskRow(task, board, status) {
  const due = dateOf(task);
  const completed = task.status === 'completed';
  const action = el('button', { type: 'button', text: completed ? 'Reabrir' : 'Concluir', disabled: !hasSession(), onclick: async () => {
    action.disabled = true;
    try {
      const session = currentSession();
      const saved = await session.request(token => changeTask(token, board.id, task.id, {
        status: completed ? 'needsAction' : 'completed',
      }));
      if (!session.active()) return;
      await saveTask(board.id, saved);
      if (session.active() && action.isConnected) showTasks(completed ? 'Tarefa reaberta.' : 'Tarefa concluída.');
    } catch (error) { setError(status, error); }
    finally { action.disabled = false; }
  } });
  return el('li.row', {}, [
    el('div', {}, [el('p.task-title', { text: task.title }), el('p.meta.muted', {
      text: `${board.title} · ${due ? humanDay(due) : 'Sem prazo'}${!completed && due && due < todayKey() ? ' · Atrasada' : ''}${highPriority(task) ? ' · Prioridade' : ''}`,
    })]),
    el('div.task-buttons', {}, [action, el('button', { type: 'button', text: 'Editar', disabled: !hasSession(), onclick: () => editTask(task, board) })]),
  ]);
}

function editTask(task, board) {
  const title = el('input', { value: task?.title || '', required: true, maxlength: 1024 });
  const due = el('input', { type: 'date', value: task ? dateOf(task) : '' });
  const status = el('p.status', { role: 'status' });
  const submit = el('button.primary', { type: 'submit', text: task ? 'Salvar alterações' : 'Criar tarefa' });
  const listInput = el('select', {}, boards.map(item => el('option', {
    value: item.id, selected: item.id === (board?.id || area), text: item.title,
  })));
  render(el('form.panel.stack', { onsubmit: async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const session = currentSession();
      const listId = task ? board.id : listInput.value;
      const saved = await session.request(token => task
        ? changeTask(token, listId, task.id, taskFields(title.value, due.value))
        : createTask(token, listId, title.value, due.value));
      if (!session.active()) return;
      await saveTask(listId, saved);
      if (session.active() && submit.isConnected) {
        filter = saved.status === 'completed' ? 'done' : 'open';
        showTasks(task ? 'Alterações salvas no Google Tasks.' : 'Tarefa criada no Google Tasks.');
      }
    } catch (error) { setError(status, error); }
    finally { submit.disabled = false; }
  } }, [el('h2', { text: task ? 'Editar tarefa' : 'Nova tarefa' }),
    el('label', {}, ['Título', title]), el('label', {}, ['Prazo', due]),
    task ? null : el('label', {}, ['Lista', listInput]),
    el('div.actions', {}, [submit, el('button', { type: 'button', text: 'Voltar', onclick: () => showTasks() })]), status]));
}

function showImport() {
  const code = el('textarea', { rows: 3, required: true, spellcheck: 'false' });
  const password = el('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const status = el('p.status', { role: 'status' });
  const submit = el('button.primary', { type: 'submit', text: 'Conferir migração' });
  render(el('form.panel.stack', { onsubmit: async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const records = await openTransfer(code.value, password.value, TASK_EXPORT);
      if (!event.target.isConnected || !(await updateBoards())) return;
      password.value = '';
      code.value = '';
      previewImport(records);
    } catch (error) { setError(status, error); }
    finally { submit.disabled = false; }
  } }, [
    el('h2', { text: 'Importar do Caderno' }),
    el('p.muted', { text: 'No Caderno instalado, abra Pessoal → Tarefas → Preparar migração de tarefas e copie o código cifrado.' }),
    el('label', {}, ['Código do Caderno', code]), el('label', {}, ['Senha escolhida ao gerar o código', password]),
    el('div.actions', {}, [submit, el('button', { type: 'button', text: 'Voltar', onclick: () => showTasks() })]), status,
  ]));
}

function previewImport(records) {
  const pending = migrationPlan(records, boards);
  const status = el('p.status', { role: 'status' });
  const apply = el('button.primary', { type: 'button', disabled: !pending.length, text: 'Importar para Google Tasks', onclick: async () => {
    apply.disabled = true;
    status.textContent = 'Migrando tarefas…';
    try {
      const session = currentSession();
      const count = await session.request(token => importCaderno(token, records, session.active));
      if (!session.active() || !apply.isConnected) return;
      filter = 'open';
      showTasks(`${count} tarefas adicionadas. Confira prazos e títulos.`);
      await refreshOverview(`${count} tarefas adicionadas. Confira prazos e títulos.`);
    } catch (error) { setError(status, error); }
    finally { apply.disabled = false; }
  } });
  render(el('section.panel.stack', {}, [
    el('h2', { text: 'Conferir migração' }),
    el('p.muted', { text: `${pending.length} tarefas novas na lista Caderno · ${records.length - pending.length} já vinculadas.` }),
    el('ul.tasks-list', {}, pending.map(item => el('li.row', {}, [el('span', { text: item.title }), el('span.meta.muted', { text: item.due ? humanDay(item.due) : 'Sem prazo' })]))),
    el('div.actions', {}, [apply, el('button', { type: 'button', text: 'Voltar', onclick: () => showTasks() })]), status,
  ]));
}

function refreshOnReturn() {
  if (document.hidden || !faceSecret || syncing || !document.querySelector('#taskOverview')) return;
  if (grant && !hasSession()) showTasks();
  else if (hasSession() && Date.now() - (syncedAt || 0) > 60000) refreshOverview();
}

document.addEventListener('visibilitychange', refreshOnReturn);
window.addEventListener('online', refreshOnReturn);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => {});
lock();
