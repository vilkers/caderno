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
      /* Onde, dentro do item, o dedo encostou. É a única coisa que não muda
         durante o arrasto — e é por isso que ela é a âncora.

         Antes o deslocamento era medido a partir do ponto de partida do dedo
         (`ev.clientY - y0`). Só que a cada troca de lugar o item pula uma
         linha inteira no layout, e o deslocamento continuava contando do
         zero antigo: o retângulo corria na frente do dedo, disparava a troca
         seguinte sozinho, e um item arrastado três posições ia parar no fim
         da lista. Havia um `reancorar()` pra corrigir isso, mas o `mover`
         seguinte recalculava do zero velho e jogava a correção fora.

         Agora a posição é sempre derivada de onde o item ESTÁ, não de onde
         ele estava — o que também acerta lista de linhas com alturas
         diferentes, que é o caso de uma tarefa de três linhas no meio de
         tarefas de uma. */
      const pegadaNoItem = e.clientY - item.getBoundingClientRect().top;

      item.classList.add('arrastando');
      lista.classList.add('arrastando-lista');
      document.body.style.userSelect = 'none';

      /* põe o item sob o dedo, medindo a posição real (sem a máscara) */
      const posicionar = y => {
        item.style.transform = '';
        const base = item.getBoundingClientRect().top;
        item.style.transform = `translateY(${y - pegadaNoItem - base}px)`;
      };

      const mover = ev => {
        posicionar(ev.clientY);
        const centro = meio(item);
        for (const outro of itens()) {
          if (outro === item) continue;
          const m = meio(outro);
          const estaDepois = outro.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING;
          if (estaDepois && centro < m) { lista.insertBefore(item, outro); posicionar(ev.clientY); break; }
          if (!estaDepois && centro > m) { lista.insertBefore(outro, item); posicionar(ev.clientY); break; }
        }
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
