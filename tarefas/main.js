import { el, humanDay, todayKey, addDays } from '../js/utils.js';
import { CLIENT_KEY, DEFAULT_CLIENT_ID, loadIdentity, requestGoogleGrant } from '../js/google-tasks.js';
import * as biometria from '../js/biometria.js';
import * as vault from '../js/vault.js';
import { TASK_EXPORT, openTransfer } from '../js/companion-transfer.js';
import { loadBoards, createTask, changeTask, changeTaskStatus, editorFields, editableNotes, dateOf, highPriority, migrationPlan, importCaderno } from './backend.js';
import { bindCompletionSwipe, taskQueues } from './flow.js';
import { calendarPanel } from './calendar.js';

const FACE_KEY = 'caderno.tarefas.face.v1';
const SNAPSHOT = 'caderno.tarefas.copia.v1';
const app = document.querySelector('#app');
const FILTERS = [['today', 'Hoje'], ['week', 'Semana'], ['open', 'Abertas'], ['done', 'Concluídas']];
const SYNC_LABEL = 'Sincronizar com Google';
let grant, faceSecret, syncedAt, syncing, lastCompletion;
let feedback, feedbackTimer, lastTap, nextCheckAfter = 0;
const pendingTasks = new Set();
let boards = [], area = '', filter = 'today', epoch = 0, revision = 0;
let snapshotWrite = Promise.resolve();
let calendarOpen = false;
const calendarState = { month: todayKey().slice(0, 7), day: todayKey() };

function currentSession() {
  const active = epoch;
  const authorized = grant;
  return {
    current: () => epoch === active,
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
    void rememberTasks();
  }
  throw new Error('Reconecte o Google para continuar.');
}

function resetSession() {
  epoch++;
  grant = faceSecret = syncedAt = syncing = lastCompletion = null;
  boards = [];
  area = '';
  filter = 'today';
  calendarOpen = false;
  calendarState.day = todayKey();
  calendarState.month = calendarState.day.slice(0, 7);
  pendingTasks.clear();
  feedback = null;
  nextCheckAfter = 0;
  lastTap = null;
  clearTimeout(feedbackTimer);
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
  if (pendingTasks.size) return false;
  const active = epoch;
  const started = ++revision;
  const data = await usingGrant(authorized, loadBoards);
  if (epoch !== active || revision !== started) return false;
  grant = authorized;
  boards = data;
  syncedAt = Date.now();
  if (!boards.some(board => board.id === area)) area = '';
  if (lastCompletion && !boards.some(board => board.id === lastCompletion.board.id && board.tasks.some(task =>
    task.id === lastCompletion.task.id && task.status === 'completed' && !task.deleted))) lastCompletion = null;
  void rememberTasks();
  return true;
}

async function refreshOverview(message = '') {
  try {
    if (await updateBoards() && document.querySelector('#taskOverview')) showTasks(message);
  } catch (error) {
    if (document.querySelector('#taskOverview')) {
      if (!hasSession()) showTasks();
      showFeedback(error.message, { error: true });
    }
  }
}

function saveTask(listId, task) {
  revision++;
  boards = boards.map(board => board.id !== listId ? board : {
    ...board, tasks: board.tasks.some(item => item.id === task.id)
      ? board.tasks.map(item => item.id === task.id ? task : item)
      : [...board.tasks, task],
  });
  void rememberTasks();
}

async function syncGoogle(report) {
  if (syncing || pendingTasks.size) return false;
  const active = epoch;
  syncing = true;
  updateWriteControls();
  try {
    let authorized = grant;
    if (!hasSession()) {
      if (!globalThis.google?.accounts?.oauth2) {
        report('Carregando a conexão do Google…');
        await loadIdentity();
        if (active === epoch) report('Toque novamente para conectar ao Google.');
        return false;
      }
      report('Aguardando o Google…');
      authorized = await requestGoogleGrant(localStorage.getItem(CLIENT_KEY) || DEFAULT_CLIENT_ID);
    }
    if (epoch !== active) return false;
    report('Buscando suas tarefas…');
    const updated = await updateBoards(authorized);
    if (epoch !== active) return false;
    return updated;
  } catch (error) {
    if (epoch === active) report(error.message, true);
    return false;
  } finally {
    if (epoch === active) { syncing = false; updateWriteControls(); }
  }
}

