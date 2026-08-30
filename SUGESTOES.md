# Sugestões pro Caderno

Decisões que já estão no app e o que eu faria em seguida. Em ordem de
quanto muda a sua vida por unidade de trabalho.

## Por que a entrada de dados é assim

- **Um controle por natureza do dado.** Botão de um toque pro que é sim/não,
  stepper pro que é contagem, slider com passo de 30 min pra duração, cinco
  alvos pra escala. Campo de texto só onde número não serve — texto é o
  formato que mais gente abandona depois de duas semanas.
- **Salva no toque, sem botão de salvar.** O custo de registrar precisa ser
  menor que o de lembrar. O "Fechar o dia" existe só pra separar *não fiz* de
  *esqueci de anotar* — sem isso, todo dado ausente vira ambíguo e as médias
  mentem.
- **Atalhos numéricos nas contagens** (0·1·2·3·5): a maioria dos dias cabe num
  toque, e o `+`/`−` fica pro resto.
- **Zero é ausência.** Valor zero apaga o registro daquela categoria no dia,
  então o arquivo não incha e "dia registrado" continua significando algo.
- **Metas dentro do check-in.** O `2/4·sem` ao lado da categoria transforma o
  registro em decisão ("ainda dá pra hoje") em vez de só arquivo morto.

## Próximos passos, na ordem que eu faria

1. **Lembrete diário.** Notificação local às 21h ("fecha o dia?"). Precisa de
   permissão de notificação + Periodic Background Sync; no iOS só funciona
   com o app instalado na tela de início. É o que mais aumenta constância.
2. **Categorias com múltiplos registros no dia** (hora do evento). Hoje o
   modelo é um valor por dia — o suficiente pra tudo que você listou, mas
   "bebi 2 às 19h e 1 às 23h" abriria análises de horário.
3. **Anotação por categoria.** Um campo de contexto no cartão ("por que não
   fui?"), escondido atrás de um toque, sem poluir o check-in.
4. **Semana em uma tela.** Uma vista de 7 dias × categorias, tipo planilha,
   pra preencher dias esquecidos em lote. É onde o app perde gente: voltou de
   viagem, tem 5 dias em branco, desiste.
5. **Sincronizar entre aparelhos sem servidor.** Exportar/importar já resolve
   o essencial; o passo seguinte honesto seria um arquivo cifrado num
   Drive/Dropbox escolhido por você, com o app só lendo e gravando o blob.
   Qualquer solução "de verdade" exige backend — e aí acaba a promessa de que
   nada sai daqui.
6. **Correlação com atraso.** Hoje o cruzamento é do mesmo dia. Comparar
   "bebida ontem × humor hoje" costuma ser mais revelador.
7. **Metas por mês** além de dia/semana, pras coisas raras (dentista, corte
   de cabelo).
8. **Cor por categoria.** Os pontos do calendário hoje se distinguem por
   posição; cor tornaria o mês legível de relance, ao custo de brigar com as
   paletas — daria pra resolver com matiz derivado do acento.

## Coisas que eu deixei de fora de propósito

- **Login e nuvem.** Mataria o argumento inteiro do app.
- **Gamificação pesada** (pontos, medalhas, ofensiva com fogo). Sequência e
  recorde bastam; o resto vira dívida emocional e faz mentir no registro.
- **Gráfico de linha por padrão.** Com 30 pontos ruidosos ele engana mais do
  que explica; barra de frequência e comparação entre períodos são mais
  honestas.
- **Análise "de IA" no app.** As leituras dos Insights são estatística simples
  e transparente, que você pode conferir na mão. Prefiro isso a um texto
  convincente que você não tem como auditar.

## Cuidados

- A senha é a segurança inteira. Frase longa, e um backup cifrado guardado
  fora do aparelho.
- Limpar dados do site no navegador apaga o cofre. Instalado na tela de início
  o risco é menor, mas backup ainda é backup.
- `Bebida` e `Maconha` viram histórico detalhado de uso. Está cifrado e é só
  seu — mas vale saber que existe, e a trava automática existe por isso.
