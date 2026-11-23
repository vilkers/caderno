import { addDays, el, humanDay, monthLabel, todayKey } from '../js/utils.js';
import { centralWalletPlan } from '../js/store.js';
import { addWalletItemForConnection, readWalletForConnection, saveWalletSubscription, updateWalletPaymentForConnection, updateWalletIncomeForConnection } from '../js/chatgpt.js';
import { monthOverview, parseCents } from './overview.js';
import { bindQuickAdd, currencies, money as brl, movements, river, spendingCalendar, spendingBreakdown, subscriptions } from './experience.js';
import { normalizeSubscriptions } from './subscriptions.js';
import { FINANCE_ACCESS, openTransfer } from '../js/companion-transfer.js';

import * as biometria from '../js/biometria.js';

const KEY = 'caderno.financeiro.acesso.v1';
const FACE_KEY = 'caderno.financeiro.face.v1';
const app = document.querySelector('#app');
let access, revision, facePassword, lastActivity = 0;
let activeEntry, refreshing;
let view = 'fluxo', movementFilter = 'Todos', selectedMonth = todayKey().slice(0, 7);
const shiftMonth = (month, delta) => { const [year, number] = month.split('-').map(Number); return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7); };
const monthLimits = { min: '2026-11', max: '2027-01' };


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

function percent(value, total) {
  return total ? Number(value * 10000n / total) / 100 : 0;
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

function openWalletEntry(wallet, type, button, selected = null) {
  if (!access || activeEntry) return;
  const isIncome = type === 'receivables';

  const label = isIncome ? 'renda' : 'despesa';
  const title = el('input', { type: 'text', name: 'title', maxlength: 120, required: true, autofocus: true });
  const amount = el('input', { type: 'text', name: 'amount', inputmode: 'decimal', placeholder: '0,00', maxlength: 24, required: true });
  const currentMonth = selected?.month || selected?.date?.slice(0,7) || selectedMonth;
  const date = el('input', { type: 'date', name: 'date' });
  const today = todayKey();
  if (!isIncome) {
    const first = `${currentMonth}-01`;
    const [year, month] = currentMonth.split('-').map(Number);
    const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    date.min = first;
    date.max = addDays(`${nextMonth}-01`, -1);
  }
  if (isIncome && selectedMonth === today.slice(0,7) || !isIncome && today.startsWith(currentMonth + '-')) date.value = today;
  if (selected) { title.value = selected.title; amount.value = selected.amountCents == null ? '' : (selected.amountCents / 100).toFixed(2).replace('.', ','); date.value = selected.date || ''; }
  const status = el('select', { name: 'status' }, [
    el('option', { value: 'pending', text: isIncome ? 'A receber' : 'A pagar' }),
    el('option', { value: isIncome ? 'received' : 'paid', text: isIncome ? 'Recebida' : 'Paga' }),
  ]);
  if (selected) status.value = selected.status;
  const receipt = el('p.status', { role: 'status' });
  const save = el('button.primary', { type: 'submit', text: `Salvar ${label}` });
  const cancel = el('button', { type: 'button', text: 'Cancelar', onclick: () => dialog.close() });
  const connection = access;
  const id = selected?.id || `grana-${crypto.randomUUID()}`;
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
    const item = { id, title: title.value.trim(), amountCents, date: date.value || null, status: status.value, ...(!isIncome ? { month: selected?.month || currentMonth } : {}), ...(selected?.note ? { note: selected.note } : {}) };
    saving = true;
    controls.forEach(control => { control.disabled = true; });
    receipt.textContent = 'Salvando na Carteira…';
    try {
      const record = selected ? await (isIncome ? updateWalletIncomeForConnection(connection, item, selected, active) : updateWalletPaymentForConnection(connection, item, selected, active))
        : await addWalletItemForConnection(connection, type, item, active);
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
    el('h2', { id: 'wallet-entry-title', text: selected ? `Editar ${label}` : `Adicionar ${label}` }),
    el('label', {}, ['Descrição', title]),
    el('label', {}, ['Valor em reais', amount]),
    el('div.wallet-entry-fields', {}, [el('label', {}, ['Data', date]), el('label', {}, ['Situação', status])]),
    selected?.note ? el('p.meta.muted', { text: selected.note }) : null,
    el('p.meta.muted', { text: isIncome ? 'O lançamento entra nos recebimentos e o saldo segue a data de referência da Carteira.'
      : `Contas de ${monthLabel(currentMonth)}. O lançamento entra nas despesas e o saldo segue a data de referência da Carteira.` }),
    el('div.actions', {}, [save, cancel]),
    receipt,
  ])]);
  app.append(dialog);
  activeEntry = dialog;
  dialog.showModal();
}

