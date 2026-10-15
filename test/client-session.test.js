'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sessionSource = fs.readFileSync(path.join(__dirname, '../public/gbm-session.js'), 'utf8');
const authSource = fs.readFileSync(path.join(__dirname, '../public/auth.js'), 'utf8');

function criarStorage(valores = {}, bloqueado = false) {
    const valoresAtuais = new Map(Object.entries(valores));
    return {
        getItem(chave) {
            if (bloqueado) throw new Error('Storage indisponível.');
            return valoresAtuais.get(chave) ?? null;
        },
        setItem(chave, valor) {
            if (bloqueado) throw new Error('Storage indisponível.');
            valoresAtuais.set(chave, String(valor));
        },
        removeItem(chave) {
            if (bloqueado) throw new Error('Storage indisponível.');
            valoresAtuais.delete(chave);
        }
    };
}

function criarDocumento() {
    const elementos = new Map();
    const avisos = [];
    return {
        readyState: 'complete',
        avisos,
        addEventListener() {},
        getElementById(id) { return elementos.get(id) || null; },
        querySelector() { return null; },
        createElement() {
            return {
                filhos: [],
                atributos: {},
                setAttribute(nome, valor) { this.atributos[nome] = valor; },
                addEventListener() {},
                appendChild(elemento) { this.filhos.push(elemento); }
            };
        },
        body: {
            prepend(elemento) {
                elementos.set(elemento.id, elemento);
                avisos.push(elemento);
            }
        }
    };
}

function resposta(status, dados) {
    return { status, ok: status >= 200 && status < 300, json: async () => dados };
}

function iniciarCliente({
    pagina = '/index.html',
    status = 200,
    dados = { success: true, userId: 17, manterConectado: true },
    local = {},
    temporario = {},
    storageBloqueado = false,
    falhaDeRede = false,
    incluirAuth = false,
    respostaApi = resposta(200, { success: true })
} = {}) {
    const url = new URL(pagina, 'https://gbm-finance.com');
    const redirecionamentos = [];
    const chamadas = [];
    const document = criarDocumento();
    const contexto = {
        URL,
        URLSearchParams,
        console,
        document,
        navigator: {},
        localStorage: criarStorage(local, storageBloqueado),
        sessionStorage: criarStorage(temporario, storageBloqueado),
        location: {
            pathname: url.pathname,
            search: url.search,
            hash: url.hash,
            origin: url.origin,
            replace(destino) { redirecionamentos.push(destino); }
        },
        fetch: async (destino, opcoes) => {
            chamadas.push({ destino, opcoes });
            if (destino !== '/login-status') return respostaApi;
            if (falhaDeRede) throw new Error('Rede temporariamente indisponível.');
            return resposta(status, dados);
        }
    };
    contexto.window = contexto;
    vm.createContext(contexto);
    vm.runInContext(sessionSource, contexto, { filename: 'gbm-session.js' });
    if (incluirAuth) vm.runInContext(authSource, contexto, { filename: 'auth.js' });
    return { contexto, sessao: contexto.GBMSession, redirecionamentos, chamadas, document };
}

test('cookie válido leva a página inicial diretamente ao dashboard, sem passar pelo login', async () => {
    for (const pagina of ['/', '/index.html']) {
        const cliente = iniciarCliente({ pagina });
        await cliente.sessao.ready;
        assert.deepEqual(cliente.redirecionamentos, ['/dashboard.html']);
        assert.equal(cliente.sessao.status, 200);
        assert.equal(cliente.chamadas.length, 1);
        assert.equal(cliente.chamadas[0].destino, '/login-status');
        assert.equal(cliente.chamadas[0].opcoes.credentials, 'include');
        assert.equal(cliente.chamadas[0].opcoes.cache, 'no-store');
        assert.strictEqual(cliente.sessao.check(), cliente.sessao.ready);
    }
});

test('a opção inicio permite visitar a apresentação pública mesmo estando conectado', async () => {
    const cliente = iniciarCliente({ pagina: '/index.html?inicio=1' });
    await cliente.sessao.ready;
    assert.deepEqual(cliente.redirecionamentos, []);
    assert.equal(cliente.sessao.getUserId(), '17');
});