function updateWriteControls(root = document) {
  for (const button of root.querySelectorAll('[data-task-write]')) {
    const busy = pendingTasks.has(button.dataset.taskWrite);
    button.disabled = !hasSession();
    button.setAttribute('aria-disabled', String(busy || button.disabled));
    button.setAttribute('aria-busy', String(busy));
    if (button.id === 'taskNextComplete') button.textContent = busy ? 'Salvando…' : 'Concluir';
  }
  const sync = root.querySelector('#taskSync');
  if (sync) {
    sync.setAttribute('aria-disabled', String(Boolean(syncing || pendingTasks.size)));
    sync.setAttribute('aria-busy', String(Boolean(syncing)));
  }
}

function taskKey(task, board) {
  return JSON.stringify([board.id, task.id]);
}

function beginWrite(key) {
  pendingTasks.add(key);
  revision++;
  updateWriteControls();
}

function findByData(root, name, value) {
  return [...root.querySelectorAll(`[data-${name}]`)].find(node => node.getAttribute(`data-${name}`) === value);
}

function overviewPosition() {
  const overview = document.querySelector('#taskOverview');
  if (!overview) return null;
  const focused = document.activeElement;
  const active = overview.contains(focused) ? focused : null;
  const anchors = window.scrollY > 0 ? [...overview.querySelectorAll('[data-task-row], #taskListTitle, .task-calendar-header')]
    .map(node => ({ row: node.dataset.taskRow, selector: node.id ? '#' + node.id : '.task-calendar-header', y: node.getBoundingClientRect().top }))
    .filter(anchor => anchor.y > -48 && anchor.y < window.innerHeight).slice(0, 5) : [];
  return { focus: active?.dataset.focus, day: active?.dataset.day, fallback: active?.dataset.focusFallback,
    y: window.scrollY, anchors, settingsOpen: overview.querySelector('.task-settings')?.open };
}

function restoreOverview(overview, position) {
  if (!position) return;
  const focused = position.focus && findByData(overview, 'focus', position.focus);
  const day = position.day && findByData(overview, 'day', position.day);
  const fallback = position.fallback && overview.querySelector(position.fallback);
  (focused || day || fallback)?.focus({ preventScroll: true });
  for (const anchor of position.anchors) {
    const node = anchor.row ? findByData(overview, 'task-row', anchor.row) : overview.querySelector(anchor.selector);
    if (!node) continue;
    window.scrollBy(0, node.getBoundingClientRect().top - anchor.y);
    return;
  }
  if (window.scrollY !== position.y) window.scrollTo(0, position.y);
}

function showFeedback(message, options = {}) {
  clearTimeout(feedbackTimer);
  feedback = { message, ...options };
  paintFeedback();
  if (!options.undo && !options.error && !options.waiting) {
    feedbackTimer = setTimeout(dismissFeedback, 4500);
  }
}

function dismissFeedback() {
  clearTimeout(feedbackTimer);
  if (feedback?.undo) lastCompletion = null;
  feedback = null;
  paintFeedback();
}

function paintFeedback() {
  const toast = document.querySelector('#taskFeedback');
  if (!toast) return;
  const status = toast.querySelector('.status');
  const buttons = toast.querySelector('.task-feedback-buttons');
  const undo = feedback?.undo && lastCompletion;
  toast.dataset.visible = String(Boolean(feedback));
  toast.classList.toggle('task-feedback-error', Boolean(feedback?.error));
  status.textContent = feedback?.message || '';
  const title = toast.querySelector('.task-feedback-title');
  title.textContent = feedback?.title || '';
  title.hidden = !feedback?.title;
  buttons.replaceChildren(...[
    undo && statusAction(undo.task, undo.board, 'needsAction', {
      label: 'Desfazer', className: 'button.task-undo', id: 'taskUndo', focusKey: 'undo', fallback: '#taskListTitle',
    }),
    feedback && !feedback.waiting && el('button.task-feedback-dismiss', { type: 'button', text: '×', 'aria-label': 'Fechar aviso', onclick: dismissFeedback }),
  ].filter(Boolean));
  updateWriteControls(toast);
}