function editSubscription(wallet, selected, from) {
  if (!access || activeEntry) return;
  const previous = selected ? normalizeSubscriptions([selected])[0] : null;
  const currency = el('select', {}, Object.entries(currencies).map(([key, text]) =>
    el('option', { value: key, text, selected: key === (previous?.currency || 'BRL') })));
  const title = el('input', { value: previous?.title || '', required: true, maxlength: 100, autofocus: true });
  const amount = el('input', { value: previous?.amountCents != null ? (previous.amountCents / 100).toFixed(2).replace('.', ',') : '', inputmode: 'decimal', placeholder: 'A definir', maxlength: 24 });
  const day = el('input', { type: 'number', min: 1, max: 31, step: 1, value: previous?.day || '', placeholder: 'A definir', inputmode: 'numeric' });
  const dataList = el('datalist', { id: 'grana-cards' }, [...new Set(wallet.subscriptions.map(item => item.card))].map(card => el('option', { value: card })));
  const card = el('input', { value: previous?.card || '', maxlength: 70, list: 'grana-cards', placeholder: 'A definir' });
  const state = el('select', {}, [
    el('option', { text: 'Ativa', value: 'active', selected: previous?.active !== false }),
    el('option', { text: 'Pausada', value: 'paused', selected: previous?.active === false }),
  ]);
  const status = el('p.status', { role: 'status' });
  const submit = el('button.primary', { type: 'submit', text: 'Salvar assinatura' });
  const cancel = el('button', { type: 'button', text: 'Cancelar', onclick: () => dialog.close() });
  const id = previous?.id || 'sub-' + crypto.randomUUID();
  const connection = access;
  const fields = [title, amount, currency, day, card, state, submit, cancel];
  let saving = false;
  const active = () => access === connection && dialog.isConnected;
  const dialog = el('dialog.wallet-entry', { 'aria-labelledby': 'subscription-title',
    oncancel: event => { if (saving) event.preventDefault(); },
    onclose: () => { if (activeEntry === dialog) activeEntry = null; dialog.remove(); if (from.isConnected) from.focus(); },
  }, [el('form.stack', { onsubmit: async event => {
    event.preventDefault();
    if (saving || !active()) return;
    status.classList.remove('error');
    try {
      const [item] = normalizeSubscriptions([{ id, title: title.value, amountCents: amount.value.trim() ? parseCents(amount.value) : null, currency: currency.value, day: day.value ? Number(day.value) : null, card: card.value, active: state.value === 'active' }]);
      saving = true;
      fields.forEach(field => { field.disabled = true; });
      status.textContent = 'Salvando na Carteira…';
      const record = await saveWalletSubscription(connection, item, previous, active);
      if (!active()) return;
      revision = record.sha;
      dialog.close();
      showWallet(centralWalletPlan(record.data), 'Assinatura salva.');
    } catch (error) {
      status.classList.add('error');
      status.textContent = error.message;
    } finally {
      saving = false;
      fields.forEach(field => { field.disabled = false; });
    }
  } }, [
    el('h2', { id: 'subscription-title', text: previous ? 'Editar assinatura' : 'Nova assinatura' }),
    el('label', {}, ['Serviço', title]),
    el('div.subscription-columns', {}, [el('label', {}, ['Valor mensal', amount]), el('label', {}, ['Moeda', currency])]),
    el('div.subscription-columns', {}, [el('label', {}, ['Dia da cobrança', day]), el('label', {}, ['Situação', state])]),
    el('label', {}, ['Apelido do cartão (opcional)', card, dataList]),
    el('p.meta.muted', { text: 'Sem valor, dia ou cartão? Deixe em branco para completar depois.' }),
    el('div.actions', {}, [submit, cancel]), status,
  ])]);
  app.append(dialog);
  activeEntry = dialog;
  dialog.showModal();
}

