(function () {
    'use strict';

    const paginasPublicas = new Set([
        'index.html', 'login.html', 'termos.html', 'privacidade.html',
        'politica-de-privacidade.html', 'sobre.html', 'fale-conosco.html',
        'offline.html', 'pagamento.html', 'assinatura.html'
    ]);

    function inicializar() {
        const atual = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if (paginasPublicas.has(atual)) return;
        if (document.documentElement.dataset.gbmMenuInicializado === 'true') return;
        document.documentElement.dataset.gbmMenuInicializado = 'true';

        // O Dashboard já possui a implementação oficial. Não duplique o componente nele.
        if (document.querySelector('.gbm-header') && document.querySelector('.sidebar-menu')) return;

        const css = `
            .gbm-header{
                background:transparent;
                border-bottom:1px solid var(--borda,rgba(255,255,255,.15));
                padding:0 20px;
                display:flex;
                align-items:center;
                justify-content:space-between;
                height:56px;
                box-sizing:border-box;
                position:sticky;
                top:0;
                z-index:10000;
                backdrop-filter:blur(9px);
                -webkit-backdrop-filter:blur(9px);
                background-color:rgba(7,17,31,.3);
            }
            .gbm-logo-container{display:flex;align-items:center;gap:15px;min-width:0;}
            .gbm-logo-img{height:70px !important;width:auto !important;border-radius:8px;}
            .gbm-title{
                font-family:'Rajdhani',sans-serif;
                font-size:26px;
                font-weight:700;
                text-transform:uppercase;
                letter-spacing:2px;
                margin:0;
                cursor:default;
                background:linear-gradient(90deg,#2E8B57 0%,#5fffa8 25%,#3d28ff 50%,#655aff 75%,#2E8B57 100%);
                background-size:200% auto;
                -webkit-background-clip:text;
                background-clip:text;
                -webkit-text-fill-color:transparent;
                color:transparent;
                animation:gbm-shine 4s linear infinite;
                transition:letter-spacing .3s ease,transform .3s ease;
            }
            .gbm-title:hover{letter-spacing:4px;transform:scale(1.03);animation-duration:1.5s;}
            @keyframes gbm-shine{0%{background-position:0% center}100%{background-position:200% center}}
            .gbm-header-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;}
            .atalho-perfil{
                display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:4px 10px 4px 4px;
                border:1px solid rgba(95,255,168,.35);border-radius:999px;background:rgba(15,26,43,.78);
                color:var(--texto-principal,#fff);text-decoration:none;box-sizing:border-box;
                transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;
            }
            .atalho-perfil:hover{transform:translateY(-1px);border-color:var(--cor-destaque,#2E8B57);box-shadow:0 0 14px rgba(95,255,168,.25);}
            .avatar-perfil-cabecalho{width:38px;height:38px;border-radius:50%;object-fit:cover;border:1px solid var(--cor-destaque,#2E8B57);background:#101b2c;}
            .nome-perfil-cabecalho{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.86rem;font-weight:700;}
            .gbm-menu-container{position:relative;z-index:1000;}
            .gbm-menu-btn{
                display:flex;align-items:center;justify-content:center;gap:10px;padding:0;width:34px;min-height:40px;
                border:0 !important;border-radius:0;background:transparent !important;box-shadow:none !important;cursor:pointer;color:#dce6f0;
                transition:color .2s ease,transform .2s ease;
            }
            .gbm-menu-btn:hover{background:transparent !important;box-shadow:none !important;transform:none;color:#5fffa8;}
            .hamburger-icon{display:inline-flex;width:27px;flex-direction:column;gap:5px;}
            .hamburger-icon span{display:block;width:100%;height:2px;border-radius:2px;background:linear-gradient(90deg,#5fffa8,#3d28ff);}
            .menu-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9998;}
            .menu-overlay.aberto{display:block;}
            .sidebar-menu{
                position:fixed;top:0;right:-320px;width:300px;height:100dvh;max-height:100dvh;box-sizing:border-box;
                background:rgba(7,17,31,.94);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);
                border-left:1px solid rgba(85,167,255,.2);box-shadow:-10px 0 30px rgba(0,0,0,.8);z-index:9999;
                transition:right .4s cubic-bezier(.25,.8,.25,1);display:flex;flex-direction:column;overflow:hidden;
            }
            .sidebar-menu.aberto{right:0 !important;}
            .sidebar-header{display:flex;justify-content:space-between;align-items:center;min-height:78px;box-sizing:border-box;padding:15px 14px 14px 16px;border-bottom:1px solid rgba(255,255,255,.08);}
            .sidebar-brand{display:flex;align-items:center;gap:9px;min-width:0;text-decoration:none;}
            .sidebar-logo{width:28px;height:28px;object-fit:contain;border-radius:7px;flex:0 0 auto;}
            .sidebar-brand-text{display:flex;flex-direction:column;min-width:0;line-height:1.05;}
            .sidebar-brand-text strong{
                background:linear-gradient(90deg,#2E8B57 0%,#5fffa8 25%,#3d28ff 50%,#655aff 75%,#2E8B57 100%);
                background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
                animation:gbm-shine 4s linear infinite;font:700 .79rem 'Inter',sans-serif;letter-spacing:-.01em;
            }
            .sidebar-brand-text span{margin-top:3px;color:#718198;font:500 .56rem 'Inter',sans-serif;}
            .fechar-btn{width:30px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0 !important;color:#d9e7f5 !important;font-size:25px !important;background:transparent !important;cursor:pointer;}
            .fechar-btn:hover{color:#5fffa8 !important;transform:none !important;}
            .sidebar-content{padding:12px 10px 15px;display:flex;flex-direction:column;gap:0;flex:1;overflow-y:auto;}
            .sidebar-content::-webkit-scrollbar{width:6px;}
            .sidebar-content::-webkit-scrollbar-thumb{background:rgba(148,163,184,.35);border-radius:10px;}
            .menu-grupo{padding:0 0 8px;margin:0 !important;display:flex;flex-direction:column;gap:2px;}
            .menu-grupo + .menu-grupo{margin-top:2px !important;}
            .menu-grupo-titulo{padding:9px 9px 5px;margin:0;color:#58708b !important;font:800 .5rem 'Inter',sans-serif;letter-spacing:.08em;text-transform:uppercase;line-height:1.25;}
            .menu-grupo-premium{padding-top:5px;border-top:1px solid rgba(255,255,255,.08);}
            .menu-grupo-premium .menu-grupo-titulo{color:#6b89a8 !important;}
            .menu-grupo-conta{margin-top:auto !important;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);}
            .menu-item{
                position:relative;display:flex !important;align-items:center;gap:9px;min-height:34px;box-sizing:border-box;padding:7px 9px !important;
                border-left:2px solid transparent !important;border-radius:7px;color:#dce6f0 !important;background:transparent !important;
                font:600 .68rem 'Inter',sans-serif;letter-spacing:0;text-decoration:none !important;cursor:pointer;
                transition:background .18s ease,color .18s ease,border-color .18s ease;
            }
            .menu-item-icone{width:15px;flex:0 0 15px;text-align:center;color:#7d9abd;font-size:.78rem;line-height:1;}
            .menu-item-conteudo{min-width:0;flex:1;}
            .menu-item:hover{background:rgba(85,167,255,.07) !important;border-left-color:rgba(85,167,255,.45) !important;color:#f5f9ff !important;}
            .menu-item:hover .menu-item-icone{color:#9dcbff;}
            .menu-item-ativo{background:rgba(34,91,113,.38) !important;color:#effcff !important;border-left-color:#39d98a !important;}
            .menu-item-ativo .menu-item-icone{color:#39d98a;}
            .menu-item-ativo-indicador{width:3px;height:17px;border-radius:3px;background:linear-gradient(180deg,#5fffa8 0%,#3d28ff 100%);box-shadow:0 0 8px rgba(57,217,138,.28);margin-left:auto;}
            .menu-item-com-indicador .menu-item-indicadores{margin-left:auto;display:inline-flex;align-items:center;gap:6px;}
            .cadeado-premium{display:none;align-items:center;justify-content:center;min-height:18px;padding:2px 6px;border:1px solid rgba(85,167,255,.5);border-radius:999px;background:rgba(85,167,255,.12);color:#9dcbff;font-size:.48rem;font-weight:700;}
            .menu-item-premium.recurso-bloqueado{opacity:.72;}
            .menu-item-premium.recurso-bloqueado:hover{border-left-color:#55a7ff !important;color:#9dcbff !important;background:rgba(85,167,255,.08) !important;}
            .menu-item-sair{color:#ff7d8a !important;margin-top:2px;}
            .menu-item-sair .menu-item-icone{color:#ff7d8a;}
            .texto-vermelho{color:#ff7d8a !important;}
            .texto-vermelho:hover{border-left-color:#ff5d6c !important;background:rgba(255,93,108,.08) !important;color:#ff9aa4 !important;}
            body.gbm-menu-aberto{overflow:hidden;}
            @media(max-width:768px){
                .gbm-header{height:56px;padding:0 12px;}
                .gbm-logo-img{height:52px !important;}
                .gbm-title{font-size:18px;letter-spacing:1px;}
                .gbm-header-actions{gap:6px;}
                .nome-perfil-cabecalho{display:none;}
                .atalho-perfil{min-height:40px;padding:1px 1px 1px 1px;border:0;background:transparent;}
                .avatar-perfil-cabecalho{width:37px;height:37px;}
                .sidebar-menu{width:min(286px,88vw);right:calc(-1 * min(306px,92vw));}
            }
        `;

        const style = document.createElement('style');
        style.id = 'gbm-dashboard-menu-style';
        style.textContent = css;
        document.head.appendChild(style);

        const antigo = document.querySelector('body.gbm-interna > .topbar');
        const header = document.createElement('header');
        header.className = 'gbm-header';
        header.innerHTML = `
            <div class="gbm-logo-container">
                <a href="dashboard.html" aria-label="Ir para o Dashboard">
                    <img src="logo-transparente.jpg" alt="Logo GBM" class="gbm-logo-img">
                </a>
                <h1 class="gbm-title">Guardian Of Budget & Money</h1>
            </div>
            <div class="gbm-header-actions">
                <a href="perfil.html" class="atalho-perfil" aria-label="Abrir meu perfil">
                    <img id="foto-perfil-cabecalho" src="logo-transparente.jpg" alt="Minha foto de perfil" class="avatar-perfil-cabecalho">
                    <span id="nome-perfil-cabecalho" class="nome-perfil-cabecalho">Meu perfil</span>
                </a>
                <div class="gbm-menu-container">
                    <button id="menu-btn" class="gbm-menu-btn" type="button" aria-label="Abrir menu" aria-expanded="false">
                        <span class="hamburger-icon" aria-hidden="true"><span></span><span></span><span></span></span>
                        <span id="dot-alertas" style="display:none;position:absolute;top:2px;right:2px;width:9px;height:9px;background:#ef4444;border-radius:50%;box-shadow:0 0 4px #ef4444;"></span>
                    </button>
                </div>
            </div>
        `;

        if (antigo) {
            antigo.replaceWith(header);
        } else {
            document.body.prepend(header);
        }

        const overlay = document.createElement('div');
        overlay.id = 'menu-overlay';
        overlay.className = 'menu-overlay';

        const menu = document.createElement('aside');
        menu.id = 'sidebar-menu';
        menu.className = 'sidebar-menu';
        menu.setAttribute('aria-label','Menu principal');
        menu.innerHTML = `
            <div class="sidebar-header">
                <a class="sidebar-brand" href="dashboard.html" aria-label="Ir para o Dashboard">
                    <img class="sidebar-logo" src="logo-transparente.jpg" alt="Logo GBM">
                    <span class="sidebar-brand-text"><strong>GBM Finance</strong><span>Proteção financeira para você</span></span>
                </a>
                <button class="fechar-btn" type="button" aria-label="Fechar menu">&times;</button>
            </div>
            <nav class="sidebar-content" aria-label="Menu principal">
                <div class="menu-grupo">
                    <p class="menu-grupo-titulo">Resumo</p>
                    <a href="dashboard.html" data-menu-page="dashboard.html" class="menu-item"><span class="menu-item-icone" aria-hidden="true">⌂</span><span class="menu-item-conteudo">Visão geral</span><span class="menu-item-ativo-indicador" aria-hidden="true"></span></a>
                </div>
                <div class="menu-grupo">
                    <p class="menu-grupo-titulo">Movimentações</p>
                    <a href="contas.html" data-menu-page="contas.html" class="menu-item"><span class="menu-item-icone" aria-hidden="true">▣</span><span class="menu-item-conteudo">Minhas contas</span></a>
                    <a href="importacoes.html" data-menu-page="importacoes.html" class="menu-item"><span class="menu-item-icone" aria-hidden="true">↥</span><span class="menu-item-conteudo">Importações</span></a>
                </div>
                <div class="menu-grupo">
                    <p class="menu-grupo-titulo">Planejamento</p>
                    <a href="calendario.html" data-menu-page="calendario.html" class="menu-item"><span class="menu-item-icone" aria-hidden="true">□</span><span class="menu-item-conteudo">Calendário</span></a>
                    <a href="limite-de-gastos.html" data-menu-page="limite-de-gastos.html" class="menu-item"><span class="menu-item-icone" aria-hidden="true">◒</span><span class="menu-item-conteudo">Limite de gastos</span></a>
                    <a href="metas.html" data-menu-page="metas.html" class="menu-item"><span class="menu-item-icone" aria-hidden="true">◎</span><span class="menu-item-conteudo">Objetivos de poupança</span></a>
                </div>
                <div class="menu-grupo menu-grupo-premium">
                    <p class="menu-grupo-titulo">Análises</p>
                    <a href="relatorio.html" data-menu-page="relatorio.html" class="menu-item menu-item-premium menu-item-com-indicador"><span class="menu-item-icone" aria-hidden="true">▥</span><span class="menu-item-conteudo">Relatório mensal</span><span class="cadeado-premium">Premium</span></a>
                    <a href="comparativo.html" data-menu-page="comparativo.html" class="menu-item menu-item-premium menu-item-com-indicador"><span class="menu-item-icone" aria-hidden="true">⇄</span><span class="menu-item-conteudo">Comparativo mensal</span><span class="cadeado-premium">Premium</span></a>
                </div>
                <div class="menu-grupo menu-grupo-conta">
                    <p class="menu-grupo-titulo">Conta</p>
                    <a href="notificacoes.html" data-menu-page="notificacoes.html" class="menu-item menu-item-com-indicador"><span class="menu-item-icone" aria-hidden="true">♧</span><span class="menu-item-conteudo">Notificações</span><span class="menu-item-indicadores"><span id="badge-alertas-menu" style="display:none;background:#ef4444;color:#fff;border-radius:10px;font-size:.56rem;padding:2px 7px;">0</span></span></a>
                    <a href="configuracoes.html" data-menu-page="configuracoes.html" class="menu-item"><span class="menu-item-icone" aria-hidden="true">⚙</span><span class="menu-item-conteudo">Configurações</span></a>
                    <a href="perfil.html" data-menu-page="perfil.html" class="menu-item"><span class="menu-item-icone" aria-hidden="true">♙</span><span class="menu-item-conteudo">Perfil</span></a>
                    <a href="#" id="menu-sair" class="menu-item menu-item-sair texto-vermelho"><span class="menu-item-icone" aria-hidden="true">↪</span><span class="menu-item-conteudo">Sair</span></a>
                </div>
            </nav>
        `;

        document.body.append(overlay, menu);

        const botao = document.getElementById('menu-btn');
        const fechar = () => {
            menu.classList.remove('aberto');
            overlay.classList.remove('aberto');
            document.body.classList.remove('gbm-menu-aberto');
            botao?.setAttribute('aria-expanded','false');
        };
        const abrir = () => {
            menu.classList.add('aberto');
            overlay.classList.add('aberto');
            document.body.classList.add('gbm-menu-aberto');
            botao?.setAttribute('aria-expanded','true');
        };

        botao?.addEventListener('click', () => menu.classList.contains('aberto') ? fechar() : abrir());
        overlay.addEventListener('click', fechar);
        menu.querySelector('.fechar-btn')?.addEventListener('click', fechar);
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape') fechar(); });

        const paginaAtual = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
        menu.querySelectorAll('[data-menu-page]').forEach((link) => {
            const alvo = String(link.getAttribute('data-menu-page') || '').toLowerCase();
            const ativo = alvo === paginaAtual;
            link.classList.toggle('menu-item-ativo', ativo);
            if (!ativo) link.querySelector('.menu-item-ativo-indicador')?.remove();
        });

        menu.querySelectorAll('a[href]').forEach((link) => link.addEventListener('click', fechar));

        menu.querySelector('#menu-sair')?.addEventListener('click', async (event) => {
            event.preventDefault();
            fechar();
            if (typeof fazerLogout === 'function') {
                return fazerLogout();
            }
            try {
                await fetch('/logout', { method:'POST', credentials:'include' });
            } catch (_) {}
            window.location.replace('index.html');
        });

        async function carregarPerfilCabecalho() {
            if (typeof fetchApi !== 'function') return;
            try {
                const resposta = await fetchApi('/perfil');
                const dados = await resposta.json();
                if (!dados.success) return;
                const perfil = dados.perfil || {};
                const foto = document.getElementById('foto-perfil-cabecalho');
                const nome = document.getElementById('nome-perfil-cabecalho');
                if (foto && perfil.foto_perfil_url) foto.src = perfil.foto_perfil_url;
                if (nome) nome.textContent = perfil.nome || perfil.nome_completo || perfil.email || 'Meu perfil';
            } catch (_) {}
        }

        carregarPerfilCabecalho();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar, { once:true });
    } else {
        inicializar();
    }
})();
