function gbmMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function gbmData(valor) {
    if (!valor) return '—';
    const data = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
    return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
}

function gbmEscapar(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/* ===== ACABAMENTO VISUAL GLOBAL =====
   Esta camada altera apenas a aparência. A estrutura e o conteúdo das páginas
   permanecem exatamente como foram definidos em cada HTML.
*/
function gbmAplicarTemaVisual() {
    if (document.getElementById('gbm-tema-visual')) return;

    const fonte = document.createElement('link');
    fonte.rel = 'stylesheet';
    fonte.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap';
    document.head.appendChild(fonte);

    const estilo = document.createElement('style');
    estilo.id = 'gbm-tema-visual';
    estilo.textContent = `
        :root {
            --gbm-surface: rgba(10, 24, 42, .82);
            --gbm-surface-strong: rgba(10, 24, 42, .94);
            --gbm-surface-soft: rgba(17, 36, 59, .58);
            --gbm-line: rgba(117, 181, 232, .18);
            --gbm-line-focus: rgba(95, 255, 168, .48);
            --gbm-text: #f4f7fb;
            --gbm-muted: #a8b4c3;
            --gbm-green: #3be696;
            --gbm-blue: #62aef7;
            --gbm-red: #ff6070;
            --gbm-radius: 12px;
            --gbm-shadow: 0 14px 36px rgba(0, 5, 12, .22);
        }

        html { color-scheme: dark; }

        body.gbm-interna {
            font-family: 'Inter', system-ui, sans-serif !important;
            color: var(--gbm-text);
            letter-spacing: 0;
        }

        body.gbm-interna::after {
            content: '';
            position: fixed;
            inset: 0;
            z-index: -1;
            pointer-events: none;
            background: rgba(3, 10, 19, .2);
        }

        body.gbm-interna :where(h1, h2, h3, .gbm-title, .titulo, .titulo-pagina, .card-titulo, .logo-text) {
            font-family: 'Sora', 'Inter', sans-serif !important;
            letter-spacing: 0 !important;
            text-shadow: none !important;
        }

        body.gbm-interna :where(p, span, label, input, select, textarea, button, a, td, th) {
            letter-spacing: 0;
        }

        body.gbm-interna :where(.card, .panel, .painel, .resumo-card, .stat-card, .conta-card, .meta, .modal-content, .plano-card, .form-card) {
            background-color: var(--gbm-surface) !important;
            border-color: var(--gbm-line) !important;
            border-radius: var(--gbm-radius) !important;
            box-shadow: var(--gbm-shadow) !important;
            backdrop-filter: blur(12px);
        }

        body.gbm-interna :where(.card, .panel, .painel, .resumo-card, .stat-card, .conta-card, .meta, .plano-card) {
            transition: border-color .2s ease, background-color .2s ease, transform .2s ease, box-shadow .2s ease;
        }

        body.gbm-interna :where(.card, .panel, .painel, .resumo-card, .stat-card, .conta-card, .meta, .plano-card):hover {
            border-color: rgba(117, 181, 232, .3) !important;
            box-shadow: 0 18px 42px rgba(0, 5, 12, .28) !important;
        }

        body.gbm-interna :where(input, select, textarea) {
            min-height: 42px;
            color: var(--gbm-text) !important;
            background-color: rgba(5, 18, 33, .72) !important;
            border-color: var(--gbm-line) !important;
            border-radius: 9px !important;
            box-shadow: none !important;
            font-family: 'Inter', system-ui, sans-serif !important;
            transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
        }

        body.gbm-interna :where(input, select, textarea):focus {
            border-color: var(--gbm-line-focus) !important;
            background-color: rgba(7, 23, 40, .94) !important;
            box-shadow: 0 0 0 3px rgba(59, 230, 150, .1) !important;
            outline: none;
        }

        body.gbm-interna :where(button, .btn, .btn-voltar) {
            border-radius: 9px !important;
            font-family: 'Inter', system-ui, sans-serif !important;
            font-weight: 700;
            text-shadow: none !important;
            box-shadow: none;
            transition: filter .2s ease, border-color .2s ease, background-color .2s ease, transform .2s ease;
        }

        body.gbm-interna :where(button, .btn, .btn-voltar):hover {
            filter: brightness(1.07);
        }

        body.gbm-interna :where(.valor, .price, .preco, .info-valor, .evento-valor, [id*='saldo'], [id*='total']) {
            font-variant-numeric: tabular-nums;
            text-shadow: none !important;
        }

        body.gbm-interna :where(table) {
            border-collapse: separate;
            border-spacing: 0;
        }

        body.gbm-interna :where(th) {
            color: var(--gbm-muted) !important;
            font-size: .75rem;
            text-transform: uppercase;
        }

        body.gbm-interna :where(td, th) {
            border-color: rgba(117, 181, 232, .1) !important;
        }

        body.gbm-interna :where(.topbar, .gbm-header, header) {
            border-color: rgba(117, 181, 232, .14) !important;
            box-shadow: 0 8px 30px rgba(0, 5, 12, .16) !important;
            backdrop-filter: blur(14px);
        }

        #particles-canvas { opacity: .42 !important; }

        @media (prefers-reduced-motion: reduce) {
            body.gbm-interna *, body.gbm-interna *::before, body.gbm-interna *::after {
                animation-duration: .01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: .01ms !important;
            }
        }
    `;
    document.head.appendChild(estilo);
}

gbmAplicarTemaVisual();

function gbmToast(mensagem, tipo = 'sucesso') {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    toast.setAttribute('aria-live', tipo === 'erro' ? 'assertive' : 'polite');
    toast.textContent = mensagem;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
}

async function gbmJson(resposta) {
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        const erro = new Error(dados.error || dados.message || 'Não foi possível concluir a operação.');
        erro.status = resposta.status;
        erro.codigo = dados.codigo;
        throw erro;
    }
    return dados;
}

