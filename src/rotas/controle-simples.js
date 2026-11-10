const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { normalizarDataBancaria } = require('../servicos/importacao');
const { exigirLogin } = require('../web/autorizacao');

function registrar(app) {
    app.get('/controle-simples', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const ano = Number(req.query.ano) || new Date().getFullYear();
            const mes = Number(req.query.mes) || (new Date().getMonth() + 1);

            const [itens] = await db.promise().query(
                `SELECT id, data, descricao, valor, status
             FROM controle_simples_itens
             WHERE usuario_id = ? AND YEAR(data) = ? AND MONTH(data) = ?
             ORDER BY data, id`,
                [usuarioId, ano, mes]
            );
            const [rendaLinhas] = await db.promise().query(
                'SELECT renda FROM controle_simples_renda WHERE usuario_id = ? AND ano = ? AND mes = ?',
                [usuarioId, ano, mes]
            );
            const total = itens.reduce((soma, item) => soma + Number(item.valor), 0);
            const renda = rendaLinhas.length ? Number(rendaLinhas[0].renda) : 0;
            res.json({ ano, mes, itens, renda, total, sobra: renda - total });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao carregar o controle simples.' });
        }
    });
    app.post('/controle-simples', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const data = String(req.body.data || '').slice(0, 10);
            const descricao = String(req.body.descricao || '').trim().slice(0, 180);
            const valor = Number(req.body.valor);
            const status = req.body.status === 'pago' ? 'pago' : 'pendente';
            if (!descricao || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(valor) || valor <= 0) {
                return res.status(400).json({ success: false, error: 'Preencha data, descrição e valor corretamente.' });
            }
            const [resultado] = await db.promise().query(
                `INSERT INTO controle_simples_itens (usuario_id, data, descricao, valor, status)
             VALUES (?, ?, ?, ?, ?)`,
                [usuarioId, data, descricao, valor, status]
            );
            res.status(201).json({ success: true, id: resultado.insertId });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao adicionar item.' });
        }
    });
    app.post('/controle-simples/importar-extrato', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
            if (!itens.length) return res.status(400).json({ success: false, error: 'Nenhum item selecionado.' });
            if (itens.length > 500) return res.status(400).json({ success: false, error: 'Envie no máximo 500 itens por vez.' });

            let inseridos = 0;
            for (const item of itens) {
                const data = normalizarDataBancaria(item.data) || String(item.data || '').slice(0, 10);
                const descricao = String(item.descricao || '').trim().slice(0, 180);
                const valor = Number(item.valor);
                if (!descricao || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(valor) || valor <= 0) continue;
                await db.promise().query(
                    `INSERT INTO controle_simples_itens (usuario_id, data, descricao, valor, status)
                 VALUES (?, ?, ?, ?, 'pago')`,
                    [usuarioId, data, descricao, valor]
                );
                inseridos += 1;
            }
            res.status(201).json({ success: true, inseridos });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao lançar o extrato.' });
        }
    });
    app.put('/controle-simples/:id', exigirLogin, async (req, res) => {
        try {
            const usuarioId = req.session.userId;
            const campos = [];
            const valores = [];
            if (req.body.descricao !== undefined) {
                campos.push('descricao = ?');
                valores.push(String(req.body.descricao).trim().slice(0, 180));
            }
            if (req.body.valor !== undefined) {
                const valor = Number(req.body.valor);
                if (!Number.isFinite(valor) || valor <= 0) return res.status(400).json({ success: false, error: 'Valor inválido.' });
                campos.push('valor = ?');
                valores.push(valor);
            }
            if (req.body.data !== undefined) {
                const data = String(req.body.data).slice(0, 10);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ success: false, error: 'Data inválida.' });
                campos.push('data = ?');
                valores.push(data);
            }
            if (req.body.status !== undefined) {
                campos.push('status = ?');
                valores.push(req.body.status === 'pago' ? 'pago' : 'pendente');
            }
            if (!campos.length) return res.status(400).json({ success: false, error: 'Nada para atualizar.' });
            valores.push(req.params.id, usuarioId);
            const [resultado] = await db.promise().query(
                `UPDATE controle_simples_itens SET ${campos.join(', ')} WHERE id = ? AND usuario_id = ?`,
                valores
            );
            if (!resultado.affectedRows) return res.status(404).json({ success: false, error: 'Item não encontrado.' });
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao atualizar item.' });
        }
    });
    app.delete('/controle-simples/:id', exigirLogin, async (req, res) => {
        try {
            const [resultado] = await db.promise().query(
                'DELETE FROM controle_simples_itens WHERE id = ? AND usuario_id = ?',
                [req.params.id, req.session.userId]
            );
            if (!resultado.affectedRows) return res.status(404).json({ success: false, error: 'Item não encontrado.' });
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao excluir item.' });
        }
    });
    app.put('/controle-simples/renda/definir', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const ano = Number(req.body.ano);
            const mes = Number(req.body.mes);
            const renda = Number(req.body.renda);
            if (!ano || !mes || !Number.isFinite(renda) || renda < 0) {
                return res.status(400).json({ success: false, error: 'Informe ano, mês e um valor de renda válido.' });
            }
            await db.promise().query(
                `INSERT INTO controle_simples_renda (usuario_id, ano, mes, renda)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE renda = VALUES(renda)`,
                [usuarioId, ano, mes, renda]
            );
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao salvar a renda do mês.' });
        }
    });
}

module.exports = { registrar };
