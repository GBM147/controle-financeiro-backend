'use strict';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'segredo-apenas-para-testes-automatizados';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_USER = 'teste';
process.env.DB_PASSWORD = 'teste';
process.env.DB_NAME = 'teste';
process.env.DB_SSL = 'false';
process.env.APP_URL = 'https://gbm-finance.com';
process.env.ALLOWED_ORIGINS = 'https://gbm-finance.com';
process.env.RESEND_API_KEY = 're_teste';
process.env.GEMINI_API_KEY = 'teste';
process.env.MP_ACCESS_TOKEN = 'teste';
process.env.CLOUDINARY_CLOUD_NAME = 'teste';
process.env.CLOUDINARY_API_KEY = 'teste';
process.env.CLOUDINARY_API_SECRET = 'teste';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../index');

test('entrega páginas com CSP e cabeçalhos de proteção', async () => {
    const resposta = await request(app).get('/index.html').expect(200);
    assert.match(resposta.headers['content-security-policy'], /default-src 'self'/);
    assert.equal(resposta.headers['x-frame-options'], 'DENY');
    assert.equal(resposta.headers['x-content-type-options'], 'nosniff');
});

test('preserva a URL antiga e bloqueia origens não autorizadas', async () => {
    await request(app)
        .get('/Limite-de-Gastos.html')
        .expect(308)
        .expect('Location', '/limite-de-gastos.html');

    await request(app)
        .get('/index.html')
        .set('Origin', 'https://exemplo-malicioso.invalid')
        .expect(403)
        .expect((resposta) => {
            assert.equal(resposta.body.success, false);
        });
});

test('rejeita JSON excessivo com resposta 413 sem stack trace', async () => {
    const resposta = await request(app)
        .post('/webhook-mercadopago')
        .set('Content-Type', 'application/json')
        .send({ conteudo: 'x'.repeat(300 * 1024) })
        .expect(413);
    assert.doesNotMatch(JSON.stringify(resposta.body), /node_modules|at Object\./);
});
