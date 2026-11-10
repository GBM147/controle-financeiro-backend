const { rateLimit } = require('express-rate-limit');
const { LimiteMysqlStore } = require('./limite-mysql');

// Sem banco real (testes unitários) os contadores ficam em memória.
const usarMysql = process.env.NODE_ENV !== 'test' || process.env.GBM_TESTE_MYSQL === '1';

function criarLimitador({ janelaMs, maximo, prefixo }) {
    return rateLimit({
        windowMs: janelaMs,
        limit: maximo,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        identifier: prefixo,
        ...(usarMysql ? { store: new LimiteMysqlStore({ prefixo }) } : {}),
        // Se o banco de limites falhar, a requisição segue: disponibilidade
        // tem prioridade, e as rotas protegidas continuam exigindo login.
        passOnStoreError: true,
        // O proxy confiável é o balanceador do Render. A validação automática da
        // biblioteca não conhece essa topologia, por isso a regra é documentada aqui.
        validate: { trustProxy: false },
        handler(req, res) {
            const expiraEm = req.rateLimit?.resetTime?.getTime?.();
            const segundos = Number.isFinite(expiraEm)
                ? Math.max(1, Math.ceil((expiraEm - Date.now()) / 1000))
                : Math.ceil(janelaMs / 1000);
            res.setHeader('Retry-After', String(segundos));
            return res.status(429).json({
                success: false,
                message: `Muitas tentativas. Aguarde ${segundos} segundos e tente novamente.`
            });
        }
    });
}
const limitarAutenticacao = criarLimitador({
    janelaMs: 15 * 60 * 1000,
    maximo: 20,
    prefixo: 'auth'
});
const limitarFeedback = criarLimitador({
    janelaMs: 60 * 60 * 1000,
    maximo: 10,
    prefixo: 'feedback'
});
const limitarAssistente = criarLimitador({
    janelaMs: 60 * 1000,
    maximo: 10,
    prefixo: 'assistente'
});
const limitarImportacao = criarLimitador({
    janelaMs: 15 * 60 * 1000,
    maximo: 20,
    prefixo: 'importacao'
});

module.exports = { limitarAssistente, limitarAutenticacao, limitarFeedback, limitarImportacao };
