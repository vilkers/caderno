# Caderno

Agenda pessoal de rotina: um app de página única, sem servidor e sem conta, que
roda no GitHub Pages. Você marca o que fez no dia, mantém uma lista de afazeres
e o app lê os seus próprios dados de volta pra você.

Os dados ficam no `localStorage` do navegador, cifrados com AES-GCM 256 usando
uma chave derivada da sua senha (PBKDF2-SHA256, 310 mil iterações) — e, se você
ligar a sincronia, também num arquivo cifrado dentro do próprio repositório
(`dados/caderno.enc.json`), que é o banco de dados do app. Não existe backend,
analytics ou requisição a terceiros — nem as fontes, que são servidas daqui.

---

## No ar

**https://vilkers.github.io/caderno/**

O Pages serve a branch `gh-pages`, e o workflow
`.github/workflows/pages.yml` espelha `main` nela a cada push — então
publicar é só dar push na `main`. Não há build: é HTML, CSS e módulos ES
puros.

> Por que `gh-pages` e não "Source: GitHub Actions"? Porque o token do
> Actions não pode criar o site do Pages pela API
> (`Resource not accessible by integration`), enquanto uma branch
> `gh-pages` liga o Pages sozinha. Se um dia você trocar a fonte para
> GitHub Actions nas configurações, troque o workflow pelo par
> `upload-pages-artifact` + `deploy-pages`.

Pra rodar local, qualquer servidor estático serve
(`python3 -m http.server`, `npx http-server`). Abrir o `index.html` direto
pelo `file://` **não funciona** — WebCrypto e módulos ES exigem `https://`
ou `localhost`.

### O repositório é público

De propósito, e sem exposição: o arquivo de dados é ciphertext AES-GCM e o
token de sincronia nunca sai do seu navegador. O que fica visível é o código
e os nomes das categorias padrão.

## Instalar no celular

Abra a URL no navegador e use "Adicionar à tela de início". Vira um app
independente (PWA), com ícone próprio, e funciona offline — inclusive o
service worker guarda o casco do app pra abrir sem internet.

## Banco de dados no repositório

O navegador é um lugar frágil pra guardar coisa que importa: limpar dados do
site apaga tudo. Por isso o app grava o caderno num arquivo do seu próprio
repositório e o lê de volta ao destrancar.

- **O arquivo:** `dados/caderno.enc.json`. É o mesmo cofre AES-GCM do
  navegador. Cifrado, então o repositório pode ser público — ninguém lê nada
  sem a sua senha. Detalhes em [`dados/README.md`](dados/README.md).
- **Cada sincronia é um commit.** O histórico do git vira o seu backup
  versionado: `git log dados/` mostra tudo e dá pra voltar qualquer versão.
- **Serve pra usar em mais de um aparelho.** Celular e computador leem e
  escrevem o mesmo arquivo, com a mesma senha.

### Ligar (uma vez)

1. Crie um token em **github.com/settings/personal-access-tokens** →
   *Fine-grained* → **Only select repositories: caderno** → Permissions →
   **Contents: Read and write**. Ponha uma data de expiração.
2. No app: **Ajustes → Sincronia → ligar sincronia**, preencha usuário,
   repositório e cole o token. O botão *testar* confere antes de salvar.

O token fica cifrado junto com os seus dados (não vai para o arquivo do
repositório). Se perder o aparelho, revogue o token no GitHub.

### Como dois aparelhos convivem

Cada dia, tarefa e categoria carrega um `updatedAt`. Ao sincronizar, o app
puxa o arquivo, junta item a item mantendo sempre a versão editada por último,
e grava de volta. Apagar deixa uma lápide (`deletedAt`), pra que uma exclusão
feita no celular não seja ressuscitada pelo computador. A lógica está em
`js/merge.js` e tem teste: `node tools/test-merge.mjs`.

O indicador no topo mostra o estado: **sincronizado**, **pendente**
(alterações locais aguardando), **sincronizando** ou **erro** (clique para
tentar de novo). A sincronia automática dispara ~6s depois da última mudança,
ao trancar e ao sair da aba.

> Trocou a senha? Sincronize logo em seguida — o arquivo passa a exigir a nova.

