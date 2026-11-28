import { el, keyOf, parseKey, todayKey, monthMatrix, weekLabels, longDay } from '../js/utils.js';
import { dateOf } from './backend.js';
import { orderedTasks } from './flow.js';

export function tasksByDay(boards, area) {
  const dates = new Map();
  for (const entry of orderedTasks(boards, area)) {
    const day = dateOf(entry.task);
    if (!day || entry.task.status === 'completed') continue;
    if (!dates.has(day)) dates.set(day, []);
    dates.get(day).push(entry);
  }
  return dates;
}

export function calendarPanel(boards, area, state, { row, create, connected }) {
  const panel = el('section.panel.task-calendar', { id: 'taskCalendar', 'aria-label': 'Calendário de tarefas' });
  const dates = tasksByDay(boards, area);
  function paint(focusDay) {
    const date = parseKey(state.month + '-01');
    const today = todayKey();
    const move = delta => {
      date.setMonth(date.getMonth() + delta);
      state.day = keyOf(date).slice(0, 7) === today.slice(0, 7) ? today : keyOf(date);
      state.month = state.day.slice(0, 7);
      paint();
      panel.querySelector(delta < 0 ? '.task-calendar-prev' : '.task-calendar-next')?.focus({ preventScroll: true });
    };
    const monthLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const entries = dates.get(state.day) || [];
    panel.replaceChildren(
      el('div.task-calendar-header', {}, [
        el('h2', { text: monthLabel, 'aria-live': 'polite' }),
        el('div.actions', {}, [
          el('button.task-calendar-nav.task-calendar-prev', { type: 'button', 'aria-label': 'Mês anterior', onclick: () => move(-1) }),
          el('button', { type: 'button', text: 'Hoje', onclick: () => { state.month = today.slice(0, 7); state.day = today; paint(today); } }),
          el('button.task-calendar-nav.task-calendar-next', { type: 'button', 'aria-label': 'Próximo mês', onclick: () => move(1) }),
        ]),
      ]),
      el('div.task-calendar-week', { 'aria-hidden': 'true' }, weekLabels(1).map(text => el('span', { text }))),
      el('div.task-calendar-grid', { role: 'group', 'aria-label': monthLabel }, monthMatrix(date.getFullYear(), date.getMonth(), 1).map(day => {
        const count = dates.get(day.key)?.length || 0;
        return el('button.task-calendar-day', {
          type: 'button', 'data-day': day.key, 'data-out': String(day.out),
          'aria-pressed': String(state.day === day.key), 'aria-current': day.key === today ? 'date' : null,
          'aria-label': `${longDay(day.key)}: ${count} ${count === 1 ? 'tarefa pendente' : 'tarefas pendentes'}`,
          onclick: () => { state.day = day.key; state.month = day.key.slice(0, 7); paint(day.key); },
        }, [el('span', { text: day.day }), count ? el('span.task-calendar-dot', { 'aria-hidden': 'true' }) : null]);
      })),
      el('div.task-calendar-agenda', { 'aria-live': 'polite' }, [
        el('div.task-calendar-day-header', {}, [
          el('h3', { text: longDay(state.day) }),
          connected ? el('button', { type: 'button', text: '+ Tarefa', 'data-focus': 'calendar-create', 'aria-label': 'Nova tarefa em ' + longDay(state.day), onclick: () => create(state.day) }) : null,
        ]),
        entries.length ? el('ul.tasks-list', {}, entries.map(({ task, board }) => row(task, board)))
          : el('p.muted', { text: 'Nenhuma tarefa pendente neste dia.' }),
      ]),
    );
    if (focusDay) panel.querySelector(`[data-day="${focusDay}"]`)?.focus({ preventScroll: true });
  }
  paint();
  return panel;
}
