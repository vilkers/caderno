/* graficos.js — desenho de dados em SVG e CSS, sem biblioteca.

   Regras da casa:
   • tudo entra animado, mas o estado final é o mesmo com movimento desligado
     (o desenho nunca depende da animação para existir);
   • nada de eixo, grade ou legenda decorativa — o número já está escrito ao
     lado, o gráfico serve pra dar tamanho e proporção;
   • uma cor só (o acento) com opacidade variando, como o resto do caderno.

   Usado pela retrospectiva, pelo calendário e pela agenda do mês. */

import { el, nf } from './utils.js';
import { motionOn } from './ui.js';

const SVG = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  return n;
};

/** Roda no próximo quadro — é o que faz a transição CSS acontecer. */
const noProximoQuadro = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

/* ── Anel de progresso ─────────────────────────────────────── */
/** Um anel que se desenha até `pct` (0–1). Com o número no meio, se pedir. */
export function anel(pct, { tamanho = 120, espessura = 10, texto = null, sufixo = '', atraso = 0 } = {}) {
  const p = Math.max(0, Math.min(1, pct || 0));
  const r = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * r;

  const svg = svgEl('svg', { viewBox: `0 0 ${tamanho} ${tamanho}`, width: tamanho, height: tamanho, class: 'g-anel' });
  svg.append(svgEl('circle', {
    cx: tamanho / 2, cy: tamanho / 2, r, fill: 'none',
    stroke: 'var(--line)', 'stroke-width': espessura,
  }));
  const arco = svgEl('circle', {
    cx: tamanho / 2, cy: tamanho / 2, r, fill: 'none',
    stroke: 'var(--accent)', 'stroke-width': espessura, 'stroke-linecap': 'round',
    transform: `rotate(-90 ${tamanho / 2} ${tamanho / 2})`,
    'stroke-dasharray': volta,
    'stroke-dashoffset': motionOn() ? volta : volta * (1 - p),
  });
  if (motionOn()) {
    arco.style.transition = `stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1) ${atraso}ms`;
    noProximoQuadro(() => arco.setAttribute('stroke-dashoffset', String(volta * (1 - p))));
  }
  svg.append(arco);

  const caixa = el('div.g-anel__caixa', { style: { width: `${tamanho}px`, height: `${tamanho}px` } }, [svg]);
  if (texto !== null) {
    caixa.append(el('div.g-anel__meio', {}, [
      el('span.g-anel__n.num', { text: String(texto) }),
      sufixo ? el('span.g-anel__suf.micro', { text: sufixo }) : null,
    ]));
  }
  return caixa;
}

/* ── Barras horizontais ────────────────────────────────────── */
/**
 * itens: [{ label, valor, texto?, destaque? }]
 * A maior barra vira 100% — é comparação entre elas, não escala absoluta.
 */
export function barras(itens = [], { max = null, formato = v => nf(v), atraso = 0, passo = 70 } = {}) {
  const teto = Math.max(1, max ?? Math.max(...itens.map(i => i.valor || 0)));
  const caixa = el('div.g-barras');
  itens.forEach((it, i) => {
    const largura = `${Math.max(2, ((it.valor || 0) / teto) * 100)}%`;
    const trilho = el('span.g-barra__trilho');
    const preenche = el('span.g-barra__fill' + (it.destaque ? '.is-top' : ''), {
      style: { width: motionOn() ? '0%' : largura },
    });
    trilho.append(preenche);
    if (motionOn()) {
      preenche.style.transition = `width .9s cubic-bezier(.16,1,.3,1) ${atraso + i * passo}ms`;
      noProximoQuadro(() => { preenche.style.width = largura; });
    }
    caixa.append(el('div.g-barra', {}, [
      el('span.g-barra__l', { text: it.label }),
      trilho,
      el('span.g-barra__v.num', { text: it.texto ?? formato(it.valor) }),
    ]));
  });
  return caixa;
}

/* ── Colunas (perfil por dia da semana, mês a mês) ─────────── */
export function colunas(valores = [], { labels = [], destaque = -1, altura = 96, formato = null, atraso = 0 } = {}) {
  const teto = Math.max(1, ...valores);
  const caixa = el('div.g-colunas', { style: { height: `${altura}px` } });
  valores.forEach((v, i) => {
    const h = `${Math.max(3, (v / teto) * 100)}%`;
    const barra = el('span.g-coluna__b' + (i === destaque ? '.is-top' : ''), {
      style: { height: motionOn() ? '0%' : h },
    });
    if (motionOn()) {
      barra.style.transition = `height .8s cubic-bezier(.16,1,.3,1) ${atraso + i * 60}ms`;
      noProximoQuadro(() => { barra.style.height = h; });
    }
    caixa.append(el('div.g-coluna', { title: labels[i] ? `${labels[i]}: ${v}` : String(v) }, [
      formato ? el('span.g-coluna__v.micro', { text: formato(v) }) : null,
      barra,
      labels[i] ? el('span.g-coluna__l.micro', { text: labels[i] }) : null,
    ]));
  });
  return caixa;
}

