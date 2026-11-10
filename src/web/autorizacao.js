const { db } = require('../db/banco');
const {
    limparCookiesSessao,
    salvarSessao,
    servicoTemporariamenteIndisponivel
} = require('./sessao');
const { registrarErro } = require('../servicos/log');

async function exigirLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
    }

    try {
        // Também confirma que a conta ainda existe. Assim, ao excluir uma conta,
        // sessões abertas em outros dispositivos deixam de funcionar imediatamente.
        const [usuarios] = await db.promise().query(
            'SELECT id, verificado FROM usuarios WHERE id = ? LIMIT 1',
            [req.session.userId]
        );

        if (usuarios.length === 0) {
            return req.session.destroy(() => {
                limparCookiesSessao(res);
                return res.status(401).json({ success: false, error: 'Esta conta não existe mais. Faça login novamente.' });
            });
        }

        if (!(usuarios[0].verificado == 1 || usuarios[0].verificado === true)) {
            const usuarioId = req.session.userId;
            delete req.session.userId;
            req.session.pendingVerificationUserId = usuarioId;
            await salvarSessao(req);
            return res.status(403).json({
                success: false,
                error: 'Confirme o código enviado por e-mail antes de acessar sua conta.'
            });
        }

        return next();
    } catch (erro) {
        console.error('Erro ao validar sessão:', erro.code || erro.name || 'ERRO_SESSAO');
        const indisponivel = servicoTemporariamenteIndisponivel(erro);
        if (indisponivel) res.setHeader('Retry-After', '10');
        return res.status(indisponivel ? 503 : 500).json({
            success: false,
            error: 'Não foi possível validar a sessão. Tente novamente em instantes.'
        });
    }
}
async function exigirPremium(req, res, next) {
    try {
        const [usuarios] = await db.promise().query(
            `SELECT status_pagamento, trial_expira
             FROM usuarios
             WHERE id = ?
             LIMIT 1`,
            [req.session.userId]
        );
        if (!usuarios.length) {
            return res.status(401).json({ success: false, error: 'Conta não encontrada.' });
        }

        const usuario = usuarios[0];
        const pago = usuario.status_pagamento === 'pago';
        const prazoTemporario =
            (usuario.status_pagamento === 'trial' || usuario.status_pagamento === 'cancelado')
            && usuario.trial_expira
            && new Date(usuario.trial_expira) >= new Date();

        if (!pago && !prazoTemporario) {
            return res.status(403).json({
                success: false,
                codigo: 'RECURSO_PREMIUM',
                error: 'Este recurso está disponível no plano Premium.'
            });
        }

        next();
    } catch (erro) {
        registrarErro('Erro ao validar plano Premium:', erro);
        res.status(500).json({ success: false, error: 'Não foi possível validar o plano.' });
    }
}

module.exports = { exigirLogin, exigirPremium };
