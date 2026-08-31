/* views/agendaform.js — a caixa que cria e edita um compromisso do mês.

   Mora fora das telas porque é usada em dois lugares: em Ajustes (onde a
   agenda é montada, ao lado das categorias da rotina) e na própria Agenda,
   tocando num item. Uma peça só, um comportamento só. */

import { el, todayKey, monthKey, daysInMonth } from '../utils.js';
import * as store from '../store.js';
import { openSheet, closeSheet, toast, confirmSheet } from '../ui.js';

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

/** "8 de setembro" — pro título da folha aberta a partir do calendário. */
const diaEscrito = k => `${Number(k.slice(8))} de ${MESES[Number(k.slice(5, 7)) - 1]}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "1.234,56", "1234.56", "R$ 90" ou vazio → número ou null. */
export function lerValor(texto) {
  const cru = String(texto ?? '').trim();
  if (!cru) return null;
  let limpo = cru.replace(/[^\d.,-]/g, '');
  // com os dois separadores, o último é o decimal; com um só, vírgula é decimal
  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  if (ultimaVirgula > -1 && ultimoPonto > -1) {
    limpo = ultimaVirgula > ultimoPonto
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo.replace(/,/g, '');
  } else if (ultimaVirgula > -1) {
    limpo = limpo.replace(',', '.');
  }
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

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

  /* Vindo de um toque no calendário, o tipo e o dia já foram respondidos —
     o botão que se apertou *era* a pergunta "que tipo é". Aí o formulário
     encolhe: some o seletor de tipo, some a repetição (é único por
     definição) e evento nem pergunta valor. Um formulário de quatro
     perguntas vira um de uma. */
  const enxuto = novo && !!padroes.tipo && !!padroes.data;
  const pedeValor = !enxuto || rascunho.tipo !== 'evento';
  const titulo = novo
    ? (enxuto
        ? `${store.AGENDA_TIPOS[rascunho.tipo]?.label || 'Compromisso'} · ${diaEscrito(rascunho.data)}`
        : 'Novo compromisso')
    : `${base.emoji || '•'} ${base.label}`;

  openSheet(titulo, close => {
    const corpo = [];

    /* emoji + nome */
    const emoji = el('input.emojin', { type: 'text', value: rascunho.emoji || '', maxlength: 3, 'aria-label': 'Emoji' });
    const nome = el('input', { type: 'text', value: rascunho.label || '', placeholder: 'Cartão Nubank', 'aria-label': 'Nome' });
    emoji.addEventListener('input', () => { rascunho.emoji = emoji.value; });
    nome.addEventListener('input', () => { rascunho.label = nome.value; });
    corpo.push(el('div.field', {}, [
      el('p.micro', { text: 'O QUE É' }),
      el('div.idrow', {}, [emoji, nome]),
    ]));

    /* tipo */
    const tipo = el('select.minisel', {}, Object.entries(store.AGENDA_TIPOS).map(([id, t]) =>
      el('option', { value: id, text: t.label, selected: id === rascunho.tipo ? true : null })));
    tipo.addEventListener('change', () => {
      rascunho.tipo = tipo.value;
      rascunho.fluxo = store.AGENDA_TIPOS[tipo.value]?.fluxo || 'saida';
    });
    if (!enxuto) {
      corpo.push(el('div.field', {}, [
        el('p.micro', { text: 'ONDE ELE APARECE' }),
        tipo,
        el('p.micro', { style: { color: 'var(--dim)' }, text: 'ASSINATURA E ENTRADA VÃO PRA ÁREA PESSOAL. O RESTO FICA NA AGENDA DO MÊS.' }),
      ]));
    }

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
    if (enxuto) corpo.push(campoDia);
    else corpo.push(el('div.field', {}, [el('p.micro', { text: 'REPETE?' }), rep]), campoDia);

    /* valor */
    /* Texto, não number: no teclado brasileiro o separador é vírgula, e
       <input type=number> devolve string vazia pra "21,90" — o valor sumia
       sem avisar. Aqui a vírgula é aceita e normalizada na hora de ler. */
    const valor = el('input', {
      type: 'text', inputmode: 'decimal', enterkeyhint: 'done',
      value: rascunho.valor ?? '', placeholder: 'opcional', 'aria-label': 'Valor',
    });
    valor.addEventListener('input', () => {
      rascunho.valor = lerValor(valor.value);
    });
    if (pedeValor) {
      corpo.push(el('div.field', {}, [
        el('p.micro', { text: 'VALOR (R$)' }),
        valor,
        enxuto ? null : el('p.micro', { style: { color: 'var(--dim)' }, text: 'SEM VALOR ELE VIRA SÓ UM LEMBRETE — NÃO ENTRA EM CONTA NENHUMA.' }),
      ].filter(Boolean)));
    }

    /* nota */
    const nota = el('input', { type: 'text', value: rascunho.nota || '', placeholder: 'ex.: débito automático', 'aria-label': 'Nota' });
    nota.addEventListener('input', () => { rascunho.nota = nota.value; });
    if (!enxuto) corpo.push(el('div.field', {}, [el('p.micro', { text: 'NOTA' }), nota]));

    /* de único pra todo mês, sem sair da folha: o caso comum é único, e
       "todo dia 8" é uma exceção que cabe num chip. */
    if (enxuto) {
      const mensal = el('button.chip', { type: 'button', text: `repetir todo dia ${Number(rascunho.data.slice(8))}` });
      mensal.addEventListener('click', () => {
        const virou = rascunho.repete !== 'mensal';
        rascunho.repete = virou ? 'mensal' : 'unico';
        rascunho.dia = Number(rascunho.data.slice(8));
        mensal.classList.toggle('is-on', virou);
      });
      corpo.push(el('div.chips', {}, [mensal]));
    }

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
            valor: pedeValor ? lerValor(valor.value) : null,
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

/**
 * A caixa de sugestões — o começo rápido, sem digitar nada.
 * `grupos` limita o que aparece: em Assinaturas não faz sentido oferecer
 * aluguel e cartão, que são de outra tela.
 */
export function sugestoesAgenda(aoAdicionar = () => {}, { grupos = null, titulo = 'Começar por aqui' } = {}) {
  openSheet(titulo, close => {
    const existentes = new Set(store.listAgenda().map(a => a.label.toLowerCase()));
    const corpo = [
      el('p', {
        style: { color: 'var(--dim)', fontSize: 'var(--t-corpo)', marginBottom: '.4rem' },
        text: 'Toque pra adicionar. Os dias são exemplo — cada banco e cada contrato tem o seu, então ajuste depois no item.',
      }),
    ];
    store.AGENDA_PRESETS
      .filter(g => !grupos || grupos.includes(g.grupo))
      .forEach(grupo => {
      if (!grupos || grupos.length > 1) corpo.push(el('p.micro', { style: { marginTop: '1rem' }, text: grupo.grupo }));
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
