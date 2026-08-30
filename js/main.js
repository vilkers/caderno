/* main.js — arranque, tela de senha, roteador e atalhos */

import { $, $$, el, todayKey, addDays, longDay, humanDay } from './utils.js';
import * as store from './store.js';
import * as vault from './vault.js';
import { PALETTES, applyPalette } from './palettes.js';
import { toast, bindScramble, openSheet, closeSheet, stagger, motionOn } from './ui.js';

import * as viewToday from './views/today.js';
import * as viewMonth from './views/month.js';
import * as viewTodos from './views/todos.js';
import * as viewInsights from './views/insights.js';
import * as viewSettings from './views/settings.js';

const VIEWS = {
  hoje: viewToday, mes: viewMonth, lista: viewTodos,
  insights: viewInsights, ajustes: viewSettings,
};

/* ── Contexto compartilhado entre as telas ─────────────────── */
const ctx = {
  view: 'hoje',
  day: todayKey(),
  range: 30,
  todoTab: 'abertas',
  monthFilter: null,
  go(v) { if (VIEWS[v]) { ctx.view = v; paint(); } },
  setDay(k) { ctx.day = k; if (ctx.view === 'hoje') paint(); },
  rerender() { paint(); },
  lock() { doLock(); },
};

/* ── Pintura ───────────────────────────────────────────────── */
function paint() {
  const main = $('#main');
  const node = VIEWS[ctx.view].render(ctx);
  main.replaceChildren(node);
  main.scrollTop = 0;
  $$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === ctx.view));
  const wide = window.matchMedia('(min-width:700px)').matches;
  $('#topDate').textContent = ctx.view === 'hoje'
    ? (wide ? longDay(ctx.day) : humanDay(ctx.day))
    : humanDay(todayKey());
  window.scrollTo({ top: 0, behavior: motionOn() ? 'smooth' : 'auto' });
}

/* ── Tela de senha ─────────────────────────────────────────── */
const TICKER = [
  'REGISTRE O DIA', 'SEM NUVEM', 'CIFRADO NESTE APARELHO', 'AES-256-GCM',
  'SEUS DADOS SÃO SEUS', 'UM TOQUE POR HÁBITO', 'CADERNO',
];

function setupLock() {
  const isNew = !vault.hasVault();
  const meta = vault.readMeta();
  $('#lockConfirmField').hidden = !isNew;
  $('#lockPass').setAttribute('autocomplete', isNew ? 'new-password' : 'current-password');
  $('#lockBtn').querySelector('span').textContent = isNew ? 'CRIAR CADERNO' : 'ENTRAR';
  $('#lockSub').textContent = isNew
    ? 'Escolha uma senha. Ela cifra tudo neste aparelho e não dá pra recuperar depois.'
    : 'Diário de rotina. Tudo fica cifrado neste aparelho.';
  $('#lockHint').textContent = isNew
    ? 'Nada sai daqui: sem servidor, sem conta, sem nuvem.'
    : (meta.hint ? `dica: ${meta.hint}` : '');

  const track = $('#lockTicker');
  track.replaceChildren();
  [...TICKER, ...TICKER].forEach(t => track.append(el('span', { text: t })));

  $('#lock').hidden = false;
  bindScramble($('#lock'));

  $('#lockForm').onsubmit = async e => {
    e.preventDefault();
    const err = $('#lockError');
    const pass = $('#lockPass').value;
    err.textContent = '';
    if (!vault.supported()) {
      err.textContent = 'Este navegador não expõe WebCrypto (precisa de HTTPS).';
      return;
    }
    const btn = $('#lockBtn');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'ABRINDO…';
    try {
      if (isNew) {
        if (pass.length < 4) throw new Error('curta');
        if (pass !== $('#lockPass2').value) throw new Error('confirma');
        await store.createVault(pass);
        toast('caderno criado');
      } else {
        await store.unlockVault(pass);
      }
      enterApp();
    } catch (ex) {
      err.textContent = {
        curta: 'Use pelo menos 4 caracteres.',
        confirma: 'As senhas não batem.',
        senha: 'Senha incorreta.',
      }[ex.message] || 'Não consegui abrir o cofre.';
      $('#lockPass').select();
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = isNew ? 'CRIAR CADERNO' : 'ENTRAR';
    }
  };
}

