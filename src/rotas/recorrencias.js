const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { gerarRecorrenciasVencidas } = require('../servicos/recorrencias');
const { exigirLogin } = require('../web/autorizacao');
const { registrarErro } = require('../servicos/log');

function registrar(app) {
    app.get('/recorrencias', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const [linhas] = await db.promise().query(`
            SELECT
                r.*,
                COALESCE(NULLIF(cb.nome_personalizado, ''), NULLIF(cb.banco, ''), CONCAT('Conta ', cb.id)) AS conta
            FROM transacoes_recorrentes r
            JOIN contas_bancarias cb ON cb.id = r.conta_id AND cb.usuario_id = r.usuario_id
            WHERE r.usuario_id = ?
            ORDER BY r.ativa DESC, r.dia_mes, r.descricao
        `, [req.session.userId]);
            res.json(linhas);
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao carregar recorrências.' });
        }
    });
    app.post('/recorrencias', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const contaId = Number(req.body.conta_id);
            const descricao = String(req.body.descricao || '').trim().slice(0, 180);
            const valor = Number(req.body.valor);
            const tipo = req.body.tipo === 'Receita' ? 'Receita' : 'Despesa';
            const categoria = String(req.body.categoria || 'Outros').trim().slice(0, 120);
            const dia = Number(req.body.dia_mes);
            const inicio = req.body.data_inicio || new Date().toISOString().slice(0, 10);
            const fim = req.body.data_fim || null;
            const [contas] = await db.promise().query(
                'SELECT id FROM contas_bancarias WHERE id = ? AND usuario_id = ?',
                [contaId, req.session.userId]
            );
            if (!contas.length || !descricao || !Number.isFinite(valor) || valor <= 0 || !Number.isInteger(dia) || dia < 1 || dia > 31) {
                return res.status(400).json({ success: false, error: 'Preencha corretamente os dados da recorrência.' });
            }
            const [resultado] = await db.promise().query(
                `INSERT INTO transacoes_recorrentes
                (usuario_id, conta_id, descricao, valor, tipo, categoria, dia_mes, data_inicio, data_fim)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.session.userId, contaId, descricao, valor, tipo, categoria, dia, inicio, fim]
            );
            await gerarRecorrenciasVencidas(req.session.userId);
            res.status(201).json({ success: true, id: resultado.insertId });
        } catch (erro) {
            registrarErro('Erro ao criar recorrência:', erro);
            res.status(500).json({ success: false, error: 'Falha ao criar recorrência.' });
        }
    });
    app.put('/recorrencias/:id', exigirLogin, async (req, res) => {
        try {
            const ativa = req.body.ativa === false || req.body.ativa === 0 ? 0 : 1;
            const [resultado] = await db.promise().query(
                `UPDATE transacoes_recorrentes
             SET ativa = ?
             WHERE id = ? AND usuario_id = ?`,
                [ativa, req.params.id, req.session.userId]
            );
            if (!resultado.affectedRows) {
                return res.status(404).json({ success: false, error: 'Recorrência não encontrada.' });
            }
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao atualizar recorrência.' });
        }
    });
    app.get('/recorrencias/comparativo', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const ano = Number(req.query.ano) || new Date().getFullYear();
            const mes = Number(req.query.mes) || (new Date().getMonth() + 1);
            const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
            const ultimoDia = new Date(ano, mes, 0).getDate();

            const [recorrencias] = await db.promise().query(
                `SELECT r.*
             FROM transacoes_recorrentes r
             JOIN contas_bancarias cb ON cb.id = r.conta_id AND cb.usuario_id = r.usuario_id
             WHERE r.usuario_id = ?
               AND r.ativa = 1
               AND r.data_inicio <= LAST_DAY(?)
               AND (r.data_fim IS NULL OR r.data_fim >= ?)
             ORDER BY r.dia_mes, r.descricao`,
                [usuarioId, inicioMes, inicioMes]
            );

            const [confirmacoes] = await db.promise().query(
                `SELECT recorrencia_id, confirmado_manual FROM recorrencias_confirmacoes
             WHERE usuario_id = ? AND ano = ? AND mes = ?`,
                [usuarioId, ano, mes]
            );
            const mapaConfirmacoes = new Map(confirmacoes.map((c) => [Number(c.recorrencia_id), Number(c.confirmado_manual)]));

            const linhas = [];
            let totalGeral = 0;
            for (const item of recorrencias) {
                const dia = Math.min(Number(item.dia_mes), ultimoDia);
                const dataEsperada = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

                // Compara com as movimentações reais da conta (não depende de vínculo por recorrencia_id)
                const [transacoes] = await db.promise().query(
                    `SELECT valor, data_transacao FROM transacoes
                 WHERE conta_id = ?
                   AND tipo = ?
                   AND YEAR(data_transacao) = ? AND MONTH(data_transacao) = ?
                   AND ABS(valor - ?) <= GREATEST(1, ? * 0.05)
                 ORDER BY ABS(DATEDIFF(data_transacao, ?)) ASC
                 LIMIT 1`,
                    [item.conta_id, item.tipo, ano, mes, item.valor, item.valor, dataEsperada]
                );
                const real = transacoes[0] || null;
                const manual = mapaConfirmacoes.has(Number(item.id)) ? mapaConfirmacoes.get(Number(item.id)) : null;
                const pago = manual !== null ? Boolean(manual) : Boolean(real);

                totalGeral += Number(item.valor);
                linhas.push({
                    id: item.id,
                    data: dataEsperada,
                    descricao: item.descricao,
                    valor: Number(item.valor),
                    tipo: item.tipo,
                    pago,
                    origem_status: manual !== null ? 'manual' : (real ? 'detectado' : 'pendente'),
                    valor_real: real ? Number(real.valor) : null
                });
            }

            const [receitasLinhas] = await db.promise().query(
                `SELECT COALESCE(SUM(t.valor), 0) AS total FROM transacoes t
             JOIN contas_bancarias cb ON cb.id = t.conta_id
             WHERE cb.usuario_id = ? AND t.tipo = 'Receita' AND YEAR(t.data_transacao) = ? AND MONTH(t.data_transacao) = ?`,
                [usuarioId, ano, mes]
            );
            const renda = Number(receitasLinhas[0].total || 0);

            res.json({ ano, mes, linhas, total: totalGeral, renda, sobra: renda - totalGeral });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao montar comparativo.' });
        }
    });
    app.put('/recorrencias/:id/status-mensal', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const recorrenciaId = Number(req.params.id);
            const ano = Number(req.body.ano);
            const mes = Number(req.body.mes);
            const pago = req.body.pago ? 1 : 0;
            if (!ano || !mes) return res.status(400).json({ success: false, error: 'Ano e mês são obrigatórios.' });

            const [dono] = await db.promise().query(
                'SELECT id FROM transacoes_recorrentes WHERE id = ? AND usuario_id = ?',
                [recorrenciaId, usuarioId]
            );
            if (!dono.length) return res.status(404).json({ success: false, error: 'Recorrência não encontrada.' });

            await db.promise().query(
                `INSERT INTO recorrencias_confirmacoes (usuario_id, recorrencia_id, ano, mes, confirmado_manual)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE confirmado_manual = VALUES(confirmado_manual)`,
                [usuarioId, recorrenciaId, ano, mes, pago]
            );
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao atualizar status.' });
        }
    });
    app.delete('/recorrencias/:id', exigirLogin, async (req, res) => {
        try {
            const [resultado] = await db.promise().query(
                'DELETE FROM transacoes_recorrentes WHERE id = ? AND usuario_id = ?',
                [req.params.id, req.session.userId]
            );
            if (!resultado.affectedRows) {
                return res.status(404).json({ success: false, error: 'Recorrência não encontrada.' });
            }
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao excluir recorrência.' });
        }
    });
}

module.exports = { registrar };
