/* Testa a sincronia inteira contra uma API do GitHub falsa em memória:
   dois "aparelhos" (contextos separados) escrevendo o mesmo arquivo. */
import { chromium, pastaDeShots, BASE } from './_comum.mjs';

const remote = { content: null, sha: null };
let puts = 0;
/* simula a consistência com atraso do GitHub: quantas leituras ainda devolvem
   o sha antigo depois de uma gravação */
let leiturasAtrasadas = 0;
let shaAntigo = null;
const errs = [];

async function anotarFetch(page) {
  /* A resposta autenticada do GitHub vem com Cache-Control: private,max-age=60.
     Sem `cache: 'no-store'` o navegador serve a leitura velha por um minuto —
     com o sha antigo — e toda gravação nesse intervalo dá conflito. O route do
     Playwright passa por cima do cache do navegador, então o que dá pra afirmar
     aqui é o que importa: nenhuma chamada à API pode sair sem no-store. */
  await page.addInitScript(() => {
    window.__modosDeCache = [];
    const original = window.fetch;
    window.fetch = (entrada, init) => {
      const url = typeof entrada === 'string' ? entrada : entrada?.url || '';
      if (url.includes('api.github.com')) {
        window.__modosDeCache.push(init?.cache || (entrada?.cache ?? 'padrão'));
      }
      return original(entrada, init);
    };
  });
}

async function mock(page, tag) {
  await page.route('https://api.github.com/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const auth = req.headers()['authorization'];
    if (auth !== 'Bearer github_pat_teste') {
      return route.fulfill({ status: 401, body: '{"message":"Bad credentials"}' });
    }
    if (/\/repos\/[^/]+\/[^/]+$/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ full_name: 'vilkers/caderno', private: true, permissions: { push: true } }) });
    }
    if (url.pathname.includes('/contents/')) {
      if (req.method() === 'GET') {
        if (!remote.content) return route.fulfill({ status: 404, body: '{"message":"Not Found"}' });
        let sha = remote.sha;
        if (leiturasAtrasadas > 0) { leiturasAtrasadas--; sha = shaAntigo || sha; }
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: Buffer.from(remote.content).toString('base64'), sha, encoding: 'base64' }) });
      }
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData());
        if (remote.sha && body.sha !== remote.sha) {
          return route.fulfill({ status: 409, body: '{"message":"conflict"}' });
        }
        remote.content = Buffer.from(body.content, 'base64').toString('utf8');
        remote.sha = 'sha' + (++puts);
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: { sha: remote.sha }, commit: { message: body.message } }) });
      }
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  page.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
  page.on('console', c => { if (c.type() === 'error') errs.push(`${tag} console: ${c.text()}`); });
}

async function ligarSync(p) {
  await p.click('#menuBtn'); await p.waitForTimeout(350); await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(600);
  await p.click('button:has-text("ligar sincronia"), button:has-text("configurar")'); await p.waitForTimeout(600);
  const inputs = p.locator('.sheet__body input');
  await inputs.nth(0).fill('vilkers');
  await inputs.nth(1).fill('caderno');
  await inputs.nth(4).fill('github_pat_teste');
  await p.click('.sheet__actions .btn--solid');
  await p.waitForTimeout(2500);
}

async function irAjustes(p) {
  await p.click('#menuBtn'); await p.waitForTimeout(400);
  await p.click('.menuitem:has-text("Ajustes")'); await p.waitForTimeout(700);
}

const b = await chromium.launch();

/* ── Aparelho A ── */
const A = await b.newPage({ viewport: { width: 1280, height: 900 } });
await anotarFetch(A); await mock(A, 'A');
await A.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await A.fill('#lockPass', 'senha1234'); await A.fill('#lockPass2', 'senha1234'); await A.click('#lockBtn');
await A.waitForSelector('#app:not([hidden])'); await A.waitForTimeout(700);
await (await A.$$('.tog'))[0].click();                       // academia hoje
/* O veículo dos dados era uma tarefa da lista. Tarefas mudaram para o app
   tarefas/; aqui o que viaja entre aparelhos é uma categoria do check-in,
   que também junta por id e apaga com lápide. */
const criarCategoria = (p, label) => p.evaluate(async label => {
  const s = await import('./js/store.js'); s.addCategory({ emoji: '🧪', label, type: 'toggle' });
}, label);
const apagarCategoria = (p, label) => p.evaluate(async label => {
  const s = await import('./js/store.js'); s.removeCategory(s.activeCategories().find(c => c.label === label).id);
}, label);
const nossas = async p => {
  await p.click('.nav__item[data-view="hoje"]'); await p.waitForTimeout(600);
  return p.$$eval('.entry__label', n => n.map(x => x.textContent).filter(t => /aparelho|conflito/.test(t)));
};
await criarCategoria(A, 'hábito do aparelho A'); await A.waitForTimeout(400);
await ligarSync(A);
console.log('A: arquivo remoto criado:', !!remote.content, '| puts:', puts);
const cifrado = !!remote.content && remote.content.includes('"ct"') && !remote.content.includes('aparelho A');
console.log('A: conteúdo é cifrado (sem texto legível):', cifrado);
if (!cifrado) errs.push('o arquivo remoto não está cifrado');
console.log('A: status no topo:', await A.$eval('#syncBtn', n => n.dataset.state));

