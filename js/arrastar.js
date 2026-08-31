/* arrastar.js — ordenar lista pegando e arrastando.

   Feito com Pointer Events, então mouse, dedo e caneta seguem o mesmo
   caminho. A pega é um punho dedicado (⠿): sem isso, no celular o gesto
   briga com a rolagem da página. Setas ↑↓ no teclado fazem o mesmo, porque
   arrastar não é acessível sozinho. */

const meio = n => { const r = n.getBoundingClientRect(); return r.top + r.height / 2; };

/**
 * @param {HTMLElement} lista  container direto dos itens
 * @param {string} itemSel     seletor dos itens
 * @param {string} pegaSel     seletor da pega dentro do item
 * @param {(ids: string[]) => void} aoSoltar  recebe a nova ordem de data-id
 */
export function listaArrastavel(lista, { itemSel, pegaSel, aoSoltar }) {
  const itens = () => [...lista.querySelectorAll(itemSel)];
  const ids = () => itens().map(n => n.dataset.id);

  lista.querySelectorAll(pegaSel).forEach(pega => {
    const item = pega.closest(itemSel);
    if (!item) return;

    /* ── teclado ── */
    pega.addEventListener('keydown', e => {
      const passo = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      if (!passo) return;
      e.preventDefault();
      const lista0 = itens();
      const i = lista0.indexOf(item);
      const j = i + passo;
      if (j < 0 || j >= lista0.length) return;
      passo < 0 ? lista.insertBefore(item, lista0[j]) : lista.insertBefore(lista0[j], item);
      pega.focus();
      aoSoltar(ids());
    });

    /* ── ponteiro ── */
    pega.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      pega.setPointerCapture(e.pointerId);

      const ordemInicial = ids();
      const y0 = e.clientY;
      const alturaOriginal = item.getBoundingClientRect().height;
      let dy = 0;

      item.classList.add('arrastando');
      lista.classList.add('arrastando-lista');
      document.body.style.userSelect = 'none';

      const mover = ev => {
        dy = ev.clientY - y0;
        item.style.transform = `translateY(${dy}px)`;
        const centro = meio(item);
        for (const outro of itens()) {
          if (outro === item) continue;
          const m = meio(outro);
          const antes = outro.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING;
          if (antes && centro < m) { lista.insertBefore(item, outro); reancorar(ev); break; }
          if (!antes && centro > m) { lista.insertBefore(outro, item); reancorar(ev); break; }
        }
      };
      /* depois de trocar de lugar, o zero do arrasto muda junto */
      const reancorar = ev => {
        item.style.transform = '';
        const novo = item.getBoundingClientRect();
        dy = ev.clientY - (novo.top + alturaOriginal / 2);
        item.style.transform = `translateY(${dy}px)`;
      };

      const soltar = () => {
        pega.removeEventListener('pointermove', mover);
        pega.removeEventListener('pointerup', soltar);
        pega.removeEventListener('pointercancel', cancelar);
        item.style.transform = '';
        item.classList.remove('arrastando');
        lista.classList.remove('arrastando-lista');
        document.body.style.userSelect = '';
        const nova = ids();
        if (nova.join() !== ordemInicial.join()) aoSoltar(nova);
      };
      const cancelar = () => { item.style.transform = ''; soltar(); };

      pega.addEventListener('pointermove', mover);
      pega.addEventListener('pointerup', soltar);
      pega.addEventListener('pointercancel', cancelar);
    });
  });
}
