import { el, addDays, humanDay, todayKey } from '../js/utils.js';
import { CLIENT_KEY, DEFAULT_CLIENT_ID, loadIdentity, requestGoogleGrant } from '../js/google-tasks.js';
import { automaticSync, startPairing, readSession } from './google-session.js';
import * as biometria from '../js/biometria.js';
import * as vault from '../js/vault.js';
import { TASK_EXPORT, openTransfer } from '../js/companion-transfer.js';
import { loadBoards, createTask, changeTask, taskFields, dateOf, highPriority, migrationPlan, importCaderno } from './backend.js';

const FACE_KEY = 'caderno.tarefas.face.v1';
const SNAPSHOT = 'caderno.tarefas.copia.v1';
const app = document.querySelector('#app');
const FILTERS = [['today', 'Hoje'], ['week', 'Semana'], ['open', 'Abertas'], ['done', 'Concluídas']];
let grant, faceSecret, syncedAt, connection, pairing, renewing, checking;
let boards = [], area = '', filter = 'today', epoch = 0, revision = 0;
let snapshotWrite = Promise.resolve();

const canSync = () => !!connection || hasSession();

function currentSession() {
  const active = epoch;
  return {
    active: () => epoch === active,
    token: rejected => accessToken(active, rejected),
  };
}

async function accessToken(active, rejected) {
  if (epoch !== active) throw new Error('Destranque o Tarefas.');
  if (hasSession() && grant.token !== rejected) return grant.token;
  if (!connection) {
    grant = null;
    throw new Error(automaticSync ? 'Toque em Conectar Google para ativar a sincronização.' : 'Autorize o Google Tasks novamente.');
  }
  const linked = connection;
  if (!renewing) {
    const request = readSession(linked, rejected).then(session => {
      if (epoch !== active || connection !== linked) throw new Error('Destranque o Tarefas.');
      if (!session) throw new Error('A autorização ainda está pendente.');
      grant = session;
      return session.token;
    }).catch(async error => {
      if (error.revoked && epoch === active && connection === linked) {
        connection = grant = null;
        await rememberTasks();
        if (epoch === active && document.querySelector('#taskOverview')) showTasks(error.message);
      }
      throw error;
    }).finally(() => {
      if (renewing === request) renewing = null;
    });
    renewing = request;
  }
  return renewing;
}

function resetSession() {
  epoch++;
  grant = faceSecret = syncedAt = connection = pairing = renewing = checking = null;
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
  if (!biometria.armada(FACE_KEY) || !localStorage.getItem(SNAPSHOT)) { login(message); return; }
  const status = el('p.status', { role: 'status', text: message });
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
      connection = automaticSync ? snapshot.connection : null;
      pairing = automaticSync ? snapshot.pairing : null;
      showTasks();
      if (!automaticSync) loadIdentity().catch(() => {});
      if (pairing) checkPairing();
      else if (canSync()) refreshOverview();
    } catch { setError(status, new Error('Não consegui abrir com Face ID. Tente novamente.')); }
    finally { face.disabled = false; }
  } });
  render(el('div.panel.stack', {}, [face, status,
    el('details.connection-settings', {}, [el('summary', { text: 'Recuperar acesso' }),
      el('button', { type: 'button', text: 'Entrar com Google temporariamente', onclick: () => login() })])]));
  document.body.classList.add('entry');
}

function rememberTasks() {
  if (!faceSecret) return Promise.resolve(false);
  const secret = faceSecret;
  const active = epoch;
  const snapshot = { boards, syncedAt, grant: !connection && hasSession() ? grant : null, connection, pairing };
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

async function beginPairing() {
  const { active } = currentSession();
  const pending = await startPairing();
  if (!active() || connection || pairing) return;
  pairing = pending;
  if (!(await rememberTasks())) {
    if (active() && pairing === pending) pairing = null;
    throw new Error('Não consegui salvar a conexão no iPhone. Tente novamente.');
  }
  if (active()) showTasks();
}

function checkPairing() {
  if (!pairing || checking) return checking;
  const { active } = currentSession();
  const pending = pairing;
  const run = async () => {
    try {
      if (pending.expires <= Date.now()) {
        const error = new Error('O tempo para autorizar acabou. Toque em Conectar Google para tentar de novo.');
        error.pairingEnded = true;
        throw error;
      }
      const session = await readSession(pending);
      if (!active() || pairing !== pending) return;
      if (!session) return;
      const previous = connection;
      connection = { id: pending.id, secret: pending.secret };
      pairing = null;
      if (!(await rememberTasks())) {
        if (active()) {
          connection = previous;
          pairing = pending;
          showTasks('Não consegui salvar a conexão. Toque em Conferir autorização para tentar de novo.');
        }
        return;
      }
      if (!active()) return;
      grant = session;
      showTasks('Google conectado. Atualizando tarefas…');
      await refreshOverview('Sincronização automática ativada.');
    } catch (error) {
      if (!active() || pairing !== pending) return;
      if (error.pairingEnded) {
        pairing = null;
        await rememberTasks();
      }
      if (active()) showTasks(error.message);
    }
  };
  const request = run().finally(() => { if (checking === request) checking = null; });
  checking = request;
  return request;
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
    } catch { setError(status, new Error('Não consegui ativar o Face ID neste navegador.')); }
    finally { button.disabled = false; }
  } });
  return button;
}

