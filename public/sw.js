// O Service Worker é obrigatório para que o Chrome permita a instalação do App.
self.addEventListener('install', (e) => {
    console.log('[GBM App] Instalado com sucesso!');
    self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
    // Por agora, ele não faz cache offline avançado, apenas deixa a internet fluir normalmente
});