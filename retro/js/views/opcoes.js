/* views/opcoes.js — o menu de pausa: mundo (paleta), som, categorias
   (com editor completo, inclusive as réguas escritas), sincronia,
   senha e backup. Os mesmos dados do clássico. */

import { el } from '../../../js/utils.js';
import * as store from '../../../js/store.js';
import { TYPES } from '../../../js/store.js';
import * as vault from '../../../js/vault.js';
import * as sync from '../../../js/sync.js';
import * as sfx from '../../../temas/pixel/sfx.js';
import { caixa, confirma, aviso } from '../ui.js';

export const MUNDOS = [
  { id: 'dia', nome: 'MUNDO 1-1', ceu: '#5c94fc', chao: '#c84c0c' },
  { id: 'subterraneo', nome: 'SUBTERRÂNEO', ceu: '#000000', chao: '#0058f8' },
  { id: 'castelo', nome: 'CASTELO', ceu: '#1a0000', chao: '#6b6b6b' },
  { id: 'noite', nome: 'NOTURNO', ceu: '#0d0d3b', chao: '#3c2c6c' },
  { id: 'agua', nome: 'AQUÁTICO', ceu: '#0058f8', chao: '#00887c' },
];

export function render(ctx) {
  const tela = el('div.tela');
  const s = store.state.settings;
  const meta = vault.readMeta();

  tela.append(el('div.titulo', {}, [el('h2.t16.sombra', { text: 'OPÇÕES' })]));

  /* mundo */
  tela.append(el('p.t10', { style: { marginBottom: '8px' }, text: 'MUNDO' }));
  tela.append(el('div.mundos', { style: { marginBottom: '16px' } }, MUNDOS.map(m =>
    el('button.mundoBtn' + (s.mundo === m.id ? '.on' : ''), {
      type: 'button',
      onclick: () => { store.setSetting('mundo', m.id); ctx.aplicarMundo(); sfx.powerup(); ctx.rerender(); },
    }, [
      el('i', { style: { background: `linear-gradient(180deg,${m.ceu} 60%,${m.chao} 60%)` } }),
      el('span', { text: m.nome }),
    ]))));

  /* preferências */
  tela.append(el('p.t10', { style: { marginBottom: '8px' }, text: 'PREFERÊNCIAS' }));
  const prefs = el('div.opcs', { style: { marginBottom: '16px' } }, [
    chave('SOM', 'Bipes de moeda, pulo e fim de fase.', s.som !== false, v => {
      store.setSetting('som', v); sfx.mudo(!v); if (v) sfx.moeda();
    }),
    chave('MOVIMENTO', 'Animações em steps().', s.motion !== false, v => {
      store.setSetting('motion', v);
      document.documentElement.dataset.motion = v ? 'on' : 'off';
    }),
    escolha('SEMANA COMEÇA', [['1', 'SEGUNDA'], ['0', 'DOMINGO']], String(s.weekStart ?? 1),
      v => { store.setSetting('weekStart', Number(v)); ctx.rerender(); }),
    escolha('TRANCAR SOZINHO', [['0', 'NUNCA'], ['5', '5 MIN'], ['15', '15 MIN'], ['60', '1 HORA']],
      String(s.autolock ?? 15), v => { store.setSetting('autolock', Number(v)); aviso('SALVO'); }),
  ]);
  tela.append(prefs);

  /* categorias */
  tela.append(el('p.t10', { style: { marginBottom: '8px' }, text: 'CATEGORIAS' }));
  const cats = el('div.opcs', { style: { marginBottom: '8px' } });
  store.listCategories().forEach((c, i) => {
    cats.append(el('div.opc', {}, [
      el('div', { style: { minWidth: '0' } }, [
        el('p.opc__t', { text: `${c.emoji || '•'} ${c.label}${c.archived ? ' (fora)' : ''}` }),
        el('p.opc__d', { text: TYPES[c.type]?.label || c.type }),
      ]),
      el('div.linha', {}, [
        el('button.btn.btn--peq', { type: 'button', text: '▲', onclick: () => { store.moveCategory(c.id, i - 1); ctx.rerender(); } }),
        el('button.btn.btn--peq', { type: 'button', text: '▼', onclick: () => { store.moveCategory(c.id, i + 1); ctx.rerender(); } }),
        el('button.btn.btn--peq', { type: 'button', text: 'EDITAR', onclick: () => editor(c, ctx) }),
      ]),
    ]));
  });
  tela.append(cats);
  tela.append(el('div.linha', { style: { marginBottom: '16px' } }, [
    el('button.btn.btn--v.btn--peq', { type: 'button', text: '+ NOVA', onclick: () => editor(null, ctx) }),
  ]));

  /* sincronia */
  tela.append(el('p.t10', { style: { marginBottom: '8px' }, text: 'SINCRONIA' }));
  const c = sync.cfg();
  const st = sync.getStatus();
  tela.append(el('div.opcs', { style: { marginBottom: '16px' } }, [
    el('div.opc', {}, [
      el('div', { style: { minWidth: '0' } }, [
        el('p.opc__t', { text: sync.configured() ? `${c.owner}/${c.repo}` : 'DESLIGADA' }),
        el('p.opc__d', {
          text: sync.configured()
            ? (c.lastSync ? `última: ${new Date(c.lastSync).toLocaleString('pt-BR')}` : `estado: ${st.msg}`)
            : 'Os dados só existem neste navegador.',
        }),
      ]),
      sync.configured()
        ? el('button.btn.btn--peq', {
            type: 'button', text: 'SINCRONIZAR',
            onclick: async e => {
              e.currentTarget.disabled = true;
              try { await sync.syncNow(); sfx.powerup(); aviso('SINCRONIZADO'); }
              catch (err) { sfx.erro(); aviso(err.message.slice(0, 40).toUpperCase(), { ms: 5000 }); }
              finally { ctx.rerender(); }
            },
          })
        : el('a.btn.btn--peq', { href: '../#ajustes', text: 'CONFIGURAR' }),
    ]),
  ]));

  /* senha e dados */
  tela.append(el('p.t10', { style: { marginBottom: '8px' }, text: 'COFRE' }));
  tela.append(el('div.opcs', {}, [
    el('div.opc', {}, [
      el('div', {}, [
        el('p.opc__t', { text: 'TRANCAR AGORA' }),
        el('p.opc__d', { text: meta.savedAt ? `gravado ${new Date(meta.savedAt).toLocaleString('pt-BR')}` : '' }),
      ]),
      el('button.btn.btn--peq', { type: 'button', text: 'TRANCAR', onclick: () => ctx.lock() }),
    ]),
    el('div.opc', {}, [
      el('div', {}, [
        el('p.opc__t', { text: 'BACKUP CIFRADO' }),
        el('p.opc__d', { text: 'Arquivo .caderno — abre com esta senha.' }),
      ]),
      el('button.btn.btn--peq', {
        type: 'button', text: 'BAIXAR',
        onclick: () => {
          const url = URL.createObjectURL(new Blob([vault.exportEncrypted()], { type: 'application/json' }));
          const a = el('a', { href: url, download: `caderno-${new Date().toISOString().slice(0, 10)}.caderno` });
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          sfx.moeda(); aviso('BAIXADO');
        },
      }),
    ]),
    el('div.opc', {}, [
      el('div', {}, [
        el('p.opc__t', { text: 'VERSÃO CLÁSSICA' }),
        el('p.opc__d', { text: 'Mesmos dados, outra pele. Editor completo de senha e backup mora lá.' }),
      ]),
      el('a.btn.btn--peq', { href: '../', text: 'IR' }),
    ]),
  ]));

  return tela;
}

