        function pegarUserId() {
            return window.GBMSession.getUserId();
        }


        const foto = document.getElementById('foto-perfil');
        const capa = document.getElementById('capa-perfil');
        const nome = document.getElementById('nome-exibicao');
        const mensagem = document.getElementById('mensagem');
        const botaoSalvar = document.getElementById('btn-salvar');

        function informar(texto, tipo = '') {
            mensagem.innerText = texto;
            mensagem.className = tipo;
        }

        async function lerResposta(resposta) {
            const dados = await resposta.json();
            if (!resposta.ok || !dados.success) {
                throw new Error(dados.message || 'Não foi possível concluir a operação.');
            }
            return dados;
        }

        async function carregarPerfil() {
            try {
                const dados = await lerResposta(await fetchApi('/perfil'));
                const perfil = dados.perfil;

                nome.value = perfil.nome_exibicao || perfil.nome || '';

                if (perfil.foto_perfil_url) {
                    foto.src = perfil.foto_perfil_url;
                }

                if (perfil.capa_perfil_url) {
                    capa.style.backgroundImage = 'url("' + perfil.capa_perfil_url + '")';
                }
            } catch (erro) {
                informar(erro.message, 'erro');
            }
        }

        async function enviarImagem(input, campo, rota, destino) {
            const arquivo = input.files[0];
            if (!arquivo) return;

            if (arquivo.size > 5 * 1024 * 1024) {
                informar('A imagem deve ter no máximo 5 MB.', 'erro');
                input.value = '';
                return;
            }

            const formData = new FormData();
            formData.append(campo, arquivo);
            informar('Enviando imagem...');

            try {
                const dados = await lerResposta(await fetchApi(rota, {
                    method: 'POST',
                    body: formData
                }));

                if (destino === 'foto') {
                    foto.src = dados.url;
                } else {
                    capa.style.backgroundImage = 'url("' + dados.url + '")';
                }

                informar(dados.message, 'sucesso');
            } catch (erro) {
                informar(erro.message, 'erro');
            } finally {
                input.value = '';
            }
        }

        document.getElementById('input-foto').addEventListener('change', function () {
            enviarImagem(this, 'foto', '/perfil/foto', 'foto');
        });

        document.getElementById('input-capa').addEventListener('change', function () {
            enviarImagem(this, 'capa', '/perfil/capa', 'capa');
        });

        botaoSalvar.addEventListener('click', async function () {
            const nomeExibicao = nome.value.trim();
            if (!nomeExibicao) {
                informar('Informe o nome que será exibido.', 'erro');
                return;
            }

            botaoSalvar.disabled = true;
            botaoSalvar.innerText = 'Salvando...';

            try {
                const dados = await lerResposta(await fetchApi('/perfil', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome_exibicao: nomeExibicao })
                }));
                informar(dados.message, 'sucesso');
            } catch (erro) {
                informar(erro.message, 'erro');
            } finally {
                botaoSalvar.disabled = false;
                botaoSalvar.innerText = 'Salvar perfil';
            }
        });

        carregarPerfil();
