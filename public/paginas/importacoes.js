    let previa = null;
    let contas = [];

    async function carregarContas() {
        contas = await gbmJson(await fetchApi('/contas'));
        const ativas = contas.filter((conta) => Number(conta.ativa) === 1);
        document.getElementById('conta-importacao').innerHTML = ativas.length
            ? ativas.map((conta) => `<option value="${conta.id}">${gbmEscapar(conta.nome)}</option>`).join('')
            : '<option value="">Crie uma conta primeiro</option>';
    }

    document.getElementById('btn-analisar').addEventListener('click', async () => {
        const arquivo = document.getElementById('arquivo-extrato').files[0];
        if (!arquivo) return gbmToast('Selecione um arquivo OFX ou PDF.', 'erro');
        if (!document.getElementById('conta-importacao').value) return gbmToast('Crie e selecione uma conta.', 'erro');
        const extensao = arquivo.name.split('.').pop().toLowerCase();
        if (!['ofx', 'pdf'].includes(extensao)) return gbmToast('Formato não aceito.', 'erro');
        const formData = new FormData();
        formData.append('arquivo', arquivo);
        const botao = document.getElementById('btn-analisar');
        botao.disabled = true;
        botao.textContent = 'Analisando...';
        try {
            const endpoint = extensao === 'ofx' ? '/ofx-extrato/preview' : '/pdf-extrato/preview';
            previa = await gbmJson(await fetchApi(endpoint, { method: 'POST', body: formData }));
            previa.tipo_arquivo = extensao.toUpperCase();
            previa.nome_arquivo = previa.nome_arquivo || arquivo.name;
            previa.transacoes = previa.transacoes.map((item) => ({ ...item, selecionada: true }));
            renderizarPrevia();
        } catch (erro) {
            gbmToast(erro.message, 'erro');
        } finally {
            botao.disabled = false;
            botao.textContent = 'Analisar arquivo';
        }
    });

    function renderizarPrevia() {
        const selecionadas = previa.transacoes.filter((item) => item.selecionada);
        const total = selecionadas.reduce((soma, item) => soma + Number(item.valor || 0), 0);
        document.getElementById('previa-banco').textContent = previa.banco_detectado || 'Outro banco';
        document.getElementById('previa-quantidade').textContent = `${selecionadas.length} selecionadas`;
        document.getElementById('previa-total').textContent = gbmMoeda(total);
        document.getElementById('corpo-previa').innerHTML = previa.transacoes.map((item, indice) => `
            <tr style="${item.selecionada ? '' : 'opacity:.38'}">
                <td>${gbmData(item.data)}</td>
                <td title="${gbmEscapar(item.descricao)}">${gbmEscapar(String(item.descricao).slice(0, 48))}</td>
                <td><input value="${gbmEscapar(item.categoria || 'Outros')}" data-acao-change="alterarCategoria" data-args-change="[${indice}]" data-com-valor-change></td>
                <td class="${item.tipo === 'Receita' ? 'tipo-receita' : 'tipo-despesa'}">${gbmEscapar(item.tipo)}</td>
                <td>${gbmMoeda(item.valor)}</td>
                <td><button class="btn btn-small" data-acao="alternarLinha" data-args="[${indice}]">${item.selecionada ? 'Remover' : 'Incluir'}</button></td>
            </tr>
        `).join('');
        document.getElementById('secao-previa').hidden = false;
        document.getElementById('secao-previa').scrollIntoView({ behavior:'smooth', block:'start' });
    }

    function alterarCategoria(indice, valor) { previa.transacoes[indice].categoria = valor.trim() || 'Outros'; }
    function alternarLinha(indice) { previa.transacoes[indice].selecionada = !previa.transacoes[indice].selecionada; renderizarPrevia(); }

    document.getElementById('btn-confirmar').addEventListener('click', confirmarImportacao);
    async function confirmarImportacao() {
        const transacoes = previa.transacoes.filter((item) => item.selecionada);
        if (!transacoes.length) return gbmToast('Selecione pelo menos uma transação.', 'erro');
        const botao = document.getElementById('btn-confirmar');
        botao.disabled = true;
        try {
            const dados = await gbmJson(await fetchApi('/importacoes/confirmar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conta_id: Number(document.getElementById('conta-importacao').value),
                    tipo_arquivo: previa.tipo_arquivo,
                    nome_arquivo: previa.nome_arquivo,
                    banco: previa.banco_detectado,
                    hash_arquivo: previa.hash_arquivo,
                    assinatura_previa: previa.assinatura_previa,
                    saldo_detectado: previa.saldo_detectado,
                    transacoes
                })
            }));
            gbmToast(dados.message);
            previa = null;
            document.getElementById('secao-previa').hidden = true;
            document.getElementById('arquivo-extrato').value = '';
            carregarHistorico();
        } catch (erro) {
            gbmToast(erro.message, 'erro');
        } finally { botao.disabled = false; }
    }

    function atualizarStatsImportacoes(lotes) {
        const importadas = lotes.reduce((soma, l) => soma + Number(l.quantidade_inseridas || 0), 0);
        const duplicadas = lotes.reduce((soma, l) => soma + Number(l.quantidade_duplicadas || 0), 0);
        document.getElementById('stat-importadas').textContent = importadas;
        document.getElementById('stat-arquivos').textContent = lotes.length;
        document.getElementById('stat-duplicadas').textContent = duplicadas;
    }

    async function carregarHistorico() {
        try {
            const lotes = await gbmJson(await fetchApi('/importacoes'));
            atualizarStatsImportacoes(lotes);
            const container = document.getElementById('historico-importacoes');
            if (!lotes.length) {
                container.innerHTML = '<div class="empty">Nenhuma importação registrada ainda.</div>';
                return;
            }
            container.innerHTML = `<table>
                <thead><tr><th>Data</th><th>Arquivo</th><th>Conta</th><th>Resultado</th><th>Status</th><th></th></tr></thead>
                <tbody>${lotes.map((lote) => `
                    <tr>
                        <td>${new Date(lote.criado_em).toLocaleString('pt-BR')}</td>
                        <td>${gbmEscapar(lote.nome_arquivo || lote.tipo_arquivo)}<br><span class="pill">${gbmEscapar(lote.banco || '')}</span></td>
                        <td>${gbmEscapar(lote.conta)}</td>
                        <td>${lote.quantidade_inseridas} novas / ${lote.quantidade_duplicadas} duplicadas</td>
                        <td><span class="pill ${lote.status === 'concluida' ? 'green' : 'amber'}">${gbmEscapar(lote.status)}</span></td>
                        <td>${lote.status === 'concluida' ? `<button class="btn btn-danger btn-small" data-acao="desfazerImportacao" data-args="[${lote.id}]">Desfazer</button>` : ''}</td>
                    </tr>`).join('')}</tbody>
            </table>`;
        } catch (erro) {
            document.getElementById('historico-importacoes').innerHTML = `<div class="empty">${gbmEscapar(erro.message)}</div>`;
        }
    }

    async function desfazerImportacao(id) {
        if (!confirm('Remover todas as transações adicionadas por esta importação?')) return;
        try {
            const dados = await gbmJson(await fetchApi(`/importacoes/${id}`, { method:'DELETE' }));
            gbmToast(`${dados.removidas} transação(ões) removida(s).`);
            carregarHistorico();
        } catch (erro) { gbmToast(erro.message, 'erro'); }
    }

    carregarAtalhoPerfilCabecalho();
    Promise.all([carregarContas(), carregarHistorico()]).catch((erro) => gbmToast(erro.message, 'erro'));