**Quando dá conflito.** A API de conteúdo do GitHub é consistente com atraso:
logo depois de gravar, a leitura pode devolver o identificador antigo do
arquivo, e a gravação seguinte bate de frente. O app puxa de novo, junta e
tenta outra vez — até três rodadas, esperando um pouco mais a cada uma. Se
mesmo assim não passar, ele diz isso e não perde nada: os dados continuam
cifrados no aparelho, e basta tocar em sincronizar de novo.

E quando não há nada de diferente entre o aparelho e o repositório, ele **não
grava**: sem commit vazio, e sem o vaivém em que cada junção agendava a
próxima sincronia sem mudança nenhuma.

## Primeiro uso

Na primeira abertura o app pede uma senha nova (e a confirmação). Ela cria o
cofre. **Não existe recuperação**: sem a senha, os dados cifrados são ruído.
Faça um backup em Ajustes → Dados.

---

## Duas peles, um cofre

- **Clássico** — https://vilkers.github.io/caderno/
- **Caderno 2.0 (pixel)** — https://vilkers.github.io/caderno/retro/

As duas versões rodam na mesma origem, então leem e escrevem **o mesmo cofre
cifrado**: mesma senha, mesmos dias, mesmas categorias, mesma sincronia. Dá
para preencher a semana no clássico e conferir os troféus na 2.0 sem migrar
nada. O núcleo (`js/store.js`, `vault`, `sync`, `analysis`, `badges`) é
compartilhado; `retro/` só troca a interface.

Na 2.0 a rotina vira fase: cada categoria é um bloco que você bate (sim/não
resolve num toque e cospe moeda; contagem, horas, escala e texto abrem a
caixa de diálogo), a bandeira fecha o dia, a semana é um mapa de sete fases,
e o placar mostra pontos, MUNDO n-1 e a vitrine de troféus. Cinco mundos
(paletas), bipes sintetizados em WebAudio com interruptor no HUD, e sprites
originais desenhados em matriz de caracteres — nada de arte de terceiros.

## Como funciona

### Status do dia — a resposta pra "tá tudo em ordem?"
No topo do check-in, um painel diz em uma frase: **Tudo em ordem** ou
**Falta marcar 2 de 4**, com um botão por categoria em falta (toca e ele te
leva até o cartão, piscando). Logo abaixo, **para fechar a semana**: quanto
falta em cada meta semanal e em quantos dias. Os dois se atualizam na hora
em que você marca, sem trocar de tela.

O que entra nessa conta é a **cadência** de cada categoria:

| cadência | o que significa | exemplos |
|---|---|---|
| **Todo dia** | entra na conta do dia; falta se não for marcada | remédio, sono, trabalho |
| **Na semana** | cobrada pela meta da semana, não por dia | academia, louça, lixo |
| **Quando rolar** | registra quando acontece e não cobra nada | bebida, humor |

Sem isso o progresso mentia: marcar 4 de 9 num dia em que só 3 coisas eram
obrigatórias parecia fracasso, e não era.

**Todo dia, mas nem todo dia.** Uma categoria diária pode escolher *em que
dias da semana* ela cobra — terapia toda terça, feira no sábado. São sete
chaves no editor, todas ligadas por padrão (que é como o app sempre
funcionou, e por isso não há nada a migrar). Na segunda, terapia sai da conta
do dia e o cartão fica apagado na lista com `TER` escrito ao lado; na terça
ela entra no "falta marcar 5 de 5". O cartão **continua marcável fora do dia
dela** — consulta remarcada é consulta —, e nesse caso conta como extra, sem
mexer no denominador.

### Metas (uma tela só)
Ajustar nove metas entrando em nove categorias é trabalho demais para uma
decisão que se toma junta. Em **Metas** está tudo lado a lado — cadência,
mínimo ou máximo, valor e período —, com o progresso da semana e o estado
(*no ritmo*, *apertado*, *estourou*, *batida*) ao lado de cada uma.

### Hoje (check-in)
Um cartão por categoria, cada um com o controle certo pro tipo de dado:

| Tipo | Controle | Serve pra |
|---|---|---|
| Sim / não | botão grande de um toque | academia, louça, lixo |
| Contagem | `−` / `+` com atalhos 0·1·2·3·5 | passeios, vezes |
| Horas | slider + passo de 30 min + presets | trabalho, sono |
| Escala | faixa configurável (1–5, 0–10…) com **referência escrita em cada nível** | bebida, humor |
| Texto livre | campo curto | o que não vira número |

