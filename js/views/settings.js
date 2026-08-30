/* views/settings.js — paleta, categorias editáveis, preferências,
   senha e backup. Tudo o que muda a forma do caderno mora aqui. */

import { el, $ } from '../utils.js';
import * as store from '../store.js';
import { TYPES } from '../store.js';
import * as vault from '../vault.js';
import { PALETTES, applyPalette } from '../palettes.js';
import { toast, openSheet, closeSheet, confirmSheet, stagger } from '../ui.js';

export function render(ctx) {
  const view = el('div.view');
  const s = store.state.settings;

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '05 — AJUSTES' }),
      el('h2.display.h-lg', { text: 'AJUSTES' }),
    ]),
  ]));

  /* ── Paleta ── */
  const pals = el('div.palettes', {}, PALETTES.map(p => {
    const btn = el('button.pal' + (s.palette === p.id ? '.is-on' : ''), {
      type: 'button',
      onclick: () => {
        s.palette = p.id;
        applyPalette(p.id);
        vault.writeMeta({ palette: p.id });
        store.emit('settings');
        view.querySelectorAll('.pal').forEach(b => b.classList.toggle('is-on', b.dataset.id === p.id));
        toast(`paleta ${p.name.toLowerCase()}`);
      },
      'data-id': p.id,
    }, [
      el('div.pal__sw', {}, [
        el('i', { style: { background: p.vars.bg } }),
        el('i', { style: { background: p.vars.fg } }),
        el('i', { style: { background: p.vars.accent } }),
      ]),
      el('span.pal__n', { text: p.name }),
    ]);
    return btn;
  }));
  view.append(section('PALETA', pals));

  /* ── Categorias ── */
  const cats = el('div.cats');
  store.state.categories.forEach((c, i) => cats.append(catRow(c, i, ctx)));
  const catsBox = el('div', {}, [
    cats,
    el('div.wrap', { style: { marginTop: '.8rem' } }, [
      el('button.btn.btn--sm.btn--solid', {
        type: 'button', onclick: () => editCategory(null, ctx),
      }, [el('span', { text: '+ nova categoria' })]),
      el('button.btn.btn--sm', {
        type: 'button', onclick: () => confirmSheet({
          title: 'Restaurar categorias padrão?',
          text: 'As categorias atuais são substituídas. Os dias já registrados continuam salvos, mas ficam órfãos das categorias removidas.',
          ok: 'Restaurar', danger: true,
          onOk: () => { store.state.categories = store.DEFAULT_CATEGORIES(); store.emit('categories'); ctx.rerender(); toast('categorias padrão'); },
        }),
      }, [el('span', { text: 'restaurar padrão' })]),
    ]),
  ]);
  view.append(section('CATEGORIAS', catsBox));

  /* ── Preferências ── */
  const prefs = el('div', {}, [
    switchRow('Movimento', 'Animações de entrada, transições e contadores.', s.motion, v => {
      s.motion = v;
      document.documentElement.dataset.motion = v ? 'on' : 'off';
      store.emit('settings');
    }),
    switchRow('Mostrar sequências', 'O contador de dias seguidos em cada categoria.', s.showStreaks, v => {
      s.showStreaks = v; store.emit('settings'); ctx.rerender();
    }),
    el('div.row', {}, [
      el('div.row__l', {}, [
        el('p.row__t', { text: 'Trancar sozinho' }),
        el('p.row__d', { text: 'Depois de um tempo sem uso, o caderno pede a senha de novo.' }),
      ]),
      (() => {
        const sel = el('select', { style: { width: 'auto', borderBottom: '1px solid var(--line)', padding: '.4rem 0' } }, [
          el('option', { value: '0', text: 'nunca' }),
          el('option', { value: '5', text: '5 min' }),
          el('option', { value: '15', text: '15 min' }),
          el('option', { value: '60', text: '1 hora' }),
        ]);
        sel.value = String(s.autolock ?? 15);
        sel.addEventListener('change', () => { s.autolock = Number(sel.value); store.emit('settings'); toast('trava automática atualizada'); });
        return sel;
      })(),
    ]),
  ]);
  view.append(section('PREFERÊNCIAS', prefs));

  /* ── Senha ── */
  const meta = vault.readMeta();
  const seg = el('div', {}, [
    el('div.row', {}, [
      el('div.row__l', {}, [
        el('p.row__t', { text: 'Trocar a senha' }),
        el('p.row__d', { text: 'Os dados são recifrados na hora. Sem recuperação: se esquecer, acabou.' }),
      ]),
      el('button.btn.btn--sm', { type: 'button', onclick: () => changePass(ctx) }, [el('span', { text: 'trocar' })]),
    ]),
    el('div.row', {}, [
      el('div.row__l', {}, [
        el('p.row__t', { text: 'Dica da senha' }),
        el('p.row__d', { text: meta.hint ? `Atual: "${meta.hint}"` : 'Aparece na tela de entrada. Não escreva a senha aqui.' }),
      ]),
      el('button.btn.btn--sm', { type: 'button', onclick: () => editHint(ctx) }, [el('span', { text: 'editar' })]),
    ]),
    el('div.row', {}, [
      el('div.row__l', {}, [
        el('p.row__t', { text: 'Trancar agora' }),
        el('p.row__d', { text: 'Fecha a sessão e volta para a tela de senha.' }),
      ]),
      el('button.btn.btn--sm', { type: 'button', onclick: () => ctx.lock() }, [el('span', { text: 'trancar' })]),
    ]),
  ]);
  view.append(section('SENHA E PRIVACIDADE', seg));

  /* ── Dados ── */
  const dados = el('div', {}, [
    el('div.row', {}, [
      el('div.row__l', {}, [
        el('p.row__t', { text: 'Backup cifrado' }),
        el('p.row__d', { text: 'Arquivo .caderno — só abre com esta senha. É o backup recomendado.' }),
      ]),
      el('button.btn.btn--sm.btn--solid', { type: 'button', onclick: exportVault }, [el('span', { text: 'baixar' })]),
    ]),
    el('div.row', {}, [
      el('div.row__l', {}, [
        el('p.row__t', { text: 'Exportar JSON' }),
        el('p.row__d', { text: 'Legível, sem senha. Bom pra levar os dados pra outro lugar — guarde com cuidado.' }),
      ]),
      el('button.btn.btn--sm', { type: 'button', onclick: exportJSON }, [el('span', { text: 'baixar' })]),
    ]),
    el('div.row', {}, [
      el('div.row__l', {}, [
        el('p.row__t', { text: 'Importar' }),
        el('p.row__d', { text: 'Aceita .json e .caderno. Substitui o que está aqui.' }),
      ]),
      el('button.btn.btn--sm', { type: 'button', onclick: () => importFile(ctx) }, [el('span', { text: 'escolher arquivo' })]),
    ]),
    el('div.row', {}, [
      el('div.row__l', {}, [
        el('p.row__t', { text: 'Apagar tudo' }),
        el('p.row__d', { text: 'Remove o cofre deste aparelho. Não dá pra desfazer.' }),
      ]),
      el('button.btn.btn--sm.btn--danger', {
        type: 'button',
        onclick: () => confirmSheet({
          title: 'Apagar o caderno inteiro?',
          text: 'Todos os dias, categorias e afazeres deste aparelho serão perdidos. Faça um backup antes.',
          ok: 'Apagar tudo', danger: true,
          onOk: () => { vault.destroy(); location.reload(); },
        }),
      }, [el('span', { text: 'apagar' })]),
    ]),
  ]);
  view.append(section('DADOS', dados));

  view.append(el('p.micro', {
    style: { marginTop: '2rem', lineHeight: '1.9' },
    html: 'CADERNO · dados só neste navegador, cifrados com AES-GCM<br>' +
          `última gravação: ${meta.savedAt ? new Date(meta.savedAt).toLocaleString('pt-BR') : '—'}<br>` +
          `dias registrados: ${Object.keys(store.state.days).length}`,
  }));

  stagger(view, '.section');
  return view;
}