/* ── Editor de categoria ───────────────────────────────────── */
function editor(cat, ctx) {
  const novo = !cat;
  const base = cat
    ? { ...cat, goal: cat.goal ? { ...cat.goal } : null, levels: { ...(cat.levels || {}) } }
    : { emoji: '✳️', label: '', type: 'toggle', unit: '', goal: null, levels: {} };

  caixa(novo ? 'NOVA CATEGORIA' : 'EDITAR CATEGORIA', close => {
    const campo = (rot, input) => el('label.campo', {}, [el('span.t8', { text: rot }), input]);
    const emoji = el('input', { type: 'text', value: base.emoji, maxlength: 4 });
    const nome = el('input', { type: 'text', value: base.label, placeholder: 'Corrida' });
    const tipo = el('select', {
      style: { padding: '10px', background: '#000', color: 'var(--tinta)', width: '100%',
        fontFamily: 'Silkscreen, monospace', fontSize: '14px', boxShadow: '0 0 0 2px var(--tinta) inset' },
    }, Object.entries(TYPES).map(([k, v]) =>
      el('option', { value: k, text: v.label, selected: base.type === k ? true : null })));
    const unidade = el('input', { type: 'text', value: base.unit || '', placeholder: 'vezes, h…' });
    const minI = el('input', { type: 'number', min: '0', max: '9', value: String(base.min ?? 1) });
    const maxI = el('input', { type: 'number', min: '1', max: '20', value: String(base.max ?? 5) });
    const faixa = el('div.linha', {}, [
      el('span.t8', { text: 'DE' }), el('div', { style: { width: '72px' } }, [minI]),
      el('span.t8', { text: 'ATÉ' }), el('div', { style: { width: '72px' } }, [maxI]),
    ]);
    const refs = el('div', { style: { display: 'grid', gap: '2px', maxHeight: '240px', overflowY: 'auto' } });
    const refsBox = el('div', {}, [el('p.t8', { style: { marginBottom: '6px' }, text: 'RÉGUA ESCRITA (OPCIONAL)' }), refs]);

    const niveis = () => {
      if (tipo.value === 'scale') {
        const a = Math.max(0, Number(minI.value) || 0);
        const b = Math.min(20, Math.max(a + 1, Number(maxI.value) || 5));
        return Array.from({ length: b - a + 1 }, (_, i) => a + i);
      }
      return tipo.value === 'count' ? [0, 1, 2, 3, 4, 5] : [];
    };
    const colhe = () => {
      const o = {};
      refs.querySelectorAll('input[data-n]').forEach(i => { if (i.value.trim()) o[i.dataset.n] = i.value.trim(); });
      return o;
    };
    const monta = () => {
      const atuais = { ...base.levels, ...colhe() };
      refs.replaceChildren();
      niveis().forEach(n => {
        refs.append(el('label', { style: { display: 'flex', gap: '8px', alignItems: 'center',
          background: '#000', padding: '4px 8px' } }, [
          el('span.t8', { style: { color: 'var(--ouro)', minWidth: '2ch' }, text: String(n) }),
          el('input', { type: 'text', 'data-n': n, value: atuais[n] || '', placeholder: '—',
            style: { flex: '1', minWidth: '0', padding: '6px 0', color: 'var(--tinta)',
              fontFamily: 'Silkscreen, monospace', fontSize: '14px' } }),
        ]));
      });
    };
    const pintaTipo = () => {
      faixa.hidden = tipo.value !== 'scale';
      refsBox.hidden = !['scale', 'count'].includes(tipo.value);
      unidade.parentElement.hidden = !['count', 'hours'].includes(tipo.value);
      monta();
    };
    tipo.addEventListener('change', pintaTipo);
    [minI, maxI].forEach(i => i.addEventListener('change', monta));

    const metaLiga = el('input', { type: 'checkbox' });
    metaLiga.checked = !!base.goal;
    const metaModo = el('select', { style: { padding: '8px', background: '#000', color: 'var(--tinta)' } }, [
      el('option', { value: 'min', text: 'no mínimo', selected: base.goal?.mode === 'min' ? true : null }),
      el('option', { value: 'max', text: 'no máximo', selected: base.goal?.mode === 'max' ? true : null }),
    ]);
    const metaVal = el('input', { type: 'number', min: '0', step: '0.5', value: String(base.goal?.value ?? 3),
      style: { width: '64px' } });
    const metaPer = el('select', { style: { padding: '8px', background: '#000', color: 'var(--tinta)' } }, [
      el('option', { value: 'week', text: 'por semana', selected: base.goal?.period === 'week' ? true : null }),
      el('option', { value: 'day', text: 'por dia', selected: base.goal?.period === 'day' ? true : null }),
    ]);

    setTimeout(pintaTipo, 0);

    return [
      el('div.linha', {}, [
        el('div', { style: { width: '84px' } }, [campo('ÍCONE', emoji)]),
        el('div', { style: { flex: '1', minWidth: '140px' } }, [campo('NOME', nome)]),
      ]),
      campo('TIPO', tipo),
      faixa,
      campo('UNIDADE', unidade),
      refsBox,
      el('label.opc', {}, [
        el('div', {}, [el('p.opc__t', { text: 'META' }), el('p.opc__d', { text: 'Aparece na fase e no placar.' })]),
        metaLiga,
      ]),
      el('div.linha', {}, [metaModo, metaVal, metaPer]),
      el('div.modal__acoes', {}, [
        !novo ? el('button.btn', {
          type: 'button', text: cat.archived ? 'REATIVAR' : 'ARQUIVAR',
          onclick: () => { store.updateCategory(cat.id, { archived: !cat.archived }); close(); ctx.rerender(); },
        }) : null,
        !novo ? el('button.btn.btn--a', {
          type: 'button', text: 'APAGAR',
          onclick: () => {
            close();
            confirma({
              titulo: `APAGAR ${cat.label.toUpperCase()}?`,
              texto: 'Some das telas e dos outros aparelhos. Para só tirar da fase, use ARQUIVAR.',
              ok: 'APAGAR',
              onOk: () => {
                const snap = store.removeCategory(cat.id);
                ctx.rerender();
                aviso('APAGADA', { acao: 'DESFAZER', aoClicar: () => { store.restoreCategory(snap); ctx.rerender(); } });
              },
            });
          },
        }) : null,
        el('button.btn.btn--v', {
          type: 'button', text: novo ? 'CRIAR' : 'SALVAR',
          onclick: () => {
            const lv = colhe();
            const patch = {
              emoji: emoji.value.trim() || '•',
              label: nome.value.trim() || 'Sem nome',
              type: tipo.value,
              unit: unidade.value.trim(),
              min: tipo.value === 'scale' ? Math.max(0, Number(minI.value) || 0) : undefined,
              max: tipo.value === 'scale' ? Math.max(1, Number(maxI.value) || 5) : (cat?.max ?? undefined),
              levels: Object.keys(lv).length ? lv : undefined,
              goal: metaLiga.checked
                ? { mode: metaModo.value, value: Number(metaVal.value) || 0, period: metaPer.value }
                : null,
            };
            if (novo) store.addCategory(patch); else store.updateCategory(cat.id, patch);
            sfx.powerup();
            close(); ctx.rerender(); aviso(novo ? 'CRIADA' : 'SALVA');
          },
        }),
      ].filter(Boolean)),
    ];
  });
}

