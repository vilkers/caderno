# Sugestões pro Caderno

Decisões que já estão no app, o que mudou nesta rodada e o que eu faria em
seguida — em ordem de quanto muda a sua vida por unidade de trabalho.

## Por que a entrada de dados é assim

- **Um controle por natureza do dado.** Botão de um toque pro que é sim/não,
  stepper pro que é contagem, slider com passo de 30 min pra duração, cinco
  alvos pra escala. Campo de texto só onde número não serve — texto é o
  formato que mais gente abandona depois de duas semanas.
- **Salva no toque, sem botão de salvar.** O custo de registrar precisa ser
  menor que o de lembrar. O "Fechar o dia" existe só pra separar *não fiz* de
  *esqueci de anotar* — sem isso, todo dado ausente vira ambíguo e as médias
  mentem.
- **Zero é ausência.** Valor zero apaga o registro daquela categoria no dia,
  então o arquivo não incha e "dia registrado" continua significando algo.
- **Metas dentro do check-in.** O `2/4·sem` ao lado da categoria transforma o
  registro em decisão ("ainda dá pra hoje") em vez de só arquivo morto.
- **Esquecer é o caso normal, não a exceção.** Por isso o caminho de voltar no
  tempo é curto: faixa dos últimos dias sempre visível, seletor de data,
  "repetir ontem", aviso quando a semana tem buracos e a grade da semana pra
  preencher tudo de uma vez.
- **Toda ação destrutiva tem desfazer.** Apagar tarefa, apagar categoria,
  limpar concluídas, repetir ontem — desfazer no rodapé por alguns segundos.
  Confirmação só onde desfazer não salva (apagar o caderno inteiro).

## Rodada 12 — as duas mudanças estruturais, e a escala tipográfica

- **A Agenda virou aba de Pessoal.** As duas telas já mostravam quase o mesmo
  conjunto — a Carteira lista tudo da agenda mais assinaturas, e marcar como
  pago funcionava nas duas —, só que uma estava a um toque e a outra a dois
  mais rolagem. Agora Pessoal tem quatro abas: Tarefas · Contas · Assinaturas ·
  Carteira, todas com navegação de mês. Sumiu um item do menu e a colisão entre
  "Mês" (o calendário da rotina) e "Agenda do mês" (as contas).

- **Metas saiu da barra de baixo e Insights entrou.** Meta se ajusta uma vez
  por semana, e já se ajusta dentro da Revisão, com − e + ao lado do resultado;
  Padrões é o que se abre à toa. Os atalhos do ícone instalado, aliás, já
  elegiam Hoje/Contas/Pessoal/Semana — o app discordava da própria barra. Com
  Insights embaixo, o ícone dele saiu do topo, que agora carrega só identidade,
  sincronia e menu.

- **A escala tipográfica.** Você sentiu "muita fonte diferente" e a medição deu
  razão à sensação, mas o culpado não era a família: são duas, de propósito.
  Eram **50 combinações distintas** de tamanho/peso/tracking, com **17 corpos**
  (8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 21, 24, 26, 27, 29, 32) e **6
  pesos**, cada componente escolhendo o seu na mão. Agora são sete degraus de
  texto e quatro de display, três pesos, tudo em token — 36 combinações, e as
  que sobram são as legítimas (o mesmo degrau em caixa alta, em mono, com
  tracking). Componente novo escolhe dentro da escala em vez de inventar.

- Nome de categoria comprido era cortado com reticências no check-in a 360px.
  Quem escolheu o nome quer lê-lo inteiro: agora quebra em duas linhas.

## Rodada 11 — o menu emagrece e a barra de cima vira bússola

Chamei um segundo par de olhos (um agente só pra UX) pra olhar menu e
navegação com o app rodando no tamanho do iPhone, medindo posição de cada
linha. O que ele achou, e o que eu fiz:

- **Três itens do menu nasciam fora da tela.** Dez cartões de duas linhas em
  750px de altura útil: Paleta, Caderno 2.0 e Trancar só existiam depois de
  rolar. Pior: os três primeiros lugares — a área mais cara — eram Perfil,
  Retrospectiva e Insights, e **dois deles já estão a um toque na barra de
  cima**. O menu virou seis linhas de uma linha só, sem descrição, todas acima
  da dobra. Perfil, Insights e Metas saíram (avatar, ícone do topo, barra de
  baixo); Caderno 2.0 e a grade de paleta ficaram em Ajustes.

