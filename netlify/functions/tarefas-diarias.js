'use strict';

// Tarefa agendada (netlify.toml): todos os dias às 08:00 de Brasília.
// Substitui o node-cron do servidor: avisos de limite e recorrências vencidas.
const { auditarMetas } = require('../../src/servicos/alertas');
const { gerarRecorrenciasVencidas } = require('../../src/servicos/recorrencias');

exports.handler = async () => {
    await auditarMetas();
    const quantidade = await gerarRecorrenciasVencidas();
    if (quantidade) console.log(`${quantidade} transação(ões) recorrente(s) gerada(s).`);
    return { statusCode: 200 };
};
