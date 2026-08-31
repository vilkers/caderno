/* idb.js — uma gaveta minúscula que o service worker consegue abrir.

   O cofre é cifrado e a chave só existe na memória enquanto o app está
   destrancado — então o worker NÃO tem como saber o que falta no seu dia.
   O que fica aqui é o mínimo para um lembrete existir: quantas marcações
   faltam hoje, se o dia foi fechado e a hora escolhida. Nomes de categoria
   só entram se você pedir, porque aviso de tela bloqueada é público. */

const BANCO = 'caderno';
const LOJA = 'resumo';
const CHAVE = 'hoje';

function abrir() {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

export async function guardarResumo(dados) {
  try {
    const db = await abrir();
    await new Promise((ok, falha) => {
      const tx = db.transaction(LOJA, 'readwrite');
      tx.objectStore(LOJA).put(dados, CHAVE);
      tx.oncomplete = ok;
      tx.onerror = () => falha(tx.error);
    });
    db.close();
  } catch { /* sem IndexedDB, o lembrete simplesmente não acontece */ }
}

export async function lerResumo() {
  try {
    const db = await abrir();
    const dados = await new Promise((ok, falha) => {
      const tx = db.transaction(LOJA, 'readonly');
      const req = tx.objectStore(LOJA).get(CHAVE);
      req.onsuccess = () => ok(req.result || null);
      req.onerror = () => falha(req.error);
    });
    db.close();
    return dados;
  } catch { return null; }
}
