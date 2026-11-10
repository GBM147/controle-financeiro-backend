        let percentuaisSelecionados = [50, 70];
        let metasCarregadas = [];

        function norm(v) {
            return [...new Set((Array.isArray(v) ? v : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 100))].sort((a, b) => a - b);
        }
        function renderChips() {
            document.getElementById('chips').innerHTML = percentuaisSelecionados.map(p => `<span class="chip">${p}%<button type="button" data-acao="removerPercentual" data-args="[${p}]">Remover</button></span>`).join('');
        }
        function adicionarPercentual() {
            const i = document.getElementById('novo-percentual'), p = Number(i.value);
            if (!Number.isInteger(p) || p < 1 || p > 100) return gbmToast('Digite um percentual inteiro entre 1% e 100%.', 'erro');
            percentuaisSelecionados = norm([...percentuaisSelecionados, p]);
            i.value = '';
            renderChips();
            i.focus();
        }
        function removerPercentual(p) {
            percentuaisSelecionados = percentuaisSelecionados.filter(v => v !== p);
            renderChips();
        }
        function editarLimite(i) {
            const m = metasCarregadas[i];
            if (!m) return;
            const s = document.getElementById('nova-meta-cat');
            if (![...s.options].some(o => o.value === m.categoria)) s.add(new Option(m.categoria, m.categoria));
            s.value = m.categoria;
            document.getElementById('nova-meta-valor').value = Number(m.limite || 0).toFixed(2);
            percentuaisSelecionados = norm(m.percentuais_alerta);
            renderChips();
            document.getElementById('form-limite').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        async function carregarEditor() {
            try {
                const dados = await gbmJson(await fetchApi('/metas-resumo'));
                metasCarregadas = (Array.isArray(dados) ? dados : (dados.data || [])).filter(m => m.categoria);
                const c = document.getElementById('editor-container');
                if (!metasCarregadas.length) {
                    c.innerHTML = '<div class="empty">Você ainda não definiu limites. Use o formulário acima para criar o primeiro.</div>';
                    return;
                }
                c.innerHTML = metasCarregadas.map((m, i) => {
                    const limite = Number(m.limite) || 0, gasto = Number(m.gasto) || 0;
                    const p = limite > 0 ? gasto / limite * 100 : 0, w = Math.min(p, 100);
                    const cor = p < 75 ? 'var(--green)' : p < 100 ? 'var(--amber)' : 'var(--red)';
                    const ps = norm(m.percentuais_alerta);
                    return `<article class="card">
                        <div class="meta-head"><strong>${gbmEscapar(m.categoria)}</strong><strong class="gbm-count-up" style="color:${cor}">${p.toFixed(1)}%</strong></div>
                        <div class="progress"><span data-width="${w}%" style="background:${cor}"></span></div>
                        <div style="display:flex;justify-content:space-between;gap:10px;margin-top:10px;color:var(--muted);font-size:.82rem">
                            <span>${gbmMoeda(gasto)} de ${gbmMoeda(limite)}</span><span>Gasto</span>
                        </div>
                        <div class="alertas">
                            <div><span style="font-size:.75rem;color:var(--muted)">Avisos configurados</span><div class="chips">${ps.map(x => `<span class="chip">${x}%</span>`).join('')}</div></div>
                            <button class="btn btn-small" data-acao="editarLimite" data-args="[${i}]">Editar</button>
                        </div>
                    </article>`;
                }).join('');
                document.querySelectorAll('.progress > span[data-width]').forEach(el => observadorBarras.observe(el));
                document.querySelectorAll('.gbm-count-up').forEach(el => observadorContagem.observe(el));
            } catch (erro) { gbmToast(erro.message, 'erro'); }
        }
        async function salvarNovoLimite() {
            const categoria = document.getElementById('nova-meta-cat').value;
            const valor_limite = Number(document.getElementById('nova-meta-valor').value);
            const percentuais_alerta = norm(percentuaisSelecionados);
            if (!categoria || !Number.isFinite(valor_limite) || valor_limite <= 0) return gbmToast('Selecione uma categoria e informe um limite maior que zero.', 'erro');
            if (!percentuais_alerta.length) return gbmToast('Adicione pelo menos um percentual de aviso.', 'erro');
            const b = document.getElementById('btn-salvar');
            b.disabled = true;
            b.textContent = 'Salvando...';
            try {
                await gbmJson(await fetchApi('/atualizar-meta-alerta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoria, valor_limite, percentuais_alerta })
                }));
                document.getElementById('nova-meta-cat').value = '';
                document.getElementById('nova-meta-valor').value = '';
                percentuaisSelecionados = [50, 70];
                renderChips();
                await carregarEditor();
                gbmToast('Limite e avisos salvos com sucesso!');
            } catch (erro) { gbmToast(erro.message, 'erro'); }
            finally { b.disabled = false; b.textContent = 'Salvar limite'; }
        }
        document.getElementById('novo-percentual').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionarPercentual(); } });
        renderChips();
        carregarEditor();
