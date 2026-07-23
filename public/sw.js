const CACHE_GBM = 'gbm-estatico-v9';
const ARQUIVOS_ESTATICOS = [
    '/index.html',
    '/auth.js',
    '/gbm-pages.css',
    '/gbm-pages.js',
    '/gbm-tutorial.css',
    '/gbm-tutorial.js',
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
            .then((chaves) => Promise.all(
                chaves.filter((chave) => chave !== CACHE_GBM).map((chave) => caches.delete(chave))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (evento) => {
    const requisicao = evento.request;
    if (requisicao.method !== 'GET') return;
    const url = new URL(requisicao.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    // Navegação autenticada usa rede primeiro para não exibir dados antigos.
    evento.respondWith(
        fetch(requisicao)
            .then((resposta) => {
                if (resposta.ok && ['script', 'style', 'image', 'manifest'].includes(requisicao.destination)) {
                    const copia = resposta.clone();
                    caches.open(CACHE_GBM).then((cache) => cache.put(requisicao, copia));
                }
                return resposta;
            })
            .catch(() => caches.match(requisicao).then((cache) => (
                cache || (requisicao.mode === 'navigate' ? caches.match('/index.html') : Response.error())
            )))
    );
});