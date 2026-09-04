import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const errs=[];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, hasTouch:true, isMobile:true })).newPage();
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(900);
await p.evaluate(async()=>{const s=await import('./js/store.js');s.setProfile({nome:'Vilker'});s.emit('replace');});
await p.waitForTimeout(900);
for (let i=0;i<4;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);} 

await p.click('#menuBtn'); await p.waitForTimeout(700);
console.log('menu:', await p.$$eval('.menuitem .row__t', ns=>ns.map(n=>n.textContent).join(' · ')));
console.log('itens que nascem fora da tela:', await p.evaluate(()=>{
  const alt = innerHeight;
  return [...document.querySelectorAll('.menuitem')].filter(n=>n.getBoundingClientRect().top > alt).length;
}));
await p.screenshot({path:SHOT+'/m1-menu.png'});
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(600);
await p.click('.aba:has-text("Contas")'); await p.waitForTimeout(800);

console.log('topo em tela secundária:', await p.$eval('#identNome', n=>n.textContent), '|', await p.$eval('#topDate', n=>n.textContent), '| seta:', await p.$$eval('.ident__voltar', n=>n.length));
await p.screenshot({path:SHOT+'/m2-topo-secundaria.png'});
// rola até o fim e volta pelo topo (que é fixo)
await p.evaluate(()=>window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(500);
console.log('barra de cima visível no fim da página:', await p.evaluate(()=>{
  const r = document.querySelector('.topbar').getBoundingClientRect(); return r.top >= -1 && r.bottom > 0;
}));
await p.click('#identBtn'); await p.waitForTimeout(800);
console.log('voltou pra:', await p.$eval('.vhead h2', n=>n.textContent), '| topo:', await p.$eval('#identNome', n=>n.textContent));

// perfil sem o bloco duplicado
await p.click('#identBtn'); await p.waitForTimeout(800);
console.log('perfil:', await p.$eval('.vhead h2', n=>n.textContent), '| atalhos duplicados:', await p.$$eval('.atalho', n=>n.length));
await p.click('.ident'); await p.waitForTimeout(700);
console.log('do perfil, o topo volta pra:', await p.$eval('.vhead h2', n=>n.textContent));

// metas sem voltar
await p.click('#menuBtn'); await p.waitForTimeout(400);
await p.click('.menuitem:has-text("Metas")'); await p.waitForTimeout(800);
console.log('metas tem botão voltar?', await p.$$eval('.vhead__r .btn', n=>n.length) > 0 ? 'sim (ruim)' : 'não ✓');

// ajustes mais curto + paleta em linha
await p.click('#menuBtn'); await p.waitForTimeout(400);
await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(900);
console.log('altura de ajustes:', await p.evaluate(()=>Math.round(document.documentElement.scrollHeight)) + 'px',
  '| grade de paleta na tela:', await p.$$eval('.palettes', n=>n.length));
await p.click('.row:has-text("Cores do app") .btn'); await p.waitForTimeout(700);
console.log('folha de paleta abriu:', await p.$eval('#sheetTitle', n=>n.textContent), '| opções:', await p.$$eval('#sheetBody .pal', n=>n.length));
await p.click('#sheetBody .pal >> nth=4'); await p.waitForTimeout(800);
console.log('trocou a paleta:', await p.evaluate(()=>document.documentElement.dataset.palette));
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
