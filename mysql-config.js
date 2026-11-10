'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { X509Certificate } = require('node:crypto');
const mysql = require('mysql2/promise');
const mysqlCallback = require('mysql2');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

function hostEhLocal(host) {
    return host === 'localhost'
        || host === '::1'
        || (net.isIPv4(host || '') && host.split('.')[0] === '127');
}

function carregarCaMysql(env) {
    let ca;
    if (env.DB_SSL_CA_FILE) {
        ca = fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8');
    } else if (env.DB_SSL_CA) {
        ca = env.DB_SSL_CA.replace(/\\n/g, '\n');
    } else if (env.DB_SSL_CA_BASE64) {
        const base64 = env.DB_SSL_CA_BASE64.replace(/\s/g, '');
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
            throw new Error('DB_SSL_CA_BASE64 deve conter o certificado CA público em base64.');
        }
        ca = Buffer.from(base64, 'base64').toString('utf8');
    } else if (String(env.DB_HOST || '').toLowerCase().endsWith('.aivencloud.com')) {
        // CA pública do projeto Aiven, fornecida pelo responsável pelo serviço.
        // O arquivo acompanha o deploy; configurações explícitas têm prioridade.
        ca = fs.readFileSync(path.join(__dirname, 'certificados', 'aiven-ca.pem'), 'utf8');
    }
    if (ca === undefined) return undefined;

    const certificados = ca.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    try {
        if (!certificados?.length || ca.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, '').trim()) {
            throw new Error('PEM inválido');
        }
        for (const certificado of certificados) new X509Certificate(certificado);
    } catch (_erro) {
        throw new Error('A CA do MySQL deve ser um certificado público PEM válido do provedor. Configure DB_SSL_CA_FILE, DB_SSL_CA ou DB_SSL_CA_BASE64.');
    }
    return ca;
}

function criarConfiguracaoMysql(env = process.env) {
    if (env.DB_SSL && !['true', 'false'].includes(env.DB_SSL)) {
        throw new Error('DB_SSL deve ser true ou false.');
    }

    const semTls = env.DB_SSL === 'false';
    if (semTls && (env.NODE_ENV === 'production' || !hostEhLocal(env.DB_HOST))) {
        throw new Error('DB_SSL=false só é permitido para MySQL local fora de produção.');
    }
    if (!semTls && env.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
        console.warn('DB_SSL_REJECT_UNAUTHORIZED=false é uma configuração legada e será ignorada. A conexão continua exigindo certificado e hostname verificados. Configure DB_SSL_CA_FILE com a CA confiável do provedor, se necessário.');
    }

    const ssl = semTls ? undefined : { rejectUnauthorized: true, verifyIdentity: true };
    const ca = ssl ? carregarCaMysql(env) : undefined;
    if (ca) ssl.ca = ca;

    return {
        host: env.DB_HOST,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        port: env.DB_PORT,
        ssl
    };
}

function criarStoreSessaoMysql(configuracao, opcoes = {}) {
    // O store filtra opções de conexão e descarta `ssl` ao criar seu próprio
    // pool. O pool explícito mantém a validação TLS e usa o mysql2 direto.
    const pool = mysql.createPool({ connectionLimit: 3, ...configuracao });
    try {
        return new MySQLStore({ ...opcoes, endConnectionOnClose: true }, pool);
    } catch (erro) {
        // O pool ainda não abriu conexões; libere-o se a configuração do store
        // for inválida antes de propagar o erro original.
        pool.end().catch(() => {});
        throw erro;
    }
}

const TEMPO_MAXIMO_TRANSACAO_MS = 5 * 60 * 1000;

// Pool de conexões com transações isoladas. Cada chamada a promise() devolve
// uma sessão: consultas fora de transação usam qualquer conexão livre do pool;
// beginTransaction() reserva uma conexão exclusiva até commit() ou rollback().
// Assim, requisições simultâneas nunca participam da transação de outra.
function criarBancoMysql(configuracao, opcoes = {}) {
    const pool = mysqlCallback.createPool({
        ...configuracao,
        waitForConnections: true,
        connectionLimit: opcoes.limiteConexoes ?? 5,
        maxIdle: opcoes.limiteConexoes ?? 5,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
    });
    pool.on?.('error', (erro) => console.error('Erro no pool MySQL:', erro.code || 'ERRO_MYSQL'));
    const poolPromise = pool.promise();
    const tempoMaximoTransacao = opcoes.tempoMaximoTransacaoMs ?? TEMPO_MAXIMO_TRANSACAO_MS;

    function criarSessao() {
        let conexao = null;
        let temporizador = null;
        let expirada = false;

        function liberar() {
            clearTimeout(temporizador);
            temporizador = null;
            const atual = conexao;
            conexao = null;
            if (atual) atual.release();
        }

        function destino() {
            if (expirada) throw new Error('A transação excedeu o tempo máximo e foi revertida.');
            return conexao || poolPromise;
        }

        return {
            query(...argumentos) { return destino().query(...argumentos); },
            execute(...argumentos) { return destino().execute(...argumentos); },
            ping() { return poolPromise.query('SELECT 1'); },
            async beginTransaction() {
                if (conexao) throw new Error('Já existe uma transação aberta nesta sessão.');
                expirada = false;
                const nova = await poolPromise.getConnection();
                try {
                    await nova.beginTransaction();
                } catch (erro) {
                    nova.release();
                    throw erro;
                }
                conexao = nova;
                // Proteção contra transação esquecida aberta: reverte e devolve a
                // conexão ao pool para não bloquear tabelas indefinidamente.
                temporizador = setTimeout(() => {
                    console.error('Transação MySQL excedeu o tempo máximo e foi revertida.');
                    expirada = true;
                    const atual = conexao;
                    conexao = null;
                    if (atual) atual.rollback().catch(() => {}).finally(() => atual.release());
                }, tempoMaximoTransacao);
                temporizador.unref?.();
            },
            async commit() {
                if (!conexao) throw new Error('Nenhuma transação aberta para confirmar.');
                try {
                    await conexao.commit();
                } catch (erro) {
                    await conexao.rollback().catch(() => {});
                    throw erro;
                } finally {
                    liberar();
                }
            },
            async rollback() {
                if (!conexao) return;
                try {
                    await conexao.rollback();
                } finally {
                    liberar();
                }
            }
        };
    }

    return {
        pool,
        promise: criarSessao,
        end() { return poolPromise.end(); }
    };
}

module.exports = { criarConfiguracaoMysql, criarStoreSessaoMysql, criarBancoMysql };
