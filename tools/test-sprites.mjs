/* Confere se todo sprite é retangular — uma linha torta estraga o desenho
   inteiro e é o erro mais fácil de cometer escrevendo pixel art à mão.
   Rode com: node tools/test-sprites.mjs */

import { SPRITES } from '../retro/js/sprites.js';

let falhas = 0;
for (const [nome, m] of Object.entries(SPRITES)) {
  const w = m[0].length;
  const torta = m.findIndex(l => l.length !== w);
  if (torta >= 0) {
    console.log(`  FALHOU ${nome}: linha ${torta} tem ${m[torta].length}, esperado ${w}`);
    falhas++;
  } else {
    console.log(`  ok  ${nome} ${w}×${m.length}`);
  }
}
console.log(falhas ? `\n${falhas} sprite(s) tortos` : '\ntodos os sprites fecham certinho');
process.exit(falhas ? 1 : 0);
