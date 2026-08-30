/* views/settings.js — sincronia com o repositório, paleta, categorias
   editáveis, preferências, senha e backup. Tudo o que muda a forma do
   caderno mora aqui. */

import { el } from '../utils.js';
import * as store from '../store.js';
import { TYPES, CADENCIAS } from '../store.js';
import * as vault from '../vault.js';
import * as sync from '../sync.js';
import { PALETTES, applyPalette } from '../palettes.js';
import { toast, openSheet, confirmSheet, stagger } from '../ui.js';

export function render(ctx) {
  const view = el('div.view');
  const s = store.state.settings;

  view.append(el('div.vhead', {}, [
    el('div.vhead__l', {}, [
      el('p.micro', { text: '06 — AJUSTES' }),
      el('h2.display.h-lg', { text: 'AJUSTES' }),
    ]),
    el('div.vhead__r', {}, [
      el('button.btn.btn--sm', { type: 'button', onclick: () => ctx.voltar(), text: '← voltar' }),
    ]),
  ]));

  view.append(section('SINCRONIA · BANCO DE DADOS', syncBox(ctx)));

  view.append(section('VERSÃO 2.0', el('div', {}, [
    row('Caderno 2.0 — pixel', 'A mesma rotina em forma de fase: blocos, moedas, mundos e troféus. Mesmos dados, mesma senha.',
      el('a.btn.btn--sm.btn--solid', { href: './retro/' }, [el('span', { text: 'jogar' })])),
  ])));

  /* ── Paleta ── */
  view.append(section('PALETA', el('div.palettes', {}, PALETTES.map(p =>
    el('button.pal' + (s.palette === p.id ? '.is-on' : ''), {
      type: 'button', 'data-id': p.id,
      onclick: () => {
        store.setSetting('palette', p.id);
        applyPalette(p.id);
        vault.writeMeta({ palette: p.id });
        view.querySelectorAll('.pal').forEach(b => b.classList.toggle('is-on', b.dataset.id === p.id));
        toast(`paleta ${p.name.toLowerCase()}`);
      },
    }, [
      el('div.pal__sw', {}, [
        el('i', { style: { background: p.vars.bg } }),
        el('i', { style: { background: p.vars.fg } }),
        el('i', { style: { background: p.vars.accent } }),
      ]),
      el('span.pal__n', { text: p.name }),
    ])))));

  /* ── Categorias ── */
  const cats = el('div.cats');
  store.listCategories().forEach((c, i) => cats.append(catRow(c, i, ctx)));
  view.append(section('METAS E COBRANÇA', el('div', {}, [
    row('Painel de metas', 'Cadência e meta de todas as categorias numa tela só, com o progresso da semana ao lado.',
      el('button.btn.btn--sm.btn--solid', { type: 'button', onclick: () => ctx.go('metas') }, [el('span', { text: 'abrir' })])),
  ])));

  view.append(section('CATEGORIAS', el('div', {}, [
    cats,
    el('div.wrap', { style: { marginTop: '.8rem' } }, [
      el('button.btn.btn--sm.btn--solid', { type: 'button', onclick: () => editCategory(null, ctx) },
        [el('span', { text: '+ nova categoria' })]),
      el('button.btn.btn--sm', {
        type: 'button',
        onclick: () => confirmSheet({
          title: 'Restaurar categorias padrão?',
          text: 'As categorias atuais saem de cena (os dias já registrados continuam salvos) e as nove originais voltam.',
          ok: 'Restaurar', danger: true,
          onOk: () => { store.resetCategories(); ctx.rerender(); toast('categorias padrão'); },
        }),
      }, [el('span', { text: 'restaurar padrão' })]),
    ]),
  ])));

  /* ── Preferências ── */
  view.append(section('PREFERÊNCIAS', el('div', {}, [
    selectRow('A semana começa', 'Vale pro calendário e pras metas semanais.', [
      ['1', 'segunda'], ['0', 'domingo'],
    ], String(s.weekStart ?? 1), v => { store.setSetting('weekStart', Number(v)); ctx.rerender(); }),
    switchRow('Movimento', 'Animações de entrada, transições e contadores.', s.motion, v => {
      store.setSetting('motion', v);
      document.documentElement.dataset.motion = v ? 'on' : 'off';
    }),
    switchRow('Mostrar sequências', 'O contador de dias seguidos em cada categoria.', s.showStreaks, v => {
      store.setSetting('showStreaks', v); ctx.rerender();
    }),
    selectRow('Trancar sozinho', 'Depois de um tempo sem uso, o caderno pede a senha de novo.', [
      ['0', 'nunca'], ['5', '5 min'], ['15', '15 min'], ['60', '1 hora'],
    ], String(s.autolock ?? 15), v => { store.setSetting('autolock', Number(v)); toast('trava automática atualizada'); }),
  ])));

  /* ── Senha ── */
  const meta = vault.readMeta();
  view.append(section('SENHA E PRIVACIDADE', el('div', {}, [
    row('Trocar a senha', 'Os dados são recifrados na hora. Sem recuperação: se esquecer, acabou.',
      el('button.btn.btn--sm', { type: 'button', onclick: () => changePass(ctx) }, [el('span', { text: 'trocar' })])),
    row('Dica da senha', meta.hint ? `Atual: "${meta.hint}"` : 'Aparece na tela de entrada. Não escreva a senha aqui.',
      el('button.btn.btn--sm', { type: 'button', onclick: () => editHint(ctx) }, [el('span', { text: 'editar' })])),
    row('Trancar agora', 'Fecha a sessão e volta para a tela de senha.',
      el('button.btn.btn--sm', { type: 'button', onclick: () => ctx.lock() }, [el('span', { text: 'trancar' })])),
  ])));

  /* ── Dados ── */
  view.append(section('BACKUP E DADOS', el('div', {}, [
    row('Backup cifrado', 'Arquivo .caderno — só abre com esta senha. É o backup recomendado.',
      el('button.btn.btn--sm.btn--solid', { type: 'button', onclick: exportVault }, [el('span', { text: 'baixar' })])),
    row('Exportar JSON', 'Legível, sem senha. Bom pra levar os dados pra outro lugar — guarde com cuidado.',
      el('button.btn.btn--sm', { type: 'button', onclick: exportJSON }, [el('span', { text: 'baixar' })])),
    row('Importar', 'Aceita .json e .caderno. Substitui o que está aqui.',
      el('button.btn.btn--sm', { type: 'button', onclick: () => importFile(ctx) }, [el('span', { text: 'escolher arquivo' })])),
    row('Apagar tudo', 'Remove o cofre deste aparelho. Não dá pra desfazer.',
      el('button.btn.btn--sm.btn--danger', {
        type: 'button',
        onclick: () => confirmSheet({
          title: 'Apagar o caderno inteiro?',
          text: 'Todos os dias, categorias e afazeres deste aparelho serão perdidos. Se a sincronia estiver ligada, o arquivo do repositório continua lá.',
          ok: 'Apagar tudo', danger: true,
          onOk: () => { vault.destroy(); location.reload(); },
        }),
      }, [el('span', { text: 'apagar' })])),
  ])));

  view.append(el('p.micro', {
    style: { marginTop: '2rem', lineHeight: '1.9' },
    html: 'CADERNO · cifrado com AES-GCM neste navegador<br>' +
          `última gravação local: ${meta.savedAt ? new Date(meta.savedAt).toLocaleString('pt-BR') : '—'}<br>` +
          `dias registrados: ${Object.keys(store.state.days).filter(k => store.hasEntry(k)).length} · revisão ${store.state.rev || 0}`,
  }));

  stagger(view, '.section');
  return view;
}

