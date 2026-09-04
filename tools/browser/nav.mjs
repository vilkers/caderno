import { chromium, pastaDeShots, BASE, fotoDeTeste } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const errs=[];
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:440,height:956}, deviceScaleFactor:2 });
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(700);

console.log('itens embaixo:', await p.$$eval('.nav__item .nav__l', n=>n.map(x=>x.textContent)));
console.log('identidade:', await p.$eval('#identNome', n=>n.textContent), '| avatar:', await p.$eval('#identAv', n=>n.textContent.trim()));

// menu
await p.click('#menuBtn'); await p.waitForTimeout(600);
console.log('grupos do menu:', await p.$$eval('.menugrupo > .micro', n=>n.map(x=>x.textContent)));
console.log('itens do menu:', await p.$$eval('.menuitem .row__t', n=>n.map(x=>x.textContent)));
await p.screenshot({path:SHOT+'/n-menu.png'});
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.click('#identBtn'); await p.waitForTimeout(800);
console.log('foi pro perfil:', await p.$eval('.vhead h2', n=>n.textContent));

// perfil: nome e foto
await p.fill('.perfil__nome', 'Vilker');
await p.fill('.perfil__frase', 'menos fudido, um dia de cada vez');
await p.waitForTimeout(700);
console.log('topo mostra o nome:', await p.$eval('#identNome', n=>n.textContent));
console.log('iniciais:', await p.$eval('.av--letras span', n=>n.textContent).catch(()=>'—'));

// foto: gera um png e envia
await p.setInputFiles('.perfil input[type="file"]', fotoDeTeste());
await p.waitForTimeout(900);
const temFoto = await p.evaluate(async()=>{ const s = await import('./js/store.js'); return (s.state.profile.foto||'').slice(0,22); });
console.log('foto guardada:', temFoto, '| tamanho:', await p.evaluate(async()=>{const s=await import('./js/store.js');return s.state.profile.foto.length;}));

await p.screenshot({path:SHOT+'/n-perfil.png', fullPage:true});

// voltar: agora é a seta do topo, que fica fixa
await p.click('#identBtn'); await p.waitForTimeout(700);
console.log('voltou para:', await p.$eval('.vhead h2', n=>n.textContent));
console.log('de volta na tela raiz, o avatar volta como imagem:', await p.$$eval('#identAv img', n=>n.length));
await p.click('.nav__item[data-view="insights"]'); await p.waitForTimeout(800);
console.log('insights pela barra:', await p.$eval('.vhead h2', n=>n.textContent));
await p.goBack(); await p.waitForTimeout(700);
console.log('botão voltar do navegador:', await p.$eval('.vhead h2', n=>n.textContent));

// persistência do perfil
await p.reload({waitUntil:'networkidle'});
await p.addStyleTag({content:':root{--sat:59px;--sab:34px}'});
await p.fill('#lockPass','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(900);
console.log('depois de recarregar:', await p.$eval('#identNome', n=>n.textContent),
  '| foto:', await p.$$eval('#identAv img', n=>n.length),
  '| perfil no cofre:', await p.evaluate(async()=>{const s=await import('./js/store.js');const q=s.state.profile;return q.nome+'/'+q.frase.slice(0,12)+'/'+q.foto.length;}));
await p.screenshot({path:SHOT+'/n-hoje.png'});
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
