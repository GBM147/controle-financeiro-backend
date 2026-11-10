        const TERMOS_VERSAO = '2026.07';
        const statusTermos = document.getElementById('termos-status');
        const botaoAceitar = document.getElementById('aceitar-termos');
        const cartaoAceite = document.getElementById('cartao-aceite');
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

        function mostrarStatus(texto, aceito) {
            statusTermos.textContent = texto;
            botaoAceitar.hidden = Boolean(aceito);
        }

        async function carregarAceite() {
            try {
                const resposta = await fetch('/termos/status', {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' }
                });
                if (resposta.status === 401) {
                    mostrarStatus('Entre na sua conta para consultar ou registrar o aceite. A leitura dos Termos é pública.', true);
                    return;
                }
                const dados = await resposta.json();
                if (!resposta.ok) throw new Error(dados.error || 'Não foi possível consultar o aceite.');
                if (dados.termos_versao === TERMOS_VERSAO && dados.termos_aceitos_em) {
                    const data = new Date(dados.termos_aceitos_em).toLocaleString('pt-BR');
                    mostrarStatus(`Versão ${TERMOS_VERSAO} aceita em ${data}.`, true);
                    return;
                }
                mostrarStatus(`Sua conta ainda não aceitou a versão ${TERMOS_VERSAO}. Leia o documento antes de continuar.`, false);
            } catch (erro) {
                mostrarStatus(erro.message, true);
            }
        }

        botaoAceitar.addEventListener('click', async () => {
            botaoAceitar.disabled = true;
            try {
                const resposta = await fetch('/termos/aceitar', {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ aceito: true })
                });
                const dados = await resposta.json();
                if (!resposta.ok) throw new Error(dados.error || 'Não foi possível registrar o aceite.');
                await carregarAceite();
            } catch (erro) {
                mostrarStatus(erro.message, false);
            } finally {
                botaoAceitar.disabled = false;
            }
        });

        if (origem === 'cadastro') {
            cartaoAceite.hidden = true;
        } else {
            carregarAceite();
        }
