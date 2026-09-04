import { chromium, pastaDeShots, BASE } from './_comum.mjs';
const SHOT = pastaDeShots('shots');
const errs=[];
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960}, deviceScaleFactor:2 });
p.on('pageerror', e=>errs.push('pageerror: '+e.message));
p.on('console', c=>{ if(c.type()==='error') errs.push('console: '+c.text()); });

await p.goto(BASE + '/index.html',{waitUntil:'networkidle'});
await p.fill('#lockPass','senha1234'); await p.fill('#lockPass2','senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(800);

// faixa de dias existe e navega
const strip = await p.$$eval('.strip__d', n=>n.length);
await p.click('.strip__d >> nth=3'); await p.waitForTimeout(600);
const titulo = await p.$eval('.vhead h2', n=>n.textContent);
console.log('faixa de dias:', strip, '| ao clicar no 4º:', titulo);

// marca um hábito num dia retroativo
await (await p.$$('.tog'))[0].click(); await p.waitForTimeout(300);
await p.click('.strip__d.is-today'); await p.waitForTimeout(500);
console.log('voltou pra hoje:', await p.$eval('.vhead h2', n=>n.textContent));

// grade da semana
await p.click('.nav__item[data-view="mes"]'); await p.waitForTimeout(700);
await p.click('.seg__b:has-text("Semana")'); await p.waitForTimeout(800);
const linhas = await p.$$eval('.wgrid__row', n=>n.length);
const celulas = await p.$$eval('.wgrid__row:first-child .batch__cell', n=>n.length);
console.log('grade semana: faixas', linhas, '| colunas por faixa', celulas);

const cells = await p.$$('.wgrid__row:first-child .batch__cell');
await cells[0].click(); await p.waitForTimeout(200);
const conta = await p.$$('.wgrid__row:nth-child(4) .batch__cell');
await conta[0].click(); await conta[0].click(); await p.waitForTimeout(250);
// escala longa (bebida) abre o controle cheio
const escala = await p.$$('.wgrid__row:nth-child(3) .batch__cell');
await escala[0].click(); await p.waitForTimeout(600);
console.log('escala longa abre a caixa:', await p.$eval('#sheet', n=>!n.hidden));
await p.click('.sheet__body .meter__s[data-v="6"]'); await p.waitForTimeout(300);
console.log('rótulo escolhido na caixa:', await p.$eval('.sheet__body .lvl', n=>n.textContent));
await p.click('.sheet__scrim'); await p.waitForTimeout(600);
console.log('células preenchidas:', await p.$$eval('.batch__cell.is-on', n=>n.map(x=>x.textContent)));
await p.screenshot({path:SHOT+'/n1-semana.png'});

// fechar o dia pela grade
await p.click('.wgrid__row--close .batch__cell >> nth=0'); await p.waitForTimeout(300);
console.log('dia fechado pela grade:', await p.$eval('.wgrid__row--close .batch__cell', n=>n.classList.contains('is-on')));

// desfazer ao apagar tarefa
await p.click('.nav__item[data-view="lista"]'); await p.waitForTimeout(600);
await p.fill('.todoadd input','tarefa de teste'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
await p.hover('.todo'); await p.click('.todo .todo__x'); await p.waitForTimeout(700);
await p.click('.toast__act'); await p.waitForTimeout(600);
console.log('tarefa restaurada:', await p.$$eval('.todo', n=>n.length));

console.log('erros:', errs.length?errs:'nenhum');
await b.close();
