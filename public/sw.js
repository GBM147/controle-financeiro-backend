const VERSAO_TUTORIAL = '1.1.47';
const CACHE_GBM = 'gbm-estatico-v20';
const PREFIXO_CACHE_GBM = 'gbm-estatico-';
const ARQUIVOS_ESTATICOS = [
    '/index.html',
    '/login.html',
    '/termos.html',
    '/politica-de-privacidade.html',
    '/educacao-financeira.html',
    '/sobre.html',
    '/offline.html',
    '/guias.css',
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

    // Páginas usam rede primeiro. Assim, telas autenticadas nunca reaparecem com
    // conteúdo antigo; sem rede, apenas páginas públicas pré-carregadas ou a tela
    // offline são exibidas.
    if (requisicao.mode === 'navigate') {
        evento.respondWith((async () => {
            try {
                return await fetch(requisicao);
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

    // Assets usam cache primeiro e são revalidados em segundo plano.
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
