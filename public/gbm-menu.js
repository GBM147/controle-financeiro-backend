(function () {
    'use strict';

    const paginasPublicas = new Set(['index.html','login.html','termos.html','privacidade.html','politica-de-privacidade.html','sobre.html','fale-conosco.html','offline.html','pagamento.html','assinatura.html']);
    const atual = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (paginasPublicas.has(atual) || document.documentElement.dataset.gbmMenuInicializado === 'true') return;
    document.documentElement.dataset.gbmMenuInicializado = 'true';

    const css = `
        .gbm-menu-container { position: relative; z-index: 1000; }
        .gbm-menu-btn { display:flex; align-items:center; gap:10px; padding:10px 18px; border-radius:10px; cursor:pointer; background:#0f1a2b; border:1px solid rgba(93,138,255,.35); box-shadow:0 4px 14px rgba(0,0,0,.35); transition:transform .3s ease,box-shadow .3s ease,border-color .3s ease; }
        .gbm-menu-btn:hover { transform:scale(1.04); border-color:rgba(148,163,184,.7); box-shadow:0 6px 18px rgba(0,0,0,.4); background:#162338 !important; }
        .gbm-menu-logo { height:40px !important; width:auto !important; border-radius:4px; }
        .hamburger-icon { display:inline-flex; width:22px; flex-direction:column; gap:4px; }
        .hamburger-icon span { display:block; width:100%; height:2px; border-radius:2px; background:#d1d5db; }
        .menu-overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,.35); backdrop-filter:blur(8px); z-index:9998; }
        .menu-overlay.aberto { display:block; }
        .sidebar-menu { position:fixed; top:0; right:-320px; width:300px; height:100vh; background:rgba(15,23,42,.55); backdrop-filter:blur(20px) saturate(140%); -webkit-backdrop-filter:blur(20px) saturate(140%); border-left:1px solid rgba(148,163,184,.28); box-shadow:-10px 0 30px rgba(0,0,0,.8); z-index:9999; transition:right .4s cubic-bezier(.25,.8,.25,1); display:flex; flex-direction:column; border-bottom:1px solid rgba(255,255,255,.08); }
        .sidebar-menu.aberto { right:0; }
        .sidebar-header { display:flex; justify-content:space-between; align-items:center; padding:20px 25px; border-bottom:1px solid var(--borda,rgba(255,255,255,.15)); }
        .sidebar-logo { height:45px; border-radius:8px; }
        .fechar-btn { background:transparent; border:none; color:var(--texto-mutado,#b0bec5); font-size:32px; cursor:pointer; transition:.2s; }
        .fechar-btn:hover { color:#ff4d4d; transform:scale(1.1); }
        .sidebar-content { padding:12px 0; display:flex; flex-direction:column; gap:0; flex:1; overflow-y:auto; }
        .sidebar-content::-webkit-scrollbar { width:6px; }
        .sidebar-content::-webkit-scrollbar-thumb { background:rgba(148,163,184,.35); border-radius:10px; }
        .sidebar-content .menu-item { font-family:'Inter','Montserrat',sans-serif; font-weight:600; font-size:1rem; text-transform:none; letter-spacing:normal; padding:13px 28px; border-left:4px solid transparent; color:#e5e7eb !important; text-shadow:none; text-decoration:none !important; background:transparent !important; display:block; transition:all .2s ease; }
        .sidebar-content .menu-item:hover { background:rgba(255,255,255,.06) !important; border-left-color:#64748b; color:#fff !important; }
        .menu-grupo { display:flex; flex-direction:column; gap:2px; padding-bottom:7px; }
        .menu-grupo + .menu-grupo { margin-top:4px; }
        .menu-grupo-titulo { margin:0; padding:9px 28px 5px; color:#7f91a8; font-family:'Inter','Montserrat',sans-serif; font-size:.72rem; font-weight:700; letter-spacing:.04em; line-height:1.25; text-transform:none; }
        .menu-grupo-premium { padding-top:5px; border-top:1px solid rgba(255,255,255,.08); }
        .menu-grupo-premium .menu-grupo-titulo { color:#9dcbff; }
        .menu-grupo-conta { margin-top:auto !important; padding-top:8px; padding-bottom:0; border-top:1px solid var(--borda,rgba(255,255,255,.15)); }
        .menu-grupo-conta .menu-grupo-titulo { color:#9fb2c8; }
        .menu-item-com-indicador { display:flex !important; align-items:center; justify-content:space-between; gap:10px; }
        .menu-item-com-indicador .menu-item-conteudo { display:inline-flex; align-items:center; min-width:0; }
        .menu-item-com-indicador .menu-item-indicadores { display:inline-flex; align-items:center; gap:6px; flex-shrink:0; }
        .cadeado-premium { display:none; align-items:center; justify-content:center; min-height:26px; padding:3px 8px; border:1px solid rgba(85,167,255,.5); border-radius:999px; background:rgba(85,167,255,.12); color:#9dcbff; font-size:.66rem; font-weight:700; }
        .aviso-recursos-premium { display:none; margin:-2px 22px 10px 28px; padding:9px 11px; border:1px solid rgba(85,167,255,.35); border-radius:8px; background:rgba(85,167,255,.08); color:#b7d8f6; font:.72rem 'Inter','Montserrat',sans-serif; line-height:1.4; }
        .menu-item-premium.recurso-bloqueado { opacity:.72; }
        .menu-item-premium.recurso-bloqueado:hover { border-left-color:#55a7ff !important; color:#9dcbff !important; background:rgba(85,167,255,.08) !important; }
        .divisor { height:1px; background:var(--borda,rgba(255,255,255,.15)); margin:15px 30px; }
        .texto-vermelho { color:#ff4d4d !important; }
        .texto-vermelho:hover { border-left-color:#ff4d4d !important; background:rgba(255,77,77,.1) !important; }
        body.gbm-menu-aberto { overflow:hidden; }
        body.gbm-interna .top-actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:nowrap; }
        @media (max-width:768px) { .gbm-menu-btn { min-height:36px; padding:8px 12px; } .sidebar-menu { width:min(300px,92vw); } body.gbm-interna .top-actions { gap:6px; } }
    `;

    const style = document.createElement('style');
    style.id = 'gbm-dashboard-menu-style';
    style.textContent = css;
    document.head.appendChild(style);

    const topActions = document.querySelector('.top-actions');
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'gbm-menu-btn';
    botao.setAttribute('aria-label','Abrir menu');
    botao.setAttribute('aria-expanded','false');
    botao.innerHTML = '<span class="hamburger-icon" aria-hidden="true"><span></span><span></span><span></span></span>';
    (topActions || document.body).appendChild(botao);

    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';

    const menu = document.createElement('aside');
    menu.className = 'sidebar-menu';
    menu.setAttribute('aria-label','Menu principal');
    menu.innerHTML = `
        <div class="sidebar-header">
            <a href="dashboard.html" aria-label="Ir para o Dashboard"><img class="sidebar-logo" src="logo-transparente.jpg" alt="Logo GBM"></a>
            <button class="fechar-btn" type="button" aria-label="Fechar menu">×</button>
        </div>
        <div class="sidebar-content">
            <div class="menu-grupo">
                <p class="menu-grupo-titulo">Resumo</p>
                <a class="menu-item" href="dashboard.html">Visão geral</a>
            </div>
            <div class="menu-grupo">
                <p class="menu-grupo-titulo">Movimentações</p>
                <a class="menu-item" href="contas.html">Minhas contas</a>
                <a class="menu-item" href="importacoes.html">Importações</a>
            </div>
            <div class="menu-grupo">
                <p class="menu-grupo-titulo">Planejamento</p>
                <a class="menu-item" href="calendario.html">Calendário</a>
                <a class="menu-item" href="limite-gastos.html">Limite de gastos</a>
                <a class="menu-item" href="metas.html">Objetivos de poupança</a>
            </div>
            <div class="menu-grupo">
                <p class="menu-grupo-titulo">Análises</p>
                <a class="menu-item" href="relatorio.html">Relatório mensal</a>
                <a class="menu-item" href="comparativo.html">Comparativo mensal</a>
            </div>
            <div class="divisor"></div>
            <div class="menu-grupo menu-grupo-conta">
                <p class="menu-grupo-titulo">Conta</p>
                <a class="menu-item" href="notificacoes.html">Notificações</a>
                <a class="menu-item" href="configuracoes.html">Configurações</a>
                <a class="menu-item" href="perfil.html">Perfil</a>
                <button class="menu-item texto-vermelho" id="gbm-menu-sair" type="button">Sair</button>
            </div>
        </div>`;

    document.body.append(overlay, menu);

    const abrir = () => { menu.classList.add('aberto'); overlay.classList.add('aberto'); document.body.classList.add('gbm-menu-aberto'); botao.setAttribute('aria-expanded','true'); };
    const fechar = () => { menu.classList.remove('aberto'); overlay.classList.remove('aberto'); document.body.classList.remove('gbm-menu-aberto'); botao.setAttribute('aria-expanded','false'); };
    botao.addEventListener('click', () => menu.classList.contains('aberto') ? fechar() : abrir());
    overlay.addEventListener('click', fechar);
    menu.querySelector('.fechar-btn').addEventListener('click', fechar);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') fechar(); });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', fechar));
    menu.querySelector('#gbm-menu-sair').addEventListener('click', async () => {
        fechar();
        if (typeof encerrarSessao === 'function') return encerrarSessao();
        try { await fetch('/logout', { method:'POST', credentials:'include' }); } catch (_) {}
        window.location.replace('index.html');
    });
})();
