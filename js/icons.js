/* icons.js — o traço da casa: 24×24, sem preenchimento, 1.7 de espessura.
   Emoji continua sendo do usuário (categorias); a interface usa isto. */

const NS = 'http://www.w3.org/2000/svg';

const D = {
  hoje:     ['M4 7.5h16M4 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M8 3.5v4M16 3.5v4', 'M8.5 13.5l2.2 2.2 4.3-4.6'],
  mes:      ['M4 7.5h16M4 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M8 3.5v4M16 3.5v4', 'M8 11.5h2M14 11.5h2M8 15.5h2M14 15.5h2'],
  lista:    ['M4.5 7h3l1.5 1.5M4.5 12.5h3L9 14M4.5 18h3L9 19.5', 'M12 7.5h7.5M12 13h7.5M12 18.5h7.5'],
  insights: ['M4 19.5h16', 'M7 19.5v-6M12 19.5V7M17 19.5v-9'],
  metas:    ['M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z', 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z'],
  estrela:  ['M12 3.7l2.6 5.6 6 .9-4.4 4.3 1.1 6.1L12 17.7 6.7 20.6l1.1-6.1L3.4 10.2l6-.9z'],
  menu:     ['M4.5 7.5h15M4.5 12h15M4.5 16.5h15'],
  perfil:   ['M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20.5a7.5 7.5 0 0 1 15 0'],
  cadeado:  ['M4 10.5h16v10H4z', 'M8 10.5V7a4 4 0 0 1 8 0v3.5'],
  paleta:   ['M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2-1.6 2.5-3 2.5h-1.5a2 2 0 0 0-1.3 3.5c.5.5.3 2-1.7 2z', 'M7.5 12.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M11 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M15 10.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  nuvem:    ['M7 18.5h10a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.7-1.3A3.6 3.6 0 0 0 7 18.5z', 'M12 15.5v-4M10 13l2-2 2 2'],
  baixar:   ['M12 4.5v10M8.5 11l3.5 3.5L15.5 11', 'M5 19.5h14'],
  jogo:     ['M8 11.5v3M6.5 13h3', 'M15.5 12.5h.01M17.5 14.5h.01', 'M6.5 8.5h11a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-11a4 4 0 0 1-4-4v-1a4 4 0 0 1 4-4z'],
  ajustes:  ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.1 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2 2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4z'],
};

export function icon(nome, tamanho = 20) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(tamanho));
  svg.setAttribute('height', String(tamanho));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  (D[nome] || []).forEach(d => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  });
  return svg;
}