**Escalas com referência** são o que faz um "5" querer dizer alguma coisa. A
Bebida já vem 0–10 com a régua escrita — *0 seco · 1 uma no almoço ·
5 bebedeira média · 8 apagando · 10 ressaca de dois dias* — e o texto do nível
escolhido aparece embaixo do controle na hora do check-in, com um "ver
referências" que abre a régua inteira. Tudo editável em Ajustes → Categorias:
você define a faixa e escreve o que cada número significa pra você. Em escalas
que começam no zero, o zero é resposta ("seco"), não ausência.

Tudo salva no toque — não existe botão "salvar". No fim tem **Fechar o dia**,
que marca o dia como respondido de propósito (diferente de "esqueci").

**Pra preencher dias que passaram**, que é o caso mais comum de esquecimento:
a faixa dos últimos 10 dias no topo (um toque em qualquer um), o seletor de
data ao lado das setas, o botão **repetir ontem** (copia os valores do dia
anterior, com desfazer) e, quando faltam dois ou mais dias na semana, um aviso
que leva direto pra grade da semana. Setas ← → ou deslizar também trocam o dia;
`t` volta pra hoje e `f` fecha o dia.

### Calendário — Semana e Mês
**Semana** é a grade de preenchimento em lote: os sete dias em colunas fixas no
topo, uma faixa por categoria descendo a tela. Um toque na célula alterna o
valor (sim/não, ou 0→1→2→3 nas contagens, 1→5 nas escalas); horas, texto e
escala longa abrem o controle cheio; a última faixa fecha o dia; e tocar no dia
lá em cima abre o check-in completo. Rola só na vertical, e a troca de semana é
por botão — nada de gesto lateral. É por aqui que se recupera uma semana
inteira em menos de um minuto.

**Mês** deixou de ser um campo de bolinhas iguais. Cada dia carrega quatro
informações, cada uma com uma forma própria e um canto próprio:

- **anel** em volta do número — quanto do que era obrigatório naquele dia foi
  fechado (é a cobrança do dia, do vazio ao anel inteiro);
- **barra embaixo** — quantas marcações o dia teve, comparado com o resto do
  mês: lado a lado, os dias viram um gráfico de barras da sua constância;
- **pílula no canto direito** — tinha compromisso do mês caindo ali (conta,
  cartão, NF); fica apagada quando você já resolveu;
- **quadradinho vazado no canto esquerdo** — tinha tarefa marcada pra esse dia.
  A forma não é arbitrária: no app, quadrado já é tarefa e círculo já é
  compromisso.

Tocar num dia abre uma **prévia**: o que foi marcado, o que faltou, a anotação,
o que cai naquele dia — compromissos e tarefas, com um toque pra resolver — e
os botões de fechar ou abrir o dia, em vez de sair do calendário no primeiro
toque.

E dá pra **criar ali mesmo**: quatro portas (`📌 evento`, `💸 conta`,
`💰 entrada`, `✓ tarefa`) que já sabem o dia. Tarefa não abre formulário
nenhum — o campo abre dentro da prévia, dois toques. As outras três abrem o
editor de compromisso **encolhido**: o botão que você apertou *era* a pergunta
"que tipo é", então some o seletor de tipo, some a repetição (é único por
definição, com um chip opcional pra virar mensal) e evento nem pergunta valor.
Um formulário de quatro perguntas vira um de uma. Embaixo, dias
registrados semana a semana e o anel do mês. Filtrando por uma categoria, tudo
isso dá lugar ao mapa de calor dela, com a linha do mês.

### Contas do mês (aba de Pessoal)
O que não é rotina mas volta todo mês num dia certo: aluguel, cartões (Nubank,
Itaú, BTG…), contas de casa, a NF da agência — e também os eventos que
acontecem uma vez só. Cada item tem dia do mês, valor opcional e um toque pra
marcar como resolvido; **a marcação vale por mês**, então em setembro tudo
volta em aberto sozinho.

