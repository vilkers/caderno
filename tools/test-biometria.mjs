/* Testa o miolo do Face ID sem WebAuthn no meio: a chave derivada do PRF,
   e o selo que guarda a senha.  Rode com: node tools/test-biometria.mjs

   O que importa aqui é que o selo só abre com o MESMO segredo do aparelho —
   se isso quebrar, o botão do rosto vira uma porta destrancada. */

import { chaveDePrf, selar, abrirSelo } from '../js/biometria.js';

let falhas = 0;
const ok = (cond, nome) => {
  console.log(`${cond ? '  ok ' : '  FALHOU '} ${nome}`);
  if (!cond) falhas++;
};

const prf = crypto.getRandomValues(new Uint8Array(32));
const outro = crypto.getRandomValues(new Uint8Array(32));
const salt = crypto.getRandomValues(new Uint8Array(16));
const SENHA = 'a senha do caderno 123';

console.log('selo da senha');
{
  const k = await chaveDePrf(prf, salt);
  const selo = await selar(k, SENHA);
  ok(!JSON.stringify(selo).includes(SENHA), 'a senha não aparece em texto no que é gravado');
  ok(await abrirSelo(await chaveDePrf(prf, salt), selo) === SENHA,
    'o mesmo PRF e o mesmo sal devolvem a senha');

  let abriu = true;
  try { await abrirSelo(await chaveDePrf(outro, salt), selo); }
  catch { abriu = false; }
  ok(!abriu, 'outro aparelho (outro PRF) não abre');

  abriu = true;
  const outroSal = crypto.getRandomValues(new Uint8Array(16));
  try { await abrirSelo(await chaveDePrf(prf, outroSal), selo); }
  catch { abriu = false; }
  ok(!abriu, 'o PRF certo com o sal trocado também não abre');

  const s2 = await selar(k, SENHA);
  ok(s2.iv !== selo.iv && s2.ct !== selo.ct, 'cada selo tem IV novo — nunca dois iguais');
}

console.log('\nsenha com acento e emoji');
{
  const bruta = 'çãôü 🐾 senha';
  const k = await chaveDePrf(prf, salt);
  ok(await abrirSelo(k, await selar(k, bruta)) === bruta, 'volta byte a byte');
}

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
