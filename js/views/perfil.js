/* views/perfil.js — quem está do outro lado do caderno.

   Nome, foto e uma linha sua; do lado, o que o caderno sabe sobre você em
   números. Tudo cifrado como o resto — a foto não sai do cofre. */

import { el, longDay, keyOf, nf } from '../utils.js';
import * as store from '../store.js';
import { summary as placar } from '../badges.js';
import { logStreak, loggedDays } from '../analysis.js';
import { avatar, fotoDeArquivo } from '../avatar.js';
import { toast, confirmSheet } from '../ui.js';

export function render(ctx) {
  const view = el('div.view');
  const p = store.state.profile || {};
  const b = placar();

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '07 — PERFIL' }),
      el('h2.display.h-lg', { text: 'PERFIL' }),
    ]),
    el('div.vhead__r', {}, [
      el('button.btn.btn--sm', { type: 'button', onclick: () => ctx.voltar(), text: '← voltar' }),
    ]),
  ]));

  /* ── cartão de identidade ── */
  const foto = el('div.perfil__foto');
  const botoesFoto = el('div.wrap', { style: { justifyContent: 'center' } });
  const pintaFoto = () => {
    foto.replaceChildren(avatar(112, { cls: 'av--grande' }));
    const tem = !!store.state.profile?.foto;
    botoesFoto.replaceChildren(
      el('button.btn.btn--sm', { type: 'button', onclick: () => arquivo.click() },
        [el('span', { text: tem ? 'trocar foto' : 'pôr foto' })]),
    );
    if (tem) {
      botoesFoto.append(el('button.btn.btn--sm.btn--ghost', {
        type: 'button',
        onclick: () => confirmSheet({
          title: 'Tirar a foto?', text: 'Volta pras iniciais. Dá pra pôr outra depois.',
          ok: 'Tirar', danger: true,
          onOk: () => { store.setProfile({ foto: '' }); pintaFoto(); ctx.pintaTopo?.(); },
        }),
      }, [el('span', { text: 'tirar' })]));
    }
  };

  const arquivo = el('input', { type: 'file', accept: 'image/*', hidden: true });
  arquivo.addEventListener('change', async () => {
    const f = arquivo.files?.[0];
    if (!f) return;
    try {
      const url = await fotoDeArquivo(f);
      store.setProfile({ foto: url });
      pintaFoto();
      ctx.pintaTopo?.();
      toast('foto trocada');
    } catch {
      toast('não consegui ler essa imagem');
    }
    arquivo.value = '';
  });

  const nome = el('input.perfil__nome', {
    type: 'text', value: p.nome || '', placeholder: 'Seu nome', maxlength: 40, 'aria-label': 'Nome',
  });
  let tn;
  nome.addEventListener('input', () => {
    clearTimeout(tn);
    tn = setTimeout(() => { store.setProfile({ nome: nome.value.trim() }); ctx.pintaTopo?.(); }, 400);
  });

  const frase = el('input.perfil__frase', {
    type: 'text', value: p.frase || '', placeholder: 'Uma linha sua (opcional)', maxlength: 70, 'aria-label': 'Frase',
  });
  let tf;
  frase.addEventListener('input', () => {
    clearTimeout(tf);
    tf = setTimeout(() => store.setProfile({ frase: frase.value.trim() }), 400);
  });

  pintaFoto();

  view.append(el('div.perfil', {}, [
    el('div.perfil__lado', {}, [foto, botoesFoto, arquivo]),
    el('div.perfil__campos', {}, [
      el('label.field', {}, [el('span.micro', { text: 'NOME' }), nome]),
      el('label.field', {}, [el('span.micro', { text: 'FRASE' }), frase]),
      el('p.micro', { text: `NO CADERNO DESDE ${new Date(p.desde || Date.now()).toLocaleDateString('pt-BR')}` }),
    ]),
  ]));

  /* ── o que o caderno sabe ── */
  const dias = Object.keys(store.state.days).filter(k => store.hasEntry(k));
  view.append(el('div.stats', { style: { marginTop: '1.6rem' } }, [
    stat(dias.length, 'dias registrados'),
    stat(logStreak(), 'sequência atual'),
    stat(`${b.level.i + 1}/8`, b.level.name.toLowerCase()),
    stat(`${b.ganhas}/${b.total}`, 'conquistas'),
  ]));

  /* ── atalhos organizados ── */
  view.append(el('div.section', { style: { marginTop: '2rem' } }, [
    el('div.section__h', {}, [el('p.micro', { text: 'DO SEU JEITO' })]),
    el('div.atalhos', {}, [
      atalho('Retrospectiva', 'O seu caderno até aqui, em tela cheia.', () => ctx.go('resumo')),
      atalho('Metas e cobrança', 'O que o dia exige e o que é da semana.', () => ctx.go('metas')),
      atalho('Insights', 'Padrões, sequências e o que eu leio nos seus dados.', () => ctx.go('insights')),
      atalho('Ajustes', 'Paleta, categorias, sincronia, senha e backup.', () => ctx.go('ajustes')),
      atalho('Caderno 2.0', 'A mesma rotina em forma de fase, com os mesmos dados.', () => { location.href = './retro/'; }),
    ]),
  ]));

  return view;
}

const stat = (n, rot) => el('div.stat', {}, [
  el('span.stat__n.num', { text: String(n) }),
  el('p.micro.stat__l', { text: rot }),
]);

const atalho = (titulo, desc, onclick) => el('button.atalho', { type: 'button', onclick }, [
  el('div', {}, [
    el('p.row__t', { text: titulo }),
    el('p.row__d', { text: desc }),
  ]),
  el('span.atalho__seta', { text: '→' }),
]);
