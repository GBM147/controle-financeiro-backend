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
            'dashboard.html': 'Visão geral', 'contas.html': 'Minhas contas', 'importacoes.html': 'Importações',
            'calendario.html': 'Calendário', 'limite-de-gastos.html': 'Limite de gastos', 'metas.html': 'Objetivos de poupança',
            'notificacoes.html': 'Notificações', 'relatorio.html': 'Relatórios', 'relatorio-avancado.html': 'Relatório avançado',
            'comparativo.html': 'Comparativo mensal', 'configuracoes.html': 'Configurações', 'perfil.html': 'Meu perfil',
            'educacao-financeira.html': 'Educação financeira'
        };
        return titulos[paginaAtual()] || document.title || 'Página do GBM';
    }

    function garantirBotaoDashboard() {
        if (paginaAtual() !== 'dashboard.html') return;
        if (document.getElementById('gbm-tour-ajuda')) return;
        const botao = document.createElement('button');
        botao.id = 'gbm-tour-ajuda';
        botao.type = 'button';
        botao.title = 'Como usar: Dashboard';
        botao.setAttribute('aria-label', 'Abrir ajuda do Dashboard');
        botao.innerHTML = '<span class="gbm-tour-ajuda-icone" aria-hidden="true">?</span><span class="gbm-tour-ajuda-texto">Como usar esta página</span>';
        document.body.appendChild(botao);
    }

    function injetarEstilos() {
        if (document.getElementById('gbm-ai-ajuda-style')) return;
        const style = document.createElement('style');
        style.id = 'gbm-ai-ajuda-style';
        style.textContent = `
            .gbm-ai-overlay{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:18px;background:var(--overlay)}.gbm-ai-overlay.aberto{display:flex;animation:gbm-aparece 200ms ease both}
            .gbm-ai-modal{display:flex;flex-direction:column;width:min(640px,100%);max-height:min(720px,calc(100vh - 36px));overflow:hidden;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);color:var(--text);box-shadow:var(--shadow-lg);font-family:var(--font-ui);animation:gbm-dialogo-entra 220ms var(--ease) both}
            .gbm-ai-header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border)}.gbm-ai-identidade{display:flex;align-items:center;gap:12px;min-width:0}.gbm-ai-icone{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--accent-soft);color:var(--accent);font-size:15px;font-weight:700}.gbm-ai-titulo{font-size:15px;font-weight:600}.gbm-ai-subtitulo{margin-top:1px;color:var(--text-3);font-size:12.5px}.gbm-ai-fechar{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--text-2);font-size:20px;cursor:pointer}.gbm-ai-fechar:hover{background:var(--surface-2);color:var(--text)}
            .gbm-ai-conversa{display:flex;flex:1;flex-direction:column;gap:10px;min-height:240px;overflow:auto;padding:16px 18px}.gbm-ai-mensagem{max-width:88%;padding:10px 13px;border-radius:12px;font-size:14px;line-height:1.55;word-break:break-word}.gbm-ai-mensagem strong{font-weight:600}.gbm-ai-mensagem.ia{align-self:flex-start;background:var(--surface-2);color:var(--text)}.gbm-ai-mensagem.usuario{align-self:flex-end;background:var(--accent);color:var(--on-accent);white-space:pre-wrap}.gbm-ai-link-pagina,.gbm-ai-navegacao-botao{display:inline-flex;margin-top:8px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--accent);font-size:13px;font-weight:500;text-decoration:none}.gbm-ai-link-pagina:hover,.gbm-ai-navegacao-botao:hover{border-color:var(--accent)}.gbm-ai-navegacao{margin-top:8px;padding-top:8px;border-top:1px solid var(--border)}.gbm-ai-navegacao-descricao{margin-bottom:6px;color:var(--text-2);font-size:13px}
            .gbm-ai-carregando{display:inline-flex;align-items:center;gap:5px}.gbm-ai-carregando span{width:6px;height:6px;border-radius:50%;background:var(--text-3);animation:gbm-ai-pulso 1.1s infinite ease-in-out}.gbm-ai-carregando span:nth-child(2){animation-delay:.16s}.gbm-ai-carregando span:nth-child(3){animation-delay:.32s}@keyframes gbm-ai-pulso{0%,70%,100%{opacity:.35}35%{opacity:1}}
            .gbm-ai-sugestoes{display:flex;flex-wrap:wrap;gap:6px;padding:0 18px 12px}.gbm-ai-sugestao{padding:6px 11px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-2);font:500 13px var(--font-ui);cursor:pointer}.gbm-ai-sugestao:hover{border-color:var(--accent);color:var(--text)}.gbm-ai-acoes{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:0 18px 12px}.gbm-ai-acoes-nota{color:var(--text-3);font-size:12px}.gbm-ai-link{padding:4px 0;border:0;background:transparent;color:var(--accent);font:500 13px var(--font-ui);cursor:pointer}.gbm-ai-link:hover{text-decoration:underline}.gbm-ai-form{display:flex;gap:8px;padding:12px 18px 16px;border-top:1px solid var(--border)}.gbm-ai-input{flex:1;min-width:0;min-height:42px;padding:10px 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;resize:none}.gbm-ai-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.gbm-ai-enviar{min-width:80px;min-height:42px;padding:0 14px;border:0;border-radius:8px;background:var(--accent);color:var(--on-accent);font:500 14px var(--font-ui);cursor:pointer}.gbm-ai-enviar:hover{background:var(--accent-hover)}.gbm-ai-enviar:disabled{opacity:.6;cursor:wait}@media(max-width:640px){.gbm-ai-overlay{padding:8px}.gbm-ai-modal{max-height:calc(100vh - 16px)}.gbm-ai-mensagem{max-width:94%}.gbm-ai-form{align-items:flex-end}}
        `;
        document.head.appendChild(style);
    }

    function criarInterface() {
        if (document.getElementById('gbm-ai-overlay')) return;
        const overlay = document.createElement('div'); overlay.id='gbm-ai-overlay'; overlay.className='gbm-ai-overlay'; overlay.setAttribute('aria-hidden','true');
        overlay.innerHTML=`<section class="gbm-ai-modal" role="dialog" aria-modal="true" aria-labelledby="gbm-ai-titulo"><header class="gbm-ai-header"><div class="gbm-ai-identidade"><div class="gbm-ai-icone" aria-hidden="true">?</div><div><div class="gbm-ai-titulo" id="gbm-ai-titulo">Como usar esta página</div><div class="gbm-ai-subtitulo">Assistente do GBM · ${escapeHtml(tituloPagina())}</div></div></div><button type="button" class="gbm-ai-fechar" id="gbm-ai-fechar" aria-label="Fechar">×</button></header><div class="gbm-ai-conversa" id="gbm-ai-conversa" aria-live="polite"></div><div class="gbm-ai-sugestoes" id="gbm-ai-sugestoes"></div><div class="gbm-ai-acoes"><button type="button" class="gbm-ai-link" id="gbm-ai-tutorial">Ver tutorial passo a passo</button><span class="gbm-ai-acoes-nota">Posso orientar você pelo GBM inteiro.</span></div><form class="gbm-ai-form" id="gbm-ai-form"><textarea class="gbm-ai-input" id="gbm-ai-input" rows="1" maxlength="1200" placeholder="Digite sua dúvida sobre o GBM..." aria-label="Sua dúvida"></textarea><button type="submit" class="gbm-ai-enviar" id="gbm-ai-enviar">Enviar</button></form></section>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click',(evento)=>{if(evento.target===overlay)fechar();});
        document.getElementById('gbm-ai-fechar').addEventListener('click',fechar); document.getElementById('gbm-ai-form').addEventListener('submit',enviarPergunta); document.getElementById('gbm-ai-tutorial').addEventListener('click',abrirTutorialOriginal);
        document.addEventListener('keydown',(evento)=>{if(evento.key==='Escape'&&overlay.classList.contains('aberto'))fechar();});
        const sugestoes=['Como cadastro um novo gasto?','Como importo meu extrato?','Onde vejo minhas contas?']; const container=document.getElementById('gbm-ai-sugestoes');
        sugestoes.forEach((texto)=>{const botao=document.createElement('button');botao.type='button';botao.className='gbm-ai-sugestao';botao.textContent=texto;botao.addEventListener('click',()=>{document.getElementById('gbm-ai-input').value=texto;enviarPerguntaAtual();});container.appendChild(botao);});
        adicionarMensagem('ia',`Olá! Posso explicar qualquer função do GBM, mesmo que ela esteja em outra página. Você está em “${tituloPagina()}”.`);
    }

    function abrir(){criarInterface();const overlay=document.getElementById('gbm-ai-overlay');overlay.classList.add('aberto');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.getElementById('gbm-ai-input')?.focus();}
    function fechar(){const overlay=document.getElementById('gbm-ai-overlay');if(!overlay)return;overlay.classList.remove('aberto');overlay.setAttribute('aria-hidden','true');document.body.style.overflow='';}
    function adicionarMensagem(tipo,texto,navegacao=null){const conversa=document.getElementById('gbm-ai-conversa');if(!conversa)return;const mensagem=document.createElement('div');mensagem.className=`gbm-ai-mensagem ${tipo}`;if(tipo==='ia'){mensagem.innerHTML=formatarResposta(texto);if(navegacao?.url){const area=document.createElement('div');area.className='gbm-ai-navegacao';area.innerHTML=`<div class="gbm-ai-navegacao-descricao">${escapeHtml(navegacao.descricao||'')}</div><a class="gbm-ai-navegacao-botao" href="${escapeHtml(navegacao.url)}">Abrir ${escapeHtml(navegacao.titulo||'página')}</a>`;mensagem.appendChild(area);}}else{mensagem.textContent=texto;}conversa.appendChild(mensagem);conversa.scrollTop=conversa.scrollHeight;return mensagem;}
    function adicionarCarregando(){const conversa=document.getElementById('gbm-ai-conversa');const mensagem=document.createElement('div');mensagem.className='gbm-ai-mensagem ia';mensagem.innerHTML='<span class="gbm-ai-carregando" aria-label="Pensando"><span></span><span></span><span></span></span>';conversa.appendChild(mensagem);conversa.scrollTop=conversa.scrollHeight;return mensagem;}
    function apiFetch(url,opcoes){if(typeof window.fetchApi==='function')return window.fetchApi(url,opcoes);return fetch(url,{credentials:'include',...opcoes});}
    function registrarHistorico(role,text){historico.push({role,text});while(historico.length>6)historico.shift();}
    async function enviarPergunta(evento){if(evento)evento.preventDefault();return enviarPerguntaAtual();}
    async function enviarPerguntaAtual(contextoExtra=''){const input=document.getElementById('gbm-ai-input');const enviar=document.getElementById('gbm-ai-enviar');if(!input||!enviar)return;const pergunta=input.value.trim();if(!pergunta||enviar.disabled)return;adicionarMensagem('usuario',pergunta);registrarHistorico('user',pergunta);input.value='';enviar.disabled=true;const carregando=adicionarCarregando();try{const resposta=await apiFetch('/assistente-ajuda',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pergunta,pagina:paginaAtual(),historico:historico.slice(-6),contexto:String(contextoExtra||'').slice(0,5000)})});const dados=await resposta.json().catch(()=>({}));carregando.remove();if(!resposta.ok||!dados.success)throw new Error(dados.error||'Não foi possível obter uma resposta.');adicionarMensagem('ia',dados.resposta,dados.navegacao);registrarHistorico('model',dados.resposta);}catch(erro){carregando.remove();adicionarMensagem('ia',erro.message||'Não consegui responder agora. Tente novamente.');}finally{enviar.disabled=false;input.focus();}}
    function abrirTutorialOriginal(){fechar();const botao=document.getElementById('gbm-tour-ajuda');if(!botao)return;botao.dataset.gbmIgnorarAssistente='1';botao.click();}
    function interceptarBotaoExistente(){document.addEventListener('click',(evento)=>{const botao=evento.target.closest('#gbm-tour-ajuda');if(!botao)return;if(botao.dataset.gbmIgnorarAssistente==='1'){delete botao.dataset.gbmIgnorarAssistente;return;}evento.preventDefault();evento.stopPropagation();evento.stopImmediatePropagation();abrir();},true);}
    function inicializar(){injetarEstilos();garantirBotaoDashboard();criarInterface();interceptarBotaoExistente();}
    window.__gbmAbrirAjuda = abrir;
    window.__gbmFecharAjuda = fechar;
    window.gbmAiPerguntar = async function(pergunta, contexto=''){
        abrir();
        const input=document.getElementById('gbm-ai-input');
        if(!input) return;
        input.value=String(pergunta||'').trim();
        return enviarPerguntaAtual(contexto);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inicializar,{once:true});else inicializar();
})();
