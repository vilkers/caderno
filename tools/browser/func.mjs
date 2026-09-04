import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const errs=[]; const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1280,height:900} });
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(600);

// marca hábito e nota
await (await p.$$('.tog'))[0].click(); await p.waitForTimeout(200);

// editar categoria existente
await p.click('#menuBtn'); await p.waitForTimeout(350); await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(600);
await p.click('.cat:first-child .btn'); await p.waitForTimeout(500);
const nome = p.locator('.sheet__body input[type="text"]').nth(1);
await nome.fill('Musculação');
await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(600);
console.log('categoria renomeada:', await p.$eval('.cat:first-child .cat__n', n=>n.textContent));

// arquivar / reativar
await p.click('.cat:nth-child(3) .btn'); await p.waitForTimeout(400);
await p.click('.sheet__actions .btn:nth-child(2)'); await p.waitForTimeout(600);
console.log('3a categoria:', await p.$eval('.cat:nth-child(3) .cat__n', n=>n.textContent));

// trocar senha
await p.click('.row:has-text("Trocar a senha") .btn'); await p.waitForTimeout(600);
const pw = p.locator('.sheet__body input[type="password"]');
await pw.nth(0).fill('senha1234'); await pw.nth(1).fill('novaSenha99'); await pw.nth(2).fill('novaSenha99');
await p.click('.sheet__actions .btn--solid'); await p.waitForTimeout(1500);
console.log('sheet fechado após trocar senha:', await p.$eval('#sheet', n=>n.hidden));

// trancar e entrar com a senha nova
await p.click('#menuBtn'); await p.waitForTimeout(350); await p.click('.menuitem:has-text("Trancar")'); await p.waitForSelector('#lock:not([hidden])'); await p.waitForTimeout(400);
await p.fill('#lockPass','senha1234'); await p.click('#lockBtn'); await p.waitForTimeout(1200);
console.log('senha antiga rejeitada:', await p.$eval('#lockError', n=>n.textContent));
await p.fill('#lockPass','novaSenha99'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])', {timeout:8000}); await p.waitForTimeout(600);
console.log('entrou com a senha nova ✓ | categoria persistida:',
  await p.$$eval('.entry__label', n=>n.map(x=>x.textContent)[0]));

// exportar json (intercepta download)
await p.click('#menuBtn'); await p.waitForTimeout(350); await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(600);
const [dl] = await Promise.all([ p.waitForEvent('download'), p.click('button:has-text("baixar") >> nth=1') ]);
console.log('download json:', dl.suggestedFilename());
const [dl2] = await Promise.all([ p.waitForEvent('download'), p.click('button:has-text("baixar") >> nth=0') ]);
console.log('download cofre:', dl2.suggestedFilename());

// trava automática curta
await p.evaluate(async () => { const s = await import('./js/store.js'); s.state.settings.autolock = 0; s.emit('settings'); });
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
