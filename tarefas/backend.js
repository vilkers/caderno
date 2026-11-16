import { googleRequest, list } from '../js/google-tasks.js';
import { keyOf, parseKey } from '../js/utils.js';

const marker = 'Caderno ID: ';
const listPath = '/users/@me/lists';
const taskPath = id => `/lists/${encodeURIComponent(id)}/tasks`;
export const dateOf = task => task.due?.slice(0, 10) || '';
export const highPriority = task => task.notes?.split('\n').includes('Prioridade: alta') ?? false;

function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && keyOf(parseKey(date)) === date;
}

export async function loadBoards(token) {
  const boards = await list(token, listPath);
  return Promise.all(boards.map(async board => ({
    id: board.id,
    title: board.title,
    tasks: await list(token, taskPath(board.id), { maxResults: '100', showCompleted: 'true', showHidden: 'true' }),
  })));
}

export function createTask(token, board, title, due, notes) {
  const fields = taskFields(title, due);
  return googleRequest(token, taskPath(board), 'POST', { title: fields.title, ...(fields.due ? { due: fields.due } : {}), ...(notes ? { notes } : {}) });
}

export function changeTask(token, board, id, fields) {
  return googleRequest(token, `${taskPath(board)}/${encodeURIComponent(id)}`, 'PATCH', fields);
}

export function taskFields(title, due) {
  title = title.trim();
  if (!title || title.length > 1024 || (due && !validDate(due))) throw new Error('Confira o título e o prazo.');
  return { title, due: due ? `${due}T00:00:00.000Z` : null };
}

export function migrationPlan(records, boards) {
  if (!Array.isArray(records) || records.length > 5000) throw new Error('O código de tarefas não está no formato esperado.');
  const linked = new Set(boards.flatMap(board => board.tasks)
    .map(task => task.notes?.split('\n', 1)[0])
    .filter(line => line?.startsWith(marker)));
  const unique = new Set();
  const pending = [];
  for (const { id, text, due, star } of records) {
    if (typeof id !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(id) || unique.has(id) || typeof text !== 'string') {
      throw new Error('O código tem uma tarefa inválida ou repetida.');
    }
    taskFields(text, due);
    unique.add(id);
    if (!linked.has(marker + id)) pending.push({ id, title: text, due, star: star === true });
  }
  return pending;
}

export async function importCaderno(token, records, active = () => true) {
  const run = async () => {
    if (!active()) return 0;
    const boards = await loadBoards(token);
    const pending = migrationPlan(records, boards);
    if (!pending.length || !active()) return 0;
    const matching = boards.filter(board => board.title === 'Caderno');
    if (matching.length > 1) throw new Error('Deixe uma única lista chamada Caderno no Google Tasks.');
    const target = matching[0] || await googleRequest(token, listPath, 'POST', { title: 'Caderno' });
    let imported = 0;
    for (const item of pending) {
      if (!active()) break;
      const note = marker + item.id + (item.star ? '\nPrioridade: alta' : '');
      await createTask(token, target.id, item.title, item.due, note);
      imported++;
    }
    return imported;
  };
  return globalThis.navigator?.locks ? navigator.locks.request('caderno-tarefas-importacao', run) : run();
}
