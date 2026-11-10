        async function carregarNotificacoes() {
            try {
                const status = document.getElementById('filtro-status').value;
                const tipo = document.getElementById('filtro-tipo').value;
                const itens = await gbmJson(await fetchApi(`/notificacoes?status=${status}&tipo=${tipo}`));
                document.getElementById('lista-notificacoes').innerHTML = itens.length ? itens.map((item) => `
                    <article class="notificacao ${Number(item.lida) ? '' : 'nao-lida'}">
                        <div style="display:flex;justify-content:space-between;gap:12px">
                            <span class="pill ${Number(item.lida) ? '' : 'green'}">${Number(item.lida) ? 'Lida' : 'Nova'}</span>
                            <small style="color:var(--muted)">${new Date(item.data_criacao).toLocaleString('pt-BR')}</small>
                        </div>
                        <p style="margin:11px 0 7px;line-height:1.5">${gbmEscapar(item.mensagem)}</p>
                        <span class="pill">${gbmEscapar(item.categoria || item.tipo)}</span>
                    </article>`).join('') : '<div class="empty">Nenhuma notificação encontrada.</div>';
            } catch (erro) { gbmToast(erro.message,'erro'); }
        }
        async function carregarPreferencias() {
            try {
                const p = await gbmJson(await fetchApi('/notificacoes/preferencias'));
                document.getElementById('pref-site').checked = Number(p.notificacao_site) === 1;
                document.getElementById('pref-email').checked = Number(p.notificacao_email) === 1;
                document.getElementById('pref-inicio').value = p.horario_silencio_inicio ? String(p.horario_silencio_inicio).slice(0,5) : '';
                document.getElementById('pref-fim').value = p.horario_silencio_fim ? String(p.horario_silencio_fim).slice(0,5) : '';
            } catch (erro) { gbmToast(erro.message,'erro'); }
        }
        document.getElementById('filtro-status').addEventListener('change',carregarNotificacoes);
        document.getElementById('filtro-tipo').addEventListener('change',carregarNotificacoes);
        document.getElementById('marcar-todas').addEventListener('click',async()=>{
            try {
                await gbmJson(await fetchApi('/notificacoes/marcar-todas-lidas',{method:'POST'}));
                carregarNotificacoes();
            } catch(erro){gbmToast(erro.message,'erro')}
        });
        document.getElementById('salvar-preferencias').addEventListener('click',async()=>{
            try {
                await gbmJson(await fetchApi('/notificacoes/preferencias',{
                    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
                        notificacao_site:document.getElementById('pref-site').checked,
                        notificacao_email:document.getElementById('pref-email').checked,
                        horario_silencio_inicio:document.getElementById('pref-inicio').value || null,
                        horario_silencio_fim:document.getElementById('pref-fim').value || null
                    })
                }));
                gbmToast('Preferências salvas.');
            } catch(erro){gbmToast(erro.message,'erro')}
        });
        carregarNotificacoes();carregarPreferencias();
