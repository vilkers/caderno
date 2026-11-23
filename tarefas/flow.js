import { addDays } from '../js/utils.js';
import { dateOf, highPriority } from './backend.js';

export function orderedTasks(boards, area) {
  return boards.filter(board => !area || board.id === area).flatMap(board => board.tasks
    .filter(task => !task.deleted)
    .map(task => ({ task, board })))
    .sort((a, b) => (dateOf(a.task) || '9999').localeCompare(dateOf(b.task) || '9999')
      || Number(highPriority(b.task)) - Number(highPriority(a.task)) || a.task.title.localeCompare(b.task.title, 'pt-BR'));
}

export function taskQueues(boards, area, filter, today) {
  const tasks = orderedTasks(boards, area);
  const next = tasks.find(({ task }) => task.status !== 'completed');
  const limit = filter === 'week' ? addDays(today, 6) : today;
  const shown = tasks.filter(entry => {
    const { task } = entry;
    if (task.status === 'completed') return filter === 'done';
    if (entry === next || filter === 'done') return false;
    const date = dateOf(task);
    return filter === 'open' || (date && date <= limit);
  });
  return { next, shown };
}

export function bindCompletionSwipe(track, hint, action) {
  let drag;
  const release = () => {
    const pointerId = drag?.pointerId;
    drag = null;
    if (pointerId !== undefined && track.hasPointerCapture(pointerId)) track.releasePointerCapture(pointerId);
    track.classList.remove('is-dragging', 'is-ready');
    track.style.removeProperty('--drag');
    hint.textContent = 'Concluir';
  };
  track.addEventListener('pointerdown', event => {
    if (action.disabled || !event.isPrimary || event.button !== 0) return;
    const { pointerId, clientX, clientY } = event;
    const threshold = Math.min(96, track.clientWidth * .32);
    if (!threshold) return;
    drag = { pointerId, clientX, clientY, threshold, moving: false };
    // Keep the gesture on the track even when the pointer leaves its children.
    // Vertical scrolling remains native (pan-y).
    track.setPointerCapture(pointerId);
  });
  track.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.pointerId) return;
    const deltaX = event.clientX - drag.clientX;
    const deltaY = Math.abs(event.clientY - drag.clientY);
    if (!drag.moving) {
      if (deltaX < -10 || (deltaY > 12 && deltaY >= deltaX)) { release(); return; }
      if (deltaX < 10 || deltaX < deltaY * 1.4) return;
      drag.moving = true;
      track.classList.add('is-dragging');
    }
    if (event.cancelable) event.preventDefault();
    const ready = deltaX >= drag.threshold;
    track.classList.toggle('is-ready', ready);
    track.style.setProperty('--drag', Math.max(0, Math.min(deltaX, track.clientWidth)) + 'px');
    hint.textContent = ready ? 'Solte para concluir' : 'Continue deslizando';
  });
  track.addEventListener('pointerup', event => {
    if (event.pointerId !== drag?.pointerId) return;
    const finish = drag.moving && event.clientX - drag.clientX >= drag.threshold;
    release();
    if (finish && !action.disabled) action.click();
  });
  for (const eventName of ['pointercancel', 'lostpointercapture']) {
    track.addEventListener(eventName, event => { if (event.pointerId === drag?.pointerId) release(); });
  }
}