function showTasks(message = '', position = overviewPosition()) {
  if (!faceSecret) { lock(); return; }
  const connected = hasSession();
  const { next, shown } = taskQueues(boards, area, filter, todayKey());
  const refresh = el(connected ? 'button.task-sync' : 'button.task-sync.primary', {
    id: 'taskSync', 'data-focus': 'sync', type: 'button', text: connected ? 'Sincronizar' : SYNC_LABEL,
    'aria-label': SYNC_LABEL, onclick: async () => {
      if (syncing || pendingTasks.size) return;
      const result = await syncGoogle((text, error) => {
        if (document.querySelector('#taskOverview')) showFeedback(text, { error, syncing: true, waiting: !error && text.endsWith('…') });
      });
      if (!result && feedback?.syncing && feedback?.waiting) dismissFeedback();
      if (document.querySelector('#taskOverview')) showTasks(result ? 'Tarefas sincronizadas.' : '');
    },
  });
  const picker = el('select', { 'data-focus': 'list-picker', onchange: event => { area = event.currentTarget.value; showTasks(); } }, [
    el('option', { value: '', text: 'Todas as listas' }),
    ...boards.map(board => el('option', { value: board.id, selected: area === board.id, text: board.title })),
  ]);
  const calendarSlot = el('div.task-calendar-slot', { id: 'taskCalendarSlot', hidden: !calendarOpen });
  const fillCalendar = () => {
    calendarSlot.replaceChildren(calendarPanel(boards, area, calendarState, {
      row: (task, board) => taskRow(task, board, 'calendar'),
      create: day => editTask(null, null, day), connected: connected && boards.length > 0,
    }));
    updateWriteControls(calendarSlot);
  };
  if (calendarOpen) fillCalendar();
  const calendarToggle = el('button.task-calendar-toggle', {
    type: 'button', text: '📅 Calendário', 'data-focus': 'calendar-toggle', 'aria-expanded': String(calendarOpen), 'aria-controls': 'taskCalendarSlot',
    onclick: () => {
      calendarOpen = !calendarOpen;
      calendarToggle.setAttribute('aria-expanded', String(calendarOpen));
      calendarSlot.hidden = !calendarOpen;
      if (calendarOpen) fillCalendar();
      else calendarSlot.replaceChildren();
    },
  });
  let overview = document.querySelector('#taskOverview');
  if (!overview) {
    overview = el('div', { id: 'taskOverview' }, [
      el('div.stack', { id: 'taskSurface' }),
      el('div.task-feedback', { id: 'taskFeedback', 'data-visible': 'false' }, [
        el('div.task-feedback-copy', {}, [el('p.status', { role: 'status', 'aria-atomic': 'true' }), el('p.task-feedback-title', { hidden: true })]),
        el('div.task-feedback-buttons'),
      ]),
    ]);
    render(overview);
  }
  overview.querySelector('#taskSurface').replaceChildren(
    nextTaskCard(next, connected),
    el('div.task-toolbar', {}, [
      connected && boards.length ? el('button.primary', { type: 'button', text: '+ Nova tarefa', 'data-focus': 'create', onclick: () => editTask() }) : null,
      calendarToggle,
      refresh,
    ]),
    ...(!connected && syncedAt ? [el('p.muted.task-freshness', { text: 'Cópia de ' + new Date(syncedAt).toLocaleString('pt-BR') })] : []),
    calendarSlot,
    el('section.panel.task-list-panel', { 'aria-labelledby': 'taskListTitle' }, [
      el('div.task-list-header', {}, [
        el('h2', { id: 'taskListTitle', tabindex: '-1', text: 'Tarefas da lista' }),
        el('label.task-list-picker', {}, [el('span.task-sr-only', { text: 'Lista do Google Tasks' }), picker]),
      ]),
      el('div.tabs.task-filters', { role: 'group', 'aria-label': 'Filtro de tarefas' }, FILTERS.map(([id, text]) => el('button', {
        type: 'button', text, 'data-focus': 'filter-' + id, 'aria-pressed': String(filter === id), onclick: () => { filter = id; showTasks(); },
      }))),
      shown.length ? el('ul.tasks-list', {}, shown.map(({ task, board }) => taskRow(task, board, 'list')))
        : el('p.muted.task-list-empty', { text: !boards.length && !connected ? 'Sincronize com o Google para carregar suas listas.'
          : filter === 'today' ? 'Sem outras tarefas com prazo até hoje.' : filter === 'done' ? 'Nenhuma tarefa concluída nesta lista.' : 'Nenhuma outra tarefa nesse filtro.' }),
    ]),
    el('details.task-settings', { open: position?.settingsOpen }, [
      el('summary', { text: 'Opções de Tarefas', 'data-focus': 'settings' }),
      el('div.actions', {}, [
        el('button', { type: 'button', text: 'Importar do Caderno', disabled: !connected, onclick: showImport }),
        el('button', { type: 'button', text: 'Trancar', onclick: () => lock() }),
      ]),
    ]),
  );
  if (message) showFeedback(message);
  else paintFeedback();
  updateWriteControls(overview);
  restoreOverview(overview, position);
}

