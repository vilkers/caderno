# Caderno

Agenda pessoal de rotina: um app de página única, sem servidor e sem conta, que
roda no GitHub Pages. Você marca o que fez no dia, mantém uma lista de afazeres
e o app lê os seus próprios dados de volta pra você.

Os dados **nunca saem do seu aparelho**: ficam no `localStorage` do navegador,
cifrados com AES-GCM 256 usando uma chave derivada da sua senha (PBKDF2-SHA256,
310 mil iterações). Não existe backend, banco, analytics ou requisição a
terceiros — nem as fontes, que são servidas do próprio repositório.

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
Setas ← → (ou deslizar no celular) trocam de dia; `t` volta pra hoje.

### Mês
A grade do mês com um ponto por categoria feita em cada dia (bolinha = hábito
que você quer manter, quadradinho = hábito que você quer reduzir). Filtrando
por uma categoria, vira mapa de calor com os valores.

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
Paleta (8 opções), categorias (criar, editar, reordenar, arquivar, apagar),
metas, movimento ligado/desligado, trava automática, troca de senha e backup.

## Atalhos (teclado)

`1`–`5` trocam de tela · `←` `→` mudam o dia · `t` volta pra hoje · `l` tranca.

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
- **Backup cifrado (.caderno)** — o mesmo blob, portátil entre aparelhos; abre
  com a mesma senha. É o recomendado.
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
js/analysis.js          sequências, metas, padrões, sugestões
js/ui.js                toast, sheet, scramble, contadores, stagger
js/palettes.js          as 8 paletas
js/utils.js             datas, DOM, formatação
js/views/*.js           as cinco telas
sw.js                   cache offline do casco
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
