/* sprites.js — pixel art original do Caderno 2.0.

   Nada aqui foi baixado: sprites da Nintendo são propriedade dela, e os
   sites de assets nem estão acessíveis daqui. Cada bicho abaixo é uma
   matriz de caracteres desenhada à mão, virada em <svg> de retângulos com
   shape-rendering=crispEdges — escala sem borrar e herda a paleta. */

const P = {                       // paleta base (NES-ish)
  k: '#000000',                   // contorno
  w: '#fcfcfc',                   // branco
  y: '#fac000',                   // ouro
  o: '#e45c10',                   // laranja queimado
  b: '#8c3800',                   // marrom escuro
  f: '#e39b2e',                   // face do bloco
  r: '#d82800',                   // vermelho
  g: '#00a844',                   // verde
  G: '#006818',                   // verde escuro
  c: '#3cbcfc',                   // azul claro
  B: '#0058f8',                   // azul
  s: '#f8b088',                   // pele
  t: '#00887c',                   // teal (camisa)
  d: '#503000',                   // sombra
  p: '#7c3cbc',                   // roxo
};

/* ── Matrizes ──────────────────────────────────────────────── */
export const SPRITES = {
  /* moeda girando: dois quadros */
  moeda_a: [
    '..kkkk..',
    '.kyyyyk.',
    'kyywwyyk',
    'kyywwyyk',
    'kyywwyyk',
    'kyywwyyk',
    '.kyyyyk.',
    '..kkkk..',
  ],
  moeda_b: [
    '...kk...',
    '..kyyk..',
    '..kywk..',
    '..kywk..',
    '..kywk..',
    '..kywk..',
    '..kyyk..',
    '...kk...',
  ],

  /* bloco de interrogação (categoria por responder) */
  bloco: [
    'kkkkkkkkkkkkkkkk',
    'kffffffffffffffk',
    'kfkffffffffffkfk',
    'kffffkkkkffffffk',
    'kfffkkwwkkfffffk',
    'kfffkwffwkfffffk',
    'kfffkkffkkfffffk',
    'kfffffkkwkfffffk',
    'kffffkkwkffffffk',
    'kffffkwkfffffffk',
    'kffffkkffffffffk',
    'kfffffffffffffik',
    'kffffkkfffffffik',
    'kfkffkkffffffkfk',
    'kffffffffffffffk',
    'kkkkkkkkkkkkkkkk',
  ],

  /* bloco batido (categoria respondida) */
  batido: [
    'kkkkkkkkkkkkkkkk',
    'kbbbbbbbbbbbbbbk',
    'kbkbbbbbbbbbbkbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbk',
    'kbkbbbbbbbbbbkbk',
    'kbbbbbbbbbbbbbbk',
    'kkkkkkkkkkkkkkkk',
  ],

  /* tijolo */
  tijolo: [
    'kkkkkkkkkkkkkkkk',
    'kooooookoooooook',
    'kooooookoooooook',
    'kkkkkkkkkkkkkkkk',
    'koookoooooookook',
    'koookoooooookook',
    'kkkkkkkkkkkkkkkk',
    'kooooookoooooook',
    'kooooookoooooook',
    'kkkkkkkkkkkkkkkk',
    'koookoooooookook',
    'koookoooooookook',
    'kkkkkkkkkkkkkkkk',
    'kooooookoooooook',
    'kooooookoooooook',
    'kkkkkkkkkkkkkkkk',
  ],

  /* bandeira do fim da fase */
  bandeira: [
    '.....kkk........',
    '....kwwwk.......',
    '....kwkwk.......',
    '.....kkk........',
    '.....kwk........',
    '.....kwkrrrrrk..',
    '.....kwkrrrrrk..',
    '.....kwkrrrrk...',
    '.....kwkrrrk....',
    '.....kwkrrk.....',
    '.....kwkrk......',
    '.....kwk........',
    '.....kwk........',
    '.....kwk........',
    '....kkwkk.......',
    '...kgggggk......',
  ],

  /* estrela (troféu) */
  estrela: [
    '.......kk.......',
    '.......kk.......',
    '......kyyk......',
    '......kyyk......',
    '.kkkkkkyykkkkkk.',
    '.kyyyyyyyyyyyyk.',
    '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...',
    '...kyyyyyyyyk...',
    '..kyyyykkyyyyk..',
    '..kyyyk..kyyyk..',
    '.kyyyk....kyyyk.',
    '.kyyk......kyyk.',
    '.kyk........kyk.',
    '.kk..........kk.',
    '................',
  ],

  /* cano */
  cano: [
    'kkkkkkkkkkkkkkkk',
    'kgggggggggggggGk',
    'kgwggggggggggGGk',
    'kgwggggggggggGGk',
    'kgggggggggggggGk',
    'kkkkkkkkkkkkkkkk',
    '..kggggggggggGk.',
    '..kgwgggggggGGk.',
    '..kgwgggggggGGk.',
    '..kgwgggggggGGk.',
    '..kgwgggggggGGk.',
    '..kgwgggggggGGk.',
    '..kgwgggggggGGk.',
    '..kgwgggggggGGk.',
    '..kgwgggggggGGk.',
    '..kkkkkkkkkkkkk.',
  ],

  /* nuvem */
  nuvem: [
    '......kkkk......',
    '.....kwwwwk.....',
    '..kkkwwwwwwkkk..',
    '.kwwwwwwwwwwwwk.',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    '.kkkkkkkkkkkkkk.',
    '................',
  ],

  /* o Caderninho — personagem original: boné, camisa teal, lápis na orelha */
  heroi_a: [
    '...kkkkk....',
    '..ktttttk...',
    '.kttttttkk..',
    '.kkkkkkkkk..',
    '..ksssssk...',
    '..kskkssk...',
    '..ksssssky..',
    '...kssskky..',
    '..ktttttk...',
    '.kttttttk...',
    'kkttkttkk...',
    'kwwkkkkww...',
    '..kBBBBk....',
    '..kBBBBk....',
    '..kBk.kBk...',
    '.kkk...kkk..',
  ],
  heroi_b: [
    '...kkkkk....',
    '..kttttttk..',
    '.kttttttkk..',
    '.kkkkkkkkk..',
    '..ksssssk...',
    '..kskkssk...',
    '..ksssssky..',
    '...kssskky..',
    '..ktttttk...',
    '.kttttttk...',
    'kkttkttkk...',
    'kwwkkkkww...',
    '...kBBBk....',
    '..kBBBBBk...',
    '.kBk...kBk..',
    'kkk.....kkk.',
  ],

  /* coração de vida */
  coracao: [
    '.kk..kk.',
    'krrkkrrk',
    'krrrrrrk',
    'krrrrrrk',
    '.krrrrk.',
    '..krrk..',
    '...kk...',
    '........',
  ],

  /* cadeado da tela de senha */
  cadeado: [
    '...kkkk...',
    '..kyyyyk..',
    '.kykkkkyk.',
    '.kyk..kyk.',
    'kkkkkkkkkk',
    'kyyyyyyyyk',
    'kyykkkkyyk',
    'kyykyykyyk',
    'kyykkkkyyk',
    'kkkkkkkkkk',
  ],
};

