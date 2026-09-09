/* Face ID de ponta a ponta, com um autenticador virtual no lugar do rosto.

   O que este teste garante: ligar nos ajustes grava um selo que NÃO tem a
   senha em texto; o botão do rosto abre o cofre sem digitar nada; e trocar a
   senha desarma o Face ID em vez de deixar um atalho que não abre mais. */

import { chromium, BASE } from './_comum.mjs';

/* WebAuthn não existe em endereço de IP — só em domínio (ou localhost).
   O resto da bateria fala com 127.0.0.1; aqui é o mesmo servidor pelo nome. */
const URL_FACE = BASE.replace('127.0.0.1', 'localhost');

const errs = [];
const checa = (nome, cond, extra = '') => {
  console.log(`${nome}: ${cond ? 'ACERTOU' : 'errou'}${extra}`);
  if (!cond) errs.push(nome);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('pageerror: ' + e.message));

const cdp = await ctx.newCDPSession(p);
await cdp.send('WebAuthn.enable', { enableUI: false });
let temPrf = true;
let auth;
try {
  ({ authenticatorId: auth } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, hasPrf: true,
      isUserVerified: true, automaticPresenceSimulation: true,
    },
  }));
} catch (e) {
  temPrf = false;
  console.log('autenticador virtual sem PRF neste Chromium:', e.message.split('\n')[0]);
}

await p.goto(URL_FACE + '/index.html', { waitUntil: 'networkidle' });
await p.fill('#lockPass', 'senha1234'); await p.fill('#lockPass2', 'senha1234'); await p.click('#lockBtn');
await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(800);
for (let i = 0; i < 3; i++) { if (await p.$eval('#sheet', n => n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300); }

// a linha existe em Ajustes e sabe dizer se o aparelho tem leitor
await p.click('#menuBtn'); await p.waitForTimeout(400);
await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(1000);
const linha = p.locator('.row:has-text("Entrar com Face ID")');
checa('a linha do Face ID existe em Ajustes', await linha.count() === 1);
await p.waitForTimeout(600);
const ligavel = await linha.locator('button').isEnabled();
checa('com leitor virtual, o botão fica habilitado', ligavel === temPrf, ` (leitor: ${temPrf})`);

if (!temPrf) {
  console.log('erros:', errs.length ? errs.join(', ') : 'nenhum');
  await b.close();
  process.exit(0);
}

// ligar
await linha.locator('button').click(); await p.waitForTimeout(600);
await p.fill('#sheetBody input[type=password]', 'senha1234');
await p.click('#sheetBody .sheet__actions .btn--solid');
await p.waitForTimeout(2500);
const selo = await p.evaluate(() => localStorage.getItem('caderno.face.v1'));
checa('ligar grava o selo neste aparelho', !!selo);
checa('e a senha NÃO está em texto puro no selo', !!selo && !selo.includes('senha1234'));

// trancar e entrar pelo rosto
await p.click('#menuBtn'); await p.waitForTimeout(400);
await p.click('.menuitem:has-text("Trancar")'); await p.waitForTimeout(900);
const botao = p.locator('#lockFace');
checa('o botão do rosto aparece na tranca', await botao.isVisible());
await botao.click();
await p.waitForSelector('#app:not([hidden])', { timeout: 15000 }).catch(() => {});
checa('e abre o caderno sem digitar senha', await p.$eval('#app', n => !n.hidden));

// trocar a senha desarma
await p.waitForTimeout(600);
for (let i = 0; i < 3; i++) { if (await p.$eval('#sheet', n => n.hidden)) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
await p.click('#menuBtn'); await p.waitForTimeout(400);
await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(1000);
await p.locator('.row:has-text("Trocar a senha") button').click(); await p.waitForTimeout(700);
const campos = p.locator('#sheetBody input[type=password]');
await campos.nth(0).fill('senha1234');
await campos.nth(1).fill('outrasenha9');
await campos.nth(2).fill('outrasenha9');
await p.click('#sheetBody .sheet__actions .btn--solid');
await p.waitForTimeout(3000);
checa('trocar a senha apaga o selo velho', await p.evaluate(() => !localStorage.getItem('caderno.face.v1')));

console.log('erros:', errs.length ? errs.join(', ') : 'nenhum');
await b.close();
process.exit(errs.length ? 1 : 0);
