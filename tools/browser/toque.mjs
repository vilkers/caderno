import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:393,height:852}, hasTouch:true, isMobile:true })).newPage();
await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(700);
await p.evaluate(async()=>{const s=await import('./js/store.js');
  s.addTodo('tarefa de teste'); s.addTodo('outra tarefa'); s.addAgenda({emoji:'🏠',label:'Aluguel',tipo:'aluguel',dia:5,valor:2300}); s.emit('replace');});
await p.waitForTimeout(1200);
for (let i=0;i<4;i++){ if (await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);} 

const tocarPerto = async (sel, dy) => {
  await p.locator(sel).first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  const box = await p.locator(sel).first().boundingBox();
  await p.mouse.click(box.x + box.width/2, dy < 0 ? box.y + dy : box.y + box.height + dy);
  await p.waitForTimeout(400);
};

// estrela da tarefa: toque 5px acima da borda de cima
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(700);
const antes = await p.evaluate(async()=>{const s=await import('./js/store.js');return !!s.listTodos()[0].star;});
await tocarPerto('.star', -5);
const dep = await p.evaluate(async()=>{const s=await import('./js/store.js');return !!s.listTodos()[0].star;});
console.log('estrela 5px acima da borda:', antes !== dep ? 'ACERTOU' : 'errou');
await tocarPerto('.star', 5);
const dep2 = await p.evaluate(async()=>{const s=await import('./js/store.js');return !!s.listTodos()[0].star;});
console.log('estrela 5px abaixo da borda:', dep !== dep2 ? 'ACERTOU' : 'errou');

// caixa de concluir
const c1 = await p.evaluate(async()=>{const s=await import('./js/store.js');return !!s.listTodos()[0].done;});
await tocarPerto('.todo__box', -5);
const c2 = await p.evaluate(async()=>{const s=await import('./js/store.js');return !!s.listTodos()[0].done;});
console.log('caixa 5px acima:', c1 !== c2 ? 'ACERTOU' : 'errou');

// medidor 0–10: a coluna mais curta tem 23px de desenho e 44px de alvo
await p.click('.nav__item[data-view="hoje"]'); await p.waitForTimeout(700);
const alvoMedidor = await p.evaluate(()=>{
  const m=document.querySelector('.meter'); if(!m) return null;
  const s=m.children[0], r=s.getBoundingClientRect();
  const a=getComputedStyle(s,'::after');
  return { desenho: Math.round(r.height), alvo: parseFloat(a.height) };
});
console.log('medidor: desenho', alvoMedidor?.desenho + 'px', '| alvo', alvoMedidor?.alvo + 'px',
            alvoMedidor?.alvo >= 44 ? '✓' : 'PEQUENO');
// o degrau 6 é o mais curto que ainda acende: tocar acima dele prova o alvo
const m1 = await p.evaluate(()=>document.querySelectorAll('.meter__s.is-on').length);
await tocarPerto('.meter__s:nth-child(7)', -5);
await p.waitForTimeout(400);
const m2 = await p.evaluate(()=>document.querySelectorAll('.meter__s.is-on').length);
console.log('medidor 5px acima do desenho:', m1 !== m2 ? `ACERTOU (${m1}→${m2})` : 'errou');

// data da tarefa: 32px de desenho, 44 de alvo
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(700);
await p.click('.aba:has-text("Tarefas")').catch(()=>{}); await p.waitForTimeout(600);
await p.click('.tabs .chip:has-text("todas")').catch(()=>{}); await p.waitForTimeout(600);
const d1 = await p.evaluate(()=>document.querySelector('#sheet').hidden);
await tocarPerto('.todo__data', -5);
await p.waitForTimeout(600);
const d2 = await p.evaluate(()=>document.querySelector('#sheet').hidden);
console.log('data da tarefa 5px acima:', d1 !== d2 ? 'ACERTOU' : 'errou');
for(let i=0;i<3;i++){ if(await p.$eval('#sheet',n=>n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300);}

// check da agenda
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(600);
await p.click('.aba:has-text("Contas")'); await p.waitForTimeout(800);
const mes = new Date().toISOString().slice(0,7);
const a1 = await p.evaluate(async m=>{const s=await import('./js/store.js');return s.agendaFeito(s.listAgenda()[0],m);}, mes);
await tocarPerto('.agitem__check', -5);
const a2 = await p.evaluate(async m=>{const s=await import('./js/store.js');return s.agendaFeito(s.listAgenda()[0],m);}, mes);
console.log('check da agenda 5px acima:', a1 !== a2 ? 'ACERTOU' : 'errou');

// interruptor em ajustes
await p.click('#menuBtn'); await p.waitForTimeout(300);
await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(900);
const s1 = await p.evaluate(()=>document.querySelector('.switch').getAttribute('aria-checked'));
await tocarPerto('.switch', -5);
const s2 = await p.evaluate(()=>document.querySelector('.switch').getAttribute('aria-checked'));
console.log('interruptor 5px acima:', s1 !== s2 ? 'ACERTOU' : 'errou');
await b.close();