A tela mostra o mês inteiro em ordem de dia, quanto já foi resolvido, quanto
sai e quanto entra, e o que passou do dia. Dá pra criar e editar ali mesmo, e
**a lista completa mora ali também** — ao pé da aba, "todos os compromissos",
que é a única porta pros pausados e pros únicos de outros meses, e onde se
pausa um item sem apagar o histórico. Tem sugestões prontas pra montar em
alguns toques; os dias vêm de exemplo e você ajusta pro seu vencimento.

Isso saiu de Ajustes de propósito: **Ajustes guarda configuração** — o que o
app te pergunta todo dia —, e compromisso é *conteúdo*, um item com data e
valor que nasce e morre. Ele passou a morar junto do dinheiro, que é onde
você olha pra ele.

Os compromissos do dia aparecem no check-in numa faixa própria, e no
calendário como uma marca no canto do dia. Eles **não entram no progresso da
rotina** de propósito: pagar o aluguel não é hábito, e misturar as duas coisas
faria a barra do dia mentir.

### Pessoal — afazeres, contas, assinaturas e carteira
Quatro coisas que não são rotina mas ocupam a mesma cabeça. As três de
dinheiro andam pelo tempo: dá pra ver o mês passado e o que vem.

**Afazeres.** A lista de sempre, integrada ao app inteiro: escreva e dê Enter. Toque no quadrado pra concluir, no texto
pra editar no lugar, e **arraste pelo punho (⠿) pra ordenar** — quem prefere
teclado usa ↑ ↓ com o punho focado. A ordem que você deixar é a que fica; a
estrela virou destaque, não muda mais o lugar. As abertas aparecem também no
fim do check-in do dia. As categorias em Ajustes se reordenam do mesmo jeito.

Cada tarefa pode ganhar **um dia pra ser feita** — uma data só, nunca
repetição: se tem que voltar, ou é ritmo (categoria) ou é dia do mês
(compromisso), e é essa linha que impede um quarto tipo de coisa nascer.
Quando tem data, ela ocupa o lugar do ícone na linha (`hoje`, `amanhã`,
`14/09`), a tarefa sobe na lista quando o dia chega, aparece no calendário do
mês como um quadradinho vazado e encabeça o "na lista hoje" do check-in — com
`ERA PRA ONTEM` em vermelho quando passou. **Não entra no progresso da
rotina**: tarefa se empurra pra frente por definição, e ser cobrado por
"comprar ração" treinaria você a ignorar o painel do dia.

**Assinaturas.** Só o que debita sozinho todo mês: Spotify, Google, Netflix,
academia. A tela existe pra uma pergunta — quanto some da conta sem você fazer
nada — então mostra o total por mês e por ano, com as maiores em barras. As
sugestões aqui são só de assinatura; aluguel e cartão são de outra tela. Elas
não entram na lista de afazeres da Agenda (não há o que fazer), mas contam no
dinheiro do mês.

**Carteira.** O dinheiro do mês nas duas direções: **a receber** (pagamento,
freela) e **a pagar** (o que você deve, mais tudo que já está na agenda e nas
assinaturas). No topo, a sobra prevista — ou o quanto falta pra fechar o mês.
Marque quando cair e quando quitar. Item sem valor também aparece: é tocando
nele que você completa.

Assinaturas e carteira são gestão pessoal e ficam **fora do XP e das metas** de
propósito: dinheiro não é hábito, e transformar conta em pontuação faria de uma
coisa chata uma coisa chata e barulhenta.

### Nível e conquistas
Um contador de XP tirado dos próprios dados — dia registrado, dia fechado,
anotação escrita, meta batida, sequência mantida, tarefa concluída — e oito
níveis, de **Modo caos** a **Lenda doméstica**, passando por **Menos fudido**.
As conquistas nascem em parte das *suas* categorias (se você criar "Corrida",
aparecem as conquistas de sequência dela) e ficam em Insights, com o quanto
falta pra cada uma. Conquista nova dá um aviso discreto no rodapé; subir de
nível abre a tela, porque é raro. Nada disso invented: apague um dia e o XP
cai junto.

### Insights
Números do período (7/30/90 dias), frequência por categoria, sequência atual e
recorde, mapa por dia da semana e leituras em texto: metas da semana, tendência
de 14 dias contra os 14 anteriores, dia da semana fora da curva e cruzamentos
entre categorias ("nos dias com X, Y fica em tanto; sem, em tanto"). Tudo
calculado no seu navegador, em cima dos seus dados.

