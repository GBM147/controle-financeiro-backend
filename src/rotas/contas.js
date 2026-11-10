const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { exigirLogin } = require('../web/autorizacao');
const { registrarErro } = require('../servicos/log');

function registrar(app) {
    // =======================================================
    // --- CENTRAL DE CONTAS BANCÁRIAS ---
    // =======================================================
    app.get('/contas', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const [contas] = await db.promise().query(`
            SELECT
                cb.id,
                COALESCE(NULLIF(cb.nome_personalizado, ''), NULLIF(cb.banco, ''), MAX(NULLIF(t.banco, '')), CONCAT('Conta ', cb.id)) AS nome,
                cb.nome_personalizado,
                cb.banco,
                cb.tipo_conta,
                cb.saldo,
                cb.ativa,
                COUNT(t.id) AS quantidade_transacoes,
                MAX(t.data_transacao) AS ultima_movimentacao,
                COALESCE(SUM(CASE WHEN t.tipo = 'Receita' THEN t.valor ELSE 0 END), 0) AS total_receitas,
                COALESCE(SUM(CASE WHEN t.tipo = 'Despesa' THEN t.valor ELSE 0 END), 0) AS total_despesas
            FROM contas_bancarias cb
            LEFT JOIN transacoes t ON t.conta_id = cb.id
            WHERE cb.usuario_id = ?
            GROUP BY cb.id, cb.nome_personalizado, cb.banco, cb.tipo_conta, cb.saldo, cb.ativa
            ORDER BY cb.ativa DESC, nome
        `, [req.session.userId]);
            res.json(contas);
        } catch (erro) {
            registrarErro('Erro ao carregar contas:', erro);
            res.status(500).json({ success: false, error: 'Falha ao carregar contas.' });
        }
    });
    app.post('/contas', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const nome = String(req.body.nome || '').trim();
            const banco = String(req.body.banco || '').trim() || null;
            const tipo = String(req.body.tipo_conta || 'corrente').trim();
            const saldo = Number(req.body.saldo_inicial || 0);
            if (!nome || nome.length > 120 || !Number.isFinite(saldo)) {
                return res.status(400).json({ success: false, error: 'Informe um nome e um saldo válido.' });
            }
            const [resultado] = await db.promise().query(
                `INSERT INTO contas_bancarias
                (usuario_id, saldo, nome_personalizado, banco, tipo_conta, ativa)
             VALUES (?, ?, ?, ?, ?, 1)`,
                [req.session.userId, saldo, nome, banco, tipo]
            );
            res.status(201).json({ success: true, id: resultado.insertId });
        } catch (erro) {
            registrarErro('Erro ao criar conta:', erro);
            res.status(500).json({ success: false, error: 'Falha ao criar conta.' });
        }
    });
    app.put('/contas/:id', exigirLogin, async (req, res) => {
        try {
            const nome = String(req.body.nome || '').trim();
            const banco = String(req.body.banco || '').trim() || null;
            const tipo = String(req.body.tipo_conta || 'corrente').trim();
            const ativa = req.body.ativa === false || req.body.ativa === 0 ? 0 : 1;
            if (!nome || nome.length > 120) {
                return res.status(400).json({ success: false, error: 'Informe um nome válido.' });
            }
            const [resultado] = await db.promise().query(
                `UPDATE contas_bancarias
             SET nome_personalizado = ?, banco = ?, tipo_conta = ?, ativa = ?
             WHERE id = ? AND usuario_id = ?`,
                [nome, banco, tipo, ativa, req.params.id, req.session.userId]
            );
            if (!resultado.affectedRows) {
                return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
            }
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao atualizar conta.' });
        }
    });
    app.delete('/contas/:id', exigirLogin, async (req, res) => {
        const banco = db.promise();
        try {
            const contaId = Number(req.params.id);
            const moverPara = Number(req.body?.mover_para || 0);
            const excluirTransacoes = req.body?.excluir_transacoes === true;
            const [contas] = await banco.query(
                'SELECT id FROM contas_bancarias WHERE id = ? AND usuario_id = ?',
                [contaId, req.session.userId]
            );
            if (!contas.length) {
                return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
            }
            const [[contagem]] = await banco.query(
                `SELECT
                (SELECT COUNT(*) FROM transacoes WHERE conta_id = ?) +
                (SELECT COUNT(*) FROM importacoes_extratos WHERE conta_id = ? AND usuario_id = ?) +
                (SELECT COUNT(*) FROM transacoes_recorrentes WHERE conta_id = ? AND usuario_id = ?) AS total`,
                [contaId, contaId, req.session.userId, contaId, req.session.userId]
            );
            if (Number(contagem.total) > 0 && !moverPara && !excluirTransacoes) {
                return res.status(409).json({
                    success: false,
                    codigo: 'CONTA_COM_TRANSACOES',
                    error: 'A conta possui transações, importações ou recorrências. Escolha outra conta para mover os dados ou confirme a exclusão.'
                });
            }

            await banco.beginTransaction();
            if (moverPara) {
                const [destino] = await banco.query(
                    'SELECT id FROM contas_bancarias WHERE id = ? AND usuario_id = ? AND id <> ?',
                    [moverPara, req.session.userId, contaId]
                );
                if (!destino.length) throw new Error('Conta de destino inválida.');
                await banco.query('UPDATE transacoes SET conta_id = ? WHERE conta_id = ?', [moverPara, contaId]);
                await banco.query(
                    'UPDATE importacoes_extratos SET conta_id = ? WHERE conta_id = ? AND usuario_id = ?',
                    [moverPara, contaId, req.session.userId]
                );
                await banco.query(
                    'UPDATE transacoes_recorrentes SET conta_id = ? WHERE conta_id = ? AND usuario_id = ?',
                    [moverPara, contaId, req.session.userId]
                );
            } else if (excluirTransacoes) {
                await banco.query('DELETE FROM transacoes WHERE conta_id = ?', [contaId]);
                await banco.query(
                    'DELETE FROM importacoes_extratos WHERE conta_id = ? AND usuario_id = ?',
                    [contaId, req.session.userId]
                );
                await banco.query(
                    'DELETE FROM transacoes_recorrentes WHERE conta_id = ? AND usuario_id = ?',
                    [contaId, req.session.userId]
                );
            }
            await banco.query(
                'DELETE FROM contas_bancarias WHERE id = ? AND usuario_id = ?',
                [contaId, req.session.userId]
            );
            await banco.commit();
            res.json({ success: true });
        } catch (erro) {
            try { await banco.rollback(); } catch {}
            registrarErro('Erro ao excluir conta bancária:', erro);
            if (erro.message === 'Conta de destino inválida.') {
                return res.status(400).json({ success: false, error: erro.message });
            }
            res.status(500).json({ success: false, error: 'Falha ao excluir conta.' });
        }
    });
}

module.exports = { registrar };
