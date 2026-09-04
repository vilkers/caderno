import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const b = await chromium.launch();
const achados = [];
const relatar = (tela, texto) => achados.push(`${tela.padEnd(12)} ${texto}`);

const LARGURAS = [360, 393, 440];
for (const w of LARGURAS) {
  const ctx = await b.newContext({ viewport:{width:w,height:852}, deviceScaleFactor:1, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  p.on('pageerror', e=>relatar(`w${w}`, 'PAGEERROR: '+e.message));
  p.on('console', c=>{ if(c.type()==='error' && !/404|401/.test(c.text())) relatar(`w${w}`, 'CONSOLE: '+c.text()); });
  await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
  await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
  await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
  await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(800);
  await p.evaluate(async () => {
    const store = await import('./js/store.js'); const { keyOf } = await import('./js/utils.js');
    const cats = store.activeCategories(); const by = n => cats.find(c=>c.label.toLowerCase().startsWith(n))?.id;
    const hoje = new Date();
    for (let i=0;i<40;i++){ const d=new Date(hoje); d.setDate(d.getDate()-i);
      if (i%7===5) continue;
      const v={}; v[by('academia')]= i%2===0; v[by('trabalho')]=6+(i%4); v[by('sono')]=6+(i%3);
      v[by('passeio')]=1+(i%2); if(i%9===0) v[by('bebida')]=3+(i%5);
      store.state.days[keyOf(d)]={v,note:i===2?'nota longa pra ver se quebra a linha direito no celular':'' ,closed:i%4!==1,updatedAt:Date.now()}; }
    ['comprar café','levar o Estojo ao vet','uma tarefa com um nome bem comprido pra testar o corte'].forEach(t=>store.addTodo(t));
    store.addAgenda({emoji:'💜',label:'Cartão Nubank',tipo:'cartao',dia:10,valor:1240.5});
    store.addAgenda({emoji:'🏠',label:'Aluguel',tipo:'aluguel',dia:5,valor:2300});
    store.addAgenda({emoji:'🎧',label:'Spotify',tipo:'assinatura',dia:5,valor:21.9});
    store.addAgenda({emoji:'📄',label:'Emitir a NF da agência',tipo:'nf',dia:1});
    store.addAgenda({emoji:'💰',label:'Pagamento da agência',tipo:'renda',dia:10,valor:5000});
    store.setProfile({nome:'Vilker', frase:'menos fudido'});
    store.emit('replace');
  });
  await p.waitForTimeout(1500);
  const fecharTudo = async () => {
    for (let i=0;i<4;i++) {
      if (await p.$eval('#sheet', n=>n.hidden)) break;
      await p.keyboard.press('Escape'); await p.waitForTimeout(350);
    }
  };
  await fecharTudo();

  const telas = ['hoje','mes','lista','metas','insights','perfil','revisao','ajustes'];
  for (const v of telas) {
    await p.evaluate(async v => {
      const m = await import('./js/main.js');   // não exporta ctx; usa a URL
      location.hash='';
    }, v).catch(()=>{});
    await fecharTudo();
    await p.evaluate(v => { document.querySelector(`.nav__item[data-view="${v}"]`)?.click(); }, v);
    if (!await p.$(`.nav__item[data-view="${v}"]`)) {
      // telas do menu
      await p.click('#menuBtn', {force:true}); await p.waitForTimeout(300);
      const nomes = { insights:'Insights', perfil:'Perfil', revisao:'Revisão da semana', ajustes:'Ajustes' };
      await p.click(`.menuitem:has-text("${nomes[v]}")`, {force:true}).catch(()=>{});
    }
    await p.waitForTimeout(900);
    await fecharTudo();
    // rola tudo pra soltar as animações
    const alt = await p.evaluate(()=>document.body.scrollHeight);
    for (let y=0;y<alt;y+=500) { await p.evaluate(y=>window.scrollTo(0,y), y); await p.waitForTimeout(120); }
    await p.waitForTimeout(400);

    const r = await p.evaluate(() => {
      const out = { overflow:null, invisiveis:[], pequenos:[], lixo:[], cortados:[] };
      /* o alvo real pode ser maior que a caixa visível (::before/::after):
         confere pelo que o dedo acertaria 8px acima e 8px abaixo da borda */
      const alvoAmpliado = n => {
        const r = n.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const acima = document.elementFromPoint(x, Math.max(1, r.top - 6));
        const abaixo = document.elementFromPoint(x, Math.min(innerHeight - 1, r.bottom + 6));
        return (acima === n || n.contains(acima)) && (abaixo === n || n.contains(abaixo));
      };
      if (document.documentElement.scrollWidth > innerWidth + 1)
        out.overflow = `${document.documentElement.scrollWidth} > ${innerWidth}`;
      const txt = document.body.innerText;
      ['null','undefined','NaN','[object'].forEach(t => { if (txt.includes(t)) out.lixo.push(t); });
      document.querySelectorAll('#main input,#main select,#main textarea,#main button,#sheetBody input,#sheetBody select').forEach(n=>{
        const r = n.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) {
          if (getComputedStyle(n).display !== 'none' && !n.hidden)
            out.invisiveis.push(`${n.tagName}.${(n.className||'').split(' ')[0]}[${n.getAttribute('aria-label')||n.textContent.trim().slice(0,16)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
        } else if ((r.width < 36 || r.height < 36) && n.tagName === 'BUTTON' && !alvoAmpliado(n)) {
          out.pequenos.push(`${(n.className||'').split(' ')[0]||n.tagName}[${n.textContent.trim().slice(0,12)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
      // texto cortado na horizontal
      document.querySelectorAll('#main *').forEach(n=>{
        if (n.children.length) return;
        if (n.scrollWidth > n.clientWidth + 2 && n.clientWidth > 0 && getComputedStyle(n).overflow !== 'visible')
          out.cortados.push(`${(n.className||n.tagName).split(' ')[0]}: "${n.textContent.trim().slice(0,24)}"`);
      });
      return out;
    });
    const tela = `w${w}/${v}`;
    if (r.overflow) relatar(tela, `ROLA PRO LADO ${r.overflow}`);
    r.invisiveis.forEach(x => relatar(tela, `CONTROLE SEM TAMANHO ${x}`));
    if (r.lixo.length) relatar(tela, `TEXTO LIXO: ${r.lixo.join(', ')}`);
    const p2 = [...new Set(r.pequenos)];
    if (p2.length) relatar(tela, `ALVO PEQUENO: ${p2.slice(0,4).join(' | ')}`);
    const c2 = [...new Set(r.cortados)];
    if (c2.length) relatar(tela, `CORTADO: ${c2.slice(0,3).join(' | ')}`);
    if (w === 393) await p.screenshot({path:`${SHOT}/au-${v}.png`, fullPage:true});
  }
  await ctx.close();
}
console.log(achados.length ? achados.join('\n') : 'nada encontrado');
await b.close();
