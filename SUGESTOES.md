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

1. **Lembrete diário.** Notificação local às 21h ("fecha o dia?"). Precisa de
   permissão de notificação + Periodic Background Sync; no iOS só funciona
   com o app instalado na tela de início. É o que mais aumenta constância —
   nenhuma melhoria de tela compete com um empurrão na hora certa. Agora que
   existe XP, o lembrete pode dizer o que você perde se não fechar o dia.
2. **Conquistas secretas e sazonais.** Uma ou outra que só aparece quando cai
   ("domingo de sofá honesto", "semana sem álcool no mês do aniversário").
   Surpresa vale mais que lista visível — mas não abuse, senão vira ruído.
3. **Cor por categoria.** Hoje os pontos do calendário se distinguem por
   posição. Com uma cor por categoria (matiz derivado do acento, pra não
   brigar com as paletas), o mês fica legível de relance.
4. **Correlação com defasagem.** O cruzamento atual é do mesmo dia. "Bebida
   ontem × humor hoje" costuma ser bem mais revelador.
5. **Anotação por categoria.** Um campo de contexto no cartão ("por que não
   fui?"), escondido atrás de um toque, sem poluir o check-in.
6. **Arrastar pra reordenar categorias.** Hoje são setas — funcionam em
   qualquer aparelho, mas arrastar é o gesto que a pessoa tenta primeiro.
7. **Vários registros no mesmo dia, com hora.** Abriria análise por horário
   ("bebi 2 às 19h e 1 às 23h"), ao custo de complicar o modelo.
8. **Metas por mês**, pras coisas raras (dentista, corte de cabelo).
9. **Exportar CSV** pra abrir em planilha, além do JSON.
10. **Resolver conflito com aviso.** Hoje a junção é automática e silenciosa
   (o mais novo vence). Num caso raro de edição simultânea nos dois aparelhos
   valeria mostrar o que foi substituído.

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
