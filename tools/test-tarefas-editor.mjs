import assert from 'node:assert/strict';
import { changeTaskStatus, editableNotes, editorFields, highPriority } from '../tarefas/backend.js';
import { tasksByDay } from '../tarefas/calendar.js';
import { bindCompletionSwipe, taskQueues } from '../tarefas/flow.js';

const task = { id: 'one', title: 'Investir', status: 'needsAction', due: '2026-11-23T00:00:00.000Z',
  notes: 'Caderno ID: original\nConferir orçamento 💰\nhttps://example.com\nPrioridade: alta' };
assert.equal(editableNotes(task), 'Conferir orçamento 💰\nhttps://example.com');
const updated = editorFields(task, '  💰 Investir  ', '', 'Notas novas\nCom duas linhas', false);
assert.equal(updated.title, '💰 Investir');
assert.equal(updated.notes, 'Caderno ID: original\nNotas novas\nCom duas linhas');
assert.equal(updated.due, null);
assert.equal(updated.completed, null);
assert.equal(highPriority(updated), false);
const starred = editorFields(task, task.title, '2026-12-01', editableNotes(task), true, 'completed');
assert.equal(highPriority(starred), true);
assert.equal(starred.notes.match(/Prioridade: alta/g).length, 1);
assert.equal(starred.notes.split('\n')[0], 'Caderno ID: original');
assert.equal(starred.status, 'completed');
assert.throws(() => editorFields(task, '', '', '', false), /título/);
assert.throws(() => editorFields(task, 'Título', '2026-02-30', '', false), /prazo/);
assert.throws(() => editorFields(task, 'Título', '', 'x'.repeat(8193), false), /8.192/);
assert.throws(() => editorFields(task, 'Título', '', '', false, 'unknown'), /estado/);

const boards = [{ id: 'a', title: 'Pessoal', tasks: [task,
  { id: 'two', title: 'Concluída', due: task.due, status: 'completed' },
  { id: 'three', title: 'Excluída', due: task.due, deleted: true },
  { id: 'four', title: 'Sem prazo', status: 'needsAction' },
] }, { id: 'b', title: 'Trabalho', tasks: [{ id: 'five', title: 'Outra lista', due: task.due, status: 'needsAction' }] }];
assert.equal(tasksByDay(boards, '').get('2026-11-23').length, 2);
assert.equal(tasksByDay(boards, 'a').get('2026-11-23').length, 1);
assert.equal(tasksByDay(boards, '').has(''), false);
const { next, shown } = taskQueues(boards, 'a', 'today', '2026-11-23');
assert.equal(next.task.id, task.id);
assert.equal(shown.length, 0, 'próxima tarefa continua sem duplicação na lista');

const finished = [{ ...task, id: 'first', status: 'completed', completed: '2026-11-22T00:00:00Z' },
  { ...task, id: 'last', status: 'completed', completed: '2026-11-23T00:00:00Z' }];
assert.deepEqual(taskQueues([{ id: 'a', tasks: finished }], 'a', 'done', '2026-11-23').shown.map(entry => entry.task.id), ['last', 'first']);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(options.method, 'PATCH');
    assert.match(url, /\/lists\/a\/tasks\/one$/);
    return Response.json({ id: 'one', ...JSON.parse(options.body) });
  };
  const done = await changeTaskStatus('token-ficticio', 'a', 'one', 'completed');
  assert.equal(done.status, 'completed');
  assert.ok(Number.isFinite(Date.parse(done.completed)));
  const reopened = await changeTaskStatus('token-ficticio', 'a', 'one', 'needsAction');
  assert.equal(reopened.status, 'needsAction');
  assert.equal(reopened.completed, null);
} finally { globalThis.fetch = originalFetch; }

// Event-level regression checks: no completion on cancellation or vertical scroll.
const track = new EventTarget();
const captured = new Set(), classes = new Set(), styles = new Map();
Object.assign(track, {
  clientWidth: 300,
  setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id),
  releasePointerCapture: id => captured.delete(id),
  classList: { add: name => classes.add(name), remove: (...names) => names.forEach(name => classes.delete(name)),
    toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
  style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) },
});
const hint = { textContent: '' };
let completions = 0;
const action = { disabled: false, click: () => { completions++; } };
bindCompletionSwipe(track, hint, action);
function pointer(type, x, y = 0, pointerType = 'touch', isPrimary = true) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: 1, clientX: x, clientY: y, button: 0, pointerType, isPrimary });
  track.dispatchEvent(event);
}
pointer('pointerdown', 20);
assert.equal(captured.has(1), true, 'captura começa ao tocar o cartão');
pointer('pointermove', 50); pointer('pointerup', 50);
assert.equal(completions, 0, 'arrasto curto não conclui');
pointer('pointerdown', 20); pointer('pointermove', 140); pointer('pointercancel', 140); pointer('pointerup', 140);
assert.equal(completions, 0, 'cancelamento do navegador não conclui');
pointer('pointerdown', 20); pointer('pointermove', 24, 60); pointer('pointerup', 150, 60);
assert.equal(completions, 0, 'rolagem vertical não conclui');
pointer('pointerdown', 20); pointer('pointermove', 140); pointer('pointerup', 140); pointer('pointerup', 140);
assert.equal(completions, 1, 'arrasto completo conclui uma única vez');
pointer('pointerdown', 20, 0, 'mouse'); pointer('pointermove', 140, 0, 'mouse'); pointer('pointerup', 140, 0, 'mouse');
assert.equal(completions, 2, 'mouse funciona com a mesma ação');
action.disabled = true;
pointer('pointerdown', 20); pointer('pointermove', 140); pointer('pointerup', 140);
assert.equal(completions, 2, 'ação bloqueada não dispara');
assert.equal(captured.size, 0);
assert.equal(classes.size, 0);
assert.equal(styles.size, 0);
console.log('Editor, calendário e gestos OK: notas, vínculo, prioridade, datas, filtros e cancelamento preservados.');
