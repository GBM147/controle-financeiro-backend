(function () {
    'use strict';

    if (window.__gbmPadraoVisualInicializado) return;
    window.__gbmPadraoVisualInicializado = true;

    const NOME_ARQUIVO = (window.location.pathname.split('/').pop() || '').toLowerCase();
    const PAGINAS_SEM_CABECALHO_AUTOMATICO = new Set([
        'importacoes.html',
        'relatorio.html',
        'comparativo.html'
    ]);

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
            body.gbm-interna.gbm-relatorio-padrao,body.gbm-interna.gbm-comparativo-padrao{background-color:#07111f !important;background-image:linear-gradient(rgba(15,23,42,.85),rgba(15,23,42,.9)),url('fundo-marmore.jpg') !important;background-position:center !important;background-size:cover !important;background-attachment:fixed !important}
            #gbm-tour-ajuda.gbm-dashboard-ajuda-fallback{position:fixed;right:20px;bottom:20px;z-index:9000;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:10px 15px;border:1px solid rgba(80,227,170,.65);border-radius:999px;background:#0d1b2d;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.38);font:800 .84rem Inter,Arial,sans-serif;cursor:pointer}
            body:has(.sidebar-menu.aberto) #gbm-tour-ajuda{display:none !important}
            @media(max-width:760px){body.gbm-interna .gbm-padrao-topbar{min-height:58px;padding:0 12px}body.gbm-interna .gbm-padrao-brand{gap:8px}body.gbm-interna .gbm-padrao-brand img{height:58px}body.gbm-interna .gbm-padrao-brand span{max-width:42vw;font-size:1rem;letter-spacing:1.2px}body.gbm-interna .gbm-padrao-top-actions{flex-wrap:nowrap}body.gbm-interna .gbm-padrao-voltar,body.gbm-interna .gbm-padrao-atalho{min-height:34px;padding:6px 9px;font-size:.72rem}#gbm-tour-ajuda.gbm-dashboard-ajuda-fallback{right:12px;bottom:12px;width:46px;height:46px;justify-content:center;padding:0}#gbm-tour-ajuda.gbm-dashboard-ajuda-fallback .texto{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}
            @media(max-width:430px){body.gbm-interna .gbm-padrao-brand span{max-width:88px}body.gbm-interna .gbm-padrao-atalho{display:none}}
        `;
        document.head.appendChild(style);

        if (NOME_ARQUIVO === 'dashboard.html') {
            const dashboardStyle = document.createElement('style');
            dashboardStyle.id = 'gbm-dashboard-padrao-style';
            dashboardStyle.textContent = `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Sora:wght@600;700&display=swap");

        /* === GBM design tokens (regua visual unica) === */
        :root {
            --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
            --space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px;
            --radius-sm: 8px; --radius-md: 10px; --radius-lg: 14px; --radius-pill: 999px;
            --shadow-1: 0 1px 2px rgba(0,0,0,.30);
            --shadow-2: 0 8px 24px rgba(0,0,0,.28);
            --fonte-titulo: 'Sora', 'Inter', sans-serif;
            --fonte-texto: 'Inter', system-ui, sans-serif;
        }


:root {
    --bg: #07111f;
    --card: #0f1a2b;
    --card-2: #111f33;
    --text: #eef6ff;
    --muted: #91a4ba;
    --green: #39d98a;
    --green-dark: #258c5b;
    --red: #ff5d6c;
    --amber: #55a7ff;
    --blue: #55a7ff;
    --purple: #55a7ff;
    --border: rgba(85, 167, 255, .2);
    --border-soft: rgba(255, 255, 255, .11);
    --shadow: rgba(0, 0, 0, .5);
    --cor-destaque: #2e8b57;
    --texto-principal: #fff;
    --texto-mutado: #b0bec5;
    --borda: rgba(255, 255, 255, 0.15);
}

* { box-sizing: border-box; }

html { color-scheme: dark; }

body {
    margin: 0;
    min-height: 100vh;
    overflow-x: hidden;
    color: var(--text);
    background-image:
        linear-gradient(rgba(15, 23, 42, .85), rgba(15, 23, 42, .9)),
        url("fundo-marmore.jpg");
    background-position: center;
    background-size: cover;
    background-attachment: fixed;
    font-family: Inter, "Segoe UI", sans-serif;
}

.topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-height: 56px;
    padding: 0 20px;
    border-bottom: 1px solid var(--border-soft);
    background: rgba(15, 23, 42, .34);
    box-shadow: 0 8px 28px rgba(0, 0, 0, .12);
    backdrop-filter: blur(12px);
}

.brand {
    display: inline-flex;
    align-items: center;
    align-self: stretch;
    gap: 15px;
    min-width: 0;
    color: var(--text);
    text-decoration: none;
    font-family: Sora, Inter, sans-serif;
    font-weight: 700;
}

.brand span {
    overflow: hidden;
    background: linear-gradient(
        90deg,
        #2e8b57 0%,
        #5fffa8 25%,
        #3d28ff 50%,
        #655aff 75%,
        #2e8b57 100%
    );
    background-size: 200% auto;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    font-size: clamp(1rem, 2vw, 1.62rem);
    letter-spacing: 2px;
    line-height: 1;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
    animation: gbm-shine 4s linear infinite;
    transition: letter-spacing .25s ease, transform .25s ease;
}

.brand:hover span {
    letter-spacing: 3px;
    transform: scale(1.015);
    animation-duration: 1.8s;
}

.brand:focus-visible {
    border-radius: 10px;
    outline: 2px solid var(--green);
    outline-offset: 4px;
}

@keyframes gbm-shine {
    from { background-position: 0 center; }
    to { background-position: 200% center; }
}

.brand img {
    width: auto;
    height: 70px;
    flex: 0 0 auto;
    border-radius: 10px;
    object-fit: contain;
}

.top-actions { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; }

.container {
    width: min(1320px, calc(100% - 40px));
    margin: 0 auto;
    padding: 30px 0 64px;
}

.page-title { margin-bottom: 22px; }
.page-title h1 {
    margin: 0 0 8px;
    font-family: Sora, Inter, sans-serif;
    font-size: clamp(1.85rem, 4vw, 2.45rem);
    letter-spacing: .2px;
}
.page-title p { margin: 0; color: var(--muted); line-height: 1.55; }

.grid { display: grid; gap: 18px; }
.grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }

.card {
    position: relative;
    overflow: hidden;
    padding: 22px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: rgba(15, 26, 43, .96);
    box-shadow: 0 14px 34px rgba(0, 0, 0, .42), inset 0 1px rgba(255,255,255,.025);
    backdrop-filter: none;
    transition: border-color .22s ease, box-shadow .22s ease, transform .22s ease;
}

.card:not(.objetivo-card)::before {
    position: absolute;
    inset: 0 0 auto;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(85, 167, 255, .4), transparent);
    content: "";
    pointer-events: none;
}

.card:hover {
    border-color: rgba(85, 167, 255, .38);
    box-shadow: 0 17px 38px rgba(0, 0, 0, .46), inset 0 1px rgba(255,255,255,.035);
}

.card h2, .card h3 {
    margin: 0 0 14px;
    font-family: Sora, Inter, sans-serif;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.field { display: flex; flex-direction: column; gap: 7px; }
.field.full { grid-column: 1 / -1; }
.field label {
    color: var(--texto-mutado);
    font-family: Sora, Inter, sans-serif;
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: .3px;
}

input, select, textarea {
    width: 100%;
    min-height: 44px;
    padding: 10px 13px;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 10px;
    outline: none;
    background: rgba(6, 15, 29, .82);
    color: var(--text);
    font: inherit;
    transition: border-color .2s ease, box-shadow .2s ease, background .2s ease;
}
textarea { min-height: 100px; resize: vertical; }
input:focus, select:focus, textarea:focus {
    border-color: #5fffa8;
    background: rgba(6, 15, 29, .96);
    box-shadow: 0 0 0 3px rgba(95, 255, 168, .12);
}
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 40px;
    padding: 9px 15px;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 10px;
    background: #0f1a2b;
    color: var(--text);
    text-decoration: none;
    font-family: Sora, Inter, sans-serif;
    font-weight: 700;
    letter-spacing: .25px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, .25);
    transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease, opacity .2s ease;
}
.btn:hover {
    transform: translateY(-1px);
    border-color: rgba(85, 167, 255, .58);
    box-shadow: 0 8px 22px rgba(0, 0, 0, .3);
}
.btn:focus-visible {
    outline: 2px solid var(--green);
    outline-offset: 3px;
}
.btn:disabled { cursor: wait; opacity: .62; transform: none; }
.btn-primary {
    background: linear-gradient(135deg, #258c5b, #2e9b64);
    border-color: #5fffa8;
}
.btn-danger { background: rgba(255,93,108,.12); border-color: rgba(255,93,108,.5); color: #ff9aa4; }
.btn-purple { background: rgba(85,167,255,.16); border-color: rgba(85,167,255,.48); }
.btn-small { min-height: 32px; padding: 6px 10px; font-size: 0.75rem; }

.actions { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; }
.actions.end { justify-content: flex-end; }
.divider { height: 1px; margin: 20px 0; background: rgba(255,255,255,.1); }

.empty {
    padding: 34px 16px;
    border: 1px dashed rgba(255,255,255,.18);
    border-radius: 14px;
    color: var(--muted);
    text-align: center;
}

.pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 999px;
    background: rgba(255,255,255,.05);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 700;
}
.pill.green { color: #8bffc1; border-color: rgba(57,217,138,.35); }
.pill.red { color: #ff9aa4; border-color: rgba(255,93,108,.35); }
.pill.amber { color: #9dcbff; border-color: rgba(85,167,255,.35); }
.pill.blue { color: #9dcbff; border-color: rgba(85,167,255,.35); }

.progress {
    width: 100%;
    height: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255,255,255,.08);
}
.progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--green-dark), var(--green));
}

.stat { color: var(--muted); font-size: 0.8125rem; }
.stat strong { color: var(--text); font-size: 1.25rem; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td {
    padding: 12px 10px;
    border-bottom: 1px solid rgba(255,255,255,.08);
    text-align: left;
    white-space: nowrap;
}
th { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: .7px; }
td { font-size: 0.875rem; }

.toast {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 100;
    max-width: min(390px, calc(100% - 36px));
    padding: 13px 16px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: rgba(15, 26, 43, .98);
    color: var(--text);
    box-shadow: 0 14px 35px rgba(0,0,0,.4);
    font-weight: 700;
    animation: toast-entrada .22s ease-out;
}
.toast.erro { border-color: rgba(255,93,108,.5); }
.toast.sucesso { border-color: rgba(95,255,168,.5); }

@keyframes toast-entrada {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 760px) {
    .grid-2, .grid-3, .form-grid { grid-template-columns: 1fr; }
    .field.full { grid-column: 1; }
    .grid-3 > * { grid-column: 1 !important; }
    .topbar {
        min-height: 58px;
        padding: 0 12px;
    }
    .brand { gap: 8px; }
    .brand img { height: 58px; }
    .brand span {
        max-width: min(42vw, 170px);
        font-size: 1rem;
        letter-spacing: 1.2px;
    }
    .top-actions {
        flex-wrap: nowrap;
        justify-content: flex-end;
    }
    .top-actions .btn {
        min-height: 34px;
        padding: 6px 9px;
        font-size: 0.75rem;
    }
    .container { width: min(100% - 24px, 1320px); }
    .container { padding-top: 24px; }
    .card { padding: 18px; }
    .actions.end > .btn { width: 100%; }
    .toast {
        right: 12px;
        bottom: 12px;
        max-width: calc(100% - 24px);
    }
}

@media (max-width: 430px) {
    .brand span { max-width: 88px; }
    .top-actions .btn:not(:last-child) { display: none; }
}

/* Padronização visual exclusiva das páginas internas autenticadas. */
body.gbm-interna {
    --text: #fff;
    --texto: #fff;
    --muted: #b0bec5;
    --mutado: #b0bec5;
    --texto-mutado: #b0bec5;
    color: #fff;
    background-image:
        linear-gradient(rgba(15, 23, 42, .85), rgba(15, 23, 42, .9)),
        url("fundo-marmore.jpg");
    background-position: center;
    background-size: cover;
    background-attachment: fixed;
}

body.gbm-interna > header,
body.gbm-interna > main,
body.gbm-interna > .container,
body.gbm-interna > .page-wrapper {
    position: relative;
    z-index: 1;
}

body.gbm-interna #particles-canvas {
    position: fixed;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

body.gbm-interna .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    height: 56px;
    min-height: 56px;
    padding: 0 20px;
    border-bottom: 1px solid rgba(255, 255, 255, .15);
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
}

body.gbm-interna .brand {
    gap: 15px;
}

body.gbm-interna .brand img {
    width: auto;
    height: 50px;
    border-radius: 10px;
    animation: gbm-interna-float 4s ease-in-out infinite;
}

body.gbm-interna .brand span {
    max-width: none;
    font-family: Sora, Inter, sans-serif;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 2px;
    background: linear-gradient(
        90deg,
        #2e8b57 0%,
        #5fffa8 25%,
        #3d28ff 50%,
        #655aff 75%,
        #2e8b57 100%
    );
    background-size: 200% auto;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: gbm-shine 4s linear infinite;
}

@keyframes gbm-interna-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}