test('identidade antiga no storage não autentica visitante e não o tira da página pública', async () => {
    const cliente = iniciarCliente({
        status: 401,
        local: { userIdAtual: '17' },
        temporario: { userIdAtual: '99' }
    });
    assert.equal(await cliente.sessao.ready, null);
    assert.equal(cliente.sessao.status, 401);
    assert.equal(cliente.sessao.getUserId(), null);
    assert.equal(cliente.contexto.localStorage.getItem('userIdAtual'), null);
    assert.equal(cliente.contexto.sessionStorage.getItem('userIdAtual'), null);
    assert.deepEqual(cliente.redirecionamentos, []);
});

test('o cookie recupera a identidade em perfil aberto diretamente com ambos os storages vazios', async () => {
    const cliente = iniciarCliente({ pagina: '/perfil.html', incluirAuth: true });
    await cliente.contexto.gbmSessaoPronta;
    assert.equal(cliente.sessao.getUserId(), '17');
    assert.deepEqual(cliente.redirecionamentos, []);
});

test('manter conectado sincroniza o storage local e remove a identidade temporária antiga', async () => {
    const cliente = iniciarCliente({
        pagina: '/login.html',
        dados: { success: true, userId: 42, manterConectado: true },
        temporario: { userIdAtual: '17' }
    });
    await cliente.sessao.ready;
    assert.equal(cliente.contexto.localStorage.getItem('userIdAtual'), '42');
    assert.equal(cliente.contexto.sessionStorage.getItem('userIdAtual'), null);
    assert.deepEqual(cliente.redirecionamentos, ['/dashboard.html']);
});

test('sessão temporária conserva a identidade somente no storage da aba', async () => {
    const cliente = iniciarCliente({
        pagina: '/login.html',
        dados: { success: true, userId: 42, manterConectado: false },
        local: { userIdAtual: '17' }
    });
    await cliente.sessao.ready;
    assert.equal(cliente.contexto.localStorage.getItem('userIdAtual'), null);
    assert.equal(cliente.contexto.sessionStorage.getItem('userIdAtual'), '42');
    assert.deepEqual(cliente.redirecionamentos, ['/dashboard.html']);
});

test('storage bloqueado não invalida o cookie nem perde a identidade recebida do servidor', async () => {
    const cliente = iniciarCliente({ pagina: '/perfil.html', storageBloqueado: true, incluirAuth: true });
    await cliente.contexto.gbmSessaoPronta;
    assert.equal(cliente.sessao.getUserId(), '17');
    assert.equal(cliente.sessao.status, 200);
    assert.deepEqual(cliente.redirecionamentos, []);
});

test('indisponibilidade 503 mantém a identidade e a página atual sem fingir sessão expirada', async () => {
    const cliente = iniciarCliente({
        pagina: '/perfil.html', status: 503, incluirAuth: true,
        local: { userIdAtual: '17' }
    });
    assert.equal(await cliente.contexto.gbmSessaoPronta, null);
    assert.equal(cliente.sessao.status, 503);
    assert.equal(cliente.sessao.getUserId(), '17');
    assert.deepEqual(cliente.redirecionamentos, []);
    assert.equal(cliente.document.avisos.length, 1);
    assert.equal(cliente.document.avisos[0].atributos.role, 'status');
    assert.match(cliente.document.avisos[0].textContent, /verificar sua sessão/);
});

test('falha de rede preserva a sessão local e não inicia um ciclo de redirecionamento', async () => {
    const cliente = iniciarCliente({
        pagina: '/perfil.html', falhaDeRede: true, incluirAuth: true,
        temporario: { userIdAtual: '17' }
    });
    await cliente.contexto.gbmSessaoPronta;
    assert.equal(cliente.sessao.getUserId(), '17');
    assert.equal(cliente.sessao.status, null);
    assert.deepEqual(cliente.redirecionamentos, []);
    assert.equal(cliente.document.avisos.length, 1);
});

