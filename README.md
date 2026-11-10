# GBM Finance

Backend Node.js e site do Guardian of Budget & Money, uma ferramenta de organização financeira pessoal com lançamentos, importação de extratos, limites, objetivos e relatórios.

## Requisitos

- Node.js 20 ou superior
- MySQL 8 ou compatível
- Credenciais dos serviços descritos em `.env.example`

## Desenvolvimento

```bash
cp .env.example .env
npm install
npm run check
npm test
npm start
```

O servidor usa a porta definida em `PORT` e publica os arquivos da pasta `public/`.

## Estrutura

- `index.js`: ponto de entrada; inicia o servidor, prepara o banco, agenda a tarefa diária e encerra com segurança no deploy.
- `src/app.js`: cria o Express com a mesma ordem de middlewares de segurança, arquivos estáticos, sessão, rotas e tratamento de erros.
- `src/rotas/`: rotas por assunto (autenticação, transações, importações, objetivos, pagamentos etc.).
- `src/servicos/`: regras compartilhadas (identidade criptografada, importação, alertas, recorrências, assinaturas).
- `src/db/`: pool MySQL e migrações automáticas; `db/schema.sql` traz o esquema base para desenvolvimento e testes.
- `src/web/`: sessão, autorização, limites de requisição, uploads e páginas editoriais.

## Testes com MySQL real

`npm test` roda os testes unitários. Os testes de integração recriam todas as tabelas de um banco descartável:

```bash
GBM_TESTE_MYSQL=1 DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD=root DB_NAME=gbm_teste node --test test/integracao.test.js
```

Nunca aponte essas variáveis para o banco de produção. O CI executa esses testes em um MySQL 8 temporário.

Use um banco dedicado ao desenvolvimento. A inicialização executa migrações
automáticas aditivas e pressupõe que o esquema base já existe; este repositório
não inclui um script de criação desse esquema.

Conexões remotas ao MySQL, incluindo o armazenamento de sessões, usam TLS com
verificação do certificado e do hostname. Mantenha
`DB_SSL_REJECT_UNAUTHORIZED=true`. O valor legado `false` emite um aviso e é
ignorado; não interrompe a configuração nem desativa a verificação TLS.
Se o provedor utiliza uma CA privada, configure
`DB_SSL_CA_FILE` com o caminho do certificado PEM confiável fornecido por ele.
Também é possível cadastrar o PEM público em `DB_SSL_CA` (quebras reais ou
`\n`) ou em `DB_SSL_CA_BASE64`. A ordem de preferência é arquivo, PEM e base64.
O mesmo certificado é usado nas consultas e no armazenamento das sessões.
`DB_SSL=false` é permitido somente fora de produção com `DB_HOST=localhost`,
`127.0.0.1` ou `::1`.

Para hosts `*.aivencloud.com`, o projeto usa automaticamente
`certificados/aiven-ca.pem`, a CA pública fornecida pelo responsável pelo GBM
Finance no painel da Aiven. O certificado acompanha o deploy e é compartilhado
pelas consultas e pelo banco de sessões. Não é necessário cadastrar uma nova
variável no Render para esse serviço. A validação do certificado e do hostname
continua ativa.

Se mudar de projeto Aiven ou renovar sua CA, baixe o **CA certificate** na
página do serviço e atualize esse arquivo público, ou cadastre o novo conteúdo
em `DB_SSL_CA` no Render. Outra opção é enviar esse `ca.pem` em
**Environment → Secret Files** e apontar `DB_SSL_CA_FILE` para
`/etc/secrets/ca.pem`. Esse arquivo contém apenas o certificado público da CA;
não use chave privada, certificado capturado sem confirmação ou senha do banco.
Depois, faça o deploy e confirme `/health` e o login. O erro
`self-signed certificate in certificate chain` indica que falta uma CA
confiável nessa cadeia; mudar `DB_SSL_REJECT_UNAUTHORIZED` não o corrige.

O login diferencia indisponibilidade do serviço (`503`, sem apagar uma sessão
válida) de credenciais recusadas (`401`). A aplicação usa um pool MySQL
(`DB_POOL_LIMIT`, padrão 5): cada transação reserva uma conexão exclusiva até
o commit ou rollback, conexões interrompidas são substituídas e escritas não
são repetidas automaticamente.

