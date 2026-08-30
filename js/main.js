/* main.js — arranque, tela de senha, roteador e atalhos */

import { $, $$, todayKey, addDays, longDay, humanDay } from './utils.js';
import * as store from './store.js';
import * as vault from './vault.js';
import * as sync from './sync.js';
import * as badges from './badges.js';
import { PALETTES, applyPalette } from './palettes.js';
import { toast, bindScramble, openSheet, closeSheet, stagger, motionOn, revelarAoRolar, observarTopo } from './ui.js';
import { icon } from './icons.js';
import { el, debounce } from './utils.js';

import * as viewToday from './views/today.js';
import * as viewMonth from './views/month.js';
import * as viewTodos from './views/todos.js';
import * as viewInsights from './views/insights.js';
import * as viewMetas from './views/metas.js';
import * as viewSettings from './views/settings.js';

const VIEWS = {
  hoje: viewToday, mes: viewMonth, lista: viewTodos,
  insights: viewInsights, metas: viewMetas, ajustes: viewSettings,
};

/* ── Contexto compartilhado entre as telas ─────────────────── */
const ctx = {
  view: 'hoje',
  day: todayKey(),
  range: 30,
  todoTab: 'abertas',
  monthFilter: null,
  monthMode: 'mes',
  weekAnchor: null,
  go(v) { if (VIEWS[v]) { ctx.view = v; paint(); } },
  setDay(k) { ctx.day = k; if (ctx.view === 'hoje') paint(); },
  rerender() { paint(); },
  lock() { doLock(); },
};

/* ── Pintura ───────────────────────────────────────────────── */
function paint() {
  const main = $('#main');
  ctx.softRefresh = null;              // cada tela instala o seu, se quiser
  const node = VIEWS[ctx.view].render(ctx);
  main.replaceChildren(node);
  main.scrollTop = 0;
  revelarAoRolar(main);
  $$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === ctx.view));
  const wide = window.matchMedia('(min-width:700px)').matches;
  $('#topDate').textContent = ctx.view === 'hoje'
    ? (wide ? longDay(ctx.day) : humanDay(ctx.day))
    : humanDay(todayKey());
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
  aplicarAtalhoDaURL();
  paint();
  armAutolock();
  paintSync(sync.getStatus());

  if (sync.configured()) {
    sync.pullAndMerge()
      .then(r => { if (r.merged) { paint(); toast('dados do repositório trazidos'); } })
      .then(() => sync.syncNow({ silent: true }))
      .catch(err => toast(err.message, { ms: 5000 }));
  }
}

function doLock() {
  store.flush();
  if (sync.configured()) sync.syncNow({ silent: true }).catch(() => {});
  store.lockVault();
  closeSheet();
  $('#app').hidden = true;
  $('#main').replaceChildren();
  setupLock();
  toast('trancado');
}

