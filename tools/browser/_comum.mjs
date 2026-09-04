/* _comum.mjs — o que todo teste de navegador precisa antes de começar.

   Existe porque os testes nasceram com dois caminhos absolutos colados
   dentro (o Playwright global e uma pasta de sessão do agente), e caminho
   absoluto não sobrevive a trocar de máquina nem de sessão. */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));

/* O Playwright pode estar no node_modules do projeto ou instalado global.
   Tenta os dois antes de desistir, e a mensagem diz o que fazer. */
async function carregarPlaywright() {
  const require = createRequire(import.meta.url);
  const candidatos = [
    'playwright',
    '/opt/node22/lib/node_modules/playwright/index.mjs',
    '/usr/lib/node_modules/playwright/index.mjs',
    '/usr/local/lib/node_modules/playwright/index.mjs',
  ];
  for (const c of candidatos) {
    try {
      return await import(c.startsWith('/') ? c : require.resolve(c));
    } catch { /* tenta o próximo */ }
  }
  throw new Error(
    'Playwright não encontrado. Instale com:  npm i -D playwright  (ou npm i -g playwright)'
  );
}

export const { chromium } = await carregarPlaywright();

/** Onde as capturas vão parar. Sobrescreva com CADERNO_SHOTS=/algum/lugar. */
export function pastaDeShots(nome = 'shots') {
  const p = process.env.CADERNO_SHOTS || resolve(AQUI, '../../.shots', nome);
  mkdirSync(p, { recursive: true });
  return p;
}

/** O endereço do servidor local. Sobrescreva com CADERNO_URL. */
export const BASE = process.env.CADERNO_URL || 'http://127.0.0.1:8899';

/** Um PNG mínimo em disco, pro teste de foto de perfil não depender de arquivo solto. */
export function fotoDeTeste() {
  const alvo = resolve(pastaDeShots('fixtures'), 'foto-teste.png');
  // 1×1 vermelho — o app reduz e recorta, o conteúdo não importa
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  writeFileSync(alvo, png);
  return alvo;
}
