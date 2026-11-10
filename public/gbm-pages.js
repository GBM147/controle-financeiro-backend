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

const gbmPaginaVisualAtual = (window.location.pathname.split('/').pop() || '').toLowerCase();

/* ===== MENU INTERNO GLOBAL =====
   Todas as telas internas usam o mesmo cabeçalho e menu lateral.
   Páginas públicas continuam com sua navegação própria.
*/
function gbmGarantirMenuInterno() {
    const nomePagina = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const paginasDaConta = new Set([
        'dashboard.html', 'contas.html', 'importacoes.html', 'importar-pdf.html',
        'calendario.html', 'limite-de-gastos.html', 'metas.html', 'relatorio.html',
        'relatorio-avancado.html', 'comparativo.html', 'notificacoes.html',
        'configuracoes.html', 'perfil.html', 'privacidade.html', 'assinatura.html', 'pagamento.html'
    ]);
    if (!paginasDaConta.has(nomePagina)) return;
    if (window.GBMAppShell) { window.GBMAppShell.iniciar(); return; }
    if ([...document.scripts].some((script) => /(?:^|\/)gbm-menu\.js(?:\?|$)/.test(script.getAttribute('src') || ''))) return;
    if (document.getElementById('gbm-menu-bootstrap')) return;

    const script = document.createElement('script');
    script.id = 'gbm-menu-bootstrap';
    script.src = 'gbm-menu.js?v=4701e41f46';
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
}

gbmGarantirMenuInterno();


/* Mantém somente o cabeçalho compartilhado quando páginas antigas ainda
   carregam uma cópia própria ou algum script legado tenta recriá-la. */
function gbmGarantirCabecalhoUnico() {
    const cabecalhos = [...document.querySelectorAll('body > .gbm-header')];
    if (cabecalhos.length < 2) return;
    cabecalhos.slice(0, -1).forEach((cabecalho) => cabecalho.remove());
}

function gbmObservarCabecalho() {
    gbmGarantirCabecalhoUnico();
    const observador = new MutationObserver(gbmGarantirCabecalhoUnico);
    observador.observe(document.body, { childList: true });
}

if (document.body) gbmObservarCabecalho();
else document.addEventListener('DOMContentLoaded', gbmObservarCabecalho, { once: true });

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

