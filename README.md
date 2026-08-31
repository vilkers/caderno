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

**Mês** é a grade do mês com um ponto por categoria feita em cada dia (bolinha
= hábito que você quer manter, quadradinho = hábito que você quer reduzir).
Filtrando por uma categoria, vira mapa de calor com os valores.

### Lista
Afazeres soltos: escreva e dê Enter. Toque no quadrado pra concluir, no texto
pra editar no lugar, e **arraste pelo punho (⠿) pra ordenar** — quem prefere
teclado usa ↑ ↓ com o punho focado. A ordem que você deixar é a que fica; a
estrela virou destaque, não muda mais o lugar. As abertas aparecem também no
fim do check-in do dia. As categorias em Ajustes se reordenam do mesmo jeito.

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

- **Embaixo, a rotina** — Hoje, Mês, Lista, Metas. O que se toca todo dia.
- **No topo, você e a leitura** — o avatar abre o **Perfil**, e ao lado ficam
  o estado da sincronia, o atalho de **Insights** e o **menu**.
- **No menu, a configuração** — Perfil, Insights, Metas, Ajustes, Paleta,
  Caderno 2.0 e Trancar, agrupados por assunto.

As telas secundárias trazem **← voltar**, e a navegação usa o histórico do
navegador: o botão físico de voltar do Android (e o gesto do iOS) funciona,
assim como `Esc` no teclado.

### Retrospectiva
Uma tela por vez, tipografia grande entrando palavra a palavra e o número
subindo: dias em que você apareceu, maior sequência, o que mais fez, seu dia
da semana, horas somadas, dias limpos, tarefas riscadas e onde você está na
régua. Toque na direita avança, na esquerda volta; setas e deslizar também.
Cartão sem dado não entra — retrospectiva com zero em tudo é constrangedora.
Fica em **Perfil → Retrospectiva** ou no menu.

### Perfil
Nome, uma frase sua e foto — reduzida a 192px e guardada **dentro do cofre**,
cifrada como o resto e viajando na sincronia junto. Sem foto, o avatar mostra
as suas iniciais. Do lado, o que o caderno sabe: dias registrados, sequência,
nível e conquistas.

### Ajustes
Sincronia com o repositório, paleta (8 opções), categorias (criar, editar,
reordenar, arquivar, apagar), metas, início da semana, movimento ligado/
desligado, trava automática, troca de senha e backup.

## Atalhos (teclado)

`1`–`7` trocam de tela · `←` `→` mudam o dia · `t` volta pra hoje ·
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
tools/test-merge.mjs    teste da junção — node tools/test-merge.mjs
tools/test-contraste.mjs contraste WCAG de todas as paletas
```

## Design

Referência: espécimes de fundição tipográfica — grotesca comprimida em corpo
grande, micro-labels em mono caixa-alta com tracking aberto, fios de 1px
desenhando a grade, monocromo com um acento só, e movimento em curva
exponencial (`cubic-bezier(.16,1,.3,1)`): entradas em cascata, wipe de
`clip-path` na troca de tela, contadores que sobem, texto que embaralha.
Tudo respeita `prefers-reduced-motion` e o interruptor de movimento.

Tipos: **Archivo** (variável, 62–125% de largura) e **JetBrains Mono**, ambas
OFL, servidas localmente (`assets/fonts/`).
