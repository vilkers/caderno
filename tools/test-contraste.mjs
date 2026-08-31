/* Mede o contraste (WCAG 2.1) dos pares que a interface usa de verdade, em
   todas as paletas — trocar uma cor sem conferir isso é como mudar código
   sem rodar teste. Rode com: node tools/test-contraste.mjs

   4.5 texto normal · 3.0 texto grande, ícone e borda de componente.
   A divisória decorativa fica em 1.8, que é o mínimo para ela existir. */

import { PALETTES } from '../js/palettes.js';

const lum = hex => {
  const c = hex.replace('#','');
  const [r,g,b] = [0,2,4].map(i => parseInt(c.slice(i,i+2),16)/255)
    .map(v => v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055) ** 2.4);
  return 0.2126*r + 0.7152*g + 0.0722*b;
};
const razao = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((m,n)=>n-m); return (x+0.05)/(y+0.05); };

// mistura rgba(...) sobre um fundo, do jeito que o navegador faz
const sobre = (rgba, fundo) => {
  const m = rgba.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return rgba;
  const [, r, g, b, a = 1] = m.map(Number);
  const f = fundo.replace('#','');
  const [fr, fg, fb] = [0,2,4].map(i => parseInt(f.slice(i,i+2),16));
  const mix = (c, fc) => Math.round(c * a + fc * (1 - a));
  return '#' + [mix(r,fr), mix(g,fg), mix(b,fb)].map(v => v.toString(16).padStart(2,'0')).join('');
};

/* Cada par com o mínimo que o papel dele exige:
   4.5 texto normal · 3.0 texto grande, ícone e borda de componente */
const PARES = [
  ['texto no fundo',           p => [p.fg, p.bg], 4.5],
  ['texto no cartão',          p => [p.fg, p.surface], 4.5],
  ['secundário no fundo',      p => [p.dim, p.bg], 4.5],
  ['secundário no cartão',     p => [p.dim, p.surface], 4.5],
  ['acento em texto (fundo)',  p => [p.accentTxt, p.bg], 4.5],
  ['acento em texto (cartão)', p => [p.accentTxt, p.surface], 4.5],
  ['acento como preenchimento',p => [p.accent, p.bg], 3.0],
  ['tinta sobre o acento',     p => [p.ink, p.accent], 4.5],
  ['borda de componente',      p => [sobre(p.line2, p.bg), p.bg], 3.0],
  ['divisória',                p => [sobre(p.line, p.bg), p.bg], 1.8],
];

let reprovados = 0;
for (const pal of PALETTES) {
  const linhas = PARES.map(([nome, par, min]) => {
    const [a, b] = par(pal.vars);
    const r = razao(a, b);
    const ok = r >= min;
    if (!ok) reprovados++;
    return `    ${ok ? 'ok ' : 'RUIM'} ${nome.padEnd(22)} ${r.toFixed(2).padStart(5)} (mín ${min})`;
  });
  const ruins = linhas.filter(l => l.includes('RUIM'));
  console.log(`\n${pal.name.toUpperCase()}${ruins.length ? '  ← ' + ruins.length + ' problema(s)' : '  ✓'}`);
  linhas.forEach(l => { if (l.includes('RUIM')) console.log(l); });
}
console.log(reprovados
  ? `\n${reprovados} par(es) reprovados`
  : '\ntodas as paletas passam no contraste exigido');
process.exit(reprovados ? 1 : 0);
