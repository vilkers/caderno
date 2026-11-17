# Sincronização automática do Tarefas

O app continua em [vilkers.github.io/caderno/tarefas/](https://vilkers.github.io/caderno/tarefas/). O Worker guarda a autorização de longo prazo do Google. O iPhone guarda apenas a credencial aleatória do aparelho na cópia cifrada que o Face ID abre. O app usa os mesmos IDs das listas e tarefas do Google Tasks.

## Configuração única

1. No [painel da Cloudflare](https://dash.cloudflare.com/), abra **Workers & Pages → Create application → GitHub**. Selecione **vilkers/caderno**. Use o nome `tarefas-google`, branch `main`, **Root directory** `tarefas-sync`, **Build command** vazio e **Deploy command** `npx wrangler deploy`. Publique e copie o endereço HTTPS do Worker, que termina em `.workers.dev`.
2. No [Google Cloud](https://console.cloud.google.com/), abra o projeto das suas credenciais e confirme que a [Google Tasks API](https://console.cloud.google.com/apis/library/tasks.googleapis.com) está ativada. Em **Google Auth Platform → Clients → Create client**, escolha **Web application**. Adicione como **Authorized redirect URI** a URL do Worker com `/oauth/callback` no final. Salve o **Client ID** e o **Client secret**.
3. Na mesma plataforma do Google, em **Audience**, deixe um app externo **In production** antes de autorizar. Em **Testing**, o Google emite uma autorização de renovação que expira em sete dias com o escopo de tarefas. Para uso pessoal, o Google documenta uma exceção à verificação. A tela do Google pode ainda pedir confirmação.
4. Na Cloudflare, no Worker, abra **Settings → Variables and Secrets → Add**. Cadastre `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_ACCOUNT_EMAIL` como **Secret**. O e-mail é o da conta onde já estão suas tarefas. Toque em **Deploy**.
5. Preencha `SYNC_ORIGIN` em [tarefas/sync-config.js](../tarefas/sync-config.js) com a origem HTTPS do Worker, sem caminho. Só o endereço público é gravado no GitHub. Enquanto o endereço está vazio, o app usa o fluxo de autorização temporária já existente.

## No iPhone

1. Abra **Tarefas** pelo ícone que você já instalou e toque em **Entrar com Face ID**.
2. Toque em **Conectar Google → Autorizar no Google**. Escolha a conta das suas tarefas e toque em **Permitir**.
3. Volte ao ícone **Tarefas**. Se a confirmação não aparecer sozinha, toque em **Conferir autorização**. Depois de conectar, o acesso diário começa no Face ID. Só será preciso autorizar de novo se o Google encerrar a autorização ou se o iPhone perder os dados do app.

No app Google Agenda, abra o menu da conta correspondente e marque **Tarefas**. As tarefas com prazo aparecem no calendário.

[Documentação da Cloudflare](https://developers.cloudflare.com/workers/ci-cd/builds/) · [Expiração de autorizações do Google](https://developers.google.com/identity/protocols/oauth2/#expiration) · [Verificação para uso pessoal](https://support.google.com/cloud/answer/13464323) · [Tarefas no Google Agenda para iPhone](https://support.google.com/calendar/answer/9901136?co=GENIE.Platform%3DiOS)
