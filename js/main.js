/* main.js — arranque, tela de senha, roteador e atalhos */

import { $, $$, todayKey, addDays, longDay, humanDay } from './utils.js';
import * as store from './store.js';
import * as vault from './vault.js';
import * as sync from './sync.js';
import * as badges from './badges.js';
import * as lembrete from './lembrete.js';
import { applyPalette } from './palettes.js';
import { toast, bindScramble, openSheet, closeSheet, stagger, motionOn, revelarAoRolar, observarTopo, fundoVivo } from './ui.js';
import { icon } from './icons.js';
import { avatar } from './avatar.js';
import { el, debounce } from './utils.js';

import * as viewToday from './views/today.js';
import * as viewMonth from './views/month.js';
import * as viewTodos from './views/todos.js';
import * as viewInsights from './views/insights.js';
import * as viewMetas from './views/metas.js';
import * as viewPerfil from './views/perfil.js';
import * as viewResumo from './views/resumo.js';
import * as viewRevisao from './views/revisao.js';
import * as viewSettings from './views/settings.js';
import { abrirPaleta } from './views/paleta.js';

const VIEWS = {
  hoje: viewToday, mes: viewMonth, lista: viewTodos, metas: viewMetas,
  insights: viewInsights, ajustes: viewSettings, perfil: viewPerfil,
  resumo: viewResumo, revisao: viewRevisao,
};
/* embaixo fica a rotina; o resto se alcança pelo topo e pelo menu */
/* Metas saiu da barra e Insights entrou. Meta se ajusta uma vez por semana —
   e já se ajusta dentro da Revisão, com − e + ao lado do resultado. Padrões é
   o que se abre à toa. Os atalhos do ícone instalado já diziam isso. */
const PRIMARIAS = ['hoje', 'mes', 'lista', 'insights'];

/* ── Contexto compartilhado entre as telas ─────────────────── */
const ctx = {
  view: 'hoje',
  day: todayKey(),
  range: 30,
  todoTab: 'abertas',
  monthFilter: null,
  monthMode: 'mes',
  weekAnchor: null,
  go(v) {
    if (!VIEWS[v] || v === ctx.view) return;
    history.pushState({ view: v }, '');
    ctx.view = v;
    paint();
  },
  /* volta pela pilha do navegador — o botão físico do Android também serve */
  voltar() {
    if (history.state?.view && history.state.view !== 'hoje') history.back();
    else { ctx.view = PRIMARIAS[0]; history.replaceState({ view: PRIMARIAS[0] }, ''); paint(); }
  },
  pintaTopo() { pintaIdentidade(); },
  setDay(k) { ctx.day = k; if (ctx.view === 'hoje') paint(); },
  rerender() { paint(); },
  lock() { doLock(); },
};

let medirFundo = () => {};

