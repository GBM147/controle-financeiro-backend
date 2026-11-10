/* Ações declarativas no lugar de atributos on* inline, para que a CSP não
   precise de 'unsafe-inline'. Cada elemento recebe ouvintes próprios (não
   delegados), preservando a ordem e a propagação dos antigos handlers.

   data-acao="funcao"            clique chama window.funcao(...args)
   data-acao-change / -input     mesmo comportamento para change e input
   data-args='[1, "texto"]'      argumentos em JSON (data-args-change etc.)
   data-com-valor                acrescenta o valor do campo (antigo this.value)
   data-com-elemento             acrescenta o elemento como último argumento
   data-com-evento               acrescenta o evento como último argumento
   data-prevenir                 chama preventDefault (antigo "return false")
   data-fundo-hover / -normal    fundo aplicado ao passar e ao tirar o ponteiro

   Ações internas: gbm:navegar(url), gbm:recarregar(), gbm:fechar-dialogo(id). */
(() => {
    'use strict';
    if (window.GBMAcoes) return;

    const EVENTOS = ['click', 'change', 'input'];
    const SELETOR = '[data-acao],[data-acao-change],[data-acao-input],[data-fundo-hover],[data-fundo-normal]';
    const vinculados = new WeakSet();
    const internas = {
        'gbm:navegar': (url) => { window.location.href = url; },
        'gbm:recarregar': () => { window.location.reload(); },
        'gbm:fechar-dialogo': (id) => { document.getElementById(id)?.close(); }
    };

    function argumentos(elemento, sufixo) {
        const bruto = elemento.getAttribute(`data-args${sufixo}`);
        if (!bruto) return [];
        try {
            const valor = JSON.parse(bruto);
            return Array.isArray(valor) ? valor : [valor];
        } catch {
            console.error(`Argumentos inválidos em data-args${sufixo}:`, bruto);
            return null;
        }
    }

    function executar(elemento, evento, tipo) {
        const sufixo = tipo === 'click' ? '' : `-${tipo}`;
        const nome = elemento.getAttribute(`data-acao${sufixo}`);
        if (!nome) return;
        if (elemento.hasAttribute(`data-prevenir${sufixo}`)) evento.preventDefault();
        const funcao = internas[nome] || (typeof window[nome] === 'function' ? window[nome] : null);
        if (!funcao) {
            console.error(`Ação não encontrada: ${nome}`);
            return;
        }
        const lista = argumentos(elemento, sufixo);
        if (!lista) return;
        if (elemento.hasAttribute(`data-com-valor${sufixo}`)) lista.push(elemento.value);
        if (elemento.hasAttribute(`data-com-elemento${sufixo}`)) lista.push(elemento);
        if (elemento.hasAttribute(`data-com-evento${sufixo}`)) lista.push(evento);
        funcao(...lista);
    }

    function vincular(elemento) {
        if (vinculados.has(elemento)) return;
        vinculados.add(elemento);
        for (const tipo of EVENTOS) {
            elemento.addEventListener(tipo, (evento) => executar(elemento, evento, tipo));
        }
        elemento.addEventListener('mouseover', () => {
            const fundo = elemento.getAttribute('data-fundo-hover');
            if (fundo !== null) elemento.style.background = fundo;
        });
        elemento.addEventListener('mouseout', () => {
            const fundo = elemento.getAttribute('data-fundo-normal');
            if (fundo !== null) elemento.style.background = fundo;
        });
    }

    function varrer(raiz) {
        if (!raiz || raiz.nodeType !== 1) return;
        if (raiz.matches(SELETOR)) vincular(raiz);
        raiz.querySelectorAll(SELETOR).forEach(vincular);
    }

    new MutationObserver((mutacoes) => {
        for (const mutacao of mutacoes) {
            if (mutacao.type === 'attributes') varrer(mutacao.target);
            else mutacao.addedNodes.forEach(varrer);
        }
    }).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-acao', 'data-acao-change', 'data-acao-input', 'data-fundo-hover', 'data-fundo-normal']
    });
    varrer(document.documentElement);

    window.GBMAcoes = Object.freeze({ varrer, executar });
})();