Para verificar a execução, confirme que `/health` responde `200` com
`database: "ok"` e que as migrações concluíram sem erros. Os testes em
`NODE_ENV=test` usam sessão em memória e não validam a conexão com um MySQL real.

## Variáveis obrigatórias em produção

Configure banco, `SESSION_SECRET`, chaves de proteção de dados, origem pública, Resend, Cloudinary, Mercado Pago e Gemini conforme `.env.example`. `ALLOWED_ORIGINS` deve conter apenas origens confiáveis. A validação TLS do MySQL permanece ativa por padrão.

Nunca publique `.env`, tokens ou credenciais. Credenciais que já apareceram no histórico do Git devem ser revogadas e substituídas no painel do respectivo fornecedor; apagá-las apenas do código atual não as torna seguras.

## Segurança implementada

- Sessão renovada no login e vinculada ao usuário no servidor.
- Conta não verificada não recebe acesso às APIs autenticadas.
- Códigos de verificação e recuperação têm finalidade e expiração.
- Uploads ficam limitados a um arquivo de até 10 MB e tipos permitidos.
- A assinatura real de PDFs, OFX/QFX e imagens é conferida além da extensão e do MIME.
- Helmet aplica CSP e cabeçalhos defensivos; autenticação, feedback e importações têm rate limit.
- CORS usa lista explícita, cookies são `httpOnly` e páginas privadas recebem `noindex`.
- Dados dinâmicos exibidos em relatórios são escapados antes de entrar no HTML.
- O endpoint `/health` verifica também a conexão com o banco.

## Área editorial e AdSense

O código do AdSense é carregado somente nas páginas editoriais: início, `/educacao-financeira.html`, `/ferramentas.html`, `/guias/*` e `/calculadoras/*`. Login, dashboard e demais telas da conta não carregam anúncios e mantêm a CSP restritiva com `default-src 'self'`.

As páginas editoriais são entregues pelo servidor com um nonce por requisição e a CSP recomendada pelo Google para AdSense (`'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`). Todo `<script>` dessas páginas recebe o nonce automaticamente; não use atributos de evento inline (`onclick`) nelas. Ao criar um guia, inclua o código do AdSense no `<head>`, adicione a página ao `sitemap.xml` e à biblioteca. A Política de Privacidade (seção 12) traz a divulgação obrigatória sobre cookies de publicidade. `robots.txt`, `sitemap.xml` e `ads.txt` são publicados na raiz.

Antes de pedir nova avaliação no AdSense:

1. publique esta versão;
2. confirme que as páginas do sitemap respondem com `200`;
3. solicite indexação das páginas editoriais no Google Search Console;
4. aguarde a indexação e revise a cobertura;
5. no AdSense, em **Privacidade e mensagens**, ative a mensagem de consentimento do Google (obrigatória para visitantes do Espaço Econômico Europeu, Reino Unido e Suíça);
6. só então marque os problemas como corrigidos e peça nova análise.

Uma nova aprovação depende da avaliação do Google e não pode ser garantida pelo código.

## CI

O workflow em `.github/workflows/ci.yml` valida Node.js 20 e 22, sintaxe, testes de integração e vulnerabilidades de severidade alta em cada push e pull request.

## Deploy no Render

O serviço publicado em `gbm-finance.com` é uma aplicação Web Node.js no Render. Use esta configuração no painel:

- branch de produção: `main`;
- build command: `npm ci --omit=dev`;
- start command: `npm start`;
- health check path: `/health`;
- auto-deploy: **After CI Checks Pass**;
- `NODE_ENV=production`, `APP_URL=https://gbm-finance.com` e `ALLOWED_ORIGINS=https://gbm-finance.com`;
- demais segredos conforme `.env.example`, cadastrados somente em **Environment** no Render.

Fluxo seguro de publicação:

1. desenvolver em uma branch `agent/*`;
2. abrir um pull request e aguardar os dois jobs do CI;
3. revisar e mesclar na `main`;
4. aguardar o Render concluir o deploy e o `/health` responder `200`;
5. testar login, importação OFX/PDF, imagens de perfil e Mercado Pago;
6. se a verificação falhar, usar **Rollback** no histórico de deploys do Render.

Não execute mudanças de estrutura diretamente durante o deploy sem backup recente do MySQL. As migrações automáticas atuais são aditivas, mas dados financeiros exigem possibilidade de recuperação.
