# Tarefas — continuidade

## Revisão do check em 28/11/2026

- O cartão em destaque e as linhas da lista e do calendário compartilham a
  mesma trava por tarefa. A escrita invalida leituras do Google que ainda
  estavam em andamento. O aviso confirma a mudança apenas após a resposta.
- Ao concluir, o aviso exibe o título e Desfazer. O check seguinte ignora
  toques repetidos no mesmo ponto e o foco de teclado não passa para o
  próximo botão de conclusão. Reabrir também limpa a data de conclusão.
- O editor conserva os campos quando o Google pede reconexão e volta ao
  filtro e à posição de leitura. O calendário mantém o dia selecionado no
  mês exibido. Concluídas são ordenadas pela data de conclusão.
- Verificados no Chromium com Google simulado: toques duplicados, falha 503,
  conclusão e desfazer, resposta de sincronização atrasada, posição de
  rolagem e reconexão no editor. A bateria de lógica passou. A bateria
  Playwright do terminal não conseguiu iniciar o Chromium no ambiente.
  A validação no Safari do iPhone segue pendente. Cache PWA `caderno-v46`.

Atualizado em 23/11/2026.

## Edição, calendário e gesto do cartão principal

Pedido: ampliar a edição das tarefas, permitir emojis, corrigir o arrasto do
cartão principal no topo e oferecer um calendário que abre e fecha por botão.

- Editor: título, notas, prazo, prioridade normal/alta e estado pendente/concluída.
  Novas tarefas continuam permitindo escolher a lista. Atalhos: hoje, amanhã,
  em uma semana e sem prazo. Seletores de emoji inserem no cursor do título ou
  das notas; o teclado nativo também funciona.
- Notas: salvas no Google Tasks. `editorFields` preserva as linhas de vínculo
  `Caderno ID: …`, oculta essas linhas no editor e mantém a convenção existente
  `Prioridade: alta`. A prioridade é uma convenção do app nas notas, não um campo
  nativo do Google. Limite de 8.192 caracteres, incluindo metadados. Reabrir limpa
  `completed`. Erro de salvamento mantém os campos preenchidos para tentar outra vez.
- Calendário: recolhido inicialmente, com botão de abrir/fechar, navegação mensal,
  retorno para hoje, indicadores dos dias com pendências e lista do dia selecionado.
  Respeita a lista escolhida; mostra todas as tarefas pendentes daquele dia,
  inclusive a que está destacada no topo. Permite criar com o prazo selecionado.
  Usa apenas as datas do Google Tasks; não busca eventos do Google Calendar.
- Gesto: apenas no cartão principal. Captura o pointer no início, permite mouse
  e toque, usa limite de 32% da largura (máximo 96px), cancela com rolagem vertical
  ou cancelamento do navegador e mantém os botões Concluir e Desfazer.
- Cache PWA: `caderno-v40`, incluindo o novo módulo `tarefas/calendar.js`.

## Validação

- As 11 suítes de lógica passaram. `tools/test-tarefas-editor.mjs` cobre vínculo
  das notas, prioridade, datas inválidas, limite de texto, filtro do calendário e
  eventos de arrasto curto, completo, vertical, cancelado e com ação bloqueada.
- Conferência interativa com dados fictícios: editor, inserção de emoji, salvar
  notas/prioridade/prazo, calendário, troca de mês/dia, layout com largura de
  360px, arrasto por mouse (curto não conclui; completo conclui).
- Bateria executada com `tools/testar.sh`: as 22 suítes de navegador não puderam
  iniciar Chromium neste ambiente (`socket() failed: Operation not permitted`).
  Isso inclui a nova regressão `tools/browser/tarefas.mjs`, que usa Google simulado,
  WebAuthn virtual e toque via CDP. Não foi possível confirmar essa suíte aqui.
- Ainda falta validar o gesto no Safari de um iPhone físico. Não houve alteração
  no fluxo de autenticação nem gravação em tarefas reais durante os testes.

Os arquivos temporários de QA, com dados fictícios e API simulada, não fazem parte
da publicação. Em 23/11, o usuário autorizou explicitamente a publicação destes
arquivos de código no repositório público `vilkers/caderno`, após o bloqueio inicial
da revisão automática. A fonte de publicação é `main`; manter o histórico da branch
de desenvolvimento ao sincronizá-la. Confirmar o envio e o workflow do GitHub Pages
antes de anunciar a versão como publicada.
