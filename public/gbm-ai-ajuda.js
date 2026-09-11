(function () {
    'use strict';

    if (window.__gbmAiAjudaInicializado) return;
    window.__gbmAiAjudaInicializado = true;

    const historico = [];

    const escapeHtml = (valor) => String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    function formatarResposta(valor) {
        let texto = escapeHtml(valor ?? '');
        texto = texto.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        texto = texto.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
        texto = texto.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="gbm-ai-link-pagina">$1</a>');
        texto = texto.replace(/\n/g, '<br>');
        return texto;
    }

    function paginaAtual() {
        const nome = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
        return nome === 'limite-gastos.html' ? 'limite-de-gastos.html' : nome;
    }

    function tituloPagina() {
        const titulos = {
            'dashboard.html': 'Visão geral',
            'contas.html': 'Minhas contas',
            'importacoes.html': 'Importações',
            'calendario.html': 'Calendário',
            'limite-de-gastos.html': 'Limite de gastos',
            'metas.html': 'Objetivos de poupança',
            'notificacoes.html': 'Notificações',
            'relatorio.html': 'Relatórios',
            'relatorio-avancado.html': 'Relatório avançado',
            'comparativo.html': 'Comparativo mensal',
            'configuracoes.html': 'Configurações',
            'perfil.html': 'Meu perfil',
            'educacao-financeira.html': 'Educação financeira'
        };
        return titulos[paginaAtual()] || document.title || 'Página do GBM';
    }

    function injetarEstilos() {
        if (document.getElementById('gbm-ai-ajuda-style')) return;
        const style = document.createElement('style');
        style.id = 'gbm-ai-ajuda-style';
        style.textContent = `
            .gbm-ai-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.46);backdrop-filter:blur(5px);display:none;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
            .gbm-ai-overlay.aberto{display:flex}
            .gbm-ai-modal{width:min(680px,100%);max-height:min(760px,calc(100vh - 36px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(85,167,255,.28);border-radius:18px;background:rgba(7,17,31,.98);box-shadow:0 24px 70px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.03);color:#eef6ff;font-family:Inter,"Segoe UI",sans-serif}
            .gbm-ai-header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 19px;border-bottom:1px solid rgba(255,255,255,.08)}
            .gbm-ai-identidade{display:flex;align-items:center;gap:12px;min-width:0}
            .gbm-ai-icone{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(95,255,168,.34);border-radius:11px;background:linear-gradient(135deg,rgba(46,139,87,.22),rgba(85,167,255,.14));color:#9fffc8;font-size:18px;font-weight:800}
            .gbm-ai-titulo{font:700 1rem Rajdhani,Inter,sans-serif;letter-spacing:.25px}
            .gbm-ai-subtitulo{margin-top:2px;color:#8ea2b9;font-size:.74rem}
            .gbm-ai-fechar{width:34px;height:34px;border:0;border-radius:9px;background:transparent;color:#b9c7d5;font-size:21px;cursor:pointer}
            .gbm-ai-fechar:hover{background:rgba(255,255,255,.06);color:#fff}
            .gbm-ai-conversa{display:flex;flex:1;flex-direction:column;gap:11px;min-height:250px;overflow:auto;padding:17px}
            .gbm-ai-mensagem{max-width:88%;padding:11px 13px;border-radius:13px;font-size:.87rem;line-height:1.55;white-space:normal;word-break:break-word}
            .gbm-ai-mensagem strong{font-weight:800;color:#fff}
            .gbm-ai-mensagem.ia{align-self:flex-start;border:1px solid rgba(85,167,255,.18);background:rgba(15,26,43,.92);color:#eaf4ff}
            .gbm-ai-mensagem.usuario{align-self:flex-end;border:1px solid rgba(95,255,168,.22);background:rgba(46,139,87,.15);color:#ecfff5;white-space:pre-wrap}
            .gbm-ai-link-pagina{display:inline-flex;margin-top:8px;padding:6px 10px;border:1px solid rgba(85,167,255,.25);border-radius:8px;background:rgba(85,167,255,.08);color:#a9d7ff;text-decoration:none;font-weight:700}
            .gbm-ai-link-pagina:hover{border-color:rgba(85,167,255,.55);background:rgba(85,167,255,.14);color:#fff}
            .gbm-ai-navegacao{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}
            .gbm-ai-navegacao-descricao{color:#a9b8c8;font-size:.76rem;margin-bottom:7px}
            .gbm-ai-navegacao-botao{display:inline-flex;align-items:center;padding:7px 10px;border:1px solid rgba(95,255,168,.3);border-radius:8px;background:rgba(46,139,87,.14);color:#dffff0;text-decoration:none;font-weight:700;font-size:.76rem}
            .gbm-ai-navegacao-botao:hover{background:rgba(46,139,87,.24);border-color:rgba(95,255,168,.55)}
            .gbm-ai-carregando{display:inline-flex;align-items:center;gap:6px;color:#9eb2c8}
            .gbm-ai-carregando span{width:6px;height:6px;border-radius:50%;background:#55a7ff;animation:gbm-ai-pulso 1.1s infinite ease-in-out}
            .gbm-ai-carregando span:nth-child(2){animation-delay:.16s}.gbm-ai-carregando span:nth-child(3){animation-delay:.32s}
            @keyframes gbm-ai-pulso{0%,70%,100%{opacity:.32;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
            .gbm-ai-sugestoes{display:flex;gap:7px;flex-wrap:wrap;padding:0 17px 12px}
            .gbm-ai-sugestao{padding:8px 10px;border:1px solid rgba(85,167,255,.2);border-radius:999px;background:rgba(255,255,255,.025);color:#cfe0f0;font:600 .72rem Inter,sans-serif;cursor:pointer}
            .gbm-ai-sugestao:hover{border-color:rgba(85,167,255,.52);background:rgba(85,167,255,.08)}
            .gbm-ai-acoes{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:0 17px 12px}
            .gbm-ai-link{border:0;background:transparent;color:#8ec8ff;font:700 .72rem Inter,sans-serif;cursor:pointer;padding:4px 0}
            .gbm-ai-link:hover{color:#fff}
            .gbm-ai-form{display:flex;gap:8px;padding:12px 17px 17px;border-top:1px solid rgba(255,255,255,.08)}
            .gbm-ai-input{flex:1;min-width:0;min-height:44px;padding:10px 12px;border:1px solid rgba(255,255,255,.14);border-radius:10px;outline:none;background:rgba(6,15,29,.9);color:#eef6ff;font:inherit;resize:none}
            .gbm-ai-input:focus{border-color:#55a7ff;box-shadow:0 0 0 3px rgba(85,167,255,.11)}
            .gbm-ai-enviar{min-width:86px;min-height:44px;padding:0 14px;border:1px solid #5fffa8;border-radius:10px;background:linear-gradient(135deg,#258c5b,#2e9b64);color:#fff;font:700 .8rem Rajdhani,Inter,sans-serif;cursor:pointer}
            .gbm-ai-enviar:disabled{opacity:.56;cursor:wait}
            @media(max-width:640px){.gbm-ai-overlay{padding:8px}.gbm-ai-modal{max-height:calc(100vh - 16px);border-radius:15px}.gbm-ai-mensagem{max-width:94%}.gbm-ai-form{align-items:flex-end}.gbm-ai-enviar{min-width:72px}}
        `;
        document.head.appendChild(style);
    }

    function criarInterface() {
        if (document.getElementById('gbm-ai-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'gbm-ai-overlay';
        overlay.className = 'gbm-ai-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <section class="gbm-ai-modal" role="dialog" aria-modal="true" aria-labelledby="gbm-ai-titulo">
                <header class="gbm-ai-header">
                    <div class="gbm-ai-identidade">
                        <div class="gbm-ai-icone" aria-hidden="true">?</div>
                        <div>
                            <div class="gbm-ai-titulo" id="gbm-ai-titulo">Como usar esta página</div>
                            <div class="gbm-ai-subtitulo">Assistente do GBM · ${escapeHtml(tituloPagina())}</div>
                        </div>
                    </div>
                    <button type="button" class="gbm-ai-fechar" id="gbm-ai-fechar" aria-label="Fechar">×</button>
                </header>
                <div class="gbm-ai-conversa" id="gbm-ai-conversa" aria-live="polite"></div>
                <div class="gbm-ai-sugestoes" id="gbm-ai-sugestoes"></div>
                <div class="gbm-ai-acoes">
                    <button type="button" class="gbm-ai-link" id="gbm-ai-tutorial">Ver tutorial passo a passo</button>
                    <span style="color:#718198;font-size:.68rem">Posso orientar você pelo GBM inteiro.</span>
                </div>
                <form class="gbm-ai-form" id="gbm-ai-form">
                    <textarea class="gbm-ai-input" id="gbm-ai-input" rows="1" maxlength="1200" placeholder="Digite sua dúvida sobre o GBM..." aria-label="Sua dúvida"></textarea>
                    <button type="submit" class="gbm-ai-enviar" id="gbm-ai-enviar">Enviar</button>
                </form>
            </section>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (evento) => {
            if (evento.target === overlay) fechar();
        });
        document.getElementById('gbm-ai-fechar').addEventListener('click', fechar);
        document.getElementById('gbm-ai-form').addEventListener('submit', enviarPergunta);
        document.getElementById('gbm-ai-tutorial').addEventListener('click', abrirTutorialOriginal);
        document.addEventListener('keydown', (evento) => {
            if (evento.key === 'Escape' && overlay.classList.contains('aberto')) fechar();
        });

        const sugestoes = [
            'Como cadastro um novo gasto?',
            'Como importo meu extrato?',
            'Onde vejo minhas contas?'
        ];
        const container = document.getElementById('gbm-ai-sugestoes');
        sugestoes.forEach((texto) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'gbm-ai-sugestao';
            botao.textContent = texto;
            botao.addEventListener('click', () => {
                document.getElementById('gbm-ai-input').value = texto;
                enviarPerguntaAtual();
            });
            container.appendChild(botao);
        });

        adicionarMensagem('ia', `Olá! Posso explicar qualquer função do GBM, mesmo que ela esteja em outra página. Você está em “${tituloPagina()}”.`);
    }

    function abrir() {
        criarInterface();
        const overlay = document.getElementById('gbm-ai-overlay');
        overlay.classList.add('aberto');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        document.getElementById('gbm-ai-input')?.focus();
    }

    function fechar() {
        const overlay = document.getElementById('gbm-ai-overlay');
        if (!overlay) return;
        overlay.classList.remove('aberto');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function adicionarMensagem(tipo, texto, navegacao = null) {
        const conversa = document.getElementById('gbm-ai-conversa');
        if (!conversa) return;

        const mensagem = document.createElement('div');
        mensagem.className = `gbm-ai-mensagem ${tipo}`;
        if (tipo === 'ia') {
            mensagem.innerHTML = formatarResposta(texto);

            if (navegacao?.url) {
                const area = document.createElement('div');
                area.className = 'gbm-ai-navegacao';
                area.innerHTML = `
                    <div class="gbm-ai-navegacao-descricao">${escapeHtml(navegacao.descricao || '')}</div>
                    <a class="gbm-ai-navegacao-botao" href="${escapeHtml(navegacao.url)}">Abrir ${escapeHtml(navegacao.titulo || 'página')}</a>
                `;
                mensagem.appendChild(area);
            }
        } else {
            mensagem.textContent = texto;
        }

        conversa.appendChild(mensagem);
        conversa.scrollTop = conversa.scrollHeight;
        return mensagem;
    }

    function adicionarCarregando() {
        const conversa = document.getElementById('gbm-ai-conversa');
        const mensagem = document.createElement('div');
        mensagem.className = 'gbm-ai-mensagem ia';
        mensagem.innerHTML = '<span class="gbm-ai-carregando" aria-label="Pensando"><span></span><span></span><span></span></span>';
        conversa.appendChild(mensagem);
        conversa.scrollTop = conversa.scrollHeight;
        return mensagem;
    }

    function apiFetch(url, opcoes) {
        if (typeof window.fetchApi === 'function') return window.fetchApi(url, opcoes);
        return fetch(url, { credentials: 'include', ...opcoes });
    }

    function registrarHistorico(role, text) {
        historico.push({ role, text });
        while (historico.length > 6) historico.shift();
    }

    async function enviarPergunta(evento) {
        if (evento) evento.preventDefault();
        return enviarPerguntaAtual();
    }

    async function enviarPerguntaAtual() {
        const input = document.getElementById('gbm-ai-input');
        const enviar = document.getElementById('gbm-ai-enviar');
        if (!input || !enviar) return;

        const pergunta = input.value.trim();
        if (!pergunta || enviar.disabled) return;

        adicionarMensagem('usuario', pergunta);
        registrarHistorico('user', pergunta);
        input.value = '';
        enviar.disabled = true;
        const carregando = adicionarCarregando();

        try {
            const resposta = await apiFetch('/assistente-ajuda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pergunta,
                    pagina: paginaAtual(),
                    historico: historico.slice(-6)
                })
            });

            const dados = await resposta.json().catch(() => ({}));
            carregando.remove();

            if (!resposta.ok || !dados.success) {
                throw new Error(dados.error || 'Não foi possível obter uma resposta.');
            }

            adicionarMensagem('ia', dados.resposta, dados.navegacao);
            registrarHistorico('model', dados.resposta);
        } catch (erro) {
            carregando.remove();
            adicionarMensagem('ia', erro.message || 'Não consegui responder agora. Tente novamente.');
        } finally {
            enviar.disabled = false;
            input.focus();
        }
    }

    function abrirTutorialOriginal() {
        fechar();
        const botao = document.getElementById('gbm-tour-ajuda');
        if (!botao) return;
        botao.dataset.gbmIgnorarAssistente = '1';
        botao.click();
    }

    function interceptarBotaoExistente() {
        document.addEventListener('click', (evento) => {
            const botao = evento.target.closest('#gbm-tour-ajuda');
            if (!botao) return;

            if (botao.dataset.gbmIgnorarAssistente === '1') {
                delete botao.dataset.gbmIgnorarAssistente;
                return;
            }

            evento.preventDefault();
            evento.stopPropagation();
            evento.stopImmediatePropagation();
            abrir();
        }, true);
    }

    function inicializar() {
        injetarEstilos();
        criarInterface();
        interceptarBotaoExistente();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar, { once: true });
    } else {
        inicializar();
    }
})();