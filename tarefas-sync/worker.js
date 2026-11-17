import { DurableObject } from 'cloudflare:workers';

const TASKS = 'https://www.googleapis.com/auth/tasks';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const KEY = 'connection';
const PAIRING_TTL = 10 * 60 * 1000;
const ID = /^[0-9a-f]{32}$/;
const SECRET = /^[0-9a-f]{64}$/;
const random = size => hex(crypto.getRandomValues(new Uint8Array(size)));
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const eq = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
const hash = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const cacheHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };

async function googleToken(env, fields) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...fields,
    }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (response.ok && data.access_token && Number(data.expires_in) > 0) return data;
  if (response.status === 400 && data.error === 'invalid_grant') return null;
  throw new Error('google_token');
}

async function isOwner(env, token) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('google_userinfo');
  const account = await response.json();
  return account.email_verified === true && account.email?.toLowerCase() === env.GOOGLE_ACCOUNT_EMAIL.trim().toLowerCase();
}

function callbackPage(message) {
  return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tarefas</title><main><h1>Tarefas</h1><p>' + message + '</p><p>Volte ao ícone Tarefas na Tela de Início.</p></main>', {
    headers: { ...cacheHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const getSession = id => env.SESSIONS.getByName(id);
    if (request.method === 'GET' && url.pathname === '/oauth/callback') {
      const state = url.searchParams.get('state') || '';
      const [id, nonce, ...rest] = state.split('.');
      if (!ID.test(id) || !SECRET.test(nonce) || rest.length) return callbackPage('Essa autorização não está mais disponível.');
      try {
        const code = url.searchParams.get('code') || '';
        const accepted = await getSession(id).exchange(nonce, code, url.origin + url.pathname);
        return callbackPage(accepted ? 'Google autorizado.' : 'O Google não concluiu a autorização.');
      } catch {
        return callbackPage('Não consegui concluir a autorização. Tente de novo pelo Tarefas.');
      }
    }

    const origin = request.headers.get('Origin');
    if (origin !== env.APP_ORIGIN) return new Response(null, { status: 403, headers: cacheHeaders });
    const headers = {
      ...cacheHeaders, 'Access-Control-Allow-Origin': origin, Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const json = (data, status) => Response.json(data, { status, headers });
    if (request.method !== 'POST') return json({}, 405);
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_ACCOUNT_EMAIL) return json({ error: 'setup' }, 503);
    try {
      if (url.pathname === '/start') {
        const id = random(16);
        return json(await getSession(id).begin(id, url.origin + '/oauth/callback'), 200);
      }
      if (url.pathname === '/session') {
        const { id, secret, rejected } = await request.json().catch(() => ({})) || {};
        if (typeof id !== 'string' || !ID.test(id) || typeof secret !== 'string' || !SECRET.test(secret)) return json({}, 400);
        const result = await getSession(id).session(secret, typeof rejected === 'string' && rejected.length <= 4096 ? rejected : '');
        return json(result.data, result.status);
      }
      return json({}, 404);
    } catch {
      return json({ error: 'unavailable' }, 502);
    }
  },
};

export class GoogleSession extends DurableObject {
  async begin(id, redirectUri) {
    const nonce = random(32);
    const secret = random(32);
    const verifier = random(48);
    const expires = Date.now() + PAIRING_TTL;
    const [secretHash, digest] = await Promise.all([
      hash(secret), crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ]);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    this.ctx.storage.kv.put(KEY, { phase: 'pending', secretHash, nonce, verifier, redirectUri, expires });
    await this.ctx.storage.setAlarm(expires);
    const query = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code',
      access_type: 'offline', prompt: 'consent', login_hint: this.env.GOOGLE_ACCOUNT_EMAIL,
      scope: TASKS + ' openid email', state: id + '.' + nonce,
      code_challenge: challenge, code_challenge_method: 'S256',
    });
    return { id, secret, expires, authorize: 'https://accounts.google.com/o/oauth2/v2/auth?' + query };
  }

  async exchange(nonce, code, redirectUri) {
    const record = this.ctx.storage.kv.get(KEY);
    if (record?.phase !== 'pending' || record.expires <= Date.now()
      || !eq(record.nonce, nonce) || record.redirectUri !== redirectUri) return false;
    const { secretHash, expires } = record;
    this.ctx.storage.kv.put(KEY, { phase: 'exchanging', secretHash, expires });
    let error = 'denied';
    try {
      if (code && code.length <= 4096) {
        const session = await googleToken(this.env, {
          grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: record.verifier,
        });
        if (!session?.refresh_token || !session.scope?.split(/\s+/).includes(TASKS)) {
          error = 'permission';
        } else if (!(await isOwner(this.env, session.access_token))) {
          error = 'account';
        } else if (Date.now() < expires) {
          this.access = { token: session.access_token, expires: Date.now() + Number(session.expires_in) * 1000 };
          this.ctx.storage.kv.put(KEY, { phase: 'ready', secretHash, expires, refresh: session.refresh_token });
          return true;
        }
      }
    } catch {
      error = 'unavailable';
    }
    if (Date.now() < expires) this.ctx.storage.kv.put(KEY, { phase: 'failed', secretHash, error, expires });
    return false;
  }

  async session(secret, rejected) {
    const fingerprint = await hash(secret);
    const record = this.ctx.storage.kv.get(KEY);
    if (!record || !eq(record.secretHash, fingerprint)) return { status: 401, data: {} };
    if (record.expires && record.expires <= Date.now()) return { status: 409, data: { error: 'expired' } };
    if (record.phase === 'failed') return { status: 409, data: { error: record.error } };
    if (record.phase === 'pending' || record.phase === 'exchanging') return { status: 202, data: {} };
    if (record.phase === 'ready') {
      const { secretHash, refresh } = record;
      this.ctx.storage.kv.put(KEY, { phase: 'active', secretHash, refresh });
      await this.ctx.storage.deleteAlarm();
    }
    if (this.access?.expires > Date.now() + 60000 && this.access.token !== rejected) {
      return { status: 200, data: this.access };
    }
    if (!this.refreshing) {
      this.refreshing = this.renew(record).finally(() => { this.refreshing = null; });
    }
    const access = await this.refreshing;
    return access ? { status: 200, data: access } : { status: 401, data: {} };
  }

  async renew(record) {
    const response = await googleToken(this.env, { grant_type: 'refresh_token', refresh_token: record.refresh });
    if (!response) {
      this.access = null;
      this.ctx.storage.kv.delete(KEY);
      return null;
    }
    if (response.refresh_token) this.ctx.storage.kv.put(KEY, {
      phase: 'active', secretHash: record.secretHash, refresh: response.refresh_token,
    });
    this.access = { token: response.access_token, expires: Date.now() + Number(response.expires_in) * 1000 };
    return this.access;
  }

  alarm() {
    const record = this.ctx.storage.kv.get(KEY);
    if (record?.expires && record.expires <= Date.now()) this.ctx.storage.kv.delete(KEY);
  }
}
