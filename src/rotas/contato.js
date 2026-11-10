const { resend } = require('../config/clientes');
const { db } = require('../db/banco');
const { escaparHtmlServidor, revelarIdentidade } = require('../servicos/identidade');
const { limitarFeedback } = require('../web/limitadores');
const { registrarErro } = require('../servicos/log');

function registrar(app) {
    // --- ROTA: RECEBER FEEDBACK DA PÁGINA "FALE CONOSCO" ---
    app.post('/api/enviar-feedback', limitarFeedback, async (req, res) => {
        try {
            const { assunto, mensagem, nome, email } = req.body;
            const userId = req.session.userId;
            if (!mensagem || !assunto) {
                return res.status(400).json({ success: false, error: 'Assunto e mensagem são obrigatórios.' });
            }
            const assuntoTexto = String(assunto).replace(/[\r\n]+/g, ' ').slice(0, 120);
            const assuntoSeguro = escaparHtmlServidor(assuntoTexto);
            const mensagemSegura = escaparHtmlServidor(String(mensagem).slice(0, 5000)).replace(/\n/g, '<br>');

            let userEmail = null;
            let userNome = null;
            if (userId) {
                const [rows] = await db.promise().query(
                    `SELECT nome, email, nome_criptografado, email_criptografado
                 FROM usuarios WHERE id = ?`,
                    [userId]
                );
                if (rows.length > 0) {
                    const usuarioContato = revelarIdentidade(rows[0]);
                    userEmail = usuarioContato.email;
                    userNome = usuarioContato.nome;
                }
            }
            if (!userEmail && email) userEmail = String(email).slice(0, 200);
            if (!userNome && nome) userNome = escaparHtmlServidor(String(nome).slice(0, 120));

            const emailSuporte = process.env.EMAIL_SUPORTE || 'guardianofbudgetmoney@gmail.com';

            const { data, error: resendError } = await resend.emails.send({
        from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
        to: emailSuporte,
        reply_to: userEmail || undefined,
        subject: `[Fale Conosco] ${assuntoTexto} — Usuário ${userId || 'desconhecido'}`,
        html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Nova mensagem via Fale Conosco</h2>
            <p><strong>Usuário:</strong> ${escaparHtmlServidor(userNome || 'não identificado')} (ID: ${userId || 'desconhecido'})</p>
            <p><strong>E-mail:</strong> ${escaparHtmlServidor(userEmail || 'não informado')}</p>
            <p><strong>Assunto:</strong> ${assuntoSeguro}</p>
            <p><strong>Mensagem:</strong></p>
            <p>${mensagemSegura}</p>
        </div>
    `
    });

    if (resendError) {
        registrarErro('Erro do Resend ao enviar feedback:', resendError);
        return res.status(502).json({
            success: false,
            error: 'O provedor de e-mail não conseguiu enviar sua mensagem.'
        });
    }

    console.log('Feedback enviado pelo Resend. ID:', data?.id);
    res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
        } catch (error) {
            registrarErro('Erro ao enviar feedback:', error);
            res.status(500).json({ success: false, error: 'Falha ao enviar mensagem.' });
        }
    });
}

module.exports = { registrar };
