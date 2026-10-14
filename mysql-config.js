'use strict';

const fs = require('node:fs');
const net = require('node:net');
const mysql = require('mysql2/promise');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

function hostEhLocal(host) {
    return host === 'localhost'
        || host === '::1'
        || (net.isIPv4(host || '') && host.split('.')[0] === '127');
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
    if (ssl && env.DB_SSL_CA_FILE) {
        ssl.ca = fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8');
    }

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

module.exports = { criarConfiguracaoMysql, criarStoreSessaoMysql };
