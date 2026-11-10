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
    const resposta = await request(app).get('/login.html').expect(200);
    assert.match(resposta.headers['content-security-policy'], /default-src 'self'/);
    assert.doesNotMatch(resposta.headers['content-security-policy'], /strict-dynamic/);
    assert.match(resposta.headers['x-robots-tag'], /noindex/);
    assert.equal(resposta.headers['x-frame-options'], 'DENY');
    assert.equal(resposta.headers['x-content-type-options'], 'nosniff');
});

for (const caminho of ['/', '/index.html', '/guias/orcamento-pessoal.html', '/calculadoras/orcamento-mensal.html']) {
    test(`página editorial ${caminho} libera o AdSense somente com nonce`, async () => {
        const resposta = await request(app).get(caminho).expect(200).expect('Content-Type', /html/);
        const csp = resposta.headers['content-security-policy'];
        const nonce = csp.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
        assert.ok(nonce, 'CSP precisa conter um nonce');
        assert.match(csp, /'strict-dynamic'/);
        assert.match(csp, /object-src 'none'/);
        assert.match(csp, /base-uri 'none'/);
        assert.match(csp, /frame-ancestors 'none'/);
        assert.equal(resposta.headers['x-robots-tag'], undefined);
        assert.equal(resposta.headers['x-frame-options'], 'DENY');
        assert.match(resposta.text, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-2735805392775741/);
        const scripts = resposta.text.match(/<script\b[^>]*>/gi) || [];
        assert.ok(scripts.length > 0);
        for (const script of scripts) assert.ok(script.includes(`nonce="${nonce}"`), script);
    });
}

test('cada resposta editorial recebe um nonce diferente', async () => {
    const extrair = (resposta) => resposta.headers['content-security-policy'].match(/'nonce-([^']+)'/)[1];
    const [primeira, segunda] = await Promise.all([
        request(app).get('/educacao-financeira.html').expect(200),
        request(app).get('/educacao-financeira.html').expect(200)
    ]);
    assert.notEqual(extrair(primeira), extrair(segunda));
});

test('endereços inexistentes recebem página 404 sem indexação', async () => {
    const pagina = await request(app).get('/guias/nao-existe.html').set('Accept', 'text/html').expect(404);
    assert.match(pagina.text, /Página não encontrada/);
    assert.match(pagina.headers['x-robots-tag'], /noindex/);
    await request(app).get('/../index.js').set('Accept', 'text/html').expect(404);
    const api = await request(app).get('/rota-inexistente').set('Accept', 'application/json').expect(404);
    assert.doesNotMatch(api.text, /Página não encontrada/);
});

test('bloqueia origens não autorizadas na API e entrega arquivos públicos', async () => {
    await request(app)
        .post('/login')
        .set('Origin', 'https://exemplo-malicioso.invalid')
        .send({ identificacao: 'a@b.c', senha: 'x' })
        .expect(403)
        .expect((resposta) => {
            assert.equal(resposta.body.success, false);
        });
    const fonte = await request(app)
        .get('/fonts/geist-latin.woff2')
        .set('Origin', 'https://www.gbm-finance.com')
        .expect(200);
    assert.equal(fonte.headers['access-control-allow-origin'], undefined);
    await request(app).get('/index.html').set('Origin', 'https://exemplo-malicioso.invalid').expect(200);
});

test('rejeita JSON excessivo com resposta 413 sem stack trace', async () => {
    const resposta = await request(app)
        .post('/webhook-mercadopago')
        .set('Content-Type', 'application/json')
        .send({ conteudo: 'x'.repeat(300 * 1024) })
        .expect(413);
    assert.doesNotMatch(JSON.stringify(resposta.body), /node_modules|at Object\./);
});

test('arquivos versionados recebem cache longo; sem versão, revalidação', async () => {
    const versionado = await request(app).get('/estilo/site.css?v=abc123').expect(200);
    assert.match(versionado.headers['cache-control'], /max-age=31536000/);
    const semVersao = await request(app).get('/estilo/site.css').expect(200);
    assert.doesNotMatch(semVersao.headers['cache-control'] || '', /immutable/);
    const tutorial = await request(app).get('/gbm-tutorial.js?v=1').expect(200);
    assert.match(tutorial.headers['cache-control'], /no-store/);
    await request(app).get('/vendor/chart-4.5.1.umd.min.js').expect(200);
    const csp = (await request(app).get('/dashboard.html').expect(200)).headers['content-security-policy'];
    assert.doesNotMatch(csp, /jsdelivr|cdnjs/);
});
