/* main.js — arranque, tela de senha, roteador e atalhos */

import { $, $$, todayKey, addDays, longDay, humanDay } from './utils.js';
import * as store from './store.js';
import * as vault from './vault.js';
import * as biometria from './biometria.js';
import * as sync from './sync.js';
import * as chatGPT from './chatgpt.js';
import * as lembrete from './lembrete.js';
import { applyPalette } from './palettes.js';
import { toast, bindScramble, openSheet, closeSheet, motionOn, revelarAoRolar, observarTopo, fundoVivo } from './ui.js';
import { icon } from './icons.js';
import { avatar } from './avatar.js';
import { el } from './utils.js';

import * as viewToday from './views/today.js';
import * as viewMonth from './views/month.js';
import * as viewTodos from './views/todos.js';
import * as viewInsights from './views/insights.js';
import * as viewMetas from './views/metas.js';
import * as viewPerfil from './views/perfil.js';
import * as viewResumo from './views/resumo.js';
import * as viewRevisao from './views/revisao.js';
import * as viewFechaMes from './views/fechames.js';
import * as viewSettings from './views/settings.js';

const VIEWS = {
  hoje: viewToday, mes: viewMonth, legado: viewTodos, metas: viewMetas,
  insights: viewInsights, ajustes: viewSettings, perfil: viewPerfil,
  resumo: viewResumo, revisao: viewRevisao, fechames: viewFechaMes,
};
const PRIMARIAS = ['hoje', 'mes', 'insights'];

/* ── Contexto compartilhado entre as telas ─────────────────── */
const ctx = {
  view: 'hoje',
  day: todayKey(),
  range: 30,
  monthFilter: null,
  monthMode: 'mes',
  weekAnchor: null,
  go(v) {
    if (!VIEWS[v] || v === ctx.view) return;
    const rumo = rumoEntre(ctx.view, v);
    history.pushState({ view: v }, '');
    ctx.view = v;
    paint({ rumo });
  },
  /* volta pela pilha do navegador — o botão físico do Android também serve */
  voltar() {
    if (history.state?.view && history.state.view !== 'hoje') history.back();
    else { ctx.view = PRIMARIAS[0]; history.replaceState({ view: PRIMARIAS[0] }, ''); paint({ rumo: 'topo' }); }
  },
  pintaTopo() { pintaIdentidade(); },
  /* Andar no tempo anda na tela: ontem entra pela esquerda, amanhã pela
     direita. É a mesma direção do dedo que arrasta a faixa de dias. */
  setDay(k) {
    const rumo = k > ctx.day ? 'esquerda' : k < ctx.day ? 'direita' : null;
    ctx.day = k;
    if (ctx.view === 'hoje') paint({ rumo });
  },
  rerender() { paint(); },
  lock() { doLock(); },
};

let medirFundo = () => {};

/* ── Pintura ───────────────────────────────────────────────── */

/**
 * Para onde a tela vai. Entre as três telas de baixo é lateral, na ordem em que
 * elas aparecem na barra; entrar numa tela secundária afunda e sair dela
 * sobe. O movimento passa a dizer onde você está indo — antes toda troca era
 * o mesmo wipe, que não informava nada.
 */
function rumoEntre(de, para) {
  const a = PRIMARIAS.indexOf(de), b = PRIMARIAS.indexOf(para);
  if (a >= 0 && b >= 0) return b > a ? 'esquerda' : 'direita';
  return b < 0 ? 'fundo' : 'topo';
}

function paint(opts = {}) {
  const trocar = () => pintarAgora();
  const raiz = document.documentElement;
  /* Sem suporte, sem rumo, ou com movimento desligado: troca seca, como era.
     A transição é enfeite — a tela tem que aparecer de qualquer jeito. */
  if (!opts.rumo || !document.startViewTransition || !motionOn()) return trocar();
  raiz.dataset.vt = opts.rumo;
  const t = document.startViewTransition(trocar);
  t.finished.finally(() => { delete raiz.dataset.vt; }).catch(() => {});
}

