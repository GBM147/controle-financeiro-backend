const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { configurarPersistenciaSessao, normalizarManterConectado, sessaoDevePersistir } = require('../../session-policy');
const { resend } = require('../config/clientes');
const { TERMOS_VERSAO_ATUAL } = require('../config/constantes');
const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { registrarAuditoria } = require('../servicos/auditoria');
const {
    criptografarDado,
    escaparHtmlServidor,
    gerarHashEmail,
    normalizarEmail,
    revelarIdentidade
} = require('../servicos/identidade');
const { exigirLogin } = require('../web/autorizacao');
const { limitarAutenticacao } = require('../web/limitadores');
const {
    limparCookiesSessao,
    salvarSessao,
    servicoTemporariamenteIndisponivel
} = require('../web/sessao');
const { registrarErro } = require('../servicos/log');

// O código enviado por e-mail não fica legível no banco: só o HMAC, vinculado à conta.
function hashCodigo(usuarioId, codigo) {
    const segredo = process.env.SESSION_SECRET || process.env.DATA_ENCRYPTION_KEY || '';
    return crypto.createHmac('sha256', segredo).update(`${Number(usuarioId)}|${String(codigo)}`).digest('hex');
}

function codigoConfere(usuarioId, codigo, armazenado) {
    const esperado = Buffer.from(hashCodigo(usuarioId, codigo), 'hex');
    const recebido = Buffer.from(String(armazenado || ''), 'hex');
    return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

// A identidade da conta a verificar fica vinculada à sessão criada no cadastro
// ou no login. O navegador nunca escolhe qual userId será ativado.
async function validarCodigoConta(req, res) {
    const userId = Number(req.session.pendingVerificationUserId);
    const manterConectado = sessaoDevePersistir(req.session);
    const codigo = String(req.body.codigo || req.body.codigoDigitado || '').trim();

    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(401).json({
            success: false,
            message: 'Inicie o cadastro ou faça login novamente antes de validar o código.'
        });
    }
    if (!/^\d{6}$/.test(codigo)) {
        return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
    }

    try {
        await garantirEstruturaProduto();
        const [atualizacao] = await db.promise().query(
            `UPDATE usuarios
             SET token_verificacao = NULL, token_expira_em = NULL,
                 token_finalidade = NULL, verificado = 1
             WHERE id = ?
               AND token_verificacao = ?
               AND token_finalidade = 'verificacao_conta'
               AND token_expira_em > NOW()`,
            [userId, hashCodigo(userId, codigo)]
        );

        if (atualizacao.affectedRows !== 1) {
            return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
        }

        return req.session.regenerate((erroSessao) => {
            if (erroSessao) {
                registrarErro('Erro ao renovar sessão na validação:', erroSessao);
                return res.status(500).json({ success: false, message: 'Não foi possível iniciar uma nova sessão.' });
            }

            req.session.userId = userId;
            configurarPersistenciaSessao(req.session, manterConectado);
            req.session.save((erroSalvar) => {
                if (erroSalvar) {
                    registrarErro('Erro ao salvar sessão na validação:', erroSalvar);
                    return res.status(500).json({ success: false, message: 'Não foi possível salvar a sessão.' });
                }
                return res.json({
                    success: true,
                    userId,
                    manterConectado,
                    message: 'Conta validada com sucesso!'
                });
            });
        });
    } catch (erro) {
        registrarErro('Erro ao validar conta:', erro);
        return res.status(500).json({ success: false, message: 'Não foi possível validar a conta.' });
    }
}
function registrar(app) {
    // --- ROTA 1: CADASTRO DE USUÁRIO ---
    app.post('/cadastro', limitarAutenticacao, async (req, res) => {
        const {
            nome,
            sobrenome,
            email,
            telefone,
            senha,
            aceite_termos,
            consentimento_privacidade
        } = req.body;
        try {
            await garantirEstruturaProduto();
            if (!nome || !email || !senha || String(senha).length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Preencha os dados obrigatórios e use uma senha com pelo menos 8 caracteres.'
                });
            }
            if (consentimento_privacidade !== true && consentimento_privacidade !== 'true') {
                return res.status(400).json({
                    success: false,
                    message: 'É necessário aceitar a Política de Privacidade para criar a conta.'
                });
            }
            if (aceite_termos !== true && aceite_termos !== 'true') {
                return res.status(400).json({
                    success: false,
                    message: 'É necessário aceitar os Termos de Uso para criar a conta.'
                });
            }

            const salt = await bcrypt.genSalt(10);
            const senhaHash = await bcrypt.hash(senha, salt);
            const emailNormalizado = normalizarEmail(email);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
                return res.status(400).json({ success: false, message: 'Informe um e-mail válido.' });
            }
            const emailHash = gerarHashEmail(emailNormalizado);
            const nomeCriptografado = criptografarDado(String(nome).trim());
            const sobrenomeCriptografado = criptografarDado(String(sobrenome || '').trim());
            const emailCriptografado = criptografarDado(emailNormalizado);
            const telefoneCriptografado = criptografarDado(telefone);
            const nomeBanco = nomeCriptografado ? 'PROTEGIDO' : String(nome).trim();
            const sobrenomeBanco = sobrenomeCriptografado ? 'PROTEGIDO' : String(sobrenome || '').trim();
            const emailBanco = emailCriptografado ? `${emailHash}@anonimo.gbm.local` : emailNormalizado;
            const telefoneBanco = telefoneCriptografado ? 'PROTEGIDO' : telefone;
            const sql = `INSERT INTO usuarios 
            (nome, sobrenome, email, telefone, nome_criptografado, sobrenome_criptografado,
             email_criptografado, email_hash, telefone_criptografado, senha_hash,
             status_pagamento, trial_expira, consentimento_privacidade_em,
             termos_aceitos_em, termos_versao) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW(), ?)`;
            const [result] = await db.promise().query(sql, [
                nomeBanco,
                sobrenomeBanco,
                emailBanco,
                telefoneBanco,
                nomeCriptografado,
                sobrenomeCriptografado,
                emailCriptografado,
                emailHash,
                telefoneCriptografado,
                senhaHash,
                TERMOS_VERSAO_ATUAL
            ]);
            await registrarAuditoria(req, 'CONTA_CRIADA', null, result.insertId);
            req.session.pendingVerificationUserId = result.insertId;
            delete req.session.userId;
            await salvarSessao(req);
            res.json({ success: true, userId: result.insertId, message: 'Cadastro realizado!' });
        } catch (error) {
            registrarErro('Erro ao criar cadastro:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, message: 'E-mail já cadastrado!' });
            }
            res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
        }
    });
    // --- ROTA 2: GERAR E ENVIAR O CÓDIGO (RESEND + ASYNC/AWAIT) ---
    app.post('/enviar-codigo', limitarAutenticacao, async (req, res) => {
        const { canal } = req.body;
        const userId = Number(req.session.pendingVerificationUserId);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({
                success: false,
                message: 'Inicie o cadastro ou faça login novamente antes de solicitar o código.'
            });
        }
        try {
            await garantirEstruturaProduto();
            const codigo = crypto.randomInt(100000, 1000000).toString();
            const expira = new Date(Date.now() + 15 * 60 * 1000);
            if (canal === 'email') {
                const [rows] = await db.promise().query(
                    `SELECT email, nome, email_criptografado, nome_criptografado, verificado
                 FROM usuarios WHERE id = ?`,
                    [userId]
                );
                if (rows.length === 0) {
                    return res.status(404).json({ success: false, message: 'Usuário não encontrado no banco.' });
                }
                if (rows[0].verificado == 1 || rows[0].verificado === true) {
                    return res.status(409).json({ success: false, message: 'Esta conta já foi verificada. Faça login novamente.' });
                }
                const usuario = revelarIdentidade(rows[0]);
                await db.promise().query(
                    `UPDATE usuarios
                 SET token_verificacao = ?, token_expira_em = ?, token_finalidade = 'verificacao_conta'
                 WHERE id = ?`,
                    [hashCodigo(userId, codigo), expira, userId]
                );
                const { error } = await resend.emails.send({
                    from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
                    to: usuario.email.toLowerCase().trim(),
                    subject: 'GBM - Seu Código de Acesso',
                    html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #09101a; color: #e8ecef; border-radius: 8px;">
                        <h2 style="color: #c89f53;">Guardian of Budget & Money</h2>
                        <p>Olá, ${escaparHtmlServidor(usuario.nome)}. Seu código de verificação é:</p>
                        <h1 style="letter-spacing: 5px; color: #10b981; background: #111c2e; padding: 15px; border-radius: 8px; display: inline-block;">
                            ${codigo}
                        </h1>
                        <p style="color: #8a9ba8; font-size: 12px;">O código expira em 15 minutos. Se você não solicitou este acesso, ignore este e-mail.</p>
                    </div>
                `
                });
                if (error) {
                    registrarErro("Erro da API Resend:", error);
                    return res.status(500).json({ success: false, message: 'Falha no provedor de e-mail.' });
                }
                res.json({ success: true, message: 'Código enviado com sucesso!' });
            } else {
                res.status(400).json({ success: false, message: 'Canal de verificação inválido.' });
            }
        } catch (erro) {
            registrarErro("Erro crítico no envio do código:", erro);
            res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
        }
    });
    // --- ROTA: VERIFICAR STATUS DO USUÁRIO PARA PAGAMENTO ---
    app.get('/login-status', exigirLogin, async (req, res) => {
        const userId = req.session.userId;
        try {
            const [rows] = await db.promise().query(
                'SELECT status_pagamento, trial_expira FROM usuarios WHERE id = ?', [userId]
            );
            if (rows.length === 0) return res.status(404).json({ success: false });
            res.json({
                success: true,
                userId,
                manterConectado: sessaoDevePersistir(req.session),
                statusPagamento: rows[0].status_pagamento,
                trialExpira: rows[0].trial_expira
            });
        } catch (erro) {
            console.error('Erro ao consultar estado do login:', erro.code || erro.name || 'ERRO_SESSAO');
            const indisponivel = servicoTemporariamenteIndisponivel(erro);
            if (indisponivel) res.setHeader('Retry-After', '10');
            res.status(indisponivel ? 503 : 500).json({
                success: false,
                message: 'Não foi possível consultar sua sessão. Tente novamente em instantes.'
            });
        }
    });
    app.post('/logout', (req, res) => {
        if (!req.session) {
            limparCookiesSessao(res);
            return res.json({ success: true });
        }

        return req.session.destroy((erro) => {
            if (erro) registrarErro('Erro ao encerrar sessão:', erro);
            limparCookiesSessao(res);
            return res.json({ success: true });
        });
    });
    // --- ROTA DE LOGIN CORRIGIDA (PULA VERIFICAÇÃO SE JÁ VERIFICADO) ---
    app.post('/login', limitarAutenticacao, async (req, res) => {
        const { identificacao, senha } = req.body || {};
        const manterConectado = normalizarManterConectado(req.body?.manterConectado);
        if (typeof identificacao !== 'string' || !identificacao.trim() || typeof senha !== 'string' || !senha) {
            return res.status(400).json({ success: false, message: 'Informe e-mail e senha.' });
        }

        try {
            await garantirEstruturaProduto();
            const emailNormalizado = normalizarEmail(identificacao);
            const [usuarios] = await db.promise().query(
                `SELECT *
             FROM usuarios
             WHERE email_hash = ?
                OR (email_hash IS NULL AND LOWER(email) = ?)
             LIMIT 1`,
                [gerarHashEmail(emailNormalizado), emailNormalizado]
            );
            const usuario = usuarios[0];
            if (!usuario || typeof usuario.senha_hash !== 'string'
                || !await bcrypt.compare(senha, usuario.senha_hash)) {
                return res.status(401).json({ success: false, message: 'E-mail ou senha incorretos.' });
            }
            const verificado = usuario.verificado == 1 || usuario.verificado === true;

            // Aguarda a criação e a gravação da sessão antes de liberar o dashboard.
            // Toda falha assíncrona permanece no mesmo tratamento de erros da rota.
            await new Promise((resolve, reject) => {
                req.session.regenerate((erro) => erro ? reject(erro) : resolve());
            });
            if (verificado) {
                req.session.userId = usuario.id;
            } else {
                req.session.pendingVerificationUserId = usuario.id;
            }
            configurarPersistenciaSessao(req.session, manterConectado);
            await salvarSessao(req);
            await registrarAuditoria(
                req,
                verificado ? 'LOGIN_REALIZADO' : 'LOGIN_AGUARDANDO_VERIFICACAO',
                null,
                usuario.id
            );

            return res.json({
                success: true,
                verificado,
                statusPagamento: usuario.status_pagamento,
                trialExpira: usuario.trial_expira,
                userId: usuario.id,
                manterConectado,
                message: verificado ? 'Login efetuado com sucesso!' : 'Conta não verificada. Insira o código.'
            });
        } catch (erro) {
            console.error('Erro ao realizar login:', erro.code || erro.name || 'ERRO_LOGIN');
            const indisponivel = servicoTemporariamenteIndisponivel(erro);
            if (indisponivel) res.setHeader('Retry-After', '10');
            return res.status(indisponivel ? 503 : 500).json({
                success: false,
                message: indisponivel
                    ? 'O serviço de acesso está temporariamente indisponível. Aguarde alguns instantes e tente novamente.'
                    : 'Não foi possível entrar na sua conta. Tente novamente em instantes.'
            });
        }
    });
    app.post('/verificar-conta', limitarAutenticacao, validarCodigoConta);
    app.post('/validar-codigo', limitarAutenticacao, validarCodigoConta);
    // --- ROTA: SOLICITAR RECUPERAÇÃO DE SENHA ---
    app.post('/esqueci-senha', limitarAutenticacao, async (req, res) => {
        const { email } = req.body;
        try {
            await garantirEstruturaProduto();
            const emailNormalizado = normalizarEmail(email);
            const [rows] = await db.promise().query(
                `SELECT id, nome, nome_criptografado
             FROM usuarios
             WHERE email_hash = ?
                OR (email_hash IS NULL AND LOWER(email) = ?)
             LIMIT 1`,
                [gerarHashEmail(emailNormalizado), emailNormalizado]
            );

            // Resposta genérica mesmo se o e-mail não existir (evita expor quais e-mails estão cadastrados)
            if (rows.length === 0) {
                return res.json({ success: true, message: 'Se o e-mail existir, enviaremos um código.' });
            }

            const usuario = revelarIdentidade(rows[0]);
            const codigo = crypto.randomInt(100000, 1000000).toString();
            const expira = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

            await db.promise().query(
                `UPDATE usuarios
             SET token_verificacao = ?, token_expira_em = ?, token_finalidade = 'recuperacao_senha'
             WHERE id = ?`,
                [hashCodigo(usuario.id, codigo), expira, usuario.id]
            );

            const { error } = await resend.emails.send({
                from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
                to: emailNormalizado,
                subject: 'GBM - Recuperação de Senha',
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #09101a; color: #e8ecef; border-radius: 8px;">
                    <h2 style="color: #c89f53;">Guardian of Budget & Money</h2>
                    <p>Olá, ${escaparHtmlServidor(usuario.nome)}. Use o código abaixo para redefinir sua senha:</p>
                    <h1 style="letter-spacing: 5px; color: #10b981; background: #111c2e; padding: 15px; border-radius: 8px; display: inline-block;">
                        ${codigo}
                    </h1>
                    <p style="color: #8a9ba8; font-size: 12px;">Expira em 15 minutos. Se não foi você, ignore este e-mail.</p>
                </div>
            `
            });

            if (error) {
                registrarErro("Erro da API Resend:", error);
                return res.status(500).json({ success: false, message: 'Falha ao enviar e-mail.' });
            }

            res.json({ success: true, message: 'Se o e-mail existir, enviaremos um código.' });
        } catch (erro) {
            registrarErro("Erro ao solicitar recuperação:", erro);
            res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
        }
    });
    // --- ROTA: REDEFINIR SENHA COM O CÓDIGO ---
    app.post('/redefinir-senha', limitarAutenticacao, async (req, res) => {
        const { email, codigo, novaSenha } = req.body;
        try {
            await garantirEstruturaProduto();
            if (typeof novaSenha !== 'string' || novaSenha.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'A nova senha deve ter pelo menos 8 caracteres.'
                });
            }
            const emailNormalizado = normalizarEmail(email);
            const [rows] = await db.promise().query(
                `SELECT id, token_verificacao, token_expira_em, token_finalidade
             FROM usuarios
             WHERE email_hash = ?
                OR (email_hash IS NULL AND LOWER(email) = ?)
             LIMIT 1`,
                [gerarHashEmail(emailNormalizado), emailNormalizado]
            );

            if (rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
            }

            const usuario = rows[0];
            const expirado = !usuario.token_expira_em || new Date(usuario.token_expira_em) < new Date();

            if (!/^\d{6}$/.test(String(codigo || '')) || !codigoConfere(usuario.id, codigo, usuario.token_verificacao)
                || expirado || usuario.token_finalidade !== 'recuperacao_senha') {
                return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
            }

            const salt = await bcrypt.genSalt(10);
            const novaSenhaHash = await bcrypt.hash(novaSenha, salt);

            await db.promise().query(
                `UPDATE usuarios
             SET senha_hash = ?, token_verificacao = NULL, token_expira_em = NULL, token_finalidade = NULL
             WHERE id = ?`,
                [novaSenhaHash, usuario.id]
            );

            res.json({ success: true, message: 'Senha redefinida com sucesso!' });
        } catch (erro) {
            registrarErro("Erro ao redefinir senha:", erro);
            res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
        }
    });
}

module.exports = { registrar };
