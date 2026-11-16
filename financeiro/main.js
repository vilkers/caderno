import { el, humanDay, monthLabel, moeda } from '../js/utils.js';
import { centralWalletPlan } from '../js/store.js';
import { readWalletForConnection } from '../js/chatgpt.js';
import { FINANCE_ACCESS, openTransfer } from '../js/companion-transfer.js';

import * as biometria from '../js/biometria.js';

const KEY = 'caderno.financeiro.acesso.v1';
const FACE_KEY = 'caderno.financeiro.face.v1';
const app = document.querySelector('#app');
const brl = cents => moeda(cents / 100, { cents: 2 });
let access, revision, facePassword, lastActivity = 0;

function render(...content) {
  document.body.classList.remove('entry');
  app.replaceChildren(el('h1', { text: 'Financeiro' }), ...content);
  app.scrollIntoView({ block: 'start' });
}

function login(forceSetup = false) {
  access = null;
  revision = null;
  facePassword = null;
  const saved = forceSetup ? null : localStorage.getItem(KEY);
  const password = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const code = el('textarea', { rows: 3, spellcheck: 'false', autocapitalize: 'none', required: true });
  const status = el('p.status', { role: 'status' });
  const submit = el('button.primary', { type: 'submit', text: saved ? 'Entrar' : 'Conectar Financeiro' });
  async function unlock(useFace) {
    submit.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Abrindo a Carteira…';
    try {
      const envelope = saved || code.value.trim();
      const secret = useFace ? await biometria.entrar(FACE_KEY) : password.value;
      const connection = await openTransfer(envelope, secret, FINANCE_ACCESS);
      const record = await readWalletForConnection(connection);
      const wallet = centralWalletPlan(record.data);
      if (!form.isConnected) return;
      if (!saved) {
        localStorage.setItem(KEY, envelope);
        biometria.desarmar(FACE_KEY);
      }
      facePassword = biometria.armada(FACE_KEY) ? null : secret;
      password.value = '';
      code.value = '';
      access = connection;
      lastActivity = Date.now();
      revision = record.sha;
      showWallet(wallet);
    } catch (error) {
      status.classList.add('error');
      status.textContent = useFace && (['prf', 'selo', 'cancelado', 'desarmada'].includes(error.message) || ['NotAllowedError', 'NotSupportedError'].includes(error.name))
        ? faceError(error) : error.message;
    } finally { submit.disabled = face.disabled = false; }
  }
  const face = el('button.primary', { type: 'button', text: 'Entrar com Face ID', onclick: () => { face.disabled = true; unlock(true); } });
  const canUnlockWithFace = Boolean(saved && biometria.armada(FACE_KEY));
  const form = el('form.panel.stack', { onsubmit: event => { event.preventDefault(); face.disabled = true; unlock(false); } }, [
    ...(!saved ? [
      el('p.muted', { text: 'No Caderno instalado, vá em Pessoal → Carteira → Conectar app Financeiro, escolha uma senha e copie o código cifrado.' }),
      el('label', {}, ['Código do Caderno', code]),
    ] : []),
    canUnlockWithFace ? face : null,
    el(canUnlockWithFace ? 'details.connection-settings' : 'div.stack', {}, [
      canUnlockWithFace ? el('summary', { text: 'Usar senha' }) : null,
      el('label', {}, [saved ? 'Senha do Financeiro' : 'Senha escolhida ao gerar o código', password]),
      el('div.actions', {}, [submit, saved ? el('button', { type: 'button', text: 'Usar outro código', onclick: () => login(true) }) : null]),
    ]),
    status,
  ]);
  render(form);
  document.body.classList.add('entry');
}

function faceError(error) {
  if (error.message === 'prf' || error.name === 'NotSupportedError') return 'O Face ID não está disponível neste navegador. Use a senha do Grana.';
  if (error.name === 'NotAllowedError' || error.message === 'cancelado') return 'Face ID cancelado. Toque para tentar novamente.';
  return 'Não consegui abrir com Face ID. Entre com a senha do Grana.';
}

