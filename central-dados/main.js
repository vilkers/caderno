import { CLIENT_KEY, DEFAULT_CLIENT_ID, loadIdentity } from '../js/google-tasks.js';
import { readSources, SCOPES, sourceErrors, validRange } from './google.js';

const central = 'https://central-vilker-painel.vilkervs.chatgpt.site';
const opener = window.opener;
const nonce = location.hash.slice(1);
const connect = document.querySelector('#connect');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
let range, readyTimer, controller, finished = false;

function send(message) {
  opener.postMessage({ ...message, nonce }, central);
}

function finish(sources, message) {
  if (finished) return;
  finished = true;
  clearInterval(readyTimer);
  controller?.abort();
  connect.disabled = true;
  status.textContent = message;
  cancel.textContent = 'Fechar';
  send({ type: 'central-google:result', sources });
}

async function setRange(event) {
  const data = event.data;
  if (event.source !== opener || event.origin !== central || data?.type !== 'central-google:load' ||
      data.nonce !== nonce || !validRange(data.start, data.end) || range || finished) return;
  range = { start: data.start, end: data.end };
  clearInterval(readyTimer);
  try {
    await loadIdentity();
    if (finished) return;
    status.textContent = '';
    connect.disabled = false;
  } catch {
    const message = 'Não consegui carregar a conexão do Google.';
    finish(sourceErrors(message), message);
  }
}

function authorize() {
  if (!range || finished) return;
  const oauth = globalThis.google?.accounts?.oauth2;
  const message = 'O Google não concluiu a autorização. Tente novamente pela Central.';
  if (!oauth) { finish(sourceErrors(message), message); return; }
  connect.disabled = true;
  status.textContent = 'Aguardando autorização…';
  try {
    const client = localStorage.getItem(CLIENT_KEY) || DEFAULT_CLIENT_ID;
    oauth.initTokenClient({
      client_id: client,
      scope: Object.values(SCOPES).join(' '),
      include_granted_scopes: false,
      error_callback: () => finish(sourceErrors(message), message),
      callback: async response => {
        if (finished) return;
        if (response.error || !response.access_token) { finish(sourceErrors(message), message); return; }
        const available = Object.fromEntries(Object.entries(SCOPES).map(([key, scope]) =>
          [key, oauth.hasGrantedAllScopes(response, scope)]));
        status.textContent = 'Consultando as fontes autorizadas…';
        controller = new AbortController();
        const deadline = setTimeout(() => controller.abort(), 30000);
        try {
          const result = await readSources({ range, available, token: response.access_token, signal: controller.signal });
          finish(result, 'Consulta concluída. Volte à Central.');
        } catch {
          finish(sourceErrors('Não consegui consultar o Google.'), 'Tente novamente pela Central.');
        } finally {
          clearTimeout(deadline);
        }
      },
    }).requestAccessToken({ prompt: '' });
  } catch {
    finish(sourceErrors(message), message);
  }
}

connect.addEventListener('click', authorize);
cancel.addEventListener('click', () => {
  if (opener && range && !finished) {
    const message = 'Consulta cancelada.';
    finish(sourceErrors(message), message);
  }
  window.close();
});

if (opener && /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(nonce)) {
  window.addEventListener('message', setRange);
  const announce = () => send({ type: 'central-google:ready' });
  readyTimer = setInterval(announce, 700);
  announce();
} else {
  status.textContent = 'Abra esta conexão pelo painel da Central.';
  connect.hidden = true;   // sem a Central do outro lado, o botão só pareceria quebrado
  cancel.textContent = 'Fechar';
}
