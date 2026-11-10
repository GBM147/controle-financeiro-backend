const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');

// =======================================================
// --- RECORRÊNCIAS E CALENDÁRIO FINANCEIRO ---
// =======================================================
async function gerarRecorrenciasVencidas(usuarioId = null) {
    await garantirEstruturaProduto();
    const parametros = [];
    let filtroUsuario = '';
    if (usuarioId) {
        filtroUsuario = 'AND r.usuario_id = ?';
        parametros.push(usuarioId);
    }
    const [recorrencias] = await db.promise().query(`
        SELECT r.*
        FROM transacoes_recorrentes r
        JOIN contas_bancarias cb
          ON cb.id = r.conta_id
         AND cb.usuario_id = r.usuario_id
        WHERE r.ativa = 1
          AND r.data_inicio <= LAST_DAY(CURRENT_DATE())
          AND (r.data_fim IS NULL OR r.data_fim >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'))
          ${filtroUsuario}
    `, parametros);

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    let geradas = 0;

    for (const item of recorrencias) {
        const dia = Math.min(Number(item.dia_mes), ultimoDia);
        const vencimento = new Date(ano, mes, dia);
        if (vencimento > hoje) continue;
        const data = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        if (new Date(item.data_inicio) > vencimento) continue;
        if (item.data_fim && new Date(item.data_fim) < vencimento) continue;
                // Tenta vincular a um lançamento real já importado antes de criar um placeholder
        const [reais] = await db.promise().query(
            `SELECT id FROM transacoes
             WHERE conta_id = ?
               AND recorrencia_id IS NULL
               AND tipo = ?
               AND ABS(valor - ?) <= GREATEST(1, ? * 0.03)
               AND ABS(DATEDIFF(data_transacao, ?)) <= 5
             ORDER BY ABS(DATEDIFF(data_transacao, ?)) ASC
             LIMIT 1`,
            [item.conta_id, item.tipo, item.valor, item.valor, data, data]
        );
        if (reais.length) {
            await db.promise().query('UPDATE transacoes SET recorrencia_id = ? WHERE id = ?', [item.id, reais[0].id]);
            continue;
        }
        const idUnico = `recorrencia-${item.id}-${ano}-${String(mes + 1).padStart(2, '0')}`;
        const [resultado] = await db.promise().query(
            `INSERT INTO transacoes
                (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria,
                 data_transacao, banco, recorrencia_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Recorrente', ?)
             ON DUPLICATE KEY UPDATE id = id`,
            [
                item.conta_id,
                idUnico,
                item.descricao,
                item.valor,
                item.tipo,
                item.categoria,
                data,
                item.id
            ]
        );
        if (resultado.affectedRows === 1) geradas += 1;
    }
    return geradas;
}

module.exports = { gerarRecorrenciasVencidas };
