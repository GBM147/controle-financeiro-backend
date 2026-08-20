// =======================================================
// auth.js — wrapper de fetch que trata sessão expirada automaticamente
// =======================================================
// Uso: troque fetch(url, opcoes) por fetchApi(url, opcoes) em qualquer
// chamada para uma rota que exige login.
// Se o servidor responder 401 (sessão expirada), limpa o storage,
// avisa o usuário e redireciona pro login.

let redirecionandoParaLogin = false;

function limparIdentidadeLocal() {
    localStorage.removeItem('userIdAtual');
    sessionStorage.removeItem('userIdAtual');
}

function sincronizarIdentidadeLocal(sessao) {
    if (!sessao || sessao.userId == null) return;
    const userId = String(sessao.userId);

    if (sessao.manterConectado === true) {
        localStorage.setItem('userIdAtual', userId);
        sessionStorage.removeItem('userIdAtual');
        return;
    }

    sessionStorage.setItem('userIdAtual', userId);
    localStorage.removeItem('userIdAtual');
}

async function encerrarSessao() {
    redirecionandoParaLogin = true;
    try {
        await fetch('/logout', { method: 'POST', credentials: 'include' });
    } catch (erro) {
        console.warn('Não foi possível confirmar o encerramento da sessão no servidor.', erro);
    } finally {
        limparIdentidadeLocal();
        window.location.replace('index.html');
    }
}

async function fetchApi(url, opcoes = {}) {
    // Garante que o cookie de sessão seja sempre enviado (mesmo cross-origin)
    const opcoesComCredenciais = { credentials: 'include', ...opcoes };
    const resposta = await fetch(url, opcoesComCredenciais);
    if (resposta.status === 401) {
        limparIdentidadeLocal();
        if (!redirecionandoParaLogin) {
            redirecionandoParaLogin = true;
            alert('Sua sessão expirou. Faça login novamente.');
            window.location.replace('index.html');
        }
        return new Promise(() => {}); // nunca resolve: página já está navegando
    }
    return resposta;
}

// Padroniza a navegação da marca nas páginas autenticadas.
// Mantém o HTML legado funcionando sem exigir que cada página replique a lógica.
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.gbm-logo-container, .marca, a.brand').forEach((marca) => {
        if (marca.matches('a')) {
            marca.href = 'dashboard.html';
            return;
        }

        marca.setAttribute('role', 'link');
        marca.setAttribute('tabindex', '0');
        marca.setAttribute('aria-label', 'Ir para o dashboard');
        marca.style.cursor = 'pointer';

        const irParaDashboard = (evento) => {
            if (evento.target.closest('a, button')) return;
            window.location.href = 'dashboard.html';
        };

        marca.addEventListener('click', irParaDashboard);
        marca.addEventListener('keydown', (evento) => {
            if (evento.key !== 'Enter' && evento.key !== ' ') return;
            evento.preventDefault();
            irParaDashboard(evento);
        });
    });

    // Mantém as mensagens de validação consistentes em português.
    document.addEventListener('invalid', (evento) => {
        const campo = evento.target;
        if (!(campo instanceof HTMLInputElement ||
              campo instanceof HTMLSelectElement ||
              campo instanceof HTMLTextAreaElement)) return;

        if (campo.validity.valueMissing) {
            campo.setCustomValidity('Preencha este campo.');
        }
    }, true);

    document.addEventListener('input', (evento) => {
        if (typeof evento.target.setCustomValidity === 'function') {
            evento.target.setCustomValidity('');
        }
    }, true);

    document.addEventListener('change', (evento) => {
        if (typeof evento.target.setCustomValidity === 'function') {
            evento.target.setCustomValidity('');
        }
    }, true);
});
