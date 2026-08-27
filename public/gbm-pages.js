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