const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { exigirLogin } = require('../web/autorizacao');

function registrar(app) {
    // =======================================================
    // --- CENTRAL E PREFERÊNCIAS DE NOTIFICAÇÕES ---
    // =======================================================
    app.get('/notificacoes', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const filtros = ['usuario_id = ?'];
            const valores = [req.session.userId];
            if (req.query.status === 'nao_lidas') filtros.push('lida = 0');
            if (req.query.status === 'lidas') filtros.push('lida = 1');
            if (req.query.tipo && req.query.tipo !== 'todos') {
                filtros.push('tipo = ?');
                valores.push(String(req.query.tipo));
            }
            const [linhas] = await db.promise().query(
                `SELECT id, categoria, mensagem, lida, data_criacao, tipo
             FROM alertas
             WHERE ${filtros.join(' AND ')}
             ORDER BY data_criacao DESC
             LIMIT 200`,
                valores
            );
            res.json(linhas);
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao carregar notificações.' });
        }
    });
    app.post('/notificacoes/marcar-todas-lidas', exigirLogin, async (req, res) => {
        try {
            await db.promise().query(
                'UPDATE alertas SET lida = 1 WHERE usuario_id = ?',
                [req.session.userId]
            );
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao atualizar notificações.' });
        }
    });
    app.get('/notificacoes/preferencias', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const [linhas] = await db.promise().query(
                `SELECT notificacao_site, notificacao_email, horario_silencio_inicio, horario_silencio_fim
             FROM preferencias_notificacao_usuario
             WHERE usuario_id = ?`,
                [req.session.userId]
            );
            res.json(linhas[0] || {
                notificacao_site: 1,
                notificacao_email: 1,
                horario_silencio_inicio: null,
                horario_silencio_fim: null
            });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao carregar preferências.' });
        }
    });
    app.put('/notificacoes/preferencias', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const site = req.body.notificacao_site === false || req.body.notificacao_site === 0 ? 0 : 1;
            const email = req.body.notificacao_email === false || req.body.notificacao_email === 0 ? 0 : 1;
            const inicio = /^\d{2}:\d{2}$/.test(req.body.horario_silencio_inicio || '')
                ? `${req.body.horario_silencio_inicio}:00`
                : null;
            const fim = /^\d{2}:\d{2}$/.test(req.body.horario_silencio_fim || '')
                ? `${req.body.horario_silencio_fim}:00`
                : null;
            await db.promise().query(
                `INSERT INTO preferencias_notificacao_usuario
                (usuario_id, notificacao_site, notificacao_email, horario_silencio_inicio, horario_silencio_fim)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                notificacao_site = VALUES(notificacao_site),
                notificacao_email = VALUES(notificacao_email),
                horario_silencio_inicio = VALUES(horario_silencio_inicio),
                horario_silencio_fim = VALUES(horario_silencio_fim)`,
                [req.session.userId, site, email, inicio, fim]
            );
            res.json({ success: true });
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao salvar preferências.' });
        }
    });
}

module.exports = { registrar };
