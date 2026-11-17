/* Terapia toda terça: cobrança por dia da semana, gaveta e chips de dia. */
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
  return {
    fora: c.classList.contains('fora-do-dia'),
    dias: c.querySelector('.entry__dias')?.textContent||'—',
    naGaveta: !!c.closest('.gaveta'),
    gavetaFechada: document.querySelector('.gaveta__l')?.hidden ?? null,
    rotuloGaveta: document.querySelector('.gaveta__n')?.textContent || '—',
  };
});
const ehTerca = new Date().getDay() === 2;
console.log('cartão de terapia hoje:', JSON.stringify(cartao));
console.log('terça hoje?', ehTerca, '| na gaveta:', cartao?.naGaveta,
            '| certo:', cartao?.naGaveta === !ehTerca ? 'sim' : 'NÃO');
if (cartao?.naGaveta !== !ehTerca) erros.push('a gaveta não guardou (ou guardou demais) a terapia');
// abrir a gaveta traz o cartão de volta, marcável
if (cartao?.naGaveta) {
  await p.click('.gaveta__b'); await p.waitForTimeout(500);
  const aberta = await p.$eval('.gaveta__l', n=>!n.hidden);
  console.log('a gaveta abre:', aberta);
  if (!aberta) erros.push('a gaveta não abriu');
}

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

/* Tarefa com data, as marcas de tarefa no calendário e criar tarefa ou
   conta tocando num dia do Mês saíram daqui: tarefas mudaram para o app
   tarefas/ e contas para financeiro/. */

console.log('erros:', erros.length?erros.join('\n'):'nenhum');
await b.close();
