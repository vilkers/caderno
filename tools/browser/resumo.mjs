import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const errs=[];
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:440,height:956}, deviceScaleFactor:2 });
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(600);

// 70 dias de dados pra retrospectiva ter o que dizer
await p.evaluate(async () => {
  const store = await import('./js/store.js');
  const { keyOf } = await import('./js/utils.js');
  store.setProfile({ nome: 'Vilker' });
  const cats = store.activeCategories();
  const by = n => cats.find(c=>c.label.toLowerCase().startsWith(n))?.id;
  const hoje = new Date();
  for (let i=0;i<70;i++){
    const d=new Date(hoje); d.setDate(d.getDate()-i);
    if (Math.random()<0.15) continue;
    const wd = d.getDay(); const v={};
    if (wd!==0 && Math.random()<(wd===3?0.9:0.5)) v[by('academia')]=true;
    if (wd>0&&wd<6) v[by('trabalho')]=7+Math.round(Math.random()*4);
    if (Math.random()<0.25) v[by('bebida')]=2+Math.floor(Math.random()*5);
    v[by('sono')]=6.5+Math.round(Math.random()*4)/2;
    v[by('passeio')]=1+Math.floor(Math.random()*2);
    if (Math.random()<0.6) v[by('louça')]=true;
    store.state.days[keyOf(d)]={v,note:'',closed:Math.random()<0.6,updatedAt:Date.now()};
  }
  ['pagar luz','ração do Estojo','dentista'].forEach(t=>{const x=store.addTodo(t); store.updateTodo(x.id,{done:true});});
  store.emit('replace');
});
await p.waitForTimeout(2500);
if (!(await p.$eval('#sheet', n=>n.hidden))) { await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(600); }

await p.click('#menuBtn'); await p.waitForTimeout(400);
await p.click('.menuitem:has-text("Retrospectiva")'); await p.waitForTimeout(1200);
console.log('cartões:', await p.$$eval('.resumo__trilha', n=>n.length));
console.log('barra de cima escondida:', await p.$eval('.topbar', n=>getComputedStyle(n).display));
await p.screenshot({path:SHOT+'/w1-capa.png'});

const olho = async () => p.$eval('.card__olho', n=>n.textContent).catch(()=>'—');
const titulo = async () => p.$$eval('.card__p', n=>n.map(x=>x.textContent).join(' '));
for (let i=1;i<=6;i++){
  await p.mouse.click(380, 600); await p.waitForTimeout(950);
  console.log(`cartão ${i}:`, await olho(), '|', await titulo(), '|', await p.$eval('.card__num', n=>n.textContent).catch(()=>'sem número'));
  if (i===2) await p.screenshot({path:SHOT+`/w2-dias.png`});
  if (i===5) await p.screenshot({path:SHOT+`/w3-meio.png`});
}
// voltar um
await p.mouse.click(60, 600); await p.waitForTimeout(800);
console.log('voltou para:', await olho());
// trocar período: os chips agora só existem na capa — voltar até ela primeiro
console.log('chips fora da capa:', await p.$eval('.resumo__periodos', n=>n.hidden?'escondidos ✓':'VISÍVEIS'));
for (let v=0; v<8; v++) { if (!(await p.$eval('.resumo__periodos', n=>n.hidden))) break; await p.mouse.click(60, 600); await p.waitForTimeout(400); }
console.log('chips na capa:', await p.$eval('.resumo__periodos', n=>n.hidden?'ESCONDIDOS':'visíveis ✓'));
await p.click('.chip:has-text("30 dias")'); await p.waitForTimeout(1000);
console.log('em 30 dias — cartões:', await p.$$eval('.resumo__trilha', n=>n.length), '|', await olho());
await p.screenshot({path:SHOT+'/w4-30d.png'});
// fechar
await p.click('.resumo__acoes .iconbtn'); await p.waitForTimeout(900);
console.log('depois de fechar, tela:', await p.$eval('.vhead h2', n=>n.textContent), '| barra voltou:', await p.$eval('.topbar', n=>getComputedStyle(n).display));
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
