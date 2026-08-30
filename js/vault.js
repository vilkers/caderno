/* vault.js — cofre local: PBKDF2 (SHA-256) + AES-GCM 256.
   A senha nunca é gravada; só o sal, o IV e o texto cifrado ficam
   no localStorage deste aparelho. Sem a senha não há como ler. */

const VAULT_KEY = 'caderno.vault.v1';
const META_KEY  = 'caderno.meta.v1';
const ITER      = 310000;

const enc = new TextEncoder();
const dec = new TextDecoder();

/* A senha viva da sessão. Só existe em memória, some ao trancar.
   É o que permite abrir um arquivo cifrado com OUTRO sal — o do
   repositório, escrito por outro aparelho. */
let live = null;
export const hasLivePassword = () => !!live;
export const forget = () => { live = null; };

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

export const supported = () => !!(globalThis.crypto && crypto.subtle);

async function deriveKey(password, salt, iterations = ITER) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/* ── Meta em texto puro (nada sensível): dica, paleta, timestamps ── */
export function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; }
  catch { return {}; }
}
export function writeMeta(patch) {
  const meta = { ...readMeta(), ...patch };
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  return meta;
}

export const hasVault = () => !!localStorage.getItem(VAULT_KEY);

/** Cria um cofre novo. Devolve a chave viva da sessão. */
export async function create(password, data) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  live = password;
  const session = { key, salt, iters: ITER };
  await write(session, data);
  writeMeta({ created: Date.now() });
  return session;
}

/** Abre o cofre. Lança Error('senha') se a senha estiver errada. */
export async function unlock(password) {
  const raw = JSON.parse(localStorage.getItem(VAULT_KEY));
  const salt = unb64(raw.salt);
  const iters = raw.iters || ITER;
  const key = await deriveKey(password, salt, iters);
  let json;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(raw.iv) }, key, unb64(raw.ct)
    );
    json = JSON.parse(dec.decode(plain));
  } catch {
    throw new Error('senha');
  }
  live = password;
  return { session: { key, salt, iters }, data: json };
}

/** Grava o estado cifrado. Guarda a versão anterior como rede de segurança. */
export async function write(session, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, session.key, enc.encode(JSON.stringify(data))
  );
  const previous = localStorage.getItem(VAULT_KEY);
  if (previous) { try { localStorage.setItem(VAULT_KEY + '.bak', previous); } catch {} }
  localStorage.setItem(VAULT_KEY, JSON.stringify({
    v: 1, kdf: 'PBKDF2-SHA256', iters: session.iters,
    salt: b64(session.salt), iv: b64(iv), ct: b64(ct),
    savedAt: Date.now(),
  }));
  writeMeta({ savedAt: Date.now() });
}

/* ── Cifra avulsa (para o arquivo do repositório) ─────────── */

/** Cifra um documento com a chave da sessão. Não grava nada. */
export async function seal(session, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, session.key, enc.encode(JSON.stringify(data))
  );
  return {
    app: 'caderno', format: 'caderno-vault-1', v: 1, kdf: 'PBKDF2-SHA256',
    iters: session.iters, salt: b64(session.salt), iv: b64(iv), ct: b64(ct),
    savedAt: Date.now(),
  };
}

/** Abre um blob cifrado com QUALQUER sal, usando a senha viva da sessão. */
export async function open(blob) {
  if (!live) throw new Error('trancado');
  const key = await deriveKey(live, unb64(blob.salt), blob.iters || ITER);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct)
    );
    return JSON.parse(dec.decode(plain));
  } catch {
    throw new Error('senha');
  }
}

/** Regrava tudo com uma senha nova (novo sal). */
export async function changePassword(newPassword, data) {
  return create(newPassword, data);
}

export function destroy() {
  localStorage.removeItem(VAULT_KEY);
  localStorage.removeItem(META_KEY);
}

/** Backup cifrado (o mesmo blob do localStorage, portável entre aparelhos). */
export const exportEncrypted = () => localStorage.getItem(VAULT_KEY);
export function importEncrypted(blob) {
  const raw = typeof blob === 'string' ? JSON.parse(blob) : blob;
  if (!raw || !raw.ct || !raw.salt || !raw.iv) throw new Error('formato');
  localStorage.setItem(VAULT_KEY, JSON.stringify(raw));
}
