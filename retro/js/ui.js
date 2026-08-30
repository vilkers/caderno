/* ui.js — peças de interface da 2.0: caixa de diálogo e aviso de rodapé.
   Mesma ideia do clássico, com cara de menu de jogo. */

import { el } from '../../js/utils.js';
import * as sfx from './sfx.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ── Aviso ─────────────────────────────────────────────────── */
let avisoT;
/** aviso('SALVO') · aviso('APAGADA', { acao: 'DESFAZER', aoClicar }) */
export function aviso(txt, { acao, aoClicar, ms } = {}) {
  const n = $('#aviso');
  if (!n) return;
  n.replaceChildren(el('span', { text: txt }));
  n.classList.toggle('tem-acao', !!(acao && aoClicar));
  if (acao && aoClicar) {
    n.append(el('button.aviso__b', {
      type: 'button', text: acao,
      onclick: () => { n.classList.remove('on'); aoClicar(); },
    }));
  }
  n.classList.add('on');
  clearTimeout(avisoT);
  avisoT = setTimeout(() => n.classList.remove('on'), ms || (acao ? 6000 : 2000));
}

/* ── Caixa de diálogo ──────────────────────────────────────── */
let escHandler = null;
export function caixa(titulo, monta) {
  const m = $('#modal');
  $('#modalT').textContent = titulo;
  const corpo = $('#modalCorpo');
  corpo.replaceChildren();
  m.hidden = false;
  document.body.classList.add('tem-modal');
  sfx.pausa();
  corpo.append(...[].concat(monta(fecha)));
  escHandler = e => { if (e.key === 'Escape') fecha(); };
  document.addEventListener('keydown', escHandler);
  return fecha;
}
export function fecha() {
  const m = $('#modal');
  if (m.hidden) return;
  document.removeEventListener('keydown', escHandler);
  document.body.classList.remove('tem-modal');
  m.hidden = true;
}
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) fecha(); });

/** Confirmação em caixa de diálogo. */
export function confirma({ titulo, texto, ok = 'CONFIRMAR', onOk }) {
  caixa(titulo, close => [
    el('p', { style: { fontSize: '14px', lineHeight: '1.6' }, text: texto }),
    el('div.modal__acoes', {}, [
      el('button.btn', { type: 'button', onclick: close, text: 'VOLTAR' }),
      el('button.btn.btn--a', { type: 'button', onclick: () => { close(); onOk(); }, text: ok }),
    ]),
  ]);
}

export { el };
