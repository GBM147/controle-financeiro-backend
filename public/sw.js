const VERSAO_TUTORIAL = '1.2.0';
const CACHE_GBM = 'gbm-estatico-79e6c368';
const PREFIXO_CACHE_GBM = 'gbm-estatico-';
const ARQUIVOS_ESTATICOS = [
    '/index.html',
    '/login.html',
    '/termos.html',
    '/politica-de-privacidade.html',
    '/educacao-financeira.html',
    '/sobre.html',
    '/offline.html',
    '/paginas/offline.css?v=4af02402ce',
    '/gbm-acoes.js?v=b9030c8ef0',
    '/gbm-tema.js?v=69a291f638',
    '/gbm-movimento.js?v=4b7404e164',
    '/estilo/tokens.css?v=88606937b0',
    '/estilo/base.css?v=3532b91c9f',
    '/estilo/componentes.css?v=beae3d383c',
    '/estilo/app.css?v=79f9015933',
    '/estilo/site.css?v=6f31fdf3a3',
    '/fonts/geist-latin.woff2',
    '/fonts/geist-latin-ext.woff2',
    '/fonts/instrument-serif-latin.woff2',
    '/fonts/instrument-serif-latin-italic.woff2',
    '/public-calculators.js?v=409ade3657',
    '/ferramentas.html',
    '/gbm-session.js?v=94c6656885',
    '/auth.js?v=89cc681816',
    '/gbm-pages.js?v=50214434c6',
    '/gbm-menu.js?v=4701e41f46',
    `/gbm-tutorial.css?v=${VERSAO_TUTORIAL}`,
    `/gbm-tutorial.js?v=${VERSAO_TUTORIAL}`,
    '/logo-transparente.png',
    '/logo-transparente.jpg',
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

async function servirNavegacao(requisicao) {
    return fetch(requisicao);
}


self.addEventListener('fetch', (evento) => {
    const requisicao = evento.request;
    if (requisicao.method !== 'GET') return;

    const url = new URL(requisicao.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    if (requisicao.mode === 'navigate') {
        evento.respondWith((async () => {
            try {
                return await servirNavegacao(requisicao);
            } catch {
                return (await caches.match(requisicao))
                    || (await caches.match('/offline.html'))
                    || Response.error();
            }
        })());
        return;
    }

    const recursoEstatico = ['script', 'style', 'image', 'font', 'manifest'].includes(requisicao.destination);
    if (!recursoEstatico) return;

    evento.respondWith((async () => {
        const arquivoTutorial =
            url.pathname.endsWith('/gbm-tutorial.js')
            || url.pathname.endsWith('/gbm-tutorial.css');
        const chaveCache = arquivoTutorial
            ? new Request(`${url.pathname}?v=${encodeURIComponent(VERSAO_TUTORIAL)}`)
            : requisicao;
        const cache = await caches.open(CACHE_GBM);
        const armazenado = await cache.match(chaveCache);
        const atualizar = fetch(chaveCache, { credentials: 'same-origin' })
            .then(async (resposta) => {
                if (resposta.ok) await cache.put(chaveCache, resposta.clone());
                return resposta;
            });

        if (armazenado) {
            evento.waitUntil(atualizar.catch(() => undefined));
            return armazenado;
        }

        try {
            return await atualizar;
        } catch {
            return Response.error();
        }
    })());
});
