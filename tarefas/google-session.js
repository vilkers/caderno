import { SYNC_ORIGIN } from './sync-config.js';

export const automaticSync = Boolean(SYNC_ORIGIN);
const messages = {
  account: 'Autorize a mesma conta Google onde estão suas tarefas.',
  denied: 'O Google não concluiu a autorização. Inicie a conexão novamente.',
  expired: 'O tempo para autorizar acabou. Inicie a conexão novamente.',
  permission: 'Permita o acesso ao Google Tasks ao autorizar.',
  setup: 'A sincronização automática ainda precisa ser configurada.',
  unavailable: 'A sincronização está indisponível. Tente novamente em instantes.',
};

async function request(path, body) {
  try {
    return await fetch(new URL(path, SYNC_ORIGIN), {
      method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(18000),
    });
  } catch {
    throw new Error('Não consegui conectar à sincronização. Confira sua internet e tente novamente.');
  }
}

export async function startPairing() {
  const response = await request('/start', {});
  const result = await response.json();
  if (!response.ok) throw new Error(messages[result.error] || messages.unavailable);
  if (new URL(result.authorize).origin !== 'https://accounts.google.com') throw new Error(messages.unavailable);
  return result;
}

export async function readSession(connection, rejected) {
  const response = await request('/session', { id: connection.id, secret: connection.secret, rejected });
  if (response.status === 202) return null;
  const result = await response.json();
  if (response.ok && result.token && result.expires > Date.now()) return result;
  const error = new Error(response.status === 401
    ? 'O Google encerrou a sessão. Toque em Conectar Google para recuperar a sincronização.'
    : messages[result.error] || messages.unavailable);
  error.revoked = response.status === 401;
  error.pairingEnded = response.status === 409 || error.revoked;
  throw error;
}
