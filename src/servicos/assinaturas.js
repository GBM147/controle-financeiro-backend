const { PreApproval } = require('mercadopago');
const { mpClient } = require('../config/clientes');

// --- ROTA: BUSCAR DADOS DA ASSINATURA ---
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

module.exports = { assinaturaEstaCanceladaNoMP, localizarAssinaturaNoMP };
