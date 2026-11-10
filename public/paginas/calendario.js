        const hoje = new Date();
        document.getElementById('rec-inicio').value = hoje.toISOString().slice(0,10);
        document.getElementById('mes-calendario').value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;

        async function prepararContas() {
            const contas = await gbmJson(await fetchApi('/contas'));
            document.getElementById('rec-conta').innerHTML = contas
                .filter((conta) => Number(conta.ativa) === 1)
                .map((conta) => `<option value="${conta.id}">${gbmEscapar(conta.nome)}</option>`).join('');
        }

        document.getElementById('form-recorrencia').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const botao = evento.submitter || evento.currentTarget.querySelector('[type="submit"]');
            const textoOriginal = botao?.textContent;
            if (botao) {
                botao.disabled = true;
                botao.textContent = 'Salvando...';
            }
            try {
                await gbmJson(await fetchApi('/recorrencias', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        descricao:document.getElementById('rec-desc').value,
                        valor:Number(document.getElementById('rec-valor').value),
                        tipo:document.getElementById('rec-tipo').value,
                        categoria:document.getElementById('rec-categoria').value,
                        dia_mes:Number(document.getElementById('rec-dia').value),
                        conta_id:Number(document.getElementById('rec-conta').value),
                        data_inicio:document.getElementById('rec-inicio').value,
                        data_fim:document.getElementById('rec-fim').value || null
                    })
                }));
                gbmToast('Recorrência criada com sucesso.');
                document.getElementById('form-recorrencia').reset();
                document.getElementById('rec-inicio').value = hoje.toISOString().slice(0,10);
                await Promise.all([carregarRecorrencias(), carregarCalendario()]);
            } catch (erro) { gbmToast(erro.message,'erro'); }
            finally {
                if (botao) {
                    botao.disabled = false;
                    botao.textContent = textoOriginal;
                }
            }
        });

        async function carregarRecorrencias() {
            try {
                const itens = await gbmJson(await fetchApi('/recorrencias'));
                document.getElementById('lista-recorrencias').innerHTML = itens.length ? itens.map((item) => `
                    <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)">
                        <div style="display:flex;justify-content:space-between;gap:10px">
                            <strong>${gbmEscapar(item.descricao)}</strong>
                            <span class="${item.tipo === 'Receita' ? 'tipo-receita' : 'tipo-despesa'}">${gbmMoeda(item.valor)}</span>
                        </div>
                        <p style="color:var(--muted);font-size:.78rem">Todo dia ${item.dia_mes} · ${gbmEscapar(item.conta)}</p>
                        <div class="actions">
                            <button class="btn btn-small" data-acao="alternarRecorrencia" data-args="[${item.id}, ${Number(item.ativa) ? 'false' : 'true'}]">${Number(item.ativa) ? 'Pausar' : 'Ativar'}</button>
                            <button class="btn btn-danger btn-small" data-acao="excluirRecorrencia" data-args="[${item.id}]">Excluir</button>
                        </div>
                    </div>`).join('') : '<div class="empty">Nenhuma recorrência cadastrada.</div>';
            } catch (erro) { gbmToast(erro.message,'erro'); }
        }

        async function alternarRecorrencia(id, ativa) {
            try {
                await gbmJson(await fetchApi(`/recorrencias/${id}`, {
                    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ativa})
                }));
                gbmToast(`Recorrência ${ativa ? 'ativada' : 'pausada'} com sucesso.`);
                await Promise.all([carregarRecorrencias(), carregarCalendario()]);
            } catch (erro) { gbmToast(erro.message,'erro'); }
        }

        async function excluirRecorrencia(id) {
            if (!confirm('Excluir esta recorrência? Os lançamentos já realizados serão mantidos.')) return;
            try {
                await gbmJson(await fetchApi(`/recorrencias/${id}`, {method:'DELETE'}));
                gbmToast('Recorrência excluída com sucesso.');
                await Promise.all([carregarRecorrencias(), carregarCalendario()]);
            } catch (erro) { gbmToast(erro.message,'erro'); }
        }

        async function carregarCalendario() {
            const [ano, mes] = document.getElementById('mes-calendario').value.split('-');
            try {
                const dados = await gbmJson(await fetchApi(`/calendario-financeiro?ano=${ano}&mes=${Number(mes)}`));
                document.getElementById('saldo-atual').textContent = gbmMoeda(dados.saldo_atual);
                document.getElementById('saldo-previsto').textContent = gbmMoeda(dados.saldo_previsto);
                document.getElementById('saldo-previsto').style.color = Number(dados.saldo_previsto) >= 0 ? 'var(--green)' : 'var(--red)';
                document.getElementById('eventos-calendario').innerHTML = dados.eventos.length ? dados.eventos.map((item) => {
                    const data = new Date(`${String(item.data).slice(0,10)}T12:00:00`);
                    return `<div class="evento">
                        <div class="evento-data"><strong>${data.getDate()}</strong>${data.toLocaleDateString('pt-BR',{weekday:'short'})}</div>
                        <div><strong>${gbmEscapar(item.descricao)}</strong><br><span class="pill ${item.status === 'prevista' ? 'amber':'green'}">${gbmEscapar(item.status)}</span> <span class="pill">${gbmEscapar(item.categoria)}</span></div>
                        <strong class="evento-valor ${item.tipo === 'Receita' ? 'receita':'despesa'}">${item.tipo === 'Receita' ? '+' : '-'} ${gbmMoeda(item.valor)}</strong>
                    </div>`;
                }).join('') : '<div class="empty">Nenhuma movimentação neste mês.</div>';
            } catch (erro) { gbmToast(erro.message,'erro'); }
        }
        document.getElementById('mes-calendario').addEventListener('change', carregarCalendario);
        Promise.all([prepararContas(),carregarRecorrencias(),carregarCalendario()]).catch((erro)=>gbmToast(erro.message,'erro'));
