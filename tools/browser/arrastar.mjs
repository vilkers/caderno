import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const errs=[];
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:440,height:956} });
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.fill('#lockPass','s1234'); await p.fill('#lockPass2','s1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(500);
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(500);
for (const t of ['primeira','segunda','terceira','quarta']) {
  await p.fill('.todoadd input', t); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
}
const ordem = async () => p.$$eval('.todo .todo__txt', n=>n.map(x=>x.textContent));
const checa = (nome, cond, extra='') => { console.log(`${nome}: ${cond?'ACERTOU':'errou'}${extra}`); if(!cond) errs.push(nome); };
console.log('ordem inicial:', await ordem());

// arrasta a primeira para o fim
const pegas = await p.$$('.todo__pega');
const cxA = await pegas[0].boundingBox();
const ultimo = (await p.$$('.todo'))[3];
const cxB = await ultimo.boundingBox();
await p.mouse.move(cxA.x + cxA.width/2, cxA.y + cxA.height/2);
await p.mouse.down();
for (let i=1;i<=12;i++) { await p.mouse.move(cxA.x + cxA.width/2, cxA.y + (cxB.y + cxB.height - cxA.y) * i/12); await p.waitForTimeout(25); }
await p.mouse.up(); await p.waitForTimeout(600);
console.log('depois de arrastar a 1ª pro fim:', await ordem());


checa('a 1ª foi parar no fim', (await ordem()).at(-1) === 'quarta', ` (${(await ordem()).join('/')})`);

/* ── o arrasto que quebrou: soltar no MEIO, com linhas de alturas diferentes.
   Antes o item corria na frente do dedo (o deslocamento contava sempre do
   ponto de partida, mesmo depois de trocar de linha) e ia parar no fim. ── */
await p.evaluate(async () => {
  const s = await import('./js/store.js');
  s.state.todos.length = 0;
  ['A','B com um texto bem mais comprido que ocupa duas ou três linhas inteiras','C','D','E'].forEach(t=>s.addTodo(t));
  s.setSetting('motion', false);
  s.emit('replace');
});
await p.waitForTimeout(900);
for (let i=0;i<3;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(250); }
const inicial = (await ordem()).map(t=>t[0]).join('');
console.log('lista de alturas irregulares:', inicial, await p.$$eval('.todo', n=>n.map(x=>Math.round(x.getBoundingClientRect().height))));
{
  const cx = await (await p.$$('.todo__pega'))[0].boundingBox();
  const alvo = await (await p.$$('.todo'))[3].boundingBox();
  const x = cx.x + cx.width/2, y0 = cx.y + cx.height/2, y1 = alvo.y + alvo.height/2;
  await p.evaluate(async ([x,y0,y1]) => {
    const pega = document.querySelector('.todo__pega');
    const ev = (t,y) => pega.dispatchEvent(new PointerEvent(t,{pointerId:1,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:x,clientY:y}));
    ev('pointerdown', y0);
    for (let y=y0; y<=y1; y+=8) { ev('pointermove', y); await new Promise(r=>setTimeout(r,16)); }
    ev('pointerup', y1);
  }, [x,y0,y1]);
  await p.waitForTimeout(700);
  const fim = (await ordem()).map(t=>t[0]).join('');
  console.log('arrastou o 1º até a 4ª linha:', inicial, '→', fim);
  checa('parou onde o dedo soltou, não no fim', fim.at(-1) === inicial.at(-1) && fim !== inicial);
  const gravado = await p.evaluate(async()=>{const s=await import('./js/store.js');
    return s.ordenarTodos(s.listTodos(),'manual').map(t=>t.text[0]).join('');});
  checa('e o cofre guardou a mesma ordem da tela', gravado === fim, ` (${gravado})`);
}

// volta pro cenário do teclado
await p.evaluate(async () => {
  const s = await import('./js/store.js');
  s.state.todos.length = 0;
  ['primeira','segunda','terceira','quarta'].forEach(t=>s.addTodo(t));
  s.emit('replace');
});
await p.waitForTimeout(800);
for (let i=0;i<3;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(250); }

// teclado
await p.focus('.todo:last-child .todo__pega');
await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300);
console.log('depois de ↑ no teclado:', await ordem());

// persiste?
await p.reload({waitUntil:'networkidle'});
await p.fill('#lockPass','s1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(600);
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(600);
console.log('depois de recarregar:', await ordem());

// concluir não bagunça
await p.click('.todo:first-child .todo__box'); await p.waitForTimeout(700);
await p.click('.chip:has-text("todas")'); await p.waitForTimeout(500);
console.log('com uma concluída (todas):', await ordem());
console.log('erros:', errs.length?errs:'nenhum');
await b.close();