// Garante o mesmo comportamento de envio pelo Enter em desktop e celular.
// A validação HTML5 do formulário continua sendo executada antes do submit.
document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' || evento.isComposing) return;

    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement) || !campo.form) return;
    if (['button', 'checkbox', 'file', 'radio', 'range', 'reset', 'submit'].includes(campo.type)) return;

    evento.preventDefault();
    campo.form.requestSubmit();
});

function gbmInicializarParticulas() {
    const corpo = document.body;
    if (!corpo?.classList.contains('gbm-interna')) return;
    if (corpo.dataset.gbmParticulasInicializadas === 'true') return;

    let canvas = document.getElementById('particles-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'particles-canvas';
        corpo.prepend(canvas);
    }

    const contexto = canvas.getContext('2d');
    if (!contexto) return;

    corpo.dataset.gbmParticulasInicializadas = 'true';
    canvas.setAttribute('aria-hidden', 'true');

    const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    let largura = 0;
    let altura = 0;
    let particulas = [];
    let quadroAnimacao = 0;
    let quadroResize = 0;

    function criarParticula() {
        return {
            x: Math.random() * largura,
            y: Math.random() * altura,
            tamanho: Math.random() * 2.5 + .8,
            velocidade: Math.random() * 1.2 + .3,
            opacidade: Math.random() * .4 + .2
        };
    }

    function desenhar() {
        contexto.clearRect(0, 0, largura, altura);
        particulas.forEach((particula) => {
            contexto.beginPath();
            contexto.arc(particula.x, particula.y, particula.tamanho, 0, Math.PI * 2);
            contexto.fillStyle = `rgba(85, 167, 255, ${particula.opacidade * .55})`;
            contexto.fill();
        });
    }

    function animar() {
        particulas.forEach((particula) => {
            particula.y -= particula.velocidade;
            if (particula.y < -particula.tamanho) {
                particula.y = altura + particula.tamanho;
                particula.x = Math.random() * largura;
            }
        });
        desenhar();
        quadroAnimacao = window.requestAnimationFrame(animar);
    }

    function atualizarAnimacao() {
        window.cancelAnimationFrame(quadroAnimacao);
        quadroAnimacao = 0;
        desenhar();
        if (!movimentoReduzido.matches) {
            quadroAnimacao = window.requestAnimationFrame(animar);
        }
    }

    function redimensionar() {
        largura = window.innerWidth;
        altura = window.innerHeight;
        const proporcao = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.round(largura * proporcao);
        canvas.height = Math.round(altura * proporcao);
        contexto.setTransform(proporcao, 0, 0, proporcao, 0, 0);

        const quantidade = Math.min(65, Math.floor((largura * altura) / 15000));
        particulas = Array.from({ length: quantidade }, criarParticula);
        atualizarAnimacao();
    }

    window.addEventListener('resize', () => {
        window.cancelAnimationFrame(quadroResize);
        quadroResize = window.requestAnimationFrame(redimensionar);
    });

    if (typeof movimentoReduzido.addEventListener === 'function') {
        movimentoReduzido.addEventListener('change', atualizarAnimacao);
    } else {
        movimentoReduzido.addListener(atualizarAnimacao);
    }

    redimensionar();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gbmInicializarParticulas, { once: true });
} else {
    gbmInicializarParticulas();
}