/* ── Sincronia ─────────────────────────────────────────────── */
function syncBox(ctx) {
  const c = sync.cfg();
  const box = el('div');

  if (!sync.configured()) {
    box.append(el('div.alert.alert--warn', {}, [
      el('span.micro', { text: 'SÓ NESTE NAVEGADOR' }),
      el('span', { html: 'Hoje os dados existem <b>só aqui</b>. Limpar os dados do site apaga tudo. Ligue a gravação no repositório — o arquivo vai cifrado, então pode ser um repo público.' }),
    ]));
  } else {
    const st = sync.getStatus();
    box.append(el('div.syncstat', {}, [
      el('span.syncstat__dot', { 'data-state': st.state }),
      el('div', {}, [
        el('p.row__t', { text: `${c.owner}/${c.repo} · ${c.path}` }),
        el('p.row__d', {
          text: c.lastSync
            ? `última sincronia: ${new Date(c.lastSync).toLocaleString('pt-BR')}`
            : 'ainda não sincronizado',
        }),
        c.lastError ? el('p.row__d', { style: { color: 'var(--accent)' }, text: c.lastError }) : null,
      ]),
    ]));
  }

  box.append(el('div.wrap', { style: { marginTop: '.9rem' } }, [
    el('button.btn.btn--sm.btn--solid', { type: 'button', onclick: () => syncSheet(ctx) },
      [el('span', { text: sync.configured() ? 'configurar' : 'ligar sincronia' })]),
    sync.configured() ? el('button.btn.btn--sm', {
      type: 'button',
      onclick: async e => {
        const b = e.currentTarget; b.disabled = true;
        try { await sync.syncNow(); toast('sincronizado'); ctx.rerender(); }
        catch (err) { toast(err.message, { ms: 5000 }); ctx.rerender(); }
        finally { b.disabled = false; }
      },
    }, [el('span', { text: 'sincronizar agora' })]) : null,
    sync.configured() ? el('button.btn.btn--sm', {
      type: 'button',
      onclick: async () => {
        try {
          const r = await sync.pullAndMerge();
          toast(r.merged ? 'dados do repositório trazidos' : 'nada novo lá');
          ctx.rerender();
        } catch (err) { toast(err.message, { ms: 5000 }); }
      },
    }, [el('span', { text: 'puxar do repositório' })]) : null,
    sync.configured() ? el('button.btn.btn--sm.btn--ghost', {
      type: 'button',
      onclick: () => confirmSheet({
        title: 'Desligar a sincronia?',
        text: 'O arquivo no repositório continua onde está; este aparelho só para de gravar nele.',
        ok: 'Desligar', danger: true,
        onOk: () => { store.setSync({ enabled: false }); ctx.rerender(); toast('sincronia desligada'); },
      }),
    }, [el('span', { text: 'desligar' })]) : null,
  ]));

  return box;
}

