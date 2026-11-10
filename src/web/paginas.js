const path = require('path');
const fs = require('fs');

const PAGINAS_PRIVADAS_OU_DE_ACAO = new Set([
    'assinatura.html', 'comparativo.html', 'configuracoes.html', 'dashboard.html',
    'login.html', 'metas.html', 'notificacoes.html', 'pagamento.html', 'perfil.html',
    'privacidade.html', 'relatorio-avancado.html',
    'calendario.html', 'contas.html', 'importacoes.html', 'importar-pdf.html',
    'limite-de-gastos.html', 'relatorio.html'
]);
// Páginas editoriais que carregam o código do Google AdSense. O Google não
// publica uma lista fixa de domínios para anúncios; a política suportada usa
// nonce com 'strict-dynamic' (support.google.com/adsense/answer/16283098).
// Por isso essas páginas recebem um nonce por requisição e não usam
// default-src, enquanto as áreas privadas mantêm a CSP restritiva.
const PAGINAS_EDITORIAIS_COM_ANUNCIOS = new Set([
    '/index.html', '/educacao-financeira.html', '/ferramentas.html'
]);
const PADRAO_PAGINA_EDITORIAL_EM_PASTA = /^\/(?:guias|calculadoras)\/[a-z0-9-]+\.html$/;
const DIRETORIO_PUBLICO = path.join(__dirname, '..', '..', 'public');
const cachePaginasEditoriais = new Map();
function paginaEditorialComAnuncios(caminho) {
    const pagina = caminho === '/' ? '/index.html' : caminho;
    if (PAGINAS_EDITORIAIS_COM_ANUNCIOS.has(pagina) || PADRAO_PAGINA_EDITORIAL_EM_PASTA.test(pagina)) {
        return pagina;
    }
    return null;
}
async function lerPaginaEditorial(pagina) {
    if (cachePaginasEditoriais.has(pagina)) return cachePaginasEditoriais.get(pagina);
    const conteudo = await fs.promises.readFile(path.join(DIRETORIO_PUBLICO, pagina), 'utf8');
    if (process.env.NODE_ENV === 'production') cachePaginasEditoriais.set(pagina, conteudo);
    return conteudo;
}
function cspPaginaEditorial(nonce) {
    const diretivas = [
        `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https: http:`,
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'"
    ];
    if (process.env.NODE_ENV === 'production') diretivas.push('upgrade-insecure-requests');
    return diretivas.join('; ');
}

module.exports = { DIRETORIO_PUBLICO, PAGINAS_PRIVADAS_OU_DE_ACAO, cspPaginaEditorial, lerPaginaEditorial, paginaEditorialComAnuncios };
