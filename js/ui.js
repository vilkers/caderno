/* ui.js — movimento e peças de interface compartilhadas
   (toast, sheet, confirmação, scramble, contadores, stagger) */

import { $, el } from './utils.js';

export const motionOn = () =>
  document.documentElement.dataset.motion !== 'off' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Toast ─────────────────────────────────────────────────── */
let toastT;
/**
 * toast('salvo')
 * toast('tarefa apagada', { action: 'desfazer', onAction: () => ... })
 */
export function toast(msg, { action, onAction, ms } = {}) {
  const t = $('#toast');
  if (!t) return;
  t.replaceChildren(el('span', { text: msg }));
  t.classList.toggle('has-act', !!(action && onAction));
  if (action && onAction) {
    t.append(el('button.toast__act', {
      type: 'button',
      onclick: () => { t.classList.remove('is-on'); onAction(); },
      text: action,
    }));
  }
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), ms || (action ? 6000 : 1900));
}

/* ── Sheet (modal de baixo) ────────────────────────────────── */
let sheetEsc = null;
export function openSheet(title, buildBody) {
  const sheet = $('#sheet');
  const body = $('#sheetBody');
  $('#sheetTitle').textContent = title;
  body.replaceChildren();
  sheet.classList.remove('is-closing');
  sheet.hidden = false;
  const content = buildBody(closeSheet);
  body.append(...[].concat(content));
  stagger(body, ':scope > *');
  sheetEsc = e => { if (e.key === 'Escape') closeSheet(); };
  document.addEventListener('keydown', sheetEsc);
  const focusable = body.querySelector('input,textarea,select,button');
  if (focusable && window.matchMedia('(min-width:900px)').matches) focusable.focus();
  return closeSheet;
}
export function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  document.removeEventListener('keydown', sheetEsc);
  if (!motionOn()) { sheet.hidden = true; return; }
  sheet.classList.add('is-closing');
  setTimeout(() => { sheet.hidden = true; sheet.classList.remove('is-closing'); }, 300);
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) closeSheet();
});

/** Confirmação com foco em ação destrutiva */
export function confirmSheet({ title, text, ok = 'Confirmar', danger = false, onOk }) {
  openSheet(title, close => [
    el('p', { class: 'muted', text }),
    el('div.sheet__actions', {}, [
      el('button.btn', { type: 'button', onclick: close }, [el('span', { text: 'Cancelar' })]),
      el(`button.btn${danger ? '.btn--danger' : '.btn--solid'}`, {
        type: 'button',
        onclick: () => { close(); onOk(); },
      }, [el('span', { text: ok })]),
    ]),
  ]);
}

/* ── Scramble de texto (hover/entrada) ─────────────────────── */
const GLYPHS = '█▓▒░/\\<>—+*#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function scramble(node, final = node.textContent, ms = 620) {
  if (!motionOn()) { node.textContent = final; return; }
  const start = performance.now();
  const chars = [...final];
  const tick = now => {
    const p = Math.min(1, (now - start) / ms);
    node.textContent = chars.map((c, i) => {
      if (c === ' ') return c;
      const reveal = (i + 1) / chars.length;
      return p >= reveal ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }).join('');
    if (p < 1) requestAnimationFrame(tick);
    else node.textContent = final;
  };
  requestAnimationFrame(tick);
}
export function bindScramble(root = document) {
  root.querySelectorAll('[data-scramble]').forEach(n => {
    const final = n.dataset.final || n.textContent;
    n.dataset.final = final;
    scramble(n, final);
    n.addEventListener('pointerenter', () => scramble(n, final, 420));
  });
}

/* ── Contador numérico ─────────────────────────────────────── */
export function countUp(node, to, { dec = 0, ms = 800, suffix = '' } = {}) {
  const fmt = v => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
  if (!motionOn()) { node.textContent = fmt(to); return; }
  const from = 0, start = performance.now();
  const tick = now => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ── Stagger de entrada ────────────────────────────────────── */
export function stagger(root, sel = '.rv', max = 18, step = null) {
  root.querySelectorAll(sel).forEach((n, i) => {
    n.classList.add('rv');
    n.style.setProperty('--i', Math.min(i, max));
    if (step) n.style.setProperty('--step', step + 'ms');
  });
}

/* ── Swipe horizontal (troca de dia no celular) ────────────── */
export function onSwipe(node, { left, right, threshold = 70 } = {}) {
  let x0 = null, y0 = null;
  node.addEventListener('touchstart', e => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  node.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.6) (dx < 0 ? left : right)?.();
    x0 = y0 = null;
  }, { passive: true });
}