function syncSheet(ctx) {
  const c = sync.cfg();
  openSheet('Gravar no repositório', close => {
    const owner = field('USUÁRIO OU ORGANIZAÇÃO', el('input', { type: 'text', value: c.owner || '', placeholder: 'seu-usuario', spellcheck: 'false' }));
    const repo = field('REPOSITÓRIO', el('input', { type: 'text', value: c.repo || 'caderno', placeholder: 'caderno', spellcheck: 'false' }));
    const branch = field('BRANCH', el('input', { type: 'text', value: c.branch || 'main', placeholder: 'main', spellcheck: 'false' }));
    const path = field('CAMINHO DO ARQUIVO', el('input', { type: 'text', value: c.path || 'dados/caderno.enc.json', spellcheck: 'false' }));
    const token = field('TOKEN (FINE-GRAINED, CONTENTS: READ AND WRITE)',
      el('input', { type: 'password', value: c.token || '', placeholder: 'github_pat_…', spellcheck: 'false', autocomplete: 'off' }));
    const msg = el('p.micro', { style: { minHeight: '16px', lineHeight: '1.7' } });
    const val = f => f.querySelector('input').value.trim();

    const testar = async () => {
      msg.textContent = 'TESTANDO…';
      const r = await sync.check({ owner: val(owner), repo: val(repo), token: val(token) });
      msg.style.color = r.ok ? '' : 'var(--accent)';
      msg.textContent = r.msg.toUpperCase();
      return r.ok;
    };

    return [
      el('p.muted', {
        style: { fontSize: '.88rem', lineHeight: '1.6' },
        html: 'O caderno grava um arquivo cifrado no seu repositório a cada mudança e o lê de volta ao destrancar — é o banco de dados dele, e serve pra usar o app em mais de um aparelho.<br><br>' +
              'Crie um token em <b>github.com/settings/personal-access-tokens</b> → <i>Fine-grained</i> → só este repositório → <b>Contents: Read and write</b>. ' +
              'O token fica cifrado junto com os seus dados; se perder o aparelho, revogue ele no GitHub.',
      }),
      owner, repo, branch, path, token, msg,
      el('div.sheet__actions', {}, [
        el('button.btn', { type: 'button', onclick: testar }, [el('span', { text: 'testar' })]),
        el('button.btn.btn--solid', {
          type: 'button',
          onclick: async () => {
            if (!(await testar())) return;
            store.setSync({
              enabled: true, owner: val(owner), repo: val(repo),
              branch: val(branch) || 'main', path: val(path) || 'dados/caderno.enc.json',
              token: val(token), lastError: '',
            });
            close();
            ctx.rerender();
            try {
              const r = await sync.pullAndMerge();
              if (r.merged) toast('caderno do repositório trazido');
              await sync.syncNow();
              toast('sincronia ligada');
            } catch (err) { toast(err.message, { ms: 5000 }); }
            ctx.rerender();
          },
        }, [el('span', { text: 'salvar e sincronizar' })]),
      ]),
    ];
  });
}

