const express = require('express');
const { PreApproval } = require('mercadopago');
const { mpClient } = require('../config/clientes');
const { db } = require('../db/banco');
const {
    acessoAte,
    assinaturaEstaCanceladaNoMP,
    localizarAssinaturaNoMP,
    processarPagamento,
    sincronizarAssinatura,
    webhookMercadoPagoAutentico
} = require('../servicos/assinaturas');
const { revelarIdentidade } = require('../servicos/identidade');
const { exigirLogin } = require('../web/autorizacao');
const { registrarErro } = require('../servicos/log');

function registrar(app) {
    app.post('/criar-sessao-pagamento', exigirLogin, express.json(), async (req, res) => {
        const userId = req.session.userId;

        try {
            const [rows] = await db.promise().query(
                'SELECT email, email_criptografado FROM usuarios WHERE id = ?',
                [userId]
            );
            if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
            const usuarioPagamento = revelarIdentidade(rows[0]);

            let meuDominio;
            try {
                meuDominio = new URL(process.env.APP_URL).origin;
            } catch {
                meuDominio = `${req.protocol}://${req.get('host')}`;
            }
            const preApproval = new PreApproval(mpClient);

            // Cria a ASSINATURA diretamente, com 1 mês grátis (trial)
            const resultado = await preApproval.create({
                body: {
                    reason: 'Plano Mensal - GBM',
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: 'months',
                        transaction_amount: 9.90,
                        currency_id: 'BRL',
                        free_trial: {
                            frequency: 1,
                            frequency_type: 'months'
                        }
                    },
                    back_url: `${meuDominio}/dashboard.html?pago=sucesso`,
                    payer_email: usuarioPagamento.email,
                    external_reference: userId.toString()
                }
            });

            if (!resultado.id) {
                throw new Error('O Mercado Pago não retornou o identificador da assinatura.');
            }

            // Guardamos o ID para conseguir cancelar a cobrança recorrente no Mercado
            // Pago, e não apenas mudar um texto/status na nossa própria base.
            await db.promise().query(
                `UPDATE usuarios
             SET mercadopago_preapproval_id = ?, assinatura_cancelada_no_mp = 0
             WHERE id = ?`,
                [String(resultado.id), userId]
            );

            res.json({ url: resultado.init_point }); 
        } catch (error) {
            registrarErro("Erro ao criar assinatura no MP:", error);
            res.status(500).json({ error: 'Falha ao gerar link de assinatura.' });
        }
    });
    // --- WEBHOOK DO MERCADO PAGO ---
    // Pagamentos aprovados liberam o Premium; eventos da assinatura (autorizada,
    // pausada ou cancelada) sincronizam o status. A API do Mercado Pago é sempre
    // consultada: o corpo da notificação não é usado como prova.
    app.post('/webhook-mercadopago', async (req, res) => {
        if (!webhookMercadoPagoAutentico(req)) {
            console.warn('Notificação do Mercado Pago com assinatura inválida foi recusada.');
            return res.sendStatus(401);
        }
        const tipo = String(req.body?.type || req.query.type || req.query.topic || '');
        const acao = String(req.body?.action || '');
        const id = String(req.query['data.id'] || req.body?.data?.id || req.query.id || '').trim();
        if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return res.sendStatus(200);

        try {
            if (tipo === 'payment' || acao.startsWith('payment.')) {
                if (/^\d+$/.test(id)) await processarPagamento(id);
            } else if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
                await sincronizarAssinatura(id);
            }
            return res.sendStatus(200);
        } catch (erro) {
            // O 500 permite que o Mercado Pago tente entregar o evento novamente.
            console.error('Erro ao processar notificação do Mercado Pago:', erro.status || erro.code || erro.message);
            return res.sendStatus(500);
        }
    });
    app.get('/minha-assinatura', exigirLogin, async (req, res) => {
        const userId = req.session.userId;

        try {
            const [rows] = await db.promise().query(
                `SELECT nome, email, nome_criptografado, email_criptografado,
                    status_pagamento, trial_expira
             FROM usuarios WHERE id = ?`,
                [userId]
            );
            if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        
            res.json(revelarIdentidade(rows[0]));
        } catch (error) {
            registrarErro('Erro ao buscar assinatura:', error);
            res.status(500).json({ error: 'Falha ao buscar dados da assinatura.' });
        }
    });
    // --- ROTA: CANCELAR ASSINATURA ---
    app.post('/cancelar-assinatura', exigirLogin, async (req, res) => {
        const userId = req.session.userId;
        try {
            const [usuarios] = await db.promise().query(
                `SELECT email, email_criptografado, mercadopago_preapproval_id
             FROM usuarios
             WHERE id = ?`,
                [userId]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
            }

            const usuarioCancelamento = revelarIdentidade(usuarios[0]);
            const encontrada = await localizarAssinaturaNoMP(
                userId,
                usuarioCancelamento.email,
                usuarioCancelamento.mercadopago_preapproval_id
            );

            // Se não existe assinatura no Mercado Pago, o status "pago" foi apenas
            // alterado localmente (por exemplo, em um teste no Adminer). Nesse caso
            // não existe cobrança recorrente para cancelar: basta corrigir o estado local.
            if (!encontrada.assinatura || !encontrada.preapprovalId) {
                await db.promise().query(
                    `UPDATE usuarios
                 SET mercadopago_preapproval_id = NULL,
                     status_pagamento = 'cancelado',
                     assinatura_cancelada_no_mp = 1
                 WHERE id = ?`,
                    [userId]
                );

                return res.json({
                    success: true,
                    message: 'Plano local cancelado. Esta conta não possuía uma assinatura recorrente no Mercado Pago.'
                });
            }

            let assinaturaConfirmada = encontrada.assinatura;
            if (!assinaturaEstaCanceladaNoMP(assinaturaConfirmada.status)) {
                assinaturaConfirmada = await encontrada.preApproval.update({
                    id: encontrada.preapprovalId,
                    body: { status: 'canceled' }
                });
            }

            // Confere uma segunda vez no Mercado Pago. O banco local só recebe
            // "cancelado" depois que o provedor confirmar o status real.
            if (!assinaturaEstaCanceladaNoMP(assinaturaConfirmada?.status)) {
                assinaturaConfirmada = await encontrada.preApproval.get({
                    preApprovalId: encontrada.preapprovalId
                });
            }

            if (!assinaturaEstaCanceladaNoMP(assinaturaConfirmada?.status)) {
                return res.status(502).json({
                    success: false,
                    message: 'O Mercado Pago ainda não confirmou o cancelamento. Nenhum status local foi alterado.'
                });
            }

            // O período já pago continua liberado até a próxima cobrança prevista.
            const liberadoAte = acessoAte(encontrada.assinatura);
            await db.promise().query(
                `UPDATE usuarios
             SET mercadopago_preapproval_id = ?,
                 status_pagamento = 'cancelado',
                 assinatura_cancelada_no_mp = 1,
                 trial_expira = GREATEST(COALESCE(trial_expira, ?), ?)
             WHERE id = ?`,
                [encontrada.preapprovalId, liberadoAte, liberadoAte, userId]
            );
        
            res.json({ success: true, message: 'Sua assinatura foi cancelada no Mercado Pago com sucesso.' });
        } catch (error) {
            registrarErro('Erro ao cancelar assinatura:', error);
            res.status(502).json({ success: false, message: 'O Mercado Pago não confirmou o cancelamento. Tente novamente mais tarde.' });
        }
    });
}

module.exports = { registrar };
