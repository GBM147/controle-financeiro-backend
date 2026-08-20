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

Anúncios não são carregados em login, dashboard, alertas ou páginas de ferramenta. A área pública de educação financeira fica em `/educacao-financeira.html`; `robots.txt`, `sitemap.xml` e `ads.txt` são publicados na raiz.

Antes de pedir nova avaliação no AdSense:

1. publique esta versão;
2. confirme que as páginas do sitemap respondem com `200`;
3. solicite indexação das páginas editoriais no Google Search Console;
4. aguarde a indexação e revise a cobertura;
5. só então marque os problemas como corrigidos e peça nova análise.

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