/* ── Pintura ───────────────────────────────────────────────── */
function paint() {
  const main = $('#main');
  ctx.softRefresh = null;              // cada tela instala o seu, se quiser
  if (ctx.view !== 'resumo') document.body.classList.remove('modo-imersivo');
  if (ctx.view !== 'revisao') ctx.revisaoSemana = null;   // não guarda semana de ontem
  if (ctx.view !== 'lista') ctx.pessoalMes = null;        // nem mês de ontem
  main.replaceChildren(VIEWS[ctx.view].render(ctx));
  main.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'auto' });   // antes de medir a dobra
  revelarAoRolar(main);

  $$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === ctx.view));
  document.body.classList.toggle('em-secundaria', !PRIMARIAS.includes(ctx.view));
  pintaIdentidade();

  medirFundo();          // a tela nova tem outra altura: o fundo recalcula
  const largo = window.matchMedia('(min-width:700px)').matches;
  $('#topDate').textContent = ctx.view === 'hoje'
    ? (largo ? longDay(ctx.day) : humanDay(ctx.day))
    : PRIMARIAS.includes(ctx.view) ? humanDay(todayKey()) : '';
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
  history.replaceState({ view: ctx.view }, '');
  paint();
  armAutolock();
  paintSync(sync.getStatus());
  lembrete.atualizar();

  if (lembrete.pendenteAgora()) {
    setTimeout(() => toast('passou da hora e ainda falta marcar', {
      action: 'marcar', ms: 7000, onAction: () => { ctx.setDay(todayKey()); ctx.go('hoje'); },
    }), 900);
  }

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
  else if (v === 'rapido') ctx.view = 'hoje';   // avisos antigos ainda apontam pra cá
  else if (v === 'agenda') { ctx.view = 'lista'; ctx.pessoalAba = 'contas'; }
  else if (v === 'lista') { ctx.view = 'lista'; ctx.pessoalAba = 'tarefas'; }
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
    b.addEventListener('click', () => {
      if (b.dataset.view === 'hoje' && ctx.view === 'hoje') { ctx.day = todayKey(); paint(); return; }
      ctx.go(b.dataset.view);
    });
  });
  observarTopo();
  medirFundo = fundoVivo();
  $('#identBtn').addEventListener('click', () => {
    if (PRIMARIAS.includes(ctx.view)) ctx.go('perfil');
    else ctx.voltar();
  });
  $('#menuBtn').append(icon('menu', 18));
  $('#menuBtn').addEventListener('click', menuSheet);

  window.addEventListener('popstate', e => {
    const v = e.state?.view;
    if (!v || !VIEWS[v] || $('#app').hidden) return;
    ctx.view = v;
    paint();
  });

  document.addEventListener('keydown', e => {
    if ($('#app').hidden) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const keys = { 1: 'hoje', 2: 'mes', 3: 'lista', 4: 'metas', 5: 'insights', 6: 'ajustes', 7: 'perfil', 8: 'resumo', 9: 'revisao' };
    if (keys[e.key]) { ctx.go(keys[e.key]); return; }
    if (e.key === 'Escape' && ctx.view !== 'hoje' && $('#sheet').hidden) { ctx.voltar(); return; }
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
    if (reason === 'profile') pintaIdentidade();
    if (['day', 'categories', 'replace', 'settings'].includes(reason)) lembrete.atualizar();
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

/* ── Identidade no topo ────────────────────────────────────── */
const NOME_DA_TELA = {
  ajustes: 'Ajustes', perfil: 'Perfil', resumo: 'Retrospectiva',
  revisao: 'Revisão da semana', metas: 'Metas',
};

/* Em tela secundária a barra de cima troca de papel: em vez de "quem sou eu",
   ela responde "onde estou e como saio". Antes dizia "Caderno · HOJE" mesmo
   quando você estava na carteira de julho, e a única saída era o botão de
   voltar lá do topo do conteúdo — que some assim que você rola. */
function pintaIdentidade() {
  const secundaria = !PRIMARIAS.includes(ctx.view);
  const btn = $('#identBtn');
  const av = $('#identAv');
  const nome = $('#identNome');

  if (av) {
    av.replaceChildren(secundaria
      ? el('span.ident__voltar', { text: '←', 'aria-hidden': 'true' })
      : avatar(30));
  }
  if (nome) {
    const p = store.state.profile || {};
    nome.textContent = secundaria
      ? (NOME_DA_TELA[ctx.view] || 'Caderno')
      : (p.nome?.trim() || 'Caderno');
  }
  if (btn) {
    btn.setAttribute('aria-label', secundaria ? 'Voltar' : 'Seu perfil');
    btn.title = secundaria ? 'Voltar' : 'Seu perfil';
  }
  btn?.classList.toggle('is-active', ctx.view === 'perfil');
}

/* ── Menu ──────────────────────────────────────────────────── */
function menuSheet() {
  openSheet('Menu', close => {
    const ir = v => { close(); ctx.go(v); };
    const grupo = (titulo, itens) => el('div.menugrupo', {}, [
      el('p.micro', { text: titulo }),
      el('div.menulista', {}, itens.filter(Boolean)),
    ]);
    /* Uma linha por item, sem descrição: com dez cartões de duas linhas, três
       itens nasciam fora da tela num menu que você já conhece de cor. */
    const item = (ic, titulo, onclick) => el('button.menuitem', { type: 'button', onclick }, [
      el('span.menuitem__i', {}, [icon(ic, 18)]),
      el('span.row__t', { text: titulo }),
      el('span.atalho__seta', { text: '→' }),
    ]);

    /* Perfil, Insights e Metas saíram: os três já estão a um toque no avatar,
       no ícone do topo e na barra de baixo. Caderno 2.0 e a grade de paleta
       vivem em Ajustes. O menu é o que NÃO tem outra porta. */
    return [
      grupo('LEITURA', [
        item('estrela', 'Retrospectiva', () => ir('resumo')),
        item('revisao', 'Revisão da semana', () => ir('revisao')),
      ]),
      grupo('COBRANÇA', [
        item('metas', 'Metas e cobrança', () => ir('metas')),
      ]),
      grupo('CADERNO', [
        item('ajustes', 'Ajustes', () => ir('ajustes')),
        item('paleta', 'Paleta', () => { close(); abrirPaleta(() => paint()); }),
      ]),
      grupo('COFRE', [
        sync.configured() ? item('nuvem', 'Sincronizar agora', async () => {
          close();
          try { await sync.syncNow(); toast('sincronizado'); }
          catch (err) { toast(err.message, { ms: 5000 }); }
        }) : null,
        item('cadeado', 'Trancar', () => { close(); doLock(); }),
      ]),
    ];
  });
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
