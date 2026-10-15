'use strict';

// Exercita as rotas reais, o middleware e os cookies do express-session. Só o
// acesso ao banco é isolado; estes testes não tocam contas ou serviços reais.
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = 'segredo-exclusivo-dos-testes-de-autenticacao';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_SSL = 'false';
process.env.APP_URL = 'https://gbm-finance.com';
process.env.ALLOWED_ORIGINS = 'https://gbm-finance.com';
process.env.RESEND_API_KEY = 're_teste';
process.env.MP_ACCESS_TOKEN = 'teste';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const bcrypt = require('bcrypt');
const session = require('express-session');
const mysql = require('mysql2');
const request = require('supertest');
const mysqlConfig = require('../mysql-config');

test('rotas de acesso preservam a sessão, aguardam a gravação e distinguem indisponibilidade', async (t) => {
    const senha = 'Senha-temporaria-deste-teste-123';
    const usuario = {
        id: 42, email: 'conta@example.invalid', verificado: 1,
        senha_hash: await bcrypt.hash(senha, 4), status_pagamento: 'pago', trial_expira: null
    };
    const estado = { indisponivel: false, usuario };
    const store = new session.MemoryStore();
    store.onReady = async () => {};
    const conexao = new EventEmitter();
    conexao.stream = new EventEmitter();
    conexao.promise = () => ({
        async query(sql, parametros = []) {
            if (estado.indisponivel) {
                throw Object.assign(new Error('certificado não confiável de teste'), { code: 'HANDSHAKE_SSL_ERROR' });
            }
            if (/SELECT \*\s+FROM usuarios/.test(sql)) {
                return [[estado.usuario].filter((conta) => conta && conta.email === parametros[1])];
            }
            if (/SELECT id, verificado FROM usuarios/.test(sql)) {
                return [[estado.usuario].filter((conta) => conta && conta.id === parametros[0])];
            }
            if (/SELECT status_pagamento, trial_expira FROM usuarios/.test(sql)) return [[estado.usuario]];
            if (/HAVING COUNT/.test(sql)) return [[]];
            if (/INFORMATION_SCHEMA/.test(sql)) return [[{ existe: 1 }]];
            return [{ affectedRows: 1 }];
        }
    });
    t.mock.method(mysql, 'createConnection', () => conexao);
    t.mock.method(mysqlConfig, 'criarStoreSessaoMysql', () => store);
    t.mock.method(console, 'error', () => {});
    const { app } = require('../index');
    t.after(() => store.clear(() => {}));
    const entrar = (cliente, manterConectado = true) => cliente.post('/login').send({
        identificacao: usuario.email, senha, manterConectado
    });

    await t.test('sessão ausente retorna 401 e estado de login não é armazenável', async () => {
        const resposta = await request(app).get('/login-status').expect(401);
        assert.match(resposta.headers['cache-control'], /no-store/);
        assert.equal(resposta.headers['set-cookie'], undefined);
    });

    await t.test('credenciais inválidas não iniciam sessão', async () => {
        await request(app).post('/login').send({ identificacao: usuario.email, senha: 'incorreta' }).expect(401);
        await request(app).post('/login').send({ identificacao: {}, senha }).expect(400);
        await request(app).post('/login').expect(400);
    });

    await t.test('cookie persistente reabre a conta sem novo login por trinta dias', async () => {
        const resposta = await entrar(request(app)).expect(200);
        const cookie = resposta.headers['set-cookie'][0];
        assert.match(cookie, /^gbm_sid=/);
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);
        const prazo = new Date(cookie.match(/Expires=([^;]+)/)[1]).getTime() - Date.now();
        assert.ok(prazo > 29 * 86400000 && prazo <= 30 * 86400000);
        // Outro cliente, como depois de reabrir o navegador, apresenta o mesmo cookie.
        const status = await request(app).get('/login-status').set('Cookie', cookie.split(';')[0]).expect(200);
        assert.equal(status.body.userId, usuario.id);
        assert.equal(status.body.manterConectado, true);
        assert.match(status.headers['cache-control'], /no-store/);
    });

    await t.test('acesso temporário permanece válido sem cookie persistente', async () => {
        const cliente = request.agent(app);
        const resposta = await entrar(cliente, false).expect(200);
        assert.doesNotMatch(resposta.headers['set-cookie'][0], /Expires=|Max-Age=/i);
        const status = await cliente.get('/login-status').expect(200);
        assert.equal(status.body.manterConectado, false);
    });

    await t.test('login regenera a sessão e logout impede reutilizar o cookie', async () => {
        const cliente = request.agent(app);
        const primeira = await entrar(cliente).expect(200);
        const antigo = primeira.headers['set-cookie'][0].split(';')[0];
        const segunda = await entrar(cliente).expect(200);
        assert.notEqual(segunda.headers['set-cookie'][0].split(';')[0], antigo);
        await request(app).get('/login-status').set('Cookie', antigo).expect(401);
        const cookieAtual = segunda.headers['set-cookie'][0].split(';')[0];
        await cliente.post('/logout').expect(200);
        await request(app).get('/login-status').set('Cookie', cookieAtual).expect(401);
    });

    await t.test('falha TLS produz 503 em vez de senha incorreta e não encerra sessão existente', async () => {
        const cliente = request.agent(app);
        await entrar(cliente).expect(200);
        estado.indisponivel = true;
        try {
            const resposta = await cliente.get('/login-status').expect(503);
            assert.equal(resposta.headers['retry-after'], '10');
            assert.equal(resposta.headers['set-cookie'], undefined);
            const login = await entrar(request(app)).expect(503);
            assert.doesNotMatch(login.body.message, /senha incorreta|certificate|senha_hash/);
        } finally {
            estado.indisponivel = false;
        }
        await cliente.get('/login-status').expect(200);
    });

    await t.test('falha no banco de sessões é recuperável sem apagar cookie', async (st) => {
        const cliente = request.agent(app);
        await entrar(cliente).expect(200);
        const simulacao = st.mock.method(store, 'get', (_id, callback) => callback(
            Object.assign(new Error('CA de teste'), { code: 'HANDSHAKE_SSL_ERROR' })
        ));
        const resposta = await cliente.get('/login-status').expect(503);
        assert.equal(resposta.headers['retry-after'], '10');
        assert.equal(resposta.headers['set-cookie'], undefined);
        simulacao.mock.restore();
        await cliente.get('/login-status').expect(200);
    });

    await t.test('login aguarda o armazenamento antes de anunciar sucesso', async (st) => {
        const gravar = store.set.bind(store);
        let sessaoGravada = false;
        st.mock.method(store, 'set', (id, dados, callback) => {
            setTimeout(() => gravar(id, dados, (erro) => {
                sessaoGravada = !erro;
                callback(erro);
            }), 25);
        });
        const resposta = await entrar(request(app)).expect(200);
        assert.equal(sessaoGravada, true);
        await request(app).get('/login-status')
            .set('Cookie', resposta.headers['set-cookie'][0].split(';')[0]).expect(200);
    });

    await t.test('conta não verificada não recebe acesso ao dashboard', async () => {
        estado.usuario = { ...usuario, verificado: 0 };
        try {
            const cliente = request.agent(app);
            const resposta = await entrar(cliente).expect(200);
            assert.equal(resposta.body.verificado, false);
            await cliente.get('/login-status').expect(401);
        } finally {
            estado.usuario = usuario;
        }
    });

    await t.test('falha assíncrona do verificador de senha é respondida sem travar a requisição', async (st) => {
        st.mock.method(bcrypt, 'compare', async () => { throw new TypeError('verificador de teste'); });
        const resposta = await entrar(request(app)).expect(500);
        assert.equal(resposta.body.success, false);
        assert.doesNotMatch(resposta.body.message, /TypeError|verificador/);
    });
});
