'use strict';

// Gera public/_redirects para a Netlify a partir das rotas registradas no app
// Express. Cada rota da API vira uma regra forçada ("200!") para a função
// netlify/functions/api; assim /contas (API) não é confundida com contas.html.
//
//   npm run rotas:netlify              atualiza o arquivo
//   node scripts/gerar-rotas-netlify.js --verificar   só confere (testes)
const fs = require('node:fs');
const path = require('node:path');

const ARQUIVO = path.resolve(__dirname, '..', 'public', '_redirects');
// O início e o login são páginas estáticas; o redirecionamento de quem já está
// logado é feito pela edge function netlify/edge-functions/paginas.js.
const SO_NO_SERVIDOR_NODE = new Set(['/', '/index.html', '/login.html']);

function listarRotas() {
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    // Valores fictícios só para carregar o app e ler as rotas; nada é chamado.
    for (const [nome, valor] of Object.entries({ SESSION_SECRET: 'gerar-rotas', RESEND_API_KEY: 're_gerar_rotas', MP_ACCESS_TOKEN: 'gerar-rotas' })) {
        process.env[nome] = process.env[nome] || valor;
    }
    const { app } = require('../src/app');
    require('../ia-assistente').registrarRotaAssistente(app);
    const rotas = new Set();
    for (const camada of (app.router || app._router).stack) {
        if (!camada.route) continue;
        const caminhos = Array.isArray(camada.route.path) ? camada.route.path : [camada.route.path];
        for (const caminho of caminhos) {
            if (typeof caminho === 'string' && !SO_NO_SERVIDOR_NODE.has(caminho)) rotas.add(caminho);
        }
    }
    return [...rotas].sort();
}

function gerarConteudo(rotas) {
    const largura = Math.max(...rotas.map((rota) => rota.length)) + 2;
    const linhas = rotas.map((rota) => `${rota.padEnd(largura)}/.netlify/functions/api${rota}  200!`);
    return [
        '# Gerado por scripts/gerar-rotas-netlify.js (npm run rotas:netlify). Não edite à mão.',
        '# Rotas da API -> função da Netlify. Páginas e arquivos saem direto do CDN.',
        ...linhas,
        '',
        '# Endereço inexistente: página 404 com links úteis.',
        '/*'.padEnd(largura) + '/404.html  404',
        ''
    ].join('\n');
}

function conteudoEsperado() {
    return gerarConteudo(listarRotas());
}

function verificar() {
    const atual = fs.existsSync(ARQUIVO) ? fs.readFileSync(ARQUIVO, 'utf8') : '';
    return atual === conteudoEsperado();
}

if (require.main === module) {
    if (process.argv.includes('--verificar')) {
        const ok = verificar();
        console.log(ok ? 'public/_redirects está atualizado.' : 'public/_redirects desatualizado: execute npm run rotas:netlify.');
        process.exit(ok ? 0 : 1);
    }
    fs.writeFileSync(ARQUIVO, conteudoEsperado());
    console.log('public/_redirects atualizado.');
    process.exit(0);
}

module.exports = { conteudoEsperado, verificar };
