import { el, addDays, humanDay, todayKey } from '../js/utils.js';
import { CLIENT_KEY, loadIdentity, requestGoogleGrant } from '../js/google-tasks.js';
import { TASK_EXPORT, openTransfer } from '../js/companion-transfer.js';
import { loadBoards, createTask, changeTask, taskFields, dateOf, highPriority, migrationPlan, importCaderno } from './backend.js';

const app = document.querySelector('#app');
const FILTERS = [['today', 'Hoje'], ['week', 'Semana'], ['open', 'Abertas'], ['done', 'Concluídas']];
let grant, boards = [], area = '', filter = 'today';

function render(...content) {
  app.replaceChildren(el('h1', { text: 'Tarefas' }), ...content);
}

function hasSession() {
  return grant?.expires > Date.now() + 15000;
}

function login(message = '') {
  grant = null;
  boards = [];
  area = '';
  const client = el('input', { type: 'text', value: localStorage.getItem(CLIENT_KEY) || '', autocomplete: 'off', required: true });
  const status = el('p.status', { role: 'status', text: message });
  const submit = el('button.primary', { type: 'submit', text: 'Autorizar Google Tasks', disabled: true });
  const form = el('form.panel.stack', { onsubmit: async event => {
    event.preventDefault();
    const clientId = client.value.trim();
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
      showTasks();
    } catch (error) { setError(status, error); }
    finally { submit.disabled = false; }
  } }, [
    el('h2', { text: 'Conectar Google Tasks' }),
    el('p.muted', { text: 'Use o ID de um cliente OAuth de aplicativo web com a Google Tasks API e a origem https://vilkers.github.io.' }),
    el('label', {}, ['ID de cliente OAuth', client]),
    el('div.actions', {}, [submit]),
    status,
  ]);
  render(form);
  loadIdentity().then(() => { submit.disabled = false; }).catch(error => setError(status, error));
}

function setError(status, error) {
  status.classList.add('error');
  status.textContent = error.message;
}

async function updateBoards() {
  if (!hasSession()) throw new Error('Autorize o Google Tasks novamente.');
  const session = grant;
  const data = await loadBoards(session.token);
  if (grant !== session) return false;
  boards = data;
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
  if (!hasSession()) { login('Autorize para consultar suas tarefas.'); return; }
  const status = el('p.status', { role: 'status', text: message });
  const tasks = visibleTasks();
  const refresh = el('button', { type: 'button', text: 'Atualizar', onclick: async () => {
    refresh.disabled = true;
    try { if (await updateBoards()) showTasks('Tarefas conferidas.'); }
    catch (error) { setError(status, error); }
    finally { refresh.disabled = false; }
  } });
  const picker = el('select', { onchange: event => { area = event.currentTarget.value; showTasks(); } }, [
    el('option', { value: '', text: 'Todas as listas' }),
    ...boards.map(board => el('option', { value: board.id, selected: area === board.id, text: board.title })),
  ]);
  render(el('div.stack', {}, [
    el('div.actions', {}, [
      el('button.primary', { type: 'button', text: '+ Nova tarefa', disabled: !boards.length, onclick: () => editTask() }),
      refresh,
    ]),
    el('label', {}, ['Lista', picker]),
    el('section.panel', {}, [
      el('div.tabs', { role: 'group', 'aria-label': 'Filtro de tarefas' }, FILTERS.map(([id, text]) => el('button', {
        type: 'button', text, 'aria-pressed': String(filter === id), onclick: () => { filter = id; showTasks(); },
      }))),
      tasks.length ? el('ul.tasks-list', {}, tasks.map(({ task, board }) => taskRow(task, board, status)))
        : el('p.muted', { text: 'Nenhuma tarefa neste recorte.' }),
    ]),
    el('div.actions', {}, [
      el('button', { type: 'button', text: 'Importar do Caderno', onclick: showImport }),
      el('button', { type: 'button', text: 'Desconectar', onclick: () => login() }),
    ]),
    status,
  ]));
}

function taskRow(task, board, status) {
  const due = dateOf(task);
  const completed = task.status === 'completed';
  const action = el('button', { type: 'button', text: completed ? 'Reabrir' : 'Concluir', onclick: async () => {
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
    el('div.task-buttons', {}, [action, el('button', { type: 'button', text: 'Editar', onclick: () => editTask(task, board) })]),
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

login();
