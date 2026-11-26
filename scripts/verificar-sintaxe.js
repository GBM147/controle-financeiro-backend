'use strict';

// Confere a sintaxe de todos os arquivos JavaScript do projeto, sem executá-los.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ignorar = new Set(['node_modules', '.git', 'coverage', 'vendor']);

function listar(diretorio) {
    return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((item) => {
        if (ignorar.has(item.name)) return [];
        const caminho = path.join(diretorio, item.name);
        if (item.isDirectory()) return listar(caminho);
        return item.name.endsWith('.js') ? [caminho] : [];
    });
}

// Edge functions da Netlify são módulos ES (rodam no Deno); conferidas como .mjs.
const PASTA_EDGE = path.join(raiz, 'netlify', 'edge-functions') + path.sep;
const temporarios = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'gbm-sintaxe-'));

const falhas = listar(raiz).filter((arquivo) => {
    let alvo = arquivo;
    if (arquivo.startsWith(PASTA_EDGE)) {
        alvo = path.join(temporarios, `${path.basename(arquivo, '.js')}.mjs`);
        fs.copyFileSync(arquivo, alvo);
    }
    const resultado = spawnSync(process.execPath, ['--check', alvo], { encoding: 'utf8' });
    if (resultado.status !== 0) process.stderr.write(resultado.stderr);
    return resultado.status !== 0;
});

fs.rmSync(temporarios, { recursive: true, force: true });

if (falhas.length) {
    console.error(`${falhas.length} arquivo(s) com erro de sintaxe.`);
    process.exit(1);
}
console.log('Sintaxe verificada.');
