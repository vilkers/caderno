import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const errs=[];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:440,height:956}, deviceScaleFactor:2, permissions:['notifications'] });
await ctx.grantPermissions(['notifications'], { origin: BASE });
const p = await ctx.newPage();
// Chromium headless nega notificação mesmo com grantPermissions; finge o suficiente.
await p.addInitScript(() => {
  const feitas = [];
  window.__avisos = feitas;
  class N { constructor(t, o) { feitas.push({ t, o }); } }
  N.permission = 'granted';
  N.requestPermission = async () => 'granted';
  Object.defineProperty(window, 'Notification', { value: N, configurable: true, writable: true });
  const orig = ServiceWorkerRegistration.prototype.showNotification;
  ServiceWorkerRegistration.prototype.showNotification = function (t, o) { feitas.push({ t, o }); return Promise.resolve(); };
  void orig;
});
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(700);

// dados de uma semana
await p.evaluate(async () => {
  const store = await import('./js/store.js'); const { keyOf } = await import('./js/utils.js');
  const cats = store.activeCategories(); const by = n => cats.find(c=>c.label.toLowerCase().startsWith(n))?.id;
  const hoje = new Date();
  for (let i=1;i<=9;i++){ const d=new Date(hoje); d.setDate(d.getDate()-i);
    const v={}; v[by('academia')]= i%2===0; v[by('trabalho')]=8; v[by('sono')]=7; v[by('passeio')]=1; v[by('louça')]= i%3!==0;
    store.state.days[keyOf(d)]={v,note:'',closed:true,updatedAt:Date.now()}; }
  store.emit('replace');
});
await p.waitForTimeout(2200);
if (!(await p.$eval('#sheet', n=>n.hidden))) { await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(600); }

/* ── 3. revisão semanal ── */
await p.click('#menuBtn'); await p.waitForTimeout(400);
await p.click('.menuitem:has-text("Revisão da semana")'); await p.waitForTimeout(900);
console.log('título:', await p.$eval('.vhead h2', n=>n.textContent), '|', await p.$eval('.status__t', n=>n.textContent));
console.log('metas listadas:', await p.$$eval('.meta', n=>n.length));
await p.screenshot({path:SHOT+'/r1-revisao.png', fullPage:true});
// ajusta uma meta pela revisão
const antes = await p.evaluate(async()=>{const s=await import('./js/store.js');return s.activeCategories().find(c=>c.goal).goal.value;});
await p.click('.meta .meta__campos .btn >> nth=1'); await p.waitForTimeout(500);
const depois = await p.evaluate(async()=>{const s=await import('./js/store.js');return s.activeCategories().find(c=>c.goal).goal.value;});
console.log('meta ajustada na revisão:', antes, '→', depois);
await p.fill('.note', 'semana corrida, mas fechei');
await p.waitForTimeout(400);
await p.click('.btn--solid:has-text("FECHAR A SEMANA")'); await p.waitForTimeout(900);
console.log('depois de fechar:', await p.$eval('.vhead h2', n=>n.textContent));
console.log('gravada no cofre:', await p.evaluate(async()=>{const s=await import('./js/store.js');const r=Object.values(s.state.reviews)[0];return r? `${r.chave} · ${r.nota} · ${r.resultados.length} metas` : 'nada';}));

/* ── 1. lembrete ── */
await p.click('#menuBtn'); await p.waitForTimeout(350); await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('.section:has(.alert), .section')&&0);
console.log('permissão vista pelo app:', await p.evaluate(async()=>{const l=await import('./js/lembrete.js');return l.permissao();}));
const linhaLembrete = p.locator('.row', { hasText: 'Me lembrar de fechar o dia' });
await linhaLembrete.locator('.btn').click(); await p.waitForTimeout(1400);
console.log('lembrete:', await p.evaluate(async()=>{const l=await import('./js/lembrete.js');const c=l.config();return `${c.ligado?'ligado':'desligado'} às ${c.hora}h`;}));
console.log('gaveta do worker:', await p.evaluate(async()=>{const {lerResumo}=await import('./js/idb.js');const r=await lerResumo();return r? `${r.faltam} de ${r.total} faltando · hora ${r.hora} · nomes ${r.nomes.length}` : 'vazia';}));
// horário + "dizer o que falta" + testar
await p.selectOption('.row:has-text("Horário") select', '22'); await p.waitForTimeout(600);
await p.locator('.row', { hasText: 'Dizer o que falta' }).locator('.switch, button').first().click(); await p.waitForTimeout(700);
console.log('config final:', await p.evaluate(async()=>{const l=await import('./js/lembrete.js');const c=l.config();return `hora ${c.hora} · detalhe ${c.detalhe}`;}));
console.log('gaveta com nomes:', await p.evaluate(async()=>{const {lerResumo}=await import('./js/idb.js');const r=await lerResumo();return `hora ${r.hora} · nomes ${r.nomes.length}`;}));
await p.locator('.row', { hasText: 'Testar agora' }).locator('.btn').click(); await p.waitForTimeout(900);
console.log('aviso disparado:', await p.evaluate(()=>window.__avisos.map(a=>`${a.t} — ${a.o.body}`)));
await p.screenshot({path:SHOT+'/r2-lembrete.png'});

/* a marcação rápida saiu: o atalho antigo agora leva pro check-in */
await p.goto(BASE + '/index.html?v=rapido',{waitUntil:'networkidle'});
await p.fill('#lockPass','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(1400);
console.log('atalho antigo cai no dia:', await p.$eval('.vhead h2', n=>n.textContent), '| sem caixa aberta:', await p.$eval('#sheet', n=>n.hidden));

console.log('erros:', errs.length?errs:'nenhum');
await b.close();