/* ── Malha de dias ─────────────────────────────────────────── */
/**
 * Um quadradinho por dia. `itens`: [{ on, tom (0–1), title }]
 * É o gráfico mais honesto que existe pra "quantos dias você apareceu".
 */
export function malha(itens = [], { colunas: cols = 0, atraso = 0 } = {}) {
  const caixa = el('div.g-malha');
  if (cols) caixa.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const passo = itens.length > 120 ? 4 : itens.length > 60 ? 8 : 14;
  itens.forEach((it, i) => {
    const q = el('span.g-quadro' + (it.on ? '.is-on' : ''), { title: it.title || '' });
    if (it.on && it.tom !== undefined) q.style.opacity = String(0.25 + 0.75 * it.tom);
    if (motionOn()) {
      q.style.animation = `quadroEntra .5s cubic-bezier(.16,1,.3,1) ${atraso + i * passo}ms both`;
    }
    caixa.append(q);
  });
  return caixa;
}

/* ── Trilha de sequência ───────────────────────────────────── */
/** Blocos que acendem em fila — a sequência vista como uma corrente. */
export function trilha(n, { max = 21, atraso = 0 } = {}) {
  const total = Math.min(max, Math.max(1, n));
  const caixa = el('div.g-trilha');
  for (let i = 0; i < total; i++) {
    const b = el('span.g-elo');
    if (motionOn()) b.style.animation = `eloAcende .45s cubic-bezier(.16,1,.3,1) ${atraso + i * 55}ms both`;
    caixa.append(b);
  }
  if (n > max) caixa.append(el('span.g-elo__mais.micro', { text: `+${n - max}` }));
  return caixa;
}

/* ── Barra de progresso simples ────────────────────────────── */
export function barraProgresso(pct, { atraso = 0, tom = null } = {}) {
  const p = `${Math.max(0, Math.min(100, pct * 100))}%`;
  const fill = el('span.g-prog__fill', { style: { width: motionOn() ? '0%' : p, background: tom } });
  if (motionOn()) {
    fill.style.transition = `width 1s cubic-bezier(.16,1,.3,1) ${atraso}ms`;
    noProximoQuadro(() => { fill.style.width = p; });
  }
  return el('span.g-prog', {}, [fill]);
}

/* ── Linha (sparkline) ─────────────────────────────────────── */
/** Série pequena desenhada como traço contínuo, que entra se desenhando. */
export function linha(valores = [], { largura = 280, altura = 60, atraso = 0 } = {}) {
  if (valores.length < 2) return el('div');
  const teto = Math.max(1, ...valores);
  const passoX = largura / (valores.length - 1);
  const pontos = valores.map((v, i) => [i * passoX, altura - (v / teto) * (altura - 4) - 2]);
  const d = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  const svg = svgEl('svg', { viewBox: `0 0 ${largura} ${altura}`, class: 'g-linha', preserveAspectRatio: 'none' });
  const area = svgEl('path', {
    d: `${d} L${largura} ${altura} L0 ${altura} Z`, fill: 'var(--accent)', opacity: '.12',
  });
  const traco = svgEl('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  svg.append(area, traco);

  if (motionOn()) {
    const comp = traco.getTotalLength?.() || largura * 1.4;
    traco.style.strokeDasharray = String(comp);
    traco.style.strokeDashoffset = String(comp);
    traco.style.transition = `stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1) ${atraso}ms`;
    area.style.opacity = '0';
    area.style.transition = `opacity .8s ease ${atraso + 400}ms`;
    noProximoQuadro(() => { traco.style.strokeDashoffset = '0'; area.style.opacity = '.12'; });
  }
  return svg;
}

/* ── Anel pequeno pro calendário ───────────────────────────── */
/**
 * O dia do calendário: um anel fino em volta do número. Sem SVG — é
 * conic-gradient, porque são 42 células e cada nó a menos conta.
 */
export function tomDoDia(pct) {
  const p = Math.max(0, Math.min(1, pct || 0));
  return `conic-gradient(var(--accent) ${p * 360}deg, var(--line) 0deg)`;
}