/** Atalhos do app instalado: ./?v=hoje | lista | semana | insights */
function aplicarAtalhoDaURL() {
  const v = new URLSearchParams(location.search).get('v');
  if (!v) return;
  if (v === 'semana') { ctx.view = 'mes'; ctx.monthMode = 'semana'; }
  else if (VIEWS[v]) ctx.view = v;
  history.replaceState(null, '', location.pathname);
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
  $$('.nav__item').forEach(b => {
    b.prepend(icon(b.dataset.icon || 'hoje'));
    b.addEventListener('click', () => ctx.go(b.dataset.view));
  });
  observarTopo();
  $('#brandBtn').addEventListener('click', () => { ctx.day = todayKey(); ctx.go('hoje'); });
  $('#lockNowBtn').addEventListener('click', doLock);
  $('#paletteBtn').addEventListener('click', paletteSheet);

  document.addEventListener('keydown', e => {
    if ($('#app').hidden) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const keys = { 1: 'hoje', 2: 'mes', 3: 'lista', 4: 'insights', 5: 'metas', 6: 'ajustes' };
    if (keys[e.key]) { ctx.go(keys[e.key]); return; }
    if (ctx.view === 'hoje') {
      if (e.key === 'ArrowLeft') ctx.setDay(addDays(ctx.day, -1));
      if (e.key === 'ArrowRight') ctx.setDay(addDays(ctx.day, 1));
      if (e.key.toLowerCase() === 't') ctx.setDay(todayKey());
    }
    if (e.key.toLowerCase() === 'l') doLock();
    if (e.key.toLowerCase() === 'f' && ctx.view === 'hoje') {
      const aberto = !store.getDay(ctx.day)?.closed;
      store.closeDay(ctx.day, aberto);
      toast(aberto ? 'dia fechado' : 'dia reaberto');
      paint();
    }
  });

  window.addEventListener('pagehide', () => store.flush());

  $('#syncBtn').addEventListener('click', async () => {
    if (!sync.configured()) { ctx.go('ajustes'); return; }
    try { await sync.syncNow(); toast('sincronizado'); }
    catch (err) { toast(err.message, { ms: 5000 }); }
  });
  sync.onStatus(paintSync);
  sync.start();

  store.subscribe(reason => { if (reason !== 'badges') conferirConquistas(); });
  store.subscribe(reason => {
    if (reason === 'settings' || reason === 'categories') {
      document.documentElement.dataset.motion = store.state.settings.motion ? 'on' : 'off';
    }
    // dados trocados por fora (junção da sincronia, outra aba): repinta
    if (reason === 'replace' && !$('#app').hidden) paint();
  });
}

/* ── Conquistas ────────────────────────────────────────────── */
const conferirConquistas = debounce(() => {
  if (!store.isUnlocked()) return;
  const novas = badges.claim();
  const resumo = badges.summary();
  const subiu = resumo.level.i > (store.state.levelSeen || 0);

  if (!novas.length && !subiu) return;
  if (subiu) store.state.levelSeen = resumo.level.i;
  store.emit('badges');

  // subir de nível é raro: merece a tela. Conquista é aviso que não atrapalha.
  if (subiu) celebrar(novas, resumo);
  else {
    toast(`✦ ${novas[0].name}${novas.length > 1 ? ` +${novas.length - 1}` : ''}`, {
      action: 'ver', ms: 6000,
      onAction: () => celebrar(novas, resumo),
    });
  }
}, 900);

function celebrar(novas, resumo) {
  const subiu = resumo.level.i > 0 && resumo.level.i === (store.state.levelSeen || 0);
  openSheet(subiu ? 'Subiu de nível' : (novas.length > 1 ? `${novas.length} conquistas` : 'Conquista'), close => [
    subiu ? el('div.award.award--level', {}, [
      el('span.award__e', { text: '✦' }),
      el('div', {}, [
        el('p.award__n', { text: resumo.level.name }),
        el('p.award__d', { text: resumo.level.lore }),
      ]),
    ]) : null,
    ...novas.map(b => el('div.award', {}, [
      el('span.award__e', { text: b.emoji }),
      el('div', {}, [
        el('p.award__n', { text: b.name }),
        el('p.award__d', { text: b.desc }),
      ]),
    ])),
    el('p.micro', { text: `${resumo.level.name.toUpperCase()} · ${resumo.xp} XP · ${resumo.ganhas}/${resumo.total} CONQUISTAS` }),
    el('div.sheet__actions', {}, [
      el('button.btn', { type: 'button', onclick: () => { close(); ctx.go('insights'); } }, [el('span', { text: 'ver todas' })]),
      el('button.btn.btn--solid', { type: 'button', onclick: close }, [el('span', { text: 'valeu' })]),
    ]),
  ].filter(Boolean));
}

const SYNC_TXT = {
  off: 'sem sync', syncing: 'sincronizando', ok: 'sincronizado',
  pending: 'pendente', error: 'erro',
};
function paintSync(st) {
  const btn = $('#syncBtn');
  if (!btn) return;
  btn.hidden = !store.isUnlocked();
  btn.dataset.state = st.state;
  btn.querySelector('.syncchip__t').textContent = SYNC_TXT[st.state] || st.state;
  btn.title = st.msg || '';
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