### Navegação
Três camadas, para a barra de baixo não virar depósito:

- **Embaixo, a rotina** — Hoje, Mês, Pessoal, Padrões. O que se toca todo dia.
  Metas saiu daqui: meta se ajusta uma vez por semana, e já se ajusta dentro da
  Revisão, com − e + ao lado do resultado.
- **No topo, você e a leitura** — o avatar abre o **Perfil**, e ao lado ficam
  o estado da sincronia, o atalho de **Insights** e o **menu**.
- **No menu, só o que não tem outra porta** — Retrospectiva, Revisão da semana,
  Metas, Ajustes, Paleta, Sincronizar e Trancar. Uma linha por item, sem
  descrição.

**Em tela secundária a barra de cima muda de papel**: em vez de "quem sou eu",
ela responde "onde estou e como saio" — a foto dá lugar a uma seta de voltar e
o nome, ao nome da tela. Como ela é fixa, a saída não some quando você rola (a
tela de Ajustes tem quase quatro telas de altura). A navegação usa o histórico
do navegador, então o botão físico do Android, o gesto do iOS e o `Esc`
funcionam do mesmo jeito.

### Revisão da semana
Segunda de manhã, o Hoje mostra uma faixa: *a semana passada acabou*. A revisão
abre já na semana que terminou (não na que mal começou) e mostra o placar — dias registrados, metas batidas, comparação com a semana
anterior — e vai meta por meta dizendo quanto foi e quanto era pra ser. Onde a
meta apertou ou sobrou, dá pra **corrigir o número ali mesmo**, com `−` e `+`,
sem entrar em cada categoria. Escreve uma linha sobre a semana, fecha, e ela
fica gravada. Se quiser mexer depois, reabre.

### Lembrete do dia
Um aviso por dia, no horário que você escolher, **e só se ainda faltar
marcação** — dia fechado não incomoda ninguém. Em *Dizer o que falta* o aviso
mostra os nomes ("falta: remédio, sono"); desligado, só o número.

Sem servidor não existe alarme garantido, então são três camadas, da mais
frágil pra mais confiável: o **Periodic Background Sync** (o navegador acorda o
app sozinho — Android, app instalado), o **relógio dentro da página** (vale
enquanto o app estiver aberto ou em segundo plano) e o **selo no ícone** mais o
aviso ao abrir, que funcionam em todo lugar, iPhone incluído. Ajustes explica
isso na própria tela, sem prometer o que não dá.

O worker que dispara o aviso **não abre o cofre** — ele lê uma gaveta separada
(`js/idb.js`) com o número de pendências e, se você pedir, os nomes das
categorias. Nenhum valor marcado sai de lá.

### Retrospectiva
Uma tela por vez, tipografia grande entrando palavra a palavra, número subindo
— e agora **um gráfico por cartão**, entrando depois do texto, como quem
completa a frase:

- a capa é a **malha de todos os dias** do período, um quadradinho cada,
  acendendo em cascata;
- "você apareceu" ganha o **anel** da sua taxa de presença;
- a sequência vira uma **corrente de elos** que acende em fila;
- "o que você mais fez" vira **barras** comparando as cinco primeiras;
- o dia da semana vira **colunas**, com o seu dia destacado;
- dias limpos são outra **malha**, só dos dias registrados;
- assinaturas viram **barras** por valor, e o mês da agenda vira **anel**;
- o nível vira a **escada dos oito degraus**, com você em um deles e a barra do
  quanto falta pro próximo;
- o fecho traz um **placar** com os quatro números do período.

Toque na direita avança, na esquerda volta; setas e deslizar também. Cartão sem
dado não entra — retrospectiva com zero em tudo é constrangedora. Fica em
**Perfil → Retrospectiva** ou no menu.

### Perfil
Nome, uma frase sua e foto — reduzida a 192px e guardada **dentro do cofre**,
cifrada como o resto e viajando na sincronia junto. Sem foto, o avatar mostra
as suas iniciais. Do lado, o que o caderno sabe: dias registrados, sequência,
nível e conquistas.