/* ── Linha de categoria ────────────────────────────────────── */
function catRow(c, i, ctx) {
  const total = store.state.categories.length;
  const move = to => { store.moveCategory(c.id, to); ctx.rerender(); };
  return el('div.cat' + (c.archived ? '' : ''), { style: c.archived ? { opacity: '.5' } : {} }, [
    el('span.cat__i', { text: c.emoji || '•' }),
    el('span.cat__n', { text: c.label + (c.archived ? ' (arquivada)' : '') }),
    el('span.cat__t', { text: TYPES[c.type]?.label || c.type }),
    el('button.iconbtn', { type: 'button', 'aria-label': 'Subir', onclick: () => move(i - 1), style: { width: '30px', height: '30px' }, html: '↑' }),
    el('button.iconbtn', { type: 'button', 'aria-label': 'Descer', onclick: () => move(i + 1), style: { width: '30px', height: '30px' }, html: '↓' }),
    el('button.btn.btn--sm', { type: 'button', onclick: () => editCategory(c, ctx) }, [el('span', { text: 'editar' })]),
  ]);
}

/* ── Editor de categoria ───────────────────────────────────── */
function editCategory(cat, ctx) {
  const isNew = !cat;
  const draft = cat ? { ...cat, goal: cat.goal ? { ...cat.goal } : null } : {
    emoji: '✳️', label: '', type: 'toggle', unit: '', goal: null,
  };

  openSheet(isNew ? 'Nova categoria' : 'Editar categoria', close => {
    const emoji = field('ÍCONE (EMOJI)', el('input', { type: 'text', value: draft.emoji, maxlength: 4 }));
    const label = field('NOME', el('input', { type: 'text', value: draft.label, placeholder: 'Ex.: Corrida' }));
    const type = el('select', {}, Object.entries(TYPES).map(([k, v]) =>
      el('option', { value: k, text: v.label, selected: draft.type === k ? true : null })));
    const typeHint = el('p.micro', { text: TYPES[draft.type].hint });
    const unit = field('UNIDADE (OPCIONAL)', el('input', { type: 'text', value: draft.unit || '', placeholder: 'doses, km, h…' }));

    const goalOn = el('input', { type: 'checkbox' });
    goalOn.checked = !!draft.goal;
    const goalMode = el('select', {}, [
      el('option', { value: 'min', text: 'no mínimo', selected: draft.goal?.mode === 'min' ? true : null }),
      el('option', { value: 'max', text: 'no máximo', selected: draft.goal?.mode === 'max' ? true : null }),
    ]);
    const goalVal = el('input', { type: 'number', min: '0', step: '0.5', value: draft.goal?.value ?? 3, style: { width: '70px' } });
    const goalPeriod = el('select', {}, [
      el('option', { value: 'week', text: 'por semana', selected: draft.goal?.period === 'week' ? true : null }),
      el('option', { value: 'day', text: 'por dia', selected: draft.goal?.period === 'day' ? true : null }),
    ]);
    const goalBox = el('div.wrap', { style: { alignItems: 'center' } }, [goalMode, goalVal, goalPeriod]);
    goalBox.style.opacity = goalOn.checked ? '1' : '.4';
    goalOn.addEventListener('change', () => { goalBox.style.opacity = goalOn.checked ? '1' : '.4'; });

    type.addEventListener('change', () => { typeHint.textContent = TYPES[type.value].hint; });

    const nodes = [
      el('div.wrap', { style: { gap: '1rem' } }, [
        el('div', { style: { width: '90px' } }, [emoji]),
        el('div', { style: { flex: '1', minWidth: '160px' } }, [label]),
      ]),
      field('TIPO DE RESPOSTA', el('div', {}, [type, typeHint])),
      unit,
      el('label.row', { style: { cursor: 'pointer' } }, [
        el('div.row__l', {}, [
          el('p.row__t', { text: 'Definir meta' }),
          el('p.row__d', { text: 'Aparece no check-in e nos insights.' }),
        ]),
        goalOn,
      ]),
      goalBox,
      el('div.sheet__actions', {}, [
        !isNew && el('button.btn.btn--danger', {
          type: 'button',
          onclick: () => {
            close();
            confirmSheet({
              title: `Apagar "${cat.label}"?`,
              text: 'A categoria e os valores dela em todos os dias serão removidos. Se quiser só tirar do check-in, use "arquivar".',
              ok: 'Apagar', danger: true,
              onOk: () => { store.removeCategory(cat.id); ctx.rerender(); toast('categoria apagada'); },
            });
          },
        }, [el('span', { text: 'apagar' })]),
        !isNew && el('button.btn', {
          type: 'button',
          onclick: () => { store.updateCategory(cat.id, { archived: !cat.archived }); close(); ctx.rerender(); toast(cat.archived ? 'reativada' : 'arquivada'); },
        }, [el('span', { text: cat.archived ? 'reativar' : 'arquivar' })]),
        el('button.btn.btn--solid', {
          type: 'button',
          onclick: () => {
            const patch = {
              emoji: emoji.querySelector('input').value.trim() || '•',
              label: label.querySelector('input').value.trim() || 'Sem nome',
              type: type.value,
              unit: unit.querySelector('input').value.trim(),
              goal: goalOn.checked
                ? { mode: goalMode.value, value: Number(goalVal.value) || 0, period: goalPeriod.value }
                : null,
            };
            if (isNew) store.addCategory(patch); else store.updateCategory(cat.id, patch);
            close(); ctx.rerender(); toast(isNew ? 'categoria criada' : 'categoria salva');
          },
        }, [el('span', { text: isNew ? 'criar' : 'salvar' })]),
      ].filter(Boolean)),
    ];
    return nodes;
  });
}