body.gbm-interna :is(.card, .cartao, .zona-perigo, .perfil-card, .contato-card) {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(85, 167, 255, .2);
    border-radius: 14px;
    background: rgba(15, 26, 43, .96);
    box-shadow:
        0 14px 34px rgba(0, 0, 0, .42),
        inset 0 1px rgba(255, 255, 255, .025);
    backdrop-filter: none;
    transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease;
}
.gbm-header {
  background: transparent;
  border-bottom: 1px solid var(--borda);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.gbm-logo-container { display: flex; align-items: center; gap: 15px; }

.gbm-logo-img { height: 70px !important; width: auto !important; border-radius: 10px; }

.gbm-title {
    font-family: 'Sora', sans-serif;
    font-size: 26px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0;
    cursor: default;

    /* Gradiente animado verde e azul */
    background: linear-gradient(
        90deg,
        #2E8B57 0%,
        #5fffa8 25%,
        #3d28ff 50%,
        #655aff 75%,
        #2E8B57 100%
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: gbm-shine 4s linear infinite;
    transition: letter-spacing 0.3s ease, transform 0.3s ease;
    text-shadow: none !important;
}

.gbm-title:hover {
    letter-spacing: 4px;
    transform: scale(1.03);
    animation-duration: 1.5s; /* acelera o brilho no hover */
}

.gbm-header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }

.atalho-perfil {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 44px;
            padding: 4px 10px 4px 4px;
            border: 1px solid rgba(95, 255, 168, 0.35);
            border-radius: 999px;
            background: rgba(15, 26, 43, 0.78);
            color: var(--texto-principal);
            text-decoration: none;
            transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

.atalho-perfil:hover {
            transform: translateY(-1px);
            border-color: var(--cor-destaque);
            box-shadow: 0 0 14px rgba(95, 255, 168, 0.25);
        }

.avatar-perfil-cabecalho {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            object-fit: cover;
            border: 1px solid var(--cor-destaque);
            background: #101b2c;
        }

.nome-perfil-cabecalho {
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 0.875rem;
            font-weight: 700;
        }

.gbm-menu-container { position: relative; z-index: 1000; }

.gbm-menu-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;

  background: #0f1a2b;
  border: 1px solid rgba(93, 138, 255, 0.35);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.gbm-menu-btn:hover {
  transform: scale(1.04);
  border-color: rgba(148, 163, 184, 0.7);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

.gbm-menu-btn:hover { background: #162338 !important; }

.gbm-menu-logo { height: 40px !important; width: auto !important; border-radius: 8px; }

.hamburger-icon {
            display: inline-flex;
            width: 22px;
            flex-direction: column;
            gap: 4px;
        }

.hamburger-icon span {
            display: block;
            width: 100%;
            height: 2px;
            border-radius: 8px;
            background: #d1d5db;
        }

.menu-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px); /* Desfoca o site atrás do menu */
            z-index: 9998;
            background: rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(8px);
        }

.sidebar-menu {
            position: fixed;
            top: 0;
            right: -320px; /* Começa escondido fora da tela à direita */
            width: 300px;
            height: 100vh;
            background: rgba(15, 23, 42, 0.55);
            backdrop-filter: blur(20px) saturate(140%);
            border-left: 1px solid var(--borda);
            box-shadow: -10px 0 40px rgba(0,0,0,0.6);

            border-left: 1px solid rgba(148, 163, 184, 0.28);
            box-shadow: -10px 0 30px rgba(0,0,0,0.8);
            z-index: 9999;
            transition: right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); /* Deslize ultra suave */
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid rgba(255,255,255,0.08);

        }

.sidebar-menu.aberto { right: 0; }

.sidebar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            border-bottom: 1px solid var(--borda);
        }

