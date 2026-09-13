/* biometria.js — entrar com Face ID / Touch ID (WebAuthn + extensão PRF).

   O cofre continua sendo o de sempre: PBKDF2 + AES-GCM com a SUA senha.
   O que este arquivo faz é guardar uma cópia da senha cifrada por uma chave
   que só existe dentro do Secure Enclave do aparelho — e que só sai de lá
   depois que o rosto (ou o dedo) confere. Sem o aparelho, o blob é ruído;
   sem o rosto, o aparelho não devolve a chave.

   O que isso significa na prática, e está escrito na tela antes de ligar:
   quem destranca o seu telefone passa a destrancar o caderno. É a mesma
   troca de qualquer app de banco — conveniência por um fator que já é o
   seu telefone. Desligar apaga o blob e volta tudo a ser só senha.

   Precisa de PRF (iOS 18 / Safari 18, Chrome 132+). Sem PRF não há material
   de chave nenhum pra derivar, e aí o app diz isso em vez de fingir. */

const CHAVE = 'caderno.face.v1';
const INFO = new TextEncoder().encode('caderno-face-v1');

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const enc = new TextEncoder();
const dec = new TextDecoder();

/* ── Cripto (sem WebAuthn no meio, pra poder testar em node) ── */

/** A saída do PRF vira chave AES-GCM por HKDF, com sal próprio do aparelho. */
export async function chaveDePrf(prf, salt) {
  const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function selar(chave, texto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(texto));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function abrirSelo(chave, blob) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(blob.iv) }, chave, unb64(blob.ct));
  return dec.decode(plain);
}

/* ── Estado guardado neste aparelho ─────────────────────────── */

function ler() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || null; }
  catch { return null; }
}
export const armada = () => !!ler();
export function desarmar() { localStorage.removeItem(CHAVE); }

/* ── WebAuthn ───────────────────────────────────────────────── */

/** O aparelho tem leitor de rosto/digital ligado a este navegador? */
export async function disponivel() {
  if (!globalThis.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));

/**
 * Liga o Face ID — parte 1 de duas, e a divisão é o conserto.
 *
 * O Safari do iPhone só deixa chamar WebAuthn com **ativação de usuário
 * fresca**: o toque que acabou de acontecer. A versão anterior fazia duas
 * coisas que matavam isso, e por isso não funcionava no aparelho:
 *
 *   1. conferia a senha ANTES (PBKDF2, 310 mil voltas, um a dois segundos) —
 *      quando o `create()` era chamado, a ativação já tinha expirado;
 *   2. quando a criação não devolvia o PRF — que é o caso do Safari — chamava
 *      um `get()` logo em seguida, **no mesmo toque**. O segundo pedido de
 *      biometria num gesto só é recusado.
 *
 * Agora: o `create()` é a primeira coisa que acontece no toque, a senha é
 * conferida depois, e quando falta o PRF a tela pede um segundo toque em vez
 * de tentar por conta própria.
 */
export async function criarCredencial(nome = 'Caderno') {
  const prfSalt = aleatorio(32);
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: aleatorio(32),
      rp: { name: 'Caderno' },
      user: { id: aleatorio(16), name: nome, displayName: nome },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  if (!cred) throw new Error('cancelado');
  const ext = cred.getClientExtensionResults?.() || {};
  const prf = ext.prf?.results?.first || null;
  if (!prf && !ext.prf?.enabled) throw new Error('prf');
  return { id: new Uint8Array(cred.rawId), prfSalt, prf, precisaSegundoToque: !prf };
}

/** Parte 2: o segundo toque, quando a criação não devolveu o segredo. */
export async function completarCredencial(cred) {
  return { ...cred, prf: await colher(cred.id, cred.prfSalt), precisaSegundoToque: false };
}

/** Guarda a senha selada. Nada aqui pede biometria — já foi pedida. */
export async function guardar(senha, cred) {
  const hkdfSalt = aleatorio(16);
  const chave = await chaveDePrf(new Uint8Array(cred.prf), hkdfSalt);
  const selo = await selar(chave, senha);
  localStorage.setItem(CHAVE, JSON.stringify({
    v: 1, id: b64(cred.id), prfSalt: b64(cred.prfSalt), hkdfSalt: b64(hkdfSalt),
    ...selo, armadaEm: Date.now(),
  }));
  return true;
}

/**
 * O que este aparelho responde, em uma linha. Existe porque "não funcionou"
 * não é diagnóstico: sem isto, um Face ID que falha no iPhone é indepurável
 * daqui — e é o aparelho dele que tem a resposta.
 */
export async function diagnostico() {
  const out = {
    webauthn: !!globalThis.PublicKeyCredential,
    https: location.protocol === 'https:' || location.hostname === 'localhost',
    dominio: location.hostname,
    leitor: await disponivel(),
    prfConhecido: null,
    armada: armada(),
  };
  try {
    out.prfConhecido = await PublicKeyCredential.getClientCapabilities?.()
      .then(c => c?.['extension:prf'] ?? null) ?? null;
  } catch { /* navegador antigo não tem getClientCapabilities */ }
  return out;
}

/** Pede o rosto e devolve a senha. Lança Error('cancelado') se você desistir. */
export async function entrar() {
  const guardado = ler();
  if (!guardado) throw new Error('desarmada');
  const prf = await colher(unb64(guardado.id), unb64(guardado.prfSalt));
  const chave = await chaveDePrf(new Uint8Array(prf), unb64(guardado.hkdfSalt));
  try { return await abrirSelo(chave, guardado); }
  catch { throw new Error('selo'); }
}

/** Uma conferência de rosto/digital que devolve o segredo do PRF. */
async function colher(id, prfSalt) {
  const asrt = await navigator.credentials.get({
    publicKey: {
      challenge: aleatorio(32),
      allowCredentials: [{ type: 'public-key', id, transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  if (!asrt) throw new Error('cancelado');
  const first = asrt.getClientExtensionResults?.().prf?.results?.first;
  if (!first) throw new Error('prf');
  return first;
}
