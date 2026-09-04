import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const errs=[];
const b = await chromium.launch();
// iPhone 16 Pro Max: 440x956 pt, ilha dinâmica 59pt no topo, 34pt de gestos embaixo
const p = await b.newPage({ viewport:{width:440,height:956}, deviceScaleFactor:2 });
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
// simula os recortes do aparelho
await p.addStyleTag({content:':root{--sat:59px;--sab:34px;--sal:0px;--sar:0px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(600);

// categoria obrigatória diária de teste (remédio) + dados
await p.evaluate(async () => {
  const store = await import('./js/store.js');
  store.addCategory({ emoji:'💊', label:'Remédio', type:'toggle', cadence:'diaria' });
  const cats = store.activeCategories();
  const by = n => cats.find(c=>c.label.toLowerCase().startsWith(n))?.id;
  const { keyOf } = await import('./js/utils.js');
  const hoje = new Date();
  for (let i=1;i<12;i++){ const d=new Date(hoje); d.setDate(d.getDate()-i);
    const v={}; v[by('academia')]= i%2===0; v[by('trabalho')]=8; v[by('sono')]=7; v[by('passeio')]=1; v[by('louça')]= i%3!==0;
    store.state.days[keyOf(d)]={v,note:'',closed:true,updatedAt:Date.now()}; }
  store.emit('replace');
});
await p.waitForTimeout(2200);
if (!(await p.$eval('#sheet', n=>n.hidden))) { await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(600); }

const st = await p.evaluate(async () => {
  const a = await import('./js/analysis.js');
  const s = a.dayStatus();
  return { total: s.total, faltando: s.faltando.map(c=>c.label), ok: s.ok, extras: s.extras.length };
});
console.log('status do dia:', st);
console.log('painel:', await p.$eval('.status__t', n=>n.textContent));
console.log('chips do que falta:', await p.$$eval('.falta', n=>n.map(x=>x.textContent.trim())));
console.log('metas da semana no topo:', await p.$$eval('.mini__n', n=>n.map(x=>x.textContent.trim())));

// o topo não pode ficar embaixo da ilha dinâmica
const topo = await p.evaluate(()=>{
  const marca = document.querySelector('.ident__n').getBoundingClientRect();
  const nav = document.querySelector('.nav').getBoundingClientRect();
  const item = document.querySelector('.nav__item').getBoundingClientRect();
  return { textoComeçaEm: Math.round(marca.top), navAltura: Math.round(nav.height),
           itemAltura: Math.round(item.height), itens: document.querySelectorAll('.nav__item').length,
           navFundo: Math.round(innerHeight - nav.bottom) };
});
console.log('topo/nav:', topo, topo.textoComeçaEm >= 59 ? '→ abaixo da ilha ✓' : '→ SOB A ILHA ✗');
await p.screenshot({path:SHOT+'/s1-iphone-hoje.png'});

// marca o remédio e confere "tudo em ordem"
await p.click('.falta >> nth=0'); await p.waitForTimeout(700);
await p.evaluate(()=>{ const c=[...document.querySelectorAll('.entry')].find(e=>e.textContent.includes('Remédio')); c.querySelector('.tog').click(); });
await p.waitForTimeout(900);
console.log('depois de marcar:', await p.$eval('.status__t', n=>n.textContent));

// painel de metas
await p.click('#menuBtn'); await p.waitForTimeout(400);
await p.click('.menuitem:has-text("Metas")'); await p.waitForTimeout(900);
console.log('linhas de meta:', await p.$$eval('.meta', n=>n.length));
await p.selectOption('.meta:first-child .meta__cad select', 'diaria'); await p.waitForTimeout(500);
console.log('cadência trocada:', await p.evaluate(async()=>{
  const s = await import('./js/store.js');
  const c = s.activeCategories()[0];
  return c.label + ' → ' + s.cadencia(c);
}));
await p.screenshot({path:SHOT+'/s2-metas.png', fullPage:true});
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