.sidebar-logo { height: 45px; border-radius: 10px; }

.fechar-btn {
            background: transparent;
            border: none;
            color: var(--texto-mutado);
            font-size: 32px;
            cursor: pointer;
            transition: 0.2s;
        }

.fechar-btn:hover { color: #ff4d4d; transform: scale(1.1); }

.sidebar-content {
            padding: 12px 0;
            display: flex;
            flex-direction: column;
            gap: 0;
            flex: 1; 
            overflow-y: auto; /* Faz o menu ter a sua própria barra de rolagem */
        }

.sidebar-content::-webkit-scrollbar {
            width: 6px;
        }

.sidebar-content::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.35);
            border-radius: 10px;
        }

.sidebar-content .menu-item {
            font-family: 'Inter', 'Montserrat', sans-serif;
            font-weight: 600;
            font-size: 1rem;
            text-transform: none;
            letter-spacing: normal;
            padding: 13px 28px;
            border-left: 4px solid transparent;
            color: #e5e7eb !important;
            text-shadow: none;
            text-decoration: none !important;
            background: transparent !important;
            display: block;
            transition: all 0.2s ease;
        }

.menu-grupo {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding-bottom: 7px;
        }

.menu-grupo + .menu-grupo {
            margin-top: 4px;
        }

.menu-grupo-titulo {
            margin: 0;
            padding: 9px 28px 5px;
            color: #7f91a8;
            font-family: 'Inter', 'Montserrat', sans-serif;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: .04em;
            line-height: 1.25;
            text-transform: none;
        }

.menu-grupo-premium {
            padding-top: 5px;
            border-top: 1px solid rgba(255, 255, 255, .08);
        }

.menu-grupo-premium .menu-grupo-titulo {
            color: #9dcbff;
        }

.menu-grupo-conta {
            margin-top: auto !important;
            padding-top: 8px;
            padding-bottom: 0;
            border-top: 1px solid var(--borda);
        }

.menu-grupo-conta .menu-grupo-titulo {
            color: #9fb2c8;
        }

.sidebar-content .menu-item:hover {
            background: rgba(255, 255, 255, 0.06) !important;
            border-left-color: #64748b;
            color: #fff !important;
        }

