// Armazena os contadores do express-rate-limit no MySQL. Diferente do
// armazenamento em memória, os limites sobrevivem a deploys e reinícios e
// valem para todas as instâncias. Os tempos são guardados em milissegundos
// desde a época Unix para não depender do fuso horário do banco.
const { db } = require('../db/banco');

let promessaTabela = null;

function garantirTabelaLimites() {
    promessaTabela ||= db.promise().query(`
        CREATE TABLE IF NOT EXISTS limites_requisicoes (
            chave VARCHAR(191) NOT NULL,
            total INT UNSIGNED NOT NULL,
            expira_ms BIGINT UNSIGNED NOT NULL,
            PRIMARY KEY (chave),
            KEY idx_limites_expiracao (expira_ms)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((erro) => {
        promessaTabela = null;
        throw erro;
    });
    return promessaTabela;
}

class LimiteMysqlStore {
    constructor({ prefixo }) {
        this.prefix = `${prefixo}:`;
        this.localKeys = false;
        this.janelaMs = 60000;
        this.ultimaLimpeza = 0;
    }

    init(opcoes) {
        this.janelaMs = opcoes.windowMs;
    }

    chave(chave) {
        return `${this.prefix}${chave}`.slice(0, 191);
    }

    async get(chave) {
        await garantirTabelaLimites();
        const [linhas] = await db.promise().query(
            'SELECT total, expira_ms FROM limites_requisicoes WHERE chave = ? AND expira_ms > ?',
            [this.chave(chave), Date.now()]
        );
        if (!linhas.length) return undefined;
        return { totalHits: Number(linhas[0].total), resetTime: new Date(Number(linhas[0].expira_ms)) };
    }

    async increment(chave) {
        await garantirTabelaLimites();
        const agora = Date.now();
        const id = this.chave(chave);
        // As atribuições do ON DUPLICATE KEY são avaliadas da esquerda para a
        // direita: total é calculado com a expiração antiga antes de renová-la.
        await db.promise().query(
            `INSERT INTO limites_requisicoes (chave, total, expira_ms) VALUES (?, 1, ?)
             ON DUPLICATE KEY UPDATE
                total = IF(expira_ms <= ?, 1, total + 1),
                expira_ms = IF(expira_ms <= ?, VALUES(expira_ms), expira_ms)`,
            [id, agora + this.janelaMs, agora, agora]
        );
        const [linhas] = await db.promise().query(
            'SELECT total, expira_ms FROM limites_requisicoes WHERE chave = ?',
            [id]
        );
        this.limparExpirados(agora);
        return { totalHits: Number(linhas[0].total), resetTime: new Date(Number(linhas[0].expira_ms)) };
    }

    async decrement(chave) {
        await garantirTabelaLimites();
        await db.promise().query(
            'UPDATE limites_requisicoes SET total = GREATEST(CAST(total AS SIGNED) - 1, 0) WHERE chave = ?',
            [this.chave(chave)]
        );
    }

    async resetKey(chave) {
        await garantirTabelaLimites();
        await db.promise().query('DELETE FROM limites_requisicoes WHERE chave = ?', [this.chave(chave)]);
    }

    limparExpirados(agora) {
        if (agora - this.ultimaLimpeza < 10 * 60 * 1000) return;
        this.ultimaLimpeza = agora;
        db.promise().query('DELETE FROM limites_requisicoes WHERE expira_ms < ?', [agora])
            .catch(() => {});
    }
}

module.exports = { LimiteMysqlStore, garantirTabelaLimites };
