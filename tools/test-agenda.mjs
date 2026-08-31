/* Testa as contas da agenda do mês. Rode com: node tools/test-agenda.mjs

   O que importa aqui é aritmética de calendário e de dinheiro — as duas
   coisas que, erradas, fazem o app mentir com cara de certeza. Por isso
   não passa por navegador: importa o store direto e mexe no estado. */

import * as store from '../js/store.js';

let falhas = 0;
const ok = (cond, nome) => {
  console.log(`${cond ? '  ok ' : '  FALHOU '} ${nome}`);
  if (!cond) falhas++;
};

/* O store precisa de um localStorage pra existir fora do navegador. */
globalThis.localStorage ??= {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

const limpar = () => { store.state.agenda.length = 0; };

console.log('dia do mês');
{
  limpar();
  const a = store.addAgenda({ label: 'Aluguel', dia: 5, tipo: 'aluguel' });
  ok(store.diaNoMes(a, '2026-09') === 5, 'dia fixo cai no dia');
  ok(store.dataNoMes(a, '2026-09') === '2026-09-05', 'a data completa sai certa');

  const fim = store.addAgenda({ label: 'Fechar as horas', dia: 31 });
  ok(store.diaNoMes(fim, '2026-02') === 28, 'o 31 vira o último dia de fevereiro');
  ok(store.diaNoMes(fim, '2028-02') === 29, 'e 29 em ano bissexto');
  ok(store.diaNoMes(fim, '2026-04') === 30, 'o 31 vira 30 em abril');
  ok(store.diaNoMes(fim, '2026-01') === 31, 'e continua 31 em janeiro');

  const unico = store.addAgenda({ label: 'Show', repete: 'unico', data: '2026-09-18' });
  ok(store.diaNoMes(unico, '2026-09') === 18, 'evento único aparece no mês dele');
  ok(store.diaNoMes(unico, '2026-10') === null, 'e não aparece em nenhum outro');
}

console.log('\nlista do mês');
{
  limpar();
  store.addAgenda({ label: 'Cartão', dia: 20, tipo: 'cartao' });
  store.addAgenda({ label: 'Aluguel', dia: 5, tipo: 'aluguel' });
  store.addAgenda({ label: 'Freela', repete: 'unico', data: '2026-09-11', tipo: 'renda' });
  store.addAgenda({ label: 'Passado', repete: 'unico', data: '2026-07-02', tipo: 'evento' });

  const mes = store.agendaDoMes('2026-09');
  ok(mes.length === 3, 'evento de outro mês fica de fora');
  ok(mes.map(a => a.dia).join(',') === '5,11,20', 'a lista sai em ordem de dia');
  ok(store.agendaDoDia('2026-09-05').length === 1, 'o dia devolve só o que cai nele');

  const pausado = store.addAgenda({ label: 'Academia velha', dia: 1, pausado: true });
  ok(!store.agendaDoMes('2026-09').some(a => a.id === pausado.id), 'compromisso pausado some da lista');
}

console.log('\nmarcar por mês');
{
  limpar();
  const c = store.addAgenda({ label: 'Cartão', dia: 10, tipo: 'cartao', valor: 1000 });
  ok(!store.agendaFeito(c, '2026-09'), 'nasce em aberto');
  store.marcarAgenda(c.id, '2026-09', true);
  ok(store.agendaFeito(store.agendaById(c.id), '2026-09'), 'marcou setembro');
  ok(!store.agendaFeito(store.agendaById(c.id), '2026-10'), 'outubro continua em aberto — cada mês é um mês');
  store.marcarAgenda(c.id, '2026-09', false);
  ok(!store.agendaFeito(store.agendaById(c.id), '2026-09'), 'desmarcar volta atrás');
}

console.log('\ndinheiro');
{
  limpar();
  store.addAgenda({ label: 'Aluguel', dia: 5, tipo: 'aluguel', valor: 2300 });
  const cartao = store.addAgenda({ label: 'Cartão', dia: 10, tipo: 'cartao', valor: 1200 });
  store.addAgenda({ label: 'Spotify', dia: 5, tipo: 'assinatura', valor: 21.9 });
  store.addAgenda({ label: 'Emitir NF', dia: 1, tipo: 'nf' });                  // sem valor
  store.addAgenda({ label: 'Agência', dia: 10, tipo: 'renda', valor: 5000 });

  let c = store.contasDoMes('2026-09');
  ok(Math.abs(c.totalSaida - 3521.9) < 0.001, 'soma tudo que sai, assinatura incluída');
  ok(c.totalEntrada === 5000, 'soma o que entra');
  ok(Math.abs(c.saldo - 1478.1) < 0.001, 'o saldo é entrada menos saída');
  ok(c.assinaturas === 21.9, 'assinatura tem subtotal próprio');
  ok(c.pago === 0 && Math.abs(c.aPagar - 3521.9) < 0.001, 'nada pago ainda');
  ok(c.itens.length === 5 && c.pendentes.length === 5, 'compromisso sem valor conta como item');

  store.marcarAgenda(cartao.id, '2026-09', true);
  c = store.contasDoMes('2026-09');
  ok(c.pago === 1200 && Math.abs(c.aPagar - 2321.9) < 0.001, 'marcar move de "a pagar" pra "pago"');
  ok(c.feitos.length === 1 && c.pendentes.length === 4, 'e a contagem acompanha');

  ok(store.contasDoMes('2026-10').pago === 0, 'no mês seguinte o pago zera sozinho');
}

console.log('\nlápide');
{
  limpar();
  const a = store.addAgenda({ label: 'Ginástica', dia: 3 });
  const snap = store.removeAgenda(a.id);
  ok(store.listAgenda().length === 0, 'apagado some da lista');
  ok(store.state.agenda[0].deletedAt > 0, 'mas fica a lápide, pra exclusão viajar');
  store.restoreAgenda(snap);
  ok(store.listAgenda().length === 1, 'e o desfazer traz de volta');
}

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