### Ajustes
Sincronia com o repositório, paleta (8 opções), categorias (criar, editar,
reordenar, arquivar, apagar, **escolher os dias da semana**), metas,
**lembrete do dia**, início da semana,
movimento ligado/desligado, trava automática, troca de senha e backup.

## Atalhos (teclado)

`1`–`9` e `0` trocam de tela · `←` `→` mudam o dia · `t` volta pra hoje ·
`f` fecha/reabre o dia · `l` tranca · `Esc` volta.

Ações destrutivas (apagar tarefa, apagar categoria, limpar concluídas,
repetir ontem) aparecem no rodapé com **desfazer**.

---

## Segurança — o que a senha faz e o que ela não faz

**Protege:** o conteúdo do caderno neste navegador. Quem abrir o app, o
DevTools ou copiar o `localStorage` vê só o blob cifrado. A cifra é feita com
WebCrypto do próprio navegador.

**Não protege contra:** um aparelho comprometido (keylogger, malware) e senhas
fracas — a segurança inteira depende da senha, então use uma frase longa.
O código do app é público (é um site estático no GitHub); o que é privado são
os seus dados, que nunca saem daqui. Se o repositório for público, ninguém vê
nada do que você registrou — só o código.

**Nota honesta:** um app estático não tem como impedir que alguém com acesso
físico ao aparelho desbloqueado leia a tela. A trava automática (Ajustes →
Preferências) reduz isso.

### Backup
- **O repositório** — com a sincronia ligada, cada mudança vira commit. É o
  backup mais completo, porque tem histórico.
- **Backup cifrado (.caderno)** — o mesmo blob, portátil entre aparelhos; abre
  com a mesma senha. Bom pra guardar fora do GitHub.
- **JSON** — legível, sem senha. Bom pra migrar ou analisar em outro lugar;
  guarde com cuidado, porque é texto puro.

Trocar de aparelho: baixe o backup cifrado, abra o app no aparelho novo e use
Ajustes → Dados → Importar.

---

## Estrutura

```
index.html              casco do app, tela de senha e chrome
css/app.css             design system inteiro (tokens, componentes, motion)
css/fonts.css           @font-face das fontes locais
js/main.js              arranque, roteador, trava automática, atalhos
js/store.js             estado, categorias padrão, persistência
js/vault.js             PBKDF2 + AES-GCM (o cofre)
js/sync.js              grava e lê o arquivo do repositório (API do GitHub)
js/merge.js             junta dois cadernos item a item (funções puras)
js/analysis.js          sequências, metas, padrões, sugestões
js/badges.js            XP, níveis e conquistas
js/ui.js                toast, sheet, scramble, contadores, stagger
js/palettes.js          as 8 paletas
js/utils.js             datas, DOM, formatação
js/views/*.js           as sete telas
js/avatar.js            avatar e redução da foto de perfil
js/icons.js             o traço da interface (24×24, sem preenchimento)
temas/                  peles guardadas para enxertar no app (ver temas/README.md)
dados/backups/          cópias congeladas do cofre
sw.js                   cache offline do casco
retro/                  o Caderno 2.0 — casco, pele e telas em pixel
retro/js/sprites.js     a arte, em matrizes de caracteres viradas em SVG
retro/js/sfx.js         os bipes, sintetizados em WebAudio
tools/test-sprites.mjs  confere se todo sprite fecha retangular
dados/caderno.enc.json  o banco de dados cifrado (escrito pelo app)
js/arrastar.js          ordenar lista arrastando (Pointer Events + teclado)
js/resumo.js            o cálculo da retrospectiva
js/lembrete.js          o aviso do fim do dia (permissão, horário, selo)
js/idb.js               a gaveta em claro que o worker lê (só contagem)
js/views/revisao.js     o ritual de fechar a semana
js/graficos.js          anéis, barras, colunas, malhas e trilhas (sem lib)
js/views/agenda.js      o mês pontual: contas, cartões, NF, eventos
js/views/agendaform.js  a caixa que cria e edita um compromisso
tools/test-agenda.mjs   calendário e dinheiro do mês — node tools/test-agenda.mjs
tools/test-dias.mjs     cadência por dia da semana e tarefa com data
tools/test-merge.mjs    teste da junção — node tools/test-merge.mjs
tools/test-contraste.mjs contraste WCAG de todas as paletas
```

