/* lembrete.js — o empurrão das 21h.

   Sem servidor, um PWA não tem agendamento garantido. Então isto é feito em
   três camadas, da mais frágil para a mais confiável:

   1. Periodic Background Sync — o worker acorda sozinho (Android/Chrome,
      app instalado). É o que mais parece um alarme, e é o menos garantido.
   2. Relógio dentro da página — enquanto o app estiver aberto (mesmo em
      segundo plano), dispara na hora certa.
   3. Selo no ícone e aviso na abertura — sempre funcionam, inclusive no
      iPhone, onde 1 não existe.

   O worker só sabe QUANTAS marcações faltam (js/idb.js explica por quê). */

import * as store from './store.js';
import { dayStatus } from './analysis.js';
import { todayKey } from './utils.js';
import { guardarResumo } from './idb.js';

export const PADRAO = { ligado: false, hora: 21, detalhe: false };
export const config = () => ({ ...PADRAO, ...(store.state.settings?.lembrete || {}) });

export const suportaAviso = () => 'Notification' in window;
export const permissao = () => (suportaAviso() ? Notification.permission : 'unsupported');

/** Pede permissão e liga. Devolve o estado final. */
export async function ligar() {
  if (!suportaAviso()) return 'unsupported';
  let p = Notification.permission;
  if (p === 'default') p = await Notification.requestPermission();
  store.setSetting('lembrete', { ...config(), ligado: p === 'granted' });
  if (p === 'granted') { await registrarSync(); atualizar(); }
  return p;
}

export function desligar() {
  store.setSetting('lembrete', { ...config(), ligado: false });
  clearTimeout(relogio);
  limparSelo();
}

/* navigator.serviceWorker.ready nunca resolve se nenhum worker foi registrado
   (navegador sem suporte, aba sem HTTPS, registro que falhou). Como isso trava
   o botão de ligar, esperamos no máximo dois segundos e seguimos sem ele. */
async function registro(ms = 2000) {
  if (!('serviceWorker' in navigator)) return null;
  try {
    if (!(await navigator.serviceWorker.getRegistration())) return null;   // responde na hora
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(ok => setTimeout(() => ok(null), ms)),                    // registro travado
    ]);
  } catch { return null; }
}

async function registrarSync() {
  try {
    const reg = await registro();
    if (!reg || !('periodicSync' in reg)) return false;
    const estado = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (estado.state !== 'granted') return false;
    await reg.periodicSync.register('lembrete', { minInterval: 6 * 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}

/* ── Selo no ícone ─────────────────────────────────────────── */
function selo(n) {
  try { n > 0 ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch {}
}
const limparSelo = () => selo(0);

/* ── Sincroniza o que o worker vê ──────────────────────────── */
let relogio;

/** Chamada a cada mudança de dados: atualiza gaveta, selo e relógio. */
export function atualizar() {
  if (!store.isUnlocked()) return;
  const st = dayStatus(todayKey());
  const c = config();
  const faltam = st.fechado ? 0 : st.faltando.length;

  selo(c.ligado ? faltam : 0);
  guardarResumo({
    data: todayKey(),
    faltam,
    total: st.total,
    fechado: st.fechado,
    hora: c.hora,
    ligado: c.ligado,
    nomes: c.detalhe ? st.faltando.map(x => x.label) : [],
    salvoEm: Date.now(),
  });
  agendar();
}

/** Dispara na hora certa enquanto a página estiver viva. */
function agendar() {
  clearTimeout(relogio);
  const c = config();
  if (!c.ligado || permissao() !== 'granted') return;

  const agora = new Date();
  const alvo = new Date(agora);
  alvo.setHours(c.hora, 0, 0, 0);
  if (alvo <= agora) alvo.setDate(alvo.getDate() + 1);
  const espera = Math.min(alvo - agora, 2 ** 31 - 1);

  relogio = setTimeout(async () => {
    await avisarSePreciso();
    agendar();
  }, espera);
}

export async function avisarSePreciso({ forcar = false } = {}) {
  const c = config();
  if (!forcar && (!c.ligado || permissao() !== 'granted')) return false;
  if (!store.isUnlocked()) return false;

  const st = dayStatus(todayKey());
  const faltam = st.faltando.length;
  if (!forcar && (st.fechado || !faltam)) return false;

  const corpo = forcar && !faltam
    ? 'Tudo em ordem por aqui.'
    : c.detalhe && faltam
      ? `Falta: ${st.faltando.map(x => x.label).join(', ')}.`
      : `${faltam} marcação(ões) esperando por você.`;

  try {
    const reg = await registro();
    const opcoes = {
      body: corpo, tag: 'caderno-dia', icon: './assets/icon.svg', badge: './assets/icon.svg',
      data: { url: './?v=rapido' },
    };
    if (reg) await reg.showNotification('Fecha o dia?', opcoes);
    else new Notification('Fecha o dia?', opcoes);
    return true;
  } catch { return false; }
}

/** Passou da hora, tem pendência e o app acabou de abrir? Avisa por dentro. */
export function pendenteAgora() {
  const c = config();
  if (!store.isUnlocked()) return false;
  const st = dayStatus(todayKey());
  return !st.fechado && st.faltando.length > 0 && new Date().getHours() >= c.hora;
}
