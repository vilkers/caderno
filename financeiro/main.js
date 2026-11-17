import { addDays, el, humanDay, monthLabel, todayKey } from '../js/utils.js';
import { centralWalletPlan } from '../js/store.js';
import { addWalletItemForConnection, readWalletForConnection } from '../js/chatgpt.js';
import { monthOverview, parseCents } from './overview.js';
import { FINANCE_ACCESS, openTransfer } from '../js/companion-transfer.js';

import * as biometria from '../js/biometria.js';

const KEY = 'caderno.financeiro.acesso.v1';
const FACE_KEY = 'caderno.financeiro.face.v1';
const app = document.querySelector('#app');
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl = cents => {
  const value = BigInt(cents);
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? '−' : ''}${reais.format(abs / 100n)},${String(abs % 100n).padStart(2, '0')}`;
};
let access, revision, facePassword, lastActivity = 0;
let activeEntry, refreshing;

function render(...content) {
  document.body.classList.remove('entry');
  app.replaceChildren(el('h1', { text: 'Grana' }), ...content);
  app.scrollIntoView({ block: 'start' });
}

function login(forceSetup = false) {
  activeEntry = null;
  access = null;
  revision = null;
  facePassword = null;
  const saved = forceSetup ? null : localStorage.getItem(KEY);
  const password = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const code = el('textarea', { rows: 3, spellcheck: 'false', autocapitalize: 'none', required: true });
  const status = el('p.status', { role: 'status' });
  const submit = el('button.primary', { type: 'submit', text: saved ? 'Entrar' : 'Conectar Grana' });
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
      el('p.muted', { text: 'No Caderno instalado, vá em Ajustes → Dados dos outros apps → Conectar app Financeiro, escolha uma senha e copie o código cifrado.' }),
      el('label', {}, ['Código do Caderno', code]),
    ] : []),
    canUnlockWithFace ? face : null,
    el(canUnlockWithFace ? 'details.connection-settings' : 'div.stack', {}, [
      canUnlockWithFace ? el('summary', { text: 'Usar senha' }) : null,
      el('label', {}, [saved ? 'Senha do Grana' : 'Senha escolhida ao gerar o código', password]),
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

function percent(value, total) {
  return total ? Number(value * 10000n / total) / 100 : 0;
}

function flowRow(label, values, scale, type) {
  return el(`div.flow-row.${type}`, {}, [
    el('div.flow-label', {}, [el('strong', { text: label }), el('span.money', { text: brl(values.total) })]),
    el('div.flow-track', { 'aria-hidden': 'true' }, [
      el('span.flow-segment.settled', { style: { '--width': percent(values.settled, scale) + '%' } }),
      el('span.flow-segment.pending', { style: { '--width': percent(values.pending, scale) + '%' } }),
    ]),
    el('p.meta.muted', { text: `Realizado: ${brl(values.settled)} · Previsto: ${brl(values.pending)}` }),
  ]);
}

function monthFlow(wallet, overview) {
  const { income, expenses, undatedIncome, unpricedExpenses } = overview;
  const scale = income.total > expenses.total ? income.total : expenses.total;
  const excluded = [
    undatedIncome ? `${undatedIncome} recebimento(s) sem data` : '',
    unpricedExpenses ? `${unpricedExpenses} despesa(s) sem valor` : '',
  ].filter(Boolean);
  return el('section.panel.stack.flow-panel', {}, [
    el('div', {}, [el('p.eyebrow', { text: monthLabel(wallet.paymentMonth) }), el('h2', { text: 'Fluxo do mês' })]),
    scale > 0n ? el('div.flow-series', {}, [
      flowRow('Rendas', income, scale, 'income'),
      flowRow('Despesas', expenses, scale, 'expense'),
    ]) : el('p.muted', { text: 'Ainda não há valores para o gráfico deste mês.' }),
    excluded.length ? el('p.meta.muted', { text: `Fora do gráfico: ${excluded.join(' e ')}.` }) : null,
  ]);
}

function expensesChart(overview) {
  const total = overview.expenses.total;
  if (!total) return null;
  const chart = overview.largestPayments.map(item => [item.title, BigInt(item.amountCents)]);
  if (overview.otherPayments > 0n) chart.push(['Outras despesas', overview.otherPayments]);
  return el('section.panel.stack.spending-panel', {}, [
    el('div', {}, [
      el('h2', { text: 'Peso das despesas' }),
      el('p.meta.muted', { text: 'Participação no total de despesas registradas no mês' }),
    ]),
    el('ul.spending-list', {}, chart.map(([title, value]) => {
      const share = percent(value, total);
      return el('li', {}, [
        el('div.spending-name', {}, [
          el('span', { text: title }),
          el('span.money', { text: `${brl(value)} · ${share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` }),
        ]),
        el('div.spending-track', { 'aria-hidden': 'true' }, [
          el('span', { style: { '--width': share + '%' } }),
        ]),
      ]);
    })),
  ]);
}

function openWalletEntry(wallet, type, button) {
  if (!access || activeEntry) return;
  const isIncome = type === 'receivables';
  const label = isIncome ? 'renda' : 'despesa';
  const title = el('input', { type: 'text', name: 'title', maxlength: 120, required: true, autofocus: true });
  const amount = el('input', { type: 'text', name: 'amount', inputmode: 'decimal', placeholder: '0,00', maxlength: 24, required: true });
  const currentMonth = wallet.paymentMonth;
  const date = el('input', { type: 'date', name: 'date' });
  const today = todayKey();
  if (!isIncome) {
    const first = `${currentMonth}-01`;
    const [year, month] = currentMonth.split('-').map(Number);
    const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    date.min = first;
    date.max = addDays(`${nextMonth}-01`, -1);
  }
  if (isIncome || today.startsWith(currentMonth + '-')) date.value = today;
  const status = el('select', { name: 'status' }, [
    el('option', { value: 'pending', text: isIncome ? 'A receber' : 'A pagar' }),
    el('option', { value: isIncome ? 'received' : 'paid', text: isIncome ? 'Recebida' : 'Paga' }),
  ]);
  const receipt = el('p.status', { role: 'status' });
  const save = el('button.primary', { type: 'submit', text: `Salvar ${label}` });
  const cancel = el('button', { type: 'button', text: 'Cancelar', onclick: () => dialog.close() });
  const connection = access;
  const id = `grana-${crypto.randomUUID()}`;
  let saving = false;
  const active = () => access === connection && dialog.isConnected;
  const controls = [title, amount, date, status, save, cancel];
  const dialog = el('dialog.wallet-entry', { 'aria-labelledby': 'wallet-entry-title',
    oncancel: event => { if (saving) event.preventDefault(); },
    onclose: () => {
      if (activeEntry === dialog) activeEntry = null;
      dialog.remove();
      if (button.isConnected) button.focus();
    },
  }, [el('form.stack', { onsubmit: async event => {
    event.preventDefault();
    if (saving || !active()) return;
    receipt.classList.remove('error');
    const amountCents = parseCents(amount.value);
    if (!amountCents || !title.value.trim()) {
      receipt.classList.add('error');
      receipt.textContent = 'Preencha a descrição e um valor maior que zero.';
      (!title.value.trim() ? title : amount).focus();
      return;
    }
    const item = { id, title: title.value.trim(), amountCents, date: date.value || null, status: status.value };
    saving = true;
    controls.forEach(control => { control.disabled = true; });
    receipt.textContent = 'Salvando na Carteira…';
    try {
      const record = await addWalletItemForConnection(connection, type, item, active);
      if (!active()) return;
      revision = record.sha;
      dialog.close();
      showWallet(centralWalletPlan(record.data), isIncome ? 'Renda registrada.' : 'Despesa registrada.');
      app.querySelector('#wallet-feedback')?.focus();
    } catch (error) {
      if (!active()) return;
      receipt.classList.add('error');
      receipt.textContent = error.message || 'Não consegui confirmar o lançamento. Tente novamente neste formulário.';
    } finally {
      saving = false;
      controls.forEach(control => { control.disabled = false; });
    }
  } }, [
    el('h2', { id: 'wallet-entry-title', text: `Adicionar ${label}` }),
    el('label', {}, ['Descrição', title]),
    el('label', {}, ['Valor em reais', amount]),
    el('div.wallet-entry-fields', {}, [el('label', {}, ['Data', date]), el('label', {}, ['Situação', status])]),
    el('p.meta.muted', { text: isIncome ? 'O lançamento entra nos recebimentos e o saldo segue a data de referência da Carteira.'
      : `Contas de ${monthLabel(currentMonth)}. O lançamento entra nas despesas e o saldo segue a data de referência da Carteira.` }),
    el('div.actions', {}, [save, cancel]),
    receipt,
  ])]);
  app.append(dialog);
  activeEntry = dialog;
  dialog.showModal();
}

function showWallet(wallet, message = '') {
  const total = BigInt(wallet.balance) + BigInt(wallet.invested);
  const overview = monthOverview(wallet);
  const feedback = el('p.status.wallet-feedback', { id: 'wallet-feedback', role: 'status', tabindex: -1, text: message });
  const refresh = el('button', { type: 'button', text: 'Atualizar Carteira', onclick: async () => {
    refresh.disabled = true;
    feedback.classList.remove('error');
    feedback.textContent = 'Consultando a Carteira…';
    try {
      if (!(await refreshWallet('Carteira atualizada.'))) feedback.textContent = 'Carteira conferida.';
    } catch (error) { feedback.classList.add('error'); feedback.textContent = error.message; }
    finally { refresh.disabled = false; }
  } });
  const addIncome = el('button.wallet-add.income', { type: 'button', onclick: () => openWalletEntry(wallet, 'receivables', addIncome) }, [
    el('span.wallet-add-icon', { 'aria-hidden': 'true', text: '+' }), 'Adicionar renda',
  ]);
  const addExpense = el('button.wallet-add.expense', { type: 'button', onclick: () => openWalletEntry(wallet, 'payments', addExpense) }, [
    el('span.wallet-add-icon', { 'aria-hidden': 'true', text: '+' }), 'Adicionar despesa',
  ]);
  const next = overview.nextPayment;
  render(el('div.stack.wallet-layout', {}, [
    el('section.summary.wallet-summary', {}, [
      el('p.eyebrow', { text: 'Patrimônio total' }),
      el('strong', { text: brl(total) }),
      el('p.wallet-date', { text: `Saldo de referência · ${humanDay(wallet.date)}` }),
      el('div.balances.wallet-balances', {}, [
        el('div', {}, [el('p.eyebrow', { text: wallet.balanceEstimated ? 'Em conta · estimado' : 'Em conta' }), el('p.balance-value', { text: brl(wallet.balance) })]),
        el('div', {}, [el('p.eyebrow', { text: 'Investido' }), el('p.balance-value', { text: brl(wallet.invested) })]),
      ]),
    ]),
    el('div.wallet-shortcuts', { role: 'group', 'aria-label': 'Lançamentos rápidos' }, [addIncome, addExpense]),
    feedback,
    next ? el('section.panel.wallet-due', {}, [
      el('div', {}, [
        el('p.eyebrow', { text: next.date < todayKey() ? 'Conta atrasada' : 'Próxima conta' }),
        el('p.wallet-due-title', { text: next.title }),
        el('p.meta.muted', { text: humanDay(next.date) }),
      ]),
      el('span.money', { text: next.amountCents === null ? 'A definir' : brl(next.amountCents) }),
    ]) : null,
    monthFlow(wallet, overview),
    expensesChart(overview),
    el('section.panel.stack', {}, [
      el('h2', { text: 'Recebimentos' }),
      ...itemRows(wallet.receivables, 'Recebido', 'Nenhum recebimento cadastrado.'),
    ]),
    el('section.panel.stack', {}, [el('h2', { text: `Contas de ${monthLabel(wallet.paymentMonth)}` }),
      ...itemRows(wallet.payments, 'Pago', 'Contas deste mês ainda não cadastradas.'),
    ]),
    el('div.actions.wallet-footer', {}, [refresh, facePassword && !biometria.armada(FACE_KEY) ? faceSetupButton(feedback) : null,
      el('button', { type: 'button', text: 'Trancar', onclick: () => login() })]),
  ]));
}

async function refreshWallet(message = '') {
  if (!access || activeEntry) return false;
  if (refreshing) return refreshing;
  const connection = access;
  const previousRevision = revision;
  refreshing = readWalletForConnection(connection).then(record => {
    if (access !== connection || activeEntry || revision !== previousRevision || record.sha === revision) return false;
    const wallet = centralWalletPlan(record.data);
    revision = record.sha;
    showWallet(wallet, message);
    return true;
  }).finally(() => { refreshing = null; });
  return refreshing;
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
