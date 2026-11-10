        let contas = [];

        async function carregarContas() {
            try {
                contas = await gbmJson(await fetchApi('/contas'));
                const container = document.getElementById('lista-contas');
                if (!contas.length) {
                    container.innerHTML = '<div class="empty">Crie sua primeira conta para organizar os lançamentos.</div>';
                    return;
                }
                container.innerHTML = contas.map((conta) => `
                    <article class="card conta-card${Number(conta.ativa) ? '' : ' arquivada'}">
                        <div class="conta-topo">
                            <div>
                                <h3>${gbmEscapar(conta.nome)}</h3>
                                <span class="pill ${Number(conta.ativa) ? 'green' : 'amber'}">${Number(conta.ativa) ? 'Ativa' : 'Arquivada'}</span>
                                <span class="pill">${gbmEscapar(conta.tipo_conta)}</span>
                            </div>
                            <span class="pill blue">${gbmEscapar(conta.banco || 'Sem banco')}</span>
                        </div>
                        <div class="conta-saldo">${gbmMoeda(conta.saldo)}</div>
                        <div class="conta-detalhes">
                            <div class="stat">Movimentações<br><strong>${Number(conta.quantidade_transacoes)}</strong></div>
                            <div class="stat">Última<br><strong class="conta-data">${gbmData(conta.ultima_movimentacao)}</strong></div>
                        </div>
                        <div class="actions">
                            <button class="btn btn-small" data-acao="editarConta" data-args="[${conta.id}]">Editar</button>
                            <button class="btn btn-small" data-acao="alternarConta" data-args="[${conta.id}, ${Number(conta.ativa) ? 'false' : 'true'}]">${Number(conta.ativa) ? 'Arquivar' : 'Reativar'}</button>
                            <button class="btn btn-danger btn-small" data-acao="excluirConta" data-args="[${conta.id}]">Excluir</button>
                        </div>
                    </article>
                `).join('');
            } catch (erro) {
                document.getElementById('lista-contas').innerHTML = `<div class="empty">${gbmEscapar(erro.message)}</div>`;
            }
        }

        document.getElementById('form-conta').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const id = document.getElementById('conta-id').value;
            const payload = {
                nome: document.getElementById('conta-nome').value,
                banco: document.getElementById('conta-banco').value,
                tipo_conta: document.getElementById('conta-tipo').value,
                saldo_inicial: Number(document.getElementById('conta-saldo').value || 0),
                ativa: true
            };
            try {
                await gbmJson(await fetchApi(id ? `/contas/${id}` : '/contas', {
                    method: id ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }));
                gbmToast(id ? 'Conta atualizada.' : 'Conta criada.');
                limparConta();
                carregarContas();
            } catch (erro) { gbmToast(erro.message, 'erro'); }
        });

        function editarConta(id) {
            const conta = contas.find((item) => Number(item.id) === Number(id));
            if (!conta) return;
            document.getElementById('conta-id').value = conta.id;
            document.getElementById('conta-nome').value = conta.nome_personalizado || conta.nome;
            document.getElementById('conta-banco').value = conta.banco || '';
            document.getElementById('conta-tipo').value = conta.tipo_conta || 'corrente';
            document.getElementById('campo-saldo').hidden = true;
            document.getElementById('titulo-conta').textContent = 'Editar conta';
            document.getElementById('cancelar-conta').hidden = false;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function limparConta() {
            document.getElementById('form-conta').reset();
            document.getElementById('conta-id').value = '';
            document.getElementById('campo-saldo').hidden = false;
            document.getElementById('titulo-conta').textContent = 'Adicionar conta';
            document.getElementById('cancelar-conta').hidden = true;
        }
        document.getElementById('cancelar-conta').addEventListener('click', limparConta);

        async function alternarConta(id, ativa) {
            const conta = contas.find((item) => Number(item.id) === Number(id));
            try {
                await gbmJson(await fetchApi(`/contas/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: conta.nome_personalizado || conta.nome,
                        banco: conta.banco,
                        tipo_conta: conta.tipo_conta,
                        ativa
                    })
                }));
                carregarContas();
            } catch (erro) { gbmToast(erro.message, 'erro'); }
        }

        async function excluirConta(id) {
            if (!confirm('Deseja excluir esta conta? Se houver dados vinculados, você poderá movê-los ou apagá-los.')) return;
            try {
                let resposta = await fetchApi(`/contas/${id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                if (resposta.status === 409) {
                    const destinos = contas.filter((conta) => (
                        Number(conta.id) !== Number(id) && Number(conta.ativa) !== 0
                    ));
                    const lista = destinos.map((conta, indice) => (
                        `${indice + 1} — ${conta.nome}`
                    )).join('\n');
                    const escolha = prompt(
                        `Esta conta possui dados vinculados.\n\n`
                        + (lista ? `Digite o número da conta para mover todos os dados:\n${lista}\n\n` : '')
                        + `Digite 0 para apagar também as transações, importações e recorrências.\n`
                        + `Clique em Cancelar para manter a conta.`
                    );
                    if (escolha === null) return;
                    const numero = Number(escolha);
                    let payload;
                    if (numero === 0) {
                        if (!confirm('Apagar definitivamente todos os dados desta conta? Esta ação não pode ser desfeita.')) return;
                        payload = { excluir_transacoes: true };
                    } else if (Number.isInteger(numero) && destinos[numero - 1]) {
                        payload = { mover_para: Number(destinos[numero - 1].id) };
                    } else {
                        gbmToast('Escolha inválida. Nenhuma alteração foi feita.', 'erro');
                        return;
                    }
                    resposta = await fetchApi(`/contas/${id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }
                await gbmJson(resposta);
                gbmToast('Conta excluída.');
                carregarContas();
            } catch (erro) { gbmToast(erro.message, 'erro'); }
        }

        carregarContas();
