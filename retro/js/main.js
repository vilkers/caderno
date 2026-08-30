/* main.js — a máquina do Caderno 2.0: abertura, senha, HUD, roteador.

   Núcleo compartilhado com a versão clássica (../js/): mesmo cofre, mesmos
   dados, mesma sincronia. Aqui só muda a pele — e o som. */

import { todayKey, addDays, longDay } from '../../js/utils.js';
import * as store from '../../js/store.js';
import * as vault from '../../js/vault.js';
import * as sync from '../../js/sync.js';
import * as badges from '../../js/badges.js';
import { logStreak } from '../../js/analysis.js';
import { el, debounce } from '../../js/utils.js';

import * as sfx from './sfx.js';
import { sprite, animado } from './sprites.js';
import { $, $$, aviso, caixa, fecha } from './ui.js';
import { MUNDOS } from './views/opcoes.js';

import * as telaFase from './views/fase.js';
import * as telaMapa from './views/mapa.js';
import * as telaMissoes from './views/missoes.js';
import * as telaPlacar from './views/placar.js';
import * as telaOpcoes from './views/opcoes.js';

const TELAS = {
  fase: telaFase, mapa: telaMapa, missoes: telaMissoes,
  placar: telaPlacar, opcoes: telaOpcoes,
};

const ctx = {
  view: 'fase',
  day: todayKey(),
  range: 30,
  aba: 'abertas',
  weekAnchor: null,
  go(v) { if (TELAS[v]) { ctx.view = v; sfx.passo(); pinta(); } },
  setDay(k) { ctx.day = k; pinta(); },
  rerender() { pinta(); },
  lock() { trancar(); },
  aplicarMundo() { aplicarMundo(); },
};

/* ── Pintura ───────────────────────────────────────────────── */
function pinta() {
  const main = $('#main');
  main.replaceChildren(TELAS[ctx.view].render(ctx));
  $$('.dpad__b').forEach(b => b.classList.toggle('is-active', b.dataset.view === ctx.view));
  pintaHud();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function pintaHud() {
  const b = badges.summary();
  $('#hudXp').textContent = String(b.xp).padStart(6, '0');
  $('#hudMoedas').textContent = `×${String(b.ganhas).padStart(2, '0')}`;
  $('#hudMundo').textContent = `${b.level.i + 1}-1`;
  $('#hudSeq').textContent = String(Math.min(99, logStreak())).padStart(2, '0');
  const icone = $('#hudMoedaIcone');
  if (icone && !icone.childElementCount) icone.append(animado('moeda_a', 'moeda_b', { scale: 2, ms: 420 }));
}
function aplicarMundo() {
  const id = store.state.settings.mundo || 'dia';
  document.documentElement.dataset.mundo = id;
  const m = MUNDOS.find(x => x.id === id) || MUNDOS[0];
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = m.ceu;
  vault.writeMeta({ mundo: id });
}

/* ── Senha ─────────────────────────────────────────────────── */
function montaSenha() {
  const novo = !vault.hasVault();
  const meta = vault.readMeta();
  $('#lockConfirmField').hidden = !novo;
  $('#lockBtn').textContent = novo ? 'COMEÇAR' : 'START';
  $('#lockSub').textContent = novo
    ? 'Escolha uma senha. Ela cifra tudo neste aparelho.'
    : 'Tudo cifrado neste aparelho.';
  $('#lockHint').textContent = novo ? '' : (meta.hint ? `DICA: ${meta.hint}` : '');
  const cad = $('#lockCad');
  if (!cad.childElementCount) cad.append(sprite('cadeado', { scale: 4 }));
  $('#lock').hidden = false;

  $('#lockForm').onsubmit = async e => {
    e.preventDefault();
    const err = $('#lockError');
    const senha = $('#lockPass').value;
    err.textContent = '';
    if (!vault.supported()) { err.textContent = 'PRECISA DE HTTPS'; return; }
    const bt = $('#lockBtn');
    bt.disabled = true;
    try {
      if (novo) {
        if (senha.length < 4) throw new Error('curta');
        if (senha !== $('#lockPass2').value) throw new Error('confirma');
        await store.createVault(senha);
        sfx.fase();
      } else {
        await store.unlockVault(senha);
        sfx.powerup();
      }
      entra();
    } catch (ex) {
      sfx.erro();
      err.textContent = {
        curta: 'MÍNIMO 4 CARACTERES',
        confirma: 'AS SENHAS NÃO BATEM',
        senha: 'SENHA ERRADA',
      }[ex.message] || 'NÃO ABRIU';
      $('#lockPass').select();
    } finally {
      bt.disabled = false;
    }
  };
}

function entra() {
  sfx.mudo(store.state.settings.som === false);
  document.documentElement.dataset.motion = store.state.settings.motion === false ? 'off' : 'on';
  aplicarMundo();
  $('#lockPass').value = '';
  $('#lockPass2').value = '';
  $('#lock').hidden = true;
  $('#app').hidden = false;
  ctx.day = todayKey();
  ctx.view = 'fase';
  pinta();
  armaTrava();
  atualizaSomBtn();

  if (sync.configured()) {
    sync.pullAndMerge()
      .then(r => { if (r.merged) { pinta(); aviso('DADOS DO REPOSITÓRIO'); } })
      .then(() => sync.syncNow({ silent: true }))
      .catch(e => aviso(String(e.message).slice(0, 40).toUpperCase(), { ms: 4000 }));
  }
}

function trancar() {
  store.flush();
  if (sync.configured()) sync.syncNow({ silent: true }).catch(() => {});
  store.lockVault();
  fecha();
  $('#app').hidden = true;
  $('#main').replaceChildren();
  montaSenha();
  sfx.pausa();
}

/* ── Trava automática ──────────────────────────────────────── */
let ocioso, escondidoEm = 0;
function armaTrava() {
  const reset = () => {
    clearTimeout(ocioso);
    const min = store.state.settings.autolock;
    if (!min || !store.isUnlocked()) return;
    ocioso = setTimeout(() => { if (store.isUnlocked()) trancar(); }, min * 60000);
  };
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, reset, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { escondidoEm = Date.now(); store.flush(); }
    else if (escondidoEm && store.isUnlocked()) {
      const min = store.state.settings.autolock;
      if (min && Date.now() - escondidoEm > min * 60000) trancar();
    }
  });
  reset();
}

