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

O workflow em `.github/workflows/ci.yml` valida sintaxe, testes e vulnerabilidades de severidade alta em cada push e pull request.
