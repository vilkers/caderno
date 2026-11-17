import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:393,height:852}, hasTouch:true, isMobile:true })).newPage();
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(700);
/* Tarefas e contas saíram do Caderno (tarefas/ e financeiro/), então os
   alvos de "mais", caixa e data da tarefa e o check da agenda não moram
   mais aqui. Ficam a roleta e o interruptor. */
await p.waitForTimeout(500);
for (let i=0;i<4;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);} 

/* Um placar de verdade: antes o teste imprimia "errou" e a bateria seguia
   dizendo "ok", então alvo de toque podia encolher sem ninguém ver. */
const falhas = [];
const checa = (nome, cond, extra = '') => {
  console.log(`${nome}: ${cond ? 'ACERTOU' : 'errou'}${extra}`);
  if (!cond) falhas.push(nome);
};

const tocarPerto = async (sel, dy) => {
  /* Ao centro, não "se precisar": a barra de baixo é fixa e o navegador
     considera visível o que está debaixo dela — o toque ia parar na barra. */
  await p.locator(sel).first().evaluate(n => n.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(350);
  const box = await p.locator(sel).first().boundingBox();
  await p.mouse.click(box.x + box.width/2, dy < 0 ? box.y + dy : box.y + box.height + dy);
  await p.waitForTimeout(400);
};

// roleta 0–10: cada valor tem a largura inteira dele como alvo, e o mostrador
// tem 56px de altura — o medidor de barrinhas de 23px saiu justamente por isso
const alvoRoleta = await p.evaluate(()=>{
  const v = document.querySelector('.roleta__v'); if(!v) return null;
  const r = v.getBoundingClientRect();
  return { largura: Math.round(r.width), altura: Math.round(r.height) };
});
checa('cada valor da roleta tem 44px de alvo', alvoRoleta && alvoRoleta.largura >= 44 && alvoRoleta.altura >= 44,
      ` (${alvoRoleta?.largura}×${alvoRoleta?.altura}px)`);
// tocar num vizinho centraliza ele e grava
const antesRoleta = await p.evaluate(()=>document.querySelector('.roleta__v.is-centro')?.textContent);
await p.evaluate(()=>{
  const vs = [...document.querySelectorAll('.roleta__v')];
  const i = vs.findIndex(v=>v.classList.contains('is-centro'));
  vs[i+2]?.click();
});
await p.waitForTimeout(900);
const depoisRoleta = await p.evaluate(()=>document.querySelector('.roleta__v.is-centro')?.textContent);
checa('tocar num valor vizinho traz ele pro centro', antesRoleta !== depoisRoleta, ` (${antesRoleta}→${depoisRoleta})`);

// interruptor em ajustes
await p.click('#menuBtn'); await p.waitForTimeout(300);
await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(900);
const s1 = await p.evaluate(()=>document.querySelector('.switch').getAttribute('aria-checked'));
await tocarPerto('.switch', -5);
const s2 = await p.evaluate(()=>document.querySelector('.switch').getAttribute('aria-checked'));
checa('interruptor 5px acima', s1 !== s2);

console.log('erros:', falhas.length ? falhas.join(', ') : 'nenhum');
await b.close();
