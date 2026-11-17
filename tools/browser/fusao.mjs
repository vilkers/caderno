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
await p.evaluate(async()=>{const s=await import('./js/store.js');
  s.setProfile({nome:'Vilker'}); s.emit('replace');});
await p.waitForTimeout(1400);
for (let i=0;i<4;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);} 

console.log('barra de baixo:', await p.$$eval('.nav__l', ns=>ns.map(n=>n.textContent).join(' · ')));
console.log('atalho de insights no topo sumiu:', await p.$$eval('#insightsBtn', n=>n.length) === 0);
const barra = await p.$$eval('.nav__item', ns=>ns.map(n=>n.dataset.view));
if (barra.join(',') !== 'hoje,mes,insights') errs.push('a barra de baixo não é hoje/mes/insights: ' + barra.join(','));

/* A aba Lista (tarefas, contas, assinaturas, carteira) saiu do Caderno:
   tarefas foram para tarefas/ e o resto para financeiro/. Os atalhos
   antigos ?v=lista e ?v=agenda agora levam para esses apps. */
for (const [atalho, destino] of [['lista','/tarefas/'],['agenda','/financeiro/']]) {
  await p.goto(BASE + '/index.html?v=' + atalho, { waitUntil:'domcontentloaded' });
  await p.waitForURL(u => u.pathname.endsWith(destino), { timeout: 5000 }).catch(()=>{});
  const foi = new URL(p.url()).pathname;
  console.log(`?v=${atalho} leva para:`, foi);
  if (!foi.endsWith(destino)) errs.push(`?v=${atalho} não levou para ${destino}`);
}
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.fill('#lockPass','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(1200);
for (let i=0;i<4;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);}
// insights pela barra
await p.click('.nav__item[data-view="insights"]'); await p.waitForTimeout(800);
console.log('insights pela barra:', await p.$eval('.vhead h2', n=>n.textContent), '| topo mostra avatar:', await p.$$eval('#identAv img, #identAv .avatar', n=>n.length) >= 0 ? await p.$$eval('.ident__voltar', n=>n.length) === 0 : false);
// metas pelo menu
await p.click('#menuBtn'); await p.waitForTimeout(400);
console.log('menu:', await p.$$eval('.menuitem .row__t', ns=>ns.map(n=>n.textContent).join(' · ')));
await p.click('.menuitem:has-text("Metas")'); await p.waitForTimeout(800);
console.log('metas:', await p.$eval('.vhead h2', n=>n.textContent), '| topo:', await p.$eval('#identNome', n=>n.textContent));
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