/* ===== MENU LATERAL, PERFIL NO CABEÇALHO E MODAL GBM (compartilhado) ===== */
function abrirMenuLateral(event) {
    if (event) event.stopPropagation();
    const sidebar = document.getElementById('sidebar-menu');
    const overlay = document.getElementById('menu-overlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.add('aberto');
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
}

function fecharMenuLateral() {
    const sidebar = document.getElementById('sidebar-menu');
    if (!sidebar) return;
    sidebar.classList.remove('aberto');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    setTimeout(() => {
        const overlay = document.getElementById('menu-overlay');
        if (overlay) overlay.style.display = 'none';
    }, 200);
}

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar-menu');
    if (sidebar) sidebar.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
});

function acessarRotaPremium(url, nomeRecurso) {
    if (window.usuarioPremium) {
        window.location.href = url;
    } else {
        fecharMenuLateral();
        gbmConfirmar(`A ferramenta <strong>${nomeRecurso}</strong> é uma funcionalidade exclusiva para assinantes do plano Premium.<br><br>Deseja assinar agora por apenas R$ 9,90 e liberar todos os recursos avançados sem anúncios?`).then((confirmado) => {
            if (confirmado) window.location.href = 'pagamento.html';
        });
    }
}

function fazerLogout() {
    encerrarSessao();
}

async function carregarAtalhoPerfilCabecalho() {
    try {
        const resposta = await fetchApi('/perfil');
        const dados = await resposta.json();
        if (!dados.success) return;
        const perfil = dados.perfil;
        const foto = document.getElementById('foto-perfil-cabecalho');
        const nome = document.getElementById('nome-perfil-cabecalho');
        if (perfil.foto_perfil_url && foto) foto.src = perfil.foto_perfil_url;
        if (nome) nome.innerText = perfil.nome_exibicao || perfil.nome || 'Meu perfil';
    } catch (erro) {
        console.warn('Não foi possível carregar o atalho de perfil.', erro);
    }
}

let _resolveConfirm = null;

const escaparMensagemModal = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[caractere]);

function gbmAlerta(mensagem, tipo = 'info') {
    const cor = tipo === 'erro' ? 'rgba(239,68,68,0.3)'
        : tipo === 'aviso' ? 'rgba(85,167,255,0.3)'
        : 'rgba(95,255,168,0.3)';
    document.getElementById('lista-notificacoes-modal').innerHTML = `
        <div style="background:rgba(15,23,42,0.8); border:1px solid ${cor}; border-radius:10px; padding:20px; font-family:'Inter',sans-serif; font-size:0.95rem; line-height:1.6; text-align:center;">
            ${escaparMensagemModal(mensagem)}
        </div>`;
    document.getElementById('btn-confirmar-modal').style.display = 'none';
    document.getElementById('btn-fechar-modal').innerText = 'FECHAR';
    document.getElementById('modal-notificacoes').style.display = 'flex';
    _resolveConfirm = null;
}