function login(message = '') {
  resetSession();
  if (automaticSync && !biometria.armada(FACE_KEY)) {
    const status = el('p.status', { role: 'status', text: message });
    render(el('div.panel.stack', {}, [
      el('p', { text: 'Ative o Face ID para conectar sua conta Google.' }),
      setupFace(status), status,
    ]));
    document.body.classList.add('entry');
    return;
  }
  const client = el('input', { type: 'text', value: localStorage.getItem(CLIENT_KEY) || DEFAULT_CLIENT_ID, autocomplete: 'off' });
  const status = el('p.status', { role: 'status', text: message });
  const submit = el('button.primary', { type: 'submit', text: 'Entrar com Google', disabled: true });
  const form = el('form.panel.stack', { onsubmit: async event => {
    event.preventDefault();
    const clientId = client.value.trim() || DEFAULT_CLIENT_ID;
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
      status.textContent = 'Cole o ID de cliente OAuth do tipo Aplicativo da Web.';
      return;
    }
    submit.disabled = true;
    status.textContent = 'Aguardando autorização…';
    try {
      const authorized = await requestGoogleGrant(clientId);
      const loaded = await loadBoards(authorized.token);
      if (!form.isConnected) return;
      localStorage.setItem(CLIENT_KEY, clientId);
      grant = authorized;
      boards = loaded;
      syncedAt = Date.now();
      if (faceSecret) await rememberTasks();
      showTasks();
    } catch (error) { setError(status, error); }
    finally { submit.disabled = false; }
  } }, [
    el('p.muted', { text: 'Entre com a conta onde estão suas listas do Google Tasks.' }),
    submit,
    status,
    el('details.connection-settings', {}, [el('summary', { text: 'Configuração da conexão' }), el('label', {}, ['ID de cliente OAuth', client])]),
  ]);
  render(form);
  document.body.classList.add('entry');
  loadIdentity().then(() => { submit.disabled = false; }).catch(error => setError(status, error));
}

function setError(status, error) {
  status.classList.add('error');
  status.textContent = error.message;
}

