'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'segredo-dos-testes-netlify';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_teste';
process.env.MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'teste';

const raiz = path.resolve(__dirname, '..');

async function carregarEdgeFunction() {
    const codigo = fs.readFileSync(path.join(raiz, 'netlify/edge-functions/paginas.js'));
    return import(`data:text/javascript;base64,${codigo.toString('base64')}`);
}

test('public/_redirects cobre todas as rotas da API e está atualizado', () => {
    const { verificar } = require('../scripts/gerar-rotas-netlify');
    assert.ok(verificar(), 'execute npm run rotas:netlify depois de criar ou mudar uma rota');
    const regras = fs.readFileSync(path.join(raiz, 'public/_redirects'), 'utf8');
    // Rotas da API com o mesmo nome de uma página precisam ser forçadas.
    for (const rota of ['/login', '/contas', '/metas', '/perfil', '/notificacoes', '/importacoes', '/relatorio-avancado', '/objetivos/:id', '/webhook-mercadopago', '/assistente-ajuda']) {
        assert.match(regras, new RegExp(`^${rota.replace(/[/:]/g, '\\$&')}\\s+/\\.netlify/functions/api${rota.replace(/[/:]/g, '\\$&')}\\s+200!$`, 'm'), rota);
    }
    assert.doesNotMatch(regras, /^\/(?:index|login)\.html\s/m, 'páginas estáticas ficam no CDN');
    assert.match(regras, /^\/\*\s+\/404\.html\s+404$/m);
});

test('netlify.toml publica public/, agenda as tarefas diárias e mantém os cabeçalhos de segurança', () => {
    const configuracao = fs.readFileSync(path.join(raiz, 'netlify.toml'), 'utf8');
    assert.match(configuracao, /publish = "public"/);
    assert.match(configuracao, /functions = "netlify\/functions"/);
    assert.match(configuracao, /\[functions\."tarefas-diarias"\]\s+schedule = "0 11 \* \* \*"/);
    assert.match(configuracao, /\[functions\."reconciliar-assinaturas"\]\s+schedule = "10 7 \* \* \*"/);
    assert.match(configuracao, /"certificados\/\*\*"/);
    assert.match(configuracao, /script-src 'self'; script-src-attr 'none'/);
    for (const arquivo of ['api.js', 'tarefas-diarias.js', 'reconciliar-assinaturas.js']) {
        assert.ok(fs.existsSync(path.join(raiz, 'netlify/functions', arquivo)), arquivo);
    }
});

test('a função da Netlify atende a API com o mesmo app Express', async () => {
    const { handler } = require('../netlify/functions/api');
    const resposta = await handler({
        path: '/.netlify/functions/api/sessao-publica',
        rawUrl: 'https://gbm-finance.com/sessao-publica',
        httpMethod: 'GET',
        headers: { host: 'gbm-finance.com', accept: 'application/json', 'x-nf-client-connection-ip': '203.0.113.7' },
        multiValueHeaders: {},
        queryStringParameters: {},
        multiValueQueryStringParameters: {},
        body: null,
        isBase64Encoded: false
    }, {});
    assert.equal(resposta.statusCode, 200);
    assert.deepEqual(JSON.parse(resposta.body), { logado: false });
    assert.match(String(resposta.multiValueHeaders['cache-control']), /no-store/);
    assert.equal(resposta.isBase64Encoded, false);

    // Corpo JSON chega ao Express (o login responde "Informe e-mail e senha." quando falta).
    const login = await handler({
        path: '/.netlify/functions/api/login',
        httpMethod: 'POST',
        headers: { host: 'gbm-finance.com', 'content-type': 'application/json', accept: 'application/json' },
        queryStringParameters: {},
        body: JSON.stringify({ identificacao: '', senha: '' }),
        isBase64Encoded: false
    }, {});
    assert.equal(login.statusCode, 400);
    assert.match(login.body, /Informe e-mail e senha/);
});

test('edge function: nonce do AdSense nas páginas editoriais', async () => {
    const { default: paginas } = await carregarEdgeFunction();
    const contexto = {
        next: async () => new Response('<html><head><script async src="https://pagead2.googlesyndication.com/x.js"></script><script src="a.js"></script></head></html>', {
            headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "script-src 'self'" }
        })
    };
    const resposta = await paginas(new Request('https://gbm-finance.com/guias/cartao-de-credito.html'), contexto);
    const html = await resposta.text();
    const nonce = /nonce-([^']+)'/.exec(resposta.headers.get('content-security-policy'))?.[1];
    assert.ok(nonce, 'CSP com nonce');
    assert.equal((html.match(new RegExp(`<script nonce="${nonce.replace(/[+/=]/g, '\\$&')}"`, 'g')) || []).length, 2);
    assert.match(resposta.headers.get('content-security-policy'), /'strict-dynamic'/);
    assert.equal(resposta.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');

    const appPage = await paginas(new Request('https://gbm-finance.com/login.html'), {
        next: async () => new Response('<script src="a.js"></script>', { headers: { 'content-type': 'text/html' } })
    });
    assert.doesNotMatch(await appPage.text(), /nonce=/, 'login mantém a CSP estrita');
});

test('edge function: quem já está logado vai direto ao painel', async (t) => {
    const { default: paginas } = await carregarEdgeFunction();
    const fetchOriginal = globalThis.fetch;
    t.after(() => { globalThis.fetch = fetchOriginal; });
    const chamadas = [];
    globalThis.fetch = async (url, opcoes) => {
        chamadas.push([String(url), opcoes?.headers?.cookie]);
        return Response.json({ logado: true });
    };
    const semUso = { next: async () => { throw new Error('não deveria entregar a página'); } };
    const cookie = { cookie: 'gbm_sid=s%3Aabc' };

    let resposta = await paginas(new Request('https://gbm-finance.com/', { headers: cookie }), semUso);
    assert.equal(resposta.status, 302);
    assert.equal(resposta.headers.get('location'), '/dashboard.html');
    assert.deepEqual(chamadas[0], ['https://gbm-finance.com/sessao-publica', 'gbm_sid=s%3Aabc']);

    resposta = await paginas(new Request('https://gbm-finance.com/login.html?next=%2Fmetas.html', { headers: cookie }), semUso);
    assert.equal(resposta.headers.get('location'), '/metas.html');
    resposta = await paginas(new Request('https://gbm-finance.com/login.html?next=%2F%2Fexemplo.invalid', { headers: cookie }), semUso);
    assert.equal(resposta.headers.get('location'), '/dashboard.html');

    // Sem cookie de sessão não há consulta: visitantes e robôs recebem a página.
    chamadas.length = 0;
    const pagina = await paginas(new Request('https://gbm-finance.com/'), {
        next: async () => new Response('<p>início</p>', { headers: { 'content-type': 'text/html' } })
    });
    assert.equal(pagina.status, 200);
    assert.equal(chamadas.length, 0);
});
