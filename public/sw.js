const VERSAO_TUTORIAL = '1.1.46';
const CACHE_GBM = 'gbm-estatico-v16';
const PREFIXO_CACHE_GBM = 'gbm-estatico-';
const ARQUIVOS_ESTATICOS = [
    '/index.html',
    '/termos.html',
    '/politica-de-privacidade.html',
    '/auth.js',
    '/gbm-pages.css',
    '/gbm-pages.js',
    `/gbm-tutorial.css?v=${VERSAO_TUTORIAL}`,
    `/gbm-tutorial.js?v=${VERSAO_TUTORIAL}`,
    '/logo-transparente.png',
    '/logo-transparente.jpg',
    '/fundo-marmore.jpg',
    '/manifest.json'
];

self.addEventListener('install', (evento) => {
    evento.waitUntil(
        caches.open(CACHE_GBM)
            .then((cache) => cache.addAll(ARQUIVOS_ESTATICOS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((chaves) => Promise.all(chaves
                .filter((chave) =>
                    chave.startsWith(PREFIXO_CACHE_GBM)
                    && chave !== CACHE_GBM
                )
                .map((chave) => caches.delete(chave))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (evento) => {
    const requisicao = evento.request;
    if (requisicao.method !== 'GET') return;
    const url = new URL(requisicao.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    const arquivoTutorial =
        url.pathname.endsWith('/gbm-tutorial.js')
        || url.pathname.endsWith('/gbm-tutorial.css');
    const enderecoRede = arquivoTutorial
        ? `${url.pathname}?v=${encodeURIComponent(VERSAO_TUTORIAL)}`
        : requisicao;
    const opcoesRede = arquivoTutorial
        ? { cache: 'reload', credentials: 'same-origin' }
        : undefined;

    // Navegação autenticada usa rede primeiro para não exibir dados antigos.
    evento.respondWith(
        (async () => {
            try {
                const resposta = await fetch(enderecoRede, opcoesRede);
                if (resposta.ok && ['script', 'style', 'image', 'manifest'].includes(requisicao.destination)) {
                    const cache = await caches.open(CACHE_GBM);
                    await cache.put(requisicao, resposta.clone());
                }
                return resposta;
            } catch (erro) {
                const cache = await caches.match(requisicao);
                if (cache) return cache;
                if (arquivoTutorial) {
                    const tutorialEmCache = await caches.match(requisicao, { ignoreSearch: true });
                    return tutorialEmCache || Response.error();
                }
                return requisicao.mode === 'navigate'
                    ? (await caches.match('/index.html')) || Response.error()
                    : Response.error();
            }
        })()
    );
});
