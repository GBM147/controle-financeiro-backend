    async function carregarAssinatura() {
        try {
            const res = await fetchApi('/minha-assinatura');
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            const cardContainer = document.getElementById('card-assinatura');
            const trialValido = data.trial_expira && new Date() <= new Date(data.trial_expira);
            const dataBr = (valor) => new Date(valor).toLocaleDateString('pt-BR');

            // Qual plano está valendo para a conta agora.
            const isPremiumActive = (data.status_pagamento === 'pago') ||
                                    (data.status_pagamento === 'trial' && trialValido) ||
                                    (data.status_pagamento === 'cancelado' && trialValido);
            const isFreeActive = !isPremiumActive;

            let statusPremiumHtml = '';
            let infoPremiumHtml = '';
            let botaoPremiumHtml = '';
            const botaoAssinar = (texto) => `<button type="button" data-acao="gbm:navegar" data-args="[&quot;pagamento.html&quot;]" class="btn btn-primario btn-upgrade">${texto}</button>`;
            const botaoCancelar = (texto) => `<button type="button" class="btn btn-cancelar-assinatura" data-acao="pedirCancelamento">${texto}</button>`;

            if (data.status_pagamento === 'pago') {
                statusPremiumHtml = '<span class="badge-status status-ativo">Ativo</span>';
                infoPremiumHtml = 'Renovação automática ativada.';
                botaoPremiumHtml = botaoCancelar('Cancelar assinatura');
            } else if (data.status_pagamento === 'trial' && trialValido) {
                statusPremiumHtml = '<span class="badge-status status-trial">Período de teste</span>';
                infoPremiumHtml = `Primeira cobrança em ${dataBr(data.trial_expira)}.`;
                botaoPremiumHtml = botaoAssinar('Assinar agora') + botaoCancelar('Cancelar teste');
            } else if (data.status_pagamento === 'cancelado' && trialValido) {
                statusPremiumHtml = '<span class="badge-status status-cancelado">Cancelado</span>';
                infoPremiumHtml = `Acesso Premium até ${dataBr(data.trial_expira)}.`;
                botaoPremiumHtml = botaoAssinar('Reativar Premium');
            } else {
                statusPremiumHtml = '<span class="badge-status status-inativo">Inativo</span>';
                infoPremiumHtml = 'Assine para liberar os relatórios e usar o GBM sem anúncios.';
                botaoPremiumHtml = botaoAssinar('Assinar o Premium');
            }

            const recursosComuns = [
                'Importação de OFX e PDF',
                'Lançamentos manuais e edição',
                'Visão geral das finanças',
                'Objetivos de poupança, limites e calendário',
                'Contas e notificações',
                'Instalação como aplicativo'
            ].map((item) => `<li>${item}</li>`).join('');

            cardContainer.innerHTML = `
                <div class="planos-grid">
                    <article class="plano-card${isFreeActive ? ' plano-ativo' : ''}">
                        ${isFreeActive ? '<span class="plano-badge-atual">Seu plano</span>' : ''}
                        <h3>Gratuito</h3>
                        <p class="plano-preco">R$ 0,00 <span>/ mês</span></p>
                        <ul class="plano-features">
                            ${recursosComuns}
                            <li class="feature-inativa">Relatórios mensais detalhados</li>
                            <li class="feature-inativa">Comparativos de gastos</li>
                            <li class="feature-aviso">Exibe anúncios</li>
                        </ul>
                        <div class="plano-rodape">
                            ${isFreeActive
                                ? '<button type="button" class="btn" disabled>Plano em uso</button>'
                                : '<p class="plano-info">Plano base da conta.</p>'}
                        </div>
                    </article>

                    <article class="plano-card plano-premium${isPremiumActive ? ' plano-ativo' : ''}">
                        ${isPremiumActive ? '<span class="plano-badge-atual">Seu plano</span>' : ''}
                        <h3>Premium</h3>
                        <p class="plano-preco">R$ 9,90 <span>/ mês</span></p>
                        <ul class="plano-features">
                            ${recursosComuns}
                            <li class="feature-destaque">Relatórios mensais detalhados</li>
                            <li class="feature-destaque">Comparativos de gastos</li>
                            <li class="feature-destaque">Sem anúncios</li>
                        </ul>
                        <div class="plano-rodape">
                            <div class="plano-status"><span>Status</span>${statusPremiumHtml}</div>
                            <p class="plano-info">${infoPremiumHtml}</p>
                            <div class="plano-acoes">${botaoPremiumHtml}</div>
                        </div>
                    </article>
                </div>
            `;
        } catch (error) {
            document.getElementById('card-assinatura').innerHTML = '<p class="empty erro">Não foi possível carregar os dados da assinatura.</p>';
        }
    }
    async function pedirCancelamento() {
        const confirmar = await gbmConfirmar('Você mantém o acesso Premium até o fim do ciclo atual. Depois disso, os relatórios avançados ficam bloqueados e os anúncios voltam a aparecer.', {
            titulo: 'Cancelar a assinatura?',
            confirmar: 'Cancelar assinatura',
            cancelar: 'Manter Premium',
            perigo: true
        });
        
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

