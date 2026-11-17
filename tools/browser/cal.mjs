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
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(700);
await p.evaluate(async () => {
  const store = await import('./js/store.js'); const { keyOf } = await import('./js/utils.js');
  const cats = store.activeCategories(); const by = n => cats.find(c=>c.label.toLowerCase().startsWith(n))?.id;
  const hoje = new Date();
  for (let i=0;i<26;i++){ const d=new Date(hoje); d.setDate(d.getDate()-i);
    if (i%5===3) continue;
    const v={}; v[by('academia')]= i%2===0; v[by('trabalho')]=6+(i%4); v[by('sono')]=6+(i%3); v[by('passeio')]=1+(i%2);
    if (i%3===0) v[by('bebida')]=2+(i%5);
    store.state.days[keyOf(d)]={v,note: i===1?'dia puxado':'',closed: i%4!==1,updatedAt:Date.now()}; }
  /* As contas (addAgenda) e a faixa do mês no Hoje mudaram para o app
     financeiro/; aqui fica só o calendário de hábitos. */
  store.emit('replace');
});
await p.waitForTimeout(1600);
if (!(await p.$eval('#sheet', n=>n.hidden))) { await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(400); }
await p.click('.nav__item[data-view="mes"]'); await p.waitForTimeout(1200);
console.log('anéis:', await p.$$eval('.cal__anel', n=>n.length), '| colunas:', await p.$$eval('.cal__vol', n=>n.length));
console.log('legenda:', await p.$$eval('.legend__i', ns=>ns.map(n=>n.textContent).join(' | ')));
console.log('resumo do mês:', await p.$eval('.mesgraf .g-anel__n', n=>n.textContent), await p.$eval('.mesgraf .g-anel__suf', n=>n.textContent), '| colunas semana:', await p.$$eval('.mesgraf .g-coluna', n=>n.length));
console.log('stats:', await p.$$eval('.stat', ns=>ns.map(n=>n.innerText.replace(/\n/g,' ')).join(' | ')));
for (const y of [0,500,1000,1500]) { await p.evaluate(y=>window.scrollTo(0,y), y); await p.waitForTimeout(300); }
await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(400);
await p.screenshot({path:SHOT+'/c1-mes.png', fullPage:true});
// prévia
await p.click('.cal__day.has-data:not(.is-out)'); await p.waitForTimeout(800);
console.log('prévia:', await p.$eval('#sheetTitle', n=>n.textContent), '|', await p.$eval('#sheetBody .status__t', n=>n.textContent));
console.log('chips marcados:', await p.$$eval('#sheetBody .chip', ns=>ns.length));
await p.screenshot({path:SHOT+'/c2-previa.png'});
await p.click('#sheetBody .sheet__actions .btn--solid'); await p.waitForTimeout(800);
console.log('abriu o dia:', await p.$eval('.vhead h2', n=>n.textContent));
// filtro de categoria
await p.click('.nav__item[data-view="mes"]'); await p.waitForTimeout(900);
await p.click('.chip:has-text("Bebida")'); await p.waitForTimeout(900);
console.log('mapa de calor:', await p.$$eval('.cal__day.is-quente', n=>n.length), '| sparkline:', await p.$$eval('.g-linha', n=>n.length));
console.log('stats do filtro:', await p.$$eval('.stat', ns=>ns.map(n=>n.innerText.replace(/\n/g,' ')).join(' | ')));
await p.screenshot({path:SHOT+'/c3-calor.png', fullPage:true});
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
