'use strict';

// Atualiza o parâmetro ?v= das referências a CSS e JS locais com um hash do
// conteúdo. Assim, cada alteração gera uma URL nova e nenhum navegador,
// proxy ou service worker continua usando a versão anterior.
//
//   npm run versionar            atualiza os arquivos
//   node scripts/versionar-assets.js --verificar   só confere (usado nos testes)
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PUBLICO = path.resolve(__dirname, '..', 'public');
// Tutorial e service worker são entregues sem cache e têm versão própria.
const SEM_HASH = new Set(['sw.js', 'gbm-tutorial.js', 'gbm-tutorial.css']);

function listar(diretorio, extensao) {
    return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((item) => {
        const caminho = path.join(diretorio, item.name);
        if (item.isDirectory()) return item.name === 'vendor' ? [] : listar(caminho, extensao);
        return item.name.endsWith(extensao) ? [caminho] : [];
    });
}

function resolver(referencia, arquivoOrigem, relativoAoSite) {
    const limpo = referencia.split('?')[0];
    if (limpo.startsWith('/')) return path.join(PUBLICO, limpo);
    const base = relativoAoSite ? PUBLICO : path.dirname(arquivoOrigem);
    return path.resolve(base, limpo);
}

function criarVersionador(conteudos) {
    const cacheHash = new Map();
    const hashDe = (arquivo) => {
        if (!cacheHash.has(arquivo)) {
            const conteudo = conteudos.get(arquivo) ?? fs.readFileSync(arquivo);
            cacheHash.set(arquivo, crypto.createHash('sha256').update(conteudo).digest('hex').slice(0, 10));
        }
        return cacheHash.get(arquivo);
    };
    return {
        limpar: () => cacheHash.clear(),
        substituir(referencia, arquivoOrigem, relativoAoSite) {
            const limpo = referencia.split('?')[0];
            if (SEM_HASH.has(path.basename(limpo))) return referencia;
            const destino = resolver(referencia, arquivoOrigem, relativoAoSite);
            if (!destino.startsWith(PUBLICO) || !fs.existsSync(destino)) return referencia;
            return `${limpo}?v=${hashDe(destino)}`;
        }
    };
}

// Referências versionadas dentro de JS: 'arquivo.css?v=...'
const REFERENCIA_JS = /(['"`])((?:\/|\.\.\/)?(?:[\w-]+\/)*[\w.-]+\.(?:css|js))\?v=[\w.-]*\1/g;
// Atributos src/href locais em HTML.
const REFERENCIA_HTML = /\b(src|href)="((?!https?:|\/\/|data:)[^"?#]+\.(?:css|js))(?:\?v=[^"]*)?"/g;

function versionarTudo() {
    const conteudos = new Map();
    const ler = (arquivo) => conteudos.get(arquivo) ?? fs.readFileSync(arquivo, 'utf8');
    const versionador = criarVersionador(conteudos);
    const scripts = listar(PUBLICO, '.js').filter((arquivo) => path.basename(arquivo) !== 'sw.js');

    // JS pode apontar para outros arquivos; repete até estabilizar os hashes.
    for (let rodada = 0; rodada < 6; rodada += 1) {
        let mudou = false;
        for (const arquivo of scripts) {
            const original = ler(arquivo);
            const novo = original.replace(REFERENCIA_JS, (_, aspas, referencia) =>
                `${aspas}${versionador.substituir(referencia, arquivo, true)}${aspas}`);
            if (novo !== original) {
                conteudos.set(arquivo, novo);
                mudou = true;
            }
        }
        versionador.limpar();
        if (!mudou) break;
    }

    for (const arquivo of listar(PUBLICO, '.html')) {
        const original = ler(arquivo);
        const novo = original.replace(REFERENCIA_HTML, (_, atributo, referencia) =>
            `${atributo}="${versionador.substituir(referencia, arquivo, false)}"`);
        if (novo !== original) conteudos.set(arquivo, novo);
    }

    // Pré-cache do service worker: mesmas URLs das páginas e nome de cache
    // derivado das versões, para descartar o pré-cache anterior.
    const sw = path.join(PUBLICO, 'sw.js');
    const originalSw = ler(sw);
    let novoSw = originalSw.replace(/'(\/[\w./-]+\.(?:css|js))(?:\?v=[\w.-]*)?'/g, (trecho, referencia) =>
        `'${versionador.substituir(referencia, sw, true)}'`);
    const versoes = crypto.createHash('sha256')
        .update((novoSw.match(/\?v=[\w.-]+/g) || []).join('|')).digest('hex').slice(0, 8);
    novoSw = novoSw.replace(/const CACHE_GBM = '[^']*';/, `const CACHE_GBM = 'gbm-estatico-${versoes}';`);
    if (novoSw !== originalSw) conteudos.set(sw, novoSw);

    return conteudos;
}

function verificarVersoes() {
    return [...versionarTudo().keys()].map((arquivo) => path.relative(PUBLICO, arquivo)).sort();
}

if (require.main === module) {
    const alterados = versionarTudo();
    if (process.argv.includes('--verificar')) {
        if (alterados.size) {
            console.error(`Versões desatualizadas em: ${[...alterados.keys()].map((a) => path.relative(PUBLICO, a)).join(', ')}`);
            console.error('Execute npm run versionar.');
            process.exit(1);
        }
        console.log('Versões dos arquivos estão atualizadas.');
    } else {
        for (const [arquivo, conteudo] of alterados) fs.writeFileSync(arquivo, conteudo);
        console.log(`${alterados.size} arquivo(s) atualizado(s).`);
    }
}

module.exports = { verificarVersoes, versionarTudo };
