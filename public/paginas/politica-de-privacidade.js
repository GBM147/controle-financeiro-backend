        const botaoRetorno = document.getElementById('botao-retorno');
        const origensPermitidas = {
            cadastro: { rotulo: 'Fechar e voltar ao cadastro', destino: 'index.html' },
            configuracoes: { rotulo: '← Configurações', destino: 'configuracoes.html' },
            privacidade: { rotulo: '← Privacidade e dados', destino: 'privacidade.html' }
        };
        const origemSolicitada = new URLSearchParams(window.location.search).get('origem');
        const origem = Object.hasOwn(origensPermitidas, origemSolicitada) ? origemSolicitada : null;
        const retorno = origem ? origensPermitidas[origem] : { rotulo: '← Voltar', destino: 'index.html' };

        botaoRetorno.textContent = retorno.rotulo;
        botaoRetorno.href = retorno.destino;

        document.querySelectorAll('[data-link-legal]').forEach((link) => {
            if (!origem) return;
            const destino = new URL(link.getAttribute('href'), window.location.href);
            destino.searchParams.set('origem', origem);
            link.href = `${destino.pathname.split('/').pop()}${destino.search}${destino.hash}`;
        });

        botaoRetorno.addEventListener('click', (evento) => {
            if (origem !== 'cadastro' || !window.opener || window.opener.closed) return;
            evento.preventDefault();
            window.opener.focus();
            window.close();
            window.setTimeout(() => {
                if (!window.closed) window.location.replace(retorno.destino);
            }, 150);
        });
