const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const { db } = require('./db/banco');
const { limitarAssistente } = require('./web/limitadores');
const {
    DIRETORIO_PUBLICO,
    PAGINAS_PRIVADAS_OU_DE_ACAO,
    cspPaginaEditorial,
    lerPaginaEditorial,
    paginaEditorialComAnuncios
} = require('./web/paginas');
const { servicoTemporariamenteIndisponivel, sessionStore } = require('./web/sessao');
const { registrarErro } = require('./servicos/log');

// 1. Inicializamos o servidor Express
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render encerra o TLS antes de encaminhar a requisição ao Node.
// 2. Middlewares essenciais (precisam vir ANTES de qualquer rota, incluindo o webhook,
// senão req.body chega vazio nas rotas registradas antes deles)
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
const diretivasCsp = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
    manifestSrc: ["'self'"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    workerSrc: ["'self'", 'blob:']
};
if (process.env.NODE_ENV === 'production') diretivasCsp.upgradeInsecureRequests = [];
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: diretivasCsp
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    strictTransportSecurity: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});
app.get('/health', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        await Promise.race([
            db.promise().ping(),
            new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        return res.status(200).json({ status: 'ok', service: 'gbm-api', database: 'ok' });
    } catch (erro) {
        return res.status(503).json({ status: 'indisponivel', service: 'gbm-api', database: 'erro' });
    }
});
app.use('/assistente-ajuda', limitarAssistente);
app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const pagina = paginaEditorialComAnuncios(req.path);
    if (!pagina) return next();

    let html;
    try {
        html = await lerPaginaEditorial(pagina);
    } catch (erro) {
        return erro.code === 'ENOENT' ? next() : next(erro);
    }

    const nonce = crypto.randomBytes(16).toString('base64');
    res.setHeader('Content-Security-Policy', cspPaginaEditorial(nonce));
    // Cliques em anúncios abrem janelas de outros domínios a partir de iframes.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cache-Control', 'no-cache');
    return res.type('html').send(html.replace(/<script(?=[\s>])/gi, `<script nonce="${nonce}"`));
});
// Entrega os arquivos públicos. Tutorial e service worker nunca podem ficar
// presos no cache do navegador ou do proxy após uma atualização.
app.use(express.static(DIRETORIO_PUBLICO, {
    setHeaders(res, caminhoArquivo) {
        const caminhoNormalizado = String(caminhoArquivo).replace(/\\/g, '/');
        const nomeArquivo = path.basename(caminhoNormalizado).toLowerCase();
        const exigeAtualizacaoImediata =
            caminhoNormalizado.endsWith('/sw.js')
            || caminhoNormalizado.endsWith('/gbm-tutorial.js')
            || caminhoNormalizado.endsWith('/gbm-tutorial.css');

        if (exigeAtualizacaoImediata) {
            res.setHeader(
                'Cache-Control',
                'no-store, no-cache, must-revalidate, proxy-revalidate'
            );
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        }

        if (PAGINAS_PRIVADAS_OU_DE_ACAO.has(nomeArquivo)) {
            res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
            res.setHeader('Cache-Control', 'private, no-store');
        }
    }
}));
// Respostas de autenticação nunca devem ser reutilizadas pelo navegador ou
// por proxies: cada consulta precisa refletir o cookie e a sessão atuais.
// CORS vale para a API. Arquivos públicos (páginas, fontes, imagens) ficam
// fora da verificação: não carregam dados da conta e precisam abrir em
// qualquer origem, como subdomínio www ou endereço do Render.
const origensPermitidas = String(
    process.env.ALLOWED_ORIGINS || process.env.APP_URL || ''
)
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);
app.use(cors({
    credentials: true,
    origin(origem, callback) {
        // Navegação direta e webhooks normalmente não enviam Origin. Em produção,
        // uma origem de navegador só é aceita quando foi configurada explicitamente.
        if (!origem || origensPermitidas.includes(origem)) {
            return callback(null, true);
        }
        return callback(new Error('Origem não autorizada pelo CORS.'));
    }
}));
app.use(['/login', '/login-status', '/logout', '/verificar-conta', '/validar-codigo'], (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
});
app.use(session({
    // "name" é a opção reconhecida pelo express-session para o nome do cookie.
    // Antes estava como "key", que era ignorado e deixava o cookie com o nome padrão.
    name: 'gbm_sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// Rotas registradas na mesma ordem do arquivo original.
for (const modulo of [
    require('./rotas/pagamentos'),
    require('./rotas/importacoes'),
    require('./rotas/autenticacao'),
    require('./rotas/resumos'),
    require('./rotas/limites'),
    require('./rotas/transacoes'),
    require('./rotas/categorias'),
    require('./rotas/contato'),
    require('./rotas/perfil'),
    require('./rotas/objetivos'),
    require('./rotas/contas'),
    require('./rotas/recorrencias'),
    require('./rotas/controle-simples'),
    require('./rotas/notificacoes'),
    require('./rotas/privacidade')
]) {
    modulo.registrar(app);
}
// Navegação para endereço inexistente recebe uma página 404 com links úteis.
// Outras requisições seguem adiante: a rota do assistente é registrada no
// listen (ia-assistente-loader.js), depois deste middleware.
app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.accepts(['json', 'html']) !== 'html') {
        return next();
    }
    res.setHeader('X-Robots-Tag', 'noindex');
    return res.status(404).sendFile(path.join(DIRETORIO_PUBLICO, '404.html'));
});
app.use((erro, req, res, next) => {
    if (erro instanceof multer.MulterError) {
        const mensagem = erro.code === 'LIMIT_FILE_SIZE'
            ? 'O arquivo excede o limite permitido.'
            : 'Não foi possível receber o arquivo.';
        const status = erro.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ success: false, error: mensagem, message: mensagem });
    }
    if (erro && erro.codigoPublico === 'ARQUIVO_INVALIDO') {
        return res.status(400).json({ success: false, error: erro.message, message: erro.message });
    }
    if (erro && erro.message === 'Origem não autorizada pelo CORS.') {
        return res.status(403).json({ success: false, error: erro.message });
    }
    return next(erro);
});
app.use((erro, req, res, next) => {
    if (res.headersSent) return next(erro);

    const corpoExcessivo = erro?.type === 'entity.too.large';
    const indisponivel = servicoTemporariamenteIndisponivel(erro);
    const status = corpoExcessivo ? 413 : indisponivel ? 503 : Number(erro?.statusHttp) || 500;
    const mensagem = status === 413
        ? 'O conteúdo enviado excede o limite permitido.'
        : status === 503
            ? 'O serviço está temporariamente indisponível. Aguarde alguns instantes e tente novamente.'
        : status >= 500
            ? 'Ocorreu um erro interno no servidor.'
            : erro.message || 'Não foi possível concluir a solicitação.';

    if (status >= 500) registrarErro('[SERVER ERROR]', erro);
    if (indisponivel) res.setHeader('Retry-After', '10');
    return res.status(status).json({ success: false, error: mensagem, message: mensagem });
});

module.exports = { app };