test('sessão expirada em página da conta vai diretamente ao login e preserva seu destino', async () => {
    const cliente = iniciarCliente({
        pagina: '/perfil.html?aba=seguranca#senha', status: 401, incluirAuth: true,
        local: { userIdAtual: '17' }
    });
    await cliente.contexto.gbmSessaoPronta;
    const destino = '/login.html?next=' + encodeURIComponent('/perfil.html?aba=seguranca#senha');
    assert.deepEqual(cliente.redirecionamentos, [destino]);
    assert.equal(cliente.sessao.getUserId(), null);
    cliente.sessao.redirectToLogin();
    assert.deepEqual(cliente.redirecionamentos, [destino]);
});

test('retorno após login aceita uma página da conta e conserva filtros e âncora', async () => {
    const retorno = '/relatorio.html?mes=2026-10&tipo=despesa#grafico';
    const cliente = iniciarCliente({ pagina: '/login.html?next=' + encodeURIComponent(retorno) });
    await cliente.sessao.ready;
    assert.equal(cliente.sessao.destination(), retorno);
    assert.deepEqual(cliente.redirecionamentos, [retorno]);
});

test('retorno após login rejeita destinos externos, protocolos executáveis e ciclos de login', async () => {
    const destinos = [
        'https://outro.example/perfil.html',
        '//outro.example/dashboard.html',
        'javascript:alert(1)',
        '/login.html?next=/login.html',
        '/index.html',
        '/pasta/perfil.html',
        '/perfil.html/',
        '/nao-existe.html',
        '/%70erfil.html'
    ];
    for (const retorno of destinos) {
        const cliente = iniciarCliente({ pagina: '/login.html?next=' + encodeURIComponent(retorno) });
        await cliente.sessao.ready;
        assert.equal(cliente.sessao.destination(), '/dashboard.html', retorno);
        assert.deepEqual(cliente.redirecionamentos, ['/dashboard.html'], retorno);
    }
});

test('visitante na tela de login permanece nela sem loop, mesmo com storage antigo', async () => {
    const cliente = iniciarCliente({
        pagina: '/login.html', status: 401, local: { userIdAtual: '17' }
    });
    await cliente.sessao.ready;
    cliente.sessao.redirectToLogin();
    assert.deepEqual(cliente.redirecionamentos, []);
    assert.equal(cliente.sessao.getUserId(), null);
});

test('fetchApi aguarda a sessão e envia o cookie nas chamadas de uma página da conta', async () => {
    const cliente = iniciarCliente({ pagina: '/perfil.html', incluirAuth: true });
    const resultado = await vm.runInContext('fetchApi("/dados-da-conta")', cliente.contexto);
    assert.equal(resultado.status, 200);
    assert.deepEqual(cliente.chamadas.map(({ destino }) => destino), ['/login-status', '/dados-da-conta']);
    assert.equal(cliente.chamadas[1].opcoes.credentials, 'include');
    assert.deepEqual(cliente.redirecionamentos, []);
});

test('erro 503 de uma API não apaga a sessão validada nem manda o usuário ao login', async () => {
    const cliente = iniciarCliente({
        pagina: '/perfil.html', incluirAuth: true, respostaApi: resposta(503, {})
    });
    const resultado = await vm.runInContext('fetchApi("/dados-da-conta")', cliente.contexto);
    assert.equal(resultado.status, 503);
    assert.equal(cliente.sessao.getUserId(), '17');
    assert.deepEqual(cliente.redirecionamentos, []);
});

test('erro 401 de uma API limpa a identidade e redireciona uma única vez ao login', async () => {
    const cliente = iniciarCliente({
        pagina: '/perfil.html', incluirAuth: true, respostaApi: resposta(401, {})
    });
    vm.runInContext('fetchApi("/dados-da-conta")', cliente.contexto);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(cliente.sessao.getUserId(), null);
    assert.deepEqual(cliente.redirecionamentos, ['/login.html?next=%2Fperfil.html']);
    cliente.sessao.redirectToLogin();
    assert.equal(cliente.redirecionamentos.length, 1);
});
