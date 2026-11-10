        document.getElementById('formFeedback').addEventListener('submit', async function (e) {
            e.preventDefault();
            const btnSubmit = document.getElementById('btnSubmit');
            const statusDiv = document.getElementById('mensagem-status');
            const nome = document.getElementById('nome').value;
            const email = document.getElementById('email').value;
            const assunto = document.getElementById('assunto').value;
            const mensagem = document.getElementById('mensagem').value;

            btnSubmit.innerText = 'Enviando...';
            btnSubmit.disabled = true;

            try {
                const response = await fetch('/api/enviar-feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, email, assunto, mensagem })
                });

                if (response.ok) {
                    document.getElementById('formFeedback').reset();
                    statusDiv.className = 'sucesso';
                    statusDiv.innerText = 'Mensagem enviada com sucesso! Retornaremos em breve.';
                    statusDiv.style.display = 'block';
                } else {
                    let motivo = '';
                    try { motivo = (await response.json()).error || ''; } catch (e) {}
                    throw new Error(motivo || 'Falha no envio');
                }
            } catch (error) {
                statusDiv.className = 'erro';
                statusDiv.innerText = 'Erro ao enviar mensagem: ' + (error.message || 'tente novamente mais tarde.');
                statusDiv.style.display = 'block';
            } finally {
                btnSubmit.innerText = 'Enviar mensagem';
                btnSubmit.disabled = false;
            }
        });
