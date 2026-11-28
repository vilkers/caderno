export function parseCents(value) {
  const input = value.trim();
  let whole, fraction;
  if (/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(input)) {
    [whole, fraction = ''] = input.split(',');
    whole = whole.replaceAll('.', '');
  } else if (/^\d+\.\d{1,2}$/.test(input)) {
    [whole, fraction] = input.split('.');
  } else {
    return null;
  }
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export const sumCents = items => items.reduce((total, item) => total + BigInt(item.amountCents ?? 0), 0n);

function byState(items) {
  const pending = sumCents(items.filter(item => item.status === 'pending'));
  const settled = sumCents(items.filter(item => item.status !== 'pending'));
  return { pending, settled, total: pending + settled };
}

export function monthOverview(wallet, month = wallet.paymentMonth) {
  const incomes = wallet.receivables.filter(item => item.date?.startsWith(month + '-'));
  const monthPayments = wallet.payments.filter(item => (item.month || item.date?.slice(0,7) || wallet.paymentMonth) === month);
  const knownPayments = monthPayments.filter(item => item.amountCents !== null);
  const paymentsByValue = knownPayments.toSorted((a, b) => b.amountCents - a.amountCents);
  const largestPayments = paymentsByValue.slice(0, 5);
  const otherPayments = sumCents(paymentsByValue.slice(5));
  const income = byState(incomes);
  const expenses = byState(knownPayments);
  const investmentFunding = sumCents(knownPayments.filter(item => item.status === 'paid' && item.funding === 'investment'));
  return {
    income,
    expenses,
    investmentFunding,
    net: income.total + investmentFunding - expenses.total,
    largestPayments,
    otherPayments,
    undatedIncome: wallet.receivables.filter(item => !item.date).length,
    unpricedExpenses: monthPayments.length - knownPayments.length,
    nextPayment: monthPayments.filter(item => item.status === 'pending' && item.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0],
  };
}