/* ── Senha ─────────────────────────────────────────────────── */
function changePass(ctx) {
  openSheet('Trocar a senha', close => {
    const atual = field('SENHA ATUAL', el('input', { type: 'password', autocomplete: 'current-password' }));
    const nova = field('NOVA SENHA', el('input', { type: 'password', autocomplete: 'new-password', minlength: 4 }));
    const conf = field('CONFIRME', el('input', { type: 'password', autocomplete: 'new-password' }));
    const err = el('p.lock__error.micro');
    return [atual, nova, conf, err, el('div.sheet__actions', {}, [
      el('button.btn', { type: 'button', onclick: close }, [el('span', { text: 'cancelar' })]),
      el('button.btn.btn--solid', {
        type: 'button',
        onclick: async () => {
          const a = atual.querySelector('input').value;
          const n = nova.querySelector('input').value;
          const c = conf.querySelector('input').value;
          if (n.length < 4) return void (err.textContent = 'A nova senha precisa de ao menos 4 caracteres.');
          if (n !== c) return void (err.textContent = 'A confirmação não bate.');
          try { await vault.unlock(a); }
          catch { return void (err.textContent = 'Senha atual incorreta.'); }
          await store.setPassword(n, vault.readMeta().hint);
          close(); toast('senha trocada');
        },
      }, [el('span', { text: 'trocar' })]),
    ])];
  });
}

