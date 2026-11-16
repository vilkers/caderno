import * as vault from './vault.js';

export const FINANCE_ACCESS = 'caderno-financeiro';
export const TASK_EXPORT = 'caderno-tarefas';

export async function makeTransfer(session, type, data, password) {
  if (!session) throw new Error('Destranque o Caderno.');
  if (typeof password !== 'string' || password.trim().length < 8) throw new Error('Escolha uma senha com pelo menos 8 caracteres.');
  return JSON.stringify(await vault.sealWithPassword(password, { type, data }));
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
  catch { throw new Error('A senha não abriu este código. Confira a senha escolhida ao gerar o código.'); }
  if (payload?.type !== type || !payload.data) throw new Error('Use um código criado para este app.');
  return payload.data;
}
