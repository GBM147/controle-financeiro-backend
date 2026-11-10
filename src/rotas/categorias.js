const { BANCOS_INFO, CATEGORIAS_PADRAO } = require('../config/constantes');
const { db } = require('../db/banco');
const { exigirLogin } = require('../web/autorizacao');
const { registrarErro } = require('../servicos/log');

function registrar(app) {
    // Lista as categorias padrão + as personalizadas criadas por este usuário
    // Expõe o mapa de bancos (nome + cor) para o frontend usar nas etiquetas
    app.get('/bancos-info', (req, res) => {
        const mapa = {};
        Object.values(BANCOS_INFO).forEach(b => { mapa[b.nome] = b.cor; });
        res.json(mapa);
    });
    // Lista os bancos distintos que o usuário já usou em suas transações
    // (usado para popular o filtro de banco no relatório)
    app.get('/bancos-usados', exigirLogin, async (req, res) => {
        try {
            const userId = req.session.userId;

            const [rows] = await db.promise().query(
                `SELECT DISTINCT t.banco
             FROM transacoes t
             JOIN contas_bancarias cb ON t.conta_id = cb.id
             WHERE cb.usuario_id = ? AND t.banco IS NOT NULL AND t.banco <> ''
             ORDER BY t.banco ASC`,
                [userId]
            );

            res.json(rows.map(r => r.banco));
        } catch (error) {
            registrarErro('Erro ao buscar bancos usados:', error);
            res.status(500).json({ error: 'Falha ao buscar bancos usados.' });
        }
    });
    app.get('/categorias', exigirLogin, async (req, res) => {
        try {
            const userId = req.session.userId;

            const [rows] = await db.promise().query(
                'SELECT id, nome FROM categorias_personalizadas WHERE usuario_id = ? ORDER BY nome ASC',
                [userId]
            );

            res.json({
                padrao: CATEGORIAS_PADRAO,
                personalizadas: rows, // [{id, nome}]
                todas: [...CATEGORIAS_PADRAO, ...rows.map(r => r.nome)]
            });
        } catch (error) {
            registrarErro('Erro ao buscar categorias:', error);
            res.status(500).json({ error: 'Falha ao buscar categorias.' });
        }
    });
    // Cria uma nova categoria, vinculada apenas ao usuário que a criou
    app.post('/categorias', exigirLogin, async (req, res) => {
        try {
            const { nome } = req.body;
            const userId = req.session.userId;
            if (!nome || !nome.trim()) {
                return res.status(400).json({ success: false, error: 'Informe o nome da categoria.' });
            }
            const nomeLimpo = nome.trim().slice(0, 100);

            const jaEhPadrao = CATEGORIAS_PADRAO.some(c => c.toLowerCase() === nomeLimpo.toLowerCase());
            if (jaEhPadrao) {
                return res.status(409).json({ success: false, error: 'Essa categoria já existe entre as categorias padrão.' });
            }

            await db.promise().query(
                'INSERT INTO categorias_personalizadas (usuario_id, nome) VALUES (?, ?)',
                [userId, nomeLimpo]
            );
            console.log(`Nova categoria personalizada: "${nomeLimpo}" (usuário ${userId})`);
            res.json({ success: true, message: 'Categoria criada com sucesso!' });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, error: 'Você já tem uma categoria com esse nome.' });
            }
            registrarErro('Erro ao criar categoria:', error);
            res.status(500).json({ success: false, error: 'Falha ao criar categoria.' });
        }
    });
    // Remove uma categoria personalizada (apenas o dono pode remover a sua)
    app.delete('/categorias/:id', exigirLogin, async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            const [result] = await db.promise().query(
                'DELETE FROM categorias_personalizadas WHERE id = ? AND usuario_id = ?',
                [id, userId]
            );
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Categoria não encontrada para este usuário.' });
            }
            res.json({ success: true, message: 'Categoria removida com sucesso!' });
        } catch (error) {
            registrarErro('Erro ao remover categoria:', error);
            res.status(500).json({ success: false, error: 'Falha ao remover categoria.' });
        }
    });
}

module.exports = { registrar };