function editHint(ctx) {
  openSheet('Dica da senha', close => {
    const f = field('DICA', el('input', { type: 'text', value: vault.readMeta().hint || '', maxlength: 60, placeholder: 'aquela frase de 2019' }));
    return [
      el('p.muted', { style: { fontSize: '.88rem' }, text: 'A dica fica em texto puro no aparelho — qualquer um que abrir o app a vê. Nunca escreva a senha nela.' }),
      f,
      el('div.sheet__actions', {}, [
        el('button.btn', { type: 'button', onclick: close }, [el('span', { text: 'cancelar' })]),
        el('button.btn.btn--solid', {
          type: 'button',
          onclick: () => { vault.writeMeta({ hint: f.querySelector('input').value.trim() }); close(); ctx.rerender(); toast('dica salva'); },
        }, [el('span', { text: 'salvar' })]),
      ]),
    ];
  });
}

/* ── Backup ────────────────────────────────────────────────── */
function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

function exportVault() {
  download(`caderno-${stamp()}.caderno`, vault.exportEncrypted());
  toast('backup cifrado baixado');
}
function exportJSON() {
  download(`caderno-${stamp()}.json`, store.exportJSON());
  toast('json baixado');
}

function importFile(ctx) {
  const input = el('input', { type: 'file', accept: '.json,.caderno,application/json' });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (data.ct && data.salt) {
        confirmSheet({
          title: 'Restaurar backup cifrado?',
          text: 'O caderno atual será substituído. Depois de restaurar, entre com a senha daquele backup.',
          ok: 'Restaurar', danger: true,
          onOk: () => { vault.importEncrypted(data); location.reload(); },
        });
      } else {
        confirmSheet({
          title: 'Importar JSON?',
          text: 'Os dados atuais serão substituídos pelos do arquivo. A senha continua a mesma.',
          ok: 'Importar', danger: true,
          onOk: () => { store.importJSON(text); ctx.rerender(); toast('dados importados'); },
        });
      }
    } catch {
      toast('arquivo inválido');
    }
  });
  input.click();
}

/* ── Peças ─────────────────────────────────────────────────── */
function field(label, input) {
  return el('label.field', {}, [el('span.micro', { text: label }), input]);
}
function switchRow(title, desc, value, onChange) {
  const sw = el('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(!!value), 'aria-label': title });
  sw.addEventListener('click', () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return el('div.row', {}, [
    el('div.row__l', {}, [el('p.row__t', { text: title }), el('p.row__d', { text: desc })]),
    sw,
  ]);
}
const section = (title, body) => el('div.section', {}, [
  el('div.section__h', {}, [el('p.micro', { text: title })]),
  body,
]);
