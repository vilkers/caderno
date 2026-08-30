# Tema pixel

A pele que o Caderno 2.0 usa: cinco mundos (paletas), duas fontes de bitmap,
treze sprites desenhados à mão e os bipes sintetizados. Está **guardado aqui
para ser enxertado no app principal** quando a versão atual amadurecer —
por isso nada neste diretório sabe o que é um "dia" ou uma "categoria".

```
tokens.css     paletas dos mundos, fontes e medidas (só variáveis + @font-face)
sprites.js     SPRITES (matrizes de caracteres) + sprite() e animado()
sfx.js         moeda, pulo, bump, power-up, 1-up, fim de fase — WebAudio puro
```

As fontes (`Press Start 2P`, `Silkscreen` — ambas OFL) moram em
`retro/assets/fonts/`, e `tokens.css` aponta para lá.

## Como aplicar no app principal

Nenhuma dessas etapas exige mexer em `js/store.js` ou em qualquer regra de
negócio: o tema é só aparência.

**1. Vocabulário.** No `css/app.css`, importe os tokens e faça as variáveis
do app apontarem para as do tema:

```css
@import url('../temas/pixel/tokens.css');

[data-pele="pixel"]{
  --bg:var(--ceu); --fg:var(--tinta); --dim:var(--tinta2);
  --accent:var(--ouro); --ink:var(--preto); --line:var(--linha);
  --surface:rgba(0,0,0,.35); --surface-2:rgba(0,0,0,.5);
  --font-display:'Press Start 2P',monospace;
  --font-mono:'Silkscreen',monospace;
}
```

**2. Forma.** Um bloco de regras sob `[data-pele="pixel"]` tira o que a pele
não aceita — arredondamento, sombra macia, easing suave:

```css
[data-pele="pixel"] *{border-radius:0!important}
[data-pele="pixel"]{--ease:steps(4,end);--dur:.2s}
[data-pele="pixel"] .btn,[data-pele="pixel"] .entry{box-shadow:0 0 0 2px var(--linha) inset}
```

**3. Arte.** Onde hoje há emoji ou ícone de traço, chame o sprite:

```js
import { sprite, animado } from '../temas/pixel/sprites.js';
card.prepend(sprite(feito ? 'batido' : 'bloco', { scale: 3 }));
hud.append(animado('moeda_a', 'moeda_b', { scale: 2 }));
```

**4. Som.** Ligue nos mesmos pontos em que o app já dá retorno (marcar, subir
de nível, apagar):

```js
import * as sfx from '../temas/pixel/sfx.js';
sfx.mudo(store.state.settings.som === false);
sfx.moeda();      // marcou
sfx.vida1up();    // subiu de nível
```

**5. Interruptor.** `document.documentElement.dataset.pele = 'pixel' | ''`,
guardado em `store.state.settings.pele`. Como as duas peles leem o mesmo
cofre, trocar é instantâneo e não migra dado nenhum.

## O que faltaria para virar pele oficial

- Um `temas/classico/tokens.css` com as variáveis de hoje, para as duas
  peles terem a mesma forma de arquivo.
- Decidir o que fazer com componentes que não têm par (o medidor 0–10 do
  clássico × o medidor da caixa de diálogo da 2.0) — provavelmente manter
  o do clássico e só trocar a moldura.
- Sprites para as categorias que hoje usam emoji, se a ideia for abandonar
  emoji na pele pixel.

## Testes

`node tools/test-sprites.mjs` confere se toda matriz de sprite fecha
retangular — uma linha torta estraga o desenho inteiro e é o erro mais fácil
de cometer desenhando à mão.