function faceSetupButton(status) {
  const connection = access;
  let pending;
  const button = el('button', { type: 'button', text: 'Ativar Face ID', onclick: async () => {
    button.disabled = true;
    try {
      const credential = pending ? await biometria.completarCredencial(pending) : await biometria.criarCredencial('Grana');
      if (access !== connection || !facePassword) return;
      if (credential.precisaSegundoToque) {
        pending = credential;
        button.textContent = 'Confirmar Face ID';
        return;
      }
      await biometria.guardar(facePassword, credential, FACE_KEY);
      if (access !== connection) return;
      facePassword = null;
      button.remove();
      status.textContent = 'Face ID ativado.';
    } catch (error) { status.textContent = faceError(error); }
    finally { button.disabled = false; }
  } });
  return button;
}

function itemRows(items, settled, emptyLabel) {
  if (!items.length) return [el('p.muted', { text: emptyLabel })];
  return items.map(item => el('div.row', {}, [
    el('div', {}, [
      el('p', { text: item.title }),
      el('p.meta.muted', { text: [item.status === 'pending' ? 'Pendente' : settled, item.date && humanDay(item.date)].filter(Boolean).join(' · ') }),
    ]),
    el('span.money', { text: item.amountCents === null ? 'A definir' : brl(item.amountCents) }),
  ]));
}

function showWallet(wallet) {
  const total = wallet.balance + wallet.invested;
  const incoming = wallet.receivables.filter(item => item.status === 'pending').reduce((sum, item) => sum + item.amountCents, 0);
  const status = el('p.status', { role: 'status' });
  const refresh = el('button', { type: 'button', text: 'Atualizar da Central', onclick: async () => {
    refresh.disabled = true;
    status.textContent = 'Consultando a Central…';
    try {
      if (!(await refreshWallet())) status.textContent = 'Carteira conferida.';
    } catch (error) { status.classList.add('error'); status.textContent = error.message; }
    finally { refresh.disabled = false; }
  } });
  render(el('div.stack', {}, [
    el('section.summary', {}, [
      el('p.eyebrow', { text: `Patrimônio em ${humanDay(wallet.date)}` }),
      el('strong', { text: brl(total) }),
      el('div.balances', {}, [
        el('div', {}, [el('p.eyebrow', { text: wallet.balanceEstimated ? 'Em conta · estimado' : 'Em conta' }), el('p.balance-value', { text: brl(wallet.balance) })]),
        el('div', {}, [el('p.eyebrow', { text: 'Investido' }), el('p.balance-value', { text: brl(wallet.invested) })]),
      ]),
    ]),
    el('section.panel.stack', {}, [
      el('h2', { text: 'Recebimentos' }),
      incoming ? el('p.muted', { text: `Após os recebimentos pendentes, antes das contas · ${brl(total + incoming)}` }) : null,
      ...itemRows(wallet.receivables, 'Recebido', 'Nenhum recebimento cadastrado.'),
    ]),
    el('section.panel.stack', {}, [el('h2', { text: `Contas de ${monthLabel(wallet.paymentMonth)}` }),
      ...itemRows(wallet.payments, 'Pago', 'Contas deste mês ainda não cadastradas.'),
    ]),
    el('div.actions', {}, [refresh, facePassword && !biometria.armada(FACE_KEY) ? faceSetupButton(status) : null, el('button', { type: 'button', text: 'Trancar', onclick: () => login() })]),
    status,
  ]));
}

async function refreshWallet() {
  if (!access) return false;
  const connection = access;
  const record = await readWalletForConnection(connection);
  if (access !== connection || record.sha === revision) return false;
  const wallet = centralWalletPlan(record.data);
  revision = record.sha;
  showWallet(wallet);
  return true;
}

function onReturn() {
  if (!access || document.hidden) return;
  if (Date.now() - lastActivity > 15 * 60000) { login(); return; }
  refreshWallet().catch(() => {});
}

for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => { lastActivity = Date.now(); });
document.addEventListener('visibilitychange', onReturn);
setInterval(onReturn, 60000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => {});
login();
