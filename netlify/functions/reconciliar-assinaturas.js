'use strict';

// Tarefa agendada (netlify.toml): todos os dias às 04:10 de Brasília.
// Confere no Mercado Pago as assinaturas cuja notificação pode ter se perdido.
const { reconciliarAssinaturas } = require('../../src/servicos/assinaturas');

exports.handler = async () => {
    const { verificadas, corrigidas } = await reconciliarAssinaturas();
    console.log(`Assinaturas verificadas: ${verificadas}; status corrigidos: ${corrigidas}.`);
    return { statusCode: 200 };
};
