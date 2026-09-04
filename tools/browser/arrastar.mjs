import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const errs=[];
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:440,height:956} });
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.fill('#lockPass','s1234'); await p.fill('#lockPass2','s1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(500);
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(500);
for (const t of ['primeira','segunda','terceira','quarta']) {
  await p.fill('.todoadd input', t); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
}
const ordem = async () => p.$$eval('.todo .todo__txt', n=>n.map(x=>x.textContent));
console.log('ordem inicial:', await ordem());

// arrasta a primeira para o fim
const pegas = await p.$$('.todo__pega:not(.is-off)');
const cxA = await pegas[0].boundingBox();
const ultimo = (await p.$$('.todo'))[3];
const cxB = await ultimo.boundingBox();
await p.mouse.move(cxA.x + cxA.width/2, cxA.y + cxA.height/2);
await p.mouse.down();
for (let i=1;i<=12;i++) { await p.mouse.move(cxA.x + cxA.width/2, cxA.y + (cxB.y + cxB.height - cxA.y) * i/12); await p.waitForTimeout(25); }
await p.mouse.up(); await p.waitForTimeout(600);
console.log('depois de arrastar a 1ª pro fim:', await ordem());

// teclado
await p.focus('.todo:last-child .todo__pega');
await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300);
console.log('depois de ↑ no teclado:', await ordem());

// persiste?
await p.reload({waitUntil:'networkidle'});
await p.fill('#lockPass','s1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(600);
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(600);
console.log('depois de recarregar:', await ordem());

// concluir não bagunça
await p.click('.todo:first-child .todo__box'); await p.waitForTimeout(700);
await p.click('.chip:has-text("todas")'); await p.waitForTimeout(500);
console.log('com uma concluída (todas):', await ordem());
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