- **Havia um quarto lugar listando os mesmos destinos**: um bloco "DO SEU
  JEITO" dentro do Perfil, com as mesmas cinco entradas do menu e as descrições
  copiadas — um menu dentro de uma tela que só se alcança pelo menu. Apagado.

- **A barra de cima dizia "HOJE" enquanto você olhava a carteira de julho**, e
  o "← voltar" morava no conteúdo, então sumia ao rolar (Ajustes tinha 4908px:
  quase seis telas). Agora, em tela secundária, o avatar vira seta e o nome
  vira o nome da tela — e como a barra é fixa, a saída está sempre ali. O
  "← voltar" saiu de dentro das cinco telas que o tinham. Ajustes encolheu pra
  3989px de quebra.

- **Metas tinha "← voltar" sendo destino de barra**: voltar de uma raiz não tem
  pra onde ir.

- **"Agenda do mês" e "Mês" usavam o mesmo ícone e nomes quase iguais** pra
  telas sem relação. A do menu virou **Contas do mês**, com ícone próprio.

- **Marcação rápida saiu** (a pedido). O check-in já lista o que falta com um
  botão por pendência — a caixa era a mesma coisa numa camada a mais. O aviso
  do lembrete e o atalho do ícone passaram a abrir o dia; o `?v=rapido` de
  avisos antigos continua caindo lá, pra não quebrar o que já foi disparado.

- **Carteira e Assinaturas ganharam navegação de mês.** Sem ela, "quanto entrou
  em julho" era uma pergunta sem resposta.

- Layout: o contorno do dia selecionado no calendário era desenhado quadrado
  dentro de uma grade arredondada que recorta — nos quatro cantos ele saía
  comido. As células de canto ganharam o mesmo raio.