function abrirMenuLateral(event) {
    if (window.GBMAppShell) { window.GBMAppShell.abrir(event); return; }
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
    if (window.GBMAppShell) { window.GBMAppShell.fechar(); return; }
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
        gbmConfirmar(`A ferramenta <strong>${nomeRecurso}</strong> é exclusiva do plano Premium.<br><br>Assine por R$ 9,90 por mês para liberar os recursos avançados e usar o GBM sem anúncios.`, {
            titulo: 'Recurso Premium',
            confirmar: 'Conhecer o Premium',
            cancelar: 'Agora não'
        }).then((confirmado) => {
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


/* ===== AVISOS E CONFIRMAÇÕES =====
   Um único componente de aviso (toast) e um diálogo de confirmação nativo,
   usados por todas as páginas. Mensagens são texto; só <strong> e <br>
   são preservados. */
const gbmEscaparMensagemModal = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[caractere]);

function gbmMensagemSegura(mensagem) {
    return gbmEscaparMensagemModal(mensagem)
        .replace(/&lt;(\/?)strong&gt;/g, '<$1strong>')
        .replace(/&lt;br\s*\/?&gt;/g, '<br>');
}

const GBM_ICONES_AVISO = {
    erro: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path>',
    aviso: '<path d="M12 4 2.5 20h19z"></path><path d="M12 10v4M12 17h.01"></path>',
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
    sucesso: '<path d="M5 12.5l4.2 4.2L19 7"></path>'
};

function gbmToast(mensagem, tipo = 'sucesso') {
    const tipoValido = GBM_ICONES_AVISO[tipo] ? tipo : 'info';
    let pilha = document.querySelector('.gbm-avisos');
    if (!pilha) {
        pilha = document.createElement('div');
        pilha.className = 'gbm-avisos';
        document.body.appendChild(pilha);
    }
    pilha.querySelectorAll('.toast').forEach((anterior) => anterior.remove());
    const toast = document.createElement('div');
    toast.className = `toast ${tipoValido}`;
    toast.setAttribute('role', tipoValido === 'erro' ? 'alert' : 'status');
    toast.setAttribute('aria-live', tipoValido === 'erro' ? 'assertive' : 'polite');
    toast.innerHTML = `<svg class="toast-icone" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GBM_ICONES_AVISO[tipoValido]}</svg>`
        + '<span class="toast-texto"></span><button type="button" class="toast-fechar" aria-label="Fechar aviso">×</button>';
    toast.querySelector('.toast-texto').innerHTML = gbmMensagemSegura(mensagem);
    const fechar = () => {
        if (!toast.isConnected || toast.classList.contains('saindo')) return;
        toast.classList.add('saindo');
        setTimeout(() => toast.remove(), 170);
    };
    toast.querySelector('.toast-fechar').addEventListener('click', fechar);
    pilha.appendChild(toast);
    const texto = toast.textContent || '';
    const duracao = Math.min(12000, 4000 + texto.length * 45) + (tipoValido === 'erro' ? 3000 : 0);
    let temporizador = setTimeout(fechar, duracao);
    toast.addEventListener('mouseenter', () => clearTimeout(temporizador));
    toast.addEventListener('mouseleave', () => { temporizador = setTimeout(fechar, 2500); });
    return toast;
}

function gbmAlerta(mensagem, tipo = 'info') {
    return gbmToast(mensagem, tipo === 'erro' || tipo === 'aviso' || tipo === 'sucesso' ? tipo : 'info');
}

let _gbmResolveConfirm = null;
function gbmDialogoConfirmacao() {
    let dialogo = document.getElementById('gbm-dialogo-confirmacao');
    if (dialogo) return dialogo;
    dialogo = document.createElement('dialog');
    dialogo.id = 'gbm-dialogo-confirmacao';
    dialogo.className = 'gbm-dialogo';
    dialogo.setAttribute('aria-labelledby', 'gbm-dialogo-titulo');
    dialogo.innerHTML = '<form method="dialog" class="gbm-dialogo-corpo">'
        + '<h2 id="gbm-dialogo-titulo" class="gbm-dialogo-titulo"></h2>'
        + '<p class="gbm-dialogo-mensagem"></p>'
        + '<div class="gbm-dialogo-acoes">'
        + '<button type="submit" value="cancelar" class="btn" data-gbm-cancelar></button>'
        + '<button type="submit" value="confirmar" class="btn btn-primary" data-gbm-confirmar></button>'
        + '</div></form>';
    dialogo.addEventListener('close', () => {
        const confirmado = dialogo.returnValue === 'confirmar';
        if (_gbmResolveConfirm) {
            const resolver = _gbmResolveConfirm;
            _gbmResolveConfirm = null;
            resolver(confirmado);
        }
    });
    document.body.appendChild(dialogo);
    return dialogo;
}

function gbmConfirmar(mensagem, opcoes = {}) {
    const {
        titulo = 'Confirmar ação',
        confirmar = 'Confirmar',
        cancelar = 'Cancelar',
        perigo = false
    } = opcoes;
    return new Promise((resolve) => {
        if (_gbmResolveConfirm) _gbmResolveConfirm(false);
        const dialogo = gbmDialogoConfirmacao();
        dialogo.querySelector('.gbm-dialogo-titulo').textContent = titulo;
        dialogo.querySelector('.gbm-dialogo-mensagem').innerHTML = gbmMensagemSegura(mensagem);
        dialogo.querySelector('[data-gbm-cancelar]').textContent = cancelar;
        const botaoConfirmar = dialogo.querySelector('[data-gbm-confirmar]');
        botaoConfirmar.textContent = confirmar;
        botaoConfirmar.className = perigo ? 'btn btn-danger' : 'btn btn-primary';
        _gbmResolveConfirm = resolve;
        dialogo.returnValue = '';
        if (!dialogo.open) dialogo.showModal();
        botaoConfirmar.focus();
    });
}

// Nome mantido para chamadas antigas: fecha o diálogo com a resposta indicada.
function fecharModalNotificacoes(confirmado = false) {
    const dialogo = document.getElementById('gbm-dialogo-confirmacao');
    if (dialogo?.open) dialogo.close(confirmado ? 'confirmar' : 'cancelar');
}

/* Os títulos e descrições permanecem no conteúdo, como no dashboard.
   O menu compartilhado identifica a seção e não remove informações da página. */

/* ===== ASSISTENTE IA "COMO USAR ESTA PÁGINA" ===== */
(function carregarAssistenteGbm() {
    if (document.getElementById('gbm-ai-ajuda-script')) return;
    const script = document.createElement('script');
    script.id = 'gbm-ai-ajuda-script';
    script.src = 'gbm-ai-ajuda.js?v=c879ffdc23';
    script.async = false;
    document.head.appendChild(script);
})();
