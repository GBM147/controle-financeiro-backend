(function () {
    'use strict';

    const paginasDaConta = new Set([
        'dashboard.html', 'contas.html', 'importacoes.html', 'importar-pdf.html',
        'calendario.html', 'limite-de-gastos.html', 'metas.html', 'relatorio.html',
        'relatorio-avancado.html', 'comparativo.html', 'notificacoes.html',
        'configuracoes.html', 'perfil.html', 'privacidade.html', 'assinatura.html', 'pagamento.html'
    ]);

    if (window.GBMAppShell) {
        window.GBMAppShell.iniciar();
        return;
    }

    const itensMenu = [
        { grupo:'Resumo', itens:[{href:'dashboard.html',pagina:'dashboard.html',texto:'Visão geral',icone:'dashboard'}] },
        { grupo:'Movimentações', itens:[{href:'contas.html',pagina:'contas.html',texto:'Minhas contas',icone:'wallet'},{href:'importacoes.html',pagina:'importacoes.html',texto:'Importações',icone:'upload'}] },
        { grupo:'Planejamento', itens:[{href:'calendario.html',pagina:'calendario.html',texto:'Calendário',icone:'calendar'},{href:'limite-de-gastos.html',pagina:'limite-de-gastos.html',texto:'Limite de gastos',icone:'limit'},{href:'metas.html',pagina:'metas.html',texto:'Objetivos de poupança',icone:'goal'}] },
        { grupo:'Análises', itens:[{href:'relatorio.html',pagina:'relatorio.html',texto:'Relatórios',icone:'report'},{href:'relatorio-avancado.html',pagina:'relatorio-avancado.html',texto:'Relatório avançado',icone:'advanced',premium:true},{href:'comparativo.html',pagina:'comparativo.html',texto:'Comparativo mensal',icone:'compare',premium:true}] },
        { grupo:'Conta', classe:'menu-grupo-conta', itens:[{href:'notificacoes.html',pagina:'notificacoes.html',texto:'Notificações',icone:'bell'},{href:'configuracoes.html',pagina:'configuracoes.html',texto:'Configurações',icone:'settings'},{href:'perfil.html',pagina:'perfil.html',texto:'Meu perfil',icone:'profile'},{href:'privacidade.html',pagina:'privacidade.html',texto:'Privacidade e dados',icone:'settings'},{href:'assinatura.html',pagina:'assinatura.html',texto:'Minha assinatura',icone:'advanced'},{href:'educacao-financeira.html',pagina:'educacao-financeira.html',texto:'Educação financeira',icone:'book'},{href:'#sair',pagina:'#sair',texto:'Sair',icone:'logout',sair:true}] }
    ];

    const paths = {
        dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
        wallet:'<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v14H6.5A2.5 2.5 0 0 1 4 16.5z"></path><path d="M4 8h13.5A2.5 2.5 0 0 1 20 10.5V12h-4a2.5 2.5 0 0 0 0 5h4v2"></path><path d="M16 14.5h.01"></path>',
        upload:'<path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 20h14"></path>',
        calendar:'<rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 9h18"></path>',
        limit:'<path d="M5 20V10M12 20V4M19 20v-7"></path>',
        goal:'<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle><path d="m17.5 6.5 2-2"></path>',
        report:'<path d="M5 3h10l4 4v14H5z"></path><path d="M15 3v5h5M8 13h8M8 17h6"></path>',
        advanced:'<path d="m12 3 2.3 5.2L20 10l-5.7 1.8L12 17l-2.3-5.2L4 10l5.7-1.8z"></path><path d="M18.5 16 20 19l3-1.5"></path>',
        compare:'<path d="M6 20V10M12 20V5M18 20v-8"></path><path d="M3 20h18"></path>',
        bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
        settings:'<circle cx="12" cy="12" r="3.5"></circle><path d="m19.4 15-.1.1a1.8 1.8 0 0 0 .3 1.9l.1.1-1.4 1.4-.1-.1a1.8 1.8 0 0 0-1.9-.3l-.1.1A1.8 1.8 0 0 0 15.1 20h-2v-.2A1.8 1.8 0 0 0 12 18.2a1.8 1.8 0 0 0-1.9.3l-.1.1-1.4-1.4.1-.1a1.8 1.8 0 0 0 .3-1.9l-.1-.1A1.8 1.8 0 0 0 7.2 14H7v-2h.2A1.8 1.8 0 0 0 8.8 11l.1-.1a1.8 1.8 0 0 0-.3-1.9l-.1-.1 1.4-1.4.1.1a1.8 1.8 0 0 0 1.9.3l.1-.1A1.8 1.8 0 0 0 13.1 6v-.2h2V6a1.8 1.8 0 0 0 1.1 1.8 1.8 1.8 0 0 0 1.9-.3l.1-.1 1.4 1.4-.1.1a1.8 1.8 0 0 0-.3 1.9l.1.1A1.8 1.8 0 0 0 20.8 12h.2v2h-.2A1.8 1.8 0 0 0 19.4 15Z"></path>',
        profile:'<circle cx="12" cy="8" r="3.5"></circle><path d="M5 20a7 7 0 0 1 14 0"></path>',
        book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"></path><path d="M8 7h8M8 11h8"></path>',
        logout:'<path d="M10 5H5v14h5"></path><path d="M14 8l4 4-4 4M9 12h9"></path>'
    };

    function paginaAtual(){const n=(window.location.pathname.split('/').pop()||'index.html').toLowerCase();return n==='limite-gastos.html'?'limite-de-gastos.html':n;}
    function svg(nome){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[nome]||paths.dashboard)+'</svg>';}

    const mobile = window.matchMedia('(max-width: 768px)');
    let iniciado = false;
    let focoAnterior = null;
    let elementosInertes = [];
    let overflowAnterior = null;

    function css() {
        if (document.getElementById('gbm-shell-style')) return;
        const estilo = document.createElement('link');
        estilo.id = 'gbm-shell-style';
        estilo.rel = 'stylesheet';
        estilo.href = 'gbm-shell.css?v=20261015-shell1';
        document.head.appendChild(estilo);
    }

    function prepararConteudo() {
        const conteudo = document.querySelector('body > main, body > .page-wrapper, body > .container');
        if (!conteudo) return;
        conteudo.classList.add('gbm-shell-content');
        if (!conteudo.id) conteudo.id = 'gbm-main-content';
        conteudo.setAttribute('tabindex', '-1');

        // Move os controles em vez de copiá-los: preserva os eventos já ligados.
        const acoes = document.querySelectorAll('body > .topbar .top-actions > *, body > .gbm-header > .btn-voltar');
        if (acoes.length) {
            const grupo = document.createElement('div');
            grupo.className = 'gbm-shell-page-actions';
            acoes.forEach((acao) => grupo.appendChild(acao));
            conteudo.prepend(grupo);
        }
        const atalho = document.createElement('a');
        atalho.className = 'gbm-shell-skip';
        atalho.href = '#' + conteudo.id;
        atalho.textContent = 'Pular para o conteúdo';
        document.body.prepend(atalho);
    }

    function removerAntigos() {
        document.querySelectorAll('body > .topbar, body > .gbm-header, body > .sidebar-menu, body > #sidebar-menu, body > #menu-overlay').forEach((el) => el.remove());
    }

    function itens(){return itensMenu.map((grupo)=>'<div class="menu-grupo '+(grupo.classe||'')+'"><p class="menu-grupo-titulo">'+grupo.grupo+'</p>'+grupo.itens.map((item)=>{const classes=['menu-item',item.premium?'menu-item-premium':'',item.sair?'menu-item-sair':''].filter(Boolean).join(' ');const premium=item.premium?'<span class="menu-item-indicadores"><span class="cadeado-premium">Premium</span></span>':'';if(item.sair)return '<button type="button" class="'+classes+'" data-menu-sair="true"><span class="menu-item-icone">'+svg(item.icone)+'</span><span class="menu-item-conteudo">'+item.texto+'</span></button>';return '<a href="'+item.href+'" data-menu-page="'+item.pagina+'" class="'+classes+'"><span class="menu-item-icone">'+svg(item.icone)+'</span><span class="menu-item-conteudo">'+item.texto+'</span>'+premium+'</a>';}).join('')+'</div>').join('');}

    function montar() {
        prepararConteudo();
        removerAntigos();
        const header = document.createElement('header');
        header.className = 'gbm-header gbm-shell-header';
        header.dataset.gbmSharedShell = 'true';
        const ehDashboard = paginaAtual() === 'dashboard.html';
        const itemAtual = itensMenu.flatMap((grupo) => grupo.itens).find((item) => item.pagina === paginaAtual());
        const nomePagina = itemAtual?.texto || (paginaAtual() === 'pagamento.html' ? 'Ativar Premium' : 'Minha conta');
        const busca = ehDashboard
            ? '<div class="dashboard-header-search" role="search"><span class="dashboard-search-icon" aria-hidden="true"></span><input type="search" placeholder="Buscar movimentações, categorias..." aria-label="Buscar movimentações e categorias"></div>'
            : '<span class="gbm-shell-page-name"></span>';
        header.innerHTML = '<div class="gbm-logo-container"><a href="dashboard.html" aria-label="Ir para o Dashboard"><img src="logo-transparente.jpg" alt="" class="gbm-logo-img"><span>GBM</span></a></div>' + busca + '<div class="gbm-header-actions"><a href="notificacoes.html" class="dashboard-notification-link" aria-label="Abrir notificações">' + svg('bell') + '<span id="dot-alertas" class="dashboard-notification-dot" aria-hidden="true" style="display:none"></span></a><a href="perfil.html" class="atalho-perfil" aria-label="Abrir meu perfil"><img id="foto-perfil-cabecalho" src="logo-transparente.jpg" alt="" class="avatar-perfil-cabecalho"><span id="nome-perfil-cabecalho" class="nome-perfil-cabecalho">Meu perfil</span></a><button id="menu-btn" class="gbm-menu-btn" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="sidebar-menu"><span class="hamburger-icon" aria-hidden="true"><span></span><span></span><span></span></span></button></div>';
        const titulo = header.querySelector('.gbm-shell-page-name');
        if (titulo) titulo.textContent = nomePagina;
        document.body.prepend(header);
        const overlay = document.createElement('div');
        overlay.id = 'menu-overlay';
        overlay.className = 'menu-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.appendChild(overlay);
        const sidebar = document.createElement('aside');
        sidebar.id = 'sidebar-menu';
        sidebar.className = 'sidebar-menu gbm-shell-sidebar';
        sidebar.setAttribute('aria-label', 'Menu da conta');
        sidebar.innerHTML = '<div class="sidebar-header"><a class="sidebar-brand" href="dashboard.html" aria-label="Ir para o Dashboard"><img class="sidebar-logo" src="logo-transparente.jpg" alt=""><span class="sidebar-brand-text"><strong>GBM Finance</strong><span>Meu Controle Financeiro</span></span></a><button class="fechar-btn" type="button" aria-label="Fechar menu">&times;</button></div><nav class="sidebar-content" aria-label="Navegação interna">' + itens() + '</nav>';
        document.body.appendChild(sidebar);
    }

    function restaurarFundo() {
        elementosInertes.forEach(([elemento, estavaInerte]) => { elemento.inert = estavaInerte; });
        elementosInertes = [];
        if (overflowAnterior) {
            document.body.style.overflow = overflowAnterior.corpo;
            document.documentElement.style.overflow = overflowAnterior.raiz;
            overflowAnterior = null;
        }
    }

    function fechar(devolverFoco = true) {
        const sidebar = document.getElementById('sidebar-menu');
        if (!sidebar) return;
        const estavaAberto = sidebar.classList.contains('aberto');
        sidebar.classList.remove('aberto');
        sidebar.inert = mobile.matches;
        sidebar.setAttribute('aria-hidden', String(mobile.matches));
        sidebar.removeAttribute('aria-modal');
        sidebar.removeAttribute('role');
        document.getElementById('menu-overlay')?.classList.remove('aberto');
        document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('gbm-menu-aberto');
        restaurarFundo();
        if (estavaAberto && devolverFoco && mobile.matches) {
            const destino = focoAnterior?.isConnected ? focoAnterior : document.getElementById('menu-btn');
            destino?.focus({ preventScroll: true });
        }
    }

    function abrir(evento) {
        evento?.stopPropagation();
        const sidebar = document.getElementById('sidebar-menu');
        if (!sidebar || !mobile.matches || sidebar.classList.contains('aberto')) return;
        focoAnterior = document.activeElement;
        sidebar.inert = false;
        sidebar.setAttribute('aria-hidden', 'false');
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        sidebar.classList.add('aberto');
        document.getElementById('menu-overlay')?.classList.add('aberto');
        document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'true');
        document.body.classList.add('gbm-menu-aberto');
        overflowAnterior = { corpo: document.body.style.overflow, raiz: document.documentElement.style.overflow };
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        elementosInertes = [...document.body.children]
            .filter((elemento) => elemento instanceof HTMLElement && ![sidebar, document.getElementById('menu-overlay')].includes(elemento) && !['SCRIPT', 'STYLE', 'LINK', 'CANVAS'].includes(elemento.tagName))
            .map((elemento) => [elemento, elemento.inert]);
        elementosInertes.forEach(([elemento]) => { elemento.inert = true; });
        sidebar.querySelector('.fechar-btn')?.focus({ preventScroll: true });
    }

    function ligar() {
        document.getElementById('menu-btn')?.addEventListener('click', (evento) => {
            if (document.getElementById('sidebar-menu')?.classList.contains('aberto')) fechar();
            else abrir(evento);
        });
        document.getElementById('menu-overlay')?.addEventListener('click', () => fechar());
        document.querySelector('#sidebar-menu .fechar-btn')?.addEventListener('click', () => fechar());
        document.querySelectorAll('#sidebar-menu .menu-item:not([data-menu-sair])').forEach((item) => item.addEventListener('click', () => fechar(false)));
        document.querySelector('[data-menu-sair]')?.addEventListener('click', async () => {
            fechar(false);
            if (typeof window.encerrarSessao === 'function') { await window.encerrarSessao(); return; }
            try { await fetch('/logout', { method: 'POST', credentials: 'include' }); } catch (erro) {}
            window.location.replace('index.html');
        });
        document.addEventListener('keydown', (evento) => {
            const sidebar = document.getElementById('sidebar-menu');
            if (!mobile.matches || !sidebar?.classList.contains('aberto')) return;
            if (evento.key === 'Escape') { evento.preventDefault(); fechar(); return; }
            if (evento.key !== 'Tab') return;
            const focaveis = [...sidebar.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')]
                .filter((elemento) => elemento.getClientRects().length);
            const primeiro = focaveis[0];
            const ultimo = focaveis[focaveis.length - 1];
            if (evento.shiftKey && (document.activeElement === primeiro || !sidebar.contains(document.activeElement))) {
                evento.preventDefault(); ultimo?.focus();
            } else if (!evento.shiftKey && (document.activeElement === ultimo || !sidebar.contains(document.activeElement))) {
                evento.preventDefault(); primeiro?.focus();
            }
        });
        mobile.addEventListener('change', () => {
            const sidebar = document.getElementById('sidebar-menu');
            const focoNoMenu = sidebar?.contains(document.activeElement);
            fechar(false);
            if (focoNoMenu) {
                const destino = mobile.matches
                    ? document.getElementById('menu-btn')
                    : sidebar.querySelector('[aria-current="page"], a[href]');
                destino?.focus({ preventScroll: true });
            }
        });
        fechar(false);
    }

    async function atualizarPerfil(){const foto=document.getElementById('foto-perfil-cabecalho');const nome=document.getElementById('nome-perfil-cabecalho');if(!foto||!nome)return;try{const r=typeof window.fetchApi==='function'?await window.fetchApi('/perfil'):await fetch('/perfil',{credentials:'include'});if(!r.ok)return;const d=await r.json();const p=d?.perfil;if(!p)return;nome.textContent=p.nome_exibicao||p.nome||'Meu perfil';if(p.foto_perfil_url)foto.src=p.foto_perfil_url;}catch(e){}}
    function iniciar() {
        if (iniciado || !document.body || !paginasDaConta.has(paginaAtual())) return;
        iniciado = true;
        document.body.classList.add('gbm-interna', 'gbm-app-shell');
        css();
        montar();
        aplicarEstadoAtivo();
        ligar();
        atualizarPerfil();
    }

    function aplicarEstadoAtivo() {
        const atual = paginaAtual() === 'pagamento.html' ? 'assinatura.html' : paginaAtual();
        document.querySelectorAll('#sidebar-menu [data-menu-page]').forEach((item) => {
            const ativo = item.getAttribute('data-menu-page') === atual;
            item.classList.toggle('menu-item-ativo', ativo);
            if (ativo) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });
    }

    window.GBMAppShell = { iniciar, abrir, fechar };
    // As páginas antigas chamam estes nomes em ações de recursos Premium.
    window.abrirMenuLateral = abrir;
    window.fecharMenuLateral = fechar;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    else iniciar();
})();
