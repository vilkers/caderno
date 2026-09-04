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
  /* Os dias saem do dia de hoje, não de números fixos: a faixa do check-in
     só mostra o que vence hoje ou já passou, então um "dia 5" cravado fazia
     o teste passar em setembro e falhar no dia 4. */
  const hj = new Date().getDate();
  const antes = Math.max(1, hj - 2);
  store.addAgenda({ emoji:'💜', label:'Cartão Nubank', tipo:'cartao', dia:antes, valor:1240 });
  store.addAgenda({ emoji:'🏠', label:'Aluguel', tipo:'aluguel', dia:hj, valor:2300 });
  store.addAgenda({ emoji:'🎧', label:'Spotify', tipo:'assinatura', dia:hj, valor:21.9 });
  store.emit('replace');
});
await p.waitForTimeout(1600);
if (!(await p.$eval('#sheet', n=>n.hidden))) { await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(400); }
// faixa do mês no Hoje
console.log('faixa do mês no hoje:', await p.$$eval('.hojeagenda .agitem', ns=>ns.map(n=>n.innerText.replace(/\n/g,' · ')).join(' | ')) );
await p.click('.hojeagenda .agitem__check'); await p.waitForTimeout(700);
console.log('marcou pelo hoje:', await p.evaluate(async()=>{const s=await import('./js/store.js');const m=new Date().toISOString().slice(0,7);return s.listAgenda().filter(a=>s.agendaFeito(a,m)).map(a=>a.label);}));

await p.click('.nav__item[data-view="mes"]'); await p.waitForTimeout(1200);
console.log('anéis:', await p.$$eval('.cal__anel', n=>n.length), '| colunas:', await p.$$eval('.cal__vol', n=>n.length), '| marcas de agenda:', await p.$$eval('.cal__ag', n=>n.length));
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
