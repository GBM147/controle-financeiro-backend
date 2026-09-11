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

// Garante que uma versão antiga do Service Worker não permaneça ativa.
// A versão atual do sw.js não redireciona navegações; ela apenas usa a rede
// e fornece fallback offline quando necessário.
function atualizarServiceWorkerGbm() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js?v=1.1.49', {
        updateViaCache: 'none'
    }).then((registro) => {
        registro.update().catch(() => undefined);
        if (registro.waiting) registro.waiting.postMessage({ type: 'SKIP_WAITING' });
    }).catch(() => undefined);
}

atualizarServiceWorkerGbm();

function carregarAnimacoesUiGbm() {
    if (document.getElementById('gbm-ui-animations-css')) return;
    const link = document.createElement('link');
    link.id = 'gbm-ui-animations-css';
    link.rel = 'stylesheet';
    link.href = 'gbm-ui-animations.css?v=1.0.0';
    document.head.appendChild(link);
}

function parsearMoedaGbm(valor) {
    const texto = String(valor ?? '').replace(/[^0-9,.-]/g, '');
    if (!texto) return 0;
    const numero = texto.includes(',')
        ? Number(texto.replace(/\./g, '').replace(',', '.'))
        : Number(texto);
    return Number.isFinite(numero) ? numero : 0;
}

function formatarMoedaGbm(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function animarValorGbm(elemento, alvo, duracao = 650) {
    if (!elemento || !Number.isFinite(alvo)) return;
    if (elemento.dataset.gbmAnimando === 'true') {
        elemento.dataset.gbmAlvoPendente = String(alvo);
        return;
    }

    const anterior = Number.isFinite(Number(elemento.dataset.gbmValorAtual))
        ? Number(elemento.dataset.gbmValorAtual)
        : parsearMoedaGbm(elemento.textContent);

    if (Math.abs(alvo - anterior) < 0.005) {
        elemento.textContent = formatarMoedaGbm(alvo);
        elemento.dataset.gbmValorAtual = String(alvo);
        return;
    }

    elemento.dataset.gbmAnimando = 'true';
    const inicio = performance.now();

    function quadro(agora) {
        const progresso = Math.min((agora - inicio) / duracao, 1);
        const suavizado = 1 - Math.pow(1 - progresso, 3);
        const atual = anterior + ((alvo - anterior) * suavizado);
        elemento.textContent = formatarMoedaGbm(atual);
        elemento.dataset.gbmValorAtual = String(atual);

        if (progresso < 1) {
            window.requestAnimationFrame(quadro);
            return;
        }

        elemento.textContent = formatarMoedaGbm(alvo);
        elemento.dataset.gbmValorAtual = String(alvo);
        elemento.dataset.gbmAnimando = 'false';

        const pendente = Number(elemento.dataset.gbmAlvoPendente);
        delete elemento.dataset.gbmAlvoPendente;
        if (Number.isFinite(pendente)) animarValorGbm(elemento, pendente, duracao);
    }

    window.requestAnimationFrame(quadro);
}

function observarValorFinanceiroGbm(id) {
    const elemento = document.getElementById(id);
    if (!elemento || elemento.dataset.gbmObservado === 'true') return;

    elemento.dataset.gbmObservado = 'true';
    elemento.dataset.gbmValorAtual = String(parsearMoedaGbm(elemento.textContent));

    const observador = new MutationObserver(() => {
        if (elemento.dataset.gbmAnimando === 'true') return;
        const alvo = parsearMoedaGbm(elemento.textContent);
        const atual = Number(elemento.dataset.gbmValorAtual);
        if (!Number.isFinite(alvo) || Math.abs(alvo - atual) < 0.005) return;
        animarValorGbm(elemento, alvo);
    });

    observador.observe(elemento, {
        childList: true,
        characterData: true,
        subtree: true
    });
}

function colorirLinhasTabelasGbm(tabela) {
    if (!tabela) return;
    tabela.querySelectorAll('tbody tr').forEach((linha) => {
        const textoLinha = (linha.textContent || '').toLowerCase();
        const classe = textoLinha.includes('despesa') || textoLinha.includes('saída') || textoLinha.includes('saida')
            ? 'gbm-valor-negativo'
            : textoLinha.includes('receita') || textoLinha.includes('entrada')
                ? 'gbm-valor-positivo'
                : '';
        linha.querySelectorAll('td').forEach((celula) => {
            celula.classList.remove('gbm-valor-positivo', 'gbm-valor-negativo');
            if (classe) celula.classList.add(classe);
        });
    });
}

function configurarInteracoesUiGbm() {
    carregarAnimacoesUiGbm();

    const idsFinanceiros = ['saldo-liquido', 'total-entradas', 'total-saidas'];
    idsFinanceiros.forEach(observarValorFinanceiroGbm);

    document.querySelectorAll('table').forEach((tabela) => {
        colorirLinhasTabelasGbm(tabela);
        const corpo = tabela.tBodies?.[0];
        if (!corpo) return;
        const observador = new MutationObserver(() => colorirLinhasTabelasGbm(tabela));
        observador.observe(corpo, { childList: true, subtree: true });
    });
}

// Padroniza a navegação da marca nas páginas autenticadas.
// Mantém o HTML legado funcionando sem exigir que cada página replique a lógica.
document.addEventListener('DOMContentLoaded', () => {
    configurarInteracoesUiGbm();

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

    // O Dashboard passa a utilizar exatamente o mesmo menu global das demais páginas.
    // Removemos somente os elementos de cabeçalho/menu próprios dele antes de
    // carregar o gbm-menu.js, evitando a coexistência de duas versões do menu.
    const paginaAtual = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (paginaAtual === 'dashboard.html') {
        document.querySelectorAll(
            'body > .gbm-header, body > .topbar, body > .sidebar-menu, body > #sidebar-menu, body > #menu-overlay'
        ).forEach((elemento) => elemento.remove());

        if (!document.querySelector('script[data-gbm-dashboard-menu]')) {
            const scriptMenu = document.createElement('script');
            scriptMenu.src = 'gbm-menu.js';
            scriptMenu.dataset.gbmDashboardMenu = 'true';
            document.body.appendChild(scriptMenu);
        }
    }

    // O nome canônico desta página é /limite-de-gastos.html.
    // Não converta essa URL para limite-gastos.html, pois isso cria
    // um ciclo quando o servidor redireciona a rota legada para a canônica.

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