function pintarAgora() {
  const main = $('#main');
  ctx.softRefresh = null;              // cada tela instala o seu, se quiser
  if (ctx.view !== 'resumo') document.body.classList.remove('modo-imersivo');
  if (ctx.view !== 'revisao') ctx.revisaoSemana = null;   // não guarda semana de ontem
  if (ctx.view !== 'legado') ctx.pessoalMes = null;
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
  prepararFaceId(isNew);

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

/**
 * O botão do rosto só aparece quando há cofre neste aparelho E ele foi
 * armado nos ajustes. Nada de tentar sozinho ao abrir a tela: o Safari exige
 * gesto do usuário pra pedir o rosto, e um pedido negado silenciosamente
 * seria pior que botão nenhum.
 */
function prepararFaceId(isNew) {
  const btn = $('#lockFace');
  btn.hidden = isNew || !biometria.armada();
  if (btn.hidden) return;
  btn.onclick = async () => {
    const err = $('#lockError');
    err.textContent = '';
    btn.disabled = true;
    btn.querySelector('span').textContent = 'CONFERINDO…';
    try {
      await store.unlockVault(await biometria.entrar());
      enterApp();
    } catch (ex) {
      /* O nome do erro vai pra tela quando não é um caso conhecido: "não
         consegui" não dá pra depurar de longe, e é o aparelho dele que sabe. */
      err.textContent = {
        cancelado: 'Face ID cancelado.',
        prf: 'Este aparelho não devolveu a chave. Entre com a senha.',
        selo: 'A senha mudou desde que o Face ID foi ligado. Entre com a senha e ligue de novo.',
        senha: 'A senha guardada não abre mais o cofre. Entre com a senha.',
      }[ex.name === 'NotAllowedError' ? 'cancelado' : ex.message]
        || `Face ID falhou: ${ex.name || ''} ${ex.message || ''}`.trim();
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'ENTRAR COM FACE ID';
    }
  };
}

function enterApp() {
  const carteira = new URLSearchParams(location.hash.slice(1)).get('carteira');
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
  if (carteira) {
    ctx.view = 'legado';
    history.replaceState(null, '', location.pathname);
  }
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

  const afterSync = () => {
    refreshChatGPT();
    if (!carteira || !store.isUnlocked()) return;
    try { viewTodos.mostrarImportacaoCarteira(JSON.parse(carteira), ctx); }
    catch { toast('Link da Carteira inválido.'); }
  };
  if (sync.configured()) {
    sync.pullAndMerge()
      .then(r => { if (r.merged) { paint(); toast('dados do repositório trazidos'); } })
      .then(() => sync.syncNow({ silent: true }))
      .catch(err => toast(err.message, { ms: 5000 }))
      .finally(afterSync);
  } else {
    afterSync();
  }
}

let refreshChatGPT;

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

/** Atalhos do app instalado: ./?v=hoje | semana | insights */
function aplicarAtalhoDaURL() {
  const v = new URLSearchParams(location.search).get('v');
  if (!v) return;
  if (v === 'semana') { ctx.view = 'mes'; ctx.monthMode = 'semana'; }
  else if (v === 'rapido') ctx.view = 'hoje';   // avisos antigos ainda apontam pra cá
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
    const keys = { 1: 'hoje', 2: 'mes', 3: 'insights', 4: 'metas', 5: 'insights', 6: 'ajustes', 7: 'perfil', 8: 'resumo', 9: 'revisao' };
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
  refreshChatGPT = chatGPT.start(() => {
    paint();
    toast('check-in do ChatGPT registrado');
  }, () => { if (ctx.view === 'legado') paint(); });
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

/* ── Identidade no topo ────────────────────────────────────── */
const NOME_DA_TELA = {
  ajustes: 'Ajustes', perfil: 'Perfil', resumo: 'Retrospectiva',
  revisao: 'Revisão da semana', metas: 'Metas',
  fechames: 'Revisão do mês', legado: 'Dados anteriores',
};

/* Na tela secundária, o topo indica o destino e oferece o botão Voltar. */
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

    return [
      grupo('REVISÃO', [
        item('estrela', 'Retrospectiva', () => ir('resumo')),
        item('revisao', 'Revisão da semana', () => ir('revisao')),
        item('balanco', 'Revisão do mês', () => ir('fechames')),
        item('metas', 'Metas', () => ir('metas')),
      ]),
      grupo('CADERNO', [
        item('ajustes', 'Ajustes', () => ir('ajustes')),

        sync.configured() ? item('nuvem', 'Sincronizar agora', async () => {
          close();
          try { await sync.syncNow(); toast('sincronizado'); }
          catch (err) { toast(err.message, { ms: 5000 }); }
        }) : null,
        item('cadeado', 'Trancar', () => { close(); doLock(); }),
      ]),
      grupo('OUTROS APPS', [
        el('a.menuitem', { href: './tarefas/' }, [
          el('span.menuitem__i', {}, [icon('lista', 18)]),
          el('span.row__t', { text: 'Tarefas' }),
          el('span.atalho__seta', { text: '→' }),
        ]),
        el('a.menuitem', { href: './financeiro/' }, [
          el('span.menuitem__i', {}, [icon('balanco', 18)]),
          el('span.row__t', { text: 'Grana' }),
          el('span.atalho__seta', { text: '→' }),
        ]),
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
  const shortcut = new URLSearchParams(location.search).get('v');
  const hasWalletUpdate = new URLSearchParams(location.hash.slice(1)).has('carteira');
  if (!hasWalletUpdate && (shortcut === 'lista' || shortcut === 'agenda')) {
    location.replace(shortcut === 'lista' ? './tarefas/' : './financeiro/');
    return;
  }
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