function taskMeta(task, board) {
  const due = dateOf(task);
  return [board.title, due ? humanDay(due) : 'Sem prazo', highPriority(task) ? '⭐ Prioridade alta' : '', editableNotes(task) ? '📝 Notas' : ''].filter(Boolean).join(' · ');
}

function nextTaskCard(next, connected) {
  const heading = el('h2', { id: 'nextTaskTitle', tabindex: '-1', text: 'Próxima tarefa' });
  if (!next) {
    return el('section.task-focus.task-focus-empty', { 'aria-labelledby': 'nextTaskTitle' }, [
      heading, el('p', { text: boards.length ? 'Nenhuma tarefa pendente nesta seleção.' : 'Suas tarefas aparecem aqui depois da sincronização.' }),
    ]);
  }
  const { task, board } = next;
  const due = dateOf(task);
  const today = todayKey();
  const badge = due && due < today ? 'Atrasada' : due === today ? 'Hoje' : null;
  const complete = statusAction(task, board, 'completed', {
    label: 'Concluir', className: 'button.primary.task-focus-complete', id: 'taskNextComplete', focusKey: 'next-complete-' + taskKey(task, board), fallback: '#nextTaskTitle',
  });
  const hint = el('span', { text: 'Concluir' });
  const swipe = el('div.task-swipe', {}, [
    el('div.task-swipe-underlay', { 'aria-hidden': 'true' }, [
      el('span.task-check-mark'), hint,
    ]),
    el('div.task-swipe-surface', {}, [
      el('h3', { text: task.title }),
      el('p.task-focus-meta', { text: taskMeta(task, board) }),
    ]),
  ]);
  if (connected) bindCompletionSwipe(swipe, hint, complete);
  return el('section.task-focus', { 'aria-labelledby': 'nextTaskTitle' }, [
    el('div.task-focus-header', {}, [heading, badge ? el('span.task-focus-badge', { text: badge }) : null]),
    swipe,
    connected
      ? el('div.task-focus-actions', {}, [
        complete, el('button.task-focus-edit', { type: 'button', text: 'Editar', 'data-task-write': taskKey(task, board), 'data-focus': 'next-edit-' + taskKey(task, board), 'data-focus-fallback': '#nextTaskTitle', onclick: () => editTask(task, board) }),
        el('span.task-swipe-hint', { text: 'Deslize o cartão para a direita' }),
      ])
      : el('p.task-offline-hint', { text: 'Sincronize com o Google para concluir ou editar.' }),
  ]);
}

function statusAction(task, board, newStatus, { label, className, id, icon, focusKey, fallback }) {
  const key = taskKey(task, board);
  const completing = newStatus === 'completed';
  const button = el(className, {
    type: 'button', id, text: icon ? null : label, 'data-task-write': key,
    'data-focus': focusKey, 'data-focus-fallback': fallback,
    'aria-label': label + ': ' + task.title, title: icon ? label : null,
    onclick: async event => {
      if (pendingTasks.has(key) || (id === 'taskNextComplete' && Date.now() < nextCheckAfter)) return;
      if (!hasSession()) {
        showTasks();
        showFeedback('Reconecte o Google para continuar.', { error: true });
        return;
      }
      const current = boards.find(item => item.id === board.id)?.tasks.find(item => item.id === task.id);
      if (!current || current.deleted || current.status === newStatus) return;
      if (event.detail && repeatedTap(event)) return;
      const session = currentSession();
      beginWrite(key);
      showFeedback(completing ? 'Concluindo…' : 'Reabrindo…', { title: task.title, waiting: true });
      let saved, error;
      try {
        saved = await session.request(token => changeTaskStatus(token, board.id, task.id, newStatus));
      } catch (failure) { error = failure; }
      if (!session.current()) return;
      pendingTasks.delete(key);
      if (error) {
        if (!hasSession() && document.querySelector('#taskOverview')) showTasks();
        updateWriteControls();
        showFeedback(hasSession() ? (completing ? 'Não consegui concluir. Tente novamente.' : 'Não consegui reabrir. Tente novamente.') : error.message,
          { title: task.title, error: true, undo: id === 'taskUndo' });
        return;
      }
      saveTask(board.id, saved);
      if (completing && saved.status === 'completed') {
        lastCompletion = { task: saved, board };
        if (id === 'taskNextComplete') nextCheckAfter = Date.now() + 400;
      } else if (lastCompletion && taskKey(lastCompletion.task, lastCompletion.board) === key) {
        lastCompletion = null;
        nextCheckAfter = 0;
      }
      const confirmed = saved.status === newStatus;
      if (document.querySelector('#taskOverview')) showTasks();
      showFeedback(confirmed ? (completing ? 'Tarefa concluída.' : 'Tarefa reaberta.') : 'O Google não confirmou a alteração. Confira a tarefa.',
        { title: saved.title, undo: confirmed && completing, error: !confirmed });
    },
  }, icon ? [el('span.task-check-mark', { 'aria-hidden': 'true' })] : []);
  return button;
}