function enterApp() {
  applyPalette(store.state.settings.palette);
  vault.writeMeta({ palette: store.state.settings.palette });
  document.documentElement.dataset.motion = store.state.settings.motion ? 'on' : 'off';
  $('#lockPass').value = '';
  $('#lockPass2').value = '';
  $('#lock').hidden = true;
  $('#app').hidden = false;
  ctx.day = todayKey();
  ctx.view = 'hoje';
  paint();
  armAutolock();
}

function doLock() {
  store.flush();
  store.lockVault();
  closeSheet();
  $('#app').hidden = true;
  $('#main').replaceChildren();
  setupLock();
  toast('trancado');
}

/* ── Trava automática ──────────────────────────────────────── */
let idleT, hiddenAt = 0;
function armAutolock() {
  const reset = () => {
    clearTimeout(idleT);
    const min = store.state.settings.autolock;
    if (!min || !store.isUnlocked()) return;
    idleT = setTimeout(() => { if (store.isUnlocked()) doLock(); }, min * 60000);
  };
  ['pointerdown', 'keydown', 'visibilitychange'].forEach(ev =>
    document.addEventListener(ev, reset, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); store.flush(); }
    else if (hiddenAt && store.isUnlocked()) {
      const min = store.state.settings.autolock;
      if (min && Date.now() - hiddenAt > min * 60000) doLock();
    }
  });
  reset();
}

/* ── Ligações de interface ─────────────────────────────────── */
function wire() {
  $$('.nav__item').forEach(b => b.addEventListener('click', () => ctx.go(b.dataset.view)));
  $('#brandBtn').addEventListener('click', () => { ctx.day = todayKey(); ctx.go('hoje'); });
  $('#lockNowBtn').addEventListener('click', doLock);
  $('#paletteBtn').addEventListener('click', paletteSheet);

  document.addEventListener('keydown', e => {
    if ($('#app').hidden) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const keys = { 1: 'hoje', 2: 'mes', 3: 'lista', 4: 'insights', 5: 'ajustes' };
    if (keys[e.key]) { ctx.go(keys[e.key]); return; }
    if (ctx.view === 'hoje') {
      if (e.key === 'ArrowLeft') ctx.setDay(addDays(ctx.day, -1));
      if (e.key === 'ArrowRight') ctx.setDay(addDays(ctx.day, 1));
      if (e.key.toLowerCase() === 't') ctx.setDay(todayKey());
    }
    if (e.key.toLowerCase() === 'l') doLock();
  });

  window.addEventListener('pagehide', () => store.flush());
  store.subscribe(reason => {
    if (reason === 'settings' || reason === 'categories') {
      document.documentElement.dataset.motion = store.state.settings.motion ? 'on' : 'off';
    }
  });
}

function paletteSheet() {
  openSheet('Paleta', close => {
    const grid = el('div.palettes', {}, PALETTES.map(p => el('button.pal' + (store.state.settings.palette === p.id ? '.is-on' : ''), {
      type: 'button',
      onclick: () => {
        store.state.settings.palette = p.id;
        applyPalette(p.id);
        vault.writeMeta({ palette: p.id });
        store.emit('settings');
        close();
        paint();
        toast(`paleta ${p.name.toLowerCase()}`);
      },
    }, [
      el('div.pal__sw', {}, [
        el('i', { style: { background: p.vars.bg } }),
        el('i', { style: { background: p.vars.fg } }),
        el('i', { style: { background: p.vars.accent } }),
      ]),
      el('span.pal__n', { text: p.name }),
    ])));
    return [grid];
  });
}

/* ── Arranque ──────────────────────────────────────────────── */
function boot() {
  const meta = vault.readMeta();
  applyPalette(meta.palette || 'noir');
  wire();
  setupLock();

  const splash = $('#boot');
  const done = () => {
    splash.classList.add('is-out');
    setTimeout(() => splash.remove(), 520);
    const input = $('#lockPass');
    if (window.matchMedia('(min-width:900px)').matches) input.focus();
  };
  setTimeout(done, motionOn() ? 900 : 120);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
