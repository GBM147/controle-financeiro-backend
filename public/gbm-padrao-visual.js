(function () {
    'use strict';

    const NOME_ARQUIVO = (window.location.pathname.split('/').pop() || '').toLowerCase();

    function injetarEstilos() {
        if (document.getElementById('gbm-padrao-visual-style')) return;

        const style = document.createElement('style');
        style.id = 'gbm-padrao-visual-style';
        style.textContent = `
            body.gbm-interna .gbm-padrao-topbar{position:sticky;top:0;z-index:10000;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:56px;padding:0 20px;border-bottom:1px solid rgba(255,255,255,.11);background:rgba(15,23,42,.34);box-shadow:0 8px 28px rgba(0,0,0,.12);backdrop-filter:blur(12px);box-sizing:border-box}
            body.gbm-interna .gbm-padrao-brand{display:inline-flex;align-items:center;gap:15px;min-width:0;align-self:stretch;color:#eef6ff;text-decoration:none;font-family:Sora,Inter,sans-serif;font-weight:700}
            body.gbm-interna .gbm-padrao-brand img{width:auto;height:70px;flex:0 0 auto;border-radius:10px;object-fit:contain}
            body.gbm-interna .gbm-padrao-brand span{overflow:hidden;max-width:55vw;background:linear-gradient(90deg,#2e8b57 0%,#5fffa8 25%,#3d28ff 50%,#655aff 75%,#2e8b57 100%);background-size:200% auto;background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:transparent;font-size:clamp(1rem,2vw,1.62rem);letter-spacing:2px;line-height:1;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap;animation:gbm-padrao-shine 4s linear infinite}
            @keyframes gbm-padrao-shine{from{background-position:0 center}to{background-position:200% center}}
            body.gbm-interna .gbm-padrao-top-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
            body.gbm-interna .gbm-padrao-voltar{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 15px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:#0f1a2b;color:#eef6ff;text-decoration:none;font-family:Sora,Inter,sans-serif;font-size:.75rem;font-weight:700;letter-spacing:.25px;box-shadow:0 4px 14px rgba(0,0,0,.25);transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
            body.gbm-interna .gbm-padrao-voltar:hover{transform:translateY(-1px);border-color:rgba(85,167,255,.58);box-shadow:0 8px 22px rgba(0,0,0,.3)}
            body.gbm-interna .gbm-padrao-atalho{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 12px;border:1px solid rgba(85,167,255,.25);border-radius:10px;background:rgba(85,167,255,.08);color:#bfe0ff;text-decoration:none;font-family:Sora,Inter,sans-serif;font-size:.75rem;font-weight:700;transition:transform .2s ease,border-color .2s ease,background .2s ease}
            body.gbm-interna .gbm-padrao-atalho:hover{transform:translateY(-1px);border-color:rgba(85,167,255,.58);background:rgba(85,167,255,.13)}
            @media(max-width:760px){body.gbm-interna .gbm-padrao-topbar{min-height:58px;padding:0 12px}body.gbm-interna .gbm-padrao-brand{gap:8px}body.gbm-interna .gbm-padrao-brand img{height:58px}body.gbm-interna .gbm-padrao-brand span{max-width:42vw;font-size:1rem;letter-spacing:1.2px}body.gbm-interna .gbm-padrao-top-actions{flex-wrap:nowrap}body.gbm-interna .gbm-padrao-voltar,body.gbm-interna .gbm-padrao-atalho{min-height:34px;padding:6px 9px;font-size:.72rem}}
            @media(max-width:430px){body.gbm-interna .gbm-padrao-brand span{max-width:88px}body.gbm-interna .gbm-padrao-atalho{display:none}}
        `;
        document.head.appendChild(style);
    }

    function criarCabecalho() {
        if (document.querySelector('body.gbm-interna > .topbar')) return;

        const antigo = document.querySelector('body.gbm-interna > .gbm-header');
        if (antigo) antigo.remove();

        const cabecalho = document.createElement('header');
        cabecalho.className = 'gbm-padrao-topbar';

        const marca = document.createElement('a');
        marca.className = 'gbm-padrao-brand';
        marca.href = 'dashboard.html';
        marca.setAttribute('aria-label', 'Ir para o Dashboard');
        marca.innerHTML = '<img src="logo-transparente.jpg" alt="GBM"><span>Guardian of Budget &amp; Money</span>';

        const acoes = document.createElement('div');
        acoes.className = 'gbm-padrao-top-actions';

        if (NOME_ARQUIVO === 'contas.html') {
            const importar = document.createElement('a');
            importar.className = 'gbm-padrao-atalho';
            importar.href = 'importacoes.html';
            importar.textContent = 'Importar extrato';
            acoes.appendChild(importar);
        } else if (NOME_ARQUIVO === 'metas.html') {
            const limites = document.createElement('a');
            limites.className = 'gbm-padrao-atalho';
            limites.href = 'limite-de-gastos.html';
            limites.textContent = 'Limites';
            acoes.appendChild(limites);
        }

        const voltar = document.createElement('a');
        voltar.className = 'gbm-padrao-voltar';
        voltar.href = 'dashboard.html';
        voltar.textContent = 'Voltar';
        acoes.appendChild(voltar);

        cabecalho.appendChild(marca);
        cabecalho.appendChild(acoes);

        const main = document.querySelector('body.gbm-interna > main');
        if (main) document.body.insertBefore(cabecalho, main);
        else document.body.prepend(cabecalho);
    }

    function removerRestosDoCabecalhoAntigo() {
        document.querySelector('body.gbm-interna > #menu-overlay')?.remove();
        document.querySelector('body.gbm-interna > #sidebar-menu')?.remove();
    }

    function inicializar() {
        if (NOME_ARQUIVO === 'dashboard.html' || !document.body?.classList.contains('gbm-interna')) return;
        injetarEstilos();
        criarCabecalho();
        removerRestosDoCabecalhoAntigo();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar, { once: true });
    } else {
        inicializar();
    }
})();
