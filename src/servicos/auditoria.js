const crypto = require('crypto');
const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');

async function registrarAuditoria(req, evento, detalhes = null, usuarioId = null) {
    try {
        await garantirEstruturaProduto();
        const ip = req.ip || req.socket.remoteAddress || '';
        const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
        await db.promise().query(
            `INSERT INTO auditoria_seguranca (usuario_id, evento, detalhes, ip_hash)
             VALUES (?, ?, ?, ?)`,
            [usuarioId || req.session?.userId || null, evento, detalhes, ipHash]
        );
    } catch (erro) {
        console.error('Falha ao registrar auditoria:', erro.message);
    }
}

module.exports = { registrarAuditoria };
