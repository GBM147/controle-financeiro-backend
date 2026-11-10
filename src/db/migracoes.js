const { CATEGORIAS_PADRAO } = require('../config/constantes');
const { db } = require('./banco');
const {
    chaveDados,
    criptografarDado,
    descriptografarDado,
    gerarHashEmail
} = require('../servicos/identidade');

let promessaEstruturaAlertasMultiplos = null;
function garantirEstruturaAlertasMultiplos() {
    if (promessaEstruturaAlertasMultiplos) return promessaEstruturaAlertasMultiplos;

    promessaEstruturaAlertasMultiplos = (async () => {
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS metas_alertas_percentuais (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                categoria VARCHAR(120) NOT NULL,
                percentual TINYINT UNSIGNED NOT NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_meta_alerta_percentual (usuario_id, categoria, percentual),
                KEY idx_meta_alerta_usuario_categoria (usuario_id, categoria)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS metas_alertas_disparos (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                categoria VARCHAR(120) NOT NULL,
                percentual TINYINT UNSIGNED NOT NULL,
                ano_mes CHAR(7) NOT NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_meta_alerta_disparo (usuario_id, categoria, percentual, ano_mes),
                KEY idx_meta_disparo_usuario (usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    })().catch((erro) => {
        promessaEstruturaAlertasMultiplos = null;
        throw erro;
    });

    return promessaEstruturaAlertasMultiplos;
}
let promessaEstruturaProduto = null;
async function colunaExiste(tabela, coluna) {
    const [linhas] = await db.promise().query(
        `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tabela, coluna]
    );
    return linhas.length > 0;
}
async function garantirColuna(tabela, coluna, definicaoSql) {
    if (await colunaExiste(tabela, coluna)) return;
    await db.promise().query(
        `ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${definicaoSql}`
    );
}
async function indiceExiste(tabela, indice) {
    const [linhas] = await db.promise().query(
        `SELECT 1
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?
         LIMIT 1`,
        [tabela, indice]
    );
    return linhas.length > 0;
}
async function garantirIndice(tabela, indice, definicaoSql) {
    if (await indiceExiste(tabela, indice)) return;
    await db.promise().query(
        `ALTER TABLE \`${tabela}\` ADD ${definicaoSql}`
    );
}
function garantirEstruturaProduto() {
    if (promessaEstruturaProduto) return promessaEstruturaProduto;

    promessaEstruturaProduto = (async () => {
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS saldos_por_banco (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                banco VARCHAR(120) NOT NULL,
                saldo DECIMAL(15,2) NOT NULL DEFAULT 0,
                atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_saldo_usuario_banco (usuario_id, banco)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS objetivos_financeiros (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                nome VARCHAR(120) NOT NULL,
                valor_meta DECIMAL(15,2) NOT NULL,
                prazo DATE NULL,
                cor VARCHAR(20) NOT NULL DEFAULT '#8b5cf6',
                status VARCHAR(20) NOT NULL DEFAULT 'ativo',
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_objetivos_usuario (usuario_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS objetivo_contribuicoes (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                objetivo_id BIGINT UNSIGNED NOT NULL,
                usuario_id INT NOT NULL,
                transacao_id BIGINT NULL,
                valor DECIMAL(15,2) NOT NULL,
                data_contribuicao DATE NOT NULL,
                observacao VARCHAR(180) NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_contribuicoes_objetivo (objetivo_id, data_contribuicao),
                KEY idx_contribuicoes_usuario (usuario_id),
                UNIQUE KEY uk_objetivo_contribuicao_transacao (usuario_id, transacao_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS importacoes_extratos (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                conta_id INT NOT NULL,
                tipo_arquivo VARCHAR(10) NOT NULL,
                nome_arquivo VARCHAR(180) NULL,
                banco VARCHAR(120) NULL,
                hash_arquivo VARCHAR(64) NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'concluida',
                quantidade_inseridas INT NOT NULL DEFAULT 0,
                quantidade_duplicadas INT NOT NULL DEFAULT 0,
                saldo_anterior DECIMAL(15,2) NULL,
                saldo_importado DECIMAL(15,2) NULL,
                chave_arquivo_confirmado CHAR(64) NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                desfeito_em DATETIME NULL,
                PRIMARY KEY (id),
                KEY idx_importacoes_usuario (usuario_id, criado_em),
                KEY idx_importacoes_conta (conta_id),
                UNIQUE KEY uk_importacao_arquivo_confirmado (chave_arquivo_confirmado)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS transacoes_recorrentes (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                conta_id INT NOT NULL,
                descricao VARCHAR(180) NOT NULL,
                valor DECIMAL(15,2) NOT NULL,
                tipo VARCHAR(20) NOT NULL,
                categoria VARCHAR(120) NOT NULL,
                dia_mes TINYINT UNSIGNED NOT NULL,
                data_inicio DATE NOT NULL,
                data_fim DATE NULL,
                ativa TINYINT(1) NOT NULL DEFAULT 1,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_recorrencias_usuario (usuario_id, ativa)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS recorrencias_confirmacoes (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                recorrencia_id BIGINT UNSIGNED NOT NULL,
                ano SMALLINT UNSIGNED NOT NULL,
                mes TINYINT UNSIGNED NOT NULL,
                confirmado_manual TINYINT(1) NOT NULL DEFAULT 0,
                atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_recorrencia_confirmacao (usuario_id, recorrencia_id, ano, mes)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
                await db.promise().query(`
            CREATE TABLE IF NOT EXISTS controle_simples_itens (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                data DATE NOT NULL,
                descricao VARCHAR(180) NOT NULL,
                valor DECIMAL(15,2) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pendente',
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_controle_simples_usuario (usuario_id, data)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS controle_simples_renda (
                usuario_id INT NOT NULL,
                ano SMALLINT UNSIGNED NOT NULL,
                mes TINYINT UNSIGNED NOT NULL,
                renda DECIMAL(15,2) NOT NULL DEFAULT 0,
                atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (usuario_id, ano, mes)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS preferencias_notificacao_usuario (
                usuario_id INT NOT NULL,
                notificacao_site TINYINT(1) NOT NULL DEFAULT 1,
                notificacao_email TINYINT(1) NOT NULL DEFAULT 1,
                horario_silencio_inicio TIME NULL,
                horario_silencio_fim TIME NULL,
                atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS auditoria_seguranca (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NULL,
                evento VARCHAR(80) NOT NULL,
                detalhes VARCHAR(255) NULL,
                ip_hash VARCHAR(64) NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_auditoria_usuario (usuario_id, criado_em)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await garantirColuna('contas_bancarias', 'nome_personalizado', 'VARCHAR(120) NULL');
        await garantirColuna('contas_bancarias', 'banco', 'VARCHAR(120) NULL');
        await garantirColuna('contas_bancarias', 'tipo_conta', "VARCHAR(40) NOT NULL DEFAULT 'corrente'");
        await garantirColuna('contas_bancarias', 'ativa', 'TINYINT(1) NOT NULL DEFAULT 1');
        await garantirColuna('transacoes', 'importacao_id', 'BIGINT UNSIGNED NULL');
        await garantirColuna('transacoes', 'recorrencia_id', 'BIGINT UNSIGNED NULL');
        await garantirColuna('transacoes', 'fitid_origem', 'VARCHAR(180) NULL');
        await garantirColuna('transacoes', 'identidade_importacao', 'CHAR(64) NULL');
        await garantirColuna('objetivo_contribuicoes', 'transacao_id', 'BIGINT NULL');
        await garantirColuna('importacoes_extratos', 'saldo_anterior', 'DECIMAL(15,2) NULL');
        await garantirColuna('importacoes_extratos', 'saldo_importado', 'DECIMAL(15,2) NULL');
        await garantirColuna('importacoes_extratos', 'chave_arquivo_confirmado', 'CHAR(64) NULL');
        await garantirColuna('usuarios', 'nome_criptografado', 'TEXT NULL');
        await garantirColuna('usuarios', 'sobrenome_criptografado', 'TEXT NULL');
        await garantirColuna('usuarios', 'email_criptografado', 'TEXT NULL');
        await garantirColuna('usuarios', 'email_hash', 'CHAR(64) NULL');
        await garantirColuna('usuarios', 'nome_exibicao_criptografado', 'TEXT NULL');
        await garantirColuna('usuarios', 'telefone_criptografado', 'TEXT NULL');
        await garantirColuna('usuarios', 'cpf_criptografado', 'TEXT NULL');
        await garantirColuna('usuarios', 'consentimento_privacidade_em', 'DATETIME NULL');
        await garantirColuna('usuarios', 'termos_aceitos_em', 'DATETIME NULL');
        await garantirColuna('usuarios', 'termos_versao', 'VARCHAR(20) NULL');
        await garantirColuna('usuarios', 'dia_fechamento', 'TINYINT UNSIGNED NOT NULL DEFAULT 1');
        await garantirColuna('usuarios', 'token_finalidade', 'VARCHAR(32) NULL');
        await garantirColuna('alertas', 'tipo', "VARCHAR(40) NOT NULL DEFAULT 'limite'");

        await garantirIndice(
            'transacoes',
            'uk_transacoes_conta_fitid_origem',
            'UNIQUE INDEX uk_transacoes_conta_fitid_origem (conta_id, fitid_origem)'
        );
        await garantirIndice(
            'transacoes',
            'uk_transacoes_conta_identidade_importacao',
            'UNIQUE INDEX uk_transacoes_conta_identidade_importacao (conta_id, identidade_importacao)'
        );
        await garantirIndice(
            'importacoes_extratos',
            'uk_importacao_arquivo_confirmado',
            'UNIQUE INDEX uk_importacao_arquivo_confirmado (chave_arquivo_confirmado)'
        );
        await garantirIndice(
            'objetivo_contribuicoes',
            'uk_objetivo_contribuicao_transacao',
            'UNIQUE INDEX uk_objetivo_contribuicao_transacao (usuario_id, transacao_id)'
        );

        const [indiceEmailHash] = await db.promise().query(`
            SELECT 1
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'usuarios'
              AND INDEX_NAME = 'uk_usuarios_email_hash'
            LIMIT 1
        `);
        if (!indiceEmailHash.length) {
            await db.promise().query(
                'ALTER TABLE usuarios ADD UNIQUE INDEX uk_usuarios_email_hash (email_hash)'
            );
        }

        // Versões antigas podiam ter usuario_id como UNIQUE, limitando cada usuário
        // a uma única conta bancária. Remove apenas índices únicos compostos
        // exclusivamente por essa coluna; a chave primária permanece intacta.
        const [indicesContaUnica] = await db.promise().query(`
            SELECT INDEX_NAME
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'contas_bancarias'
              AND NON_UNIQUE = 0
              AND INDEX_NAME <> 'PRIMARY'
            GROUP BY INDEX_NAME
            HAVING COUNT(*) = 1
               AND MAX(COLUMN_NAME) = 'usuario_id'
        `);
        for (const indice of indicesContaUnica) {
            const nomeIndice = String(indice.INDEX_NAME).replace(/`/g, '');
            await db.promise().query(`ALTER TABLE contas_bancarias DROP INDEX \`${nomeIndice}\``);
        }
    })().catch((erro) => {
        promessaEstruturaProduto = null;
        throw erro;
    });

    return promessaEstruturaProduto;
}
async function migrarDadosSensiveisExistentes() {
    if (!chaveDados) {
        console.warn('DATA_ENCRYPTION_KEY não configurada; dados sensíveis antigos ainda não serão migrados.');
        return;
    }
    const [usuarios] = await db.promise().query(`
        SELECT id, nome, sobrenome, email, nome_exibicao, telefone, cpf,
               nome_criptografado, sobrenome_criptografado, email_criptografado,
               nome_exibicao_criptografado, email_hash,
               telefone_criptografado, cpf_criptografado
        FROM usuarios
        WHERE (nome_criptografado IS NULL AND nome IS NOT NULL AND nome <> 'PROTEGIDO')
           OR (sobrenome_criptografado IS NULL AND sobrenome IS NOT NULL AND sobrenome <> 'PROTEGIDO')
           OR (email_criptografado IS NULL AND email IS NOT NULL AND email NOT LIKE '%@anonimo.gbm.local')
           OR (nome_exibicao_criptografado IS NULL AND nome_exibicao IS NOT NULL AND nome_exibicao <> 'PROTEGIDO')
           OR email_hash IS NULL
           OR (telefone_criptografado IS NULL AND telefone IS NOT NULL AND telefone <> 'PROTEGIDO')
           OR (cpf_criptografado IS NULL AND cpf IS NOT NULL)
    `);
    for (const usuario of usuarios) {
        const nomeCriptografado = usuario.nome_criptografado || criptografarDado(usuario.nome);
        const sobrenomeCriptografado =
            usuario.sobrenome_criptografado || criptografarDado(usuario.sobrenome);
        const emailOriginal =
            descriptografarDado(usuario.email_criptografado)
            || (String(usuario.email || '').endsWith('@anonimo.gbm.local') ? null : usuario.email);
        const emailCriptografado = usuario.email_criptografado || criptografarDado(emailOriginal);
        const emailHash = usuario.email_hash || gerarHashEmail(emailOriginal);
        const nomeExibicaoCriptografado =
            usuario.nome_exibicao_criptografado || criptografarDado(usuario.nome_exibicao);
        const telefoneCriptografado = usuario.telefone_criptografado || criptografarDado(usuario.telefone);
        const cpfCriptografado = usuario.cpf_criptografado || criptografarDado(usuario.cpf);
        await db.promise().query(
            `UPDATE usuarios
             SET nome = CASE WHEN ? IS NOT NULL THEN 'PROTEGIDO' ELSE nome END,
                 sobrenome = CASE WHEN ? IS NOT NULL THEN 'PROTEGIDO' ELSE sobrenome END,
                 email = CASE WHEN ? IS NOT NULL THEN CONCAT(?, '@anonimo.gbm.local') ELSE email END,
                 nome_exibicao = CASE WHEN ? IS NOT NULL THEN 'PROTEGIDO' ELSE nome_exibicao END,
                 nome_criptografado = COALESCE(nome_criptografado, ?),
                 sobrenome_criptografado = COALESCE(sobrenome_criptografado, ?),
                 email_criptografado = COALESCE(email_criptografado, ?),
                 email_hash = COALESCE(email_hash, ?),
                 nome_exibicao_criptografado = COALESCE(nome_exibicao_criptografado, ?),
                 telefone = CASE WHEN ? IS NOT NULL THEN 'PROTEGIDO' ELSE telefone END,
                 telefone_criptografado = COALESCE(telefone_criptografado, ?),
                 cpf = CASE WHEN ? IS NOT NULL THEN NULL ELSE cpf END,
                 cpf_criptografado = COALESCE(cpf_criptografado, ?)
             WHERE id = ?`,
            [
                nomeCriptografado,
                sobrenomeCriptografado,
                emailCriptografado,
                emailHash,
                nomeExibicaoCriptografado,
                nomeCriptografado,
                sobrenomeCriptografado,
                emailCriptografado,
                emailHash,
                nomeExibicaoCriptografado,
                telefoneCriptografado,
                telefoneCriptografado,
                cpfCriptografado,
                cpfCriptografado,
                usuario.id
            ]
        );
    }
    if (usuarios.length) {
        console.log(`${usuarios.length} cadastro(s) tiveram os dados de identidade protegidos.`);
    }
}
async function migrarObjetivosLegados() {
    // Antes da separação, objetivos e limites eram gravados na mesma tabela.
    // Uma linha que não é categoria padrão nem categoria personalizada é tratada
    // como objetivo e migrada uma única vez.
    if (typeof CATEGORIAS_PADRAO === 'undefined' || !CATEGORIAS_PADRAO.length) return;
    const marcadores = CATEGORIAS_PADRAO.map(() => '?').join(', ');
    const banco = db.promise();
    await banco.beginTransaction();
    try {
        await banco.query(`
            INSERT INTO objetivos_financeiros (usuario_id, nome, valor_meta, cor)
            SELECT m.usuario_id, m.categoria, m.valor_limite, '#8b5cf6'
            FROM metas m
            LEFT JOIN categorias_personalizadas cp
              ON cp.usuario_id = m.usuario_id
             AND LOWER(cp.nome) = LOWER(m.categoria)
            WHERE cp.id IS NULL
              AND m.categoria NOT IN (${marcadores})
              AND NOT EXISTS (
                  SELECT 1
                  FROM objetivos_financeiros o
                  WHERE o.usuario_id = m.usuario_id
                    AND LOWER(o.nome) = LOWER(m.categoria)
              )
        `, CATEGORIAS_PADRAO);
        await banco.query(`
            DELETE m
            FROM metas m
            LEFT JOIN categorias_personalizadas cp
              ON cp.usuario_id = m.usuario_id
             AND LOWER(cp.nome) = LOWER(m.categoria)
            WHERE cp.id IS NULL
              AND m.categoria NOT IN (${marcadores})
        `, CATEGORIAS_PADRAO);
        await banco.commit();
    } catch (erro) {
        await banco.rollback();
        throw erro;
    }
}
// Prepara as estruturas automáticas e migra dados legados. Executado na
// inicialização do servidor e pelos testes de integração.
async function prepararBanco() {
    await db.promise().query('SELECT 1');
    await garantirEstruturaAlertasMultiplos();
    await garantirEstruturaProduto();
    await migrarDadosSensiveisExistentes();
    await migrarObjetivosLegados();
}

module.exports = { garantirEstruturaAlertasMultiplos, garantirEstruturaProduto, prepararBanco };
