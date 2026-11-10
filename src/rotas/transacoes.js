const crypto = require('crypto');
const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { auditarMetas } = require('../servicos/alertas');
const { aplicarCorrecoesCategorias } = require('../servicos/categorias');
const { obterDiaFechamento, sqlAnoCiclo, sqlMesCiclo } = require('../servicos/ciclo');
const { recalcularStatusObjetivo } = require('../servicos/objetivos');
const { exigirLogin } = require('../web/autorizacao');
const { registrarErro } = require('../servicos/log');

function responderErroAlteracaoCategoria(res, erro) {
    const status = Number(erro.statusCode) || 500;
    if (status >= 500) registrarErro('Erro ao corrigir categorias:', erro);
    return res.status(status).json({
        success: false,
        error: status >= 500 ? 'Não foi possível salvar as categorias.' : erro.message
    });
}
function registrar(app) {
    // --- LANÇAMENTO MANUAL ---
    app.post('/transacao-manual', exigirLogin, async (req, res) => {
        try {
            const { conta_id } = req.body;
            const descricao = String(req.body.descricao ?? '').trim();
            const valor = Number(req.body.valor);
            const tipo = req.body.tipo;
            const categoria = String(req.body.categoria ?? '').trim() || 'Outros';
            const data_transacao = String(req.body.data_transacao ?? '');
            const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data_transacao)
                && !Number.isNaN(Date.parse(`${data_transacao}T00:00:00Z`))
                && new Date(`${data_transacao}T00:00:00Z`).toISOString().slice(0, 10) === data_transacao;
            if (!descricao || descricao.length > 255 || categoria.length > 120
                || !Number.isFinite(valor) || valor === 0 || Math.abs(valor) > 9999999999999
                || !['Receita', 'Despesa'].includes(tipo) || !dataValida) {
                return res.status(400).json({
                    success: false,
                    error: 'Confira descrição, valor, tipo, categoria e data do lançamento.'
                });
            }
            const transacaoIdGerado = `MANUAL_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const userId = req.session.userId;
            let contaInternaId;
            if (conta_id) {
                const [contas] = await db.promise().query(
                    'SELECT id FROM contas_bancarias WHERE id = ? AND usuario_id = ? AND ativa = 1',
                    [Number(conta_id), userId]
                );
                if (!contas.length) {
                    return res.status(400).json({ success: false, error: 'Conta inválida.' });
                }
                contaInternaId = contas[0].id;
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Selecione a conta do lançamento.'
                });
            }
            const valorFinal = Math.abs(valor);
            const sql = `INSERT INTO transacoes (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria, data_transacao, banco)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            await db.promise().query(sql, [contaInternaId, transacaoIdGerado, descricao, valorFinal, tipo, categoria, data_transacao, 'Manual']);
            await auditarMetas(userId);
            res.json({ success: true, message: 'Lançamento inserido no MySQL!' });
        } catch (error) {
            registrarErro("Erro ao salvar lançamento manual:", error);
            res.status(500).json({ error: 'Falha ao processar lançamento.' });
        }
    });
    // --- ROTA: ATUALIZAR CATEGORIA DE UMA TRANSAÇÃO ---
    app.put('/atualizar-categoria/:id', exigirLogin, async (req, res) => {
        const { id } = req.params;
        const { categoria } = req.body;
        const userId = req.session.userId;
        try {
            const [result] = await db.promise().query(
                `UPDATE transacoes t
             JOIN contas_bancarias cb ON t.conta_id = cb.id
             SET t.categoria = ?
             WHERE t.id = ? AND cb.usuario_id = ?`,
                [categoria, id, userId]
            );
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Transação não encontrada para este usuário.' });
            }
            res.json({ success: true });
        } catch (err) {
            registrarErro('Erro ao desfazer lançamento:', err);
            res.status(500).json({ success: false });
        }
    });
    // --- ROTA PARA DESFAZER O ÚLTIMO LANÇAMENTO (VERSÃO CORRIGIDA) ---
    app.delete('/desfazer-ultimo', exigirLogin, async (req, res) => {
        try {
            const userId = req.session.userId;
            const contaId = Number(req.body?.conta_id || 0);
            let sql = `
            SELECT t.id
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ?
        `;
            const parametros = [userId];
            if (contaId > 0) {
                sql += ' AND t.conta_id = ?';
                parametros.push(contaId);
            }
            sql += ' ORDER BY t.id DESC LIMIT 1';
            const [linhas] = await db.promise().query(sql, parametros);
            if (!linhas.length) {
                return res.status(404).json({ success: false, error: 'Nenhum lançamento encontrado.' });
            }
            await db.promise().query('DELETE FROM transacoes WHERE id = ?', [linhas[0].id]);
            res.status(200).json({ success: true, message: 'Último lançamento desfeito com sucesso!' });
        } catch (err) {
            registrarErro('Erro ao desfazer transação:', err);
            res.status(500).json({ success: false, error: 'Erro ao excluir no banco de dados.' });
        }
    });
    // Buscar transações individuais do mês para o modal
    app.get('/transacoes-individuais', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const userId = req.session.userId;
            const mes = req.query.mes || new Date().getMonth() + 1;
            const ano = req.query.ano || new Date().getFullYear();
            const contaId = Number(req.query.conta_id || 0);
            const diaFechamento = await obterDiaFechamento(userId);
            let sql = `
            SELECT
                t.id,
                t.descricao,
                t.valor,
                t.tipo,
                t.categoria,
                t.data_transacao,
                t.banco,
                oc.id AS contribuicao_objetivo_id,
                o.id AS objetivo_id,
                o.nome AS objetivo_nome
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            LEFT JOIN objetivo_contribuicoes oc
              ON oc.transacao_id = t.id
             AND oc.usuario_id = cb.usuario_id
            LEFT JOIN objetivos_financeiros o
              ON o.id = oc.objetivo_id
             AND o.usuario_id = cb.usuario_id
            WHERE cb.usuario_id = ? AND ${sqlMesCiclo('t.data_transacao', diaFechamento)} = ? AND ${sqlAnoCiclo('t.data_transacao', diaFechamento)} = ?
        `;
            const parametros = [userId, mes, ano];
            if (contaId > 0) {
                sql += ' AND t.conta_id = ?';
                parametros.push(contaId);
            }
            sql += ' ORDER BY t.data_transacao DESC';
            const [transacoes] = await db.promise().query(sql, parametros);
            res.json(transacoes);
        } catch (err) {
            res.status(500).json({ error: 'Erro ao buscar transações.' });
        }
    });
    // Compatibilidade com versões antigas do painel que ainda enviam uma alteração por vez.
    app.post('/corrigir-categoria', exigirLogin, async (req, res) => {
        try {
            const atualizadas = await aplicarCorrecoesCategorias(req.session.userId, [{
                transacaoId: req.body?.transacaoId,
                novaCategoria: req.body?.novaCategoria
            }]);
            await auditarMetas(req.session.userId);
            res.json({ success: true, atualizadas });
        } catch (erro) {
            responderErroAlteracaoCategoria(res, erro);
        }
    });
    // Salva todas as categorias alteradas no modal em uma única confirmação.
    app.post('/corrigir-categorias', exigirLogin, async (req, res) => {
        try {
            const atualizadas = await aplicarCorrecoesCategorias(
                req.session.userId,
                req.body?.alteracoes
            );
            await auditarMetas(req.session.userId);
            res.json({ success: true, atualizadas });
        } catch (erro) {
            responderErroAlteracaoCategoria(res, erro);
        }
    });
    // Exclui somente a movimentação escolhida, sem apagar sua recorrência ou importação de origem.
    app.delete('/transacoes/:id', exigirLogin, async (req, res) => {
        const banco = db.promise();
        let transacaoAberta = false;
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const transacaoId = Number(req.params.id);
            if (!Number.isInteger(transacaoId) || transacaoId <= 0) {
                return res.status(400).json({ success: false, error: 'Transação inválida.' });
            }

            await banco.beginTransaction();
            transacaoAberta = true;
            const [transacoes] = await banco.query(
                `SELECT t.id
             FROM transacoes t
             JOIN contas_bancarias cb ON cb.id = t.conta_id
             WHERE t.id = ? AND cb.usuario_id = ?
             FOR UPDATE`,
                [transacaoId, usuarioId]
            );
            if (!transacoes.length) {
                await banco.rollback();
                transacaoAberta = false;
                return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
            }

            const [contribuicoes] = await banco.query(
                `SELECT objetivo_id
             FROM objetivo_contribuicoes
             WHERE usuario_id = ? AND transacao_id = ?
             FOR UPDATE`,
                [usuarioId, transacaoId]
            );
            await banco.query(
                'DELETE FROM objetivo_contribuicoes WHERE usuario_id = ? AND transacao_id = ?',
                [usuarioId, transacaoId]
            );
            const [resultado] = await banco.query(
                `DELETE t
             FROM transacoes t
             JOIN contas_bancarias cb ON cb.id = t.conta_id
             WHERE t.id = ? AND cb.usuario_id = ?`,
                [transacaoId, usuarioId]
            );
            if (resultado.affectedRows !== 1) {
                throw new Error('A transação não pôde ser excluída.');
            }

            const objetivosAfetados = [...new Set(
                contribuicoes.map((contribuicao) => Number(contribuicao.objetivo_id)).filter(Number.isInteger)
            )];
            for (const objetivoId of objetivosAfetados) {
                await recalcularStatusObjetivo(banco, objetivoId, usuarioId);
            }

            await banco.commit();
            transacaoAberta = false;
            await auditarMetas(req.session.userId);
            res.json({ success: true, excluida: true, transacaoId });
        } catch (erro) {
            if (transacaoAberta) {
                try { await banco.rollback(); } catch {}
            }
            registrarErro('Erro ao excluir transação:', erro);
            res.status(500).json({ success: false, error: 'Não foi possível excluir a movimentação.' });
        }
    });
}

module.exports = { registrar };
