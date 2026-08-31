/* avatar.js — a cara do dono do caderno.

   A foto é reduzida a 192px e guardada como data URL DENTRO do cofre, então
   ela é cifrada como o resto e viaja na sincronia junto. Sem foto, iniciais. */

import { el } from './utils.js';
import * as store from './store.js';

export const LADO = 192;

/* Os degraus de texto do CSS. As iniciais são proporcionais ao círculo, mas
   encostam no degrau mais próximo — senão o avatar inventa um corpo de 11px
   que não existe em lugar nenhum do resto do app. */
const DEGRAUS = [10, 12, 15, 17, 21, 26, 32, 44];
const degrauMaisProximo = alvo =>
  DEGRAUS.reduce((a, b) => (Math.abs(b - alvo) < Math.abs(a - alvo) ? b : a));

/** Elemento de avatar pronto para o topo, o perfil ou onde for. */
export function avatar(tamanho = 32, { cls = '' } = {}) {
  const foto = store.state.profile?.foto;
  const caixa = el('span.av' + (cls ? '.' + cls : ''), {
    style: { width: `${tamanho}px`, height: `${tamanho}px`, fontSize: `${degrauMaisProximo(tamanho * 0.38)}px` },
  });
  if (foto) {
    caixa.append(el('img', { src: foto, alt: '', width: tamanho, height: tamanho }));
  } else {
    caixa.classList.add('av--letras');
    caixa.append(el('span', { text: store.iniciais() }));
  }
  return caixa;
}

/** Reduz e recorta a imagem escolhida num quadrado. Devolve data URL. */
export async function fotoDeArquivo(file, lado = LADO) {
  const bitmap = await criarBitmap(file);
  const tela = document.createElement('canvas');
  tela.width = tela.height = lado;
  const ctx = tela.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const escala = Math.max(lado / bitmap.width, lado / bitmap.height);
  const l = bitmap.width * escala, a = bitmap.height * escala;
  ctx.drawImage(bitmap, (lado - l) / 2, (lado - a) / 2, l, a);
  bitmap.close?.();

  let url = tela.toDataURL('image/jpeg', 0.78);
  if (url.length > 220_000) url = tela.toDataURL('image/jpeg', 0.6);   // teto de segurança
  return url;
}

async function criarBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);   // navegador sem a opção de orientação
  }
}