function repeatedTap(event) {
  const now = Date.now();
  if (lastTap && now - lastTap.time < 400 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 12) return true;
  lastTap = { time: now, x: event.clientX, y: event.clientY };
  return false;
}

function taskRow(task, board, region) {
  const completed = task.status === 'completed';
  const key = taskKey(task, board);
  const rowKey = region + key;
  const fallback = region === 'calendar' ? '.task-calendar-day[aria-pressed="true"]' : '#taskListTitle';
  const action = statusAction(task, board, completed ? 'needsAction' : 'completed', {
    label: completed ? 'Reabrir' : 'Concluir', className: 'button.task-check', icon: true, focusKey: rowKey + '-check', fallback,
  });
  const title = el('span.task-title', { text: task.title });
  const metadata = el('span.task-row-meta', { text: taskMeta(task, board) });
  return el(completed ? 'li.task-row.task-row-done' : 'li.task-row', { 'data-task-row': rowKey }, [
    action,
    el('button.task-open', {
      type: 'button', disabled: !hasSession(), 'data-task-write': key, 'data-focus': rowKey + '-edit', 'data-focus-fallback': fallback,
      'aria-label': 'Editar: ' + task.title, onclick: () => editTask(task, board),
    }, [title, metadata, el('span.task-chevron', { 'aria-hidden': 'true' })]),
  ]);
}

const EMOJIS = ['💼', '🎨', '💡', '🎬', '💻', '📞', '📩', '📝', '📚', '🎵', '💰', '🏠', '🛒', '🍽️', '💪', '🧠', '🐶', '❤️', '⭐', '✅'];

