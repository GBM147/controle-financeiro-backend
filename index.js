require('dotenv').config();
const cron = require('node-cron');
const { app } = require('./src/app');
const { db } = require('./src/db/banco');
const { prepararBanco } = require('./src/db/migracoes');
const { auditarMetas } = require('./src/servicos/alertas');
const { gerarRecorrenciasVencidas } = require('./src/servicos/recorrencias');
const { sessionStore } = require('./src/web/sessao');

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    const servidor = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });

    prepararBanco()
        .then(() => console.log('Banco de dados MySQL pronto e estruturas automáticas atualizadas.'))
        .catch((erro) => console.error('Erro ao preparar o banco de dados:', erro.code || erro.message));

    // Roda a auditoria de metas todos os dias às 08:00 no horário de São Paulo.
    const tarefaDiaria = cron.schedule('0 8 * * *', () => {
        console.log('Rodando auditoria diária de metas...');
        auditarMetas();
        gerarRecorrenciasVencidas()
            .then((quantidade) => {
                if (quantidade) console.log(`${quantidade} transação(ões) recorrente(s) gerada(s).`);
            })
            .catch((erro) => console.error('Erro ao gerar recorrências:', erro.code || erro.message));
    }, { timezone: 'America/Sao_Paulo' });

    // Uma promessa esquecida sem tratamento não derruba o atendimento dos demais usuários.
    process.on('unhandledRejection', (motivo) => {
        console.error('Promessa rejeitada sem tratamento:', motivo?.code || motivo?.message || motivo);
    });

    // O Render envia SIGTERM antes de substituir a instância em um deploy:
    // termina as requisições em andamento e fecha as conexões com o banco.
    let encerrando = false;
    const encerrar = (sinal) => {
        if (encerrando) return;
        encerrando = true;
        console.log(`${sinal} recebido; encerrando o servidor.`);
        tarefaDiaria.stop();
        setTimeout(() => process.exit(1), 10000).unref();
        servidor.close(() => {
            Promise.allSettled([db.end(), sessionStore.close?.()])
                .finally(() => process.exit(0));
        });
    };
    process.on('SIGTERM', () => encerrar('SIGTERM'));
    process.on('SIGINT', () => encerrar('SIGINT'));
}

module.exports = { app, db, prepararBanco };
