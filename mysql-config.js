'use strict';

const fs = require('node:fs');
const net = require('node:net');
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
    const pool = mysql.createPool(configuracao);
    try {
        return new MySQLStore({ ...opcoes, endConnectionOnClose: true }, pool);
    } catch (erro) {
        // O pool ainda não abriu conexões; libere-o se a configuração do store
        // for inválida antes de propagar o erro original.
        pool.end().catch(() => {});
        throw erro;
    }
}

function criarConexaoMysqlRecuperavel(configuracao) {
    let conexao = null;
    let encerrada = false;

    function obterConexao() {
        if (encerrada) throw new Error('A conexão MySQL foi encerrada.');
        if (!conexao) {
            const novaConexao = mysqlCallback.createConnection(configuracao);
            conexao = novaConexao;
            novaConexao.on('error', (erro) => {
                // O provedor pode encerrar conexões ociosas. A próxima operação
                // abre outra conexão, sem repetir uma escrita ou transação.
                if (conexao === novaConexao) conexao = null;
                console.error('Conexão MySQL interrompida:', erro.code || 'ERRO_MYSQL');
            });
            // Falhas de handshake podem ser entregues somente ao callback da
            // consulta. O fechamento também invalida essa conexão para depois.
            novaConexao.stream.once('close', () => {
                if (conexao === novaConexao) conexao = null;
            });
        }
        return conexao;
    }

    return {
        connect(callback) { return obterConexao().connect(callback); },
        query(...argumentos) { return obterConexao().query(...argumentos); },
        // A mesma conexão permanece vinculada a toda a transação existente.
        promise() { return obterConexao().promise(); },
        end(callback) {
            encerrada = true;
            if (conexao) return conexao.end(callback);
            if (callback) queueMicrotask(() => callback());
        }
    };
}

module.exports = { criarConfiguracaoMysql, criarStoreSessaoMysql, criarConexaoMysqlRecuperavel };