function showWallet(wallet, message = '') {
  const month = selectedMonth;
  const overview = monthOverview(wallet, month);
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
  const next = overview.nextPayment;
  const monthNav = el('div.month-nav', { role: 'group', 'aria-label': 'Selecionar mês' }, [
    el('button.month-arrow', { type: 'button', text: '‹', 'aria-label': 'Mês anterior', disabled: month <= monthLimits.min, onclick: () => { selectedMonth = shiftMonth(selectedMonth, -1); showWallet(wallet); } }),
    el('div.month-current', {}, [el('strong', { text: monthLabel(month) }), el('small', { text: month === todayKey().slice(0,7) ? 'Mês atual' : month > todayKey().slice(0,7) ? 'Planejamento' : 'Histórico' })]),
    el('button.month-arrow', { type: 'button', text: '›', 'aria-label': 'Próximo mês', disabled: month >= monthLimits.max, onclick: () => { selectedMonth = shiftMonth(selectedMonth, 1); showWallet(wallet); } }),
  ]);
  const launcher = el('details.finance-add-menu', {}, [
    el('summary', { 'aria-label': 'Novo lançamento', text: '+' }),
    el('div.finance-add-options', {}, [
      addButton('Adicionar renda', 'receivables', 'income'),
      addButton('Adicionar despesa', 'payments', 'expense'),
    ]),
  ]);
  bindQuickAdd(launcher);
  function addButton(text, type, tone) {
    const button = el('button.' + tone, { type: 'button', text, onclick: () => {
      launcher.open = false;
      openWalletEntry(wallet, type, launcher.querySelector('summary'));
    } });
    return button;
  }
  let content;
  if (view === 'assinaturas') {
    content = subscriptions(wallet.subscriptions, (item, trigger) => editSubscription(wallet, item, trigger));
  } else if (view === 'movimentos') {
    content = movements(wallet, movementFilter, filter => { movementFilter = filter; showWallet(wallet); }, () => { launcher.open = true; launcher.querySelector('button')?.focus(); }, item => openWalletEntry(wallet, 'payments', app.querySelector('.finance-nav'), item), item => openWalletEntry(wallet, 'receivables', app.querySelector('.finance-nav'), item), month);
  } else {
    content = el('section.stack', { 'aria-label': 'Fluxo' }, [
      el('section.panel.stack.balance-priority', {}, [
        el('p.eyebrow', { text: 'Posição confirmada · ' + humanDay(wallet.date) }),
        el('div.balance-primary', {}, [el('span', { text: 'Na conta' }), el('strong', { text: brl(wallet.balance) })]),
        el('div.balance-secondary', {}, [el('span', { text: 'Investimentos' }), el('strong', { text: brl(wallet.invested) })]),
        el('div.balance-secondary', {}, [el('span', { text: 'Patrimônio atual' }), el('strong', { text: brl(BigInt(wallet.balance) + BigInt(wallet.invested)) })]),
      ]),
      river(wallet, overview, month),
      overview.expenses.total > 0n ? spendingCalendar(wallet, month) : null,
      spendingBreakdown(wallet, month),
      wallet.receivables.some(item => item.status === 'pending' && (item.date === null || item.date.slice(0, 7) <= month))
        ? el('section.panel.stack', {}, [
          el('h2', { text: 'A receber' }),
          ...wallet.receivables.filter(item => item.status === 'pending' && (item.date === null || item.date.slice(0, 7) <= month)).map(item =>
            el('div.pending-receivable', {}, [el('span', { text: item.title }), el('strong', { text: brl(item.amountCents) })])),
          el('p.finance-hint', { text: 'Valores previstos, ainda não incluídos no saldo em conta.' }),
        ]) : null,
      month === '2026-12' ? el('section.panel.stack', {}, [el('h2', { text: 'Contas de dezembro' }),
        ...wallet.payments.filter(item => (item.month || wallet.paymentMonth) === month).map(item => el('button.planned-row', { type: 'button', onclick: () => openWalletEntry(wallet, 'payments', app.querySelector('.finance-nav'), item) }, [
          el('span', {}, [el('strong', { text: item.title }), item.note ? el('small', { text: item.note }) : null]),
          el('span', { text: item.amountCents === null ? 'Definir valor ↗' : brl(item.amountCents) })]))]) : null,
      next ? el('section.panel.wallet-due', {}, [
        el('div', {}, [
          el('p.eyebrow', { text: next.date < todayKey() ? 'Conta atrasada' : 'Próxima conta' }),
          el('p.wallet-due-title', { text: next.title }),
          el('p.meta.muted', { text: humanDay(next.date) }),
        ]),
        el('span.money', { text: next.amountCents === null ? 'A definir' : brl(next.amountCents) }),
      ]) : null,
      expensesChart(overview),
      el('details.panel.reference-balance', { open: true }, [
        el('summary', {}, [el('span', { text: 'Patrimônio de referência' }), el('strong', { text: brl(BigInt(wallet.balance) + BigInt(wallet.invested)) })]),
        el('p.meta.muted', { text: humanDay(wallet.date) + (wallet.balanceEstimated ? ' · saldo em conta estimado' : '') }),
        el('div.reference-lines', {}, [
          el('span', { text: 'Em conta' }), el('strong', { text: brl(wallet.balance) }),
          el('span', { text: 'Investido' }), el('strong', { text: brl(wallet.invested) }),
        ]),
        ...wallet.investmentAccounts.map(bank => el('div.investment-tag-row', {}, [
          el('span.investment-tag', { text: bank.label }),
          el('strong', { text: brl(bank.amountCents) }),
          bank.estimated ? el('small', { text: 'estimado' }) : null,
        ])),
      ]),
    ]);
  }
  const destinations = [['fluxo', 'Fluxo'], ['movimentos', 'Movimentos'], ['assinaturas', 'Assinaturas']];
  const dock = el('div.finance-dock', {}, [
    el('nav.finance-nav', { 'aria-label': 'Seções do Grana' }, destinations.map(([id, label]) =>
      el('button.nav-' + id, { type: 'button', text: label, 'aria-current': view === id ? 'page' : null, onclick: () => {
        if (view === id) return;
        view = id;
        showWallet(wallet);
        app.querySelector('h2')?.setAttribute('tabindex', '-1');
        app.querySelector('h2')?.focus({ preventScroll: true });
      } }))),
    launcher,
  ]);
  // Deslizar entre meses apenas na área de conteúdo, sem interferir no scroll vertical.
  if (view !== 'assinaturas') {
    let start = null;
    content.addEventListener('touchstart', e => {
      if (e.touches.length === 1 && !e.target.closest('input, button, select, dialog, details')) {
        start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });
    content.addEventListener('touchend', e => {
      if (!start || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      start = null;
      if (Math.abs(dx) < 75 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      const candidate = shiftMonth(selectedMonth, dx < 0 ? 1 : -1);
      if (candidate >= monthLimits.min && candidate <= monthLimits.max) { selectedMonth = candidate; showWallet(wallet); }
    }, { passive: true });
  }
  render(el('div.stack.wallet-layout', {}, [
    feedback, view !== 'assinaturas' ? monthNav : null, content,
    el('details.finance-settings', {}, [
      el('summary', { text: 'Carteira e acesso' }),
      el('div.actions.wallet-footer', {}, [refresh, facePassword && !biometria.armada(FACE_KEY) ? faceSetupButton(feedback) : null,
        el('button', { type: 'button', text: 'Trancar', onclick: () => login() })]),
    ]),
    dock,
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
