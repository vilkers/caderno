import assert from 'node:assert/strict';
import { monthOverview } from '../financeiro/overview.js';
import { centralWalletPlan } from '../js/store.js';

const wallet = {
  version: 1,
  date: '2026-06-15',
  paymentMonth: '2026-06',
  balance: 90000,
  invested: 150000,
  balanceEstimated: false,
  receivables: [{ id: 'renda', title: 'Renda', amountCents: 50000, date: '2026-06-20', status: 'pending' }],
  payments: [
    { id: 'compra', title: 'Compra', amountCents: 80000, date: '2026-06-10', status: 'paid', funding: 'investment' },
    { id: 'taxa', title: 'Taxa', amountCents: 1000, date: '2026-06-10', status: 'paid' },
    { id: 'conta', title: 'Conta', amountCents: 12000, date: '2026-06-25', status: 'pending' },
  ],
};

const plan = centralWalletPlan(wallet);
assert.equal(plan.balance, wallet.balance);
assert.equal(plan.invested, wallet.invested);
const month = monthOverview(plan);
assert.equal(month.income.pending, 50000n);
assert.equal(month.investmentFunding, 80000n);
assert.equal(month.expenses.settled, 81000n);
assert.equal(month.net, 37000n);
assert.equal(monthOverview(plan, '2026-07').investmentFunding, 0n);

delete wallet.payments[0].funding;
assert.equal(monthOverview(centralWalletPlan(wallet)).net, -43000n);
wallet.payments[2].funding = 'investment';
assert.throws(() => centralWalletPlan(wallet), /Origem de pagamento inválida/);
console.log('Fluxo do Grana passou: despesas pagas com resgate, lançamentos antigos e previsão por mês.');
