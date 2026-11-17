/* Histórico de tarefas e finanças que já estavam no cofre do Caderno. */

import { el, humanDay, monthKey, monthLabel, moeda, plural } from '../utils.js';
import * as store from '../store.js';
import { toast, openSheet } from '../ui.js';
import { iconBtn } from './today.js';
import * as central from '../chatgpt.js';
import * as vault from '../vault.js';
import { FINANCE_ACCESS, TASK_EXPORT, makeTransfer } from '../companion-transfer.js';
import { CLIENT_KEY, DEFAULT_CLIENT_ID, loadIdentity, requestGoogleGrant } from '../google-tasks.js';
import { importCaderno } from '../../tarefas/backend.js';

export function render(ctx) {
  const tasks = store.listTodos();
  const mes = ctx.pessoalMes || monthKey();
  const contas = store.agendaDoMes(mes);
  const wallet = store.state.wallet;
  const backup = vault.exportWalletBackup();
  const mudarMes = delta => {
    const [ano, indice] = mes.split('-').map(Number);
    ctx.pessoalMes = monthKey(new Date(ano, indice - 1 + delta, 1));
    ctx.rerender();
  };
  const view = el('div.view', {}, [
    el('div.vhead', {}, [el('div.vhead__l', {}, [
      el('h2.display.h-lg', { text: 'Dados anteriores' }),
    ])]),
    el('p.muted', { text: 'Consulte os registros que estavam no Caderno antes da separação dos apps.' }),
    el('section.section', {}, [
      el('h3', { text: 'Tarefas' }),
      tasks.length
        ? el('ul.legado-lista', {}, tasks.map(task => row(task.text,
          [task.done ? 'Concluída' : 'Aberta', task.due && humanDay(task.due)].filter(Boolean).join(' · '))))
        : el('p.muted', { text: 'Nenhuma tarefa salva no Caderno.' }),
    ]),
    el('section.section', {}, [
      el('h3', { text: 'Contas e compromissos' }),
      el('div.daynav', {}, [
        iconBtn('M15 6l-6 6 6 6', () => mudarMes(-1), 'Mês anterior'),
        el('span.daynav__label', { text: monthLabel(mes) }),
        iconBtn('M9 6l6 6-6 6', () => mudarMes(1), 'Mês seguinte'),
      ]),
      contas.length
        ? el('ul.legado-lista', {}, contas.map(item => row(item.label,
          [item.data && humanDay(item.data), store.agendaFeito(item, mes) ? 'Resolvido' : 'Pendente'].filter(Boolean).join(' · '),
          item.valor != null ? moeda(item.valor, { cents: 2 }) : null)))
        : el('p.muted', { text: 'Nenhum registro nesse mês.' }),
      wallet ? el('p.muted', {
        text: `Último saldo da Carteira neste cofre: ${moeda((wallet.balance + wallet.invested) / 100, { cents: 2 })}.`,
      }) : null,
      backup ? el('button.btn.btn--sm', { type: 'button', onclick: baixarBackupCarteira },
        [el('span', { text: 'Baixar backup da Carteira anterior' })]) : null,
    ]),
  ]);
  return view;
}

function row(label, note, amount) {
  return el('li', {}, [
    el('div', {}, [el('p', { text: label }), el('p.micro', { text: note })]),
    amount ? el('span.num', { text: amount }) : null,
  ]);
}

