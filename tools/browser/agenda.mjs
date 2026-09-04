import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const errs=[];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:440,height:956}, deviceScaleFactor:2 });
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(800);
if (!(await p.$eval('#sheet', n=>n.hidden))) { await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(400); }

// menu → agenda (vazia)
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(600);
await p.click('.aba:has-text("Contas")'); await p.waitForTimeout(800);
console.log('contas vazias:', await p.$eval('.empty b', n=>n.textContent));
// as sugestões agora saem da própria aba
await p.click('.empty .btn--solid'); await p.waitForTimeout(700);
console.log('grupos de sugestão:', await p.$$eval('#sheetBody .micro', ns=>ns.map(n=>n.textContent).join(' | ')));
for (const nome of ['Cartão Nubank','Cartão Itaú','Aluguel','Luz','Emitir a NF da agência']) {
  await p.click(`#sheetBody .chip:has-text("${nome}")`); await p.waitForTimeout(150);
}
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(700);
// a lista completa mora na aba Contas agora, não mais em Ajustes
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(600);
await p.click('.aba:has-text("Contas")'); await p.waitForTimeout(800);
await p.click('.linhatudo'); await p.waitForTimeout(700);
console.log('lista completa:', await p.$$eval('#sheetBody .tudoitem', ns=>ns.length));
console.log('primeiro item:', await p.$eval('#sheetBody .tudoitem .micro', n=>n.textContent));
await p.screenshot({path:SHOT+'/a1-tudo.png'});

// põe valor no aluguel, pela lista completa
await p.click('#sheetBody .tudoitem:has-text("Aluguel") .tudoitem__l'); await p.waitForTimeout(600);
await p.fill('#sheetBody input[aria-label="Valor"]', '2300');
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(700);
for (let i=0;i<3;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
await p.click('.aba:has-text("Contas")').catch(()=>{}); await p.waitForTimeout(600);
console.log('contas:', await p.$eval('.vhead h2', n=>n.textContent), '|', await p.$eval('.status__t', n=>n.textContent));
console.log('linhas:', await p.$$eval('.agitem', ns=>ns.length), '| marcos de dia:', await p.$$eval('.agdia', ns=>ns.length));
await p.click('.agitem .agitem__check'); await p.waitForTimeout(700);
console.log('depois de marcar:', await p.$eval('.g-anel__n', n=>n.textContent));
await p.screenshot({path:SHOT+'/a2-agenda.png', fullPage:true});

// área pessoal
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(800);
console.log('abas:', await p.$$eval('.aba', ns=>ns.map(n=>n.innerText.replace(/\n/g,'/')).join(' | ')));
await p.click('.aba:has-text("Assinaturas")'); await p.waitForTimeout(800);
await p.click('.btn:has-text("sugestões")'); await p.waitForTimeout(700);
await p.click('#sheetBody .chip:has-text("Spotify")'); await p.waitForTimeout(200);
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(700);
await p.click('.agitem:has-text("Spotify") .agitem__l'); await p.waitForTimeout(600);
await p.fill('#sheetBody input[aria-label="Valor"]', '21,90');
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(800);
console.log('assinaturas:', await p.$eval('.totalzao__n', n=>n.textContent), '|', await p.$eval('.totalzao .nota-pe', n=>n.textContent));
console.log('barras:', await p.$$eval('.g-barra', ns=>ns.length));
await p.screenshot({path:SHOT+'/a3-assinaturas.png', fullPage:true});
await p.click('.aba:has-text("Carteira")'); await p.waitForTimeout(800);
console.log('carteira vazia?', await p.$$eval('.empty', ns=>ns.length));
// lança uma entrada pela própria carteira
await p.click('.btn:has-text("+ a receber")'); await p.waitForTimeout(700);
await p.fill('#sheetBody input[aria-label="Nome"]', 'Pagamento da agência');
await p.fill('#sheetBody input[aria-label="Valor"]', '4200');
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(800);
console.log('saldo do mês:', await p.$eval('.totalzao .micro', n=>n.textContent), '→', await p.$eval('.totalzao__n', n=>n.textContent));
console.log('blocos da carteira:', await p.$$eval('.carteirabloco .section__h .micro', ns=>ns.map(n=>n.textContent).join(' | ')));
await p.screenshot({path:SHOT+'/a4-carteira.png', fullPage:true});
await p.click('.aba:has-text("Tarefas")'); await p.waitForTimeout(600);
console.log('tarefas ainda funcionam:', await p.$$eval('.todoadd', ns=>ns.length));

console.log('nenhum "null" na tela:', await p.evaluate(()=>!document.body.innerText.includes('null')));
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
