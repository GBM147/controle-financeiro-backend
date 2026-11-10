const { TERMOS_VERSAO_ATUAL } = require('../config/constantes');
const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { registrarAuditoria } = require('../servicos/auditoria');
const { chaveDados } = require('../servicos/identidade');
const { exigirLogin } = require('../web/autorizacao');

function registrar(app) {
    // =======================================================
    // --- PRIVACIDADE, CONSENTIMENTO E EXPORTAÇÃO LGPD ---
    // =======================================================
    app.get('/privacidade/status', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const [linhas] = await db.promise().query(
                `SELECT consentimento_privacidade_em, termos_aceitos_em, termos_versao
             FROM usuarios WHERE id = ?`,
                [req.session.userId]
            );
            res.json({
                consentimento_privacidade_em: linhas[0]?.consentimento_privacidade_em || null,
                termos_aceitos_em: linhas[0]?.termos_aceitos_em || null,
                termos_versao: linhas[0]?.termos_versao || null,
                criptografia_ativa: Boolean(chaveDados)
            });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao carregar informações de privacidade.' });
        }
    });
    app.put('/privacidade/consentimento', exigirLogin, async (req, res) => {
        try {
            const aceito = req.body.aceito === true || req.body.aceito === 1;
            await db.promise().query(
                'UPDATE usuarios SET consentimento_privacidade_em = ? WHERE id = ?',
                [aceito ? new Date() : null, req.session.userId]
            );
            await registrarAuditoria(req, aceito ? 'CONSENTIMENTO_ACEITO' : 'CONSENTIMENTO_REVOGADO');
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao atualizar consentimento.' });
        }
    });
    app.get('/termos/status', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const [linhas] = await db.promise().query(
                'SELECT termos_aceitos_em, termos_versao FROM usuarios WHERE id = ?',
                [req.session.userId]
            );
            res.json({
                termos_aceitos_em: linhas[0]?.termos_aceitos_em || null,
                termos_versao: linhas[0]?.termos_versao || null,
                termos_versao_atual: TERMOS_VERSAO_ATUAL
            });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao carregar o aceite dos Termos.' });
        }
    });
    app.put('/termos/aceitar', exigirLogin, async (req, res) => {
        try {
            const aceito = req.body.aceito === true || req.body.aceito === 1;
            if (!aceito) {
                return res.status(400).json({
                    success: false,
                    error: 'Confirme a leitura e o aceite dos Termos de Uso.'
                });
            }
            await garantirEstruturaProduto();
            await db.promise().query(
                `UPDATE usuarios
             SET termos_aceitos_em = NOW(), termos_versao = ?
             WHERE id = ?`,
                [TERMOS_VERSAO_ATUAL, req.session.userId]
            );
            await registrarAuditoria(req, 'TERMOS_ACEITOS', TERMOS_VERSAO_ATUAL);
            res.json({
                success: true,
                termos_versao: TERMOS_VERSAO_ATUAL,
                termos_aceitos_em: new Date().toISOString()
            });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao registrar o aceite dos Termos.' });
        }
    });
}

module.exports = { registrar };