/* ── Conquistas ────────────────────────────────────────────── */
const confereTrofeus = debounce(() => {
  if (!store.isUnlocked()) return;
  const novas = badges.claim();
  const resumo = badges.summary();
  const subiu = resumo.level.i > (store.state.levelSeen || 0);
  if (!novas.length && !subiu) return;
  if (subiu) store.state.levelSeen = resumo.level.i;
  store.emit('badges');
  pintaHud();

  if (subiu) {
    sfx.vida1up();
    caixa('NOVO MUNDO', close => [
      el('div', { style: { display: 'grid', justifyItems: 'center', gap: '12px', textAlign: 'center' } }, [
        sprite('estrela', { scale: 4 }),
        el('p.t12', { style: { color: 'var(--ouro)' }, text: resumo.level.name.toUpperCase() }),
        el('p', { style: { fontSize: '15px' }, text: resumo.level.lore }),
        el('p.t8', { style: { color: 'var(--tinta2)' }, text: `MUNDO ${resumo.level.i + 1}-1 · ${resumo.xp} XP` }),
      ]),
      el('div.modal__acoes', {}, [
        el('button.btn', { type: 'button', text: 'PLACAR', onclick: () => { close(); ctx.go('placar'); } }),
        el('button.btn.btn--v', { type: 'button', text: 'VALEU', onclick: close }),
      ]),
    ]);
  } else {
    sfx.powerup();
    aviso(`TROFÉU: ${novas[0].name.toUpperCase()}`, {
      acao: 'VER', aoClicar: () => ctx.go('placar'),
    });
  }
}, 900);

/* ── Botões fixos ──────────────────────────────────────────── */
function atualizaSomBtn() {
  const on = store.state.settings.som !== false;
  $('#somBtn').classList.toggle('is-off', !on);
  $('#somBtn').textContent = on ? '♪' : '×';
  sfx.mudo(!on);
}

function liga() {
  $$('.dpad__b').forEach(b => b.addEventListener('click', () => ctx.go(b.dataset.view)));
  $('#trancarBtn').addEventListener('click', trancar);
  $('#somBtn').addEventListener('click', () => {
    const on = store.state.settings.som === false;   // vai virar o oposto
    store.setSetting('som', on);
    atualizaSomBtn();
    if (on) sfx.moeda();
  });

  document.addEventListener('keydown', e => {
    if ($('#app').hidden) return;
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (digitando || e.metaKey || e.ctrlKey || e.altKey) return;
    const mapa = { 1: 'fase', 2: 'mapa', 3: 'missoes', 4: 'placar', 5: 'opcoes' };
    if (mapa[e.key]) return ctx.go(mapa[e.key]);
    if (ctx.view === 'fase') {
      if (e.key === 'ArrowLeft') ctx.setDay(addDays(ctx.day, -1));
      if (e.key === 'ArrowRight') ctx.setDay(addDays(ctx.day, 1));
      if (e.key.toLowerCase() === 't') ctx.setDay(todayKey());
    }
    if (e.key.toLowerCase() === 'l') trancar();
  });

  window.addEventListener('pagehide', () => store.flush());
  store.subscribe(reason => { if (reason !== 'badges') { confereTrofeus(); pintaHud(); } });
  sync.start();
}

/* ── Arranque ──────────────────────────────────────────────── */
function arranca() {
  const meta = vault.readMeta();
  document.documentElement.dataset.mundo = meta.mundo || 'dia';
  $('#bootHeroi').append(animado('heroi_a', 'heroi_b', { scale: 4 }));
  liga();
  montaSenha();

  const boot = $('#boot');
  const sair = () => {
    boot.classList.add('sai');
    setTimeout(() => boot.remove(), 320);
    if (window.matchMedia('(min-width:720px)').matches) $('#lockPass').focus();
  };
  const t = setTimeout(sair, 1600);
  boot.addEventListener('click', () => { clearTimeout(t); sair(); }, { once: true });
  document.addEventListener('keydown', () => { clearTimeout(t); sair(); }, { once: true });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

arranca();
