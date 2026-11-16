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
let grant, faceSecret, syncedAt, boards = [], area = '', filter = 'today';

function render(...content) {
  document.body.classList.remove('entry');
  app.replaceChildren(el('h1', { text: 'Tarefas' }), ...content);
}

function hasSession() {
  return grant?.expires > Date.now() + 15000;
}

function lock(message = '') {
  grant = faceSecret = syncedAt = null;
  boards = [];
  area = '';
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
      showTasks();
      loadIdentity().catch(() => {});
      if (hasSession()) updateBoards().then(updated => {
        if (updated && document.querySelector('#taskOverview')) showTasks();
      }).catch(() => {});
    } catch { setError(status, new Error('Não consegui abrir com Face ID. Tente novamente.')); }
    finally { face.disabled = false; }
  } });
  render(el('div.panel.stack', {}, [face, status,
    el('details.connection-settings', {}, [el('summary', { text: 'Recuperar acesso' }),
      el('button', { type: 'button', text: 'Conectar conta Google', onclick: () => login() })])]));
  document.body.classList.add('entry');
}

async function rememberTasks() {
  if (!faceSecret) return;
  const secret = faceSecret;
  const timestamp = syncedAt;
  try {
    const sealed = await vault.sealWithPassword(secret, { boards, syncedAt: timestamp, grant: hasSession() ? grant : null });
    if (faceSecret === secret && syncedAt === timestamp) localStorage.setItem(SNAPSHOT, JSON.stringify(sealed));
  } catch { /* A cópia anterior continua disponível se o armazenamento falhar. */ }
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
  grant = null;
  boards = [];
  area = '';
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
  if (!hasSession()) throw new Error('Autorize o Google Tasks novamente.');
  const session = grant;
  let data;
  try { data = await loadBoards(session.token); }
  catch (error) {
    if (grant === session && error.message === 'Autorize o Google Tasks novamente.') {
      grant = null;
      await rememberTasks();
      if (faceSecret) showTasks();
    }
    throw error;
  }
  if (grant !== session) return false;
  boards = data;
  syncedAt = Date.now();
  await rememberTasks();
  if (grant !== session) return false;
  if (!boards.some(board => board.id === area)) area = '';
  return true;
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
  if (!hasSession() && !faceSecret) { lock('Conecte sua conta para consultar suas tarefas.'); return; }
  const connected = hasSession();
  const status = el('p.status', { role: 'status', text: message });
  const tasks = visibleTasks();
  const refresh = el('button', { type: 'button', text: connected ? 'Atualizar' : 'Sincronizar Google', onclick: async () => {
    refresh.disabled = true;
    try {
      if (!hasSession()) {
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
  const picker = el('select', { onchange: event => { area = event.currentTarget.value; showTasks(); } }, [
    el('option', { value: '', text: 'Todas as listas' }),
    ...boards.map(board => el('option', { value: board.id, selected: area === board.id, text: board.title })),
  ]);
  render(el('div.stack', { id: 'taskOverview' }, [
    !connected ? el('p.muted', { text: syncedAt ? 'Última sincronização: ' + new Date(syncedAt).toLocaleString('pt-BR') + '. Sincronize para editar.' : 'Sincronize para editar.' }) : null,
    el('div.actions', {}, [
      el('button.primary', { type: 'button', text: '+ Nova tarefa', disabled: !boards.length || !connected, onclick: () => editTask() }),
      refresh,
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
  const action = el('button', { type: 'button', text: completed ? 'Reabrir' : 'Concluir', disabled: !hasSession(), onclick: async () => {
    action.disabled = true;
    try {
      if (!hasSession()) throw new Error('Autorize o Google Tasks novamente.');
      await changeTask(grant.token, board.id, task.id, { status: completed ? 'needsAction' : 'completed' });
      if (await updateBoards()) showTasks(completed ? 'Tarefa reaberta.' : 'Tarefa concluída.');
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
      if (!hasSession()) throw new Error('Autorize o Google Tasks novamente.');
      if (task) await changeTask(grant.token, board.id, task.id, taskFields(title.value, due.value));
      else await createTask(grant.token, listInput.value, title.value, due.value);
      filter = task?.status === 'completed' ? 'done' : 'open';
      if (await updateBoards()) showTasks(task ? 'Alterações salvas no Google Tasks.' : 'Tarefa criada no Google Tasks.');
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
      if (!hasSession()) throw new Error('Autorize o Google Tasks novamente.');
      const count = await importCaderno(grant.token, records);
      filter = 'open';
      if (await updateBoards()) showTasks(`${count} tarefas adicionadas. Confira prazos e títulos.`);
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => {});
lock();
