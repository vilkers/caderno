/* views/agendaform.js — a caixa que cria e edita um compromisso do mês.

   Mora fora das telas porque é usada em dois lugares: em Ajustes (onde a
   agenda é montada, ao lado das categorias da rotina) e na própria Agenda,
   tocando num item. Uma peça só, um comportamento só. */

import { el, todayKey, monthKey, daysInMonth } from '../utils.js';
import * as store from '../store.js';
import { openSheet, closeSheet, toast, confirmSheet } from '../ui.js';

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Abre o editor. `item` nulo cria um novo.
 * `aoSalvar` é chamada depois de gravar ou apagar, pra tela se repintar.
 */
export function editarCompromisso(item, aoSalvar = () => {}, padroes = {}) {
  const novo = !item;
  const base = item || {
    emoji: '📌', label: '', tipo: 'conta', repete: 'mensal',
    dia: new Date().getDate(), data: todayKey(), valor: null, nota: '',
    ...padroes,
  };
  const rascunho = { ...base };

  openSheet(novo ? 'Novo compromisso' : `${base.emoji || '•'} ${base.label}`, close => {
    const corpo = [];

    /* emoji + nome */
    const emoji = el('input.emojin', { type: 'text', value: rascunho.emoji || '', maxlength: 3, 'aria-label': 'Emoji' });
    const nome = el('input', { type: 'text', value: rascunho.label || '', placeholder: 'Cartão Nubank', 'aria-label': 'Nome' });
    emoji.addEventListener('input', () => { rascunho.emoji = emoji.value; });
    nome.addEventListener('input', () => { rascunho.label = nome.value; });
    corpo.push(el('div.field', {}, [
      el('p.micro', { text: 'O QUE É' }),
      el('div.wrap.wrap--nowrap', {}, [emoji, nome]),
    ]));

    /* tipo */
    const tipo = el('select.minisel', {}, Object.entries(store.AGENDA_TIPOS).map(([id, t]) =>
      el('option', { value: id, text: t.label, selected: id === rascunho.tipo ? true : null })));
    tipo.addEventListener('change', () => {
      rascunho.tipo = tipo.value;
      rascunho.fluxo = store.AGENDA_TIPOS[tipo.value]?.fluxo || 'saida';
    });
    corpo.push(el('div.field', {}, [
      el('p.micro', { text: 'ONDE ELE APARECE' }),
      tipo,
      el('p.micro', { style: { color: 'var(--dim)' }, text: 'ASSINATURA E ENTRADA VÃO PRA ÁREA PESSOAL. O RESTO FICA NA AGENDA DO MÊS.' }),
    ]));

    /* repetição + dia */
    const campoDia = el('div');
    const pintaDia = () => {
      campoDia.replaceChildren();
      if (rascunho.repete === 'unico') {
        const data = el('input', { type: 'date', value: rascunho.data || todayKey(), 'aria-label': 'Data' });
        data.addEventListener('change', () => { rascunho.data = data.value; });
        campoDia.append(el('div.field', {}, [el('p.micro', { text: 'QUANDO' }), data]));
      } else {
        const sel = el('select.minisel', {}, DIAS.map(d =>
          el('option', { value: String(d), text: `dia ${d}`, selected: d === Number(rascunho.dia) ? true : null })));
        sel.addEventListener('change', () => { rascunho.dia = Number(sel.value); });
        campoDia.append(el('div.field', {}, [
          el('p.micro', { text: 'DIA DO MÊS' }),
          sel,
          el('p.micro', { style: { color: 'var(--dim)' }, text: 'EM MÊS CURTO, O 31 CAI NO ÚLTIMO DIA.' }),
        ]));
      }
    };

    const rep = el('div.seg', {}, [
      ['mensal', 'Todo mês'], ['unico', 'Só uma vez'],
    ].map(([id, label]) => el('button.seg__b' + (rascunho.repete === id ? '.is-on' : ''), {
      type: 'button',
      onclick: e => {
        rascunho.repete = id;
        rep.querySelectorAll('.seg__b').forEach(b => b.classList.remove('is-on'));
        e.currentTarget.classList.add('is-on');
        pintaDia();
      },
      text: label,
    })));
    pintaDia();
    corpo.push(el('div.field', {}, [el('p.micro', { text: 'REPETE?' }), rep]), campoDia);

    /* valor */
    const valor = el('input', {
      type: 'number', step: '0.01', min: '0', inputmode: 'decimal',
      value: rascunho.valor ?? '', placeholder: 'opcional', 'aria-label': 'Valor',
    });
    valor.addEventListener('input', () => {
      rascunho.valor = valor.value === '' ? null : Number(valor.value);
    });
    corpo.push(el('div.field', {}, [
      el('p.micro', { text: 'VALOR (R$)' }),
      valor,
      el('p.micro', { style: { color: 'var(--dim)' }, text: 'SEM VALOR ELE VIRA SÓ UM LEMBRETE — NÃO ENTRA EM CONTA NENHUMA.' }),
    ]));

    /* nota */
    const nota = el('input', { type: 'text', value: rascunho.nota || '', placeholder: 'ex.: débito automático', 'aria-label': 'Nota' });
    nota.addEventListener('input', () => { rascunho.nota = nota.value; });
    corpo.push(el('div.field', {}, [el('p.micro', { text: 'NOTA' }), nota]));

    /* ações */
    corpo.push(el('div.sheet__actions', {}, [
      !novo
        ? el('button.btn.btn--sm.btn--danger', {
            type: 'button',
            onclick: () => confirmSheet({
              title: `Apagar ${base.label}?`,
              text: 'Ele some da agenda e do calendário. Dá pra desfazer logo depois.',
              ok: 'Apagar', danger: true,
              onOk: () => {
                const snap = store.removeAgenda(item.id);
                toast('compromisso apagado', {
                  action: 'desfazer',
                  onAction: () => { store.restoreAgenda(snap); aoSalvar(); },
                });
                aoSalvar();
              },
            }),
          }, [el('span', { text: 'apagar' })])
        : null,
      el('button.btn.btn--solid', {
        type: 'button',
        onclick: () => {
          const label = (rascunho.label || '').trim();
          if (!label) { toast('dá um nome pra ele'); nome.focus(); return; }
          const dados = {
            emoji: (rascunho.emoji || '📌').trim() || '📌',
            label,
            tipo: rascunho.tipo,
            fluxo: store.AGENDA_TIPOS[rascunho.tipo]?.fluxo || 'saida',
            repete: rascunho.repete,
            dia: rascunho.repete === 'mensal' ? Number(rascunho.dia) || 1 : null,
            data: rascunho.repete === 'unico' ? (rascunho.data || todayKey()) : null,
            valor: rascunho.valor === '' || rascunho.valor === null ? null : Number(rascunho.valor),
            nota: (rascunho.nota || '').trim(),
          };
          if (novo) store.addAgenda(dados);
          else store.updateAgenda(item.id, dados);
          toast(novo ? 'compromisso criado' : 'salvo');
          close();
          aoSalvar();
        },
      }, [el('span', { text: novo ? 'criar' : 'salvar' })]),
    ].filter(Boolean)));

    setTimeout(() => { if (novo) nome.focus(); }, 60);
    return corpo;
  });
}

