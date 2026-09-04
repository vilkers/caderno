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
  s.addAgenda({emoji:'💜',label:'Cartão Nubank',tipo:'cartao',dia:10,valor:1240});
  s.addAgenda({emoji:'🏠',label:'Aluguel',tipo:'aluguel',dia:5,valor:2300});
  s.addAgenda({emoji:'📄',label:'Emitir a NF',tipo:'nf',dia:1});
  s.addAgenda({emoji:'🎧',label:'Spotify',tipo:'assinatura',dia:5,valor:21.9});
  s.addAgenda({emoji:'💰',label:'Agência',tipo:'renda',dia:10,valor:5000});
  s.setProfile({nome:'Vilker'}); s.emit('replace');});
await p.waitForTimeout(1400);
for (let i=0;i<4;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);} 

console.log('barra de baixo:', await p.$$eval('.nav__l', ns=>ns.map(n=>n.textContent).join(' · ')));
console.log('atalho de insights no topo sumiu:', await p.$$eval('#insightsBtn', n=>n.length) === 0);
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(800);
console.log('abas:', await p.$$eval('.aba__t', ns=>ns.map(n=>n.textContent).join(' · ')));
console.log('resumos:', await p.$$eval('.aba__n', ns=>ns.map(n=>n.textContent).join(' | ')));
await p.click('.aba:has-text("Contas")'); await p.waitForTimeout(800);
console.log('contas:', await p.$eval('.vhead h2', n=>n.textContent), '| anel:', await p.$eval('.g-anel__n', n=>n.textContent),
  '| linhas:', await p.$$eval('.agitem', n=>n.length), '| assinatura fora:', !(await p.$$eval('.agitem__t', ns=>ns.some(n=>/Spotify/.test(n.textContent)))));
console.log('nav de mês na aba contas:', await p.$$eval('.mesnav', n=>n.length));
await p.screenshot({path:SHOT+'/x1-contas.png', fullPage:true});
await p.click('.agitem .agitem__check'); await p.waitForTimeout(700);
console.log('marcou:', await p.eval ? '' : '', await p.$eval('.g-anel__n', n=>n.textContent));
// botões de criar dentro da própria aba
console.log('botões da aba:', await p.$$eval('.painel > .wrap .btn span', ns=>ns.map(n=>n.textContent).join(' · ')));
// atalho ?v=agenda cai na aba
await p.goto(BASE + '/index.html?v=agenda',{waitUntil:'networkidle'});
await p.fill('#lockPass','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(1200);
console.log('?v=agenda cai em:', await p.$eval('.vhead h2', n=>n.textContent), '| aba ativa:', await p.$eval('.aba.is-on .aba__t', n=>n.textContent));
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
