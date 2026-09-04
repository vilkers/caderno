/* Terapia toda terça, tarefa com data, e criar tocando no dia. */
import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('ux');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const p = await ctx.newPage();
const erros=[]; p.on('pageerror',e=>erros.push(String(e)));
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(800);
for(let i=0;i<4;i++){ if(await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(250);}

// ── modelo: categoria de terça
const r = await p.evaluate(async () => {
  const s = await import('./js/store.js');
  const a = await import('./js/analysis.js');
  const { keyOf } = await import('./js/utils.js');
  const t = s.addCategory({ label:'Terapia', emoji:'🛋️', type:'toggle', cadence:'diaria', dias:[2] });
  // 2026-09-07 é segunda, 2026-09-08 é terça
  const seg = '2026-09-07', ter = '2026-09-08';
  const out = {
    cobraNaSegunda: s.cobraNoDia(s.catById(t.id), seg),
    cobraNaTerca:   s.cobraNoDia(s.catById(t.id), ter),
    rotulo:         s.rotuloDias(s.catById(t.id)),
    obrigSeg: a.dayStatus(seg).obrigatorias.some(c=>c.label==='Terapia'),
    obrigTer: a.dayStatus(ter).obrigatorias.some(c=>c.label==='Terapia'),
    totalSeg: a.dayStatus(seg).total,
    totalTer: a.dayStatus(ter).total,
  };
  // marcada fora do dia dela → entra como extra, não como obrigatória
  s.setVal(seg, t.id, true);
  out.extraNaSegunda = a.dayStatus(seg).extras.some(c=>c.label==='Terapia');
  out.pctSegNaoMuda = a.dayStatus(seg).total === out.totalSeg;
  // categoria sem dias continua cobrando todo dia
  const cats = s.activeCategories().filter(c=>c.label!=='Terapia');
  out.semDiasCobra = cats.every(c => s.cadencia(c)!=='diaria' || s.cobraNoDia(c, seg));
  s.emit('replace');
  return out;
});
console.log('cobra na segunda:', r.cobraNaSegunda, '| na terça:', r.cobraNaTerca, '| rótulo:', r.rotulo);
console.log('obrigatória seg/ter:', r.obrigSeg, '/', r.obrigTer, '| total seg', r.totalSeg, 'ter', r.totalTer);
console.log('marcada fora do dia vira extra:', r.extraNaSegunda, '| e não muda o denominador:', r.pctSegNaoMuda);
console.log('categoria sem dias segue diária:', r.semDiasCobra);

// ── o cartão apagado no dia que não é dela
await p.evaluate(async()=>{ const s=await import('./js/store.js'); s.emit('replace'); });
await p.waitForTimeout(700);
const cartao = await p.evaluate(()=>{
  const c=[...document.querySelectorAll('.entry')].find(n=>n.textContent.includes('Terapia'));
  if(!c) return null;
  return { fora:c.classList.contains('fora-do-dia'), dias:c.querySelector('.entry__dias')?.textContent||'—' };
});
console.log('cartão de terapia hoje:', JSON.stringify(cartao));

// ── chips de dia no editor de categoria
await p.click('#menuBtn'); await p.waitForTimeout(350);
await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(900);
console.log('Ajustes ainda tem AGENDA DO MÊS?', await p.$$eval('.section__h .micro', ns=>ns.map(n=>n.textContent).includes('AGENDA DO MÊS')));
await p.click(String.raw`.cat:has-text("Terapia") .btn`); await p.waitForTimeout(600);
console.log('chips de dia visíveis:', await p.$$eval('#sheetBody .diasem__d', ns=>ns.length),
            '| ligados:', await p.$$eval('#sheetBody .diasem__d.is-on', ns=>ns.map(n=>n.textContent).join(',')),
            '| resumo:', await p.$eval('#sheetBody .diasem + .micro', n=>n.textContent).catch(()=>'—'));
await p.click('#sheetBody .diasem__d:nth-child(5)'); await p.waitForTimeout(200);
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(700);
console.log('depois de ligar quinta:', await p.evaluate(async()=>{
  const s=await import('./js/store.js');
  return s.rotuloDias(s.activeCategories().find(c=>c.label==='Terapia'));}));
await p.screenshot({path:SHOT+'/d1-editor.png', fullPage:true});
for(let i=0;i<3;i++){ if(await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(250);}

// ── tarefa com data
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(700);
await p.fill('.todoadd input','Levar o Estojo no vet'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
await p.click('.todo .todo__data'); await p.waitForTimeout(600);
console.log('folha de data:', await p.$eval('#sheetTitle', n=>n.textContent), '| atalhos:', await p.$$eval('#sheetBody .chip', ns=>ns.map(n=>n.textContent).join('/')));
await p.click('#sheetBody .chip:has-text("hoje")'); await p.waitForTimeout(700);
console.log('a data ocupou o lugar do ícone:', await p.$eval('.todo .todo__data', n=>n.textContent.trim()));
await p.screenshot({path:SHOT+'/d2-tarefa.png'});

// ── ela aparece no calendário e no hoje
await p.click('.nav__item[data-view="mes"]'); await p.waitForTimeout(800);
console.log('marcas de tarefa no calendário:', await p.$$eval('.cal__tf', ns=>ns.length),
            '| legenda:', await p.$$eval('.legend__i', ns=>ns.length));
await p.click('.nav__item[data-view="hoje"]'); await p.waitForTimeout(800);
console.log('no hoje:', await p.$eval('.todo__sel', n=>n.textContent).catch(()=>'—'));

// ── criar tocando no dia
await p.click('.nav__item[data-view="mes"]'); await p.waitForTimeout(800);
await p.click('.cal__day:not(.is-out):nth-child(20)'); await p.waitForTimeout(700);
console.log('prévia tem "novo neste dia":', await p.$$eval('#sheetBody .micro', ns=>ns.map(n=>n.textContent)).then(a=>a.includes('NOVO NESTE DIA')));
console.log('portas:', await p.$$eval('#sheetBody .chips .chip', ns=>ns.map(n=>n.textContent).join(' / ')));
await p.click('#sheetBody .chip:has-text("tarefa")'); await p.waitForTimeout(400);
await p.fill('#sheetBody .todoadd input','Comprar ração'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
console.log('tarefa criada pelo calendário:', await p.evaluate(async()=>{
  const s=await import('./js/store.js');
  const t=s.listTodos().find(x=>x.text==='Comprar ração'); return t? `${t.text} → ${t.due}` : 'NÃO CRIOU';}));
console.log('marcas de tarefa agora:', await p.$$eval('.cal__tf', ns=>ns.length));

// conta pelo calendário
await p.click('.cal__day:not(.is-out):nth-child(22)'); await p.waitForTimeout(700);
await p.click('#sheetBody .chip:has-text("conta")'); await p.waitForTimeout(700);
console.log('form de conta abriu:', await p.$eval('#sheetTitle', n=>n.textContent),
            '| campos:', await p.$$eval('#sheetBody .field .micro', ns=>ns.map(n=>n.textContent).join(' | ')));
await p.fill('#sheetBody input[aria-label="Nome"]','IPVA');
await p.fill('#sheetBody input[aria-label="Valor"]','480,50');
await p.click('#sheetBody .btn--solid'); await p.waitForTimeout(800);
console.log('conta criada:', await p.evaluate(async()=>{
  const s=await import('./js/store.js');
  const a=s.listAgenda().find(x=>x.label==='IPVA');
  return a? `${a.label} · ${a.repete} · ${a.data} · ${a.valor}` : 'NÃO CRIOU';}));
await p.screenshot({path:SHOT+'/d3-calendario.png', fullPage:true});

console.log('erros:', erros.length?erros.join('\n'):'nenhum');
await b.close();