.menu-item-com-indicador {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

.menu-item-com-indicador .menu-item-conteudo {
            display: inline-flex;
            align-items: center;
            min-width: 0;
        }

.menu-item-com-indicador .menu-item-indicadores {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }

.cadeado-premium {
            display: none;
            align-items: center;
            justify-content: center;
            min-height: 26px;
            padding: 3px 8px;
            border: 1px solid rgba(85, 167, 255, 0.5);
            border-radius: 999px;
            background: rgba(85, 167, 255, 0.12);
            color: #9dcbff;
            font-size: 0.75rem;
            font-weight: 700;
            text-shadow: none;
        }

.menu-item-premium.recurso-bloqueado {
            opacity: 0.72;
        }

.menu-item-premium.recurso-bloqueado:hover {
            border-left-color: #55a7ff !important;
            color: #9dcbff !important;
            background: rgba(85, 167, 255, 0.08) !important;
        }

.gbm-header, .grid-cards, .lancamento-rapido, .linha-paineis,
.painel-ajustes, .chart-container, .card { position: relative; z-index: 1; }

.gbm-logo-img {
    animation: float-logo 4s ease-in-out infinite;
}

@media (max-width: 768px) {
.gbm-header {
                padding: 10px 15px;
            }

.gbm-title {
                display: none;
            }

.gbm-logo-img {
                height: 40px !important;
            }
}

.gbm-header {
            min-height: 74px;
            height: 74px;
            padding: 0 34px;
            background: rgba(7,17,31,.3);
            border-bottom-color: rgba(255,255,255,.12);
            backdrop-filter: blur(9px);
        }

.atalho-perfil,
        .gbm-menu-btn {
            min-height: 40px;
            padding: 0;
            border: 0 !important;
            border-radius: 0;
            background: transparent !important;
            box-shadow: none !important;
        }

.atalho-perfil { gap: 10px; }

.atalho-perfil:hover,
        .gbm-menu-btn:hover {
            border: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            color: #5fffa8;
            transform: none;
        }

.gbm-menu-btn { width: 34px; justify-content: center; }

.hamburger-icon { width: 27px; gap: 5px; }

.hamburger-icon span { background: currentColor; }

.avatar-perfil-cabecalho { width: 37px; height: 37px; }

.sidebar-menu { background: rgba(7,17,31,.94); border-left-color: rgba(85,167,255,.2); }

.menu-grupo-premium .menu-grupo-titulo,
        .cadeado-premium { color: #9dcbff; }

.cadeado-premium { border-color: rgba(85,167,255,.45); background: rgba(85,167,255,.12); }

.menu-item-premium.recurso-bloqueado:hover { border-left-color: #55a7ff !important; color: #9dcbff !important; background: rgba(85,167,255,.08) !important; }

@media (max-width: 768px) {
.gbm-header { min-height: 62px; height: 62px; padding: 0 15px; }

.nome-perfil-cabecalho { display: none; }
}

.sidebar-menu{
            position:fixed !important;
            top:0 !important;
            right:-278px;
            bottom:0 !important;
            width:258px;
            height:100dvh !important;
            max-height:100dvh !important;
            z-index:9999 !important;
            background:#091a2a !important;
            border-left:1px solid rgba(85,167,255,.18) !important;
            box-shadow:-14px 0 34px rgba(0,0,0,.5) !important;
            transform:translateZ(0);
            will-change:right;
            overflow:hidden;
        }

.sidebar-menu.aberto{right:0 !important;}

.menu-overlay{
            position:fixed !important;
            inset:0 !important;
            z-index:9998 !important;
        }

.sidebar-brand-text strong{
            background:linear-gradient(90deg,#2E8B57 0%,#5fffa8 25%,#3d28ff 50%,#655aff 75%,#2E8B57 100%);
            background-size:200% auto;
            -webkit-background-clip:text;
            background-clip:text;
            -webkit-text-fill-color:transparent;
            color:transparent;
            animation:gbm-shine 4s linear infinite;
        }

.menu-item-ativo{
            background:linear-gradient(90deg,rgba(46,139,87,.18),rgba(61,40,255,.10)) !important;
            border-left-color:#39d98a !important;
        }

.menu-item-ativo .menu-item-icone,
        .menu-item-ativo-indicador{
            background:linear-gradient(180deg,#5fffa8 0%,#3d28ff 100%);
        }

.menu-item-ativo .menu-item-icone{
            -webkit-background-clip:text;
            background-clip:text;
            -webkit-text-fill-color:transparent;
            color:transparent;
        }

.menu-item-ativo-indicador{
            box-shadow:0 0 10px rgba(95,255,168,.28),0 0 8px rgba(61,40,255,.22);
        }

.hamburger-icon span{background:linear-gradient(90deg,#5fffa8,#3d28ff) !important;}

.sidebar-menu{
            width:258px;
            right:-278px;
            background:#091a2a !important;
            border-left:1px solid rgba(85,167,255,.18) !important;
            box-shadow:-14px 0 34px rgba(0,0,0,.5) !important;
        }

.sidebar-menu.aberto{right:0;}

.sidebar-header{
            min-height:78px;
            box-sizing:border-box;
            padding:15px 14px 14px 16px;
            border-bottom:1px solid rgba(255,255,255,.08);
        }

.sidebar-brand{display:flex;align-items:center;gap:9px;min-width:0;}

.sidebar-logo{width:28px;height:28px;object-fit:contain;border-radius:10px;flex:0 0 auto;}

.sidebar-brand-text{display:flex;flex-direction:column;min-width:0;line-height:1.05;}

.sidebar-brand-text strong{color:#edf5ff;font:700 .79rem 'Inter',sans-serif;letter-spacing:-.01em;}

.sidebar-brand-text span{margin-top:3px;color:#718198;font:500 .56rem 'Inter',sans-serif;}

.fechar-btn{width:30px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0 !important;color:#d9e7f5 !important;font-size:25px !important;background:transparent !important;}
        /* ===== DASHBOARD: mesma régua visual da Central de Importações ===== */
        body.gbm-interna.gbm-dashboard-padrao {
            --dash-bg: #07111f;
            --dash-card: rgba(15, 26, 43, .96);
            --dash-card-2: #111f33;
            --dash-text: #eef6ff;
            --dash-muted: #91a4ba;
            --dash-green: #39d98a;
            --dash-blue: #55a7ff;
            --dash-red: #ff5d6c;
            min-height:100vh;
            color:var(--dash-text);
            background-image:
                linear-gradient(rgba(15,23,42,.85),rgba(15,23,42,.9)),
                url("fundo-marmore.jpg") !important;
            background-position:center !important;
            background-size:cover !important;
            background-attachment:fixed !important;
            font-family:Inter,"Segoe UI",sans-serif !important;
        }

        body.gbm-interna.gbm-dashboard-padrao > *:not(#particles-canvas){
            position:relative;
            z-index:1;
        }

        body.gbm-interna.gbm-dashboard-padrao #particles-canvas{
            position:fixed !important;
            inset:0 !important;
            width:100% !important;
            height:100% !important;
            z-index:0 !important;
            pointer-events:none !important;
            opacity:.2 !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .gbm-header{
            position:sticky !important;
            top:0 !important;
            z-index:10000 !important;
            display:flex !important;
            align-items:center !important;
            justify-content:space-between !important;
            gap:14px !important;
            min-height:74px !important;
            height:74px !important;
            padding:0 34px !important;
            background:rgba(7,17,31,.30) !important;
            border-bottom:1px solid rgba(255,255,255,.12) !important;
            box-shadow:none !important;
            backdrop-filter:blur(9px) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .gbm-logo-container{
            display:flex !important;
            align-items:center !important;
            gap:15px !important;
            min-width:0;
        }

        body.gbm-interna.gbm-dashboard-padrao .gbm-logo-img{
            width:auto !important;
            height:70px !important;
            border-radius:10px !important;
            object-fit:contain !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .gbm-title{
            margin:0 !important;
            overflow:hidden;
            max-width:60vw;
            font-family:Sora,Inter,sans-serif !important;
            font-size:26px !important;
            font-weight:700 !important;
            letter-spacing:2px !important;
            line-height:1 !important;
            text-transform:uppercase !important;
            white-space:nowrap !important;
            text-overflow:ellipsis;
            background:linear-gradient(90deg,#2e8b57 0%,#5fffa8 25%,#3d28ff 50%,#655aff 75%,#2e8b57 100%) !important;
            background-size:200% auto !important;
            background-clip:text !important;
            -webkit-background-clip:text !important;
            -webkit-text-fill-color:transparent !important;
            color:transparent !important;
            animation:gbm-shine 4s linear infinite !important;
            text-shadow:none !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .gbm-header-actions{
            display:flex !important;
            align-items:center !important;
            gap:10px !important;
            flex-shrink:0;
        }

        body.gbm-interna.gbm-dashboard-padrao .atalho-perfil{
            display:inline-flex !important;
            align-items:center !important;
            gap:10px !important;
            min-height:40px !important;
            padding:0 !important;
            border:0 !important;
            border-radius:0 !important;
            background:transparent !important;
            box-shadow:none !important;
            color:#eef6ff !important;
            text-decoration:none !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .atalho-perfil:hover{
            border:0 !important;
            background:transparent !important;
            box-shadow:none !important;
            transform:none !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .avatar-perfil-cabecalho{
            width:37px !important;
            height:37px !important;
            border-radius:50% !important;
            object-fit:cover !important;
            border:1px solid rgba(57,217,138,.55) !important;
            background:#101b2c !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .nome-perfil-cabecalho{
            max-width:150px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            color:#eef6ff !important;
            font-size:.82rem;
            font-weight:700;
        }

        body.gbm-interna.gbm-dashboard-padrao .gbm-menu-btn{
            width:34px !important;
            min-height:40px !important;
            height:40px !important;
            display:inline-flex !important;
            align-items:center !important;
            justify-content:center !important;
            padding:0 !important;
            border:0 !important;
            border-radius:0 !important;
            background:transparent !important;
            box-shadow:none !important;
            color:#dce6f0 !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .gbm-menu-btn:hover{
            border:0 !important;
            background:transparent !important;
            box-shadow:none !important;
            transform:none !important;
            color:#5fffa8 !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .hamburger-icon{
            width:27px !important;
            gap:5px !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .hamburger-icon span{
            height:2px !important;
            background:linear-gradient(90deg,#5fffa8,#3d28ff) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-overlay{
            position:fixed !important;
            inset:0 !important;
            z-index:9998 !important;
            display:none;
            background:rgba(0,0,0,.35) !important;
            backdrop-filter:blur(8px) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .sidebar-menu{
            position:fixed !important;
            top:0 !important;
            right:-278px !important;
            bottom:0 !important;
            width:258px !important;
            height:100dvh !important;
            max-height:100dvh !important;
            z-index:9999 !important;
            display:flex !important;
            flex-direction:column !important;
            overflow:hidden !important;
            background:#091a2a !important;
            border-left:1px solid rgba(85,167,255,.18) !important;
            box-shadow:-14px 0 34px rgba(0,0,0,.5) !important;
            transition:right .35s cubic-bezier(.25,.8,.25,1) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .sidebar-menu.aberto{right:0 !important}

        body.gbm-interna.gbm-dashboard-padrao .sidebar-header{
            display:flex !important;
            align-items:center !important;
            justify-content:space-between !important;
            min-height:78px !important;
            padding:15px 14px 14px 16px !important;
            border-bottom:1px solid rgba(255,255,255,.08) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .sidebar-brand{
            display:flex !important;
            align-items:center !important;
            gap:9px !important;
            min-width:0;
        }

        body.gbm-interna.gbm-dashboard-padrao .sidebar-logo{
            width:28px !important;
            height:28px !important;
            border-radius:10px !important;
            object-fit:contain !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .sidebar-brand-text{
            display:flex !important;
            flex-direction:column !important;
            min-width:0;
            line-height:1.05;
        }

        body.gbm-interna.gbm-dashboard-padrao .sidebar-brand-text strong{
            overflow:hidden;
            max-width:165px;
            color:#edf5ff !important;
            font:700 .79rem Inter,sans-serif !important;
            letter-spacing:-.01em;
            white-space:nowrap;
            text-overflow:ellipsis;
            background:linear-gradient(90deg,#2e8b57 0%,#5fffa8 25%,#3d28ff 50%,#655aff 75%,#2e8b57 100%);
            background-size:200% auto;
            -webkit-background-clip:text;
            background-clip:text;
            -webkit-text-fill-color:transparent;
            color:transparent !important;
            animation:gbm-shine 4s linear infinite;
        }

        body.gbm-interna.gbm-dashboard-padrao .sidebar-brand-text span{
            margin-top:3px;
            color:#718198 !important;
            font:500 .56rem Inter,sans-serif !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .fechar-btn{
            width:30px !important;
            height:30px !important;
            padding:0 !important;
            display:inline-flex !important;
            align-items:center !important;
            justify-content:center !important;
            border:0 !important;
            background:transparent !important;
            color:#d9e7f5 !important;
            font-size:25px !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .sidebar-content{
            display:flex !important;
            flex:1 !important;
            flex-direction:column !important;
            gap:0 !important;
            padding:12px 10px 15px !important;
            overflow-y:auto !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-grupo{
            display:flex !important;
            flex-direction:column !important;
            gap:2px !important;
            padding:0 0 8px !important;
            margin:0 !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-grupo + .menu-grupo{margin-top:2px !important}

        body.gbm-interna.gbm-dashboard-padrao .menu-grupo-conta{
            margin-top:auto !important;
            padding-top:8px !important;
            border-top:1px solid rgba(255,255,255,.08) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-grupo-titulo{
            margin:0 !important;
            padding:9px 9px 5px !important;
            color:#58708b !important;
            font:800 .5rem Inter,sans-serif !important;
            letter-spacing:.08em !important;
            text-transform:uppercase !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-grupo-premium .menu-grupo-titulo{color:#6b89a8 !important}

        body.gbm-interna.gbm-dashboard-padrao .menu-item{
            position:relative;
            display:flex !important;
            align-items:center !important;
            gap:9px !important;
            min-height:34px !important;
            padding:7px 9px !important;
            box-sizing:border-box !important;
            border-left:2px solid transparent !important;
            border-radius:10px !important;
            background:transparent !important;
            color:#dce6f0 !important;
            font:600 .68rem Inter,sans-serif !important;
            letter-spacing:0 !important;
            text-decoration:none !important;
            transition:background .18s ease,color .18s ease,border-color .18s ease !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-item:hover{
            background:rgba(85,167,255,.07) !important;
            border-left-color:rgba(85,167,255,.45) !important;
            color:#f5f9ff !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-item-icone{
            width:15px;
            flex:0 0 15px;
            text-align:center;
            color:#7d9abd !important;
            font-size:.75rem;
            line-height:1;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-item-conteudo{min-width:0;flex:1}

        body.gbm-interna.gbm-dashboard-padrao .menu-item-ativo{
            background:rgba(34,91,113,.38) !important;
            border-left-color:#39d98a !important;
            color:#effcff !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-item-ativo .menu-item-icone{color:#39d98a !important}

        body.gbm-interna.gbm-dashboard-padrao .menu-item-ativo-indicador{
            width:3px !important;
            height:17px !important;
            margin-left:auto !important;
            border-radius:8px !important;
            background:#39d98a !important;
            box-shadow:0 0 8px rgba(57,217,138,.28) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-item-com-indicador{
            display:flex !important;
            align-items:center !important;
            justify-content:space-between !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-item-com-indicador .menu-item-indicadores{
            margin-left:auto;
            display:inline-flex;
            align-items:center;
        }

        body.gbm-interna.gbm-dashboard-padrao .cadeado-premium{
            min-height:18px !important;
            padding:2px 6px !important;
            border:1px solid rgba(85,167,255,.45) !important;
            border-radius:999px !important;
            background:rgba(85,167,255,.12) !important;
            color:#9dcbff !important;
            font-size:.66rem !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .aviso-recursos-premium{
            margin:2px 8px 5px !important;
            padding:7px 8px !important;
            border:1px solid rgba(85,167,255,.18) !important;
            border-radius:8px !important;
            background:rgba(85,167,255,.06) !important;
            color:#8ca7c2 !important;
            font-size:.62rem !important;
            line-height:1.4;
        }

        body.gbm-interna.gbm-dashboard-padrao .menu-item-sair,
        body.gbm-interna.gbm-dashboard-padrao .menu-item-sair .menu-item-icone{
            color:#ff7d8a !important;
        }

        /* Estrutura principal */
        body.gbm-interna.gbm-dashboard-padrao .dashboard-topo{
            width:min(1320px,calc(100% - 40px));
            margin:0 auto;
            padding:28px 0 18px;
            display:flex;
            align-items:flex-end;
            justify-content:space-between;
            gap:24px;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-heading{
            min-width:0;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-breadcrumb{
            display:flex;
            align-items:center;
            gap:8px;
            margin-bottom:10px;
            color:#71869d;
            font-size:.72rem;
            font-weight:700;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-breadcrumb b{color:#4e6882}

        body.gbm-interna.gbm-dashboard-padrao .dashboard-breadcrumb strong{
            color:#a9c0d7;
            font-weight:700;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-heading h2{
            margin:0 0 7px;
            color:#eef6ff !important;
            font:700 clamp(1.65rem,3vw,2.2rem) Sora,Inter,sans-serif !important;
            letter-spacing:0 !important;
            text-shadow:none !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-heading p{
            margin:0;
            max-width:650px;
            color:#91a4ba !important;
            line-height:1.5;
            font-size:.88rem;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-filtros{
            display:flex;
            align-items:center;
            justify-content:flex-end;
            gap:9px;
            flex-wrap:wrap;
            min-width:min(100%,520px);
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-filtros select{
            width:auto;
            min-width:170px;
            min-height:40px;
            padding:8px 12px;
            border:1px solid rgba(85,167,255,.2) !important;
            border-radius:10px !important;
            background:rgba(6,15,29,.82) !important;
            color:#eef6ff !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-filtros #dia-fechamento{min-width:118px}

        body.gbm-interna.gbm-dashboard-padrao .dashboard-periodo{
            display:inline-flex;
            align-items:center;
            min-height:40px;
            padding:0 12px;
            border:1px solid rgba(255,255,255,.1);
            border-radius:10px;
            background:rgba(255,255,255,.035);
            color:#91a4ba;
            font-size:.72rem;
            font-weight:700;
            white-space:nowrap;
        }

        /* Cards */
        body.gbm-interna.gbm-dashboard-padrao :is(.card,.painel-ajustes,.chart-container,.lancamento-rapido,.insights-panel,.categorias-panel){
            position:relative;
            overflow:hidden;
            border:1px solid rgba(85,167,255,.2) !important;
            border-radius:14px !important;
            background:rgba(15,26,43,.96) !important;
            box-shadow:0 14px 34px rgba(0,0,0,.42),inset 0 1px rgba(255,255,255,.025) !important;
            backdrop-filter:none !important;
            transition:border-color .22s ease,box-shadow .22s ease,transform .22s ease !important;
            color:#eef6ff !important;
        }

        body.gbm-interna.gbm-dashboard-padrao :is(.card,.painel-ajustes,.chart-container,.lancamento-rapido,.insights-panel,.categorias-panel)::before{
            position:absolute;
            inset:0 0 auto;
            height:1px;
            background:linear-gradient(90deg,transparent,rgba(85,167,255,.4),transparent);
            content:"";
            pointer-events:none;
        }

        body.gbm-interna.gbm-dashboard-padrao :is(.card,.painel-ajustes,.chart-container,.lancamento-rapido,.insights-panel,.categorias-panel):hover{
            border-color:rgba(85,167,255,.38) !important;
            box-shadow:0 17px 38px rgba(0,0,0,.46),inset 0 1px rgba(255,255,255,.035) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .card h3,
        body.gbm-interna.gbm-dashboard-padrao .insights-panel h2{
            color:#eef6ff !important;
            font-family:Sora,Inter,sans-serif !important;
            text-shadow:none !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-principal-grid{
            width:min(1320px,calc(100% - 40px));
            margin:0 auto;
            display:grid;
            grid-template-columns:minmax(0,1.55fr) minmax(250px,.72fr) minmax(270px,.88fr);
            gap:18px;
            align-items:stretch;
        }

        body.gbm-interna.gbm-dashboard-padrao .card-resultado{
            min-height:330px;
            padding:22px;
            display:flex;
            flex-direction:column;
        }

        body.gbm-interna.gbm-dashboard-padrao .card-resultado-topo{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
        }

        body.gbm-interna.gbm-dashboard-padrao .card-resultado-topo h3,
        body.gbm-interna.gbm-dashboard-padrao .card-fluxo h3,
        body.gbm-interna.gbm-dashboard-padrao .card-pulso h3{
            margin:0 0 10px;
            color:#91a4ba !important;
            font-size:.78rem !important;
            font-weight:700 !important;
            letter-spacing:.02em;
            text-transform:none;
        }

        body.gbm-interna.gbm-dashboard-padrao #saldo-liquido{
            margin:0;
            color:#f4f8fc;
            font:700 clamp(1.85rem,3vw,2.5rem) Sora,Inter,sans-serif !important;
            letter-spacing:-.02em;
            text-shadow:none !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .badge-taxa-poupada,
        body.gbm-interna.gbm-dashboard-padrao .badge-economia-resultado,
        body.gbm-interna.gbm-dashboard-padrao .badge-comparativo-fluxo{
            display:inline-flex;
            align-items:center;
            width:max-content;
            margin-top:9px;
            padding:4px 8px;
            border:1px solid rgba(85,167,255,.2);
            border-radius:999px;
            background:rgba(85,167,255,.06);
            color:#9db3c9;
            font-size:.68rem;
            font-weight:700;
        }

        body.gbm-interna.gbm-dashboard-padrao .badge-taxa-poupada strong{margin-left:4px;color:#8bffc1}

        body.gbm-interna.gbm-dashboard-padrao .badge-economia-resultado{
            border-color:rgba(57,217,138,.2);
            background:rgba(57,217,138,.05);
            color:#94bda8;
        }

        body.gbm-interna.gbm-dashboard-padrao .badge-comparativo-fluxo.negativo{
            border-color:rgba(255,93,108,.25);
            background:rgba(255,93,108,.07);
            color:#ff9aa4;
        }

        body.gbm-interna.gbm-dashboard-padrao .badge-comparativo-fluxo.neutro{
            border-color:rgba(85,167,255,.18);
            background:rgba(85,167,255,.05);
            color:#9db6cf;
        }

        body.gbm-interna.gbm-dashboard-padrao .card-resultado-grafico{
            position:relative;
            flex:1;
            min-height:165px;
            margin-top:15px;
        }

        body.gbm-interna.gbm-dashboard-padrao #grafico-resultado-periodo{
            position:absolute;
            inset:0;
            width:100% !important;
            height:100% !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .coluna-fluxo{
            display:grid;
            grid-template-rows:1fr 1fr;
            gap:18px;
            min-width:0;
        }

        body.gbm-interna.gbm-dashboard-padrao .card-fluxo{
            min-height:156px;
            padding:20px;
            display:flex;
            align-items:flex-end;
            justify-content:space-between;
            gap:14px;
        }

        body.gbm-interna.gbm-dashboard-padrao .card-fluxo-conteudo{min-width:0}

        body.gbm-interna.gbm-dashboard-padrao .card-fluxo-topo{
            display:flex;
            align-items:center;
            gap:9px;
            margin-bottom:9px;
        }

        body.gbm-interna.gbm-dashboard-padrao .card-fluxo-topo h3{margin:0 !important}

        body.gbm-interna.gbm-dashboard-padrao .icone-fluxo{
            display:inline-flex;
            align-items:center;
            justify-content:center;
            width:26px;
            height:26px;
            border-radius:8px;
            font-size:1rem;
            font-weight:800;
            background:rgba(255,255,255,.05);
        }

        body.gbm-interna.gbm-dashboard-padrao .icone-entrada{
            color:#7fffb7 !important;
            background:rgba(57,217,138,.09);
        }

        body.gbm-interna.gbm-dashboard-padrao .icone-saida{
            color:#ff9aa4 !important;
            background:rgba(255,93,108,.08);
        }

        body.gbm-interna.gbm-dashboard-padrao #total-entradas,
        body.gbm-interna.gbm-dashboard-padrao #total-saidas{
            margin:0;
            font:700 clamp(1.28rem,2vw,1.7rem) Sora,Inter,sans-serif !important;
            text-shadow:none !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .fluxo-sparkline{
            width:88px;
            height:34px;
            opacity:.8;
            flex:0 0 auto;
            color:#55a7ff;
        }

        body.gbm-interna.gbm-dashboard-padrao .fluxo-sparkline-entrada{color:#39d98a}
        body.gbm-interna.gbm-dashboard-padrao .fluxo-sparkline-saida{color:#ff5d6c}

        body.gbm-interna.gbm-dashboard-padrao .card-pulso{
            min-height:330px;
            padding:22px;
            display:flex;
            flex-direction:column;
        }

        body.gbm-interna.gbm-dashboard-padrao .card-subtitulo,
        body.gbm-interna.gbm-dashboard-padrao .insights-subtitulo{
            margin:0;
            color:#71869d !important;
            font-size:.72rem;
            line-height:1.5;
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-barra{
            position:relative;
            height:12px;
            margin:28px 0 18px;
            overflow:visible;
            border-radius:999px;
            background:rgba(255,255,255,.06);
            border:1px solid rgba(255,255,255,.07);
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-barra-preenchimento{
            position:relative;
            width:0;
            height:100%;
            border-radius:inherit;
            background:linear-gradient(90deg,#39d98a,#55a7ff);
            transition:width .5s ease;
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-marcador-meta{
            position:absolute;
            top:-5px;
            width:2px;
            height:22px;
            border-radius:2px;
            background:#eef6ff;
            box-shadow:0 0 0 2px rgba(238,246,255,.05);
            transform:translateX(-1px);
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-legenda{
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:10px;
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-legenda div{
            display:flex;
            flex-direction:column;
            gap:4px;
            padding:10px 10px;
            border:1px solid rgba(255,255,255,.08);
            border-radius:9px;
            background:rgba(255,255,255,.025);
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-legenda span{
            color:#71869d;
            font-size:.65rem;
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-legenda strong{
            color:#dfeaf5;
            font-size:.82rem;
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-status{
            display:flex;
            align-items:flex-start;
            gap:10px;
            margin-top:auto;
            padding-top:18px;
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-status-icone{
            display:inline-flex;
            align-items:center;
            justify-content:center;
            width:28px;
            height:28px;
            border-radius:8px;
            background:rgba(57,217,138,.09);
            color:#7fffb7;
            font-weight:800;
            flex:0 0 auto;
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-status strong{
            display:block;
            margin-bottom:4px;
            color:#eef6ff;
            font-size:.78rem;
        }

        body.gbm-interna.gbm-dashboard-padrao .pulso-status span{
            color:#7f95aa;
            font-size:.68rem;
            line-height:1.45;
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-secundario-grid{
            width:min(1320px,calc(100% - 40px));
            margin:18px auto 0;
            display:grid;
            grid-template-columns:minmax(0,1.1fr) minmax(340px,.9fr);
            gap:18px;
        }

        body.gbm-interna.gbm-dashboard-padrao .insights-panel,
        body.gbm-interna.gbm-dashboard-padrao .categorias-panel{
            padding:22px;
            min-height:250px;
        }

        body.gbm-interna.gbm-dashboard-padrao .insights-cabecalho{
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:16px;
            margin-bottom:14px;
        }

        body.gbm-interna.gbm-dashboard-padrao .insights-cabecalho h2{
            margin:0 0 6px !important;
            color:#eef6ff !important;
            font:700 1rem Sora,Inter,sans-serif !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .insights-ver-mais{
            flex:0 0 auto;
            min-height:36px;
            padding:8px 12px;
            border:1px solid rgba(85,167,255,.28) !important;
            border-radius:9px !important;
            background:rgba(85,167,255,.08) !important;
            color:#bfe0ff !important;
            font:700 .72rem Inter,sans-serif !important;
            cursor:pointer;
        }

        body.gbm-interna.gbm-dashboard-padrao .insights-lista{
            display:flex;
            flex-direction:column;
            gap:9px;
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-item{
            display:flex;
            flex-direction:column;
            gap:5px;
            padding:12px 13px;
            border:1px solid rgba(255,255,255,.08);
            border-radius:10px;
            background:rgba(255,255,255,.025);
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-item > span:not(.insight-rotulo),
        body.gbm-interna.gbm-dashboard-padrao .insight-item > strong{
            color:#dfeaf5;
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-item > span:not(.insight-rotulo){
            color:#8498ad;
            font-size:.72rem;
            line-height:1.45;
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-rotulo{
            color:#88a7c4 !important;
            font-size:.6rem !important;
            font-weight:800;
            letter-spacing:.08em;
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-badge{
            width:max-content;
            padding:3px 7px;
            border:1px solid rgba(85,167,255,.16);
            border-radius:999px;
            background:rgba(85,167,255,.05);
            color:#8ca8c2 !important;
            font-size:.6rem !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-link,
        body.gbm-interna.gbm-dashboard-padrao .categorias-link{
            width:max-content;
            color:#73b8ff !important;
            font-size:.68rem;
            font-weight:700;
            text-decoration:none;
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-link:hover,
        body.gbm-interna.gbm-dashboard-padrao .categorias-link:hover{color:#9bd0ff !important}

        body.gbm-interna.gbm-dashboard-padrao .principais-categorias-lista{
            display:flex;
            flex-direction:column;
            gap:13px;
            margin-top:10px;
        }

        body.gbm-interna.gbm-dashboard-padrao .categoria-participacao-item{
            display:flex;
            flex-direction:column;
            gap:7px;
        }

        body.gbm-interna.gbm-dashboard-padrao .categoria-participacao-topo{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
        }

        body.gbm-interna.gbm-dashboard-padrao .categoria-participacao-nome{
            min-width:0;
            overflow:hidden;
            text-overflow:ellipsis;
            color:#dfeaf5 !important;
            font-size:.73rem;
            white-space:nowrap;
        }

        body.gbm-interna.gbm-dashboard-padrao .categoria-participacao-pct{
            color:#8ca8c2 !important;
            font-size:.68rem;
            font-weight:700;
        }

        body.gbm-interna.gbm-dashboard-padrao .categoria-participacao-barra-fundo{
            height:7px;
            overflow:hidden;
            border-radius:999px;
            background:rgba(255,255,255,.055);
        }

        body.gbm-interna.gbm-dashboard-padrao .categoria-participacao-barra-preenchimento{
            height:100%;
            border-radius:inherit;
        }

        body.gbm-interna.gbm-dashboard-padrao .categoria-participacao-vazio{
            color:#71869d !important;
            font-size:.72rem;
        }

        body.gbm-interna.gbm-dashboard-padrao .categorias-link{
            display:inline-flex;
            margin-top:15px;
        }

        /* Lançamento rápido e controles antigos, preservados funcionalmente */
        body.gbm-interna.gbm-dashboard-padrao .dashboard-lancamento-rapido{
            width:min(1320px,calc(100% - 40px));
            margin:18px auto 20px !important;
            padding:20px 22px !important;
            display:grid;
            grid-template-columns:minmax(170px,.48fr) minmax(0,1.52fr);
            gap:18px;
            align-items:center;
        }

        body.gbm-interna.gbm-dashboard-padrao .lancamento-rapido-copy h3{
            margin:0 0 6px !important;
            color:#eef6ff !important;
            font-size:.9rem !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .lancamento-rapido-copy p{
            margin:0 !important;
            color:#71869d !important;
            font-size:.7rem !important;
            line-height:1.45;
        }

        body.gbm-interna.gbm-dashboard-padrao .lancamento-rapido-form{
            display:grid;
            grid-template-columns:1.05fr 1.3fr .72fr .8fr 1.1fr .9fr auto auto;
            gap:8px;
            align-items:center;
        }

        body.gbm-interna.gbm-dashboard-padrao .lancamento-rapido-form :is(input,select){
            min-width:0;
            min-height:40px;
            padding:8px 10px;
        }

        body.gbm-interna.gbm-dashboard-padrao .btn-acao{
            min-height:40px;
            padding:9px 13px;
            border:1px solid rgba(95,255,168,.28) !important;
            border-radius:9px !important;
            background:linear-gradient(135deg,#258c5b,#2e9b64) !important;
            color:#f5fffa !important;
            font:700 .7rem Inter,sans-serif !important;
            box-shadow:0 4px 14px rgba(0,0,0,.24) !important;
            cursor:pointer;
            transition:transform .2s ease,border-color .2s ease,filter .2s ease !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .btn-acao:hover{
            transform:translateY(-1px) !important;
            border-color:#5fffa8 !important;
            filter:brightness(1.06);
        }

        body.gbm-interna.gbm-dashboard-padrao .dashboard-undo{
            background:#0f1a2b !important;
            border-color:rgba(255,255,255,.16) !important;
            color:#b7c7d8 !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .linha-paineis{
            width:min(1320px,calc(100% - 40px));
            margin:0 auto 18px !important;
            display:grid;
            grid-template-columns:repeat(3,minmax(0,1fr));
            gap:18px;
        }

        body.gbm-interna.gbm-dashboard-padrao .linha-paineis .painel-ajustes{
            margin:0 !important;
            min-width:0;
            padding:16px 18px !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .grupo-ajuste{
            display:flex;
            flex-direction:column;
            gap:7px;
            min-width:0;
        }

        body.gbm-interna.gbm-dashboard-padrao .grupo-ajuste label{
            color:#9db3c9 !important;
            font-size:.68rem !important;
            font-weight:700 !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .grupo-ajuste > div{
            min-width:0;
        }

        body.gbm-interna.gbm-dashboard-padrao .painel-controles-grafico{
            width:min(1320px,calc(100% - 40px));
            margin:0 auto 12px !important;
            padding:14px 18px !important;
            display:flex;
            align-items:flex-end;
            gap:14px;
        }

        body.gbm-interna.gbm-dashboard-padrao .chart-container{
            width:min(1320px,calc(100% - 40px));
            margin:0 auto 18px !important;
            padding:18px !important;
            min-height:420px;
            height:420px;
            display:flex;
            gap:18px;
        }

        body.gbm-interna.gbm-dashboard-padrao .chart-container.hibrido{
            max-width:none !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .container-tabela{
            flex:1;
            min-width:0;
            overflow:auto;
            border:1px solid rgba(85,167,255,.18) !important;
            border-radius:10px !important;
            background:rgba(6,15,29,.34) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .grafico-wrapper{
            flex:1;
            min-width:0;
            position:relative;
        }

        body.gbm-interna.gbm-dashboard-padrao table{
            width:100%;
            border-collapse:separate;
            border-spacing:0;
        }

        body.gbm-interna.gbm-dashboard-padrao th{
            color:#91a4ba !important;
            background:#0c1829 !important;
            font-size:.7rem;
            text-transform:uppercase;
        }

        body.gbm-interna.gbm-dashboard-padrao td,
        body.gbm-interna.gbm-dashboard-padrao th{
            padding:10px 12px;
            border-bottom:1px solid rgba(85,167,255,.1) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao tr:hover{background:rgba(85,167,255,.04) !important}

        body.gbm-interna.gbm-dashboard-padrao #card-ofx{
            width:min(1320px,calc(100% - 40px)) !important;
            margin:0 auto 20px !important;
            padding:16px 20px !important;
        }

        /* Modais */
        body.gbm-interna.gbm-dashboard-padrao .modal-gbm,
        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard{
            background:rgba(0,0,0,.58) !important;
            backdrop-filter:blur(6px) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-gbm-dialogo,
        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-dialog{
            border:1px solid rgba(85,167,255,.24) !important;
            border-radius:14px !important;
            background:#0b1728 !important;
            box-shadow:0 24px 70px rgba(0,0,0,.58) !important;
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard{
            position:fixed !important;
            inset:0 !important;
            z-index:100000 !important;
            display:none;
            align-items:center;
            justify-content:center;
            padding:18px;
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard.aberto{display:flex !important}

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-dialog{
            width:min(760px,100%);
            max-height:min(760px,calc(100vh - 36px));
            display:flex;
            flex-direction:column;
            overflow:hidden;
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-topo{
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:18px;
            padding:18px 20px;
            border-bottom:1px solid rgba(255,255,255,.08);
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-kicker{
            display:block;
            margin-bottom:5px;
            color:#7f9fbe;
            font:800 .64rem Inter,sans-serif;
            letter-spacing:.08em;
            text-transform:uppercase;
        }

        body.gbm-interna.gbm-dashboard-padrao #titulo-modal-insights{
            margin:0 !important;
            color:#eef6ff !important;
            font-size:1.04rem !important;
        }

        body.gbm-interna.gbm-dashboard-padrao #subtitulo-modal-insights{
            margin:5px 0 0 !important;
            color:#8ea2b9 !important;
            font-size:.72rem;
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-fechar{
            width:34px;
            height:34px;
            padding:0 !important;
            border:0 !important;
            border-radius:8px !important;
            background:transparent !important;
            color:#b9c7d5 !important;
            font-size:21px !important;
            cursor:pointer;
        }

        body.gbm-interna.gbm-dashboard-padrao .insights-detalhados{
            flex:1;
            min-height:220px;
            overflow:auto;
            padding:17px 20px;
            display:flex;
            flex-direction:column;
            gap:10px;
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-detalhes-extras{
            display:flex;
            flex-wrap:wrap;
            gap:6px;
            margin-top:8px;
        }

        body.gbm-interna.gbm-dashboard-padrao .insight-detalhes-extras span{
            padding:4px 7px;
            border:1px solid rgba(85,167,255,.13);
            border-radius:7px;
            background:rgba(85,167,255,.05);
            color:#92a8bf;
            font-size:.66rem;
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-ia{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:16px;
            padding:14px 20px 17px;
            border-top:1px solid rgba(255,255,255,.08);
            background:rgba(15,26,43,.62);
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-ia > div{
            display:flex;
            flex-direction:column;
            gap:3px;
            min-width:0;
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-ia strong{
            color:#eef6ff;
            font-size:.78rem;
        }

        body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-ia span{
            color:#8297ad;
            font-size:.68rem;
            line-height:1.35;
        }

        body.gbm-interna.gbm-dashboard-padrao .btn-insights-ia{
            flex:0 0 auto;
            min-height:40px;
            padding:9px 13px;
            border:1px solid rgba(95,255,168,.35) !important;
            border-radius:9px !important;
            background:rgba(46,139,87,.15) !important;
            color:#dffff0 !important;
            font:700 .72rem Inter,sans-serif !important;
            cursor:pointer;
        }

        @media(max-width:900px){
            body.gbm-interna.gbm-dashboard-padrao .dashboard-principal-grid{
                grid-template-columns:minmax(0,1fr) minmax(250px,.75fr);
            }
            body.gbm-interna.gbm-dashboard-padrao .card-pulso{
                grid-column:1/-1;
            }
            body.gbm-interna.gbm-dashboard-padrao .linha-paineis{
                grid-template-columns:1fr 1fr;
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-lancamento-rapido{
                grid-template-columns:1fr;
            }
            body.gbm-interna.gbm-dashboard-padrao .lancamento-rapido-form{
                grid-template-columns:repeat(4,minmax(0,1fr));
            }
        }

        @media(max-width:700px){
            body.gbm-interna.gbm-dashboard-padrao .gbm-header{
                min-height:62px !important;
                height:62px !important;
                padding:0 15px !important;
            }
            body.gbm-interna.gbm-dashboard-padrao .gbm-logo-img{height:40px !important}
            body.gbm-interna.gbm-dashboard-padrao .gbm-title{
                display:none !important;
            }
            body.gbm-interna.gbm-dashboard-padrao .nome-perfil-cabecalho{
                display:none !important;
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-topo,
            body.gbm-interna.gbm-dashboard-padrao .dashboard-principal-grid,
            body.gbm-interna.gbm-dashboard-padrao .dashboard-secundario-grid,
            body.gbm-interna.gbm-dashboard-padrao .dashboard-lancamento-rapido,
            body.gbm-interna.gbm-dashboard-padrao .linha-paineis,
            body.gbm-interna.gbm-dashboard-padrao .painel-controles-grafico,
            body.gbm-interna.gbm-dashboard-padrao .chart-container,
            body.gbm-interna.gbm-dashboard-padrao #card-ofx{
                width:min(100% - 24px,1320px);
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-topo{
                padding:20px 0 14px;
                align-items:stretch;
                flex-direction:column;
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-filtros{
                justify-content:stretch;
                min-width:0;
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-filtros select,
            body.gbm-interna.gbm-dashboard-padrao .dashboard-periodo{
                flex:1 1 0;
                min-width:0;
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-principal-grid{
                grid-template-columns:1fr;
                gap:12px;
            }
            body.gbm-interna.gbm-dashboard-padrao .coluna-fluxo{
                gap:12px;
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-secundario-grid{
                grid-template-columns:1fr;
                gap:12px;
                margin-top:12px;
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-lancamento-rapido{
                margin-top:12px !important;
                grid-template-columns:1fr;
                gap:14px;
            }
            body.gbm-interna.gbm-dashboard-padrao .lancamento-rapido-form{
                grid-template-columns:1fr 1fr;
            }
            body.gbm-interna.gbm-dashboard-padrao .linha-paineis{
                grid-template-columns:1fr;
                gap:12px;
            }
            body.gbm-interna.gbm-dashboard-padrao .painel-controles-grafico{
                flex-direction:column;
                align-items:stretch;
            }
            body.gbm-interna.gbm-dashboard-padrao .chart-container{
                min-height:360px;
                height:360px;
                flex-direction:column;
            }
            body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard{padding:8px}
            body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-dialog{
                max-height:calc(100vh - 16px);
                border-radius:13px !important;
            }
            body.gbm-interna.gbm-dashboard-padrao .modal-insights-dashboard-ia{
                align-items:stretch;
                flex-direction:column;
            }
            body.gbm-interna.gbm-dashboard-padrao .btn-insights-ia{width:100%}
        }

        @media(max-width:430px){
            body.gbm-interna.gbm-dashboard-padrao .dashboard-filtros{
                display:grid;
                grid-template-columns:1fr 1fr;
            }
            body.gbm-interna.gbm-dashboard-padrao .dashboard-periodo{
                grid-column:1/-1;
                justify-content:center;
            }
            body.gbm-interna.gbm-dashboard-padrao .lancamento-rapido-form{
                grid-template-columns:1fr;
            }
            body.gbm-interna.gbm-dashboard-padrao .sidebar-menu{
                width:min(286px,88vw) !important;
                right:calc(-1 * min(306px,92vw)) !important;
            }
        }
`;
            document.head.appendChild(dashboardStyle);
        }
    }

    function criarCabecalho() {
        if (PAGINAS_SEM_CABECALHO_AUTOMATICO.has(NOME_ARQUIVO)) return;
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

    function aplicarTemaRelatorios() {
        if (NOME_ARQUIVO === 'relatorio.html') {
            document.body.classList.add('gbm-relatorio-padrao', 'gbm-interna');
        }
        if (NOME_ARQUIVO === 'comparativo.html') {
            document.body.classList.add('gbm-comparativo-padrao', 'gbm-interna');
        }
    }

    function garantirAjudaDashboard() {
        // O gbm-ai-ajuda.js cria e controla funcionalmente o botão.
        // Este arquivo cuida somente da apresentação visual.
    }

    function removerRestosDoCabecalhoAntigo() {
        if (PAGINAS_SEM_CABECALHO_AUTOMATICO.has(NOME_ARQUIVO) || NOME_ARQUIVO === 'dashboard.html') return;
        document.querySelector('body.gbm-interna > #menu-overlay')?.remove();
        document.querySelector('body.gbm-interna > #sidebar-menu')?.remove();
    }

    function inicializar() {
        aplicarTemaRelatorios();
        injetarEstilos();

        if (NOME_ARQUIVO === 'dashboard.html') {
            document.body.classList.add('gbm-interna', 'gbm-dashboard-padrao');
            garantirAjudaDashboard();
            return;
        }

        if (PAGINAS_SEM_CABECALHO_AUTOMATICO.has(NOME_ARQUIVO)) return;
        if (!document.body?.classList.contains('gbm-interna')) return;

        criarCabecalho();
        removerRestosDoCabecalhoAntigo();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar, { once: true });
    } else {
        inicializar();
    }
})();