/* ── Aparelho B ── */
const B = await b.newPage({ viewport: { width: 1280, height: 900 } });
await anotarFetch(B); await mock(B, 'B');
await B.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await B.fill('#lockPass', 'senha1234'); await B.fill('#lockPass2', 'senha1234'); await B.click('#lockBtn');
await B.waitForSelector('#app:not([hidden])'); await B.waitForTimeout(700);
await ligarSync(B);
const deAemB = await nossas(B);
console.log('B: puxou a categoria de A:', deAemB);
if (!deAemB.includes('hábito do aparelho A')) errs.push('B não puxou o que A gravou');

/* B cria uma categoria e sincroniza; A puxa */
await criarCategoria(B, 'hábito do aparelho B'); await B.waitForTimeout(400);
await B.click('#menuBtn'); await B.waitForTimeout(350); await B.click('.menuitem:has-text("Ajustes")'); await B.waitForTimeout(500);
await B.click('button:has-text("sincronizar agora")'); await B.waitForTimeout(2000);

await A.click('#menuBtn'); await A.waitForTimeout(350); await A.click('.menuitem:has-text("Ajustes")'); await A.waitForTimeout(400);
await A.click('button:has-text("puxar do repositório")'); await A.waitForTimeout(2000);
const emA = await nossas(A);
console.log('A: depois de puxar:', emA);
if (!emA.includes('hábito do aparelho B')) errs.push('A não puxou o que B gravou');

/* apagar em A propaga para B (lápide) */
await apagarCategoria(A, 'hábito do aparelho A'); await A.waitForTimeout(500);
await A.click('#menuBtn'); await A.waitForTimeout(350); await A.click('.menuitem:has-text("Ajustes")'); await A.waitForTimeout(400);
await A.click('button:has-text("sincronizar agora")'); await A.waitForTimeout(2200);
await B.click('#menuBtn'); await B.waitForTimeout(350); await B.click('.menuitem:has-text("Ajustes")'); await B.waitForTimeout(400);
await B.click('button:has-text("puxar do repositório")'); await B.waitForTimeout(2000);
const emBDepois = await nossas(B);
console.log('B: depois da exclusão em A:', emBDepois);
if (emBDepois.includes('hábito do aparelho A')) errs.push('a exclusão em A ressuscitou em B');

/* token errado → erro claro */
await B.evaluate(async () => { const s = await import('./js/store.js'); s.setSync({ token: 'errado' }); });
await B.click('#menuBtn'); await B.waitForTimeout(350); await B.click('.menuitem:has-text("Ajustes")'); await B.waitForTimeout(400);
await B.click('button:has-text("sincronizar agora")'); await B.waitForTimeout(1500);
const estadoTokenErrado = await B.$eval('#syncBtn', n => n.dataset.state);
console.log('B: status com token errado:', estadoTokenErrado);
if (estadoTokenErrado !== 'error') errs.push('token errado não virou erro no topo');

/* ── o repositório fica "atrasado" e a gravação bate de frente ── */
await B.evaluate(async () => { const s = await import('./js/store.js'); s.setSync({ token: 'github_pat_teste' }); });
await criarCategoria(B, 'hábito depois do conflito'); await B.waitForTimeout(500);
shaAntigo = remote.sha; leiturasAtrasadas = 2;      // duas leituras devolvem o sha velho
const errosAntesDoConflito = errs.length;
const putsAntes = puts;
await B.click('#menuBtn'); await B.waitForTimeout(350); await B.click('.menuitem:has-text("Ajustes")'); await B.waitForTimeout(500);
await B.click('button:has-text("sincronizar agora")'); await B.waitForTimeout(6000);
console.log('B: com o repositório atrasado, status:', await B.$eval('#syncBtn', n => n.dataset.state));
console.log('B: gravou depois de repicar:', puts > putsAntes, `(${puts - putsAntes} gravação(ões) aceitas)`);
if (!(puts > putsAntes)) errs.push('com o repositório atrasado, B não conseguiu gravar');
console.log('B: o arquivo continua cifrado:', remote.content.includes('"ct"'));

/* ── nada mudou: não deve gravar de novo ── */
const putsAgora = puts;
await B.click('button:has-text("sincronizar agora")'); await B.waitForTimeout(2500);
console.log('B: sincronia sem mudança nenhuma gravou?', puts > putsAgora ? 'GRAVOU (ruim)' : 'não gravou ✓');

const modos = await A.evaluate(() => window.__modosDeCache);
console.log('chamadas à API:', modos.length,
  '| todas com no-store:', modos.length > 0 && modos.every(m => m === 'no-store') ? 'sim ✓' : `NÃO — ${[...new Set(modos)].join(', ')}`);

console.log('puts totais:', puts);
/* O mock devolve 404 (arquivo ainda não existe) e 401 (token errado) de
   propósito — são dois caminhos que o teste exercita. O 409 também é de
   propósito, mas só vale no trecho do repositório atrasado: fora dele é
   conflito de verdade. Só o que não for isso conta como erro. */
const esperado = (e, i) => /status of (404|401)/.test(e)
  || (i >= errosAntesDoConflito && /status of 409/.test(e));
const reais = errs.filter((e, i) => !esperado(e, i));
console.log('ruído esperado do mock (404/401/409):', errs.length - reais.length);
console.log('erros:', reais.length ? reais : 'nenhum');
await b.close();
