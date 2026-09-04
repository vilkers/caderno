import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const errs=[];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(900);
if (!(await p.$eval('#sheet', n=>n.hidden))) { await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(400); }

// o formulário completo mora na aba Contas agora
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(700);
await p.click('.aba:has-text("Contas")'); await p.waitForTimeout(800);
await p.click('.empty .btn:has-text("do zero"), .painel .btn--solid:has-text("novo compromisso")'); await p.waitForTimeout(800);
console.log('abriu:', await p.$eval('#sheetTitle', n=>n.textContent));
await p.screenshot({path:SHOT+'/n1-form.png'});

// mede overflow do painel
console.log('largura do painel vs conteúdo:', await p.evaluate(()=>{
  const b=document.querySelector('#sheetBody');
  return `${b.clientWidth} / ${b.scrollWidth}` + (b.scrollWidth>b.clientWidth+1 ? '  ← ESTOURA' : '  ok');
}));
console.log('campos visíveis:', await p.$$eval('#sheetBody .field', ns=>ns.map(n=>{
  const r=n.getBoundingClientRect(); const t=n.querySelector('.micro')?.textContent;
  return `${t}: ${Math.round(r.width)}px ${getComputedStyle(n).opacity}`;
}).join(' | ')));

await p.fill('#sheetBody input[aria-label="Nome"]', 'Cartão Itaú');
// valor com vírgula, como o teclado brasileiro entrega
const campoValor = p.locator('#sheetBody input[aria-label="Valor"]');
await campoValor.click();
await p.keyboard.type('1234,56');
console.log('valor digitado "1234,56" →', JSON.stringify(await campoValor.inputValue()));
console.log('o que o app leu:', await p.evaluate(()=>{
  const i=document.querySelector('#sheetBody input[aria-label="Valor"]'); return i.value===''?'VAZIO (perdeu o número)':i.value;
}));
await p.selectOption('#sheetBody select.minisel >> nth=1', '7').catch(e=>console.log('erro no dia:', e.message.split('\n')[0]));
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(800);
console.log('criado:', await p.evaluate(async()=>{const s=await import('./js/store.js');const a=s.listAgenda().at(-1);return a?`${a.label} · dia ${a.dia} · valor ${a.valor} · tipo ${a.tipo}`:'nada';}));
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