/* ── Linha de categoria ────────────────────────────────────── */
function catRow(c, i, ctx) {
  const move = to => { store.moveCategory(c.id, to); ctx.rerender(); };
  return el('div.cat', { style: c.archived ? { opacity: '.5' } : {} }, [
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
  const draft = cat
    ? { ...cat, goal: cat.goal ? { ...cat.goal } : null, levels: { ...(cat.levels || {}) } }
    : { emoji: '✳️', label: '', type: 'toggle', unit: '', goal: null, levels: {} };

  openSheet(isNew ? 'Nova categoria' : 'Editar categoria', close => {
    const emoji = field('ÍCONE (EMOJI)', el('input', { type: 'text', value: draft.emoji, maxlength: 4 }));
    const label = field('NOME', el('input', { type: 'text', value: draft.label, placeholder: 'Ex.: Corrida' }));
    const type = el('select', {}, Object.entries(TYPES).map(([k, v]) =>
      el('option', { value: k, text: v.label, selected: draft.type === k ? true : null })));
    const typeHint = el('p.micro', { text: TYPES[draft.type].hint });
    const unit = field('UNIDADE (OPCIONAL)', el('input', { type: 'text', value: draft.unit || '', placeholder: 'doses, km, h…' }));
    const cadSel = el('select', {}, Object.entries(CADENCIAS).map(([k, v]) =>
      el('option', { value: k, text: v.label, selected: store.cadencia(draft) === k ? true : null })));
    const cadHint = el('p.micro', { text: CADENCIAS[store.cadencia(draft)].hint });
    cadSel.addEventListener('change', () => { cadHint.textContent = CADENCIAS[cadSel.value].hint; });
    const cadence = field('O DIA COBRA?', el('div', {}, [cadSel, cadHint]));

    /* ── faixa e referências escritas de cada nível ── */
    const minIn = el('input', { type: 'number', min: '0', max: '9', value: String(draft.min ?? 1), style: { width: '64px' } });
    const maxIn = el('input', { type: 'number', min: '1', max: '20', value: String(draft.max ?? 5), style: { width: '64px' } });
    const faixa = el('div.wrap', { style: { alignItems: 'center' } }, [
      el('span.micro', { text: 'DE' }), minIn, el('span.micro', { text: 'ATÉ' }), maxIn,
    ]);
    const refs = el('div.lvledit');
    const refsBox = el('div', {}, [
      el('p.micro', { text: 'REFERÊNCIAS DE CADA NÍVEL (OPCIONAL)' }),
      el('p.row__d', { style: { marginBottom: '.5rem' }, text: 'O texto aparece embaixo do controle na hora do check-in — é o que faz um "5" querer dizer alguma coisa.' }),
      refs,
    ]);

    const lerNiveis = () => {
      const t = type.value;
      if (t === 'scale') {
        const a = Math.max(0, Number(minIn.value) || 0);
        const b = Math.min(20, Math.max(a + 1, Number(maxIn.value) || 5));
        return Array.from({ length: b - a + 1 }, (_, i) => a + i);
      }
      if (t === 'count') return [0, 1, 2, 3, 4, 5];
      return [];
    };
    const montaRefs = () => {
      const atuais = colheRefs();
      refs.replaceChildren();
      for (const n of lerNiveis()) {
        const inp = el('input', { type: 'text', value: atuais[n] ?? (draft.levels?.[n] || ''), placeholder: '—', 'data-n': n });
        refs.append(el('label.lvledit__r', {}, [el('span.lvledit__n.num', { text: String(n) }), inp]));
      }
    };
    const colheRefs = () => {
      const out = {};
      refs.querySelectorAll('input[data-n]').forEach(i => { if (i.value.trim()) out[i.dataset.n] = i.value.trim(); });
      return out;
    };

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
    const pintaTipo = () => {
      typeHint.textContent = TYPES[type.value].hint;
      faixa.hidden = type.value !== 'scale';
      refsBox.hidden = !['scale', 'count'].includes(type.value);
      unit.hidden = !['count', 'hours'].includes(type.value);
      montaRefs();
    };
    type.addEventListener('change', pintaTipo);
    [minIn, maxIn].forEach(i => i.addEventListener('change', montaRefs));

    setTimeout(pintaTipo, 0);

    return [
      el('div.wrap', { style: { gap: '1rem' } }, [
        el('div', { style: { width: '90px' } }, [emoji]),
        el('div', { style: { flex: '1', minWidth: '160px' } }, [label]),
      ]),
      field('TIPO DE RESPOSTA', el('div', {}, [type, typeHint])),
      cadence,
      faixa,
      unit,
      refsBox,
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
              text: 'Ela some das telas e dos outros aparelhos. Se quiser só tirar do check-in sem perder o histórico, use "arquivar".',
              ok: 'Apagar', danger: true,
              onOk: () => {
                const snap = store.removeCategory(cat.id);
                ctx.rerender();
                toast('categoria apagada', {
                  action: 'desfazer',
                  onAction: () => { store.restoreCategory(snap); ctx.rerender(); },
                });
              },
            });
          },
        }, [el('span', { text: 'apagar' })]),
        !isNew && el('button.btn', {
          type: 'button',
          onclick: () => {
            store.updateCategory(cat.id, { archived: !cat.archived });
            close(); ctx.rerender();
            toast(cat.archived ? 'reativada' : 'arquivada');
          },
        }, [el('span', { text: cat.archived ? 'reativar' : 'arquivar' })]),
        el('button.btn.btn--solid', {
          type: 'button',
          onclick: () => {
            const niveis = colheRefs();
            const patch = {
              emoji: emoji.querySelector('input').value.trim() || '•',
              label: label.querySelector('input').value.trim() || 'Sem nome',
              type: type.value,
              cadence: cadSel.value,
              unit: unit.querySelector('input').value.trim(),
              min: type.value === 'scale' ? Math.max(0, Number(minIn.value) || 0) : undefined,
              max: type.value === 'scale' ? Math.max(1, Number(maxIn.value) || 5) : (cat?.max ?? undefined),
              levels: Object.keys(niveis).length ? niveis : undefined,
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
  });
}

/* ── Senha ─────────────────────────────────────────────────── */
function changePass(ctx) {
  openSheet('Trocar a senha', close => {
    const atual = field('SENHA ATUAL', el('input', { type: 'password', autocomplete: 'current-password' }));
    const nova = field('NOVA SENHA', el('input', { type: 'password', autocomplete: 'new-password', minlength: 4 }));
    const conf = field('CONFIRME', el('input', { type: 'password', autocomplete: 'new-password' }));
    const err = el('p.lock__error.micro');
    return [
      el('p.muted', { style: { fontSize: '.88rem' }, text: 'Se a sincronia estiver ligada, mande sincronizar depois: o arquivo do repositório passa a usar a senha nova.' }),
      atual, nova, conf, err,
      el('div.sheet__actions', {}, [
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
            if (sync.configured()) sync.syncNow().catch(() => {});
          },
        }, [el('span', { text: 'trocar' })]),
      ]),
    ];
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

function exportVault() { download(`caderno-${stamp()}.caderno`, vault.exportEncrypted()); toast('backup cifrado baixado'); }
function exportJSON() { download(`caderno-${stamp()}.json`, store.exportJSON()); toast('json baixado'); }

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
    } catch { toast('arquivo inválido'); }
  });
  input.click();
}

/* ── Peças ─────────────────────────────────────────────────── */
function field(label, input) {
  return el('label.field', {}, [el('span.micro', { text: label }), input]);
}
function row(title, desc, control) {
  return el('div.row', {}, [
    el('div.row__l', {}, [el('p.row__t', { text: title }), el('p.row__d', { text: desc })]),
    control,
  ]);
}
function switchRow(title, desc, value, onChange) {
  const sw = el('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(!!value), 'aria-label': title });
  sw.addEventListener('click', () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return row(title, desc, sw);
}
function selectRow(title, desc, options, value, onChange) {
  const sel = el('select.minisel', {}, options.map(([v, label]) =>
    el('option', { value: v, text: label, selected: v === value ? true : null })));
  sel.addEventListener('change', () => onChange(sel.value));
  return row(title, desc, sel);
}
const section = (title, body) => el('div.section', {}, [
  el('div.section__h', {}, [el('p.micro', { text: title })]),
  body,
]);
