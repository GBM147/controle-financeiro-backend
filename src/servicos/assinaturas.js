const crypto = require('crypto');
const { Payment, PreApproval } = require('mercadopago');
const { mpClient } = require('../config/clientes');
const { db } = require('../db/banco');

function assinaturaEstaCanceladaNoMP(status) {
    const statusNormalizado = String(status || '').toLowerCase();
    return statusNormalizado === 'canceled' || statusNormalizado === 'cancelled';
}

// O preapproval_id é a prova de que uma assinatura foi criada no Mercado Pago.
// Sem esse ID, o status existente é apenas local e nenhuma chamada ao MP deve
// ser feita: não existe assinatura remota para consultar ou cancelar.
async function localizarAssinaturaNoMP(userId, email, preapprovalId) {
    if (!preapprovalId) {
        return { preApproval: null, preapprovalId: null, assinatura: null };
    }

    const preApproval = new PreApproval(mpClient);
    const assinatura = await preApproval.get({ preApprovalId: String(preapprovalId) });
    return { preApproval, preapprovalId: String(preapprovalId), assinatura };
}

// Valida a origem da notificação conforme o Mercado Pago: HMAC-SHA256 do
// manifesto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com a chave
// secreta do webhook. Sem MP_WEBHOOK_SECRET a validação fica desativada.
function webhookMercadoPagoAutentico(req, segredo = process.env.MP_WEBHOOK_SECRET) {
    if (!segredo) return true;
    const partes = Object.fromEntries(
        String(req.get('x-signature') || '')
            .split(',')
            .map((parte) => parte.split('=').map((valor) => valor.trim()))
            .filter(([chave, valor]) => chave && valor)
    );
    if (!partes.ts || !/^[a-f0-9]{64}$/i.test(partes.v1 || '')) return false;

    let dataId = String(req.query?.['data.id'] ?? req.body?.data?.id ?? '');
    if (/^[a-z0-9]+$/i.test(dataId)) dataId = dataId.toLowerCase();
    const requestId = String(req.get('x-request-id') || '');
    const manifesto = `${dataId ? `id:${dataId};` : ''}${requestId ? `request-id:${requestId};` : ''}ts:${partes.ts};`;
    const esperado = crypto.createHmac('sha256', segredo).update(manifesto).digest();
    return crypto.timingSafeEqual(esperado, Buffer.from(partes.v1, 'hex'));
}

function acessoAte(assinatura) {
    const proximaCobranca = assinatura?.next_payment_date ? new Date(assinatura.next_payment_date) : null;
    return proximaCobranca && proximaCobranca > new Date() ? proximaCobranca : new Date();
}

// Aplica no banco o status atual da assinatura no Mercado Pago, que é sempre
// consultado na API: o conteúdo da notificação nunca libera acesso.
//   authorized          -> Premium ativo
//   cancelled / paused  -> cancelado, com acesso até a próxima cobrança já paga
async function sincronizarAssinatura(preapprovalId) {
    const assinatura = await new PreApproval(mpClient).get({ preApprovalId: String(preapprovalId) });
    const [porAssinatura] = await db.promise().query(
        'SELECT id FROM usuarios WHERE mercadopago_preapproval_id = ? LIMIT 1',
        [String(preapprovalId)]
    );
    let usuarioId = porAssinatura[0]?.id;
    if (!usuarioId) {
        const referencia = Number(assinatura.external_reference);
        if (!Number.isInteger(referencia) || referencia <= 0) return null;
        const [porReferencia] = await db.promise().query(
            `SELECT id FROM usuarios
             WHERE id = ? AND (mercadopago_preapproval_id IS NULL OR mercadopago_preapproval_id = ?)
             LIMIT 1`,
            [referencia, String(preapprovalId)]
        );
        usuarioId = porReferencia[0]?.id;
    }
    if (!usuarioId) return null;

    const status = String(assinatura.status || '').toLowerCase();
    if (status === 'authorized') {
        await db.promise().query(
            `UPDATE usuarios
             SET status_pagamento = 'pago', mercadopago_preapproval_id = ?, assinatura_cancelada_no_mp = 0
             WHERE id = ?`,
            [String(preapprovalId), usuarioId]
        );
    } else if (status === 'paused' || assinaturaEstaCanceladaNoMP(status)) {
        await db.promise().query(
            `UPDATE usuarios
             SET status_pagamento = 'cancelado',
                 assinatura_cancelada_no_mp = ?,
                 trial_expira = GREATEST(COALESCE(trial_expira, ?), ?)
             WHERE id = ? AND status_pagamento <> 'cancelado'`,
            [status === 'paused' ? 0 : 1, acessoAte(assinatura), acessoAte(assinatura), usuarioId]
        );
    }
    return { usuarioId, status };
}

async function processarPagamento(paymentId) {
    const pagamento = await new Payment(mpClient).get({ id: paymentId });
    if (pagamento.status !== 'approved') return null;

    let usuarioId = Number(pagamento.external_reference);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        // Cobranças recorrentes podem trazer só o identificador da assinatura.
        const preapprovalId = pagamento.metadata?.preapproval_id || pagamento.metadata?.preApprovalId;
        if (!preapprovalId) {
            console.warn(`Pagamento ${paymentId} sem referência de usuário válida.`);
            return null;
        }
        const [usuarios] = await db.promise().query(
            'SELECT id FROM usuarios WHERE mercadopago_preapproval_id = ? LIMIT 1',
            [String(preapprovalId)]
        );
        usuarioId = usuarios[0]?.id;
        if (!usuarioId) return null;
    }

    // Um webhook atrasado de uma cobrança antiga não reativa uma assinatura
    // que já foi cancelada.
    const [atualizacao] = await db.promise().query(
        `UPDATE usuarios
         SET status_pagamento = 'pago'
         WHERE id = ? AND assinatura_cancelada_no_mp = 0`,
        [usuarioId]
    );
    if (atualizacao.affectedRows === 0) {
        console.log(`Pagamento ${paymentId} recebido, mas a conta ${usuarioId} permanece cancelada.`);
    }
    return { usuarioId };
}

// Reconciliação diária: corrige contas cuja notificação de cancelamento,
// pausa ou falha de cobrança não chegou ao servidor.
async function reconciliarAssinaturas({ limite = 500, intervaloMs = 200 } = {}) {
    const [usuarios] = await db.promise().query(
        `SELECT mercadopago_preapproval_id AS id
         FROM usuarios
         WHERE mercadopago_preapproval_id IS NOT NULL AND status_pagamento IN ('pago', 'trial')
         ORDER BY id
         LIMIT ?`,
        [limite]
    );
    let corrigidas = 0;
    for (const { id } of usuarios) {
        try {
            const resultado = await sincronizarAssinatura(id);
            if (resultado && resultado.status !== 'authorized') corrigidas += 1;
        } catch (erro) {
            console.error('Falha ao reconciliar assinatura:', erro.status || erro.code || erro.message);
        }
        if (intervaloMs) await new Promise((resolve) => setTimeout(resolve, intervaloMs));
    }
    return { verificadas: usuarios.length, corrigidas };
}

module.exports = {
    acessoAte,
    assinaturaEstaCanceladaNoMP,
    localizarAssinaturaNoMP,
    processarPagamento,
    reconciliarAssinaturas,
    sincronizarAssinatura,
    webhookMercadoPagoAutentico
};
