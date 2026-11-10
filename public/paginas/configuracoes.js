        function pegarUserId() {
            return window.GBMSession.getUserId();
        }


        const senha = document.getElementById('senha-atual');
        const frase = document.getElementById('frase-confirmacao');
        const confirmo = document.getElementById('confirmo-exclusao');
        const botaoExcluir = document.getElementById('btn-excluir');
        const mensagem = document.getElementById('mensagem');

        function informar(texto, tipo = '') {
            mensagem.textContent = texto;
            mensagem.className = tipo;
        }

        async function excluirConta() {
            if (!senha.value) {
                informar('Informe sua senha atual.', 'erro');
                senha.focus();
                return;
            }
            if (frase.value !== 'EXCLUIR MINHA CONTA') {
                informar('Digite exatamente a frase de confirmação.', 'erro');
                frase.focus();
                return;
            }
            if (!confirmo.checked) {
                informar('Marque a confirmação de que entende a exclusão.', 'erro');
                return;
            }
            if (!window.confirm('Última confirmação: deseja apagar a conta e todos os seus dados permanentemente?')) {
                return;
            }

            botaoExcluir.disabled = true;
            botaoExcluir.textContent = 'Excluindo conta...';
            informar('Removendo seus dados com segurança...');

            try {
                const resposta = await fetchApi('/minha-conta', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senha: senha.value, confirmacao: frase.value })
                });
                const dados = await resposta.json().catch(() => ({}));
                if (!resposta.ok || !dados.success) {
                    throw new Error(dados.message || 'Não foi possível excluir a conta.');
                }

                limparIdentidadeLocal();
                informar('Conta excluída. Você será direcionada para a tela inicial.', 'sucesso');
                setTimeout(() => { window.location.href = 'index.html'; }, 1200);
            } catch (erro) {
                informar(erro.message, 'erro');
                botaoExcluir.disabled = false;
                botaoExcluir.textContent = 'Excluir minha conta definitivamente';
            }
        }

        botaoExcluir.addEventListener('click', excluirConta);

        // Aparência: claro, escuro ou seguir o sistema (gbm-tema.js guarda a escolha).
        (() => {
            const opcoes = [...document.querySelectorAll('input[name="tema"]')];
            if (!opcoes.length || !window.GBMTema) return;
            const marcar = () => {
                const atual = window.GBMTema.preferencia();
                opcoes.forEach((opcao) => { opcao.checked = opcao.value === atual; });
            };
            opcoes.forEach((opcao) => opcao.addEventListener('change', () => {
                if (opcao.checked) window.GBMTema.escolher(opcao.value);
            }));
            window.addEventListener('gbm:tema', marcar);
            marcar();
        })();
