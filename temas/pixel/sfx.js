/* sfx.js — os bipes. Nada de arquivo de áudio: tudo sintetizado na hora
   com osciladores quadrados, que é o som da época e pesa zero byte.
   O contexto só nasce depois do primeiro toque (regra dos navegadores). */

let ctx = null;
let ligado = true;

export const mudo = v => { ligado = !v; };
export const ligadoEsta = () => ligado;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Uma nota quadrada com envelope curto. */
function nota(freq, { t = 0, dur = 0.08, tipo = 'square', vol = 0.06, deslize = 0 } = {}) {
  const a = ac();
  if (!a || !ligado) return;
  const osc = a.createOscillator();
  const gan = a.createGain();
  const t0 = a.currentTime + t;
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (deslize) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + deslize), t0 + dur);
  gan.gain.setValueAtTime(0.0001, t0);
  gan.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gan.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gan).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* ── Efeitos ───────────────────────────────────────────────── */
export const moeda   = () => { nota(988, { dur: 0.07 }); nota(1319, { t: 0.07, dur: 0.32, vol: 0.05 }); };
export const bump    = () => nota(180, { dur: 0.09, vol: 0.05, deslize: -80 });
export const pulo    = () => nota(330, { dur: 0.14, vol: 0.05, deslize: 520 });
export const passo   = () => nota(140, { dur: 0.04, vol: 0.03 });
export const erro    = () => { nota(300, { dur: 0.1, vol: 0.05 }); nota(200, { t: 0.1, dur: 0.16, vol: 0.05 }); };
export const powerup = () => [523, 659, 784, 1047].forEach((f, i) => nota(f, { t: i * 0.06, dur: 0.09, vol: 0.05 }));
export const vida1up = () => [659, 784, 1047, 1319, 1568].forEach((f, i) => nota(f, { t: i * 0.08, dur: 0.12, vol: 0.05 }));
export const fase    = () => [523, 523, 523, 415, 523, 659].forEach((f, i) => nota(f, { t: i * 0.11, dur: 0.1, vol: 0.045 }));
export const pausa   = () => { nota(880, { dur: 0.06 }); nota(660, { t: 0.06, dur: 0.1 }); };