/* ── Peças ─────────────────────────────────────────────────── */
function chave(titulo, desc, valor, aoMudar) {
  const bt = el('button.btn.btn--peq' + (valor ? '.btn--v' : ''), {
    type: 'button', role: 'switch', 'aria-checked': String(!!valor), text: valor ? 'LIGADO' : 'DESLIGADO',
  });
  bt.addEventListener('click', () => {
    const novo = bt.getAttribute('aria-checked') !== 'true';
    bt.setAttribute('aria-checked', String(novo));
    bt.textContent = novo ? 'LIGADO' : 'DESLIGADO';
    bt.classList.toggle('btn--v', novo);
    aoMudar(novo);
  });
  return el('div.opc', {}, [
    el('div', {}, [el('p.opc__t', { text: titulo }), el('p.opc__d', { text: desc })]),
    bt,
  ]);
}

function escolha(titulo, opcoes, valor, aoMudar) {
  const sel = el('select', {
    style: { padding: '8px', background: '#000', color: 'var(--tinta)',
      fontFamily: "'Press Start 2P', monospace", fontSize: '8px', boxShadow: '0 0 0 2px var(--tinta) inset' },
  }, opcoes.map(([v, r]) => el('option', { value: v, text: r, selected: v === valor ? true : null })));
  sel.addEventListener('change', () => aoMudar(sel.value));
  return el('div.opc', {}, [el('div', {}, [el('p.opc__t', { text: titulo })]), sel]);
}
