/* Site público: quem já está logado vê o caminho de volta ao painel
   no lugar de "Entrar" e dos convites para criar conta. */
(() => {
    'use strict';
    const painel = '/dashboard.html';

    function aplicar() {
        document.body.classList.add('gbm-logado');
        document.querySelectorAll('a[href$="login.html"], a[href*="login.html?"]').forEach((link) => {
            const texto = (link.textContent || '').trim().toLowerCase();
            link.href = painel;
            if (texto === 'entrar') link.textContent = 'Meu painel';
            else if (/grátis|criar conta|começar/.test(texto)) link.textContent = 'Abrir meu painel';
        });
    }

    fetch('/sessao-publica', { credentials: 'include', cache: 'no-store' })
        .then((resposta) => (resposta.ok ? resposta.json() : null))
        .then((dados) => {
            if (!dados?.logado) return;
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar, { once: true });
            else aplicar();
        })
        .catch(() => { /* Sem conexão: a página continua com o botão de entrar. */ });
})();
