'use strict';

// API do GBM na Netlify: o mesmo app Express do servidor, executado como
// função. As páginas e arquivos estáticos saem direto do CDN da Netlify;
// public/_redirects encaminha para cá apenas os caminhos da API.
//
// Cada chamada é repassada a um servidor HTTP local dentro da própria função.
// Assim o Express recebe uma requisição de verdade: JSON, formulários, uploads
// (multer), cookies de sessão e IP funcionam exatamente como no servidor Node.

// Cada instância da função abre poucas conexões: várias podem rodar ao mesmo tempo.
process.env.DB_POOL_LIMIT = process.env.DB_POOL_LIMIT || '2';

const http = require('node:http');
const { app } = require('../../src/app');
const { registrarRotaAssistente } = require('../../ia-assistente');
const { prepararBanco } = require('../../src/db/migracoes');

// No servidor Node, a rota do assistente entra no listen (ia-assistente-loader.js).
registrarRotaAssistente(app);

const PREFIXO_FUNCAO = /^\/\.netlify\/functions\/api(?=\/|$)/;
const TIPOS_TEXTO = /^(?:text\/|application\/(?:json|javascript|xml|x-www-form-urlencoded)|image\/svg\+xml)/i;

// Prepara as estruturas do banco uma vez por instância, sem segurar a primeira resposta.
let bancoPreparado = null;
function prepararUmaVez() {
    if (process.env.NODE_ENV === 'test') return;
    bancoPreparado ||= prepararBanco().catch((erro) => {
        bancoPreparado = null;
        console.error('Erro ao preparar o banco de dados:', erro.code || erro.message);
    });
}

let servidorLocal = null;
function portaLocal() {
    servidorLocal ||= new Promise((resolver, rejeitar) => {
        const servidor = http.createServer(app);
        servidor.keepAliveTimeout = 60000;
        servidor.once('error', rejeitar);
        servidor.listen(0, '127.0.0.1', () => resolver(servidor.address().port));
        // Não segura o processo aberto (a Netlify mantém a instância viva por conta própria).
        servidor.unref();
    });
    return servidorLocal;
}

function montarCaminho(evento) {
    const caminho = String(evento.path || '/').replace(PREFIXO_FUNCAO, '') || '/';
    const parametros = new URLSearchParams();
    const multiplos = evento.multiValueQueryStringParameters || {};
    const simples = evento.queryStringParameters || {};
    for (const [chave, valores] of Object.entries(multiplos)) {
        for (const valor of valores || []) parametros.append(chave, valor);
    }
    for (const [chave, valor] of Object.entries(simples)) {
        if (!(chave in multiplos)) parametros.append(chave, valor);
    }
    const consulta = parametros.toString();
    return consulta ? `${caminho}?${consulta}` : caminho;
}

function montarCabecalhos(evento, corpo) {
    const cabecalhos = {};
    for (const [nome, valores] of Object.entries(evento.multiValueHeaders || {})) {
        cabecalhos[nome.toLowerCase()] = (valores || []).join(', ');
    }
    for (const [nome, valor] of Object.entries(evento.headers || {})) {
        cabecalhos[nome.toLowerCase()] = valor;
    }
    // A Netlify encerra o HTTPS antes da função: sem isto o cookie de sessão
    // "secure" não seria emitido e o login não funcionaria.
    cabecalhos['x-forwarded-proto'] = cabecalhos['x-forwarded-proto'] || 'https';
    // IP real do visitante (limite de requisições e auditoria).
    cabecalhos['x-forwarded-for'] = cabecalhos['x-nf-client-connection-ip']
        || String(cabecalhos['x-forwarded-for'] || '').split(',')[0].trim()
        || '127.0.0.1';
    delete cabecalhos['transfer-encoding'];
    delete cabecalhos.connection;
    cabecalhos['content-length'] = String(corpo ? corpo.length : 0);
    return cabecalhos;
}

exports.handler = async (evento, contexto = {}) => {
    contexto.callbackWaitsForEmptyEventLoop = false;
    prepararUmaVez();
    const porta = await portaLocal();
    const corpo = evento.body
        ? Buffer.from(evento.body, evento.isBase64Encoded ? 'base64' : 'utf8')
        : null;

    const { resposta, conteudo } = await new Promise((resolver, rejeitar) => {
        const requisicao = http.request({
            host: '127.0.0.1',
            port: porta,
            method: evento.httpMethod || 'GET',
            path: montarCaminho(evento),
            headers: montarCabecalhos(evento, corpo)
        }, (resposta) => {
            const partes = [];
            resposta.on('data', (parte) => partes.push(parte));
            resposta.on('end', () => resolver({ resposta, conteudo: Buffer.concat(partes) }));
            resposta.on('error', rejeitar);
        });
        requisicao.on('error', rejeitar);
        if (corpo) requisicao.write(corpo);
        requisicao.end();
    });

    const multiValueHeaders = {};
    for (const [nome, valor] of Object.entries(resposta.headers)) {
        if (['connection', 'keep-alive', 'transfer-encoding'].includes(nome)) continue;
        multiValueHeaders[nome] = Array.isArray(valor) ? valor : [String(valor)];
    }
    const binario = conteudo.length > 0 && !TIPOS_TEXTO.test(String(resposta.headers['content-type'] || 'text/plain'));
    return {
        statusCode: resposta.statusCode,
        multiValueHeaders,
        body: binario ? conteudo.toString('base64') : conteudo.toString('utf8'),
        isBase64Encoded: binario
    };
};