function baixarBackupCarteira() {
  const data = vault.exportWalletBackup();
  if (!data) return;
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = el('a', { href: url, download: 'caderno-antes-do-recomeco.caderno' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function migrarTarefasDireto() {
  const session = store.getSession();
  const tasks = store.openTodos().map(({ id, text, due, star }) => ({ id, text, due, star }));
  if (!tasks.length) { toast('Nenhuma tarefa aberta para migrar.'); return; }
  openSheet('Migrar para Google Tasks', close => {
    const client = el('input', { value: localStorage.getItem(CLIENT_KEY) || store.state.settings.googleTasks?.clientId || DEFAULT_CLIENT_ID, required: true, autocapitalize: 'none', spellcheck: 'false' });
    const status = el('p.micro', { role: 'status' });
    const submit = el('button.btn.btn--solid', { type: 'submit', disabled: true, text: 'Autorizar e migrar' });
    const form = el('form', { onsubmit: async event => {
      event.preventDefault();
      const id = client.value.trim() || DEFAULT_CLIENT_ID;
      if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(id)) { status.textContent = 'Cole o mesmo ID OAuth que usou no Tarefas.'; return; }
      submit.disabled = true;
      status.textContent = 'Aguardando autorização do Google…';
      const sheet = form.closest('#sheet');
      const active = () => store.getSession() === session && form.isConnected && sheet && !sheet.hidden && !sheet.classList.contains('is-closing');
      try {
        const grant = await requestGoogleGrant(id);
        if (!active()) return;
        localStorage.setItem(CLIENT_KEY, id);
        status.textContent = 'Enviando tarefas abertas para a lista Caderno…';
        const count = await importCaderno(grant.token, tasks, active);
        if (!active()) return;
        close();
        toast(count ? `${plural(count, 'tarefa importada', 'tarefas importadas')}.` : 'As tarefas abertas já estão no Google Tasks.', { ms: 5500 });
      } catch (error) { status.textContent = error.message; }
      finally { submit.disabled = false; }
    } }, [
      el('p.muted', { text: `${plural(tasks.length, 'tarefa aberta', 'tarefas abertas')}. A migração usa a lista Caderno do Google Tasks e reaproveita os itens já vinculados.` }),
      el('details', {}, [el('summary', { text: 'Configuração da conexão' }), el('label.field', {}, [el('span.micro', { text: 'ID do cliente OAuth' }), client])]),
      status,
      el('div.wrap', {}, [submit, el('button.btn.btn--sm', { type: 'button', text: 'Gerar código cifrado', onclick: () => mostrarTransferencia(false) })]),
    ]);
    loadIdentity().then(() => { submit.disabled = false; }).catch(error => { status.textContent = error.message; });
    return form;
  });
}

export function mostrarTransferencia(finance) {
  const connection = central.config();
  if (finance && !connection) { toast('Conecte a Central em Ajustes → Check-in com ChatGPT.'); return; }
  const session = store.getSession();
  const data = finance
    ? { owner: connection.owner, repo: connection.repo, from: connection.from, token: connection.token }
    : store.openTodos().map(({ id, text, due, star }) => ({ id, text, due, star }));
  if (!finance && !data.length) { toast('Nenhuma tarefa aberta para transferir.'); return; }
  openSheet(finance ? 'Conectar app Financeiro' : 'Gerar código para Tarefas', () => {
    const password = el('input', { type: 'password', autocomplete: 'new-password', minlength: 8, required: true });
    const code = el('textarea', { readOnly: true, hidden: true, rows: '3', 'aria-label': 'Código cifrado' });
    const status = el('p.micro', { role: 'status' });
    const copy = el('button.btn.btn--solid', { type: 'button', hidden: true, disabled: true, text: 'Copiar código', onclick: async () => {
      try { await navigator.clipboard.writeText(code.value); status.textContent = 'Código copiado.'; }
      catch { code.focus(); code.select(); status.textContent = 'Toque em Copiar na seleção.'; }
    } });
    const generate = el('button.btn.btn--solid', { type: 'submit', text: 'Gerar código' });
    return el('form', { onsubmit: async event => {
      event.preventDefault();
      generate.disabled = true;
      status.textContent = 'Preparando código cifrado…';
      try {
        const value = await makeTransfer(session, finance ? FINANCE_ACCESS : TASK_EXPORT, data, password.value);
        if (store.getSession() !== session || !code.isConnected) return;
        password.value = '';
        password.disabled = true;
        generate.hidden = true;
        code.hidden = false;
        code.value = value;
        copy.hidden = false;
        copy.disabled = false;
        status.textContent = 'Use no outro app a senha que você acabou de escolher.';
      } catch (err) { status.textContent = err.message; }
      finally { generate.disabled = false; }
    } }, [
      el('p.muted', { text: finance
        ? 'Escolha uma senha para o Financeiro. Ela abre o código e destranca o novo app.'
        : `${data.length} tarefas abertas. Escolha uma senha para abrir este código no app Tarefas.` }),
      el('label.field', {}, [el('span.micro', { text: finance ? 'Senha do Financeiro' : 'Senha da migração' }), password]),
      generate, code, status, copy,
    ]);
  });
}

export function mostrarImportacaoCarteira(data, ctx) {
  try {
    const session = store.getSession();
    const plan = store.walletImportPlan(data);
    const brl = cents => moeda(cents / 100, { cents: 2 });
    openSheet('Atualizar a Carteira', close => [
      el('p.muted', { text: `Saldo em ${humanDay(plan.date)}. Em conta ${brl(plan.balance)} e investido ${brl(plan.invested)}.` }),
      ...plan.receivables.map(({ item, title }) => el('p.muted', { text: `${item.label} → ${title} · ${moeda(item.valor, { cents: 2 })}` })),
      el('div.sheet__actions', {}, [
        el('button.btn', { type: 'button', onclick: close, text: 'Cancelar' }),
        el('button.btn.btn--solid', {
          type: 'button', text: 'Aplicar atualização',
          onclick: async e => {
            const button = e.currentTarget;
            button.disabled = true;
            try {
              if (!session || store.getSession() !== session || !button.isConnected) return;
              store.applyWalletImport(data);
              if (!(await store.flush())) throw new Error('Não consegui salvar no cofre. Tente de novo.');
              close();
              ctx.rerender();
              toast('Carteira atualizada');
            } catch (err) { toast(err.message, { ms: 5500 }); }
            finally { button.disabled = false; }
          },
        }),
      ]),
    ]);
  } catch (err) { toast(err.message, { ms: 5500 }); }
}
