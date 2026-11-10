const VERSAO_TUTORIAL = '1.1.48';
const CACHE_GBM = 'gbm-estatico-3a93d150';
const PREFIXO_CACHE_GBM = 'gbm-estatico-';
const ARQUIVOS_ESTATICOS = [
    '/index.html',
    '/login.html',
    '/termos.html',
    '/politica-de-privacidade.html',
    '/educacao-financeira.html',
    '/sobre.html',
    '/offline.html',
    '/paginas/offline.css?v=e79a470137',
    '/gbm-acoes.js?v=b9030c8ef0',
    '/public-site.css?v=05fae4f17f',
    '/gbm-typography.css?v=4d6364e02a',
    '/gbm-app-polish.css?v=9b9b068195',
    '/gbm-motion.css?v=1d84d137ee',
    '/gbm-motion.js?v=88bf99267f',
    '/gbm-interactions.css?v=39f271d94c',
    '/gbm-interactions.js?v=63cc46c496',
    '/gbm-chart-depth.js?v=446dce1de1',
    '/fonts/manrope-latin.woff2',
    '/fonts/manrope-latin-ext.woff2',
    '/public-calculators.js?v=409ade3657',
    '/ferramentas.html',
    '/gbm-session.js?v=94c6656885',
    '/auth.js?v=6f32663332',
    '/gbm-pages.css?v=453f9c0c23',
    '/gbm-pages.js?v=b53b3cd6b3',
    '/gbm-menu.js?v=56467e5b3d',
    '/gbm-shell.css?v=9948129792',
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
