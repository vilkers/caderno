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
  for (let i=0;i<70;i++){ const d=new Date(hoje); d.setDate(d.getDate()-i);
    if (i%7===5) continue;
    const v={}; v[by('academia')]= i%2===0; v[by('trabalho')]=6+(i%4); v[by('sono')]=6+(i%3); v[by('passeio')]=1+(i%2);
    v[by('louça')] = i%3!==0;
    if (i%9===0) v[by('bebida')]=3+(i%5);
    store.state.days[keyOf(d)]={v,note:'',closed: i%4!==1,updatedAt:Date.now()}; }
  ['comprar café','levar o Estojo ao vet','pagar o IPTU'].forEach(t => { const x = store.addTodo(t); store.updateTodo(x.id,{done:true}); });
  store.addAgenda({ emoji:'🎧', label:'Spotify', tipo:'assinatura', dia:5, valor:21.9 });
  store.addAgenda({ emoji:'🎬', label:'Netflix', tipo:'assinatura', dia:15, valor:44.9 });
  store.addAgenda({ emoji:'☁️', label:'Google', tipo:'assinatura', dia:8, valor:9.99 });
  store.addAgenda({ emoji:'💜', label:'Cartão Nubank', tipo:'cartao', dia:10, valor:1240 });
  store.addAgenda({ emoji:'🏠', label:'Aluguel', tipo:'aluguel', dia:5, valor:2300 });
  store.addAgenda({ emoji:'📄', label:'Emitir a NF', tipo:'nf', dia:1 });
  store.emit('replace');
});
await p.waitForTimeout(1800);
if (!(await p.$eval('#sheet', n=>n.hidden))) { await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(400); }
await p.click('#menuBtn'); await p.waitForTimeout(350);
await p.click('.menuitem:has-text("Retrospectiva")'); await p.waitForTimeout(1200);
const total = await p.$$eval('.resumo__trilha', n=>n.length);
console.log('cartões:', total);
for (let i=0;i<total;i++) {
  await p.waitForTimeout(1400);
  const id = await p.$eval('.resumo__palco', n=>n.dataset.cartao);
  const g = await p.evaluate(()=>{ const n=document.querySelector('.card__g'); if(!n) return 'sem gráfico';
    return ['g-anel','g-barra','g-coluna','g-quadro','g-elo','card__degrau','card__placar-i'].map(c=>{const k=n.querySelectorAll('.'+c).length; return k?`${c}×${k}`:null;}).filter(Boolean).join(', ') || 'vazio'; });
  console.log(`  ${String(i).padStart(2)} ${id.padEnd(14)} ${g}`);
  await p.screenshot({path:`${SHOT}/w-${String(i).padStart(2,'0')}-${id}.png`});
  if (i<total-1) await p.click('.resumo__palco', {position:{x:380,y:600}});
}
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