function emojiPicker(input, target) {
  const picker = el('details.task-emoji-picker');
  picker.append(
    el('summary', { text: '🙂 Emoji', 'aria-label': 'Inserir emoji ' + target }),
    el('div.task-emoji-grid', { role: 'group', 'aria-label': 'Emojis ' + target }, EMOJIS.map(emoji => el('button', {
      type: 'button', text: emoji, 'aria-label': `Inserir ${emoji} ${target}`,
      onclick: () => {
        input.setRangeText(emoji, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        picker.open = false;
        input.focus({ preventScroll: true });
      },
    }))),
  );
  return picker;
}

function editTask(task, board, initialDue = '') {
  const key = task ? taskKey(task, board) : 'new-task';
  if (pendingTasks.has(key)) return;
  const position = overviewPosition();
  const title = el('input', { id: 'taskEditTitle', value: task?.title || '', required: true, maxlength: 1024, autocomplete: 'off' });
  const due = el('input', { id: 'taskEditDue', type: 'date', value: task ? dateOf(task) : initialDue });
  const notes = el('textarea', { id: 'taskEditNotes', rows: 4, maxlength: 8192, placeholder: 'Detalhes, links, próximos passos…', text: editableNotes(task) });
  const priority = el('select', { id: 'taskEditPriority' }, [
    el('option', { value: 'normal', selected: !highPriority(task || {}), text: 'Normal' }),
    el('option', { value: 'high', selected: highPriority(task || {}), text: '⭐ Alta' }),
  ]);
  const progress = el('select', { id: 'taskEditStatus' }, [
    el('option', { value: 'needsAction', selected: task?.status !== 'completed', text: 'Pendente' }),
    el('option', { value: 'completed', selected: task?.status === 'completed', text: '✅ Concluída' }),
  ]);
  const status = el('p.status', { role: 'status' });
  const reconnect = el('button.primary', { type: 'button', text: 'Reconectar Google', hidden: hasSession(), onclick: async () => {
    reconnect.disabled = true;
    const updated = await syncGoogle((message, error) => {
      status.textContent = message;
      status.classList.toggle('error', Boolean(error));
    });
    reconnect.disabled = false;
    if (updated && !boards.some(item => item.id === (task ? board.id : listInput.value) && (!task || item.tasks.some(item => item.id === task.id && !item.deleted)))) {
      setError(status, new Error('A lista ou tarefa não está na conta conectada. Volte às listas para conferir.'));
      return;
    }
    if (updated) {
      reconnect.hidden = true;
      submit.hidden = false;
      status.textContent = 'Google conectado. Você pode salvar.';
      submit.focus({ preventScroll: true });
    }
  } });
  const submit = el('button.primary', { type: 'submit', text: task ? 'Salvar alterações' : 'Criar tarefa' });
  const listInput = el('select', { id: 'taskEditList' }, boards.map(item => el('option', {
    value: item.id, selected: item.id === (board?.id || area), text: item.title,
  })));
  const form = el('form.panel.stack.task-editor', { onsubmit: async event => {
    event.preventDefault();
    if (submit.disabled || submit.hidden || pendingTasks.has(key)) return;
    const controls = [...form.elements];
    controls.forEach(control => { control.disabled = true; });
    form.setAttribute('aria-busy', 'true');
    status.classList.remove('error');
    status.textContent = 'Salvando no Google Tasks…';
    const session = currentSession();
    beginWrite(key);
    try {
      const listId = task ? board.id : listInput.value;
      const fields = editorFields(task, title.value, due.value, notes.value, priority.value === 'high', task ? progress.value : 'needsAction');
      const saved = await session.request(token => task
        ? changeTask(token, listId, task.id, fields)
        : createTask(token, listId, fields.title, due.value, fields.notes));
      if (!session.current()) return;
      saveTask(listId, saved);
      if (saved.status === 'completed' && task?.status !== 'completed') lastCompletion = { task: saved, board };
      if (lastCompletion && saved.status !== 'completed' && task && taskKey(lastCompletion.task, lastCompletion.board) === key) lastCompletion = null;
      if (submit.isConnected) {
        pendingTasks.delete(key);
        showTasks('', position);
        showFeedback(task ? 'Alterações salvas.' : 'Tarefa criada.', { title: saved.title,
          undo: saved.status === 'completed' && task?.status !== 'completed' });
      }
    } catch (error) {
      setError(status, error);
      reconnect.hidden = hasSession();
      submit.hidden = !hasSession();
    } finally {
      if (session.current()) { pendingTasks.delete(key); updateWriteControls(); }
      controls.forEach(control => { control.disabled = false; });
      form.removeAttribute('aria-busy');
    }
  } }, [el('h2', { tabindex: '-1', text: task ? 'Editar tarefa' : 'Nova tarefa' }),
    task ? el('p.muted', { text: board.title }) : null,
    el('label', { for: 'taskEditTitle', text: 'Título' }), title, emojiPicker(title, 'no título'),
    el('label', { for: 'taskEditNotes', text: 'Notas' }), notes, emojiPicker(notes, 'nas notas'),
    el('label', { for: 'taskEditDue', text: '📅 Prazo' }), due,
    el('div.task-date-shortcuts', { role: 'group', 'aria-label': 'Atalhos de prazo' }, [
      ['Hoje', 0], ['Amanhã', 1], ['Em 1 semana', 7], ['Sem prazo', null],
    ].map(([text, days]) => el('button', { type: 'button', text, onclick: () => { due.value = days === null ? '' : addDays(todayKey(), days); } }))),
    el('div.task-editor-grid', {}, [
      el('label', { for: 'taskEditPriority' }, ['Prioridade', priority]),
      task ? el('label', { for: 'taskEditStatus' }, ['Estado', progress]) : el('label', { for: 'taskEditList' }, ['Lista', listInput]),
    ]),
    el('div.actions', {}, [submit, reconnect, el('button', { type: 'button', text: 'Voltar', onclick: () => showTasks('', position) })]), status]);
  submit.hidden = !hasSession();
  render(form);
  window.scrollTo(0, 0);
  form.querySelector('h2').focus({ preventScroll: true });
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
    el('p.muted', { text: 'No Caderno, abra Ajustes → Dados dos outros apps → Gerar código para Tarefas e copie o código cifrado.' }),
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
  if (document.hidden || !faceSecret || syncing || pendingTasks.size || !document.querySelector('#taskOverview')) return;
  if (grant && !hasSession()) showTasks();
  else if (hasSession() && Date.now() - (syncedAt || 0) > 60000) refreshOverview();
}

document.addEventListener('visibilitychange', refreshOnReturn);
window.addEventListener('online', refreshOnReturn);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => {});
lock();
