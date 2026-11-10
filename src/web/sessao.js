const session = require('express-session');
const { criarStoreSessaoMysql } = require('../../mysql-config');
const { configuracaoConexaoMysql } = require('../db/banco');

const sessionStore = process.env.NODE_ENV === 'test'
    ? new session.MemoryStore()
    : criarStoreSessaoMysql(configuracaoConexaoMysql);
if (process.env.NODE_ENV !== 'test') {
    sessionStore.onReady().catch((erro) => {
        console.error('Não foi possível inicializar o banco de sessões:', erro.code || 'ERRO_MYSQL');
    });
}
const opcoesLimpezaCookieSessao = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
};
function limparCookiesSessao(res) {
    res.clearCookie('gbm_sid', opcoesLimpezaCookieSessao);
    res.clearCookie('connect.sid', opcoesLimpezaCookieSessao);
}
function salvarSessao(req) {
    return new Promise((resolve, reject) => {
        req.session.save((erro) => (erro ? reject(erro) : resolve()));
    });
}
function servicoTemporariamenteIndisponivel(erro) {
    return new Set([
        'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND',
        'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
        'PROTOCOL_ENQUEUE_AFTER_QUIT', 'ER_CON_COUNT_ERROR', 'ER_SERVER_SHUTDOWN',
        'HANDSHAKE_SSL_ERROR', 'HANDSHAKE_NO_SSL_SUPPORT'
    ]).has(erro?.code);
}

module.exports = { limparCookiesSessao, salvarSessao, servicoTemporariamenteIndisponivel, sessionStore };
