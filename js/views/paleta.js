/* views/paleta.js — a folha de trocar de paleta.

   Mora fora das telas porque é chamada de dois lugares: o menu (acesso
   rápido) e Ajustes. Antes a grade estava duplicada nos dois, com o mesmo
   HTML escrito duas vezes e dois comportamentos ligeiramente diferentes. */

import { el } from '../utils.js';
import * as store from '../store.js';
import * as vault from '../vault.js';
import { PALETTES, applyPalette } from '../palettes.js';
import { openSheet, toast } from '../ui.js';

/** `aoTrocar` é chamada depois de aplicar, pra tela se repintar. */
export function abrirPaleta(aoTrocar = () => {}) {
  openSheet('Paleta', close => {
    const grid = el('div.palettes', {}, PALETTES.map(p =>
      el('button.pal' + (store.state.settings.palette === p.id ? '.is-on' : ''), {
        type: 'button',
        onclick: () => {
          store.setSetting('palette', p.id);
          applyPalette(p.id);
          vault.writeMeta({ palette: p.id });
          close();
          toast(`paleta ${p.name.toLowerCase()}`);
          aoTrocar();
        },
      }, [
        el('div.pal__sw', {}, [
          el('i', { style: { background: p.vars.bg } }),
          el('i', { style: { background: p.vars.fg } }),
          el('i', { style: { background: p.vars.accent } }),
        ]),
        el('span.pal__n', { text: p.name }),
      ])));
    return [grid];
  });
}
