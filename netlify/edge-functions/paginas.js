// Edge function da Netlify (roda antes do CDN entregar a página).
//  1. Quem já está logado vai direto ao painel ao abrir o início ou o login,
//     sem a tela inicial aparecer por um instante.
//  2. Páginas editoriais com AdSense recebem um nonce por requisição na CSP
//     ('strict-dynamic'), a política recomendada pelo Google
//     (support.google.com/adsense/answer/16283098). É o mesmo que o servidor
//     Express faz em src/app.js.

const EDITORIAIS = /^\/(?:|index\.html|educacao-financeira\.html|ferramentas\.html|(?:guias|calculadoras)\/[a-z0-9-]+\.html)$/;
const INICIO_OU_LOGIN = /^\/(?:|index\.html|login\.html)$/;
const PAGINAS_DO_PAINEL = new Set([
    'assinatura.html', 'calendario.html', 'comparativo.html', 'configuracoes.html', 'contas.html',
    'dashboard.html', 'importacoes.html', 'importar-pdf.html', 'limite-de-gastos.html', 'metas.html',
    'notificacoes.html', 'pagamento.html', 'perfil.html', 'privacidade.html', 'relatorio-avancado.html',
    'relatorio.html'
]);

export function cspPaginaEditorial(nonce) {
    return [
        `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https: http:`,
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        'upgrade-insecure-requests'
    ].join('; ');
}

function gerarNonce() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
}

export function destinoAposLogin(url) {
    if (url.pathname !== '/login.html') return '/dashboard.html';
    const proxima = url.searchParams.get('next') || '';
    const pagina = /^\/([a-z0-9-]+\.html)(?:[?#].*)?$/.exec(proxima)?.[1];
    return pagina && PAGINAS_DO_PAINEL.has(pagina) ? proxima : '/dashboard.html';
}

async function estaLogado(request, url) {
    const cookie = request.headers.get('cookie') || '';
    if (!/(?:^|;\s*)gbm_sid=/.test(cookie)) return false;
    try {
        const resposta = await fetch(new URL('/sessao-publica', url), { headers: { cookie } });
        if (!resposta.ok) return false;
        const dados = await resposta.json();
        return dados?.logado === true;
    } catch {
        return false;
    }
}

export default async function paginas(request, context) {
    const url = new URL(request.url);

    if (INICIO_OU_LOGIN.test(url.pathname)
        && (url.pathname === '/login.html' || !url.searchParams.has('inicio'))
        && await estaLogado(request, url)) {
        return new Response(null, {
            status: 302,
            headers: { Location: destinoAposLogin(url), 'Cache-Control': 'private, no-store' }
        });
    }

    const resposta = await context.next();
    const tipo = resposta.headers.get('content-type') || '';
    if (!EDITORIAIS.test(url.pathname) || !tipo.includes('text/html')) return resposta;

    const nonce = gerarNonce();
    const html = (await resposta.text()).replace(/<script(?=[\s>])/gi, `<script nonce="${nonce}"`);
    const cabecalhos = new Headers(resposta.headers);
    cabecalhos.set('Content-Security-Policy', cspPaginaEditorial(nonce));
    // Cliques em anúncios abrem janelas de outros domínios a partir de iframes.
    cabecalhos.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    cabecalhos.set('Cache-Control', 'no-cache');
    cabecalhos.delete('content-length');
    cabecalhos.delete('etag');
    return new Response(html, { status: resposta.status, headers: cabecalhos });
}

export const config = {
    path: ['/', '/index.html', '/login.html', '/educacao-financeira.html', '/ferramentas.html', '/guias/*', '/calculadoras/*']
};
