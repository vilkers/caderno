# dados/

Aqui mora o caderno.

`caderno.enc.json` é o **banco de dados do app**: o mesmo cofre que fica no
navegador, cifrado com AES-GCM 256 e chave derivada da sua senha
(PBKDF2-SHA256). O app grava este arquivo pela API do GitHub a cada alteração
e o lê de volta ao destrancar.

Por ser cifrado, o conteúdo é ilegível para qualquer pessoa sem a senha —
inclusive se o repositório for público. O que se vê aqui é isto:

```json
{ "app":"caderno", "format":"caderno-vault-1", "v":1,
  "kdf":"PBKDF2-SHA256", "iters":310000,
  "salt":"…", "iv":"…", "ct":"…", "savedAt":1756500000000 }
```

- `salt` + `iters` — como a chave é derivada da senha.
- `iv` — vetor de inicialização daquela gravação.
- `ct` — o caderno inteiro cifrado (dias, categorias, afazeres, preferências).
- O token de sincronia **não** vai neste arquivo.

## Coisas a saber

- **Não edite à mão.** Qualquer byte trocado invalida a autenticação do
  AES-GCM e o arquivo deixa de abrir.
- **O histórico do git é o seu backup.** Cada sincronia é um commit; se algo
  der errado, `git log dados/` e volte a versão anterior.
- **Trocou a senha?** Sincronize logo depois. O arquivo passa a exigir a senha
  nova, e aparelhos que ainda usam a antiga vão avisar que não conseguem abrir.
- **Dois aparelhos ao mesmo tempo:** cada item (dia, tarefa, categoria) carrega
  `updatedAt`, e a junção mantém sempre a versão editada por último. Apagar
  deixa uma lápide, para que a exclusão feita num aparelho não seja desfeita
  pelo outro. A lógica está em `js/merge.js` e é testada por
  `node tools/test-merge.mjs`.
