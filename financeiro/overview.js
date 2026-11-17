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

export function monthOverview(wallet) {
  const incomes = wallet.receivables.filter(item => item.date?.startsWith(wallet.paymentMonth + '-'));
  const knownPayments = wallet.payments.filter(item => item.amountCents !== null);
  const paymentsByValue = knownPayments.toSorted((a, b) => b.amountCents - a.amountCents);
  const largestPayments = paymentsByValue.slice(0, 5);
  const otherPayments = sumCents(paymentsByValue.slice(5));
  return {
    income: byState(incomes),
    expenses: byState(knownPayments),
    largestPayments,
    otherPayments,
    undatedIncome: wallet.receivables.filter(item => !item.date).length,
    unpricedExpenses: wallet.payments.length - knownPayments.length,
    nextPayment: wallet.payments.filter(item => item.status === 'pending' && item.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0],
  };
}
