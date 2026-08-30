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

## Publicar

O repositório já vem com o workflow `.github/workflows/pages.yml`.

1. Suba este código para a branch `main`.
2. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. O primeiro deploy roda sozinho no push. A URL sai como
   `https://<seu-usuario>.github.io/caderno/`.

Não há build: é HTML, CSS e módulos ES puros. Dá pra rodar local com qualquer
servidor estático (`python3 -m http.server`, `npx http-server`, etc.).
Abrir o `index.html` direto pelo `file://` **não funciona** — WebCrypto e módulos
ES exigem `https://` ou `localhost`.

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

## Como funciona

### Hoje (check-in)
Um cartão por categoria, cada um com o controle certo pro tipo de dado:

| Tipo | Controle | Serve pra |
|---|---|---|
| Sim / não | botão grande de um toque | academia, louça, lixo |
| Contagem | `−` / `+` com atalhos 0·1·2·3·5 | doses, passeios |
| Horas | slider + passo de 30 min + presets | trabalho, sono |
| Escala 1–5 | cinco alvos lado a lado | humor, energia |
| Texto livre | campo curto | o que não vira número |

Tudo salva no toque — não existe botão "salvar". No fim tem **Fechar o dia**,
que marca o dia como respondido de propósito (diferente de "esqueci").

**Pra preencher dias que passaram**, que é o caso mais comum de esquecimento:
a faixa dos últimos 10 dias no topo (um toque em qualquer um), o seletor de
data ao lado das setas, o botão **repetir ontem** (copia os valores do dia
anterior, com desfazer) e, quando faltam dois ou mais dias na semana, um aviso
que leva direto pra grade da semana. Setas ← → ou deslizar também trocam o dia;
`t` volta pra hoje e `f` fecha o dia.

### Calendário — Semana e Mês
**Semana** é a grade de preenchimento em lote: sete dias nas linhas, categorias
nas colunas. Um toque na célula alterna o valor (sim/não, ou 0→1→2→3 nas
contagens, 1→5 nas escalas); horas e texto abrem o controle cheio; a última
coluna fecha o dia; e tocar no dia abre o check-in completo. É por aqui que se
recupera uma semana inteira em menos de um minuto.

**Mês** é a grade do mês com um ponto por categoria feita em cada dia (bolinha
= hábito que você quer manter, quadradinho = hábito que você quer reduzir).
Filtrando por uma categoria, vira mapa de calor com os valores.

### Lista
Afazeres soltos: escreva e dê Enter. Toque no quadrado pra concluir, na
estrela pra fixar, no texto pra editar no lugar. As abertas aparecem também no
fim do check-in do dia.

### Insights
Números do período (7/30/90 dias), frequência por categoria, sequência atual e
recorde, mapa por dia da semana e leituras em texto: metas da semana, tendência
de 14 dias contra os 14 anteriores, dia da semana fora da curva e cruzamentos
entre categorias ("nos dias com X, Y fica em tanto; sem, em tanto"). Tudo
calculado no seu navegador, em cima dos seus dados.

### Ajustes
Sincronia com o repositório, paleta (8 opções), categorias (criar, editar,
reordenar, arquivar, apagar), metas, início da semana, movimento ligado/
desligado, trava automática, troca de senha e backup.

## Atalhos (teclado)

`1`–`5` trocam de tela · `←` `→` mudam o dia · `t` volta pra hoje ·
`f` fecha/reabre o dia · `l` tranca.

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
js/ui.js                toast, sheet, scramble, contadores, stagger
js/palettes.js          as 8 paletas
js/utils.js             datas, DOM, formatação
js/views/*.js           as cinco telas
sw.js                   cache offline do casco
dados/caderno.enc.json  o banco de dados cifrado (escrito pelo app)
tools/test-merge.mjs    teste da junção — node tools/test-merge.mjs
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
