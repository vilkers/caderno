import { el, humanDay, monthLabel, moeda } from '../js/utils.js';
import { centralWalletPlan } from '../js/store.js';
import { readWalletForConnection } from '../js/chatgpt.js';
import { FINANCE_ACCESS, openTransfer } from '../js/companion-transfer.js';

const KEY = 'caderno.financeiro.acesso.v1';
const app = document.querySelector('#app');
const brl = cents => moeda(cents / 100, { cents: 2 });
let access, revision, lastActivity = 0;

function render(...content) {
  app.replaceChildren(el('h1', { text: 'Financeiro' }), ...content);
  app.scrollIntoView({ block: 'start' });
}

function login(forceSetup = false) {
  access = null;
  revision = null;
  const saved = forceSetup ? null : localStorage.getItem(KEY);
  const password = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const code = el('textarea', { rows: 3, spellcheck: 'false', autocapitalize: 'none', required: true });
  const status = el('p.status', { role: 'status' });
  const submit = el('button.primary', { type: 'submit', text: saved ? 'Destrancar' : 'Conectar Financeiro' });
  const form = el('form.panel.stack', { onsubmit: async event => {
    event.preventDefault();
    submit.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Abrindo a Carteira…';
    try {
      const envelope = saved || code.value.trim();
      const connection = await openTransfer(envelope, password.value, FINANCE_ACCESS);
      const record = await readWalletForConnection(connection);
      const wallet = centralWalletPlan(record.data);
      if (!form.isConnected) return;
      if (!saved) localStorage.setItem(KEY, envelope);
      password.value = '';
      code.value = '';
      access = connection;
      lastActivity = Date.now();
      revision = record.sha;
      showWallet(wallet);
    } catch (error) {
      status.classList.add('error');
      status.textContent = error.message;
    } finally { submit.disabled = false; }
  } }, [
    el('h2', { text: saved ? 'Destrancar Carteira' : 'Conectar à Central' }),
    ...(!saved ? [
      el('p.muted', { text: 'No Caderno instalado, vá em Pessoal → Carteira → Conectar app Financeiro e copie o código cifrado.' }),
      el('label', {}, ['Código do Caderno', code]),
    ] : []),
    el('label', {}, ['Senha do Caderno', password]),
    el('div.actions', {}, [submit, saved ? el('button', { type: 'button', text: 'Usar outro código', onclick: () => login(true) }) : null]),
    status,
  ]);
  render(form);
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
    el('div.actions', {}, [refresh, el('button', { type: 'button', text: 'Trancar', onclick: () => login() })]),
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
login();
