import assert from 'node:assert/strict';
import { chromium, BASE, pastaDeShots } from './_comum.mjs';

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true,
    hasUserVerification: true, hasPrf: true, isUserVerified: true, automaticPresenceSimulation: true,
  } });
  await page.addInitScript(() => {
    window.google = { accounts: { oauth2: {
      hasGrantedAllScopes: () => true,
      initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'token-ficticio', expires_in: 3600 }) }),
    } } };
  });
  const today = new Date().toLocaleDateString('en-CA');
  const items = [{ id: 'one', title: 'Investir (teste)', status: 'needsAction', due: today + 'T00:00:00.000Z', notes: 'Caderno ID: original\nConferir orçamento\nPrioridade: alta' },
    { id: 'two', title: 'Revisar projeto', status: 'needsAction', due: today + 'T00:00:00.000Z' }];
  let patches = 0, failSave = false, holdPatch;
  await page.route('https://tasks.googleapis.com/**', async route => {
    const req = route.request();
    if (req.url().includes('/users/@me/lists')) return route.fulfill({ json: { items: [{ id: 'board', title: 'Pessoal' }] } });
    if (req.method() === 'GET') return route.fulfill({ json: { items } });
    if (failSave) { failSave = false; return route.fulfill({ status: 503, body: '{}' }); }
    const body = req.postDataJSON();
    if (req.method() === 'POST') {
      const task = { id: 'created-' + items.length, status: 'needsAction', ...body };
      items.push(task);
      return route.fulfill({ json: task });
    }
    patches++;
    if (holdPatch) await holdPatch;
    const task = items.find(item => req.url().endsWith('/' + item.id));
    Object.assign(task, body);
    return route.fulfill({ json: task });
  });
  await page.goto(BASE + '/tarefas/');
  await page.getByRole('button', { name: 'Ativar Face ID', exact: true }).click();
  await page.waitForFunction(() => !!document.querySelector('#taskOverview') || document.querySelector('button')?.textContent === 'Confirmar Face ID');
  const confirm = page.getByRole('button', { name: 'Confirmar Face ID', exact: true });
  if (await confirm.isVisible()) await confirm.click();
  await page.getByRole('button', { name: 'Sincronizar com Google', exact: true }).click();
  await page.getByRole('heading', { name: 'Investir (teste)', exact: true }).waitFor();
  const calendar = page.getByRole('button', { name: '📅 Calendário', exact: true });
  assert.equal(await calendar.getAttribute('aria-expanded'), 'false');
  await calendar.click();
  await page.locator('#taskCalendar').waitFor();
  assert.equal(await page.locator('.task-calendar-day').count(), 42);
  assert.match(await page.locator(`[data-day="${today}"]`).getAttribute('aria-label'), /2 tarefas pendentes/);
  // A tarefa em destaque também aparece na agenda. Ambas as ações compartilham a gravação.
  let releasePatch;
  holdPatch = new Promise(resolve => { releasePatch = resolve; });
  const beforeDuplicates = patches;
  const mainCheck = page.locator('#taskNextComplete');
  const calendarCheck = page.locator('#taskCalendar').getByRole('button', { name: 'Concluir: Investir (teste)', exact: true });
  await mainCheck.focus();
  await mainCheck.press('Enter');
  await page.waitForFunction(() => document.querySelector('#taskNextComplete')?.getAttribute('aria-busy') === 'true');
  assert.equal(await calendarCheck.getAttribute('aria-disabled'), 'true');
  await calendarCheck.evaluate(button => button.click());
  releasePatch();
  holdPatch = null;
  await page.getByText('Tarefa concluída.', { exact: true }).waitFor();
  assert.equal(patches, beforeDuplicates + 1);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'nextTaskTitle');
  assert.ok(items[0].completed);
  await page.getByRole('button', { name: /Desfazer:/ }).click();
  await page.getByText('Tarefa reaberta.', { exact: true }).waitFor();
  assert.equal(items[0].completed, null);
  await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
  await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
  for (const width of [360, 393, 440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `calendário sem overflow em ${width}px`);
  }
  await calendar.click();
  assert.equal(await page.locator('#taskCalendar').count(), 0);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  assert.equal(await page.getByLabel('Notas', { exact: true }).inputValue(), 'Conferir orçamento');
  await page.getByLabel('Título', { exact: true }).fill('Investir atualizado');
  await page.getByLabel('Inserir emoji no título', { exact: true }).click();
  await page.getByRole('button', { name: 'Inserir 💰 no título', exact: true }).click();
  await page.getByLabel('Notas', { exact: true }).fill('Notas editadas\nhttps://example.com');
  await page.getByLabel('Inserir emoji nas notas', { exact: true }).click();
  await page.getByRole('button', { name: 'Inserir 🧠 nas notas', exact: true }).click();
  await page.getByLabel('Prioridade', { exact: true }).selectOption('normal');
  await page.getByRole('button', { name: 'Sem prazo', exact: true }).click();
  failSave = true;
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await page.locator('.status.error').waitFor();
  assert.equal(await page.getByLabel('Título', { exact: true }).inputValue(), 'Investir atualizado💰');
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await page.getByText('Alterações salvas.', { exact: true }).waitFor();
  assert.equal(items[0].notes, 'Caderno ID: original\nNotas editadas\nhttps://example.com🧠');
  assert.equal(items[0].due.slice(0, 10), today);
  // Real touch input exercises browser pointer capture, cancellation and pan-y.
  async function swipe(dx, dy = 0, cancel = false) {
    const track = page.locator('.task-swipe');
    await track.scrollIntoViewIfNeeded();
    const box = await track.boundingBox();
    const x = box.x + 24, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  }
  await page.setViewportSize({ width: 393, height: 852 });
  const baseline = patches;
  await swipe(30);
  await swipe(120, 0, true);
  await swipe(5, 90);
  assert.equal(patches, baseline, 'arrasto curto, cancelado e vertical não concluem');
  await swipe(120);
  await page.getByText('Tarefa concluída.', { exact: true }).waitFor();
  assert.equal(items[0].status, 'completed');
  assert.equal(patches, baseline + 1, 'arrasto salva uma única conclusão');
  await page.getByRole('button', { name: /Desfazer:/ }).click();
  await page.getByText('Tarefa reaberta.', { exact: true }).waitFor();
  assert.equal(items[0].status, 'needsAction');
  const box = await page.locator('.task-swipe').boundingBox();
  await page.mouse.move(box.x + 24, box.y + 35);
  await page.mouse.down();
  await page.mouse.move(box.x + 144, box.y + 35, { steps: 8 });
  await page.mouse.up();
  await page.getByText('Tarefa concluída.', { exact: true }).waitFor();
  assert.equal(items[0].status, 'completed', 'mouse também conclui');
  await page.getByRole('button', { name: '+ Nova tarefa', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Nova com notas');
  await page.getByLabel('Notas', { exact: true }).fill('Contexto 🎨');
  await page.getByLabel('Prioridade', { exact: true }).selectOption('high');
  await page.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await page.getByText('Tarefa criada.', { exact: true }).waitFor();
  assert.equal(items.at(-1).notes, 'Contexto 🎨\nPrioridade: alta');
  await calendar.click();
  await page.screenshot({ path: pastaDeShots('tarefas') + '/calendario.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('erros: nenhum');
} finally { await browser.close(); }
