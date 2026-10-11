# Google Drive opcional

O Drive é uma extensão opcional por pessoa. As criações continuam no IndexedDB e a exportação local PNG/JPG/ZIP continua disponível mesmo sem conexão ou configuração do Google.

## Escopo e dados

- OAuth de servidor para servidor com `https://www.googleapis.com/auth/drive.file` apenas no momento em que a pessoa escolhe conectar;
- uma estrutura criada pela aplicação no Meu Drive de cada pessoa conectada: `Prime Creative/Pixel/Exportações`;
- exportações PNG/JPG e, para carrosséis, as imagens individuais e o ZIP são enviados para essa pasta;
- somente o refresh token é persistido, cifrado com AES-256-GCM. Access tokens são obtidos sob demanda e nunca são enviados ao browser;
- estado de OAuth é temporário, assinado e guardado em cookie `HttpOnly`, `SameSite=Lax`, por no máximo dez minutos. Não contém tokens.

Não há sincronização bidirecional, importação de biblioteca, listagem geral de arquivos nem escopo `drive` amplo.

## Pré-requisitos a configurar

1. No Google Cloud, crie ou escolha o projeto do Pixel e habilite a Google Drive API.
2. Configure a tela de consentimento OAuth e declare somente o escopo `drive.file`.
3. Crie uma credencial OAuth 2.0 de **Web application** e cadastre exatamente a URL de callback do ambiente, por exemplo `https://pixel.primecreative.com.br/api/integrations/google-drive/callback`.
4. Configure no ambiente local seguro e na Vercel, sem prefixo `NEXT_PUBLIC_`:
   - `GOOGLE_DRIVE_CLIENT_ID`;
   - `GOOGLE_DRIVE_CLIENT_SECRET`;
   - `GOOGLE_DRIVE_REDIRECT_URI` (igual à URL cadastrada no Google Cloud);
   - `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` (Base64 de 32 bytes aleatórios, exclusivo do Drive);
   - `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY_VERSION` (identificador da chave atual; padrão `v1`);
   - `GOOGLE_DRIVE_OAUTH_STATE_SECRET` (segredo aleatório de ao menos 32 caracteres).
5. Revise e aplique [`google-drive-foundation-migration.sql`](./google-drive-foundation-migration.sql) no **Supabase central do ecossistema Prime**. Ela é idempotente e não cria regra nem pasta para o Órbita. O `service_role` do backend do Pixel é o único processo que lê ou grava as tabelas.

O refresh token é guardado como ciphertext, IV de 96 bits, tag de autenticação GCM e versão de chave separadas. Linhas legadas sem esses campos não são utilizadas pelo Pixel: a pessoa precisa reconectar a conta. Não exponha essas tabelas via policy de cliente; as rotas do Pixel validam a sessão Supabase e o vínculo ativo de `team_members` antes de usar o service role.

## Operação e erros

- O botão **Conectar Google Drive** só fica ativo quando os cinco valores de ambiente existem.
- A desconexão tenta revogar o refresh token no Google e apaga sempre a conexão cifrada local. Se a revogação externa falhar, o Pixel informa isso e a pessoa pode removê-la também na página de apps de terceiros da conta Google.
- Os arquivos são enviados pelo servidor para `Prime Creative/Pixel/Exportações`; o navegador recebe apenas status e nomes dos arquivos concluídos. A interface mostra preparação, transferência e conclusão, e preserva erros recuperáveis.
