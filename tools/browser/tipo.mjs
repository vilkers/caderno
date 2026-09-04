import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, hasTouch:true, isMobile:true })).newPage();
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(800);
await p.evaluate(async()=>{const s=await import('./js/store.js');const {keyOf}=await import('./js/utils.js');
  const cats=s.activeCategories(); const by=n=>cats.find(c=>c.label.toLowerCase().startsWith(n))?.id;
  const h=new Date();
  for(let i=0;i<20;i++){const d=new Date(h);d.setDate(d.getDate()-i);const v={};
    v[by('academia')]=i%2===0;v[by('trabalho')]=7;v[by('sono')]=7;v[by('passeio')]=1;
    s.state.days[keyOf(d)]={v,note:'',closed:i%3!==0,updatedAt:Date.now()};}
  ['comprar café','vet'].forEach(t=>s.addTodo(t));
  s.addAgenda({emoji:'🏠',label:'Aluguel',tipo:'aluguel',dia:5,valor:2300});
  s.addAgenda({emoji:'🎧',label:'Spotify',tipo:'assinatura',dia:5,valor:21.9});
  s.setProfile({nome:'Vilker',frase:'menos fudido'}); s.emit('replace');});
await p.waitForTimeout(1500);
for(let i=0;i<4;i++){ if(await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);}

const telas = ['hoje','mes','lista','insights'];
const acumulado = new Map();
const ir = async v => { await p.evaluate(v=>document.querySelector(`.nav__item[data-view="${v}"]`)?.click(), v); await p.waitForTimeout(800); };
const colher = async (nome) => {
  const r = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('#main *, .topbar *, .nav *').forEach(n => {
      if (!n.textContent.trim() || n.children.length) return;
      const c = getComputedStyle(n);
      const fam = c.fontFamily.split(',')[0].replace(/["']/g,'');
      out.push([fam, Math.round(parseFloat(c.fontSize)), c.fontWeight, c.fontStretch, c.letterSpacing, c.textTransform].join(' | '));
    });
    return out;
  });
  r.forEach(k => acumulado.set(k, (acumulado.get(k)||0)+1));
};
for (const v of telas) { await ir(v); await colher(v); }
await p.click('.aba:has-text("Contas")').catch(()=>{}); await p.waitForTimeout(600); await colher('contas');
await p.click('#menuBtn'); await p.waitForTimeout(400); await colher('menu'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.click('#menuBtn'); await p.waitForTimeout(300); await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(900); await colher('ajustes');

console.log('=== combinações distintas de tipo (família | corpo | peso | largura | tracking | caixa) ===');
[...acumulado.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>console.log(String(n).padStart(4), k));
console.log('\ntotal de combinações:', acumulado.size);
const familias = new Set([...acumulado.keys()].map(k=>k.split(' | ')[0]));
console.log('famílias:', [...familias].join(', '));
const corpos = [...new Set([...acumulado.keys()].map(k=>+k.split(' | ')[1]))].sort((a,b)=>a-b);
console.log('corpos usados:', corpos.join(', '));
const pesos = [...new Set([...acumulado.keys()].map(k=>k.split(' | ')[2]))].sort();
console.log('pesos usados:', pesos.join(', '));
// de onde vêm os corpos fora da escala
const fora = await p.evaluate(() => {
  const ok = new Set([8,10,12,15,17,21,26]);
  const achados = [];
  document.querySelectorAll('#main *, .topbar *, .nav *').forEach(n => {
    if (!n.textContent.trim() || n.children.length) return;
    const t = Math.round(parseFloat(getComputedStyle(n).fontSize));
    if (!ok.has(t) && t < 24) achados.push(`${t}px  ${(n.className||n.tagName)} "${n.textContent.trim().slice(0,20)}"`);
  });
  return [...new Set(achados)];
});
console.log('\nfora da escala:', fora.length ? fora.join('\n   ') : 'nenhum');
await b.close();
