'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('páginas de ação não carregam anúncios e não são indexáveis', () => {
    for (const pagina of ['public/login.html', 'public/dashboard.html']) {
        const html = ler(pagina);
        assert.doesNotMatch(html, /pagead2|adsbygoogle/i);
        assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/i);
    }
});

test('infraestrutura editorial está completa', () => {
    assert.match(ler('public/ads.txt'), /^google\.com, pub-2735805392775741, DIRECT, f08c47fec0942fa0/m);
    assert.match(ler('public/robots.txt'), /Sitemap: https:\/\/gbm-finance\.com\/sitemap\.xml/);
    assert.match(ler('public/sitemap.xml'), /guias\/orcamento-pessoal\.html/);
    assert.match(ler('public/index.html'), /educacao-financeira\.html/);

    const paginas = [
        'public/guias/orcamento-pessoal.html',
        'public/guias/controle-de-gastos.html',
        'public/guias/reserva-de-emergencia.html',
        'public/guias/dividas-e-juros.html',
        'public/guias/metas-financeiras.html'
    ];
    for (const pagina of paginas) {
        const texto = ler(pagina).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        assert.ok(texto.split(' ').length >= 550, `${pagina} precisa manter conteúdo substancial`);
    }
});

test('configuração evita regressões de segurança conhecidas', () => {
    const servidor = ler('index.js');
    const pacote = JSON.parse(ler('package.json'));
    assert.doesNotMatch(servidor, /rejectUnauthorized:\s*false/);
    assert.doesNotMatch(servidor, /Math\.random\(\).*900000/);
    assert.match(servidor, /pendingVerificationUserId/);
    assert.match(servidor, /token_finalidade = 'verificacao_conta'/);
    assert.equal(pacote.dependencies.nodemailer, undefined);
    assert.equal(pacote.dependencies['node-ofx-parser'], undefined);
    assert.match(pacote.dependencies.multer, /^\^2\.[12]\./);
});

test('login informa ao usuário quando as credenciais são recusadas', () => {
    const login = ler('public/login.html');
    assert.match(login, /if \(!data\.success\)/);
    assert.match(login, /gbmAlerta\(data\.message \|\| 'E-mail ou senha incorretos\.'/);
});

test('scripts embutidos e links locais das páginas são válidos', () => {
    const paginas = fs.readdirSync(path.join(raiz, 'public'), { recursive: true })
        .filter((arquivo) => String(arquivo).endsWith('.html'));

    for (const arquivo of paginas) {
        const caminho = path.join(raiz, 'public', arquivo);
        const html = fs.readFileSync(caminho, 'utf8');
        for (const correspondencia of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
            assert.doesNotThrow(
                () => new vm.Script(correspondencia[1], { filename: caminho }),
                `JavaScript inválido em ${arquivo}`
            );
        }

        for (const correspondencia of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
            const destino = correspondencia[1].split(/[?#]/)[0];
            if (!destino || /^(?:https?:|data:|mailto:|tel:|#)/i.test(destino)) continue;
            const arquivoDestino = path.resolve(path.dirname(caminho), destino);
            assert.ok(
                arquivoDestino.startsWith(path.join(raiz, 'public')) && fs.existsSync(arquivoDestino),
                `Link local ausente em ${arquivo}: ${destino}`
            );
        }
    }
});