/* ── Renderização ──────────────────────────────────────────── */
/** Confere se a matriz é retangular (usado pelo teste de sprites). */
export function validar(nome) {
  const m = SPRITES[nome];
  if (!m || !m.length) throw new Error(`sprite ${nome} vazio`);
  const w = m[0].length;
  m.forEach((linha, i) => {
    if (linha.length !== w) throw new Error(`sprite ${nome}: linha ${i} tem ${linha.length}, esperado ${w}`);
  });
  return { w, h: m.length };
}

const SVGNS = 'http://www.w3.org/2000/svg';

/**
 * Devolve um <svg> do sprite. Retângulos são unidos na horizontal para
 * não encher a tela de nós inúteis.
 */
export function sprite(nome, { scale = 3, cores = {}, cls = '' } = {}) {
  const m = SPRITES[nome];
  if (!m) throw new Error(`sprite desconhecido: ${nome}`);
  const w = m[0].length, h = m.length;
  const pal = { ...P, ...cores };

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', String(w * scale));
  svg.setAttribute('height', String(h * scale));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);

  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const ch = m[y][x];
      if (ch === '.') { x++; continue; }
      let run = 1;
      while (x + run < w && m[y][x + run] === ch) run++;
      const rect = document.createElementNS(SVGNS, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(run));
      rect.setAttribute('height', '1');
      rect.setAttribute('fill', pal[ch] || ch);
      svg.append(rect);
      x += run;
    }
  }
  return svg;
}

/** Sprite que alterna entre dois quadros (moeda girando, herói andando). */
export function animado(a, b, { scale = 3, ms = 320, cls = '' } = {}) {
  const box = document.createElement('span');
  box.className = 'spr ' + cls;
  const qa = sprite(a, { scale }), qb = sprite(b, { scale });
  qb.style.display = 'none';
  box.append(qa, qb);
  let liga = true;
  const parar = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!parar) {
    setInterval(() => {
      liga = !liga;
      qa.style.display = liga ? '' : 'none';
      qb.style.display = liga ? 'none' : '';
    }, ms);
  }
  return box;
}

export { P as PALETA };
