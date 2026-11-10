const { db } = require('../db/banco');
const { extrairPalavraChave } = require('./importacao');

function normalizarAlteracoesCategorias(alteracoes) {
    if (!Array.isArray(alteracoes) || alteracoes.length === 0 || alteracoes.length > 250) {
        const erro = new Error('Envie de 1 a 250 alterações de categoria.');
        erro.statusCode = 400;
        throw erro;
    }

    const ids = new Set();
    return alteracoes.map((alteracao) => {
        const transacaoId = Number(alteracao?.transacaoId);
        const novaCategoria = String(alteracao?.novaCategoria || '').trim();
        if (!Number.isInteger(transacaoId) || transacaoId <= 0 || !novaCategoria || novaCategoria.length > 120) {
            const erro = new Error('Há uma alteração de categoria inválida.');
            erro.statusCode = 400;
            throw erro;
        }
        if (ids.has(transacaoId)) {
            const erro = new Error('A mesma transação foi enviada mais de uma vez.');
            erro.statusCode = 400;
            throw erro;
        }
        ids.add(transacaoId);
        return { transacaoId, novaCategoria };
    });
}
async function aplicarCorrecoesCategorias(usuarioId, alteracoes) {
    const alteracoesNormalizadas = normalizarAlteracoesCategorias(alteracoes);
    const banco = db.promise();
    let transacaoAberta = false;
    try {
        await banco.beginTransaction();
        transacaoAberta = true;
        let atualizadas = 0;

        for (const alteracao of alteracoesNormalizadas) {
            const [transacoes] = await banco.query(
                `SELECT t.id, t.descricao, t.categoria
                 FROM transacoes t
                 JOIN contas_bancarias cb ON cb.id = t.conta_id
                 WHERE t.id = ? AND cb.usuario_id = ?
                 FOR UPDATE`,
                [alteracao.transacaoId, usuarioId]
            );
            if (!transacoes.length) {
                const erro = new Error('Uma das transações não foi encontrada. Nenhuma categoria foi alterada.');
                erro.statusCode = 404;
                throw erro;
            }

            const transacao = transacoes[0];
            if (String(transacao.categoria || '') === alteracao.novaCategoria) continue;
            await banco.query(
                `UPDATE transacoes t
                 JOIN contas_bancarias cb ON cb.id = t.conta_id
                 SET t.categoria = ?
                 WHERE t.id = ? AND cb.usuario_id = ?`,
                [alteracao.novaCategoria, alteracao.transacaoId, usuarioId]
            );

            const palavraChave = extrairPalavraChave(String(transacao.descricao || ''));
            if (palavraChave) {
                await banco.query(
                    `INSERT INTO regras_categoria (usuario_id, descricao_contem, categoria)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE categoria = VALUES(categoria)`,
                    [usuarioId, palavraChave, alteracao.novaCategoria]
                );
            }
            atualizadas += 1;
        }

        await banco.commit();
        transacaoAberta = false;
        return atualizadas;
    } catch (erro) {
        if (transacaoAberta) {
            try { await banco.rollback(); } catch {}
        }
        throw erro;
    }
}

module.exports = { aplicarCorrecoesCategorias };
