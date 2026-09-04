# Caderno

App pessoal de rotina do Vilker. PWA estático em PT-BR, **sem build**, servido
do próprio repositório pelo GitHub Pages. Módulos ES nativos, uma folha de
estilo, zero dependência em produção.

No ar: https://vilkers.github.io/caderno/

## Como mexer

Não há passo de build — edite e recarregue. Pra ver rodando:

```bash
python3 -m http.server 8899 --bind 127.0.0.1
```

**Antes de qualquer commit, rode a bateria:**

```bash
tools/testar.sh          # node + navegador (~3 min)
tools/testar.sh tudo     # inclui o audit de layout em 360/393/440px (~4 min a mais)
tools/testar.sh dias     # um teste só
```

Precisa de `playwright` (`npm i -g playwright`) — `tools/browser/_comum.mjs`
acha tanto a instalação local quanto a global. `tools/test-*.mjs` são de
lógica pura e rodam sem navegador.

## Regras de trabalho (do dono do app)

- **Desenvolva na branch `claude/daily-routine-tracker-app-qzemob`** e publique
  nela **e** em `main`. Nunca empurre pra outra branch sem pedir.
- **Não abra PR** a menos que ele peça.
- **Não implemente função nova a partir de referências de outros apps de
  rotina sem falar com ele antes.**
- `main` recebe commits do **próprio app** (a sincronia grava
  `dados/caderno.enc.json`). Antes de empurrar, `git fetch` e rebase — são
  sempre só dados, nunca código, então o rebase é limpo.
- O e-mail dele serve só pra identificar autoria. Nunca mande pra serviço
  nenhum.

## Arquitetura

```
index.html               a casca; tudo é montado em JS
js/main.js               roteador, barra de baixo, menu, topo
js/store.js              o modelo (v3) e toda a API de dados
js/analysis.js           dayStatus, sequências, metas, cruzamentos
js/merge.js              junção CRDT-ish entre aparelhos
js/sync.js               GitHub Contents API
js/vault.js              cofre WebCrypto
js/ui.js                 folha (sheet), toast, stagger, fundo vivo, interruptor
js/graficos.js           anel, barras, colunas, malha, trilha (SVG/CSS, sem lib)
js/views/*.js            uma tela por arquivo
css/app.css              a folha única, com os tokens no topo
sw.js                    service worker
```

### Modelo (v3)

Três conceitos, e a fronteira entre eles é o que mais importa preservar:

- **Categoria** (`state.categories`) — uma pergunta que o caderno faz num
  ritmo; vira série histórica. Tem `cadence` (`diaria`/`semanal`/`livre`) e,
  em cadência diária, `dias` — lista de 0 (dom) a 6 (sáb). **`dias` vazio ou
  ausente significa todos os sete.**
- **Tarefa** (`state.todos`) — uma coisa que acaba. Tem no máximo **uma**
  data (`due`) e **nunca** repetição.
- **Compromisso** (`state.agenda`) — uma data do mês que volta sozinha e pode
  carregar dinheiro. Marcação é **por mês** (`marcas[YYYY-MM]`).

Se algo "tem que voltar", ou é ritmo (categoria) ou é dia do mês
(compromisso). Nunca invente um quarto conceito nem um segundo motor de
recorrência dentro de `todos` — a agenda já tem um.

`migrate()` em `store.js` normaliza qualquer documento antigo. Campo novo
entra com padrão que reproduz o comportamento anterior, pra migração ser
nenhuma.

### Invariantes que quebraram antes (não repita)

- **`cache: 'no-store'` em toda chamada à API do GitHub.** As respostas vêm
  com `Cache-Control: private, max-age=60`; sem isso o navegador serve o `sha`
  velho por um minuto e toda gravação no intervalo dá "conflito no
  repositório". O service worker também ignora tudo que é cross-origin.
- **`openSheet` cancela o timer de `closeSheet`.** Fechar marca
  `hidden = true` num `setTimeout` de 300ms; abrir outra folha na sequência
  sem cancelar faz a nova sumir sozinha.
- **Grade: `minmax(0, 1fr)`, nunca `1fr`.** `1fr` é `minmax(auto, 1fr)`, e o
  mínimo automático de uma célula com `min-height` corta a última coluna no
  iPhone. Foi assim que o domingo do calendário sumiu.
- **`el()` filtra `null`, `.append()` não.** `.append(null)` escreve a palavra
  "null" na tela. Use `[...].filter(Boolean)`.
- **Valor em dinheiro é `type=text` + `inputmode=decimal`**, lido por
  `lerValor()`. `type=number` devolve string vazia pra "21,90" e o valor some
  sem avisar.
- **O service worker é network-first pro código** (html/js/css/webmanifest) e
  cache-first pras fontes. Bump `CACHE` em `sw.js` a cada publicação.
- **Alvo de toque de 44px** em tudo. Onde o desenho pede algo menor, cresça a
  área com `::after`/`::before` invisível — `tools/browser/toque.mjs` confere
  tocando 5px fora da borda desenhada.

### Design

Tudo é token, no topo de `css/app.css`. Componente novo **escolhe dentro
deles**, não inventa valor:

- corpo: `--t-micro` (10) … `--t-num` (26); display `--d-lg` (32),
  `--d-xl` (44), `--d-imersivo` (54), com salto em 600px e 900px
- pesos: `--peso-normal/forte/display` (400/600/800)
- espaço: `--s-1` (4px) … `--s-8` (40px), grade de 4px
- raio: `--r-fio`, `--r-ctrl`, `--r-card`, `--r-painel`, `--r-pill`
- hover: `--lift`
- cor: por paleta (8 delas, em `js/palettes.js`), com `--ok` e `--erro`
  próprios. `tools/test-contraste.mjs` reprova paleta fora do WCAG.

Um acento só, e ele significa alguma coisa — não é textura de fundo. Zero é
resposta, não conquista. Um controle por pergunta.

## Onde ler o resto

- `README.md` — o que o app faz e por quê, tela por tela.
- `SUGESTOES.md` — o histórico de decisões por rodada, o que ficou de fora de
  propósito, e a lista do que eu faria em seguida.

## Pendência conhecida

`currentStreak` anda dia a dia, então categoria com `dias` (terapia toda
terça) nunca passa de sequência 1. O conserto é contar por ocorrência — e
fazer os dias certos aparecerem na grade da Semana e em Metas. Está anotado
como item 10 em `SUGESTOES.md`.