/** A caixa de sugestões — o começo rápido, sem digitar nada. */
export function sugestoesAgenda(aoAdicionar = () => {}) {
  openSheet('Começar por aqui', close => {
    const existentes = new Set(store.listAgenda().map(a => a.label.toLowerCase()));
    const corpo = [
      el('p', {
        style: { color: 'var(--dim)', fontSize: '.9rem', marginBottom: '.4rem' },
        text: 'Toque pra adicionar. Os dias são exemplo — cada banco e cada contrato tem o seu, então ajuste depois no item.',
      }),
    ];
    store.AGENDA_PRESETS.forEach(grupo => {
      corpo.push(el('p.micro', { style: { marginTop: '1rem' }, text: grupo.grupo }));
      corpo.push(el('div.chips', {}, grupo.itens.map(it => {
        const ja = existentes.has(it.label.toLowerCase());
        return el('button.chip' + (ja ? '.is-on' : ''), {
          type: 'button',
          disabled: ja || null,
          onclick: e => {
            store.addAgenda({ ...it, repete: it.repete || 'mensal', data: it.repete === 'unico' ? todayKey() : null });
            e.currentTarget.classList.add('is-on');
            e.currentTarget.disabled = true;
            toast(`${it.label} entrou na agenda`);
            aoAdicionar();
          },
          text: `${it.emoji} ${it.label}${it.dia ? ` · ${it.dia}` : ''}`,
        });
      })));
    });
    corpo.push(el('div.sheet__actions', {}, [
      el('button.btn.btn--solid', { type: 'button', onclick: close }, [el('span', { text: 'pronto' })]),
    ]));
    return corpo;
  });
}
