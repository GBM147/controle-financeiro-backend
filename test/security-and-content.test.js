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
    assert.match(pacote.dependencies.helmet, /^\^8\./);
    assert.match(pacote.dependencies['express-rate-limit'], /^\^8\./);
    assert.match(servidor, /contentSecurityPolicy/);
    assert.match(servidor, /validarAssinaturaPdf/);
    assert.match(servidor, /\[SERVER ERROR\]/);
});

test('PWA possui fallback offline e nomes de rota consistentes', () => {
    assert.match(ler('public/sw.js'), /offline\.html/);
    assert.ok(fs.existsSync(path.join(raiz, 'public/limite-de-gastos.html')));
    assert.ok(!fs.existsSync(path.join(raiz, 'public/Limite-de-Gastos.html')));
    assert.doesNotMatch(ler('public/dashboard.html'), /Limite-de-Gastos\.html/);
});

test('login informa ao usuário quando as credenciais são recusadas', () => {
    const login = ler('public/login.html');
    assert.match(login, /if \(!data\.success\)/);
    assert.match(login, /gbmAlerta\(data\.message \|\| 'E-mail ou senha incorretos\.'/);
});

test('login temporário usa a sessão do servidor sem depender do storage', () => {
    const servidor = ler('index.js');
    const login = ler('public/login.html');
    const dashboard = ler('public/dashboard.html');
    const autenticacao = ler('public/auth.js');

    assert.match(login, /JSON\.stringify\([\s\S]*manterConectado/);
    assert.match(servidor, /configurarPersistenciaSessao\(req\.session, manterConectado\)/);
    assert.match(servidor, /app\.post\('\/logout'/);
    assert.match(dashboard, /fetchApi\('\/login-status'\)/);
    assert.doesNotMatch(dashboard, /if \(!pegarUserId\(\)\)\s*\{\s*window\.location\.href/);
    assert.match(autenticacao, /fetch\('\/logout', \{ method: 'POST', credentials: 'include' \}\)/);
});

test('modal permite exclusão individual e salva categorias em lote', () => {
    const servidor = ler('index.js');
    const dashboard = ler('public/dashboard.html');

    assert.match(servidor, /app\.post\('\/corrigir-categorias', exigirLogin/);
    assert.match(servidor, /app\.delete\('\/transacoes\/:id', exigirLogin/);
    assert.match(servidor, /DELETE t[\s\S]*JOIN contas_bancarias cb[\s\S]*cb\.usuario_id = \?/);
    assert.match(dashboard, /function salvarCorrecoesCategoria\(\)/);
    assert.match(dashboard, /function excluirTransacao\(transacaoId\)/);
    assert.equal((dashboard.match(/id="btn-salvar-categorias"/g) || []).length, 1);
    assert.doesNotMatch(dashboard, /onclick="salvarCorrecao\(/);
});

test('interface não contém emojis e o menu usa capitalização comum sem brilho verde', () => {
    const extensoesTexto = new Set(['.css', '.html', '.js', '.json', '.txt', '.xml']);
    const arquivosPublicos = fs.readdirSync(path.join(raiz, 'public'), { recursive: true })
        .filter((arquivo) => extensoesTexto.has(path.extname(String(arquivo)).toLowerCase()))
        .map((arquivo) => path.join('public', String(arquivo)));
    // Mantém a proibição de emojis reais, mas não confunde símbolos Unicode usados
    // como ícones da interface (⌂, ⇄, ⚙ etc.) com emoji.
    const emoji = /[\p{Emoji_Presentation}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/u;

    for (const arquivo of ['index.js', ...arquivosPublicos]) {
        const conteudo = ler(arquivo);
        assert.doesNotMatch(conteudo, emoji, `${arquivo} ainda contém emoji`);
        assert.doesNotMatch(conteudo, /☰/, `${arquivo} ainda contém símbolo decorativo de menu`);
    }

    const dashboard = ler('public/dashboard.html');
    const regraMenu = dashboard.match(/\.sidebar-content \.menu-item \{([\s\S]*?)\}/)?.[1] || '';
    assert.match(regraMenu, /text-transform:\s*none/);
    assert.match(regraMenu, /text-shadow:\s*none/);
    assert.doesNotMatch(regraMenu, /#5fffa8|rgba\(95,\s*255,\s*168/i);
    assert.match(dashboard, /class="menu-item-conteudo"[^>]*>\s*Minhas contas\s*<\/span>/);
    assert.match(dashboard, /class="menu-item-conteudo"[^>]*>\s*Limite de gastos\s*<\/span>/);
    assert.match(dashboard, /class="menu-item-conteudo"[^>]*>\s*Relatório mensal\s*<\/span>/);
    assert.match(dashboard, /class="menu-item-conteudo"[^>]*>\s*Comparativo mensal\s*<\/span>/);
});

test('análises oferecem tipos de gráfico e o dashboard permite exibir somente o gráfico', () => {
    const dashboard = ler('public/dashboard.html');
    const relatorio = ler('public/relatorio-avancado.html');
    const comparativo = ler('public/comparativo.html');

    assert.match(dashboard, /id="select-tipo"[\s\S]*?<option value="chart">Apenas gráfico<\/option>/);
    assert.match(dashboard, /id="select-grafico-dashboard"[\s\S]*?<option value="bar">Barras<\/option>[\s\S]*?<option value="doughnut">Rosca<\/option>[\s\S]*?<option value="line">Linha<\/option>/);
    assert.match(dashboard, /const showTable = tipoExibicao !== 'chart'/);
    assert.match(dashboard, /type: tipoGrafico/);

    assert.match(relatorio, /id="tipo-grafico-relatorio"[\s\S]*?<option value="bar">Barras<\/option>[\s\S]*?<option value="doughnut">Rosca<\/option>[\s\S]*?<option value="polarArea">Área polar<\/option>/);
    assert.match(relatorio, /function renderizarGraficoCategorias\(\)/);

    assert.match(comparativo, /id="tipo-grafico-comparativo"[\s\S]*?<option value="bar">Barras agrupadas<\/option>[\s\S]*?<option value="line">Linhas<\/option>[\s\S]*?<option value="radar">Radar<\/option>/);
    assert.match(comparativo, /function trocarTipoGraficoComparativo\(\)/);
});

test('redesign preserva o mármore e deixa perfil e menu sem card', () => {
    const dashboard = ler('public/dashboard.html');
    const estilosInternos = ler('public/gbm-pages.css');

    assert.match(dashboard, /url\('fundo-marmore\.jpg'\)/);
    assert.match(estilosInternos, /url\("fundo-marmore\.jpg"\)/);
    assert.match(dashboard, /\.atalho-perfil,\s*\.gbm-menu-btn\s*\{[\s\S]*?border:\s*0\s*!important;[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;/);
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
