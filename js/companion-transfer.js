import * as vault from './vault.js';

export const FINANCE_ACCESS = 'caderno-financeiro';
export const TASK_EXPORT = 'caderno-tarefas';

export async function makeTransfer(session, type, data) {
  if (!session) throw new Error('Destranque o Caderno.');
  return JSON.stringify(await vault.seal(session, { type, data }));
}

export async function openTransfer(code, password, type) {
  let envelope;
  try { envelope = JSON.parse(code.trim()); } catch { throw new Error('Cole o código cifrado completo do Caderno.'); }
  if (envelope?.format !== 'caderno-vault-1' || typeof envelope.ct !== 'string' || envelope.ct.length > 1_500_000
      || !Number.isInteger(envelope.iters) || envelope.iters < 100000 || envelope.iters > 1000000) {
    throw new Error('Cole o código cifrado completo do Caderno.');
  }
  let payload;
  try { payload = await vault.open(envelope, password); }
  catch { throw new Error('A senha do Caderno não abriu este código.'); }
  if (payload?.type !== type || !payload.data) throw new Error('Use um código criado para este app.');
  return payload.data;
}