## Design

**Um acento só, e ele significa alguma coisa.** O laranja marca o que você
escolheu e o que está em primeiro lugar — não é textura de fundo. Barra de
frequência: só a maior é acentuada, o resto lê pela largura. Zero é resposta,
não conquista: escolher "0 doses" não pinta o pixel mais saturado da tela.
Verde e vermelho existem (`--ok`, `--erro`), são por paleta e passam no teste de
contraste — um verde fixo some numa paleta clara.

**Duas famílias, nove degraus, três pesos.** A grotesca pro que se lê, a mono
pro que se mede — isso sempre foi assim. O que tinha escapado era a escala:
17 tamanhos e 6 pesos, escolhidos um a um dentro de cada componente, o que dá
a impressão de muita fonte diferente sem haver nenhuma a mais. Agora são
tokens — `--t-micro` (10) a `--t-num` (26) pro texto, `--d-lg` (32),
`--d-xl` (44) e `--d-imersivo` (54) pro display — e componente novo escolhe
dentro deles. No telefone os degraus são fixos e sobem em duas larguras
declaradas (600px e 900px): os `clamp()` que havia ali nunca saíam do mínimo
dentro da faixa de telefone — `6vw` só cruza `2rem` aos 533px de tela —, então
eram fluidez decorativa, um valor fixo fingindo não ser. E os dois degraus
que colidiam (27,2 contra 26; 22,4 contra 21) viraram um só: quando a
diferença é de 1px, não é degrau, é ruído.

**Espaço e raio também são tokens.** Eram 25 valores de `gap`, 30 de `padding`
e 12 raios de canto — vizinhos indistinguíveis (`.5` e `.55rem`, `.7` e `.75`
e `.8rem`) escolhidos um a um. O espaço encostou numa grade de 4px
(`--s-1` a `--s-8`, de 4 a 40px) e o raio passou a contar *o que a coisa é*:
`--r-fio` (trilho, barrinha), `--r-ctrl` (campo, botão de ícone),
`--r-card` (caixa com conteúdo), `--r-painel` (a moldura grande) e
`--r-pill`. O levantar do hover, que tinha três valores (−1, −2, −3px),
virou `--lift`.

**Um controle por pergunta.** O check-in empilhava três instrumentos pra uma
pergunta só: Sono tinha passo, régua *e* chips; Maconha tinha passo e chips.
Agora horas é a régua com o número lido grande em cima, contagem é o passo, e
a escala de 0 a 10 virou um **medidor** — colunas que enchem até onde você
tocou, sem dígito dentro. Onze botõezinhos numerados liam como teclado
numérico, e ninguém digita o humor. Uma forma só pra "sim", também: o
interruptor da casa substituiu os dois `<input type=checkbox>` nativos que
tinham sobrado (Metas e o editor de categoria) — eram o único componente sem
desenho no app.

**Fundo vivo.** Três manchas da paleta presas à tela: no topo manda a de cima e,
conforme a página rola, ela sobe e cede lugar à de baixo. Trocar de paleta troca
o fundo junto. Custa uma variável CSS por quadro — o resto é `transform` e
`opacity`. Com o movimento desligado (ou com `prefers-reduced-motion`), ele fica
parado. A opacidade das manchas é limitada pelo teste de contraste: o texto
continua legível por cima da mais forte, nas oito paletas.

**Alvo de toque de 44px** em tudo que se toca. Onde o desenho pede um controle
pequeno — o check da agenda, a caixa da tarefa, a estrela, o interruptor —, a
área de toque cresce por baixo num pseudo-elemento invisível.

Referência: espécimes de fundição tipográfica — grotesca comprimida em corpo
grande, micro-labels em mono caixa-alta com tracking aberto, fios de 1px
desenhando a grade, monocromo com um acento só, e movimento em curva
exponencial (`cubic-bezier(.16,1,.3,1)`): entradas em cascata, wipe de
`clip-path` na troca de tela, contadores que sobem, texto que embaralha.
Tudo respeita `prefers-reduced-motion` e o interruptor de movimento.

Tipos: **Archivo** (variável, 62–125% de largura) e **JetBrains Mono**, ambas
OFL, servidas localmente (`assets/fonts/`).
