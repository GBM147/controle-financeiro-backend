const { criarBancoMysql, criarConfiguracaoMysql } = require('../../mysql-config');

const configuracaoConexaoMysql = criarConfiguracaoMysql();
// --- LIGAÇÃO À BASE DE DADOS MYSQL ---
// Em testes unitários o banco fica indisponível; GBM_TESTE_MYSQL=1 liga os
// testes de integração a um MySQL real (test/integracao.test.js).
const db = process.env.NODE_ENV === 'test' && process.env.GBM_TESTE_MYSQL !== '1'
    ? {
        promise() {
            throw new Error('Banco indisponível em testes sem integração MySQL.');
        },
        async end() {}
    }
    : criarBancoMysql(configuracaoConexaoMysql, {
        limiteConexoes: Number(process.env.DB_POOL_LIMIT) || 5
    });

module.exports = { configuracaoConexaoMysql, db };
