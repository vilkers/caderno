# Backups

Cópias congeladas do cofre, guardadas de propósito. São o mesmo formato do
arquivo que o app baixa em **Ajustes → Backup cifrado**: um blob AES-GCM
com o sal e o IV daquela gravação.

| arquivo | gravado em | o que é |
|---|---|---|
| `2026-08-30-caderno.json` | 30/08/2026 16:59 | primeiro backup real de uso — dias, categorias, missões e conquistas até essa data |

## Restaurar

App → **Ajustes → Dados → Importar** → escolha o arquivo → entre com a senha
que estava valendo quando ele foi gravado.

## O que acontece se a estrutura do app mudar

Nada quebra: o arquivo guarda a versão do documento, e `migrate()` em
`js/store.js` traz qualquer versão antiga para a atual no momento em que o
cofre é aberto (tem teste: `node tools/test-migrate.mjs`). Se algum dia a
mudança for grande demais para a migração automática, o caminho é abrir o
backup no app, deixar ele migrar, e gravar um arquivo novo aqui.

## Um aviso honesto

O conteúdo é ilegível sem a senha, e por isso pode viver num repositório
público. Mas um arquivo cifrado publicado é um arquivo cifrado para sempre:
quem baixar hoje pode tentar quebrar a senha offline com calma. Os 310 mil
ciclos de PBKDF2 tornam isso caro, não impossível — o que segura é o
tamanho da senha. Com uma frase longa, dormir tranquilo; com uma senha
curta, melhor manter os backups fora daqui.
