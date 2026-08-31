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
