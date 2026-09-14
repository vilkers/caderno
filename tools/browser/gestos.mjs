/* Gestos que disputam o mesmo movimento.

   O caso que quebrou: arrastar a roleta do sono pro lado mudava o dia, porque
   o `onSwipe` da tela e a rolagem do mostrador são o mesmo gesto. Vale pros
   cinco elementos que rolam de lado por cima do swipe — a faixa de dias e as
   pílulas de filtro incluídas. */

import { chromium, BASE } from './_comum.mjs';

const errs = [];
const checa = (nome, cond, extra = '') => {
  console.log(`${nome}: ${cond ? 'ACERTOU' : 'errou'}${extra}`);
  if (!cond) errs.push(nome);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await p.fill('#lockPass', 'senha1234'); await p.fill('#lockPass2', 'senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(900);
for (let i = 0; i < 3; i++) { if (await p.$eval('#sheet', n => n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300); }

const diaNaTela = () => p.$eval('.daynav__label', n => n.textContent.trim());

/* arrasta de lado DENTRO de um elemento e diz se o dia mudou */
const arrastarDentro = async sel => {
  const alvo = p.locator(sel).first();
  await alvo.evaluate(n => n.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(400);
  const cx = await alvo.boundingBox();
  const y = cx.y + cx.height / 2;
  await p.touchscreen.tap(2, 2).catch(() => {});
  await p.evaluate(async ([x0, y0, x1]) => {
    const alvo = document.elementFromPoint(x0, y0);
    const toque = (t, x) => alvo.dispatchEvent(new TouchEvent(t, {
      bubbles: true, cancelable: true,
      touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: alvo, clientX: x, clientY: y0 })],
      changedTouches: [new Touch({ identifier: 1, target: alvo, clientX: x, clientY: y0 })],
    }));
    toque('touchstart', x0);
    for (let x = x0; x >= x1; x -= 12) { toque('touchmove', x); await new Promise(r => setTimeout(r, 12)); }
    toque('touchend', x1);
  }, [cx.x + cx.width - 20, y, cx.x + 20]);
  await p.waitForTimeout(800);
};

const antesRoleta = await diaNaTela();
await arrastarDentro('.roleta__t');
checa('arrastar a roleta NÃO muda o dia', (await diaNaTela()) === antesRoleta, ` (${antesRoleta} → ${await diaNaTela()})`);

const antesStrip = await diaNaTela();
await arrastarDentro('.strip');
checa('arrastar a faixa de dias NÃO muda o dia', (await diaNaTela()) === antesStrip, ` (${antesStrip} → ${await diaNaTela()})`);

/* e o gesto continua funcionando onde ele é dono: no corpo da tela */
const antesFundo = await diaNaTela();
await p.evaluate(async () => {
  const alvo = document.querySelector('.entry__label') || document.querySelector('#main');
  const y = alvo.getBoundingClientRect().top + 10;
  const toque = (t, x) => alvo.dispatchEvent(new TouchEvent(t, {
    bubbles: true, cancelable: true,
    touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: alvo, clientX: x, clientY: y })],
    changedTouches: [new Touch({ identifier: 1, target: alvo, clientX: x, clientY: y })],
  }));
  toque('touchstart', 320);
  for (let x = 320; x >= 60; x -= 20) { toque('touchmove', x); await new Promise(r => setTimeout(r, 10)); }
  toque('touchend', 60);
});
await p.waitForTimeout(900);
checa('arrastar o corpo da tela AINDA muda o dia', (await diaNaTela()) !== antesFundo, ` (${antesFundo} → ${await diaNaTela()})`);

console.log('erros:', errs.length ? errs.join(', ') : 'nenhum');
await b.close();
process.exit(errs.length ? 1 : 0);
