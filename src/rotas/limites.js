const { db } = require('../db/banco');
const { garantirEstruturaAlertasMultiplos } = require('../db/migracoes');
const { auditarMetas } = require('../servicos/alertas');
const { obterDiaFechamento, sqlAnoCiclo, sqlMesCiclo } = require('../servicos/ciclo');
const { exigirLogin } = require('../web/autorizacao');
const { registrarErro } = require('../servicos/log');

function registrar(app) {
    // --- NOVA ROTA: SALVAR/ATUALIZAR METAS DO USUÁRIO ---
    app.post('/metas', exigirLogin, async (req, res) => {
        try {
            const { categoria, valor_limite } = req.body;
            const userId = req.session.userId;
            const sql = `
            INSERT INTO metas (categoria, valor_limite, usuario_id) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE valor_limite = VALUES(valor_limite), usuario_id = VALUES(usuario_id)
        `;
            await db.promise().query(sql, [categoria, valor_limite, userId]);
            console.log(`Nova meta definida: ${categoria} -> R$ ${valor_limite}`);
            res.json({ success: true, message: 'Orçamento atualizado!' });
        } catch (error) {
            registrarErro("Erro ao salvar meta:", error);
            res.status(500).json({ error: 'Falha ao salvar meta' });
        }
    });
    // --- NOVA ROTA: REMOVER LIMITE (TORNAR GASTO FIXO / SEM LIMITE) ---
    app.delete('/metas', exigirLogin, async (req, res) => {
        try {
            const { categoria } = req.body;
            const userId = req.session.userId;
            await db.promise().query('DELETE FROM metas WHERE categoria = ? AND usuario_id = ?', [categoria, userId]);
            console.log(`Limite removido. A categoria [${categoria}] agora é um gasto fixo.`);
            res.json({ success: true, message: 'Limite removido com sucesso!' });
        } catch (error) {
            registrarErro("Erro ao remover meta:", error);
            res.status(500).json({ error: 'Falha ao remover meta' });
        }
    });
    app.get('/configuracoes-alerta', exigirLogin, async (req, res) => {
        try {
            const [rows] = await db.promise().query('SELECT percentual_alerta FROM preferencias_notificacao WHERE id = 1');
            res.json(rows[0] || { percentual_alerta: 80 });
        } catch (error) {
            registrarErro('Erro ao buscar configurações de alerta:', error);
            res.status(500).json({ percentual_alerta: 80 });
        }
    });
    app.post('/configuracoes-alerta', exigirLogin, async (req, res) => {
        try {
            const { percentual } = req.body;
            await db.promise().query('UPDATE preferencias_notificacao SET percentual_alerta = ? WHERE id = 1', [percentual]);
            res.json({ success: true });
        } catch (error) {
            registrarErro('Erro ao salvar configurações de alerta:', error);
            res.status(500).json({ success: false });
        }
    });
    app.get('/alertas', exigirLogin, async (req, res) => {
        try {
            const userId = req.session.userId;
            const [rows] = await db.promise().query(
                'SELECT * FROM alertas WHERE usuario_id = ? ORDER BY data_criacao DESC LIMIT 50',
                [userId]
            );
            res.json(rows);
        } catch (error) {
            registrarErro('Erro ao buscar alertas:', error);
            res.status(500).json({ error: 'Falha ao buscar alertas.' });
        }
    });
    app.post('/alertas/marcar-lida', exigirLogin, async (req, res) => {
        try {
            const { id } = req.body;
            const userId = req.session.userId;
            await db.promise().query('UPDATE alertas SET lida = TRUE WHERE id = ? AND usuario_id = ?', [id, userId]);
            res.json({ success: true });
        } catch (error) {
            registrarErro('Erro ao marcar alerta como lido:', error);
            res.status(500).json({ success: false });
        }
    });
    app.get('/metas-resumo', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaAlertasMultiplos();
            const userId = req.session.userId;
            const diaFechamento = await obterDiaFechamento(userId);
            const sql = `
            SELECT
                m.categoria,
                m.valor_limite AS limite,
                m.percentual_alerta,
                IFNULL(SUM(
                    CASE WHEN t.tipo = 'Despesa' THEN ABS(t.valor) ELSE 0 END
                ), 0) AS gasto
            FROM metas m
            LEFT JOIN contas_bancarias cb
              ON cb.usuario_id = m.usuario_id
            LEFT JOIN transacoes t
              ON t.conta_id = cb.id
             AND t.categoria = m.categoria
             AND ${sqlMesCiclo('t.data_transacao', diaFechamento)} = ${sqlMesCiclo('CURRENT_DATE()', diaFechamento)}
             AND ${sqlAnoCiclo('t.data_transacao', diaFechamento)} = ${sqlAnoCiclo('CURRENT_DATE()', diaFechamento)}
            WHERE m.usuario_id = ?
            GROUP BY m.categoria, m.valor_limite, m.percentual_alerta
        `;
            const [rows] = await db.promise().query(sql, [userId]);
            const [faixas] = await db.promise().query(
                `SELECT categoria, percentual
             FROM metas_alertas_percentuais
             WHERE usuario_id = ?
             ORDER BY categoria, percentual`,
                [userId]
            );

            const faixasPorCategoria = new Map();
            for (const faixa of faixas) {
                if (!faixasPorCategoria.has(faixa.categoria)) {
                    faixasPorCategoria.set(faixa.categoria, []);
                }
                faixasPorCategoria.get(faixa.categoria).push(Number(faixa.percentual));
            }

            const resposta = rows.map((meta) => ({
                categoria: meta.categoria,
                limite: meta.limite,
                gasto: meta.gasto,
                // Limites antigos continuam funcionando com o percentual que já existia.
                percentuais_alerta: faixasPorCategoria.get(meta.categoria)
                    || [Number(meta.percentual_alerta || 80)]
            }));

            res.json(resposta);
        } catch (error) {
            registrarErro('Erro ao carregar resumo dos limites:', error);
            res.status(500).json({ success: false, error: 'Falha ao carregar os limites.' });
        }
    });
    app.post('/atualizar-meta-alerta', exigirLogin, async (req, res) => {
        const banco = db.promise();
        let transacaoAberta = false;

        try {
            await garantirEstruturaAlertasMultiplos();
            const { categoria, valor_limite, percentual_alerta, percentuais_alerta } = req.body;
            const userId = req.session.userId;
            const categoriaLimpa = String(categoria || '').trim();
            const valorLimite = Number(valor_limite);
            const percentuaisRecebidos = Array.isArray(percentuais_alerta)
                ? percentuais_alerta
                : [percentual_alerta];
            const percentuais = [...new Set(
                percentuaisRecebidos
                    .map(Number)
                    .filter((valor) => Number.isInteger(valor) && valor >= 1 && valor <= 100)
            )].sort((a, b) => a - b);

            if (!categoriaLimpa || categoriaLimpa.length > 120) {
                return res.status(400).json({ success: false, error: 'Informe uma categoria válida.' });
            }
            if (!Number.isFinite(valorLimite) || valorLimite <= 0) {
                return res.status(400).json({ success: false, error: 'O limite precisa ser maior que zero.' });
            }
            if (percentuais.length === 0) {
                return res.status(400).json({ success: false, error: 'Adicione ao menos um percentual entre 1% e 100%.' });
            }

            await banco.beginTransaction();
            transacaoAberta = true;

            await banco.query(
                `INSERT INTO metas (categoria, valor_limite, percentual_alerta, usuario_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE valor_limite = VALUES(valor_limite), percentual_alerta = VALUES(percentual_alerta)`,
                [categoriaLimpa, valorLimite, percentuais[0], userId]
            );

            await banco.query(
                'DELETE FROM metas_alertas_percentuais WHERE usuario_id = ? AND categoria = ?',
                [userId, categoriaLimpa]
            );

            const marcadores = percentuais.map(() => '(?, ?, ?)').join(', ');
            const valores = percentuais.flatMap((percentual) => [userId, categoriaLimpa, percentual]);
            await banco.query(
                `INSERT INTO metas_alertas_percentuais (usuario_id, categoria, percentual)
             VALUES ${marcadores}`,
                valores
            );

            await banco.commit();
            transacaoAberta = false;
            await auditarMetas(req.session.userId);
            res.json({ success: true, percentuais_alerta: percentuais });
        } catch (error) {
            if (transacaoAberta) {
                try {
                    await banco.rollback();
                } catch (erroRollback) {
                    registrarErro('Erro ao desfazer atualização do limite:', erroRollback);
                }
            }
            registrarErro('Erro ao atualizar meta/alerta:', error);
            res.status(500).json({ success: false, error: 'Falha ao atualizar meta.' });
        }
    });
}

module.exports = { registrar };
