// O cookie HttpOnly identifica a sessão. O storage é somente compatibilidade
// com as telas antigas e pode estar vazio ou indisponível no navegador.
(() => {
    'use strict';
    if (window.GBMSession) return;

    const paginasDaConta = new Set([
        'dashboard.html', 'contas.html', 'importacoes.html', 'importar-pdf.html',
        'calendario.html', 'limite-de-gastos.html', 'metas.html',
        'relatorio.html', 'relatorio-avancado.html', 'comparativo.html',
        'notificacoes.html', 'perfil.html', 'configuracoes.html',
        'privacidade.html', 'assinatura.html', 'pagamento.html'
    ]);
    const pagina = location.pathname.split('/').pop() || 'index.html';
    let sessao = null;
    let consulta = null;
    let ultimoStatus = null;
    let redirecionando = false;

    function storage(tipo, operacao, valor) {
        try {
            return window[tipo][operacao]('userIdAtual', valor);
        } catch {
            return null;
        }
    }

    function clearIdentity() {
        sessao = null;
        storage('localStorage', 'removeItem');
        storage('sessionStorage', 'removeItem');
    }

    function syncIdentity(dados) {
        if (!dados || dados.userId == null) return;
        sessao = dados;
        const persistente = dados.manterConectado === true;
        storage(persistente ? 'localStorage' : 'sessionStorage', 'setItem', String(dados.userId));
        storage(persistente ? 'sessionStorage' : 'localStorage', 'removeItem');
    }

    function getUserId() {
        return sessao?.userId != null ? String(sessao.userId)
            : storage('localStorage', 'getItem') || storage('sessionStorage', 'getItem');
    }

    function destination() {
        const proxima = new URLSearchParams(location.search).get('next');
        if (proxima) {
            try {
                const url = new URL(proxima, location.origin);
                if (url.origin === location.origin && url.pathname.split('/').length === 2
                    && paginasDaConta.has(url.pathname.slice(1))) {
                    return url.pathname + url.search + url.hash;
                }
            } catch { /* Um destino inválido volta ao painel. */ }
        }
        return '/dashboard.html';
    }

    function redirectToLogin() {
        if (redirecionando || pagina === 'login.html') return;
        redirecionando = true;
        clearIdentity();
        const retorno = paginasDaConta.has(pagina)
            ? '?next=' + encodeURIComponent(location.pathname + location.search + location.hash)
            : '';
        location.replace('/login.html' + retorno);
    }

    function mostrarIndisponibilidade() {
        if (!paginasDaConta.has(pagina) || document.getElementById('gbm-session-status')) return;
        const aviso = document.createElement('p');
        aviso.id = 'gbm-session-status';
        aviso.setAttribute('role', 'status');
        aviso.textContent = 'Não foi possível verificar sua sessão agora. Tente novamente em instantes. ';
        const tentar = document.createElement('button');
        tentar.type = 'button';
        tentar.textContent = 'Tentar novamente';
        tentar.addEventListener('click', () => location.reload());
        aviso.appendChild(tentar);
        const conteudo = document.querySelector('main, .page-wrapper, .container');
        (conteudo || document.body).prepend(aviso);
    }

    async function consultar() {
        try {
            const resposta = await fetch('/login-status', { credentials: 'include', cache: 'no-store' });
            ultimoStatus = resposta.status;
            if (resposta.status === 401) {
                clearIdentity();
                return null;
            }
            if (!resposta.ok) throw new Error('Sessão temporariamente indisponível.');
            const dados = await resposta.json();
            if (!dados.success || dados.userId == null) throw new Error('Resposta de sessão inválida.');
            syncIdentity(dados);
            return dados;
        } catch {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', mostrarIndisponibilidade, { once: true });
            } else {
                mostrarIndisponibilidade();
            }
            return null;
        }
    }

    const api = { clearIdentity, syncIdentity, getUserId, destination, redirectToLogin,
        get status() { return ultimoStatus; },
        check() { return consulta ||= consultar(); }
    };
    window.GBMSession = api;
    api.ready = api.check();
    api.ready.then((dados) => {
        if (!dados) return;
        if (pagina === 'login.html') location.replace(destination());
        if (pagina === 'index.html' && !new URLSearchParams(location.search).has('inicio')) {
            location.replace('/dashboard.html');
        }
    });
})();
