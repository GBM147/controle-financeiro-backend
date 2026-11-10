        let objetivos = [];
        const hoje = new Date().toISOString().slice(0, 10);
        document.getElementById('contribuicao-data').value = hoje;

        async function carregarObjetivos() {
            try {
                objetivos = await gbmJson(await fetchApi('/objetivos'));
                renderizarObjetivos();
            } catch (erro) {
                document.getElementById('lista-objetivos').innerHTML =
                    `<div class="empty">${gbmEscapar(erro.message)}</div>`;
            }
        }

        function renderizarObjetivos() {
            const container = document.getElementById('lista-objetivos');
            if (!objetivos.length) {
                container.innerHTML = '<div class="empty">Nenhum objetivo criado ainda. Comece pela sua prioridade de poupança.</div>';
                return;
            }
            container.innerHTML = objetivos.map((objetivo) => {
                const guardado = Number(objetivo.valor_guardado || 0);
                const meta = Number(objetivo.valor_meta || 0);
                const percentual = meta > 0 ? Math.min((guardado / meta) * 100, 100) : 0;
                const concluido = objetivo.status === 'concluido' || guardado >= meta;
                return `
                    <article class="card objetivo-card" style="--objetivo-cor:${gbmEscapar(objetivo.cor)}">
                        <div class="objetivo-topo">
                            <div>
                                <h3>${gbmEscapar(objetivo.nome)}</h3>
                                <span class="pill ${concluido ? 'green' : 'blue'}">${concluido ? '✓ Concluída' : gbmData(objetivo.prazo)}</span>
                            </div>
                            <strong>${percentual.toFixed(1)}%</strong>
                        </div>
                        <div class="objetivo-valores">
                            <span>Guardado<br><strong>${gbmMoeda(guardado)}</strong></span>
                            <span style="text-align:right">Objetivo<br><strong>${gbmMoeda(meta)}</strong></span>
                        </div>
                        <div class="progress"><span style="width:${percentual}%;background:${gbmEscapar(objetivo.cor)}"></span></div>
                        <p class="stat">Faltam <strong>${gbmMoeda(Math.max(meta - guardado, 0))}</strong></p>
                        <div class="actions objetivo-actions">
                            <button class="btn btn-primary btn-small" data-acao="abrirContribuicao" data-args="[${objetivo.id}]">+ Contribuir</button>
                            <button class="btn btn-small" data-acao="editarObjetivo" data-args="[${objetivo.id}]">Editar</button>
                            <button class="btn btn-danger btn-small" data-acao="excluirObjetivo" data-args="[${objetivo.id}]">Excluir</button>
                        </div>
                    </article>
                `;
            }).join('');
        }

        document.getElementById('form-objetivo').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const id = document.getElementById('objetivo-id').value;
            const payload = {
                nome: document.getElementById('objetivo-nome').value,
                valor_meta: Number(document.getElementById('objetivo-valor').value),
                valor_inicial: Number(document.getElementById('objetivo-inicial').value || 0),
                prazo: document.getElementById('objetivo-prazo').value || null,
                cor: document.getElementById('objetivo-cor').value
            };
            try {
                await gbmJson(await fetchApi(id ? `/objetivos/${id}` : '/objetivos', {
                    method: id ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }));
                gbmToast(id ? 'Objetivo atualizado.' : 'Objetivo criado.');
                limparFormulario();
                carregarObjetivos();
            } catch (erro) {
                gbmToast(erro.message, 'erro');
            }
        });

        function editarObjetivo(id) {
            const objetivo = objetivos.find((item) => Number(item.id) === Number(id));
            if (!objetivo) return;
            document.getElementById('objetivo-id').value = objetivo.id;
            document.getElementById('objetivo-nome').value = objetivo.nome;
            document.getElementById('objetivo-valor').value = objetivo.valor_meta;
            document.getElementById('objetivo-inicial').value = 0;
            document.getElementById('objetivo-inicial').disabled = true;
            document.getElementById('objetivo-prazo').value = objetivo.prazo ? String(objetivo.prazo).slice(0, 10) : '';
            document.getElementById('objetivo-cor').value = objetivo.cor || '#55a7ff';
            document.getElementById('titulo-form').textContent = 'Editar objetivo';
            document.getElementById('cancelar-edicao').hidden = false;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function limparFormulario() {
            document.getElementById('form-objetivo').reset();
            document.getElementById('objetivo-id').value = '';
            document.getElementById('objetivo-cor').value = '#55a7ff';
            document.getElementById('objetivo-inicial').disabled = false;
            document.getElementById('titulo-form').textContent = 'Criar novo objetivo';
            document.getElementById('cancelar-edicao').hidden = true;
        }
        document.getElementById('cancelar-edicao').addEventListener('click', limparFormulario);

        function abrirContribuicao(id) {
            const objetivo = objetivos.find((item) => Number(item.id) === Number(id));
            document.getElementById('contribuicao-objetivo-id').value = id;
            document.getElementById('contribuicao-titulo').textContent = objetivo?.nome || '';
            document.getElementById('contribuicao-valor').value = '';
            document.getElementById('contribuicao-observacao').value = '';
            document.getElementById('dialog-contribuicao').showModal();
        }

        document.getElementById('form-contribuicao').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const id = document.getElementById('contribuicao-objetivo-id').value;
            try {
                await gbmJson(await fetchApi(`/objetivos/${id}/contribuicoes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        valor: Number(document.getElementById('contribuicao-valor').value),
                        data: document.getElementById('contribuicao-data').value,
                        observacao: document.getElementById('contribuicao-observacao').value
                    })
                }));
                document.getElementById('dialog-contribuicao').close();
                gbmToast('Contribuição adicionada.');
                carregarObjetivos();
            } catch (erro) {
                gbmToast(erro.message, 'erro');
            }
        });

        async function excluirObjetivo(id) {
            if (!confirm('Excluir este objetivo e todo o histórico de contribuições?')) return;
            try {
                await gbmJson(await fetchApi(`/objetivos/${id}`, { method: 'DELETE' }));
                gbmToast('Objetivo excluído.');
                carregarObjetivos();
            } catch (erro) {
                gbmToast(erro.message, 'erro');
            }
        }

        carregarObjetivos();
