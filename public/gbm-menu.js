(function () {
    'use strict';

    const paginasPublicas = new Set([
        'index.html','login.html','termos.html','privacidade.html',
        'politica-de-privacidade.html','sobre.html','fale-conosco.html',
        'offline.html','pagamento.html','assinatura.html'
    ]);

    const arquivoAtual = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (paginasPublicas.has(arquivoAtual) || document.documentElement.dataset.gbmMenuInicializado === 'true') return;
    document.documentElement.dataset.gbmMenuInicializado = 'true';

    const rotas = {
        visao: 'dashboard.html',
        contas: 'contas.html',
        importacoes: 'importacoes.html',
        calendario: 'calendario.html',
        limites: 'limite-gastos.html',
        metas: 'metas.html',
        relatorio: 'relatorio.html',
        comparativo: 'comparativo.html',
        notificacoes: 'notificacoes.html',
        configuracoes: 'configuracoes.html',
        perfil: 'perfil.html'
    };

    const css = `
        /* Mesmo acabamento do cabeçalho/menu do Dashboard. */
        body.gbm-interna .topbar {
            position: sticky;
            top: 0;
            z-index: 10020;
            isolation: isolate;
        }

        /* Mantém a faixa animada solicitada, usando exatamente a linguagem cromática da marca. */
        body.gbm-interna .topbar::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: -1;
            pointer-events: none;
            background: linear-gradient(90deg,
                rgba(46,139,87,.30) 0%,
                rgba(95,255,168,.16) 25%,
                rgba(61,40,255,.24) 50%,
                rgba(101,90,255,.16) 75%,
                rgba(46,139,87,.30) 100%);
            background-size: 200% 100%;
            animation: gbmTopbarShine 4s linear infinite;
            border-bottom: 1px solid rgba(255,255,255,.15);
        }

        @keyframes gbmTopbarShine {
            from { background-position: 0% 50%; }
            to { background-position: 200% 50%; }
        }

        /* Botão do menu com o mesmo desenho do .gbm-menu-btn do Dashboard. */
        .gbm-global-menu-button {
            position: relative;
            top: auto;
            right: auto;
            z-index: 1001;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: auto;
            height: auto;
            min-height: 40px;
            flex: 0 0 auto;
            padding: 10px 18px;
            border: 1px solid rgba(93, 138, 255, 0.35);
            border-radius: 10px;
            background: #0f1a2b;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
            color: #fff;
            cursor: pointer;
            transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .gbm-global-menu-button:hover {
            transform: scale(1.04);
            border-color: rgba(148, 163, 184, 0.7);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
            background: #162338 !important;
        }

        .gbm-global-menu-button span,
        .gbm-global-menu-button span::before,
        .gbm-global-menu-button span::after {
            display: block;
            width: 22px;
            height: 2px;
            border-radius: 2px;
            background: #d1d5db;
            content: "";
        }

        .gbm-global-menu-button span::before { transform: translateY(-6px); }
        .gbm-global-menu-button span::after { transform: translateY(4px); }

        body.gbm-interna .top-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: nowrap;
            position: relative;
            z-index: 1001;
        }

        /* Sidebar visualmente igual ao .sidebar-menu do Dashboard. */
        .gbm-global-menu-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(8px);
            z-index: 9998;
        }

        .gbm-global-menu-overlay.aberto {
            display: block;
        }

        .gbm-global-menu {
            position: fixed;
            top: 0;
            right: -320px;
            width: 300px;
            height: 100vh;
            background: rgba(15, 23, 42, 0.55);
            backdrop-filter: blur(20px) saturate(140%);
            -webkit-backdrop-filter: blur(20px) saturate(140%);
            border-left: 1px solid rgba(148, 163, 184, 0.28);
            box-shadow: -10px 0 30px rgba(0,0,0,0.8);
            z-index: 9999;
            transition: right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            overflow: hidden;
        }

        .gbm-global-menu.aberto { right: 0; }

        .gbm-global-menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            border-bottom: 1px solid rgba(255,255,255,0.15);
        }

        .gbm-global-menu-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            text-decoration: none;
        }

        .gbm-global-menu-brand img {
            width: auto;
            height: 45px;
            border-radius: 8px;
        }

        .gbm-global-menu-brand strong {
            overflow: hidden;
            font-family: Rajdhani, Inter, sans-serif;
            font-size: 1.15rem;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            text-overflow: ellipsis;
            white-space: nowrap;
            background: linear-gradient(90deg,#2E8B57,#5fffa8,#3d28ff,#655aff,#2E8B57);
            background-size: 200% auto;
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: gbmMenuShine 4s linear infinite;
        }

        @keyframes gbmMenuShine {
            from { background-position: 0 center; }
            to { background-position: 200% center; }
        }

        .gbm-global-menu-close {
            background: transparent;
            border: none;
            color: #b0bec5;
            font-size: 32px;
            line-height: 1;
            cursor: pointer;
            transition: 0.2s;
        }

        .gbm-global-menu-close:hover {
            color: #ff4d4d;
            transform: scale(1.1);
        }

        .gbm-global-menu-body {
            padding: 12px 0;
            display: flex;
            flex-direction: column;
            gap: 0;
            flex: 1;
            overflow-y: auto;
        }

        .gbm-global-menu-body::-webkit-scrollbar { width: 6px; }
        .gbm-global-menu-body::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.35);
            border-radius: 10px;
        }

        .gbm-global-menu-section {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding-bottom: 7px;
        }

        .gbm-global-menu-section + .gbm-global-menu-section {
            margin-top: 4px;
        }

        .gbm-global-menu-title {
            margin: 0;
            padding: 9px 28px 5px;
            color: #7f91a8;
            font-family: Inter, Montserrat, sans-serif;
            font-size: .72rem;
            font-weight: 700;
            letter-spacing: .04em;
            line-height: 1.25;
            text-transform: none;
        }

        .gbm-global-menu-link {
            display: block;
            width: 100%;
            padding: 13px 28px;
            border: 0;
            border-left: 4px solid transparent;
            border-radius: 0;
            color: #e5e7eb !important;
            background: transparent !important;
            font-family: Inter, Montserrat, sans-serif;
            font-size: 1rem;
            font-weight: 600;
            letter-spacing: normal;
            line-height: 1.25;
            text-align: left;
            text-decoration: none !important;
            text-shadow: none;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .gbm-global-menu-link:hover {
            background: rgba(255, 255, 255, 0.06) !important;
            border-left-color: #64748b;
            color: #fff !important;
        }

        .gbm-global-menu-link.ativo {
            background: rgba(255, 255, 255, 0.06) !important;
            border-left-color: #64748b;
            color: #fff !important;
        }

        /* O Dashboard usa texto puro nos itens; escondemos os símbolos da versão anterior. */
        .gbm-global-menu-icon { display: none !important; }
        .gbm-global-menu-link > span:last-child { display: inline; }

        .gbm-global-menu-divider {
            height: 1px;
            background: rgba(255,255,255,.15);
            margin: 15px 30px;
        }

        .gbm-global-menu-account {
            margin-top: auto !important;
            padding-top: 8px;
            padding-bottom: 0;
            border-top: 1px solid rgba(255,255,255,0.15);
        }

        .gbm-global-menu-account .gbm-global-menu-title {
            color: #9fb2c8;
        }

        .gbm-global-menu-footer {
            display: none;
        }

        .gbm-global-menu-sair {
            color: #ff4d4d !important;
        }

        .gbm-global-menu-sair:hover {
            border-left-color: #ff4d4d !important;
            background: rgba(255, 77, 77, 0.1) !important;
        }

        body.gbm-menu-aberto { overflow: hidden; }

        @media (max-width: 768px) {
            .gbm-global-menu-button {
                min-height: 36px;
                padding: 8px 12px;
            }

            .gbm-global-menu {
                width: min(300px, 92vw);
            }

            body.gbm-interna .top-actions {
                gap: 6px;
            }
        }
    `;

    const style = document.createElement('style');
    style.id = 'gbm-global-menu-style';
    style.textContent = css;
    document.head.appendChild(style);

    const topActions = document.querySelector('.top-actions');

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'gbm-global-menu-button';
    botao.setAttribute('aria-label', 'Abrir menu');
    botao.setAttribute('aria-expanded', 'false');
    botao.innerHTML = '<span aria-hidden="true"></span>';

    if (topActions) topActions.appendChild(botao);
    else document.body.appendChild(botao);

    const overlay = document.createElement('div');
    overlay.className = 'gbm-global-menu-overlay';

    const menu = document.createElement('aside');
    menu.id = 'gbm-global-menu';
    menu.className = 'gbm-global-menu';
    menu.setAttribute('aria-label', 'Navegação principal');
    menu.innerHTML = `
        <div class="gbm-global-menu-header">
            <a class="gbm-global-menu-brand" href="dashboard.html">
                <img src="logo-transparente.jpg" alt="Logo GBM">
                <strong>Guardian Of Budget &amp; Money</strong>
            </a>
            <button class="gbm-global-menu-close" type="button" aria-label="Fechar menu">×</button>
        </div>

        <div class="gbm-global-menu-body">
            <div class="gbm-global-menu-section">
                <div class="gbm-global-menu-title">Resumo</div>
                <a class="gbm-global-menu-link" href="dashboard.html" data-rota="visao"><span class="gbm-global-menu-icon">◉</span><span>Visão geral</span></a>
            </div>

            <div class="gbm-global-menu-section">
                <div class="gbm-global-menu-title">Movimentações</div>
                <a class="gbm-global-menu-link" href="contas.html" data-rota="contas"><span class="gbm-global-menu-icon">▣</span><span>Minhas contas</span></a>
                <a class="gbm-global-menu-link" href="importacoes.html" data-rota="importacoes"><span class="gbm-global-menu-icon">↥</span><span>Importações</span></a>
            </div>

            <div class="gbm-global-menu-section">
                <div class="gbm-global-menu-title">Planejamento</div>
                <a class="gbm-global-menu-link" href="calendario.html" data-rota="calendario"><span class="gbm-global-menu-icon">□</span><span>Calendário</span></a>
                <a class="gbm-global-menu-link" href="limite-gastos.html" data-rota="limites"><span class="gbm-global-menu-icon">▤</span><span>Limite de gastos</span></a>
                <a class="gbm-global-menu-link" href="metas.html" data-rota="metas"><span class="gbm-global-menu-icon">◇</span><span>Objetivos de poupança</span></a>
            </div>

            <div class="gbm-global-menu-section">
                <div class="gbm-global-menu-title">Análises</div>
                <a class="gbm-global-menu-link" href="relatorio.html" data-rota="relatorio"><span class="gbm-global-menu-icon">▥</span><span>Relatório mensal</span></a>
                <a class="gbm-global-menu-link" href="comparativo.html" data-rota="comparativo"><span class="gbm-global-menu-icon">⇄</span><span>Comparativo mensal</span></a>
            </div>

            <div class="gbm-global-menu-divider"></div>

            <div class="gbm-global-menu-section gbm-global-menu-account">
                <div class="gbm-global-menu-title">Conta</div>
                <a class="gbm-global-menu-link" href="notificacoes.html" data-rota="notificacoes"><span class="gbm-global-menu-icon">◔</span><span>Notificações</span></a>
                <a class="gbm-global-menu-link" href="configuracoes.html" data-rota="configuracoes"><span class="gbm-global-menu-icon">⚙</span><span>Configurações</span></a>
                <a class="gbm-global-menu-link" href="perfil.html" data-rota="perfil"><span class="gbm-global-menu-icon">○</span><span>Perfil</span></a>
                <button class="gbm-global-menu-link gbm-global-menu-sair" id="gbm-global-menu-sair" type="button"><span class="gbm-global-menu-icon">←</span><span>Sair</span></button>
            </div>
        </div>
    `;

    document.body.append(overlay, menu);

    const abrir = () => {
        menu.classList.add('aberto');
        overlay.classList.add('aberto');
        document.body.classList.add('gbm-menu-aberto');
        botao.setAttribute('aria-expanded', 'true');
    };

    const fechar = () => {
        menu.classList.remove('aberto');
        overlay.classList.remove('aberto');
        document.body.classList.remove('gbm-menu-aberto');
        botao.setAttribute('aria-expanded', 'false');
    };

    botao.addEventListener('click', () => menu.classList.contains('aberto') ? fechar() : abrir());
    overlay.addEventListener('click', fechar);
    menu.querySelector('.gbm-global-menu-close').addEventListener('click', fechar);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') fechar(); });

    const rotaAtual = Object.entries(rotas).find(([, rota]) => rota === arquivoAtual)?.[0];
    if (rotaAtual) menu.querySelector(`[data-rota="${rotaAtual}"]`)?.classList.add('ativo');

    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', fechar));

    menu.querySelector('#gbm-global-menu-sair').addEventListener('click', async () => {
        if (typeof encerrarSessao === 'function') {
            await encerrarSessao();
        } else {
            try {
                await fetch('/logout', { method: 'POST', credentials: 'include' });
            } catch (_) {}
            window.location.replace('index.html');
        }
    });
})();
