'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const {
    DURACAO_SESSAO_PERSISTENTE_MS,
    configurarPersistenciaSessao,
    normalizarManterConectado,
    sessaoDevePersistir
} = require('../session-policy');

test('normaliza apenas valores explícitos de manter conectado', () => {
    assert.equal(normalizarManterConectado(true), true);
    assert.equal(normalizarManterConectado('true'), true);
    assert.equal(normalizarManterConectado(false), false);
    assert.equal(normalizarManterConectado(undefined), false);
});

test('sessão temporária não recebe data persistente', () => {
    const sessao = { cookie: { maxAge: DURACAO_SESSAO_PERSISTENTE_MS } };
    assert.equal(configurarPersistenciaSessao(sessao, false), false);
    assert.equal(sessao.manterConectado, false);
    assert.equal(sessao.cookie.maxAge, null);
    assert.equal(sessaoDevePersistir(sessao), false);
});

test('manter conectado conserva a sessão por trinta dias', () => {
    const sessao = { cookie: {} };
    assert.equal(configurarPersistenciaSessao(sessao, true), true);
    assert.equal(sessao.cookie.maxAge, DURACAO_SESSAO_PERSISTENTE_MS);
    assert.equal(sessaoDevePersistir(sessao), true);
});

test('reconhece cookies persistentes criados antes da nova opção', () => {
    assert.equal(sessaoDevePersistir({ cookie: { maxAge: 60_000 } }), true);
    assert.equal(sessaoDevePersistir({ cookie: { maxAge: null } }), false);
});

function criarAplicacaoDeCookie(manterConectado) {
    const app = express();
    app.use(session({
        secret: 'segredo-suficiente-para-testar-cookies',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax' }
    }));
    app.get('/iniciar', (req, res) => {
        req.session.userId = 1;
        configurarPersistenciaSessao(req.session, manterConectado);
        res.json({ success: true });
    });
    return app;
}

test('cookie temporário expira quando o navegador encerra', async () => {
    const resposta = await request(criarAplicacaoDeCookie(false)).get('/iniciar').expect(200);
    const cookie = resposta.headers['set-cookie'][0];
    assert.doesNotMatch(cookie, /Expires=|Max-Age=/i);
});

test('cookie de manter conectado recebe expiração persistente', async () => {
    const resposta = await request(criarAplicacaoDeCookie(true)).get('/iniciar').expect(200);
    const cookie = resposta.headers['set-cookie'][0];
    assert.match(cookie, /Expires=/i);
});