function gbmConfirmar(mensagem) {
    return new Promise(resolve => {
        _resolveConfirm = resolve;
        document.getElementById('lista-notificacoes-modal').innerHTML = `
            <div style="background:rgba(85,167,255,0.1); border:1px solid rgba(85,167,255,0.4); border-radius:10px; padding:20px; font-family:'Inter',sans-serif; font-size:0.95rem; line-height:1.6; text-align:center;">
                ${escaparMensagemModal(mensagem)}
            </div>`;
        document.getElementById('btn-confirmar-modal').style.display = 'block';
        document.getElementById('btn-fechar-modal').innerText = 'CANCELAR';
        document.getElementById('modal-notificacoes').style.display = 'flex';
    });
}

function fecharModalNotificacoes(confirmado = false) {
    document.getElementById('modal-notificacoes').style.display = 'none';
    if (_resolveConfirm) {
        _resolveConfirm(confirmado);
        _resolveConfirm = null;
    }
}

/* ===== RIPPLE NOS BOTÕES ===== */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
});

/* ===== CONTAGEM ANIMADA NOS NÚMEROS ===== */
function gbmContarAte(el) {
    const texto = el.textContent.trim();
    const match = texto.match(/(R\$\s*)?([\d.,]+)/);
    if (!match) return;
    const prefixo = match[1] || '';
    const alvo = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
    if (isNaN(alvo)) return;
    const duracao = 900;
    const inicio = performance.now();
    function step(agora) {
        const progresso = Math.min((agora - inicio) / duracao, 1);
        const ease = 1 - Math.pow(1 - progresso, 3);
        const atual = (alvo * ease).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        el.textContent = prefixo + atual;
        if (progresso < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

const observadorContagem = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
        if (!e.isIntersecting) return;
        gbmContarAte(e.target);
        observadorContagem.unobserve(e.target);
    });
}, { threshold: .3 });

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.gbm-count-up').forEach(el => observadorContagem.observe(el));
});

/* ===== BARRAS DE PROGRESSO ANIMADAS ===== */
const observadorBarras = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
        if (!e.isIntersecting) return;
        const barra = e.target;
        const largura = barra.getAttribute('data-width') || barra.style.width;
        barra.style.setProperty('--w', largura);
        requestAnimationFrame(() => barra.classList.add('animado'));
        observadorBarras.unobserve(barra);
    });
}, { threshold: .1 });

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.progress > span[data-width], .barra div[data-width]').forEach(el => observadorBarras.observe(el));
});

/* ===== CABEÇALHOS DAS PÁGINAS =====
   Remove somente o bloco de identificação/descrição no topo das páginas.
   No Dashboard, mantém os filtros do período e da conta, removendo apenas a identificação.
*/
function gbmRemoverCabecalhoPagina() {
    const seletores = [
        '.dashboard-heading',
        '.page-title',
        '.titulo-pagina'
    ];

    document.querySelectorAll(seletores.join(',')).forEach((elemento) => {
        elemento.remove();
    });
}

document.addEventListener('DOMContentLoaded', gbmRemoverCabecalhoPagina, { once: true });

/* ===== ASSISTENTE IA "COMO USAR ESTA PÁGINA" ===== */
(function carregarAssistenteGbm() {
    if (document.getElementById('gbm-ai-ajuda-script')) return;
    const script = document.createElement('script');
    script.id = 'gbm-ai-ajuda-script';
    script.src = 'gbm-ai-ajuda.js';
    script.async = false;
    document.head.appendChild(script);
})();
