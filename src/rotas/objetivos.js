const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { recalcularStatusObjetivo } = require('../servicos/objetivos');
const { exigirLogin } = require('../web/autorizacao');
const { registrarErro } = require('../servicos/log');

function registrar(app) {
    app.get('/objetivos', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const [objetivos] = await db.promise().query(`
            SELECT
                o.id,
                o.nome,
                o.valor_meta,
                o.prazo,
                o.cor,
                o.status,
                o.criado_em,
                COALESCE(SUM(c.valor), 0) AS valor_guardado
            FROM objetivos_financeiros o
            LEFT JOIN objetivo_contribuicoes c
              ON c.objetivo_id = o.id
             AND c.usuario_id = o.usuario_id
            WHERE o.usuario_id = ?
            GROUP BY o.id, o.nome, o.valor_meta, o.prazo, o.cor, o.status, o.criado_em
            ORDER BY (o.status = 'concluido') ASC, o.prazo IS NULL, o.prazo, o.criado_em DESC
        `, [req.session.userId]);
            res.json(objetivos);
        } catch (erro) {
            registrarErro('Erro ao carregar objetivos:', erro);
            res.status(500).json({ success: false, error: 'Falha ao carregar objetivos.' });
        }
    });
    app.post('/objetivos', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const nome = String(req.body.nome || '').trim();
            const valorMeta = Number(req.body.valor_meta);
            const prazo = req.body.prazo || null;
            const cor = /^#[0-9a-f]{6}$/i.test(req.body.cor || '') ? req.body.cor : '#8b5cf6';
            const valorInicial = Number(req.body.valor_inicial || 0);

            if (!nome || nome.length > 120 || !Number.isFinite(valorMeta) || valorMeta <= 0) {
                return res.status(400).json({ success: false, error: 'Informe um objetivo e um valor válido.' });
            }

            const banco = db.promise();
            await banco.beginTransaction();
            try {
                const [resultado] = await banco.query(
                    `INSERT INTO objetivos_financeiros (usuario_id, nome, valor_meta, prazo, cor)
                 VALUES (?, ?, ?, ?, ?)`,
                    [req.session.userId, nome, valorMeta, prazo, cor]
                );
                if (Number.isFinite(valorInicial) && valorInicial > 0) {
                    await banco.query(
                        `INSERT INTO objetivo_contribuicoes
                        (objetivo_id, usuario_id, valor, data_contribuicao, observacao)
                     VALUES (?, ?, ?, CURRENT_DATE(), 'Valor inicial')`,
                        [resultado.insertId, req.session.userId, valorInicial]
                    );
                }
                await banco.commit();
                res.status(201).json({ success: true, id: resultado.insertId });
            } catch (erroTransacao) {
                await banco.rollback();
                throw erroTransacao;
            }
        } catch (erro) {
            registrarErro('Erro ao criar objetivo:', erro);
            res.status(500).json({ success: false, error: 'Falha ao criar objetivo.' });
        }
    });
    app.put('/objetivos/:id', exigirLogin, async (req, res) => {
        try {
            const nome = String(req.body.nome || '').trim();
            const valorMeta = Number(req.body.valor_meta);
            const prazo = req.body.prazo || null;
            const cor = /^#[0-9a-f]{6}$/i.test(req.body.cor || '') ? req.body.cor : '#8b5cf6';
            const status = req.body.status === 'concluido' ? 'concluido' : 'ativo';
            if (!nome || !Number.isFinite(valorMeta) || valorMeta <= 0) {
                return res.status(400).json({ success: false, error: 'Dados do objetivo inválidos.' });
            }
            const [resultado] = await db.promise().query(
                `UPDATE objetivos_financeiros
             SET nome = ?, valor_meta = ?, prazo = ?, cor = ?, status = ?
             WHERE id = ? AND usuario_id = ?`,
                [nome, valorMeta, prazo, cor, status, req.params.id, req.session.userId]
            );
            if (!resultado.affectedRows) {
                return res.status(404).json({ success: false, error: 'Objetivo não encontrado.' });
            }
            res.json({ success: true });
        } catch (erro) {
            registrarErro('Erro ao atualizar objetivo:', erro);
            res.status(500).json({ success: false, error: 'Falha ao atualizar objetivo.' });
        }
    });
    app.post('/objetivos/:id/contribuicoes', exigirLogin, async (req, res) => {
        try {
            const valor = Number(req.body.valor);
            const data = req.body.data || new Date().toISOString().slice(0, 10);
            const observacao = String(req.body.observacao || '').trim().slice(0, 180) || null;
            if (!Number.isFinite(valor) || valor <= 0) {
                return res.status(400).json({ success: false, error: 'Informe um valor maior que zero.' });
            }
            const [objetivos] = await db.promise().query(
                'SELECT id, valor_meta FROM objetivos_financeiros WHERE id = ? AND usuario_id = ?',
                [req.params.id, req.session.userId]
            );
            if (!objetivos.length) {
                return res.status(404).json({ success: false, error: 'Objetivo não encontrado.' });
            }
            await db.promise().query(
                `INSERT INTO objetivo_contribuicoes
                (objetivo_id, usuario_id, valor, data_contribuicao, observacao)
             VALUES (?, ?, ?, ?, ?)`,
                [req.params.id, req.session.userId, valor, data, observacao]
            );
            const resumo = await recalcularStatusObjetivo(
                db.promise(),
                req.params.id,
                req.session.userId
            );
            res.status(201).json({ success: true, valor_guardado: resumo?.valor_guardado || 0 });
        } catch (erro) {
            registrarErro('Erro ao registrar contribuição:', erro);
            res.status(500).json({ success: false, error: 'Falha ao registrar contribuição.' });
        }
    });
    app.put('/transacoes/:id/objetivo', exigirLogin, async (req, res) => {
        const banco = db.promise();
        let transacaoAberta = false;
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const transacaoId = Number(req.params.id);
            const objetivoId = Number(req.body.objetivo_id);
            if (!Number.isInteger(transacaoId) || transacaoId <= 0 || !Number.isInteger(objetivoId) || objetivoId <= 0) {
                return res.status(400).json({ success: false, error: 'Transação ou objetivo inválido.' });
            }

            await banco.beginTransaction();
            transacaoAberta = true;
            const [transacoes] = await banco.query(
                `SELECT t.id, t.valor, t.tipo, t.data_transacao
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

            const [objetivos] = await banco.query(
                `SELECT id, nome, valor_meta, status
             FROM objetivos_financeiros
             WHERE id = ? AND usuario_id = ?
             FOR UPDATE`,
                [objetivoId, usuarioId]
            );
            if (!objetivos.length) {
                await banco.rollback();
                transacaoAberta = false;
                return res.status(404).json({ success: false, error: 'Objetivo não encontrado.' });
            }
            if (objetivos[0].status !== 'ativo') {
                await banco.rollback();
                transacaoAberta = false;
                return res.status(409).json({
                    success: false,
                    codigo: 'OBJETIVO_NAO_ATIVO',
                    error: 'Escolha um objetivo ativo para vincular a transação.'
                });
            }

            const [vinculos] = await banco.query(
                `SELECT id, objetivo_id
             FROM objetivo_contribuicoes
             WHERE usuario_id = ? AND transacao_id = ?
             FOR UPDATE`,
                [usuarioId, transacaoId]
            );
            if (vinculos.length) {
                if (Number(vinculos[0].objetivo_id) === objetivoId) {
                    const resumo = await recalcularStatusObjetivo(banco, objetivoId, usuarioId);
                    await banco.commit();
                    transacaoAberta = false;
                    return res.json({
                        success: true,
                        idempotente: true,
                        objetivo_id: objetivoId,
                        objetivo_nome: objetivos[0].nome,
                        tipo_transacao: transacoes[0].tipo,
                        valor_guardado: resumo?.valor_guardado || 0
                    });
                }
                await banco.rollback();
                transacaoAberta = false;
                return res.status(409).json({
                    success: false,
                    codigo: 'TRANSACAO_JA_VINCULADA',
                    error: 'Esta transação já está vinculada a outro objetivo.'
                });
            }

            const valorContribuicao = Math.abs(Number(transacoes[0].valor));
            if (!Number.isFinite(valorContribuicao) || valorContribuicao <= 0) {
                await banco.rollback();
                transacaoAberta = false;
                return res.status(400).json({ success: false, error: 'A transação não possui valor válido.' });
            }
            await banco.query(
                `INSERT INTO objetivo_contribuicoes
                (objetivo_id, usuario_id, transacao_id, valor, data_contribuicao, observacao)
             VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    objetivoId,
                    usuarioId,
                    transacaoId,
                    valorContribuicao,
                    transacoes[0].data_transacao,
                    `Transação vinculada #${transacaoId}`
                ]
            );
            const resumo = await recalcularStatusObjetivo(banco, objetivoId, usuarioId);
            await banco.commit();
            transacaoAberta = false;
            res.status(201).json({
                success: true,
                objetivo_id: objetivoId,
                objetivo_nome: objetivos[0].nome,
                tipo_transacao: transacoes[0].tipo,
                valor_contribuicao: valorContribuicao,
                valor_guardado: resumo?.valor_guardado || 0,
                status_objetivo: resumo?.status || 'ativo'
            });
        } catch (erro) {
            if (transacaoAberta) {
                try { await banco.rollback(); } catch {}
            }
            if (erro?.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    codigo: 'TRANSACAO_JA_VINCULADA',
                    error: 'Esta transação já está vinculada a um objetivo.'
                });
            }
            registrarErro('Erro ao vincular transação ao objetivo:', erro);
            res.status(500).json({ success: false, error: 'Falha ao vincular a transação ao objetivo.' });
        }
    });
    app.delete('/transacoes/:id/objetivo', exigirLogin, async (req, res) => {
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

            const [vinculos] = await banco.query(
                `SELECT c.id, c.objetivo_id, o.nome AS objetivo_nome
             FROM objetivo_contribuicoes c
             JOIN objetivos_financeiros o
               ON o.id = c.objetivo_id
              AND o.usuario_id = c.usuario_id
             WHERE c.usuario_id = ? AND c.transacao_id = ?
             FOR UPDATE`,
                [usuarioId, transacaoId]
            );
            if (!vinculos.length) {
                await banco.commit();
                transacaoAberta = false;
                return res.json({ success: true, idempotente: true, desvinculada: true });
            }

            await banco.query(
                'DELETE FROM objetivo_contribuicoes WHERE id = ? AND usuario_id = ? AND transacao_id = ?',
                [vinculos[0].id, usuarioId, transacaoId]
            );
            const resumo = await recalcularStatusObjetivo(banco, vinculos[0].objetivo_id, usuarioId);
            await banco.commit();
            transacaoAberta = false;
            res.json({
                success: true,
                desvinculada: true,
                objetivo_id: vinculos[0].objetivo_id,
                objetivo_nome: vinculos[0].objetivo_nome,
                valor_guardado: resumo?.valor_guardado || 0,
                status_objetivo: resumo?.status || 'ativo'
            });
        } catch (erro) {
            if (transacaoAberta) {
                try { await banco.rollback(); } catch {}
            }
            registrarErro('Erro ao desvincular transação do objetivo:', erro);
            res.status(500).json({ success: false, error: 'Falha ao desvincular a transação do objetivo.' });
        }
    });
    app.get('/objetivos/:id/contribuicoes', exigirLogin, async (req, res) => {
        try {
            const [linhas] = await db.promise().query(
                `SELECT c.id, c.valor, c.data_contribuicao, c.observacao
             FROM objetivo_contribuicoes c
             JOIN objetivos_financeiros o ON o.id = c.objetivo_id
             WHERE c.objetivo_id = ? AND c.usuario_id = ? AND o.usuario_id = ?
             ORDER BY c.data_contribuicao DESC, c.id DESC`,
                [req.params.id, req.session.userId, req.session.userId]
            );
            res.json(linhas);
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao carregar contribuições.' });
        }
    });
    app.delete('/objetivos/:id', exigirLogin, async (req, res) => {
        const banco = db.promise();
        try {
            await banco.beginTransaction();
            await banco.query(
                'DELETE FROM objetivo_contribuicoes WHERE objetivo_id = ? AND usuario_id = ?',
                [req.params.id, req.session.userId]
            );
            const [resultado] = await banco.query(
                'DELETE FROM objetivos_financeiros WHERE id = ? AND usuario_id = ?',
                [req.params.id, req.session.userId]
            );
            await banco.commit();
            if (!resultado.affectedRows) {
                return res.status(404).json({ success: false, error: 'Objetivo não encontrado.' });
            }
            res.json({ success: true });
        } catch (erro) {
            try { await banco.rollback(); } catch {}
            res.status(500).json({ success: false, error: 'Falha ao excluir objetivo.' });
        }
    });
}

module.exports = { registrar };