async function updateBoards() {
  const session = currentSession();
  const started = ++revision;
  let data;
  try { data = await loadBoards(session.token); }
  catch (error) {
    if (session.active() && !connection && error.message === 'Autorize o Google Tasks novamente.') {
      grant = null;
      await rememberTasks();
      if (session.active() && faceSecret && document.querySelector('#taskOverview')) showTasks(error.message);
    }
    throw error;
  }
  if (!session.active() || revision !== started) return false;
  boards = data;
  syncedAt = Date.now();
  if (!boards.some(board => board.id === area)) area = '';
  await rememberTasks();
  return session.active() && revision === started;
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

function showTasks(message = '') {
  if (!canSync() && !faceSecret) { lock('Conecte sua conta para consultar suas tarefas.'); return; }
  const connected = canSync();
  const status = el('p.status', { role: 'status', text: message });
  const tasks = visibleTasks();
  const refresh = el('button', { type: 'button', text: connected || automaticSync ? 'Atualizar' : 'Sincronizar Google', onclick: async () => {
    refresh.disabled = true;
    try {
      if (!canSync() && automaticSync && faceSecret) { showTasks(); return; }
      if (!canSync()) {
        if (!globalThis.google?.accounts?.oauth2) { login(); return; }
        const secret = faceSecret;
        const refreshed = await requestGoogleGrant(localStorage.getItem(CLIENT_KEY) || DEFAULT_CLIENT_ID);
        if (faceSecret !== secret || !refresh.isConnected) return;
        grant = refreshed;
      }
      if (await updateBoards()) showTasks('Tarefas conferidas.');
    }
    catch (error) { setError(status, error); }
    finally { refresh.disabled = false; }
  } });
  let connectionControl;
  if (automaticSync && faceSecret && pairing) {
    const verify = el('button', { type: 'button', text: 'Conferir autorização', onclick: async () => {
      verify.disabled = true;
      try {
        await checkPairing();
        if (verify.isConnected && !status.textContent) status.textContent = 'Abra Autorizar no Google e permita o acesso.';
      } finally { verify.disabled = false; }
    } });
    connectionControl = el('div.panel.stack', {}, [
      el('p', { text: 'Para ativar a sincronização automática, autorize o Google e volte pelo ícone Tarefas.' }),
      el('a', { href: pairing.authorize, target: '_blank', rel: 'noopener noreferrer', text: 'Autorizar no Google' }),
      verify,
    ]);
  } else if (automaticSync && faceSecret && !connection) {
    const connect = el('button.primary', { type: 'button', text: 'Conectar Google', onclick: async () => {
      connect.disabled = true;
      try { await beginPairing(); } catch (error) { setError(status, error); }
      finally { connect.disabled = false; }
    } });
    connectionControl = el('div.actions', {}, [connect]);
  }
  const picker = el('select', { onchange: event => { area = event.currentTarget.value; showTasks(); } }, [
    el('option', { value: '', text: 'Todas as listas' }),
    ...boards.map(board => el('option', { value: board.id, selected: area === board.id, text: board.title })),
  ]);
  render(el('div.stack', { id: 'taskOverview' }, [
    !connected ? el('p.muted', { text: syncedAt ? 'Última sincronização: ' + new Date(syncedAt).toLocaleString('pt-BR') + '. Conecte ao Google para editar.' : 'Conecte ao Google para editar.' }) : null,
    connectionControl,
    el('div.actions', {}, [
      el('button.primary', { type: 'button', text: '+ Nova tarefa', disabled: !boards.length || !connected, onclick: () => editTask() }),
      connected || !automaticSync ? refresh : null,
    ]),
    el('label', {}, ['Lista', picker]),
    el('section.panel', {}, [
      el('div.tabs', { role: 'group', 'aria-label': 'Filtro de tarefas' }, FILTERS.map(([id, text]) => el('button', {
        type: 'button', text, 'aria-pressed': String(filter === id), onclick: () => { filter = id; showTasks(); },
      }))),
      tasks.length ? el('ul.tasks-list', {}, tasks.map(({ task, board }) => taskRow(task, board, status)))
        : el('p.muted', { text: filter === 'today' ? 'Nada com prazo para hoje. Veja Abertas para incluir tarefas sem prazo.' : 'Nenhuma tarefa neste recorte.' }),
    ]),
    el('div.actions', {}, [
      el('button', { type: 'button', text: 'Importar do Caderno', disabled: !connected, onclick: showImport }),
      !faceSecret ? setupFace(status) : null,
      el('button', { type: 'button', text: 'Trancar', onclick: () => lock() }),
    ]),
    status,
  ]));
}

function taskRow(task, board, status) {
  const due = dateOf(task);
  const completed = task.status === 'completed';
  const action = el('button', { type: 'button', text: completed ? 'Reabrir' : 'Concluir', disabled: !canSync(), onclick: async () => {
    action.disabled = true;
    try {
      const session = currentSession();
      const saved = await changeTask(session.token, board.id, task.id, { status: completed ? 'needsAction' : 'completed' });
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
    el('div.task-buttons', {}, [action, el('button', { type: 'button', text: 'Editar', disabled: !canSync(), onclick: () => editTask(task, board) })]),
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
      const saved = task
        ? await changeTask(session.token, listId, task.id, taskFields(title.value, due.value))
        : await createTask(session.token, listId, title.value, due.value);
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
      const count = await importCaderno(session.token, records, session.active);
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
  if (document.hidden || !faceSecret || !document.querySelector('#taskOverview')) return;
  if (pairing) checkPairing();
  else if (connection && Date.now() - (syncedAt || 0) > 60000) refreshOverview();
}

document.addEventListener('visibilitychange', refreshOnReturn);
window.addEventListener('online', refreshOnReturn);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => {});
lock();
