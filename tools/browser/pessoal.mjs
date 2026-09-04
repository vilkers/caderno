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
for (let i=0;i<4;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);} 

await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(700);
await p.click('.aba:has-text("Assinaturas")'); await p.waitForTimeout(600);
await p.click('.btn:has-text("sugestões")'); await p.waitForTimeout(700);
console.log('título das sugestões:', await p.$eval('#sheetTitle', n=>n.textContent));
console.log('só assinaturas?', await p.$$eval('#sheetBody .chip', ns=>ns.map(n=>n.textContent.trim())));
for (const nome of ['Spotify','Netflix','Claude']) { await p.click(`#sheetBody .chip:has-text("${nome}")`); await p.waitForTimeout(150); }
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(700);
// valores
for (const [nome, val] of [['Spotify','21,90'],['Netflix','44,90'],['Claude','120']]) {
  await p.click(`.agitem:has-text("${nome}") .agitem__l`); await p.waitForTimeout(500);
  await p.fill('#sheetBody input[aria-label="Valor"]', val);
  await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(600);
}
console.log('total de assinatura:', await p.$eval('.totalzao__n', n=>n.textContent));
console.log('barras:', await p.$$eval('.g-barra', n=>n.length));
await p.screenshot({path:SHOT+'/p1-assinaturas.png', fullPage:true});

// carteira
await p.click('.aba:has-text("Carteira")'); await p.waitForTimeout(700);
console.log('carteira começa:', await p.$$eval('.empty b', n=>n.map(x=>x.textContent)), await p.$$eval('.btn', ns=>ns.map(n=>n.textContent.trim()).filter(t=>t.startsWith('+'))));
// a receber
await p.click('.btn:has-text("+ a receber")'); await p.waitForTimeout(600);
await p.fill('#sheetBody input[aria-label="Nome"]','Pagamento da agência');
await p.fill('#sheetBody input[aria-label="Valor"]','5000');
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(700);
// a pagar
await p.click('.btn:has-text("+ a pagar")'); await p.waitForTimeout(600);
await p.fill('#sheetBody input[aria-label="Nome"]','Devo pro Léo');
await p.fill('#sheetBody input[aria-label="Valor"]','300');
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(800);
console.log('saldo:', await p.$eval('.totalzao .micro', n=>n.textContent), '|', await p.$eval('.totalzao__n', n=>n.textContent));
console.log('blocos:', await p.$$eval('.carteirabloco .micro', ns=>ns.map(n=>n.textContent)));
console.log('linhas:', await p.$$eval('.agitem__t', ns=>ns.map(n=>n.textContent.trim())));
console.log('resumo das abas:', await p.$$eval('.aba__n', ns=>ns.map(n=>n.textContent)));
await p.screenshot({path:SHOT+'/p2-carteira.png', fullPage:true});
// marcar recebido
await p.click('.agitem:has-text("Pagamento") .agitem__check'); await p.waitForTimeout(700);
console.log('depois de marcar recebido:', await p.$$eval('.carteirabloco .dinheiro__f', ns=>ns.map(n=>n.textContent)));
// andar pelos meses
console.log('mês atual:', await p.$eval('.mesnav .daynav__label', n=>n.textContent));
await p.click('.mesnav .iconbtn'); await p.waitForTimeout(700);
console.log('mês anterior:', await p.$eval('.mesnav .daynav__label', n=>n.textContent),
  '| itens:', await p.$$eval('.agitem', n=>n.length),
  '| botão de voltar pro mês:', await p.$$eval('.mesnav .chip', n=>n.length));
await p.click('.mesnav .chip'); await p.waitForTimeout(600);
console.log('voltou pra:', await p.$eval('.mesnav .daynav__label', n=>n.textContent));
await p.click('.aba:has-text("Tarefas")'); await p.waitForTimeout(500);
console.log('aba tarefas não mostra nav de mês:', await p.$$eval('.mesnav', n=>n.length) === 0);
console.log('menu sem marcação rápida:', await p.evaluate(async () => {
  document.querySelector('#menuBtn').click();
  await new Promise(r => setTimeout(r, 500));
  const itens = [...document.querySelectorAll('.menuitem .row__t')].map(n => n.textContent);
  return !itens.some(t => /marcação rápida/i.test(t)) ? 'sim ✓ — ' + itens.join(', ') : 'AINDA ESTÁ LÁ';
}));
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