Ficaram **em aberto pra você decidir** (o agente classificou como "vale
discutir", e são mudanças estruturais):

1. **Fundir a Agenda dentro de Pessoal**, como uma quarta aba. Hoje as duas
   telas mostram quase o mesmo conjunto (a Carteira lista tudo da agenda, mais
   assinaturas) e marcar como pago funciona nas duas. É a mudança de maior
   retorno e a mais arriscada.
2. **Trocar Metas por Insights na barra de baixo.** Meta se ajusta uma vez por
   semana — e já se ajusta dentro da Revisão. Os atalhos do ícone instalado, a
   propósito, elegem Hoje/Contas/Pessoal/Semana: o app já discorda da própria
   barra sobre quais são os quatro destinos.
3. Um índice de seções no topo de Ajustes.

## Rodada 10 — o fundo respira, e uma varredura de bugs

- **Bug que impedia cadastrar compromisso.** O campo de nome tinha **0px de
  largura**: `.field input{width:100%}` tem especificidade maior que a largura
  que eu tinha dado ao campo do emoji, e o emoji engolia a linha inteira. Dava
  pra abrir o formulário e não dava pra escrever nele — e, sem nome, o botão
  "criar" recusava em silêncio. A linha virou grade (`.idrow`), que não depende
  de quem venceu a cascata.

- **Valor com vírgula sumia.** O campo era `<input type="number">`, e o teclado
  brasileiro escreve `21,90`. Pra esse input isso é texto inválido: ele devolve
  string vazia, então o valor virava `null` sem nenhum aviso. Agora é campo de
  texto com `inputmode="decimal"`, e a leitura entende `21,90`, `1.234,56`,
  `1234.56` e até `R$ 90`.

- **Alvos de toque.** Varri as nove telas em três larguras medindo cada
  controle. Botões pequenos de 29–38px viraram 42–44; onde o desenho **tem** de
  ser pequeno (o check redondo da agenda, a caixa da tarefa, a estrela, o
  interruptor, o punho de arrastar), a área de toque cresce por baixo, num
  pseudo-elemento invisível de 44px — o desenho continua delicado e o dedo
  acerta. Conferido por toque, não por CSS: o teste clica 5px fora da borda e
  exige que a ação aconteça.

- **Fundo vivo.** Três manchas da paleta presas à tela: no topo manda a de
  cima, e conforme você rola ela sobe e cede lugar à de baixo, com uma terceira
  crescendo devagar no meio. Trocar de paleta troca o fundo junto, com
  transição. Custa uma variável CSS por quadro (`--r`, de 0 a 1) — todo o resto
  é `transform` e `opacity`, sem blur e sem filtro. Com o movimento desligado
  ele fica, parado.

  **O teto de opacidade não foi chutado.** A primeira versão, mais forte,
  reprovou 13 pares de contraste: o `--dim` de cada paleta estava calibrado pra
  exatamente 4.5 contra o fundo puro, ou seja, sem folga nenhuma pra qualquer
  coisa atrás do texto. Então fiz as duas coisas: baixei as manchas pra 9%/7%/3%
  e **recalculei `--dim` e `--accent-txt` com margem**, agora medidos contra o
  fundo, o cartão e a mancha mais forte. `tools/test-contraste.mjs` passou a
  cobrir isso.

- Correção que eu mesmo causei no meio do caminho: pôr `position:relative` em
  `.nav` pra levantar o conteúdo acima do fundo derrubou a barra de baixo pro
  meio da página — ela já era `fixed`. Só o `.main` precisava.

- **"Conflito no repositório: tente de novo."** Aconteceu de verdade no seu
  aparelho, e minha primeira explicação estava errada: culpei a consistência
  com atraso do GitHub e pus três tentativas — que continuaram falhando.

  A causa real é uma linha na resposta da API: **`Cache-Control: private,
  max-age=60`**. Toda resposta autenticada do GitHub pede pro navegador guardar
  por um minuto. O app relia o arquivo, recebia **a resposta velha do cache**,
  com o identificador antigo, e gravava com ele — o que o GitHub recusa, com
  razão. E as três tentativas novas liam exatamente a mesma resposta guardada,
  então repetiam o mesmo erro três vezes mais rápido. Um `cache: 'no-store'`
  em cada chamada resolve.

  Fica a lição: o repique só maquiava. A pergunta certa não era "como tentar de
  novo", era "por que a segunda leitura devolve a mesma coisa que a primeira".

  Junto disso, duas causas de fundo: a sincronia **gravava mesmo quando nada
  tinha mudado** (e cada junção agendava a próxima, num vaivém que só produzia
  commits vazios e mais chance de colisão), e o intervalo automático de 6s
  virava um commit por marcação. Agora compara o conteúdo antes de gravar e
  espera 15s.

- **A versão nova só chegava na segunda abertura.** O service worker servia o
  cache primeiro e atualizava por trás, então você abria o app depois de um
  deploy e via a versão velha — parecia que a correção não tinha saído. Agora o
  código do app (html, js, css) vai pela rede primeiro, com o cache entrando se
  a conexão demorar mais de 2,5s ou falhar; fonte e ícone continuam vindo do
  cache, que é onde essa estratégia faz sentido.

## Rodada 9 — o mês entra no caderno

Até aqui o caderno só sabia de dias. Mas metade do que ocupa a cabeça acontece
uma vez por mês, num dia certo, e não tem nada a ver com hábito.

- **Agenda do mês.** Aluguel, cartões, contas de casa, a NF da agência, eventos
  que acontecem uma vez só. Cada item tem dia, valor opcional e um toque pra
  resolver — e **a marcação vale por mês**, então no mês que vem tudo volta em
  aberto sozinho. Sugestões prontas (Nubank, Itaú, BTG, luz, água, internet,
  aluguel, NF) pra montar em alguns toques, com os dias como exemplo e um aviso
  de que cada contrato tem o seu.

  Mora em Ajustes, junto das categorias, porque é a mesma pergunta — *o que
  este caderno cobra de mim?* A rotina cobra todo dia; a agenda cobra no dia.

  **De propósito, não entra no progresso da rotina.** Pagar o aluguel não é
  hábito. Somar as duas coisas faria a barra do dia mentir de novo — que foi
  exatamente o furo que a rodada 5 consertou.

- **Pessoal (a antiga Lista).** A lista de afazeres continua igual e integrada
  ao app inteiro; ao lado dela entraram duas abas de gestão pessoal:
  **Assinaturas** (o que debita sozinho — quanto some por mês e por ano, com as
  maiores em barras) e **Carteira** (o que você tem pra receber, e a sobra
  prevista contra tudo que sai).

  Essas duas ficam **fora do XP e das metas**. Dinheiro não é hábito, e
  transformar conta em pontuação faria de uma coisa chata uma coisa chata e
  barulhenta.

- **O calendário virou gráfico.** As dez bolinhas iguais por dia não eram
  leitura, eram poeira: diziam "aconteceu alguma coisa" e mais nada. Agora cada
  dia tem **anel** (quanto do obrigatório fechou), **barra embaixo** (quantas
  marcações teve, comparado ao mês) e **ponto no canto** (compromisso do mês).
  Lado a lado, os dias viram um gráfico da sua constância. Tocar num dia abre
  uma **prévia** — o que marcou, o que faltou, a anotação, os compromissos do
  dia — em vez de te tirar do calendário no primeiro toque.

- **A retrospectiva ganhou desenho.** Antes era tipografia grande e número
  subindo, o que é bonito mas repete a mesma forma doze vezes. Agora cada
  cartão tem o gráfico que a informação pede: malha de dias, anel, corrente de
  elos, barras, colunas por dia da semana, a escada dos oito níveis, o placar
  final. Tudo entra depois do texto, como quem completa a frase.

- **`js/graficos.js`**, novo: anel, barras, colunas, malha, trilha, barra de
  progresso e sparkline — em SVG e CSS, sem biblioteca, com o estado final
  idêntico quando o movimento está desligado. É usado pela retrospectiva, pelo
  calendário e pela agenda, então gráfico novo nasce consistente.

- Correção achada em tela: `append(null)` escreve a palavra "null" na página
  (o `el()` filtra, o `append` direto não) — quatro lugares mostravam `null`
  onde devia estar o valor.

## Rodada 8 — lembrete, marcação rápida e ritual da semana

Das seis ideias de app de rotina que levantei, você aprovou três. Estas.

- **Lembrete que sabe o que falta.** Um aviso por dia, no horário escolhido, e
  só se ainda houver pendência — dia fechado não incomoda. Opcionalmente diz os
  nomes ("falta: remédio, sono") em vez do número.

  Sem servidor não existe alarme garantido e eu não ia fingir que existe: são
  três camadas, da mais frágil pra mais confiável — Periodic Background Sync
  (Android, app instalado), relógio dentro da página, e selo no ícone + aviso ao
  abrir, que funcionam em qualquer lugar. A tela de Ajustes explica isso com
  todas as letras, porque lembrete que falha em silêncio é pior que nenhum.

  **O worker não abre o cofre.** Ele não tem a senha e nunca vai ter. Então o
  app deixa uma gaveta separada (`js/idb.js`) com o mínimo: quantas marcações
  faltam, o horário, e — só se você ligar *Dizer o que falta* — os nomes das
  categorias pendentes. Nenhum valor marcado sai do cofre.

- **Marcação rápida.** Uma caixa com só o que falta hoje e um botão de fechar o
  dia. O aviso cai direto nela pelo endereço `?v=rapido`, que também serve de
  atalho na tela de início: um toque, marca, pronto. É a diferença entre
  registrar em cinco segundos e "depois eu abro o app" — que é nunca.

- **Revisão da semana.** Segunda de manhã, uma faixa no Hoje: a semana passada
  acabou. A revisão mostra o placar contra a semana anterior e vai meta por
  meta — quanto foi, quanto era pra ser. E aqui está o pulo: **a meta se
  corrige ali mesmo**, com `−` e `+`, no momento em que você está olhando pro
  resultado dela. Era a tarefa mais chata do app (entrar em categoria por
  categoria) e virou a mais natural. Fecha com uma linha escrita, e fica
  gravada; dá pra reabrir.

- Correção achada pelo teste: `navigator.serviceWorker.ready` **nunca resolve**
  quando nenhum worker foi registrado (http local, navegador sem suporte,
  registro que falhou). O botão de ligar o lembrete travava pra sempre nesse
  caso. Agora `js/lembrete.js` pergunta primeiro por `getRegistration()` e
  ainda corre contra um limite de 2s.

## Rodada 7 — arrastar, contraste medido e retrospectiva

- **Ordenar arrastando** (tarefas e categorias), com punho dedicado — sem
  ele, no celular o gesto briga com a rolagem — e ↑ ↓ no teclado, porque
  arrastar sozinho não é acessível. A ordem manual passou a mandar: a
  estrela virou destaque em vez de empurrar a tarefa pro topo.
- **Contraste medido, não estimado.** `node tools/test-contraste.mjs` audita
  os pares que a interface usa em todas as oito paletas. Sete pares estavam
  reprovando: o texto secundário nas paletas claras (3.6–4.0 onde precisa de
  4.5), o acento como texto em Terra e Rosa, e as bordas de componente perto
  de 1.4 onde precisam de 3.0. Corrigido com `--accent-txt` (o acento quando
  é texto) e `--line-2` (borda de componente), sem mudar a cara de nenhuma
  paleta.
- **Retrospectiva** em tela cheia, com tipografia animada palavra a palavra.
- Correção: animação com `fill: forwards` vencia o `transform` inline e
  travava o arrasto — a mesma armadilha que já tinha aparecido no calendário.

## Rodada 6 — navegação em três camadas

- **A barra de baixo virou o que devia ser**: só rotina (Hoje, Mês, Lista,
  Metas). Insights subiu para um botão no topo; Ajustes e o resto foram para
  um menu agrupado (VOCÊ · CADERNO · COFRE).
- **Perfil**: nome, frase e foto, com a foto reduzida a 192px e guardada
  cifrada dentro do cofre. O avatar no topo é a porta de entrada.
- **Voltar de verdade**: a navegação usa o histórico do navegador, então o
  botão físico do Android, o gesto do iOS e o `Esc` funcionam. Telas
  secundárias têm "← voltar".
- Correção: `paint()` não estava repintando a identidade nem rolando ao topo
  antes de medir a dobra — dois `replace` meus não tinham encontrado a
  âncora e falharam em silêncio.

## Rodada 5 — o dia passa a saber o que cobra

- **Cadência por categoria** (todo dia · na semana · quando rolar). O
  progresso do dia só conta o que era obrigatório hoje; o resto aparece como
  extra. Era o furo mais sério que restava: a barra media a coisa errada.
- **Painel de status**: "tudo em ordem" ou "falta marcar X de Y", com botão
  para cada pendência, e o que falta para fechar cada meta da semana. Tudo se
  atualiza na hora da marcação, sem repintar a tela.
- **Tela de Metas**: cadência e meta de todas as categorias juntas, com
  progresso e diagnóstico (*no ritmo*, *apertado*, *estourou*).
- **iPhone**: o topo passou a respeitar a ilha dinâmica e a base a barra de
  gestos (variáveis `--sat`/`--sab`, que o teste consegue simular). Barra
  inferior refeita: ícones de traço, alvo de 48px, pílula no item ativo.
- **Movimento na rolagem**: os cartões entram quando você chega neles, com
  varredura por rolagem (o observador de interseção não dispara em pulo
  rápido) e rede de segurança de 4s — conteúdo invisível é a pior falha
  possível.
- **Tema pixel guardado** em `temas/pixel/`, separado das telas da 2.0, com
  o passo a passo de enxerto no app principal.
- Correção: a tela não se repintava quando os dados mudavam por fora
  (junção da sincronia, outra aba).

## Rodada 4 — o Caderno 2.0

- **Versão pixel em `/retro/`, em paralelo com a clássica.** Mesma origem,
  mesmo cofre: as duas leem os mesmos dados cifrados. Trocar de pele não
  migra nada, e a sincronia é a mesma.
- **Arte original.** Sites de asset estão bloqueados aqui, e sprite de jogo
  alheio é propriedade de quem fez — então desenhei os sprites em matriz de
  caracteres e renderizei em SVG. Vantagem lateral: cada peça herda a paleta
  do mundo escolhido e escala sem borrar.
- **Som sem arquivo.** Osciladores quadrados no WebAudio dão o bipe da época
  pesando zero byte, com interruptor no HUD.
- **A rotina vira fase**: bloco por categoria, moeda ao acertar, bandeira
  para fechar o dia, mapa de sete fases na semana, placar com MUNDO n-1.

## Rodada 3

- **Escalas com régua escrita.** Faixa configurável (0–10, 1–5…) e um texto de
  referência por nível, que aparece embaixo do controle na hora de responder.
  É o que separa "anotei 6" de "sei o que 6 quer dizer". Bebida já nasce
  assim; Maconha virou quantidade com referência por dose.
- **Nível e conquistas.** XP tirado dos dados reais (dia registrado, dia
  fechado, anotação, meta batida, sequência, tarefa feita), oito níveis de
  "Modo caos" a "Lenda doméstica", e conquistas que se adaptam às suas
  categorias. Aviso discreto quando cai uma; tela cheia só quando sobe de
  nível.
- **Correção importante no XP:** metas de abstinência estavam contando como
  batidas em semanas sem nenhum registro — dava centenas de pontos de graça.
  Agora só semana com dia anotado rende meta.

## Rodada 2

- **Banco de dados no repositório.** `dados/caderno.enc.json`, cifrado, escrito
  a cada mudança pela API do GitHub. Cada gravação é um commit — o histórico
  do git virou backup versionado. Também é o que permite celular + computador.
- **Junção item a item** (`js/merge.js`, com testes): quem editou por último
  vence, e apagar deixa lápide pra exclusão não voltar do outro aparelho.
- **Faixa de dias, seletor de data, repetir ontem, aviso de semana em branco.**
- **Grade da semana** — dias × categorias, um toque por célula.
- **Início da semana configurável** (segunda por padrão), valendo pro
  calendário e pras metas semanais.
- **Atalhos do app instalado**: segurar o ícone abre direto o check-in, a
  lista ou a grade da semana.

## Próximos passos, na ordem que eu faria

1. **Perfil que serve pra algo mais.** Hoje ele é identidade e vitrine.
   Podia guardar preferências de leitura (quais insights te interessam) e a
   foto podia virar o ícone do app instalado.
2. **Conquistas secretas e sazonais.** Uma ou outra que só aparece quando cai
   ("domingo de sofá honesto", "semana sem álcool no mês do aniversário").
   Surpresa vale mais que lista visível — mas não abuse, senão vira ruído.
3. **Correlação com defasagem.** O cruzamento atual é do mesmo dia. "Bebida
   ontem × humor hoje" costuma ser bem mais revelador.
4. **Anotação por categoria.** Um campo de contexto no cartão ("por que não
   fui?"), escondido atrás de um toque, sem poluir o check-in.
5. **Vários registros no mesmo dia, com hora.** Abriria análise por horário
   ("bebi 2 às 19h e 1 às 23h"), ao custo de complicar o modelo.
6. **Metas por mês**, pras coisas raras (dentista, corte de cabelo).
7. **Exportar CSV** pra abrir em planilha, além do JSON.
8. **Agenda que fecha o mês.** Do jeito que está, o mês vira a página em
   silêncio. Podia ter o mesmo ritual da semana: quanto você pagou, quanto
   entrou, o que ficou atrasado — e o mês seguinte já com os valores ajustados.
9. **Resolver conflito com aviso.** Hoje a junção é automática e silenciosa
   (o mais novo vence). Num caso raro de edição simultânea nos dois aparelhos
   valeria mostrar o que foi substituído.

Guardadas a seu pedido (as três que não entraram nesta rodada, se um dia
fizerem sentido): **folga programada** — marcar o dia como folga pra não contar
como falha; **retrospectiva em imagem** pra compartilhar; **histórico por
categoria** numa tela só dela.

## Coisas que eu deixei de fora de propósito

- **Login e servidor.** O arquivo no seu repositório resolve persistência sem
  criar conta, sem backend e sem confiar em terceiro nenhum.
- **Gamificação que castiga.** Tem XP e conquista, mas nada de perder pontos,
  ofensiva quebrada com aviso vermelho ou culpa por dia vazio. Punição faz
  mentir no registro, e dado falso não serve pra nada. A régua sobe; ela
  nunca desce sozinha.
- **Gráfico de linha por padrão.** Com 30 pontos ruidosos ele engana mais do
  que explica; barra de frequência e comparação entre períodos são mais
  honestas.
- **Análise "de IA" no app.** As leituras dos Insights são estatística simples
  e transparente, que você pode conferir na mão. Prefiro isso a um texto
  convincente que você não tem como auditar.

## Cuidados

- A senha é a segurança inteira, inclusive do arquivo no repositório. Frase
  longa. Se esquecer, não há recuperação — nem pra você, nem pra ninguém.
- O token de sincronia dá escrita no repositório escolhido. Use *fine-grained*,
  só neste repo, com expiração, e revogue se perder o aparelho.
- Ligar a sincronia é o que tira o "não posso perder isso" das costas do
  navegador. Enquanto ela estiver desligada, limpar os dados do site apaga o
  caderno — o app avisa isso em Ajustes.
- `Bebida` e `Maconha` viram histórico detalhado de uso. Está cifrado, no seu
  repositório e só seu — mas vale saber que existe, e a trava automática
  existe por isso.
