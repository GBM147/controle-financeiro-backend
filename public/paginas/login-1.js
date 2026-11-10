        // --- 2. SCRIPT ORIGINAL DO SEU BACKEND ---

        function limparIdentidadeLocal() {
            window.GBMSession.clearIdentity();
        }

        function sincronizarIdentidadeLocal(sessao) {
            window.GBMSession.syncIdentity(sessao);
        }

        // gbm-session.js restaura a sessão diretamente, inclusive sem storage.

        function mascaraTelefone(input) {
            let v = input.value.replace(/\D/g, "");
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
            v = v.replace(/(\d)(\d{4})$/, "$1-$2");
            input.value = v;
        }

        // Função para alternar entre as telas de Login e Cadastro
        function alternarForms(tela) {
            document.getElementById('form-login').style.display = tela === 'login' ? 'block' : 'none';
            document.getElementById('form-cadastro').style.display = tela === 'cadastro' ? 'block' : 'none';
        }

        async function fazerLogin() {
            const emailCpf = document.getElementById('login-identificacao').value;
            const senha = document.getElementById('login-senha').value;
            const manterConectado = document.getElementById('login-manter-conectado').checked;

            if (!emailCpf || !senha) {
                gbmAlerta("Por favor, preencha o e-mail e a senha.", 'aviso');
                return;
            }

            await window.GBMSession.ready;
            fetch('/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identificacao: emailCpf,
                    senha,
                    manterConectado
                })
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    gbmAlerta(data.message || 'E-mail ou senha incorretos.', 'erro');
                    return;
                }

                document.getElementById('temp-user-id').value = data.userId;
                sincronizarIdentidadeLocal(data);

                if (data.verificado) {
                    // Todos os usuários (Premium e Gratuitos) entram direto no sistema
                    window.location.replace(window.GBMSession.destination());
                } else {
                    document.getElementById('form-login').style.display = 'none';
                    document.getElementById('form-escolha-validacao').style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erro de conexão:', error);
                gbmAlerta('Erro ao tentar conectar com o servidor.', 'erro');
            });
        }

        async function registrarUsuario() {
            const inputs = {
                nome: document.getElementById('cad-nome'),
                sobrenome: document.getElementById('cad-sobrenome'),
                email: document.getElementById('cad-email'),
                telefone: document.getElementById('cad-telefone'),
                senha: document.getElementById('cad-senha')
            };

            let camposVazios = false;

            for (const key in inputs) {
                inputs[key].classList.remove('campo-invalido');
                inputs[key].removeAttribute('aria-invalid');
                if (!inputs[key].value.trim()) {
                    inputs[key].classList.add('campo-invalido');
                    inputs[key].setAttribute('aria-invalid', 'true');
                    camposVazios = true;
                }
            }

            if (camposVazios) {
                return gbmAlerta("Todos os campos devem ser preenchidos. Confira os campos destacados.", 'aviso');
            }

            const nome = inputs.nome.value.trim();
            const sobrenome = inputs.sobrenome.value.trim();
            const email = inputs.email.value.trim();
            const telefone = inputs.telefone.value.trim();
            const senha = inputs.senha.value;

            const regexSenha = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
            if (!regexSenha.test(senha)) {
                inputs.senha.classList.add('campo-invalido');
                inputs.senha.setAttribute('aria-invalid', 'true');
                return gbmAlerta("A senha deve conter letras maiúsculas, minúsculas, números e ter no mínimo 8 caracteres.", 'aviso');
            }

            const aceitouTermos = document.getElementById('aceite-termos').checked;
            const aceitouPrivacidade = document.getElementById('aceite-privacidade').checked;
            if (!aceitouTermos) {
                return gbmAlerta("Você precisa aceitar os Termos de Uso para criar a sua conta.", 'aviso');
            }
            if (!aceitouPrivacidade) {
                return gbmAlerta("Você precisa ler e confirmar a Política de Privacidade para criar a sua conta.", 'aviso');
            }

            try {
                const resposta = await fetch('/cadastro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome,
                        sobrenome,
                        email,
                        telefone,
                        senha,
                        aceite_termos: aceitouTermos,
                        termos_versao: '2026.07',
                        consentimento_privacidade: aceitouPrivacidade
                    })
                });
                
                const json = await resposta.json();

                if (json.success) {
                    document.getElementById('form-cadastro').style.display = 'none';
                    document.getElementById('form-escolha-validacao').style.display = 'block';
                    document.getElementById('temp-user-id').value = json.userId;
                } else {
                    gbmAlerta("Erro: " + json.message, 'erro');
                }
            } catch (err) {
                console.error(err);
                gbmAlerta("Falha na comunicação com o servidor.", 'erro');
            }
        }

        async function enviarCodigo(canal) {
            const userId = document.getElementById('temp-user-id').value;
            gbmAlerta("Enviando código via " + canal + "...", 'aviso');

            const resposta = await fetch('/enviar-codigo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, canal })
            });

            const json = await resposta.json();
            if (json.success) {
                document.getElementById('form-escolha-validacao').style.display = 'none';
                document.getElementById('form-validar-codigo').style.display = 'block';
                iniciarCronometroReenvio('reenviar-link-codigo', 'reenviar-timer-codigo');
            } else {
                gbmAlerta("Erro ao enviar código: " + json.message, 'erro');
            }
        }

        function iniciarCronometroReenvio(linkId, timerId, segundos = 30) {
            const link = document.getElementById(linkId);
            const timer = document.getElementById(timerId);
            let restante = segundos;

            link.style.display = 'none';
            timer.style.display = 'inline';
            timer.innerText = `Reenviar em ${restante}s`;

            const intervalo = setInterval(() => {
                restante--;
                if (restante <= 0) {
                    clearInterval(intervalo);
                    timer.style.display = 'none';
                    link.style.display = 'inline';
                } else {
                    timer.innerText = `Reenviar em ${restante}s`;
                }
            }, 1000);
        }

        async function reenviarCodigoEmail() {
            const userId = document.getElementById('temp-user-id').value;
            try {
                const resposta = await fetch('/enviar-codigo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, canal: 'email' })
                });
                const json = await resposta.json();
                if (json.success) {
                    iniciarCronometroReenvio('reenviar-link-codigo', 'reenviar-timer-codigo');
                } else {
                    gbmAlerta("Erro ao reenviar: " + json.message, 'erro');
                }
            } catch (err) {
                gbmAlerta("Falha na comunicação com o servidor.", 'erro');
            }
        }

        async function reenviarCodigoSenha() {
            const email = document.getElementById('temp-recuperar-email').value;
            try {
                const resposta = await fetch('/esqueci-senha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const json = await resposta.json();
                if (json.success) {
                    iniciarCronometroReenvio('reenviar-link-senha', 'reenviar-timer-senha');
                } else {
                    gbmAlerta("Erro ao reenviar: " + json.message, 'erro');
                }
            } catch (err) {
                gbmAlerta("Falha na comunicação com o servidor.", 'erro');
            }
        }

        async function verificarCodigo() {
            const userId = document.getElementById('temp-user-id').value;
            const codigoDigitado = document.getElementById('codigo-input').value.trim();

            if (codigoDigitado.length !== 6) {
                return gbmAlerta("Por favor, insira o código completo de 6 dígitos.", 'aviso');
            }

            try {
                const resposta = await fetch('/validar-codigo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, codigo: codigoDigitado })
                });

                const json = await resposta.json();

                if (json.success) {
                    sincronizarIdentidadeLocal(json);
                    gbmAlerta("Conta validada com sucesso! Seu período gratuito de 30 dias começou! ", 'info');
                    window.location.href = 'pagamento.html';
                } else {
                    gbmAlerta("Erro: " + json.message, 'erro');
                }
            } catch (err) {
                console.error(err);
                gbmAlerta("Falha na comunicação com o servidor.", 'erro');
            }
        }

        function mostrarRecuperacao() {
            document.getElementById('form-login').style.display = 'none';
            document.getElementById('form-esqueci-senha').style.display = 'block';
        }

        async function solicitarRecuperacao() {
            const email = document.getElementById('recuperar-email').value.trim();
            if (!email) {
                return gbmAlerta("Digite seu e-mail.", 'aviso');
            }
            try {
                const resposta = await fetch('/esqueci-senha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const json = await resposta.json();
                if (json.success) {
                    document.getElementById('temp-recuperar-email').value = email;
                    document.getElementById('form-esqueci-senha').style.display = 'none';
                    document.getElementById('form-redefinir-senha').style.display = 'block';
                    iniciarCronometroReenvio('reenviar-link-senha', 'reenviar-timer-senha');
                    gbmAlerta("Se o e-mail existir, um código foi enviado.", 'aviso');
                } else {
                    gbmAlerta("Erro: " + json.message, 'erro');
                }
            } catch (err) {
                console.error(err);
                gbmAlerta("Falha na comunicação com o servidor.", 'erro');
            }
        }

        async function redefinirSenha() {
            const email = document.getElementById('temp-recuperar-email').value;
            const codigo = document.getElementById('redefinir-codigo').value.trim();
            const novaSenha = document.getElementById('redefinir-senha-nova').value;

            const regexSenha = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
            if (!regexSenha.test(novaSenha)) {
                return gbmAlerta("A senha deve conter letras maiúsculas, minúsculas, números e ter no mínimo 8 caracteres.", 'aviso');
            }

            try {
                const resposta = await fetch('/redefinir-senha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, codigo, novaSenha })
                });
                const json = await resposta.json();
                if (json.success) {
                    gbmAlerta("Senha redefinida com sucesso! Faça login.", 'info');
                    document.getElementById('form-redefinir-senha').style.display = 'none';
                    document.getElementById('form-login').style.display = 'block';
                } else {
                    gbmAlerta("Erro: " + json.message, 'erro');
                }
            } catch (err) {
                console.error(err);
                gbmAlerta("Falha na comunicação com o servidor.", 'erro');
            }
        }

        // --- ATALHO: ENTER SUBMETE O FORMULÁRIO VISÍVEL ---
        document.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter') return;

            const mapaFormularios = {
                'form-login': fazerLogin,
                'form-cadastro': registrarUsuario,
                'form-validar-codigo': verificarCodigo,
                'form-esqueci-senha': solicitarRecuperacao,
                'form-redefinir-senha': redefinirSenha
            };

            for (const [id, funcao] of Object.entries(mapaFormularios)) {
                const el = document.getElementById(id);
                if (el && el.style.display !== 'none') {
                    e.preventDefault();
                    funcao();
                    break;
                }
            }
        });

