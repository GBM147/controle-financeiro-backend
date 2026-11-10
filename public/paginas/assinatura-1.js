    async function carregarAssinatura() {
        try {
            const res = await fetchApi('/minha-assinatura');
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            const cardContainer = document.getElementById('card-assinatura');
            
            // Remove o estilo do container antigo para ele virar apenas um wrapper invisível
            cardContainer.style.background = 'transparent';
            cardContainer.style.border = 'none';
            cardContainer.style.boxShadow = 'none';
            cardContainer.style.padding = '0';

            const trialValido = data.trial_expira && new Date() <= new Date(data.trial_expira);

            // Validação absoluta de qual plano está no controle da conta
            const isPremiumActive = (data.status_pagamento === 'pago') || 
                                    (data.status_pagamento === 'trial' && trialValido) || 
                                    (data.status_pagamento === 'cancelado' && trialValido);
            const isFreeActive = !isPremiumActive;

            // --- CONSTRUÇÃO DOS DADOS DO CARD PREMIUM ---
            let statusPremiumHtml = '';
            let infoPremiumHtml = '';
            let botaoPremiumHtml = '';

            if (data.status_pagamento === 'pago') {
                statusPremiumHtml = '<span class="badge-status status-ativo">Plano Ativo</span>';
                infoPremiumHtml = 'Renovação automática ativada';
                botaoPremiumHtml = `<button class="btn-cancelar-assinatura" style="margin-top: 15px; width: 100%;" data-acao="pedirCancelamento">Cancelar Assinatura</button>`;
                
            } else if (data.status_pagamento === 'trial' && trialValido) {
                statusPremiumHtml = '<span class="badge-status status-trial">Período de Teste</span>';
                const expira = new Date(data.trial_expira).toLocaleDateString('pt-BR');
                infoPremiumHtml = `1º Cobrança em: ${expira}`;
                botaoPremiumHtml = `
                    <button data-acao="gbm:navegar" data-args="[&quot;pagamento.html&quot;]" class="btn-upgrade">Assinar Definitivo</button>
                    <button class="btn-cancelar-assinatura" style="margin-top: 15px; width: 100%;" data-acao="pedirCancelamento">Cancelar Teste</button>
                `;
                
            } else if (data.status_pagamento === 'cancelado' && trialValido) {
                statusPremiumHtml = '<span class="badge-status status-cancelado">Cancelado (No Prazo)</span>';
                infoPremiumHtml = `Acesso premium até ${new Date(data.trial_expira).toLocaleDateString('pt-BR')}`;
                botaoPremiumHtml = `
                    <button data-acao="gbm:navegar" data-args="[&quot;pagamento.html&quot;]" class="btn-upgrade">Reativar Premium Agora</button>
                `;
            } else {
                statusPremiumHtml = '<span class="badge-status" style="background: rgba(255,255,255,0.05); color: #8a9ba8; border: 1px solid rgba(255,255,255,0.1);">Inativo</span>';
                infoPremiumHtml = `Faça o upgrade para liberar todos os recursos.`;
                botaoPremiumHtml = `
                    <button data-acao="gbm:navegar" data-args="[&quot;pagamento.html&quot;]" class="btn-upgrade">Fazer Upgrade Agora</button>
                `;
            }

            // --- INJEÇÃO DA VITRINE (GRID) COM OS DOIS PLANOS ---
            cardContainer.innerHTML = `
                <div class="planos-grid">
                    
                    <!-- CARD: PLANO GRATUITO -->
                    <div class="plano-card ${isFreeActive ? 'plano-ativo' : ''}" style="border: 1px solid ${isFreeActive ? '#8a9ba8' : 'rgba(255,255,255,0.05)'};">
                        ${isFreeActive ? '<div class="plano-badge-atual">Seu Plano Atual</div>' : ''}
                        
                        <h3 style="margin:0 0 5px 0; color: #fff; font-size: 1.2rem;">Plano Gratuito</h3>
                        <h2 style="margin:0 0 25px 0; color: #8a9ba8; font-size: 1.8rem;">R$ 0,00 <span style="font-size: 0.9rem; font-weight: 400;">/ mês</span></h2>
                        
                        <ul class="plano-features">
                            <li>Importação de OFX e PDF</li>
                            <li>Lançamentos Manuais e Edição</li>
                            <li>Dashboard de Resumo Financeiro</li>
                            <li>Objetivos de poupança, Limites e Calendário</li>
                            <li>Contas e Notificações</li>
                            <li>Instalação como App (PWA)</li>
                            <li class="feature-inativa">Relatórios Mensais Detalhados</li>
                            <li class="feature-inativa">Comparativos de Gastos</li>
                            <li style="color: #ff9800;">Plataforma com Anúncios</li>
                        </ul>
                        
                        ${isFreeActive 
                            ? `<button disabled style="width: 100%; padding: 14px; margin-top: 15px; background: rgba(255,255,255,0.05); color: #8a9ba8; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-weight: 600; cursor: not-allowed; font-family: 'Inter', sans-serif;">Plano em uso</button>` 
                            : `<div style="text-align: center; color: #6c7a87; font-size: 0.9rem; margin-top: 15px; padding: 14px;">Plano base da conta</div>`}
                    </div>

                    <!-- CARD: PREMIUM GBM -->
                    <div class="plano-card ${isPremiumActive ? 'plano-ativo' : ''}" style="border: 1px solid ${isPremiumActive ? '#2E8B57' : 'rgba(255,255,255,0.05)'};">
                        ${isPremiumActive ? '<div class="plano-badge-atual" style="background: #2E8B57; color: #fff;">Seu Plano Atual</div>' : ''}
                        
                        <h3 style="margin:0 0 5px 0; color: #fff; font-size: 1.2rem;">Premium GBM</h3>
                        <h2 style="margin:0 0 25px 0; color: #fff; font-size: 1.8rem;">R$ 9,90 <span style="font-size: 0.9rem; font-weight: 400; color: #8a9ba8;">/ mês</span></h2>
                        
                        <ul class="plano-features">
                            <li>Importação de OFX e PDF</li>
                            <li>Lançamentos Manuais e Edição</li>
                            <li>Dashboard de Resumo Financeiro</li>
                            <li>Objetivos de poupança, Limites e Calendário</li>
                            <li>Contas e Notificações</li>
                            <li>Instalação como App (PWA)</li>
                            <li style="color: #3cb371; font-weight: 500;">Relatórios Mensais Detalhados</li>
                            <li style="color: #3cb371; font-weight: 500;">Comparativos de Gastos</li>
                            <li style="color: #3cb371; font-weight: 500;">Experiência Zero Anúncios</li>
                        </ul>
                        
                        <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <span style="font-size: 0.9rem; color: #8a9ba8;">Status:</span>
                                ${statusPremiumHtml}
                            </div>
                            <p style="font-size: 0.85rem; color: #8a9ba8; margin-bottom: 15px; text-align: center;">${infoPremiumHtml}</p>
                            ${botaoPremiumHtml}
                        </div>
                    </div>

                </div>
            `;
        } catch (error) {
            document.getElementById('card-assinatura').innerHTML = `<p style="text-align: center; color: #ff4d4d;">Erro ao carregar dados.</p>`;
        }
    }
    async function pedirCancelamento() {
        const confirmar = await gbmConfirmar("Tem certeza que deseja cancelar sua assinatura? Você perderá acesso às automações OFX e relatórios após o fim do seu ciclo atual.");
        
        if (confirmar) {
            try {
                const res = await fetchApi('/cancelar-assinatura', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: window.GBMSession.getUserId() })
                });
                const result = await res.json();

                if (result.success) {
                    gbmAlerta(result.message);
                    carregarAssinatura(); // Recarrega a tela para mostrar o status "Cancelado"
                } else {
                    gbmAlerta("Erro ao cancelar: " + result.message, 'erro');
                }
            } catch (error) {
                gbmAlerta("Falha de conexão ao tentar cancelar.", 'erro');
            }
        }
    }

    carregarAssinatura();

    // --- SISTEMA GBM DE NOTIFICAÇÕES/CONFIRMAÇÕES ---
    let _resolveConfirm = null;

    const escaparMensagemModal = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);

    function gbmAlerta(mensagem, tipo = 'info') {
        const cor   = tipo === 'erro'  ? 'rgba(239,68,68,0.3)' : tipo === 'aviso' ? 'rgba(245,158,11,0.3)' : 'rgba(95,255,168,0.3)';

        document.getElementById('lista-notificacoes-modal').innerHTML = `
            <div style="background:rgba(15,23,42,0.8); border:1px solid ${cor}; border-radius:10px; padding:20px; font-family:'Inter',sans-serif; font-size:0.95rem; line-height:1.6; text-align:center;">
                ${escaparMensagemModal(mensagem)}
            </div>`;
        document.getElementById('btn-confirmar-modal').style.display = 'none';
        document.getElementById('btn-fechar-modal').innerText = 'FECHAR';
        document.getElementById('modal-notificacoes').style.display = 'flex';
        _resolveConfirm = null;
    }

    function gbmConfirmar(mensagem) {
        return new Promise(resolve => {
            _resolveConfirm = resolve;
            document.getElementById('lista-notificacoes-modal').innerHTML = `
                <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.4); border-radius:10px; padding:20px; font-family:'Inter',sans-serif; font-size:0.95rem; line-height:1.6; text-align:center;">
                    ${escaparMensagemModal(mensagem)}
                </div>`;
            document.getElementById('btn-confirmar-modal').style.display = 'block';
            document.getElementById('btn-fechar-modal').innerText = 'MANTER ASSINATURA';
            document.getElementById('modal-notificacoes').style.display = 'flex';
        });
    }

    function fecharModalNotificacoes(confirmado = false) {
        document.getElementById('modal-notificacoes').style.display = 'none';
        if (_resolveConfirm) {
            _resolveConfirm(confirmado);
            _resolveConfirm = null;
        }
    }
